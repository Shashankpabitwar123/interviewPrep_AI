import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import PrepPlan
from app.schemas.study_note import (
    NoteSection,
    StudyNoteAskRequest,
    StudyNoteAskResponse,
    StudyNoteImproveRequest,
    StudyNoteImproveResponse,
    StudyNoteRequest,
    StudyNoteResponse,
    StudyResource,
    WebResearchSource,
)
from app.ai_policy import require_ai_result
from app.services.gemini_service import generate_gemini_json
from app.services.research_service import ResearchResult, research_for_note


logger = logging.getLogger(__name__)


def generate_study_note(db: Session, request: StudyNoteRequest, settings: Optional[Settings]) -> Optional[StudyNoteResponse]:
    plan = db.get(PrepPlan, request.prep_plan_id)
    if plan is None:
        return None
    research = research_for_note(
        settings,
        role=plan.job_post.title,
        company=_company_hint(plan.job_post.description, plan.job_post.source_url),
        topics=request.topics,
        job_description=plan.job_post.description,
    )

    if settings and settings.openai_enabled:
        try:
            return _generate_with_openai(plan, request, settings, research)
        except Exception as exc:
            logger.warning("OpenAI study note generation failed: %s", exc)

    if settings and settings.gemini_enabled:
        try:
            return _generate_with_gemini(plan, request, settings, research)
        except Exception as exc:
            logger.warning("Gemini study note generation failed: %s", exc)

    require_ai_result("AI study-note generation failed. Enable local fallback in settings to create an offline note.")
    return _fallback_note(plan, request, research, source="heuristic")


def answer_note_question(request: StudyNoteAskRequest, settings: Optional[Settings]) -> StudyNoteAskResponse:
    """Answer follow-up note questions with OpenAI only; never use web research here."""
    if settings and settings.openai_enabled:
        try:
            return _answer_with_openai(request, settings)
        except Exception as exc:
            logger.warning("OpenAI study note question failed: %s", exc)
    if settings and settings.gemini_enabled:
        try:
            return _answer_with_gemini(request, settings)
        except Exception as exc:
            logger.warning("Gemini study note question failed: %s", exc)
    require_ai_result("AI could not answer this note question. Enable local fallback in settings to use an offline answer.")
    return _fallback_note_answer(request)


def improve_note(request: StudyNoteImproveRequest, settings: Optional[Settings]) -> StudyNoteImproveResponse:
    if settings and settings.openai_enabled:
        try:
            return _improve_with_openai(request, settings)
        except Exception as exc:
            logger.warning("OpenAI note improvement failed: %s", exc)
    if settings and settings.gemini_enabled:
        try:
            return _improve_with_gemini(request, settings)
        except Exception as exc:
            logger.warning("Gemini note improvement failed: %s", exc)
    require_ai_result("AI could not improve this note. Enable local fallback in settings to use offline cleanup.")
    return _fallback_improved_note(request)


def _generate_with_openai(plan: PrepPlan, request: StudyNoteRequest, settings: Settings, research: list[ResearchResult]) -> StudyNoteResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.responses.parse(
        model=settings.openai_model,
        input=[
            {
                "role": "system",
                "content": (
                    "You create serious interview preparation notes. "
                    "Use the job description carefully. Be practical, specific, and honest. "
                    "Do not claim live web access or recent data unless provided. "
                    "When discussing industry trends, phrase them as durable signals to verify, not breaking news."
                ),
            },
            {"role": "user", "content": _note_prompt(plan, request, research)},
        ],
        text_format=StudyNoteResponse,
    )
    return _ensure_research_sources(response.output_parsed, research).model_copy(update={"source": "openai"})


def _generate_with_gemini(plan: PrepPlan, request: StudyNoteRequest, settings: Settings, research: list[ResearchResult]) -> StudyNoteResponse:
    data = generate_gemini_json(settings, _note_prompt(plan, request, research), _gemini_note_schema())
    return _ensure_research_sources(StudyNoteResponse.model_validate(data), research).model_copy(update={"source": "gemini"})


def _answer_with_openai(request: StudyNoteAskRequest, settings: Settings) -> StudyNoteAskResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.responses.parse(
        model=settings.openai_model,
        input=[
            {
                "role": "system",
                "content": (
                    "You are an interview preparation tutor inside a study note. "
                    "Answer the user's question using only the note context supplied by the app. "
                    "Do not browse the web, do not mention Tavily, and do not invent sources. "
                    "Be beginner-friendly when the user sounds new, but still be concrete and interview-focused. "
                    "Give a useful answer, then explain how the user can say it in an interview."
                ),
            },
            {"role": "user", "content": _ask_prompt(request)},
        ],
        text_format=StudyNoteAskResponse,
    )
    return response.output_parsed.model_copy(update={"source": "openai"})


def _answer_with_gemini(request: StudyNoteAskRequest, settings: Settings) -> StudyNoteAskResponse:
    data = generate_gemini_json(settings, _ask_prompt(request), _gemini_ask_schema())
    return StudyNoteAskResponse.model_validate(data).model_copy(update={"source": "gemini"})


def _improve_with_openai(request: StudyNoteImproveRequest, settings: Settings) -> StudyNoteImproveResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.responses.parse(
        model=settings.openai_model,
        input=[
            {
                "role": "system",
                "content": (
                    "You improve student interview-prep notes. Preserve the user's meaning, "
                    "fix grammar, organize the content with clear headings, and make it useful "
                    "for interview preparation. Do not add fake facts or sources."
                ),
            },
            {"role": "user", "content": _improve_prompt(request)},
        ],
        text_format=StudyNoteImproveResponse,
    )
    return response.output_parsed.model_copy(update={"source": "openai"})


def _improve_with_gemini(request: StudyNoteImproveRequest, settings: Settings) -> StudyNoteImproveResponse:
    data = generate_gemini_json(settings, _improve_prompt(request), _gemini_improve_schema())
    return StudyNoteImproveResponse.model_validate(data).model_copy(update={"source": "gemini"})


def _improve_prompt(request: StudyNoteImproveRequest) -> str:
    return (
        "Improve this note as JSON.\n\n"
        f"Title: {request.title or 'Untitled note'}\n"
        f"Folder: {request.folder or 'Notes'}\n"
        f"Role: {request.role or 'Unknown role'}\n\n"
        f"Original body:\n{request.body or 'No body yet.'}\n\n"
        "Requirements:\n"
        "- Keep the improved body concise but useful.\n"
        "- Use simple Markdown-style headings and bullets.\n"
        "- Include an Interview angle section when useful.\n"
        "- Fix grammar and clarify vague points.\n"
        "- Return a subtle color hex that matches the note topic."
    )


def _ask_prompt(request: StudyNoteAskRequest) -> str:
    sections = "\n".join(
        f"- {section.title}: {section.body} {'; '.join(section.bullets[:5])}"
        for section in request.sections[:8]
    )
    history = "\n".join(
        f"Previous Q: {turn.question}\nPrevious A: {turn.answer[:700]}"
        for turn in request.history[-5:]
    ) or "No previous questions in this note."
    topics = ", ".join(request.topics) or request.note_title
    return (
        "Answer the user's question as JSON.\n\n"
        f"Note title: {request.note_title}\n"
        f"Role: {request.role or 'Unknown role'}\n"
        f"Topics: {topics}\n"
        f"Summary: {request.summary}\n\n"
        f"Note sections:\n{sections}\n\n"
        f"Conversation history:\n{history}\n\n"
        f"User question: {request.question}\n\n"
        "Requirements:\n"
        "- Explain in simple language first.\n"
        "- Give concrete first steps if the user is a beginner.\n"
        "- Connect the answer to the target interview.\n"
        "- Include 2-4 next_steps the user can take while studying this note."
    )


def _fallback_note_answer(request: StudyNoteAskRequest) -> StudyNoteAskResponse:
    topics = ", ".join(request.topics) or request.note_title
    lower_question = request.question.lower()
    beginner = any(word in lower_question for word in ["beginner", "start", "first", "new", "basic"])
    if beginner:
        answer = (
            f"Start with the basics of {topics}: learn what the topic means, why it matters for the role, "
            "and one small real example. Then write a 4-5 sentence explanation in your own words. "
            "After that, practice one question where you explain the idea, one where you compare it to another idea, "
            "and one where you apply it to the job description."
        )
    else:
        answer = (
            f"For {topics}, focus on the practical meaning, the decision it helps you make, and the mistakes to avoid. "
            "A strong answer should include a definition, a job-related example, one tradeoff, and how you would validate your approach."
        )
    return StudyNoteAskResponse(
        answer=answer,
        interview_use=(
            f"In the interview, say it like this: 'For {topics}, I would first identify the goal, "
            "then choose an approach based on the constraints. One tradeoff is..., and I would validate it by...'"
        ),
        next_steps=[
            f"Write a one-minute explanation of {topics}.",
            "Prepare one project or class example.",
            "List one tradeoff and one common mistake.",
        ],
        source="local fallback",
    )


def _fallback_improved_note(request: StudyNoteImproveRequest) -> StudyNoteImproveResponse:
    title = request.title.strip() or "Untitled note"
    body = request.body.strip() or "Add the main idea, one example, and what you would say in an interview."
    improved = (
        f"## {title}\n\n"
        f"{body}\n\n"
        "## Interview angle\n"
        "- Explain the core idea in simple language.\n"
        "- Add one concrete example from a project, class, or work experience.\n"
        "- Mention one tradeoff, mistake, or edge case.\n\n"
        "## Quick review\n"
        "- Can I explain this in under one minute?\n"
        "- Can I connect it to the job description?\n"
        "- Do I have one example ready?"
    )
    return StudyNoteImproveResponse(title=title, body=improved, color="#2563eb", source="local fallback")


def _note_prompt(plan: PrepPlan, request: StudyNoteRequest, research: list[ResearchResult]) -> str:
    topics = ", ".join(request.topics) or request.title
    research_text = _research_context(research)
    return (
        "Create a full interview preparation note as JSON only.\n"
        "The note must prepare the user for the actual role, not give generic bullets.\n"
        "Include:\n"
        "- a clear title and subtitle\n"
        "- a practical summary\n"
        "- sections for what this note teaches, key points, what to prepare for interview, how to explain it, common mistakes, and role-specific angle\n"
        "- deep_dive sections with detailed explanations and examples\n"
        "- likely interview questions for this role/topic\n"
        "- related topics to study deeper\n"
        "- resources with useful links. Prefer official documentation, reputable learning docs, and the provided research sources.\n"
        "- web_research showing the sources used with title, url, summary, and query.\n"
        "- a checklist for readiness before the practice exam\n\n"
        "Important: Do not invent exact recent interview questions from companies. Use web research only as support, summarize it briefly, and cite links.\n\n"
        f"Role: {plan.job_post.title}\n"
        f"Plan summary: {plan.summary}\n"
        f"Day: {request.day}\n"
        f"Note title: {request.title}\n"
        f"Topics: {topics}\n"
        f"Task instructions: {request.instructions}\n\n"
        f"Job description:\n{plan.job_post.description[:8000]}\n\n"
        f"Web research summaries:\n{research_text}"
    )


def _fallback_note(plan: PrepPlan, request: StudyNoteRequest, research: list[ResearchResult], source: str) -> StudyNoteResponse:
    topics = request.topics or [request.title.replace("Read notes:", "").strip()]
    topic = topics[0] if topics else "Interview topic"
    role = plan.job_post.title
    description = plan.job_post.description.lower()
    role_signals = _role_signals(description)
    resources = _resources_for_topics(topics, research)
    web_research = _research_sources(research)

    return StudyNoteResponse(
        title=f"Interview prep note: {topic}",
        subtitle=f"How {topic} matters for {role}",
        role=role,
        topics=topics,
        summary=(
            f"This note prepares you to explain {topic} in the context of {role}. "
            "Focus on what the topic means in real work, how you would use it, what tradeoffs appear, "
            "and how to connect your answer to the job description."
        ),
        sections=[
            NoteSection(
                title="What this note is teaching",
                body=f"You are learning how to discuss {topic} as an interview-ready skill, not just as a definition.",
                bullets=[
                    f"What {topic} means in practical work",
                    f"Where {topic} appears in this job",
                    "How to explain your decisions with examples, tradeoffs, and constraints",
                ],
            ),
            NoteSection(
                title="Key points to understand",
                body=f"For {role}, the interviewer wants to know whether you can apply {topic} responsibly.",
                bullets=[
                    "Define the concept clearly in one or two sentences",
                    "Give one realistic project, class, internship, or portfolio example",
                    "Mention what can go wrong if the concept is used badly",
                    "Explain how you would validate quality, correctness, or user impact",
                ],
            ),
            NoteSection(
                title="What to prepare for the interview",
                body="Prepare answers that show both knowledge and judgment.",
                bullets=[
                    f"A 60-second explanation of {topic}",
                    "One detailed example with your role, action, and result",
                    "One tradeoff or limitation",
                    "One follow-up question you might ask the interviewer",
                ],
            ),
            NoteSection(
                title="Role-specific angle",
                body=f"The job description emphasizes {', '.join(role_signals)}. Connect {topic} back to those signals.",
                bullets=[f"Use {topic} to show {signal}" for signal in role_signals[:4]],
            ),
            NoteSection(
                title="Common mistakes to avoid",
                body="Weak answers sound memorized. Strong answers show that you can reason.",
                bullets=[
                    "Do not stop at a textbook definition",
                    "Do not claim experience you cannot explain",
                    "Do not ignore constraints like time, quality, communication, or maintainability",
                    "Do not forget to connect the answer back to the role",
                ],
            ),
        ],
        deep_dive=[
            NoteSection(
                title=f"How to explain {topic} deeply",
                body=(
                    f"Start with the purpose of {topic}, then describe a situation where it matters. "
                    "After that, explain the decision you would make, the tradeoff you would consider, "
                    "and how you would know your approach worked."
                ),
                bullets=[
                    "Purpose: what problem this topic helps solve",
                    "Decision: what choice it helps you make",
                    "Tradeoff: what you gain and what you give up",
                    "Validation: how you prove the work is correct or useful",
                ],
            ),
            NoteSection(
                title="Interview answer structure",
                body=(
                    f"Use this structure: 'In this role, {topic} matters because... "
                    "I used or would use it when... The main tradeoff is... I would validate it by...'"
                ),
                bullets=[],
            ),
        ],
        interview_questions=[
            f"Explain {topic} to someone who is not familiar with it.",
            f"Tell me about a time you used {topic} or a related skill in a project.",
            f"What tradeoffs or mistakes should someone watch for with {topic}?",
            f"How would you apply {topic} to the responsibilities in this role?",
        ],
        related_topics=_related_topics(topics, role_signals),
        web_research=web_research,
        resources=resources,
        checklist=[
            f"I can explain {topic} in under one minute.",
            f"I can connect {topic} to the job description.",
            "I have one concrete example ready.",
            "I can name one tradeoff, risk, or mistake.",
            "I know what I would study next if the interviewer goes deeper.",
        ],
        source=source,
    )


def _role_signals(description: str) -> list[str]:
    signals = []
    checks = [
        ("problem solving", ["problem-solving", "problem solving", "solve"]),
        ("communication", ["communication", "client", "presentation", "collaborate"]),
        ("technical execution", ["software", "design", "model", "estimate", "api", "database", "rendering"]),
        ("project ownership", ["project management", "ownership", "scheduling", "coordinate"]),
        ("quality and attention to detail", ["detail", "accuracy", "quality", "review"]),
        ("learning quickly", ["learn quickly", "eager to learn", "mentored", "recent graduate"]),
    ]
    for label, keywords in checks:
        if any(keyword in description for keyword in keywords):
            signals.append(label)
    return signals or ["role fit", "clear communication", "practical judgment"]


def _related_topics(topics: list[str], role_signals: list[str]) -> list[str]:
    related = []
    for topic in topics:
        related.extend([f"{topic} examples", f"{topic} tradeoffs", f"{topic} interview questions"])
    related.extend(role_signals[:3])
    return list(dict.fromkeys(related))[:8]


def _resources_for_topics(topics: list[str], research: list[ResearchResult]) -> list[StudyResource]:
    resources = [
        StudyResource(title=item.title, url=item.url, why=f"Found while researching: {item.query}")
        for item in research[:4]
    ]
    for topic in topics[:4]:
        query = topic.replace(" ", "+")
        resources.append(
            StudyResource(
                title=f"Search reputable sources for {topic}",
                url=f"https://www.google.com/search?q={query}+official+documentation+interview+guide",
                why="Use this to find current official docs and deeper examples for the exact topic.",
            )
        )
    resources.append(
        StudyResource(
            title="Google Interview Warmup",
            url="https://grow.google/certificates/interview-warmup/",
            why="Useful for practicing spoken interview answers and improving clarity.",
        )
    )
    return resources[:6]


def _research_context(research: list[ResearchResult]) -> str:
    if not research:
        return "No live web research was available. Generate notes from the job description and plan context."
    lines = []
    for index, item in enumerate(research, start=1):
        lines.append(
            f"{index}. Title: {item.title}\n"
            f"   URL: {item.url}\n"
            f"   Query: {item.query}\n"
            f"   Summary: {item.content[:600]}"
        )
    return "\n".join(lines)


def _research_sources(research: list[ResearchResult]) -> list[WebResearchSource]:
    return [
        WebResearchSource(
            title=item.title,
            url=item.url,
            summary=item.content[:500] or "Relevant source found during web research.",
            query=item.query,
        )
        for item in research
    ]


def _ensure_research_sources(note: StudyNoteResponse, research: list[ResearchResult]) -> StudyNoteResponse:
    if note.web_research:
        return note
    return note.model_copy(update={"web_research": _research_sources(research)})


def _company_hint(description: str, source_url: str | None) -> str:
    if source_url:
        host = source_url.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
        parts = [part for part in host.split(".") if part not in {"careers", "jobs", "boards", "apply"}]
        if parts:
            return parts[0].title()
    lines = [line.strip() for line in description.splitlines() if line.strip()]
    for index, line in enumerate(lines[:8]):
        if "logo" in line.lower() and index + 1 < len(lines):
            return lines[index + 1]
    return ""


def _gemini_note_schema() -> dict:
    section_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "body": {"type": "string"},
            "bullets": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["title", "body", "bullets"],
    }
    resource_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "url": {"type": "string"},
            "why": {"type": "string"},
        },
        "required": ["title", "url", "why"],
    }
    return {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "subtitle": {"type": "string"},
            "role": {"type": "string"},
            "topics": {"type": "array", "items": {"type": "string"}},
            "summary": {"type": "string"},
            "sections": {"type": "array", "items": section_schema},
            "deep_dive": {"type": "array", "items": section_schema},
            "interview_questions": {"type": "array", "items": {"type": "string"}},
            "related_topics": {"type": "array", "items": {"type": "string"}},
            "resources": {"type": "array", "items": resource_schema},
            "checklist": {"type": "array", "items": {"type": "string"}},
            "source": {"type": "string"},
        },
        "required": ["title", "subtitle", "role", "topics", "summary", "sections", "deep_dive", "interview_questions", "related_topics", "resources", "checklist", "source"],
    }


def _gemini_ask_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "interview_use": {"type": "string"},
            "next_steps": {"type": "array", "items": {"type": "string"}},
            "source": {"type": "string"},
        },
        "required": ["answer", "interview_use", "next_steps"],
    }


def _gemini_improve_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "body": {"type": "string"},
            "color": {"type": "string"},
            "source": {"type": "string"},
        },
        "required": ["title", "body", "color"],
    }
