import json
import logging
import re
from typing import Any

from app.config import Settings
from app.ai_policy import require_ai_result
from app.schemas.job_analysis import (
    InterviewFocus,
    JobAnalysisRequest,
    JobAnalysisResponse,
    JobCoreSkill,
    JobAnalysisPriority,
    JobAnalysisRequirements,
    JobDescriptionAskResponse,
    JobDescriptionBrief,
    JobInterviewTopic,
)
from app.services.gemini_service import generate_gemini_json
from app.services.planner import SKILL_KEYWORDS
from app.schemas.role_intelligence import RoleBlueprint
from app.services.role_intelligence_service import blueprint_context


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
logger = logging.getLogger(__name__)


# This is the deliberately small, user-facing skills vocabulary.  It keeps the
# workspace focused on tools a candidate can study instead of showing vague
# requirement sentences such as "ability to work independently".
CORE_SKILL_CATALOG: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("Python", "software", ("python", "fastapi", "django", "flask", "pandas", "numpy")),
    ("SQL", "data", ("sql", "postgresql", "postgres", "mysql", "snowflake", "bigquery", "redshift")),
    ("Power BI", "data", ("power bi", "powerbi", "power query", "dax")),
    ("Tableau", "data", ("tableau",)),
    ("Excel", "data", ("excel", "pivot table", "vlookup", "xlookup")),
    ("R", "data", ("r language", "r programming", "r studio", "rstudio")),
    ("Data modeling", "data", ("data modeling", "data modelling", "star schema", "dimensional modeling")),
    ("ETL / ELT", "data", ("etl", "elt", "data pipeline", "data integration")),
    ("Spark", "data", ("apache spark", "pyspark", "spark")),
    ("JavaScript", "software", ("javascript", "ecmascript")),
    ("TypeScript", "software", ("typescript",)),
    ("React", "software", ("react", "reactjs", "react.js")),
    ("Node.js", "software", ("node.js", "nodejs", "node js", "express.js")),
    ("Java", "software", ("java", "spring boot", "spring framework")),
    ("C#", "software", ("c#", "csharp", ".net", "dotnet")),
    ("Linux", "platform", ("linux", "unix", "bash", "shell scripting")),
    ("Git", "workflow", ("git", "github", "gitlab", "bitbucket")),
    ("Docker", "platform", ("docker", "containerization", "containers")),
    ("Kubernetes", "platform", ("kubernetes", "k8s")),
    ("REST APIs", "software", ("rest api", "restful", "api development", "http api", "endpoint")),
    ("AWS", "cloud", ("aws", "amazon web services")),
    ("Azure", "cloud", ("azure", "microsoft azure")),
    ("Google Cloud", "cloud", ("google cloud", "gcp")),
    ("Figma", "workflow", ("figma",)),
)


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
        model=settings.analysis_model,
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
        except Exception as exc:
            logger.warning("OpenAI job brief failed: %s", exc)
    if settings.gemini_enabled:
        try:
            return _brief_with_gemini(title, description, source_url, settings)
        except Exception as exc:
            logger.warning("Gemini job brief failed: %s", exc)
    if settings.ai_enabled:
        require_ai_result("AI could not build the job description brief. Enable local fallback in settings to use an offline brief.")
    else:
        require_ai_result("No AI provider is configured for job description briefs. Enable local fallback in settings to use an offline brief.")
    return _heuristic_brief(title, description, source_url, source="heuristic_fallback")


def analysis_from_job_brief(brief: JobDescriptionBrief) -> JobAnalysisResponse:
    """Keep the legacy plan/exam analysis fields aligned with the canonical job brief.

    The planner still consumes the compact analysis shape. Mapping it from the
    persisted brief prevents a second model call and keeps all job surfaces
    grounded in the same extracted role signals.
    """

    required_skills = _brief_skill_labels(brief)
    grouped_topics: dict[str, list[str]] = {}
    for topic in brief.interview_topics:
        grouped_topics.setdefault(topic.category, []).append(topic.topic)
    if not grouped_topics:
        grouped_topics["technical"] = required_skills[:5] or ["Role fundamentals"]
    return JobAnalysisResponse(
        role_title=brief.role_title,
        company=brief.company,
        seniority=_detect_seniority(f"{brief.role_title} {' '.join(brief.requirements.experience_and_education)}"),
        required_skills=required_skills,
        core_skills=brief.core_skills,
        interview_focus=[InterviewFocus(category=category, topics=topics[:5]) for category, topics in grouped_topics.items()],
        coding_difficulty=_detect_difficulty(" ".join(required_skills + [topic.topic for topic in brief.interview_topics])),
        behavioral_themes=brief.behavioral_story_prompts[:6] or ["teamwork", "communication"],
        source=brief.source,
    )


def answer_job_description_question(
    title: str,
    description: str,
    question: str,
    settings: Settings,
    blueprint: RoleBlueprint | None = None,
) -> JobDescriptionAskResponse:
    if settings.openai_enabled:
        try:
            return _description_answer_with_openai(title, description, question, settings, blueprint)
        except Exception as exc:
            logger.warning("OpenAI job-description question failed: %s", exc)
    if settings.gemini_enabled:
        try:
            return _description_answer_with_gemini(title, description, question, settings, blueprint)
        except Exception as exc:
            logger.warning("Gemini job-description question failed: %s", exc)
    if settings.ai_enabled:
        require_ai_result("AI could not answer this job-description question. Enable local fallback in settings to use an offline answer.")
    else:
        require_ai_result("No AI provider is configured for job-description questions. Enable local fallback in settings to use an offline answer.")
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


def _clean_summary(value: Any) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(sentences[:2])[:520]


def _normalize_priority(value: Any) -> str:
    clean = str(value or "").strip().lower()
    return clean if clean in {"critical", "important", "supporting"} else "important"


def _normalize_topic_category(value: Any) -> str:
    clean = str(value or "").strip().lower()
    return clean if clean in {"technical", "domain", "behavioral", "case", "system", "other"} else "other"


def _priority_items_from_ai_data(value: Any, fallback: list[JobAnalysisPriority]) -> list[JobAnalysisPriority]:
    items: list[JobAnalysisPriority] = []
    if isinstance(value, list):
        for raw in value:
            if not isinstance(raw, dict):
                continue
            title = _clean_summary(raw.get("title"))
            reason = _clean_summary(raw.get("why_it_matters"))
            if title and reason:
                items.append(JobAnalysisPriority(title=title[:120], why_it_matters=reason[:260], priority=_normalize_priority(raw.get("priority"))))
            if len(items) >= 3:
                break
    return items or fallback[:3]


def _requirements_from_ai_data(value: Any, fallback: JobAnalysisRequirements) -> JobAnalysisRequirements:
    raw = value if isinstance(value, dict) else {}
    return JobAnalysisRequirements(
        must_have=_json_list(raw.get("must_have"), 6) or fallback.must_have,
        preferred=_json_list(raw.get("preferred"), 5) or fallback.preferred,
        experience_and_education=_json_list(raw.get("experience_and_education"), 4) or fallback.experience_and_education,
        eligibility_constraints=_json_list(raw.get("eligibility_constraints"), 4) or fallback.eligibility_constraints,
    )


def _interview_topics_from_ai_data(value: Any, fallback: list[JobInterviewTopic]) -> list[JobInterviewTopic]:
    items: list[JobInterviewTopic] = []
    if isinstance(value, list):
        for raw in value:
            if not isinstance(raw, dict):
                continue
            topic = _clean_summary(raw.get("topic"))
            reason = _clean_summary(raw.get("why_it_matters"))
            if topic and reason:
                items.append(JobInterviewTopic(
                    topic=topic[:140],
                    why_it_matters=reason[:260],
                    priority=_normalize_priority(raw.get("priority")),
                    category=_normalize_topic_category(raw.get("category")),
                ))
            if len(items) >= 6:
                break
    return items or fallback[:6]


def _heuristic_requirement_groups(requirements: list[str], lower: str) -> tuple[list[str], list[str], list[str], list[str]]:
    must_have: list[str] = []
    preferred: list[str] = []
    experience: list[str] = []
    eligibility: list[str] = []
    for item in requirements:
        lowered = item.lower()
        if any(marker in lowered for marker in ["citizen", "citizenship", "work authorization", "security clearance", "visa"]):
            eligibility.append(item)
        elif any(marker in lowered for marker in ["degree", "years", "experience", "education", "bachelor", "master"]):
            experience.append(item)
        elif any(marker in lowered for marker in ["preferred", "plus", "nice to have", "bonus"]):
            preferred.append(item)
        else:
            must_have.append(item)
    if not must_have:
        must_have = _keyword_summary(lower)[:4]
    return must_have[:6], preferred[:5], experience[:4], eligibility[:4]


def _heuristic_priorities(looking_for: list[str], responsibilities: list[str], keywords: list[str]) -> list[JobAnalysisPriority]:
    candidates = looking_for[:3] or responsibilities[:3] or keywords[:3]
    priorities: list[JobAnalysisPriority] = []
    for index, item in enumerate(candidates):
        priorities.append(JobAnalysisPriority(
            title=item[:120],
            why_it_matters="It appears repeatedly in the role description or is central to the day-to-day work.",
            priority="critical" if index == 0 else "important",
        ))
    return priorities or [
        JobAnalysisPriority(title="Role fundamentals", why_it_matters="Start with the core work described in the posting before practicing interview answers.", priority="critical"),
        JobAnalysisPriority(title="Concrete examples", why_it_matters="Interviewers need evidence that connects your experience to the role.", priority="important"),
        JobAnalysisPriority(title="Communication", why_it_matters="Clear explanations help connect your technical or domain work to a business outcome.", priority="supporting"),
    ]


def _heuristic_interview_topics(keywords: list[str], responsibilities: list[str]) -> list[JobInterviewTopic]:
    topics = [
        JobInterviewTopic(topic=keyword, why_it_matters="The posting names this capability or the work depends on it.", priority="critical" if index == 0 else "important", category="technical")
        for index, keyword in enumerate(keywords[:3])
    ]
    if responsibilities:
        topics.append(JobInterviewTopic(
            topic="Explain your approach to the role's main responsibility",
            why_it_matters="You should be able to describe how you would plan, execute, and validate work like the posting describes.",
            priority="important",
            category="behavioral",
        ))
    return topics[:6] or [
        JobInterviewTopic(topic="Role fundamentals", why_it_matters="Start with the concepts and workflow named in the posting.", priority="critical", category="domain"),
        JobInterviewTopic(topic="Project examples", why_it_matters="Prepare concrete examples that show how you deliver, learn, and communicate.", priority="important", category="behavioral"),
    ]


def _brief_skill_labels(brief: JobDescriptionBrief) -> list[str]:
    if brief.core_skills:
        return [skill.name for skill in brief.core_skills[:8]]

    candidates = [
        *brief.requirements.must_have,
        *brief.requirements.preferred,
        *(topic.topic for topic in brief.interview_topics if topic.category in {"technical", "domain", "system"}),
    ]
    labels: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        text = re.sub(r"\s+", " ", str(candidate or "")).strip(" .:-")
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        labels.append(text[:120])
        if len(labels) >= 8:
            break
    return labels or ["Role fundamentals", "Communication", "Problem solving"]


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
    response = client.responses.parse(
        model=settings.analysis_model,
        input=[
            {
                "role": "system",
                "content": (
                    "You turn job descriptions into a fixed, minimal interview-preparation analysis. "
                    "Use only the supplied posting. Do not invent company facts, sponsorship, eligibility, "
                    "or interview-process claims. Separate explicit requirements from preferences. Put an "
                    "eligibility constraint only when the posting explicitly states it. Rank the work that "
                    "matters most, then rank interview topics by critical, important, or supporting. Each item "
                    "must be concise, specific to the posting, and useful for a candidate preparing now or "
                    "building skills for a future interview. Detect company from job-board headers if present. "
                    "Keep role_summary to two sentences maximum. Use 3 items for what_matters_most, 3-6 "
                    "interview_topics, 2-4 behavioral_story_prompts, 2-4 positioning_prompts, and 2-4 "
                    "questions_to_ask. Unknowns should be things the candidate should verify, not warnings "
                    "you invented. For core_skills, return 3-8 short canonical technology or tool labels that "
                    "are explicitly named in the posting, such as Power BI, Linux, Tableau, or SQL. Never "
                    "put broad traits, complete requirement sentences, or inferred technologies in core_skills."
                ),
            },
            {
                "role": "user",
                "content": f"Role title hint: {title}\nSource URL: {source_url or ''}\n\nJob description:\n{description[:9000]}",
            },
        ],
        text_format=JobDescriptionBrief,
    )
    parsed = response.output_parsed
    return _brief_from_ai_data(parsed.model_dump(), title, description, source_url, source="openai")


def _brief_with_gemini(title: str, description: str, source_url: str | None, settings: Settings) -> JobDescriptionBrief:
    prompt = (
        "Create a fixed job-analysis JSON object for interview preparation. Use only the supplied posting.\n"
        "Return keys: analysis_version, company, role_title, role_summary, core_skills, what_matters_most, requirements, "
        "responsibilities, interview_topics, behavioral_story_prompts, positioning_prompts, questions_to_ask, "
        "unknowns_to_verify. Keep it minimal and specific. Never invent company facts, sponsorship, or eligibility. "
        "Only include eligibility constraints explicitly stated in the posting.\n\n"
        f"Role title hint: {title}\n"
        f"Source URL: {source_url or ''}\n\n"
        f"Job description:\n{description[:9000]}"
    )
    data = generate_gemini_json(settings, prompt, _job_brief_schema())
    return _brief_from_ai_data(data, title, description, source_url, source="gemini")


def _brief_from_ai_data(data: dict, title: str, description: str, source_url: str | None, source: str) -> JobDescriptionBrief:
    fallback = _heuristic_brief(title, description, source_url, source="heuristic_fallback")
    requirements = _requirements_from_ai_data(data.get("requirements"), fallback.requirements)
    responsibilities = _json_list(data.get("responsibilities"), 5) or fallback.responsibilities
    priorities = _priority_items_from_ai_data(data.get("what_matters_most"), fallback.what_matters_most)
    topics = _interview_topics_from_ai_data(data.get("interview_topics"), fallback.interview_topics)
    core_skills = _core_skills_from_ai_data(data.get("core_skills"), fallback.core_skills)
    summary = _clean_summary(data.get("role_summary")) or fallback.role_summary

    raw_role_title = _clean_summary(data.get("role_title"))
    return JobDescriptionBrief(
        analysis_version="v2",
        company=_clean_company_candidate(str(data.get("company") or "")) or fallback.company,
        role_title=_clean_role_title(raw_role_title) if raw_role_title else fallback.role_title,
        role_summary=summary,
        core_skills=core_skills,
        what_matters_most=priorities,
        requirements=requirements,
        responsibilities=responsibilities,
        interview_topics=topics,
        behavioral_story_prompts=_json_list(data.get("behavioral_story_prompts"), 4) or fallback.behavioral_story_prompts,
        positioning_prompts=_json_list(data.get("positioning_prompts"), 4) or fallback.positioning_prompts,
        questions_to_ask=_json_list(data.get("questions_to_ask"), 4) or fallback.questions_to_ask,
        unknowns_to_verify=_json_list(data.get("unknowns_to_verify"), 4) or fallback.unknowns_to_verify,
        source=source,
    )


def _description_answer_with_openai(
    title: str,
    description: str,
    question: str,
    settings: Settings,
    blueprint: RoleBlueprint | None = None,
) -> JobDescriptionAskResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.responses.parse(
        model=settings.analysis_model,
        input=[
            {
                "role": "system",
                "content": (
                    "Answer questions about a job description for an interview candidate. "
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
                "content": (
                    f"Role: {title}\nQuestion: {question}\n\n"
                    f"Posting-derived role intelligence:\n{blueprint_context(blueprint, include_sources=False)}\n\n"
                    f"Job description source text:\n{description[:9000]}"
                ),
            },
        ],
        text_format=JobDescriptionAskResponse,
    )
    return response.output_parsed.model_copy(update={"source": "openai"})


def _description_answer_with_gemini(
    title: str,
    description: str,
    question: str,
    settings: Settings,
    blueprint: RoleBlueprint | None = None,
) -> JobDescriptionAskResponse:
    prompt = (
        "Answer this job-description question as JSON only with keys answer, interview_use, next_steps.\n"
        "Use only the supplied job description and the user's question. Be specific, practical, "
        "and interview-focused. If the user asks for explanation, answer in enough detail to be useful.\n\n"
        f"Role: {title}\n"
        f"Question: {question}\n\n"
        f"Posting-derived role intelligence:\n{blueprint_context(blueprint, include_sources=False)}\n\n"
        f"Job description:\n{description[:9000]}"
    )
    data = generate_gemini_json(settings, prompt, _job_description_ask_schema())
    return JobDescriptionAskResponse(
        answer=data.get("answer") or "Focus on the role requirements and prepare a concrete example.",
        interview_use=data.get("interview_use") or "Use this as a concise interview talking point connected to the job description.",
        next_steps=_json_list(data.get("next_steps"), 5),
        source="gemini",
    )


def _job_description_ask_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "interview_use": {"type": "string"},
            "next_steps": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["answer", "interview_use", "next_steps"],
    }


def _job_brief_schema() -> dict[str, Any]:
    list_field = {"type": "array", "items": {"type": "string"}}
    priority_field = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "why_it_matters": {"type": "string"},
            "priority": {"type": "string", "enum": ["critical", "important", "supporting"]},
        },
        "required": ["title", "why_it_matters", "priority"],
    }
    requirement_field = {
        "type": "object",
        "properties": {
            "must_have": list_field,
            "preferred": list_field,
            "experience_and_education": list_field,
            "eligibility_constraints": list_field,
        },
        "required": ["must_have", "preferred", "experience_and_education", "eligibility_constraints"],
    }
    topic_field = {
        "type": "object",
        "properties": {
            "topic": {"type": "string"},
            "why_it_matters": {"type": "string"},
            "priority": {"type": "string", "enum": ["critical", "important", "supporting"]},
            "category": {"type": "string", "enum": ["technical", "domain", "behavioral", "case", "system", "other"]},
        },
        "required": ["topic", "why_it_matters", "priority", "category"],
    }
    core_skill_field = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "category": {"type": "string", "enum": ["data", "software", "platform", "cloud", "workflow", "other"]},
            "priority": {"type": "string", "enum": ["critical", "important", "supporting"]},
        },
        "required": ["name", "category", "priority"],
    }
    return {
        "type": "object",
        "properties": {
            "analysis_version": {"type": "string"},
            "company": {"type": "string"},
            "role_title": {"type": "string"},
            "role_summary": {"type": "string"},
            "core_skills": {"type": "array", "items": core_skill_field},
            "what_matters_most": {"type": "array", "items": priority_field},
            "requirements": requirement_field,
            "responsibilities": list_field,
            "interview_topics": {"type": "array", "items": topic_field},
            "behavioral_story_prompts": list_field,
            "positioning_prompts": list_field,
            "questions_to_ask": list_field,
            "unknowns_to_verify": list_field,
        },
        "required": [
            "analysis_version",
            "company",
            "role_title",
            "role_summary",
            "core_skills",
            "what_matters_most",
            "requirements",
            "responsibilities",
            "interview_topics",
            "behavioral_story_prompts",
            "positioning_prompts",
            "questions_to_ask",
            "unknowns_to_verify",
        ],
    }


def _heuristic_brief(title: str, description: str, source_url: str | None, source: str) -> JobDescriptionBrief:
    lines = [line.strip(" •-") for line in description.splitlines() if line.strip()]
    company = infer_company_name("", description, source_url)
    role = infer_role_title(title, description, source_url)
    lower = description.lower()
    core_skills = extract_core_skills(description)
    requirements = _lines_after_headings(lines, ["software experience required", "requirements", "required", "qualifications", "ideal candidate"], 8)
    responsibilities = _lines_after_headings(lines, ["what you'll do", "responsibilities", "what you will do", "duties"], 8)
    looking_for = _lines_after_headings(lines, ["ideal candidate", "who you are", "we're looking for", "looking for"], 6)
    if not requirements:
        requirements = _keyword_summary(lower)
    if not responsibilities:
        responsibilities = [line for line in lines if re.search(r"(?i)^(assist|create|develop|prepare|coordinate|support|collaborate|produce|manage)\b", line)][:6]
    if not looking_for:
        looking_for = _fallback_profile(lower, requirements, responsibilities)
    keywords = _keyword_summary(lower)
    must_have, preferred, experience, eligibility = _heuristic_requirement_groups(requirements, lower)
    priorities = _heuristic_priorities(looking_for, responsibilities, keywords)
    topics = _heuristic_interview_topics(keywords, responsibilities)
    return JobDescriptionBrief(
        company=company,
        role_title=role,
        role_summary=(
            f"{company + ' is hiring ' if company else 'This posting is for '}{role}. "
            f"The work emphasizes {', '.join(keywords[:3]) or 'role-specific fundamentals'} and clear examples tied to the posted responsibilities."
        ),
        core_skills=core_skills,
        what_matters_most=priorities,
        requirements=JobAnalysisRequirements(
            must_have=must_have,
            preferred=preferred,
            experience_and_education=experience,
            eligibility_constraints=eligibility,
        ),
        responsibilities=responsibilities[:5],
        interview_topics=topics,
        behavioral_story_prompts=[
            "Prepare a story showing how you learned a relevant tool or concept quickly.",
            "Prepare a story about collaborating, communicating progress, or resolving a tradeoff.",
            "Prepare a story that proves ownership of a result related to the role's main responsibility.",
        ],
        positioning_prompts=_fallback_profile(lower, requirements, responsibilities)[:4],
        questions_to_ask=[
            "How is success measured for this role in the first 90 days?",
            "Which responsibilities will this person own most often at the start?",
            "How does the team collaborate when a technical or business tradeoff needs a decision?",
        ],
        unknowns_to_verify=[
            f"Verify {company}'s product, customers, and current team priorities before an interview." if company else "Verify the company's product, customers, and current team priorities before an interview.",
            "Confirm the interview stages, team structure, and evaluation criteria because the posting may not include them.",
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
    # Prefer precise job skills over a broad category such as "technical
    # tools". These labels are reused by the prep-plan generator and job
    # overview, so they should be immediately actionable for the candidate.
    detected_skills = _detect_skills(text)
    if detected_skills:
        return detected_skills[:6]

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


def extract_core_skills(description: str, limit: int = 8) -> list[JobCoreSkill]:
    """Return compact, evidence-based technologies/tools from one job posting.

    The deterministic catalogue is the grounding layer: AI may rank the
    detected candidates, but it cannot introduce a tool that does not appear
    in the saved job source. This makes the result safe to reuse in the job
    overview, prep plan, notes, exams, and mock-interview prompts.
    """

    text = re.sub(r"\s+", " ", description or "").lower()
    matches: list[tuple[int, str, str]] = []
    for name, category, aliases in CORE_SKILL_CATALOG:
        positions = [_skill_alias_position(text, alias) for alias in aliases]
        positions = [position for position in positions if position is not None]
        if positions:
            matches.append((min(positions), name, category))

    matches.sort(key=lambda item: item[0])
    skills: list[JobCoreSkill] = []
    for _, name, category in matches[:limit]:
        skills.append(JobCoreSkill(
            name=name,
            category=category,
            priority="critical" if len(skills) < 3 else "important",
        ))
    return skills


def _skill_alias_position(text: str, alias: str) -> int | None:
    """Find an alias as a standalone technology term, not inside another word."""

    match = re.search(rf"(?<!\\w){re.escape(alias)}(?!\\w)", text, flags=re.IGNORECASE)
    return match.start() if match else None


def _core_skills_from_ai_data(value: Any, fallback: list[JobCoreSkill]) -> list[JobCoreSkill]:
    """Use AI ordering only for known, source-grounded core skills."""

    by_name = {skill.name.lower(): skill for skill in fallback}
    selected: list[JobCoreSkill] = []
    if isinstance(value, list):
        for raw in value:
            if not isinstance(raw, dict):
                continue
            candidate = _clean_summary(raw.get("name")).lower()
            matched = by_name.get(candidate)
            if matched is None or any(skill.name == matched.name for skill in selected):
                continue
            selected.append(JobCoreSkill(
                name=matched.name,
                category=matched.category,
                priority=_normalize_priority(raw.get("priority")),
            ))
            if len(selected) >= 8:
                break
    return selected or fallback[:8]


def _analyze_with_openai(request: JobAnalysisRequest, settings: Settings) -> JobAnalysisResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    completion = client.chat.completions.create(
        model=settings.analysis_model,
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
        core_skills=extract_core_skills(request.job_description),
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
