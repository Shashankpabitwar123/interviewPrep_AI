from datetime import datetime
import logging
import math
import re
from typing import Optional

from pydantic import BaseModel, Field

from app.config import Settings
from app.schemas.prep_plan import PrepPlanRequest, PrepPlanResponse, PrepTask, PrepTaskType, SkillSignal
from app.services.gemini_service import GeminiQuotaError, generate_gemini_json


SKILL_KEYWORDS = {
    "Python": ["python", "fastapi", "django", "flask"],
    "SQL": ["sql", "postgres", "postgresql", "mysql", "database"],
    "REST APIs": ["rest", "api", "http", "endpoint"],
    "Docker": ["docker", "container", "kubernetes"],
    "Data Structures": ["data structures", "algorithms", "leetcode"],
    "System Design": ["system design", "scalability", "distributed"],
    "Testing": ["pytest", "unit test", "integration test", "testing"],
    "Cloud": ["aws", "gcp", "azure", "cloud"],
    "Writing": ["writing", "writer", "copy", "content", "storytelling", "narrative"],
    "Editing": ["editing", "grammar", "syntax", "punctuation", "proofread", "accuracy"],
    "Communication": ["communication", "verbal", "written", "feedback", "audience"],
    "Organization": ["organization", "organized", "time management", "deadline"],
}

logger = logging.getLogger(__name__)


class AIPlanTask(BaseModel):
    day: int = Field(ge=1)
    title: str
    task_type: PrepTaskType
    duration_minutes: int = Field(ge=15, le=600)
    topics: list[str]
    instructions: str


class AIPlanOutput(BaseModel):
    detected_skills: list[SkillSignal]
    plan_summary: str
    tasks: list[AIPlanTask]


def generate_prep_plan(request: PrepPlanRequest, settings: Optional[Settings] = None) -> PrepPlanResponse:
    """Create a day-by-day plan based on interview date and detected job skills."""

    days_until_interview = _days_until(request.interview_at)

    if settings and settings.openai_enabled:
        try:
            return _generate_with_openai(request, settings, days_until_interview)
        except Exception:
            if settings.gemini_enabled:
                try:
                    return _generate_with_gemini(request, settings, days_until_interview)
                except GeminiQuotaError as exc:
                    logger.warning("Gemini prep plan quota exceeded after OpenAI failure: %s", exc)
                    return _generate_heuristic_plan(request, days_until_interview, plan_source="quota_fallback")
                except Exception as exc:
                    logger.warning("Gemini prep plan generation failed after OpenAI failure: %s", exc)
            return _generate_heuristic_plan(request, days_until_interview, plan_source="heuristic_fallback")

    if settings and settings.gemini_enabled:
        try:
            return _generate_with_gemini(request, settings, days_until_interview)
        except GeminiQuotaError as exc:
            logger.warning("Gemini prep plan quota exceeded: %s", exc)
            return _generate_heuristic_plan(request, days_until_interview, plan_source="quota_fallback")
        except Exception as exc:
            logger.warning("Gemini prep plan generation failed: %s", exc)
            return _generate_heuristic_plan(request, days_until_interview, plan_source="heuristic_fallback")

    return _generate_heuristic_plan(request, days_until_interview, plan_source="heuristic")


def _generate_heuristic_plan(
    request: PrepPlanRequest,
    days_until_interview: int,
    plan_source: str,
) -> PrepPlanResponse:
    detected_skills = _detect_skills(request.job_description)
    topics = [skill.name for skill in detected_skills] or ["Python", "Data Structures", "Behavioral Interviewing"]

    return PrepPlanResponse(
        job_title=request.job_title,
        days_until_interview=days_until_interview,
        detected_skills=detected_skills,
        plan_summary=_summary(days_until_interview, topics),
        plan_source=plan_source,
        tasks=_build_tasks(days_until_interview, topics, request.hours_per_day),
    )


def _generate_with_openai(
    request: PrepPlanRequest,
    settings: Settings,
    days_until_interview: int,
) -> PrepPlanResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.responses.parse(
        model=settings.openai_model,
        input=[
            {
                "role": "system",
                "content": (
                    "You generate interview preparation schedules as structured JSON. "
                    "Create practical daily tasks that match the job description, the user's comfort level, "
                    "the interview timeline, and available hours. Use different task mixes for short, medium, "
                    "and long timelines. Every day must have at least one task. Include diagnostic work early, "
                    "technical practice through the middle, mock interview practice near the end, and revision on the final day."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job title: {request.job_title}\n"
                    f"Days until interview: {days_until_interview}\n"
                    f"Hours per day: {request.hours_per_day}\n"
                    f"Comfort level: {request.comfort_level}\n\n"
                    f"Job description:\n{request.job_description}"
                ),
            },
        ],
        text_format=AIPlanOutput,
    )
    ai_plan = response.output_parsed
    tasks = [
        PrepTask(
            day=min(max(task.day, 1), days_until_interview),
            title=task.title,
            task_type=task.task_type,
            duration_minutes=task.duration_minutes,
            topics=task.topics,
            instructions=task.instructions,
        )
        for task in ai_plan.tasks
    ]

    if not tasks:
        raise ValueError("OpenAI returned an empty plan.")

    return PrepPlanResponse(
        job_title=request.job_title,
        days_until_interview=days_until_interview,
        detected_skills=ai_plan.detected_skills,
        plan_summary=ai_plan.plan_summary,
        plan_source="openai",
        tasks=sorted(tasks, key=lambda task: (task.day, task.title)),
    )


def _generate_with_gemini(
    request: PrepPlanRequest,
    settings: Settings,
    days_until_interview: int,
) -> PrepPlanResponse:
    base_topics = _topic_words(request.job_description)
    base_tasks = _build_tasks(days_until_interview, base_topics, request.hours_per_day)
    task_template = "\n".join(
        (
            f"- day={task.day}; task_type={task.task_type.value}; duration_minutes={task.duration_minutes}; "
            f"default_title={task.title}; default_topics={', '.join(task.topics)}"
        )
        for task in base_tasks
    )
    prompt = (
        "Generate an interview preparation plan as JSON only. "
        'Use this exact shape: {"detected_skills":[{"name":"skill","confidence":0.8}],'
        '"plan_summary":"summary","tasks":[{"day":1,"title":"task","task_type":"study",'
        '"duration_minutes":60,"topics":["topic"],"instructions":"instructions"}]}. '
        "Keep exactly the task slots listed below: same number of tasks, same day numbers, same task_type values, "
        "and similar durations. Customize only the detected skills, plan summary, task titles, topics, and instructions "
        "so they fit the job description. If the job is not a software role, do not force coding topics.\n\n"
        f"Fixed task slots:\n{task_template}\n\n"
        f"Job title: {request.job_title}\n"
        f"Days until interview: {days_until_interview}\n"
        f"Hours per day: {request.hours_per_day}\n"
        f"Comfort level: {request.comfort_level}\n\n"
        f"Job description:\n{request.job_description}"
    )
    data = generate_gemini_json(settings, prompt, _gemini_plan_schema())
    if isinstance(data, list):
        data = _normalize_gemini_plan_list(data, request, days_until_interview)
    else:
        data = _normalize_gemini_plan_object(data, request, days_until_interview)
    data = _merge_with_template(data, base_tasks, request)
    ai_plan = AIPlanOutput.model_validate(data)
    tasks = [
        PrepTask(
            day=min(max(task.day, 1), days_until_interview),
            title=task.title,
            task_type=task.task_type,
            duration_minutes=task.duration_minutes,
            topics=task.topics,
            instructions=task.instructions,
        )
        for task in ai_plan.tasks
    ]

    if not tasks:
        raise ValueError("Gemini returned an empty plan.")

    return PrepPlanResponse(
        job_title=request.job_title,
        days_until_interview=days_until_interview,
        detected_skills=ai_plan.detected_skills,
        plan_summary=ai_plan.plan_summary,
        plan_source="gemini",
        tasks=sorted(tasks, key=lambda task: (task.day, task.title)),
    )


def _normalize_gemini_plan_list(
    items: list[dict],
    request: PrepPlanRequest,
    days_until_interview: int,
) -> dict:
    tasks = []
    for item in items:
        day = int(item.get("day") or len(tasks) + 1)
        title = item.get("title") or item.get("focus") or f"Day {day} preparation"
        instructions = item.get("instructions") or item.get("activity") or item.get("activities") or item.get("description") or title
        if isinstance(instructions, list):
            instructions = " ".join(str(value) for value in instructions)
        duration = item.get("duration_minutes")
        if duration is None:
            duration = int(float(item.get("duration_hours", request.hours_per_day)) * 60)
        tasks.append(
            {
                "day": min(max(day, 1), days_until_interview),
                "title": str(title),
                "task_type": _task_type_from_title(str(title)),
                "duration_minutes": _normalize_duration(duration),
                "topics": item.get("topics") or _topic_words(request.job_description),
                "instructions": str(instructions),
            }
        )
    return {
        "detected_skills": [{"name": topic, "confidence": 0.8} for topic in _topic_words(request.job_description)],
        "plan_summary": f"{days_until_interview}-day Gemini-generated prep plan for {request.job_title}.",
        "tasks": tasks,
    }


def _normalize_gemini_plan_object(
    data: dict,
    request: PrepPlanRequest,
    days_until_interview: int,
) -> dict:
    data.setdefault("detected_skills", [{"name": topic, "confidence": 0.8} for topic in _topic_words(request.job_description)])
    data.setdefault("plan_summary", f"{days_until_interview}-day Gemini-generated prep plan for {request.job_title}.")
    normalized_tasks = []
    for index, task in enumerate(data.get("tasks", []), start=1):
        task["day"] = min(max(int(task.get("day") or index), 1), days_until_interview)
        task["task_type"] = _normalize_task_type(str(task.get("task_type") or task.get("title") or "study"))
        task["duration_minutes"] = _normalize_duration(task.get("duration_minutes") or request.hours_per_day * 60)
        task["topics"] = task.get("topics") or _topic_words(request.job_description)
        task["instructions"] = task.get("instructions") or task.get("title") or "Complete this preparation task."
        normalized_tasks.append(task)
    data["tasks"] = normalized_tasks
    return data


def _merge_with_template(data: dict, template_tasks: list[PrepTask], request: PrepPlanRequest) -> dict:
    ai_tasks = data.get("tasks", [])
    merged_tasks = []
    for index, template in enumerate(template_tasks):
        ai_task = ai_tasks[index] if index < len(ai_tasks) and isinstance(ai_tasks[index], dict) else {}
        merged_tasks.append(
            {
                "day": template.day,
                "title": str(ai_task.get("title") or template.title),
                "task_type": template.task_type.value,
                "duration_minutes": _normalize_duration(ai_task.get("duration_minutes") or template.duration_minutes),
                "topics": ai_task.get("topics") or template.topics or _topic_words(request.job_description),
                "instructions": str(ai_task.get("instructions") or template.instructions),
            }
        )
    data["tasks"] = merged_tasks
    return data


def _normalize_duration(value: object) -> int:
    try:
        duration = int(float(value))
    except (TypeError, ValueError):
        duration = 60
    return min(600, max(15, duration))


def _task_type_from_title(title: str) -> str:
    return _normalize_task_type(title)


def _normalize_task_type(value: str) -> str:
    if value in {"diagnostic", "study", "exam", "coding", "mock_interview", "revision"}:
        return value
    text = value.lower()
    if "diagnostic" in text:
        return "diagnostic"
    if "exam" in text or "quiz" in text:
        return "exam"
    if "mock" in text or "interview" in text:
        return "mock_interview"
    if "revision" in text or "review" in text or "final" in text:
        return "revision"
    if "coding" in text or "practice" in text:
        return "coding"
    return "study"


def _topic_words(description: str) -> list[str]:
    skills = [skill.name for skill in _detect_skills(description)]
    return skills or ["Interview Preparation"]


def _gemini_plan_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "detected_skills": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["name", "confidence"],
                },
            },
            "plan_summary": {"type": "string"},
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "day": {"type": "integer", "minimum": 1},
                        "title": {"type": "string"},
                        "task_type": {
                            "type": "string",
                            "enum": ["diagnostic", "study", "exam", "coding", "mock_interview", "revision"],
                        },
                        "duration_minutes": {"type": "integer", "minimum": 15, "maximum": 600},
                        "topics": {"type": "array", "items": {"type": "string"}},
                        "instructions": {"type": "string"},
                    },
                    "required": ["day", "title", "task_type", "duration_minutes", "topics", "instructions"],
                },
            },
        },
        "required": ["detected_skills", "plan_summary", "tasks"],
    }


def _days_until(interview_at: datetime) -> int:
    now = datetime.now(interview_at.tzinfo)
    seconds = max((interview_at - now).total_seconds(), 0)
    return max(1, math.ceil(seconds / 86_400))


def _detect_skills(job_description: str) -> list[SkillSignal]:
    text = re.sub(r"\s+", " ", job_description.lower())
    matches: list[SkillSignal] = []
    for skill, keywords in SKILL_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if keyword in text)
        if hits:
            matches.append(SkillSignal(name=skill, confidence=min(0.95, 0.45 + hits * 0.2)))
    return sorted(matches, key=lambda skill: skill.confidence, reverse=True)


def _build_tasks(days: int, topics: list[str], hours_per_day: float) -> list[PrepTask]:
    daily_minutes = int(hours_per_day * 60)
    tasks: list[PrepTask] = []

    for day in range(1, days + 1):
        primary_topics = _topics_for_day(topics, day)

        # Day 1 starts with a diagnostic. The final day stays lighter for revision.
        if day == 1:
            tasks.extend(
                [
                    PrepTask(
                        day=day,
                        title="Role diagnostic exam",
                        task_type=PrepTaskType.diagnostic,
                        duration_minutes=_normalize_duration(min(45, daily_minutes)),
                        topics=primary_topics,
                        instructions="Take a baseline test covering the highest-priority skills from the job description.",
                    ),
                    PrepTask(
                        day=day,
                        title="Targeted review from diagnostic results",
                        task_type=PrepTaskType.study,
                        duration_minutes=_normalize_duration(max(30, daily_minutes - 45)),
                        topics=primary_topics,
                        instructions="Review the weakest topics and write a short notes page for each one.",
                    ),
                ]
            )
        elif day == days:
            tasks.extend(
                [
                    PrepTask(
                        day=day,
                        title="Final revision sprint",
                        task_type=PrepTaskType.revision,
                        duration_minutes=_normalize_duration(max(45, daily_minutes // 2)),
                        topics=topics[:5],
                        instructions="Review flashcards, common mistakes, and the highest-frequency interview questions.",
                    ),
                    PrepTask(
                        day=day,
                        title="Light mock interview",
                        task_type=PrepTaskType.mock_interview,
                        duration_minutes=_normalize_duration(min(45, daily_minutes)),
                        topics=topics[:4],
                        instructions="Complete a lower-stress mock interview and focus on clear explanations.",
                    ),
                ]
            )
        else:
            tasks.extend(
                [
                    PrepTask(
                        day=day,
                        title="Timed technical exam",
                        task_type=PrepTaskType.exam,
                        duration_minutes=_normalize_duration(min(60, daily_minutes)),
                        topics=primary_topics,
                        instructions="Answer mixed question types under a time limit, then review explanations.",
                    ),
                    PrepTask(
                        day=day,
                        title="Role-specific practice",
                        task_type=PrepTaskType.coding,
                        duration_minutes=_normalize_duration(max(45, daily_minutes - 60)),
                        topics=primary_topics,
                        instructions="Complete one practical exercise connected to the role and document your approach.",
                    ),
                ]
            )

    return tasks


def _topics_for_day(topics: list[str], day: int) -> list[str]:
    if len(topics) <= 3:
        return topics
    start = (day - 1) % len(topics)
    rotated = topics[start:] + topics[:start]
    return rotated[:3]


def _summary(days: int, topics: list[str]) -> str:
    topic_text = ", ".join(topics[:5])
    return f"{days}-day prep plan focused on {topic_text} with diagnostics, practice, mock interviews, and final revision."
