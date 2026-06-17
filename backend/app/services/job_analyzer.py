import json
import re
from typing import Any

from app.config import Settings
from app.ai_policy import require_ai_result
from app.schemas.job_analysis import (
    InterviewFocus,
    JobAnalysisRequest,
    JobAnalysisResponse,
    JobDescriptionAskResponse,
    JobDescriptionBrief,
)
from app.services.planner import SKILL_KEYWORDS


SYSTEM_PROMPT = """You analyze job descriptions for interview preparation.
Return only JSON matching this shape:
{
  "role_title": "string",
  "seniority": "intern | new grad | junior | mid-level | senior | unknown",
  "required_skills": ["skill"],
  "interview_focus": [{"category": "string", "topics": ["topic"]}],
  "coding_difficulty": "easy | medium | hard | unknown",
  "behavioral_themes": ["theme"]
}
"""

AUTO_TITLE_VALUES = {"auto-detect role", "auto detect role", "saved job url", "captured job", "job description"}
AUTO_COMPANY_VALUES = {"auto-detect company", "auto detect company", "detected company"}


def analyze_job_description(request: JobAnalysisRequest, settings: Settings) -> JobAnalysisResponse:
    """Analyze a job description with OpenAI when available, otherwise locally."""

    if settings.openai_enabled:
        try:
            return _analyze_with_openai(request, settings)
        except Exception:
            # The app should still work during local development if the API key,
            # network, or model response fails.
            require_ai_result("OpenAI could not analyze this job. Enable local fallback in settings to use the offline analyzer.")
            return _heuristic_analysis(request, source="heuristic_fallback")

    require_ai_result("OpenAI is not configured for job analysis. Enable local fallback in settings to use the offline analyzer.")
    return _heuristic_analysis(request, source="heuristic")


def identify_job(
    provided_title: str,
    provided_company: str | None,
    description: str,
    source_url: str | None,
    settings: Settings,
) -> tuple[str, str]:
    """Detect the role and company from raw pasted job text, using AI first when available."""

    user_title = _provided_title(provided_title)
    user_company = _provided_company(provided_company)

    if settings.openai_enabled and description and not description.startswith("Saved URL bookmark."):
        try:
            ai_title, ai_company = _identity_with_openai(description, source_url, settings)
            title = user_title or ai_title or infer_role_title("Auto-detect role", description, source_url)
            company = user_company or ai_company or infer_company_name("Auto-detect company", description, source_url)
            return _clean_role_title(title), _clean_company_candidate(company)
        except Exception:
            require_ai_result("OpenAI could not detect the job title/company. Enable local fallback in settings to use local detection.")
            pass

    require_ai_result("OpenAI is not configured for job title/company detection. Enable local fallback in settings to use local detection.")
    title = user_title or infer_role_title("Auto-detect role", description, source_url)
    company = user_company or infer_company_name("Auto-detect company", description, source_url)
    return _clean_role_title(title), _clean_company_candidate(company)


def infer_role_title(provided_title: str, description: str, source_url: str | None = None) -> str:
    """Use the user title when present, otherwise infer a readable role title."""

    clean_title = (provided_title or "").strip()
    if clean_title and clean_title.lower() not in {"auto-detect role", "auto detect role"}:
        return clean_title

    header_title = _role_title_from_job_board_header(description or "")
    if header_title:
        return header_title

    role_patterns = [
        r"(?i)\b(?:job title|role|position)\s*[:\-]\s*([A-Z][A-Za-z0-9 /,&+\-]{3,80}?)(?:[.\n\r]|$)",
        r"(?i)\b([A-Z][A-Za-z0-9 /,&+\-]{2,60}\b(?:Intern|Engineer|Developer|Analyst|Writer|Designer|Manager|Specialist|Coordinator|Assistant))\b",
    ]
    for pattern in role_patterns:
        match = re.search(pattern, description or "")
        if match:
            return _clean_role_title(match.group(1))

    if source_url:
        slug = re.sub(r"^https?://", "", source_url).split("?")[0].rstrip("/").split("/")[-1]
        words = [word for word in re.split(r"[-_]+", slug) if word and not word.isdigit()]
        if words:
            return " ".join(word.capitalize() for word in words[:6])

    text = (description or "").lower()
    if any(word in text for word in ["writing", "grammar", "storytelling", "copy"]):
        return "Writing Intern"
    if any(word in text for word in ["backend", "api", "python", "software", "developer"]):
        return "Software Engineering Intern"
    if any(word in text for word in ["sales", "client", "campaign"]):
        return "Sales Intern"
    return "Interview Role"


def infer_company_name(provided_company: str | None, description: str, source_url: str | None = None) -> str:
    clean_company = (provided_company or "").strip()
    if clean_company and clean_company.lower() not in {"auto-detect company", "auto detect company"}:
        return clean_company

    header_company = _company_from_job_board_header(description or "")
    if header_company:
        return header_company

    patterns = [
        r"(?i)\b(?:company|employer|organization)\s*[:\-]\s*([A-Z][A-Za-z0-9&.' -]{1,60})(?:[\n\r.]|$)",
        r"(?i)\b(?:about|join|at)\s+([A-Z][A-Za-z0-9&.' -]{1,45})(?:\s+is|\s+we|\s+as|,|\.|$)",
        r"(?i)\b([A-Z][A-Za-z0-9&.' -]{1,45})\s+is\s+(?:looking|hiring|seeking)",
    ]
    for pattern in patterns:
        match = re.search(pattern, description or "")
        candidate = _clean_company_candidate(match.group(1) if match else "")
        if candidate:
            return candidate

    if source_url:
        host = re.sub(r"^https?://", "", source_url).split("/")[0].lower()
        parts = [part for part in host.split(".") if part]
        ignored = {"www", "careers", "jobs", "boards", "apply", "greenhouse", "lever", "workdayjobs", "myworkdayjobs", "joinhandshake", "handshake"}
        for part in parts:
            if part not in ignored and "myworkdayjobs" not in part and len(part) > 2:
                return part.replace("-", " ").title()

    return ""


def _provided_title(value: str | None) -> str:
    clean_title = (value or "").strip()
    if clean_title and clean_title.lower() not in AUTO_TITLE_VALUES:
        return clean_title
    return ""


def _provided_company(value: str | None) -> str:
    clean_company = (value or "").strip()
    if clean_company and clean_company.lower() not in AUTO_COMPANY_VALUES:
        return clean_company
    return ""


def _identity_with_openai(description: str, source_url: str | None, settings: Settings) -> tuple[str, str]:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    completion = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract the employer/company name and exact job title from a pasted job posting. "
                    "Return only JSON with keys role_title and company. Use the job posting text as the source of truth. "
                    "Ignore browser page titles, navigation text, buttons, usernames, and unrelated surrounding page content. "
                    "If the text has a job-board header like 'Company logo', then a company line, then an industry line, "
                    "then a role line, use those lines. Do not invent a company if it is not present; return an empty string. "
                    "Return a concise title such as 'Software Developer' or 'Landscape Designer / Estimator', not a sentence."
                ),
            },
            {
                "role": "user",
                "content": f"Source URL: {source_url or ''}\n\nPasted job posting:\n{description[:12000]}",
            },
        ],
        temperature=0,
    )
    data = json.loads(completion.choices[0].message.content or "{}")
    raw_role_title = str(data.get("role_title") or "").strip()
    role_title = _clean_role_title(raw_role_title) if raw_role_title else ""
    company = _clean_company_candidate(str(data.get("company") or ""))
    return role_title, company


def build_job_description_brief(title: str, description: str, source_url: str | None, settings: Settings) -> JobDescriptionBrief:
    if settings.openai_enabled:
        try:
            return _brief_with_openai(title, description, source_url, settings)
        except Exception:
            require_ai_result("OpenAI could not build the job description brief. Enable local fallback in settings to use an offline brief.")
            return _heuristic_brief(title, description, source_url, source="heuristic_fallback")
    require_ai_result("OpenAI is not configured for job description briefs. Enable local fallback in settings to use an offline brief.")
    return _heuristic_brief(title, description, source_url, source="heuristic")


def answer_job_description_question(title: str, description: str, question: str, settings: Settings) -> JobDescriptionAskResponse:
    if settings.openai_enabled:
        try:
            return _description_answer_with_openai(title, description, question, settings)
        except Exception:
            require_ai_result("OpenAI could not answer this job-description question. Enable local fallback in settings to use an offline answer.")
            pass
    require_ai_result("OpenAI is not configured for job-description questions. Enable local fallback in settings to use an offline answer.")
    return JobDescriptionAskResponse(
        answer=(
            f"For {title}, focus on the exact responsibilities in the description. "
            f"A strong answer to your question should mention the role context, one practical example, "
            f"and how you would prove you can handle that responsibility."
        ),
        interview_use="Turn it into a short STAR-style story: situation, action, result, then connect it back to the job requirements.",
        next_steps=["Highlight the requirement you are unsure about.", "Prepare one project or class example for it.", "Ask a follow-up question about how the team uses it."],
        source="heuristic",
    )


def _role_title_from_job_board_header(description: str) -> str:
    """Detect titles from pasted job-board blocks: company, industry, then role."""

    lines = [line.strip() for line in description.splitlines() if line.strip()]
    stop_words = {
        "save",
        "share",
        "apply",
        "at a glance",
        "job",
        "job description",
        "full-time",
        "part-time",
    }
    industry_markers = (
        "architecture",
        "planning",
        "software",
        "technology",
        "health",
        "finance",
        "education",
        "marketing",
        "design",
    )
    role_markers = (
        "intern",
        "engineer",
        "developer",
        "analyst",
        "writer",
        "designer",
        "estimator",
        "manager",
        "specialist",
        "coordinator",
        "assistant",
        "architect",
    )

    for index, line in enumerate(lines[:12]):
        lower = line.lower()
        if lower in stop_words or "logo" in lower or "posted " in lower or "apply by" in lower:
            continue
        if any(marker in lower for marker in industry_markers) and index + 1 < len(lines):
            candidate = lines[index + 1]
            candidate_lower = candidate.lower()
            if any(marker in candidate_lower for marker in role_markers):
                return _clean_role_title(candidate)

    for line in lines[:18]:
        lower = line.lower()
        if lower in stop_words or "logo" in lower or "posted " in lower or "apply by" in lower:
            continue
        if any(marker in lower for marker in role_markers):
            return _clean_role_title(line)

    return ""


def _company_from_job_board_header(description: str) -> str:
    lines = [line.strip() for line in description.splitlines() if line.strip()]
    skipped = {
        "save",
        "share",
        "apply",
        "at a glance",
        "job",
        "job description",
        "full-time",
        "part-time",
    }
    industry_markers = (
        "architecture",
        "planning",
        "software",
        "technology",
        "health",
        "finance",
        "education",
        "marketing",
        "design",
        "landscape",
        "consulting",
        "retail",
    )
    role_markers = (
        "intern",
        "engineer",
        "developer",
        "analyst",
        "writer",
        "designer",
        "estimator",
        "manager",
        "specialist",
        "coordinator",
        "assistant",
        "architect",
    )
    for index, line in enumerate(lines[:8]):
        if line.lower().endswith(" logo") and index + 1 < len(lines):
            candidate = _clean_company_candidate(lines[index + 1])
            if candidate:
                return candidate

    clean_lines = [
        line for line in lines[:18]
        if line.lower() not in skipped
        and "logo" not in line.lower()
        and not line.lower().startswith("posted ")
        and "apply by" not in line.lower()
    ]
    for index, line in enumerate(clean_lines[:10]):
        lower = line.lower()
        next_lower = clean_lines[index + 1].lower() if index + 1 < len(clean_lines) else ""
        second_next_lower = clean_lines[index + 2].lower() if index + 2 < len(clean_lines) else ""
        if any(marker in next_lower for marker in industry_markers) and any(marker in second_next_lower for marker in role_markers):
            return _clean_company_candidate(line)
        if any(marker in next_lower for marker in role_markers) and not any(marker in lower for marker in role_markers):
            return _clean_company_candidate(line)
    return ""


def _clean_company_candidate(value: str) -> str:
    if not value:
        return ""
    cleaned = re.split(r"[\n\r|•]", value.strip())[0]
    cleaned = re.sub(r"(?i)\s+logo$", "", cleaned)
    cleaned = re.sub(r"(?i)\b(inc|llc|ltd|corp|corporation)\b\.?$", "", cleaned)
    cleaned = re.sub(r"(?i)\b(is|are|we|our|a|an|the|looking|hiring|seeking).*", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .:-")
    blocked = {"job", "job description", "at a glance", "apply", "save", "share", "full-time", "part-time"}
    if not cleaned or cleaned.lower() in blocked or len(cleaned) < 2 or len(cleaned) > 70:
        return ""
    return cleaned


def _json_list(value: Any, limit: int = 8) -> list[str]:
    """Normalize AI list fields without accidentally turning a string into letters."""

    if isinstance(value, list):
        raw_items = value
    elif isinstance(value, str):
        raw_items = re.split(r"(?:\n+|•|;|\s+-\s+)", value)
    else:
        raw_items = []

    cleaned: list[str] = []
    seen: set[str] = set()
    for item in raw_items:
        text = re.sub(r"\s+", " ", str(item or "")).strip(" .:-•")
        if len(text) < 6 or not re.search(r"[A-Za-z]{3}", text):
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
        if len(cleaned) >= limit:
            break
    return cleaned


def _fallback_profile(lower: str, requirements: list[str], responsibilities: list[str]) -> list[str]:
    themes: list[str] = []
    if any(term in lower for term in ["software", "developer", ".net", "sql", "angular", "api", "c#"]):
        themes.append("A candidate who can connect technical tools to reliable, maintainable software outcomes.")
    if any(term in lower for term in ["client", "customer", "communication", "collaborate", "stakeholder"]):
        themes.append("Someone who communicates clearly with teammates or stakeholders and can explain tradeoffs.")
    if any(term in lower for term in ["high-volume", "scalable", "mission-critical", "robust", "performance"]):
        themes.append("Evidence of practical judgment around scalability, reliability, testing, and production quality.")
    if requirements:
        themes.append(f"Hands-on familiarity with core requirements such as {', '.join(requirements[:3])}.")
    if responsibilities:
        themes.append(f"Confidence owning work similar to: {responsibilities[0]}.")
    return themes[:6] or [
        "A candidate who can prove they understand the role through concrete project or work examples.",
        "Someone who can learn quickly, communicate clearly, and connect past experience to the posted responsibilities.",
        "Interview answers that show practical decision-making, not just memorized definitions.",
    ]


def _brief_with_openai(title: str, description: str, source_url: str | None, settings: Settings) -> JobDescriptionBrief:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    completion = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You turn job descriptions into structured interview-prep briefs. "
                    "Return only JSON with keys: company, role_title, overview, requirements, responsibilities, "
                    "looking_for, interview_signals, must_prepare, resume_keywords, candidate_positioning, "
                    "possible_interview_questions, red_flags_to_avoid, company_context, prep_advice. "
                    "Think like a senior interview coach: identify what the candidate must understand, "
                    "what the employer is truly testing, how to position their background, likely screening "
                    "and interview questions, and what mistakes would weaken the interview. Use concise but specific bullets. "
                    "Detect company from job-board headers if present. Every list field must be an array of "
                    "complete phrases or sentences. Never return one long string for a list field, and never "
                    "return single-letter bullets."
                ),
            },
            {
                "role": "user",
                "content": f"Role title hint: {title}\nSource URL: {source_url or ''}\n\nJob description:\n{description[:9000]}",
            },
        ],
        temperature=0.2,
    )
    data = json.loads(completion.choices[0].message.content or "{}")
    fallback = _heuristic_brief(title, description, source_url, source="heuristic_fallback")
    requirements = _json_list(data.get("requirements"), 8) or fallback.requirements
    responsibilities = _json_list(data.get("responsibilities"), 8) or fallback.responsibilities
    lower = description.lower()
    looking_for = _json_list(data.get("looking_for"), 6) or _fallback_profile(lower, requirements, responsibilities)
    interview_signals = _json_list(data.get("interview_signals"), 6) or fallback.interview_signals
    must_prepare = _json_list(data.get("must_prepare"), 10) or fallback.must_prepare
    resume_keywords = _json_list(data.get("resume_keywords"), 12) or fallback.resume_keywords
    candidate_positioning = _json_list(data.get("candidate_positioning"), 8) or fallback.candidate_positioning
    possible_interview_questions = _json_list(data.get("possible_interview_questions"), 10) or fallback.possible_interview_questions
    red_flags_to_avoid = _json_list(data.get("red_flags_to_avoid"), 8) or fallback.red_flags_to_avoid
    company_context = _json_list(data.get("company_context"), 8) or fallback.company_context
    prep_advice = _json_list(data.get("prep_advice"), 6) or fallback.prep_advice

    return JobDescriptionBrief(
        company=data.get("company") or infer_company_name("", description, source_url),
        role_title=data.get("role_title") or title,
        overview=data.get("overview") or f"Preparation brief for {title}.",
        requirements=requirements,
        responsibilities=responsibilities,
        looking_for=looking_for,
        interview_signals=interview_signals,
        must_prepare=must_prepare,
        resume_keywords=resume_keywords,
        candidate_positioning=candidate_positioning,
        possible_interview_questions=possible_interview_questions,
        red_flags_to_avoid=red_flags_to_avoid,
        company_context=company_context,
        prep_advice=prep_advice,
        source="openai",
    )


def _description_answer_with_openai(title: str, description: str, question: str, settings: Settings) -> JobDescriptionAskResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    completion = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Answer questions about a job description for an interview candidate. "
                    "Return only JSON with keys: answer, interview_use, next_steps. "
                    "Use only the job description and the user's question. Be specific to the role, "
                    "explain what the candidate should say or prepare, give practical examples when useful, "
                    "and explain exactly how to turn the answer into an interview response. If the description "
                    "does not contain enough evidence, say what to verify instead of inventing facts. "
                    "Do not be overly brief: answer in 2-4 detailed paragraphs when the user asks to explain, "
                    "compare, prepare, or understand something, and include role-specific examples. Keep "
                    "interview_use as a practical script or framework the candidate can reuse."
                ),
            },
            {
                "role": "user",
                "content": f"Role: {title}\nQuestion: {question}\n\nJob description:\n{description[:9000]}",
            },
        ],
        temperature=0.25,
    )
    data = json.loads(completion.choices[0].message.content or "{}")
    return JobDescriptionAskResponse(
        answer=data.get("answer") or "Focus on the role requirements and prepare a concrete example.",
        interview_use=data.get("interview_use") or "Use this as a concise interview talking point connected to the job description.",
        next_steps=_json_list(data.get("next_steps"), 5),
        source="openai",
    )


def _heuristic_brief(title: str, description: str, source_url: str | None, source: str) -> JobDescriptionBrief:
    lines = [line.strip(" •-") for line in description.splitlines() if line.strip()]
    company = infer_company_name("", description, source_url)
    role = infer_role_title(title, description, source_url)
    lower = description.lower()
    requirements = _lines_after_headings(lines, ["software experience required", "requirements", "required", "qualifications", "ideal candidate"], 8)
    responsibilities = _lines_after_headings(lines, ["what you'll do", "responsibilities", "what you will do", "duties"], 8)
    looking_for = _lines_after_headings(lines, ["ideal candidate", "who you are", "we're looking for", "looking for"], 6)
    if not requirements:
        requirements = _keyword_summary(lower)
    if not responsibilities:
        responsibilities = [line for line in lines if re.search(r"(?i)^(assist|create|develop|prepare|coordinate|support|collaborate|produce|manage)\b", line)][:6]
    if not looking_for:
        looking_for = _fallback_profile(lower, requirements, responsibilities)
    signals = [
        "Prepare concrete examples that prove you can do the listed responsibilities.",
        "Expect questions about tools, workflow, communication, prioritization, and project ownership.",
        "Connect every answer back to the company context and the role outcomes.",
    ]
    keywords = _keyword_summary(lower)
    possible_questions = [
        f"Why are you interested in the {role} role?",
        f"Which past project or experience best proves you can handle {requirements[0] if requirements else 'the core responsibilities'}?",
        "Tell me about a time you learned a new tool quickly and used it on real work.",
        "How would you prioritize when design, technical, and communication tasks compete for time?",
        "What would you do in your first month to become useful to this team?",
    ]
    return JobDescriptionBrief(
        company=company,
        role_title=role,
        overview=f"{company + ' is hiring ' if company else 'This posting is for '}{role}. The role emphasizes {', '.join(_keyword_summary(lower)[:4]) or 'role-specific skills'} and interview preparation should connect examples to the posted responsibilities.",
        requirements=requirements[:8],
        responsibilities=responsibilities[:8],
        looking_for=looking_for[:6],
        interview_signals=signals,
        must_prepare=[
            *(requirements[:4] or keywords[:4]),
            "A concise story that connects your experience to the most repeated responsibility in the posting.",
            "One thoughtful question about how success is measured in this role.",
        ][:8],
        resume_keywords=[f"Mirror {keyword} only where you can support it with a real example." for keyword in keywords[:8]],
        candidate_positioning=_fallback_profile(lower, requirements, responsibilities),
        possible_interview_questions=possible_questions,
        red_flags_to_avoid=[
            "Do not answer with generic enthusiasm without naming the actual responsibilities in the job post.",
            "Do not claim tool expertise unless you can describe a project, class, or task where you used it.",
            "Do not ignore communication and ownership signals if the role involves cross-functional work.",
        ],
        company_context=[
            f"Verify {company}'s product, customers, and recent work before the interview." if company else "Verify company context from the source page or company website.",
            "Prepare a question about mentorship, team workflow, and what strong performance looks like.",
        ],
        prep_advice=[
            "Create one story for each major responsibility.",
            "Review the listed tools and be ready to explain when and why you used them.",
            "Prepare two thoughtful questions about team workflow, mentorship, and success metrics.",
        ],
        source=source,
    )


def _lines_after_headings(lines: list[str], headings: list[str], limit: int) -> list[str]:
    results: list[str] = []
    for index, line in enumerate(lines):
        if line.lower().strip(":") in headings:
            for candidate in lines[index + 1:index + 1 + limit]:
                if len(candidate) > 2 and not candidate.endswith(":"):
                    results.append(candidate)
            break
    return results


def _keyword_summary(text: str) -> list[str]:
    topics = []
    for label, keywords in {
        "technical tools": ["python", "rhino", "twinmotion", "sql", "docker", "api", "adobe", "illustrator"],
        "communication": ["communication", "client", "presentation", "feedback", "spanish"],
        "project ownership": ["project management", "scheduling", "coordinate", "ownership"],
        "design judgment": ["design", "creative", "visual", "rendering", "architecture"],
        "problem solving": ["problem-solving", "estimate", "proposal", "change-order"],
    }.items():
        if any(keyword in text for keyword in keywords):
            topics.append(label)
    return topics or ["communication", "problem solving", "role fundamentals"]


def _analyze_with_openai(request: JobAnalysisRequest, settings: Settings) -> JobAnalysisResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    completion = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Job title: {request.job_title}\n\nJob description:\n{request.job_description}",
            },
        ],
        temperature=0.2,
    )
    content = completion.choices[0].message.content or "{}"
    data: dict[str, Any] = json.loads(content)
    return JobAnalysisResponse(source="openai", **data)


def _heuristic_analysis(request: JobAnalysisRequest, source: str) -> JobAnalysisResponse:
    # This fallback keeps development free and predictable before we connect a real API key.
    text = request.job_description.lower()
    skills = _detect_skills(text)
    role_title = infer_role_title(request.job_title, request.job_description, request.source_url)
    role_text = f"{role_title} {request.job_description}".lower()

    return JobAnalysisResponse(
        role_title=role_title,
        company=infer_company_name(getattr(request, "company", ""), request.job_description, request.source_url),
        seniority=_detect_seniority(role_text),
        required_skills=skills,
        interview_focus=_build_focus(skills),
        coding_difficulty=_detect_difficulty(role_text),
        behavioral_themes=_detect_behavioral_themes(text),
        source=source,
    )


def _clean_role_title(value: str) -> str:
    title = re.split(r"[\n\r|•]", value.strip())[0]
    title = re.sub(r"(?i)^(?:job title|role|position)\s*[:\-]\s*", "", title)
    title = re.split(r"(?<=[a-zA-Z])\.\s+", title)[0]
    title = re.sub(r"\s+", " ", title).strip(" .:-")
    return title[:80] or "Interview Role"


def _detect_skills(text: str) -> list[str]:
    # Simple keyword matching for now. Later, the OpenAI result will become the main path.
    found: list[str] = []
    for skill, keywords in SKILL_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            found.append(skill)
    return found or ["Python", "Problem Solving", "Communication"]


def _detect_seniority(text: str) -> str:
    if re.search(r"\b(intern|internship)\b", text):
        return "intern"
    if "new grad" in text or "entry level" in text:
        return "new grad"
    if re.search(r"\b(junior|0-2 years|1-2 years)\b", text):
        return "junior"
    if re.search(r"\b(senior|staff|lead|5\\+ years)\b", text):
        return "senior"
    if re.search(r"\b(3\\+ years|4\\+ years|mid-level)\b", text):
        return "mid-level"
    return "unknown"


def _detect_difficulty(text: str) -> str:
    if any(term in text for term in ["senior", "distributed", "scalable", "system design"]):
        return "hard"
    if any(term in text for term in ["sql", "api", "docker", "backend", "data structures"]):
        return "medium"
    return "easy"


def _build_focus(skills: list[str]) -> list[InterviewFocus]:
    technical = [skill for skill in skills if skill not in {"Communication"}]
    focus = [
        InterviewFocus(category="technical", topics=technical[:5] or ["Python fundamentals"]),
        InterviewFocus(category="coding", topics=["data structures", "debugging", "edge cases"]),
        InterviewFocus(category="behavioral", topics=["teamwork", "project ownership", "learning from mistakes"]),
    ]
    if "System Design" in skills:
        focus.append(InterviewFocus(category="system design", topics=["API design", "scalability", "tradeoffs"]))
    return focus


def _detect_behavioral_themes(text: str) -> list[str]:
    themes = ["teamwork", "communication"]
    if "lead" in text or "ownership" in text:
        themes.append("ownership")
    if "customer" in text or "user" in text:
        themes.append("user focus")
    if "fast-paced" in text or "startup" in text:
        themes.append("adaptability")
    return themes
