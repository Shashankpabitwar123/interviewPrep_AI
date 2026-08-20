import logging
import json
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import ArtifactFeedback, CompetencyEvidence, MockInterview, MockMessage, PrepPlan, User
from app.ai_policy import require_ai_result
from app.schemas.mock_interview import MockAnswerRequest, MockInterviewResponse, MockInterviewStartRequest
from app.schemas.role_intelligence import RoleBlueprint
from app.services.gemini_service import generate_gemini_json
from app.services.role_intelligence_service import blueprint_context
from app.services.artifact_quality_service import assess_mock_plan, question_text_is_usable
from app.services.competency_service import prioritized_topics, record_mock_evidence
from app.services.experience_service import interview_evidence_context

logger = logging.getLogger(__name__)

QUESTION_TYPES = ["technical", "one_word", "multiple_choice", "multiple_select", "coding", "behavioral", "team_problem_solving"]
QUESTION_COUNT_BY_DIFFICULTY = {"easy": 4, "medium": 6, "hard": 8}


class MockQuestionOutput(BaseModel):
    question: str


class MockFeedbackOutput(BaseModel):
    score: float = Field(ge=0, le=1)
    feedback: str
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    dimensions: dict[str, float] = Field(default_factory=dict)
    follow_up_question: str


def start_mock_interview(
    db: Session,
    request: MockInterviewStartRequest,
    settings: Optional[Settings] = None,
    user: Optional[User] = None,
) -> Optional[MockInterviewResponse]:
    """Start a mock interview session for a saved prep plan."""

    plan = db.get(PrepPlan, request.prep_plan_id)
    if plan is None or not _owns_plan(plan, user):
        return None

    config = _mock_config(request)
    config["interview_evidence"] = interview_evidence_context(
        db,
        role_title=plan.job_post.title,
        company=plan.job_post.company or "",
        user=user,
    )
    role_blueprint = _role_blueprint_for_plan(plan)
    scope_topics = _topics_for_mock_scope(plan, request)
    adaptive_topics = scope_topics if request.focus_topics or request.topic else prioritized_topics(db, plan, scope_topics, user)
    session_plan = _build_session_plan(plan, request, config, role_blueprint, adaptive_topics)
    quality_blueprint = None if request.focus_topics or request.topic else role_blueprint
    quality_report = assess_mock_plan(session_plan, config["question_count"], quality_blueprint)
    config["session_plan"] = session_plan
    first_slot = session_plan[0]
    topic = first_slot["topic"]
    interview = MockInterview(
        prep_plan_id=plan.id,
        current_topic=topic,
        status="active",
        session_plan=session_plan,
        quality_report=quality_report,
    )
    db.add(interview)
    db.flush()
    db.add(MockMessage(mock_interview_id=interview.id, role="meta", content=json.dumps(config)))
    question_type = first_slot["question_type"]
    ai_question = _question_with_ai(plan, topic, question_type, config, settings, first_slot, role_blueprint)
    if ai_question and not question_text_is_usable(ai_question):
        ai_question = _question_with_ai(plan, topic, question_type, config, settings, first_slot, role_blueprint)
    if ai_question and not question_text_is_usable(ai_question):
        ai_question = None
    if ai_question:
        question = ai_question
    else:
        require_ai_result("AI mock interview generation failed. Enable local fallback in settings to start an offline mock interview.")
        question = _question(topic, question_type, config["difficulty"])
    db.add(MockMessage(mock_interview_id=interview.id, role="interviewer", content=question))
    db.commit()
    db.refresh(interview)
    return _to_response(interview)


def get_mock_interview(db: Session, mock_interview_id: int, user: Optional[User] = None) -> Optional[MockInterviewResponse]:
    interview = db.get(MockInterview, mock_interview_id)
    if interview is None or not _owns_plan(interview.prep_plan, user):
        return None
    return _to_response(interview)


def list_mock_interviews(db: Session, user: Optional[User] = None, prep_plan_id: Optional[int] = None) -> list[MockInterviewResponse]:
    query = db.query(MockInterview).join(MockInterview.prep_plan).join(PrepPlan.job_post)
    query = query.filter(PrepPlan.job_post.has(user_id=user.id)) if user else query.filter(PrepPlan.job_post.has(user_id=None))
    if prep_plan_id is not None:
        query = query.filter(MockInterview.prep_plan_id == prep_plan_id)
    return [_to_response(interview) for interview in query.order_by(MockInterview.created_at.desc(), MockInterview.id.desc()).all()]


def delete_mock_interview(db: Session, mock_interview_id: int, user: Optional[User] = None) -> bool:
    interview = db.get(MockInterview, mock_interview_id)
    if interview is None or not _owns_plan(interview.prep_plan, user):
        return False
    feedback_ids = [str(message.id) for message in interview.messages if message.role == "feedback"]
    if feedback_ids:
        db.query(CompetencyEvidence).filter(
            CompetencyEvidence.job_post_id == interview.prep_plan.job_post_id,
            CompetencyEvidence.source_type == "mock_answer",
            CompetencyEvidence.source_id.in_(feedback_ids),
        ).delete(synchronize_session=False)
    db.query(ArtifactFeedback).filter(
        ArtifactFeedback.job_post_id == interview.prep_plan.job_post_id,
        ArtifactFeedback.artifact_type == "mock_interview",
        ArtifactFeedback.artifact_id == str(interview.id),
    ).delete(synchronize_session=False)
    db.delete(interview)
    db.commit()
    return True


def complete_mock_interview(db: Session, mock_interview_id: int, user: Optional[User] = None) -> Optional[MockInterviewResponse]:
    interview = db.get(MockInterview, mock_interview_id)
    if interview is None or not _owns_plan(interview.prep_plan, user):
        return None
    interview.status = "complete"
    scores = [float(message.score) for message in interview.messages if message.score is not None]
    interview.average_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    interview.overall_feedback = _overall_feedback(interview)
    db.commit()
    db.refresh(interview)
    return _to_response(interview)


def answer_mock_question(
    db: Session,
    mock_interview_id: int,
    request: MockAnswerRequest,
    settings: Optional[Settings] = None,
    user: Optional[User] = None,
) -> Optional[MockInterviewResponse]:
    interview = db.get(MockInterview, mock_interview_id)
    if interview is None or not _owns_plan(interview.prep_plan, user):
        return None

    config = _config_for_interview(interview)
    answered_count = _answered_count(interview)
    session_plan = config.get("session_plan") or interview.session_plan or []
    current_slot = session_plan[answered_count] if answered_count < len(session_plan) else _fallback_slot(interview.current_topic, answered_count + 1, config)
    next_slot = session_plan[answered_count + 1] if answered_count + 1 < len(session_plan) else None
    ai_feedback = _mock_feedback_with_ai(interview, request.answer_text, config, settings, current_slot, next_slot)
    if ai_feedback:
        score, feedback, follow_up, feedback_detail = ai_feedback
    else:
        require_ai_result("AI mock interview feedback failed. Enable local fallback in settings to score the answer offline.")
        score, feedback = _score_answer(request.answer_text)
        follow_up = _follow_up(interview.current_topic, score, config)
        feedback_detail = {
            "dimensions": {"relevance": score, "depth": score, "structure": score, "communication": score},
            "strengths": [],
            "improvements": [feedback],
            "competency": current_slot.get("competency", interview.current_topic),
        }
    db.add(MockMessage(mock_interview_id=interview.id, role="candidate", content=request.answer_text))
    feedback_message = MockMessage(mock_interview_id=interview.id, role="feedback", content=feedback, score=score, detail=feedback_detail)
    db.add(feedback_message)
    record_mock_evidence(
        db,
        interview,
        feedback_message,
        str(feedback_detail.get("competency") or current_slot.get("competency") or interview.current_topic),
        score,
        feedback_detail,
        user,
    )
    next_question_number = answered_count + 2
    if next_question_number <= config["question_count"]:
        slot = next_slot or _fallback_slot(interview.current_topic, next_question_number, config)
        interview.current_topic = slot["topic"]
        question_type = slot["question_type"]
        next_question = follow_up or _question(slot["topic"], question_type, config["difficulty"])
        db.add(MockMessage(mock_interview_id=interview.id, role="interviewer", content=next_question))
    else:
        interview.status = "complete"

    scores = [message.score for message in interview.messages if message.score is not None] + [score]
    interview.average_score = round(sum(scores) / len(scores), 2)
    if interview.status == "complete":
        interview.overall_feedback = _overall_feedback(interview, feedback_detail)
    db.commit()
    db.refresh(interview)
    return _to_response(interview)


def _owns_plan(plan: PrepPlan, user: Optional[User]) -> bool:
    if user:
        return plan.job_post.user_id == user.id
    return plan.job_post.user_id is None


def _first_topic(plan: PrepPlan) -> str:
    for task in plan.tasks:
        if task.topics:
            return task.topics[0]
    return "Python"


def _mock_config(request: MockInterviewStartRequest) -> dict:
    difficulty = request.difficulty.lower()
    if difficulty not in QUESTION_COUNT_BY_DIFFICULTY:
        difficulty = "medium"
    question_count = request.question_count or QUESTION_COUNT_BY_DIFFICULTY[difficulty]
    question_types = [item for item in request.question_types if item in QUESTION_TYPES]
    focus_topics: list[str] = []
    for topic in request.focus_topics:
        clean_topic = topic.strip()
        if clean_topic and clean_topic not in focus_topics:
            focus_topics.append(clean_topic)
    return {
        "difficulty": difficulty,
        "question_count": min(12, max(1, question_count)),
        "question_types": question_types or ["technical", "multiple_choice", "coding", "behavioral"],
        "scope": request.scope,
        "day": request.day,
        "focus_topics": focus_topics,
    }


def _config_for_interview(interview: MockInterview) -> dict:
    for message in interview.messages:
        if message.role == "meta":
            try:
                config = json.loads(message.content)
                config.setdefault("difficulty", "medium")
                config.setdefault("question_count", 6)
                config.setdefault("question_types", ["technical", "multiple_choice", "coding", "behavioral"])
                config.setdefault("scope", "full_plan")
                config.setdefault("day", None)
                config.setdefault("focus_topics", [])
                config.setdefault("session_plan", interview.session_plan or [])
                config.setdefault("interview_evidence", "")
                return config
            except json.JSONDecodeError:
                break
    return {
        "difficulty": "medium",
        "question_count": 6,
        "question_types": ["technical", "multiple_choice", "coding", "behavioral"],
        "scope": "full_plan",
        "day": None,
        "focus_topics": [],
        "session_plan": interview.session_plan or [],
        "interview_evidence": "",
    }


def _answered_count(interview: MockInterview) -> int:
    return sum(1 for message in interview.messages if message.role == "candidate")


def _role_blueprint_for_plan(plan: PrepPlan) -> Optional[RoleBlueprint]:
    record = plan.job_post.role_blueprint
    if record is None:
        return None
    try:
        return RoleBlueprint.model_validate(record.blueprint)
    except Exception:
        return None


def _build_session_plan(
    plan: PrepPlan,
    request: MockInterviewStartRequest,
    config: dict,
    role_blueprint: Optional[RoleBlueprint],
    prioritized_scope_topics: Optional[list[str]] = None,
) -> list[dict]:
    topics = prioritized_scope_topics or _topics_for_mock_scope(plan, request)
    competency_by_name = {
        item.name.casefold(): item
        for item in (role_blueprint.competencies if role_blueprint else [])
    }
    session_plan: list[dict] = []
    for index in range(config["question_count"]):
        topic = topics[index % len(topics)]
        question_type = config["question_types"][index % len(config["question_types"])]
        competency = competency_by_name.get(topic.casefold())
        if question_type == "behavioral" and role_blueprint and role_blueprint.behavioral_story_prompts:
            topic = role_blueprint.behavioral_story_prompts[index % len(role_blueprint.behavioral_story_prompts)]
        session_plan.append({
            "number": index + 1,
            "topic": topic,
            "competency": competency.name if competency else topic,
            "question_type": question_type,
            "intent": _question_intent(question_type, topic),
            "rubric": _rubric_for_question_type(question_type),
        })
    return session_plan


def _topics_for_mock_scope(plan: PrepPlan, request: MockInterviewStartRequest) -> list[str]:
    explicit: list[str] = []
    for topic in [request.topic, *request.focus_topics]:
        clean = (topic or "").strip()
        if clean and clean not in explicit:
            explicit.append(clean)
    if explicit:
        return explicit
    day = request.day or 1
    topics: list[str] = []
    for task in sorted(plan.tasks, key=lambda item: (item.day, item.id)):
        if request.scope == "selected_day" and task.day != day:
            continue
        if request.scope == "through_selected_day" and task.day > day:
            continue
        for topic in task.topics or []:
            clean = topic.strip()
            if clean and clean not in topics:
                topics.append(clean)
    return topics or [_first_topic(plan)]


def _question_intent(question_type: str, topic: str) -> str:
    intents = {
        "technical": f"Test whether the candidate can apply {topic}, explain tradeoffs, and validate the result.",
        "coding": f"Test practical solution design, edge cases, correctness, and complexity involving {topic}.",
        "behavioral": "Elicit a specific past example with ownership, action, result, and reflection.",
        "team_problem_solving": "Evaluate collaboration, disagreement handling, stakeholder communication, and decisions.",
        "multiple_choice": f"Test recognition of the strongest applied decision involving {topic}.",
        "multiple_select": f"Test whether the candidate recognizes all important considerations involving {topic}.",
        "one_word": f"Check concise recall of a core concept connected to {topic}.",
    }
    return intents.get(question_type, f"Test interview readiness for {topic}.")


def _rubric_for_question_type(question_type: str) -> list[str]:
    base = ["relevance", "accuracy", "depth", "structure", "communication"]
    if question_type == "coding":
        return [*base, "edge cases", "complexity", "validation"]
    if question_type in {"behavioral", "team_problem_solving"}:
        return [*base, "specific example", "ownership", "result", "reflection"]
    return [*base, "tradeoffs", "concrete example"]


def _fallback_slot(topic: str, number: int, config: dict) -> dict:
    question_type = config["question_types"][(number - 1) % len(config["question_types"])]
    return {
        "number": number,
        "topic": topic,
        "competency": topic,
        "question_type": question_type,
        "intent": _question_intent(question_type, topic),
        "rubric": _rubric_for_question_type(question_type),
    }


def _question(topic: str, question_type: str, difficulty: str) -> str:
    if question_type == "one_word":
        return f"One-word answer ({difficulty}): What keyword best describes the main purpose of {topic}?"
    if question_type == "multiple_choice":
        return (
            f"MCQ ({difficulty}): Which answer best explains a strong interview point for {topic}?\n"
            "A. Give a concrete example, tradeoff, and result\n"
            "B. Only define the term\n"
            "C. Avoid explaining reasoning\n"
            "D. Skip edge cases"
        )
    if question_type == "multiple_select":
        return (
            f"Multiple select ({difficulty}): Which details should a strong answer about {topic} include? Select all that apply.\n"
            "A. Real example\nB. Tradeoffs\nC. Edge cases\nD. No testing or validation"
        )
    if question_type == "coding":
        return f"Coding ({difficulty}): Write or describe a small solution using {topic}. Include edge cases and complexity."
    if question_type == "behavioral":
        return f"Behavioral ({difficulty}): Tell me about a time you used {topic} under pressure. What did you do and what changed?"
    if question_type == "team_problem_solving":
        return f"Team problem solving ({difficulty}): Describe a time your team disagreed about {topic}. How did you align people and move forward?"
    return f"Technical ({difficulty}): Explain a project where you used {topic}, including tradeoffs and results."


def _question_with_ai(
    plan: PrepPlan,
    topic: str,
    question_type: str,
    config: dict,
    settings: Optional[Settings],
    slot: Optional[dict] = None,
    role_blueprint: Optional[RoleBlueprint] = None,
) -> Optional[str]:
    if not settings or not settings.ai_enabled:
        require_ai_result("No AI provider is configured for mock interview questions. Enable local fallback in settings to use offline questions.")
        return None

    prompt = _question_prompt(plan, topic, question_type, config, slot, role_blueprint)
    if settings.openai_enabled:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.parse(
                model=settings.generation_model,
                input=[
                    {
                        "role": "system",
                        "content": "You create realistic interview questions as structured JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                text_format=MockQuestionOutput,
            )
            return response.output_parsed.question
        except Exception as exc:
            logger.warning("OpenAI mock interview question failed: %s", exc)

    if settings.gemini_enabled:
        try:
            data = generate_gemini_json(settings, prompt, _gemini_question_schema())
            return data["question"]
        except Exception as exc:
            logger.warning("Gemini mock interview question failed: %s", exc)
    require_ai_result("AI mock interview question generation failed. Enable local fallback in settings to use offline questions.")
    return None


def _question_prompt(
    plan: PrepPlan,
    topic: str,
    question_type: str,
    config: dict,
    slot: Optional[dict] = None,
    role_blueprint: Optional[RoleBlueprint] = None,
) -> str:
    scope_labels = {
        "selected_day": "the selected preparation day only",
        "through_selected_day": "all material covered through the selected preparation day",
        "full_plan": "the complete preparation plan",
    }
    focus_topics = ", ".join(config.get("focus_topics") or [])
    return (
        "Create one realistic mock interview question as JSON only. "
        "Return exactly one question. Match the requested question type and difficulty. "
        "For multiple_choice include A-D options in the question text. "
        "For multiple_select include A-D options and say select all that apply. "
        "For one_word require a one-word answer. "
        "For coding ask for code or pseudocode plus complexity.\n\n"
        "For team_problem_solving ask about collaboration, disagreement, tradeoffs, ownership, and communication.\n\n"
        f"Role: {plan.job_post.title}\n"
        f"Shared role intelligence:\n{blueprint_context(role_blueprint, include_sources=False)}\n"
        f"Relevant interview evidence:\n{config.get('interview_evidence') or 'No relevant user-reported interview evidence is available.'}\n"
        f"Job-posting source excerpt: {plan.job_post.description[:2500]}\n"
        f"Prep plan summary: {plan.summary}\n"
        f"Practice scope: {scope_labels.get(config.get('scope'), 'the complete preparation plan')}\n"
        f"Selected focus topics: {focus_topics or 'Use the relevant plan topics.'}\n"
        f"Topic: {topic}\n"
        f"Question intent: {(slot or {}).get('intent', 'Test applied interview readiness.')}\n"
        f"Scoring rubric: {', '.join((slot or {}).get('rubric', [])) or 'relevance, correctness, depth, structure, communication'}\n"
        f"Difficulty: {config['difficulty']}\n"
        f"Question type: {question_type}"
    )


def _follow_up(topic: str, score: float, config: dict) -> str:
    if score >= 0.75:
        return f"Good. Next {config['difficulty']} question: what edge cases or failure modes would you watch for in {topic}?"
    return f"Let's strengthen that with a {config['difficulty']} follow-up. Give a concrete example and explain why {topic} mattered."


def _score_answer(answer_text: str) -> tuple[float, str]:
    answer = answer_text.lower()
    signals = ["example", "tradeoff", "test", "edge", "because", "result", "complexity"]
    hits = sum(1 for signal in signals if signal in answer)
    score = round(min(1.0, hits / 4), 2)
    if score >= 0.75:
        return score, "Strong answer. You gave enough detail to sound prepared and practical."
    return score, "Add a specific example, tradeoffs, edge cases, and what result you achieved."


def _mock_feedback_with_ai(
    interview: MockInterview,
    answer_text: str,
    config: dict,
    settings: Optional[Settings],
    current_slot: Optional[dict] = None,
    next_slot: Optional[dict] = None,
) -> Optional[tuple[float, str, str, dict]]:
    if not settings or not settings.ai_enabled:
        require_ai_result("No AI provider is configured for mock interview feedback. Enable local fallback in settings to score answers offline.")
        return None

    previous_question = ""
    for message in sorted(interview.messages, key=lambda item: item.id, reverse=True):
        if message.role == "interviewer":
            previous_question = message.content
            break

    prompt = (
        "Evaluate this mock interview answer as JSON only. "
        "Return a score from 0 to 1, actionable feedback, strengths, improvements, dimension scores, and one next interviewer question. "
        "Dimension keys must include relevance, accuracy, depth, structure, and communication, each from 0 to 1. "
        "The next question must follow the supplied next-question slot instead of staying on the same topic.\n\n"
        f"Shared role intelligence:\n{blueprint_context(_role_blueprint_for_plan(interview.prep_plan), include_sources=False)}\n\n"
        f"Relevant interview evidence:\n{config.get('interview_evidence') or 'No relevant user-reported interview evidence is available.'}\n\n"
        f"Topic: {interview.current_topic}\n"
        f"Practice scope: {config.get('scope', 'full_plan')}\n"
        f"Selected focus topics: {', '.join(config.get('focus_topics') or []) or 'Use the active interview topic.'}\n"
        f"Difficulty: {config['difficulty']}\n"
        f"Question types available: {', '.join(config['question_types'])}\n"
        f"Question: {previous_question}\n"
        f"Current question intent: {(current_slot or {}).get('intent', '')}\n"
        f"Current scoring rubric: {', '.join((current_slot or {}).get('rubric', []))}\n"
        f"Candidate answer: {answer_text}\n\n"
        f"Next-question slot: {json.dumps(next_slot or {}, ensure_ascii=False)}"
    )
    if settings.openai_enabled:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.parse(
                model=settings.scoring_model,
                input=[
                    {
                        "role": "system",
                        "content": "You evaluate mock interview answers as structured JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                text_format=MockFeedbackOutput,
            )
            data = response.output_parsed
            detail = {
                "dimensions": _normalized_dimensions(data.dimensions, float(data.score)),
                "strengths": data.strengths[:4],
                "improvements": data.improvements[:4],
                "competency": (current_slot or {}).get("competency", interview.current_topic),
            }
            return round(float(data.score), 2), data.feedback, data.follow_up_question, detail
        except Exception as exc:
            logger.warning("OpenAI mock interview feedback failed: %s", exc)

    if settings.gemini_enabled:
        try:
            data = generate_gemini_json(settings, prompt, _gemini_feedback_schema())
            score = round(float(data["score"]), 2)
            detail = {
                "dimensions": _normalized_dimensions(data.get("dimensions") or {}, score),
                "strengths": data.get("strengths") or [],
                "improvements": data.get("improvements") or [],
                "competency": (current_slot or {}).get("competency", interview.current_topic),
            }
            return score, data["feedback"], data["follow_up_question"], detail
        except Exception as exc:
            logger.warning("Gemini mock interview feedback failed: %s", exc)
    require_ai_result("AI mock interview feedback failed. Enable local fallback in settings to score answers offline.")
    return None


def _gemini_question_schema() -> dict:
    return {
        "type": "object",
        "properties": {"question": {"type": "string"}},
        "required": ["question"],
    }


def _gemini_feedback_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "score": {"type": "number"},
            "feedback": {"type": "string"},
            "strengths": {"type": "array", "items": {"type": "string"}},
            "improvements": {"type": "array", "items": {"type": "string"}},
            "dimensions": {
                "type": "object",
                "properties": {
                    "relevance": {"type": "number"},
                    "accuracy": {"type": "number"},
                    "depth": {"type": "number"},
                    "structure": {"type": "number"},
                    "communication": {"type": "number"},
                },
                "required": ["relevance", "accuracy", "depth", "structure", "communication"],
            },
            "follow_up_question": {"type": "string"},
        },
        "required": ["score", "feedback", "follow_up_question"],
    }


def _to_response(interview: MockInterview) -> MockInterviewResponse:
    config = _config_for_interview(interview)
    return MockInterviewResponse(
        id=interview.id,
        prep_plan_id=interview.prep_plan_id,
        current_topic=interview.current_topic,
        status=interview.status,
        difficulty=config["difficulty"],
        question_count=config["question_count"],
        scope=config["scope"],
        focus_topics=config["focus_topics"],
        answered_questions=_answered_count(interview),
        average_score=interview.average_score,
        session_plan=interview.session_plan or config.get("session_plan") or [],
        overall_feedback=interview.overall_feedback or {},
        quality_report=interview.quality_report or {},
        created_at=interview.created_at,
        messages=[
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "score": message.score,
                "detail": message.detail or {},
            }
            for message in sorted(interview.messages, key=lambda message: message.id)
            if message.role != "meta"
        ],
    )


def _normalized_dimensions(dimensions: dict, fallback_score: float) -> dict[str, float]:
    keys = ["relevance", "accuracy", "depth", "structure", "communication"]
    normalized: dict[str, float] = {}
    for key in keys:
        try:
            normalized[key] = round(max(0.0, min(1.0, float(dimensions.get(key, fallback_score)))), 2)
        except (TypeError, ValueError):
            normalized[key] = round(fallback_score, 2)
    return normalized


def _overall_feedback(interview: MockInterview, pending_detail: Optional[dict] = None) -> dict:
    details = [message.detail for message in interview.messages if message.role == "feedback" and message.detail]
    if pending_detail:
        details.append(pending_detail)
    dimension_values: dict[str, list[float]] = {}
    strengths: list[str] = []
    improvements: list[str] = []
    for detail in details:
        for name, value in (detail.get("dimensions") or {}).items():
            dimension_values.setdefault(name, []).append(float(value))
        strengths.extend(detail.get("strengths") or [])
        improvements.extend(detail.get("improvements") or [])
    dimensions = {
        name: round(sum(values) / len(values), 2)
        for name, values in dimension_values.items()
        if values
    }
    weakest = sorted(dimensions, key=dimensions.get)[:2]
    strongest = sorted(dimensions, key=dimensions.get, reverse=True)[:2]
    return {
        "dimensions": dimensions,
        "strongest_dimensions": strongest,
        "focus_dimensions": weakest,
        "strengths": list(dict.fromkeys(strengths))[:4],
        "improvements": list(dict.fromkeys(improvements))[:4],
    }
