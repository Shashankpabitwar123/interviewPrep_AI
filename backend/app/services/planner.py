from datetime import datetime
import logging
import re
from typing import Optional

from pydantic import BaseModel, Field

from app.config import Settings
from app.ai_policy import require_ai_result
from app.schemas.prep_plan import PrepPlanRequest, PrepPlanResponse, PrepTask, PrepTaskType, SkillSignal
from app.schemas.role_intelligence import RoleBlueprint
from app.services.gemini_service import GeminiQuotaError, generate_gemini_json
from app.services.role_intelligence_service import blueprint_context, critical_competency_names
from app.services.artifact_quality_service import assess_prep_plan


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


def generate_prep_plan(
    request: PrepPlanRequest,
    settings: Optional[Settings] = None,
    blueprint: Optional[RoleBlueprint] = None,
    interview_evidence: str = "",
) -> PrepPlanResponse:
    """Create a day-by-day plan based on interview date and detected job skills."""

    days_until_interview = _days_until(request.interview_at)

    if settings and settings.openai_enabled:
        try:
            generated = (
                _generate_with_openai(request, settings, days_until_interview)
                if blueprint is None and not interview_evidence
                else _generate_with_openai(request, settings, days_until_interview, blueprint, interview_evidence)
            )
            return _align_plan_to_blueprint(generated, blueprint)
        except Exception:
            if settings.gemini_enabled:
                try:
                    generated = (
                        _generate_with_gemini(request, settings, days_until_interview)
                        if blueprint is None and not interview_evidence
                        else _generate_with_gemini(request, settings, days_until_interview, blueprint, interview_evidence)
                    )
                    return _align_plan_to_blueprint(generated, blueprint)
                except GeminiQuotaError as exc:
                    logger.warning("Gemini prep plan quota exceeded after OpenAI failure: %s", exc)
                    require_ai_result("AI prep-plan generation hit a quota limit. Enable local fallback in settings to create an offline plan.")
                    return _align_plan_to_blueprint(_generate_heuristic_plan(request, days_until_interview, plan_source="quota_fallback", blueprint=blueprint), blueprint)
                except Exception as exc:
                    logger.warning("Gemini prep plan generation failed after OpenAI failure: %s", exc)
            require_ai_result("AI prep-plan generation failed. Enable local fallback in settings to create an offline plan.")
            return _align_plan_to_blueprint(_generate_heuristic_plan(request, days_until_interview, plan_source="heuristic_fallback", blueprint=blueprint), blueprint)

    if settings and settings.gemini_enabled:
        try:
            generated = (
                _generate_with_gemini(request, settings, days_until_interview)
                if blueprint is None and not interview_evidence
                else _generate_with_gemini(request, settings, days_until_interview, blueprint, interview_evidence)
            )
            return _align_plan_to_blueprint(generated, blueprint)
        except GeminiQuotaError as exc:
            logger.warning("Gemini prep plan quota exceeded: %s", exc)
            require_ai_result("AI prep-plan generation hit a quota limit. Enable local fallback in settings to create an offline plan.")
            return _align_plan_to_blueprint(_generate_heuristic_plan(request, days_until_interview, plan_source="quota_fallback", blueprint=blueprint), blueprint)
        except Exception as exc:
            logger.warning("Gemini prep plan generation failed: %s", exc)
            require_ai_result("AI prep-plan generation failed. Enable local fallback in settings to create an offline plan.")
            return _align_plan_to_blueprint(_generate_heuristic_plan(request, days_until_interview, plan_source="heuristic_fallback", blueprint=blueprint), blueprint)

    require_ai_result("No AI provider is configured for prep-plan generation. Enable local fallback in settings to create an offline plan.")
    return _align_plan_to_blueprint(_generate_heuristic_plan(request, days_until_interview, plan_source="heuristic", blueprint=blueprint), blueprint)


def _generate_heuristic_plan(
    request: PrepPlanRequest,
    days_until_interview: int,
    plan_source: str,
    blueprint: Optional[RoleBlueprint] = None,
) -> PrepPlanResponse:
    detected_skills = _blueprint_skills(blueprint) or _detect_skills(request.job_description)
    topics = [skill.name for skill in detected_skills] or ["Python", "Data Structures", "Behavioral Interviewing"]

    return PrepPlanResponse(
        job_title=request.job_title,
        company=request.company or "",
        days_until_interview=days_until_interview,
        detected_skills=detected_skills,
        plan_summary=_summary(days_until_interview, topics),
        plan_source=plan_source,
        tasks=_build_tasks(days_until_interview, topics, request.hours_per_day),
        hours_per_day=request.hours_per_day,
    )


def _generate_with_openai(
    request: PrepPlanRequest,
    settings: Settings,
    days_until_interview: int,
    blueprint: Optional[RoleBlueprint] = None,
    interview_evidence: str = "",
) -> PrepPlanResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.responses.parse(
        model=settings.generation_model,
        input=[
            {
                "role": "system",
                "content": (
                    "You generate interview preparation schedules as structured JSON. "
                    "Create practical daily tasks that match the job description, the user's comfort level, "
                    "the interview timeline, and available hours. Use different task mixes for short, medium, "
                    "and long timelines. Schedule two focused learning-note tasks on a normal study day and a scoped exam after them. "
                    "Difficulty must progress from foundations early, to applied work in the middle, to interview-depth scenarios late. "
                    "Include diagnostic work early, at least one realistic mock interview before the final day, and lighter revision on the final day. "
                    "For plans of six days or more, schedule both a midpoint mock and a final full mock. Every day must contain useful work."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job title: {request.job_title}\n"
                    f"Days until interview: {days_until_interview}\n"
                    f"Hours per day: {request.hours_per_day}\n"
                    f"Comfort level: {request.comfort_level}\n\n"
                    f"Shared role intelligence:\n{blueprint_context(blueprint, include_sources=False)}\n\n"
                    f"Relevant interview evidence:\n{interview_evidence or 'No relevant user-reported interview evidence is available.'}\n\n"
                    f"Job description source text:\n{request.job_description}"
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
        company=request.company or "",
        days_until_interview=days_until_interview,
        detected_skills=ai_plan.detected_skills,
        plan_summary=ai_plan.plan_summary,
        plan_source="openai",
        tasks=sorted(tasks, key=lambda task: (task.day, task.title)),
        hours_per_day=request.hours_per_day,
    )


def _generate_with_gemini(
    request: PrepPlanRequest,
    settings: Settings,
    days_until_interview: int,
    blueprint: Optional[RoleBlueprint] = None,
    interview_evidence: str = "",
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
        f"Shared role intelligence:\n{blueprint_context(blueprint, include_sources=False)}\n\n"
        f"Relevant interview evidence:\n{interview_evidence or 'No relevant user-reported interview evidence is available.'}\n\n"
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
        company=request.company or "",
        days_until_interview=days_until_interview,
        detected_skills=ai_plan.detected_skills,
        plan_summary=ai_plan.plan_summary,
        plan_source="gemini",
        tasks=sorted(tasks, key=lambda task: (task.day, task.title)),
        hours_per_day=request.hours_per_day,
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
    # Plans are organized by preparation *dates*, not rounded 24-hour windows.
    # That keeps a plan for Aug 28 starting on Aug 17 (not Aug 16) regardless
    # of the time of day when the user creates it.
    return max(1, (interview_at.date() - now.date()).days)


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


def _blueprint_skills(blueprint: Optional[RoleBlueprint]) -> list[SkillSignal]:
    if blueprint is None:
        return []
    confidence = {"critical": 0.98, "important": 0.88, "supporting": 0.72}
    return [
        SkillSignal(name=item.name, confidence=confidence[item.priority])
        for item in blueprint.competencies[:10]
    ]


def _align_plan_to_blueprint(plan: PrepPlanResponse, blueprint: Optional[RoleBlueprint]) -> PrepPlanResponse:
    """Guarantee that the highest-priority role signals reach the saved plan."""

    if blueprint is None:
        repaired = _repair_plan_structure(plan, None)
        return repaired.model_copy(update={"quality_report": assess_prep_plan(repaired, None)})
    tasks = [task.model_copy(deep=True) for task in plan.tasks]
    covered = {topic.casefold() for task in tasks for topic in task.topics}
    candidates = [task for task in tasks if task.task_type in {PrepTaskType.study, PrepTaskType.coding, PrepTaskType.revision, PrepTaskType.diagnostic}]
    candidates = candidates or tasks
    for index, competency in enumerate(critical_competency_names(blueprint)):
        if competency.casefold() in covered or not candidates:
            continue
        target = candidates[index % len(candidates)]
        target.topics = [*target.topics, competency]
        target.instructions = f"{target.instructions.rstrip()} Cover {competency} because it is a high-priority requirement in the shared role blueprint."
        covered.add(competency.casefold())
    aligned = plan.model_copy(update={
        "detected_skills": _blueprint_skills(blueprint),
        "role_blueprint_version": blueprint.version,
        "tasks": tasks,
    })
    repaired = _repair_plan_structure(aligned, blueprint)
    return repaired.model_copy(update={"quality_report": assess_prep_plan(repaired, blueprint)})


def _repair_plan_structure(plan: PrepPlanResponse, blueprint: Optional[RoleBlueprint]) -> PrepPlanResponse:
    """Guarantee a paced learn-test-speak schedule across the complete timeline."""

    total_days = max(1, plan.days_until_interview)
    tasks = [task.model_copy(deep=True) for task in plan.tasks if 1 <= task.day <= total_days]
    topics = list(dict.fromkeys(
        [item.name for item in (blueprint.competencies if blueprint else [])]
        or [topic for task in tasks for topic in task.topics if topic]
        or ["Role fundamentals"]
    ))
    note_target = 3 if plan.hours_per_day >= 3 else 2 if plan.hours_per_day >= 1.25 else 1

    repaired: list[PrepTask] = []
    for day in range(1, total_days + 1):
        day_tasks = [task for task in tasks if task.day == day]
        difficulty = _difficulty_for_day(day, total_days)
        learning = [task for task in day_tasks if task.task_type in {PrepTaskType.study, PrepTaskType.coding, PrepTaskType.revision}]
        assessments = [task for task in day_tasks if task.task_type in {PrepTaskType.diagnostic, PrepTaskType.exam}]

        # Keep the day readable. Merge overflow topics into the visible learning tasks
        # instead of silently dropping useful AI-selected role coverage.
        kept_learning = learning[:max(note_target, min(3, len(learning)))]
        overflow_topics = [topic for task in learning[len(kept_learning):] for topic in task.topics]
        if kept_learning and overflow_topics:
            kept_learning[0].topics = list(dict.fromkeys([*kept_learning[0].topics, *overflow_topics]))
        while len(kept_learning) < note_target:
            index = len(kept_learning)
            topic = topics[((day - 1) * note_target + index) % len(topics)]
            kept_learning.append(PrepTask(
                day=day,
                title=_learning_title(topic, difficulty, index),
                task_type=PrepTaskType.study,
                duration_minutes=_note_duration(plan.hours_per_day, note_target),
                topics=[topic],
                instructions=_learning_instructions(topic, difficulty),
            ))
        for task in kept_learning:
            task.topics = task.topics or [topics[(day - 1) % len(topics)]]
            task.duration_minutes = _normalize_duration(task.duration_minutes)
            task.instructions = _with_difficulty_guidance(task.instructions, task.topics[0], difficulty)

        if not assessments:
            daily_topics = list(dict.fromkeys(topic for task in kept_learning for topic in task.topics)) or _topics_for_day(topics, day)
            assessments.append(PrepTask(
                day=day,
                title=f"Day {day} {difficulty} practice exam",
                task_type=PrepTaskType.diagnostic if day == 1 else PrepTaskType.exam,
                duration_minutes=_normalize_duration(25 if difficulty == "easy" else 35 if difficulty == "medium" else 45),
                topics=daily_topics,
                instructions=(
                    f"Test only Day {day}'s topics at {difficulty} difficulty, review every missed answer, "
                    "and use the result to choose the next revision target."
                ),
            ))
        for task in assessments:
            task.topics = task.topics or list(dict.fromkeys(topic for item in kept_learning for topic in item.topics)) or _topics_for_day(topics, day)
            task.instructions = _with_difficulty_guidance(task.instructions, task.topics[0], difficulty)

        repaired.extend([*kept_learning, *assessments[:1]])

    for index, mock_day in enumerate(_required_mock_days(total_days)):
        difficulty = _difficulty_for_day(mock_day, total_days)
        mock_topics = _topics_for_day(topics, mock_day) if index == 0 else topics[:6]
        repaired.append(PrepTask(
            day=mock_day,
            title="Midpoint interview checkpoint" if len(_required_mock_days(total_days)) > 1 and index == 0 else "Full role-specific mock interview",
            task_type=PrepTaskType.mock_interview,
            duration_minutes=_normalize_duration(35 if difficulty == "easy" else 50 if difficulty == "medium" else 60),
            topics=mock_topics,
            instructions=(
                f"Run a {difficulty} mock interview covering {', '.join(mock_topics[:5])}. Answer aloud, "
                "finish the full question set, then review scoring dimensions and weak answers."
            ),
        ))

    seen_titles: dict[str, int] = {}
    for task in sorted(repaired, key=lambda item: (item.day, _task_order(item.task_type), item.title)):
        key = task.title.casefold().strip()
        seen_titles[key] = seen_titles.get(key, 0) + 1
        if seen_titles[key] > 1:
            task.title = f"{task.title} — Day {task.day}, part {seen_titles[key]}"
        if len(task.instructions.strip()) < 40:
            task.instructions = (
                f"{task.instructions.rstrip()} Prepare a concrete example, a tradeoff, and a validation step for the interview."
            ).strip()
    return plan.model_copy(update={
        "tasks": sorted(repaired, key=lambda item: (item.day, _task_order(item.task_type), item.title)),
    })


def _difficulty_for_day(day: int, total_days: int) -> str:
    if total_days <= 1:
        return "medium"
    progress = (day - 1) / max(1, total_days - 1)
    if progress < 0.34:
        return "easy"
    if progress < 0.75:
        return "medium"
    return "hard"


def _required_mock_days(total_days: int) -> list[int]:
    if total_days <= 2:
        return [total_days]
    if total_days <= 5:
        return [max(2, total_days - 1)]
    midpoint = max(2, min(total_days - 2, round(total_days * 0.55)))
    return list(dict.fromkeys([midpoint, total_days - 1]))


def _learning_title(topic: str, difficulty: str, index: int) -> str:
    labels = {
        "easy": ["Foundation", "Core concepts", "Guided example"],
        "medium": ["Applied workflow", "Scenario practice", "Tradeoff review"],
        "hard": ["Interview-depth challenge", "Edge cases and failure modes", "Advanced decision practice"],
    }
    return f"{labels[difficulty][index % len(labels[difficulty])]}: {topic}"


def _learning_instructions(topic: str, difficulty: str) -> str:
    guidance = {
        "easy": "Learn the foundations, define the important terms, and work through one guided example.",
        "medium": "Apply the concept to a realistic job scenario, explain a tradeoff, and show how you would validate the result.",
        "hard": "Handle ambiguity, edge cases, failure modes, and follow-up questions while defending your decisions aloud.",
    }
    return f"Difficulty: {difficulty}. Study {topic}. {guidance[difficulty]} Connect the answer directly to the saved role."


def _with_difficulty_guidance(instructions: str, topic: str, difficulty: str) -> str:
    clean = re.sub(r"(?:Difficulty|Learning difficulty):\s*(?:easy|medium|hard)\.?\s*", "", instructions or "", flags=re.IGNORECASE).strip()
    return f"Difficulty: {difficulty}. {clean} {_learning_instructions(topic, difficulty).split('. ', 1)[1]}".strip()


def _note_duration(hours_per_day: float, note_count: int) -> int:
    daily_minutes = max(30, int(hours_per_day * 60))
    assessment_reserve = min(45, max(15, daily_minutes // 4))
    return _normalize_duration((daily_minutes - assessment_reserve) // max(1, note_count))


def _task_order(task_type: PrepTaskType) -> int:
    return {
        PrepTaskType.diagnostic: 0,
        PrepTaskType.study: 1,
        PrepTaskType.coding: 1,
        PrepTaskType.revision: 1,
        PrepTaskType.exam: 2,
        PrepTaskType.mock_interview: 3,
    }[task_type]
