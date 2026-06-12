import json
import re
from typing import Any

from app.config import Settings
from app.schemas.job_analysis import InterviewFocus, JobAnalysisRequest, JobAnalysisResponse
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


def analyze_job_description(request: JobAnalysisRequest, settings: Settings) -> JobAnalysisResponse:
    """Analyze a job description with OpenAI when available, otherwise locally."""

    if settings.openai_enabled:
        try:
            return _analyze_with_openai(request, settings)
        except Exception:
            # The app should still work during local development if the API key,
            # network, or model response fails.
            return _heuristic_analysis(request, source="heuristic_fallback")

    return _heuristic_analysis(request, source="heuristic")


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
