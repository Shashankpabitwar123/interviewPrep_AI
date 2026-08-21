import re
from typing import Any, Iterable, Optional

from app.schemas.prep_plan import PrepPlanResponse
from app.schemas.role_intelligence import RoleBlueprint
from app.schemas.study_note import StudyNoteResponse


QUALITY_REPORT_VERSION = "v1"


def assess_prep_plan(plan: PrepPlanResponse, blueprint: Optional[RoleBlueprint]) -> dict:
    tasks = list(plan.tasks)
    expected_days = set(range(1, max(1, plan.days_until_interview) + 1))
    actual_days = {task.day for task in tasks}
    topics = {_key(topic) for task in tasks for topic in task.topics if _key(topic)}
    critical = [item.name for item in (blueprint.competencies if blueprint else []) if item.priority == "critical"]
    missing_critical = [name for name in critical if _key(name) not in topics]
    duplicate_titles = _duplicates(task.title for task in tasks)
    detailed_tasks = [task for task in tasks if len(task.instructions.strip()) >= 40 and task.topics]
    assessment_days = {task.day for task in tasks if task.task_type.value in {"diagnostic", "exam"}}
    mock_tasks = [task for task in tasks if task.task_type.value == "mock_interview"]
    expected_mock_count = 2 if plan.days_until_interview >= 6 else 1
    difficulty_by_day = {
        day: _instruction_difficulty(next((task.instructions for task in tasks if task.day == day and task.task_type.value in {"study", "coding", "revision"}), ""))
        for day in expected_days
    }
    difficulty_ranks = [{"easy": 1, "medium": 2, "hard": 3}.get(difficulty_by_day[day], 0) for day in sorted(expected_days)]
    progressive = all(rank > 0 for rank in difficulty_ranks) and difficulty_ranks == sorted(difficulty_ranks)
    gates = [
        _gate("complete_timeline", expected_days <= actual_days, 20, f"{len(actual_days)} of {len(expected_days)} preparation days have work"),
        _gate("critical_competency_coverage", not missing_critical, 20, "All critical role competencies are scheduled" if not missing_critical else f"Missing: {', '.join(missing_critical[:5])}"),
        _gate("actionable_tasks", len(detailed_tasks) == len(tasks), 10, f"{len(detailed_tasks)} of {len(tasks)} tasks have topics and usable instructions"),
        _gate("daily_assessment_loop", expected_days <= assessment_days, 15, f"{len(assessment_days)} of {len(expected_days)} preparation days end with an assessment"),
        _gate("mock_interview_schedule", len(mock_tasks) >= expected_mock_count, 15, f"{len(mock_tasks)} of {expected_mock_count} required mock interviews are scheduled"),
        _gate("progressive_difficulty", progressive, 10, f"Daily learning difficulty: {', '.join(difficulty_by_day[day] or 'missing' for day in sorted(expected_days))}"),
        _gate("no_duplicate_tasks", not duplicate_titles, 10, "Task titles are distinct" if not duplicate_titles else f"Repeated: {', '.join(duplicate_titles[:4])}"),
    ]
    return _report("prep_plan", gates, {
        "task_count": len(tasks),
        "missing_critical_competencies": missing_critical,
    })


def assess_study_note(
    note: StudyNoteResponse,
    requested_topics: list[str],
    blueprint: Optional[RoleBlueprint],
) -> dict:
    combined_sections = [*note.sections, *note.deep_dive]
    normalized_titles = " ".join(section.title.casefold() for section in combined_sections)
    requested = [_key(topic) for topic in requested_topics if _key(topic)]
    covered = {_key(topic) for topic in note.topics if _key(topic)}
    body_words = len(re.findall(r"\b[\w'-]+\b", " ".join(
        [note.summary, *(section.body for section in combined_sections), *(bullet for section in combined_sections for bullet in section.bullets)]
    )))
    section_names = [section.title for section in combined_sections]
    duplicate_sections = _duplicates(section_names)
    source_ids = {source.source_id for source in note.web_research if source.source_id}
    valid_sources = [
        source for source in note.web_research
        if source.url.startswith(("https://", "http://")) and source.summary.strip()
    ]
    role_specific = bool(note.role.strip()) and (
        note.role.casefold() in note.subtitle.casefold()
        or note.role.casefold() in note.summary.casefold()
        or any(competency.name.casefold() in normalized_titles for competency in (blueprint.competencies if blueprint else []))
    )
    required_angles = {
        "interview": "interview" in normalized_titles or bool(note.interview_questions),
        "mistakes": "mistake" in normalized_titles,
        "explanation": "explain" in normalized_titles or "key" in normalized_titles,
    }
    missing_topics = [topic for topic in requested if topic not in covered]
    gates = [
        _gate("requested_scope", not missing_topics, 20, "The note stays inside the requested topics" if not missing_topics else f"Missing topics: {', '.join(missing_topics[:5])}"),
        _gate("role_specific", role_specific, 20, "Content is connected to the saved role"),
        _gate("instructional_depth", body_words >= 450 and len(note.deep_dive) >= 1, 20, f"{body_words} instructional words and {len(note.deep_dive)} deep-dive sections"),
        _gate("interview_application", all(required_angles.values()) and len(note.interview_questions) >= 3, 20, f"{len(note.interview_questions)} interview questions plus explanation and mistakes guidance"),
        _gate("readiness_check", len(note.checklist) >= 4, 10, f"{len(note.checklist)} readiness checks"),
        _gate("source_integrity", len(valid_sources) == len(note.web_research) and len(source_ids) == len([source for source in note.web_research if source.source_id]), 5, f"{len(valid_sources)} traceable research sources"),
        _gate("no_duplicate_sections", not duplicate_sections, 5, "Sections are distinct" if not duplicate_sections else f"Repeated: {', '.join(duplicate_sections[:4])}"),
    ]
    return _report("study_note", gates, {
        "section_count": len(note.sections),
        "deep_dive_count": len(note.deep_dive),
        "interview_question_count": len(note.interview_questions),
        "word_count": body_words,
    })


def assess_mock_plan(session_plan: list[dict], expected_count: int, blueprint: Optional[RoleBlueprint]) -> dict:
    numbered = [item for item in session_plan if item.get("number")]
    complete = [
        item for item in session_plan
        if item.get("topic") and item.get("competency") and item.get("intent") and len(item.get("rubric") or []) >= 5
    ]
    combinations = [f"{_key(item.get('competency'))}:{_key(item.get('question_type'))}" for item in session_plan]
    unique_ratio = len(set(combinations)) / len(combinations) if combinations else 0
    priorities = {_key(item.name): item.priority for item in (blueprint.competencies if blueprint else [])}
    critical_available = {key for key, priority in priorities.items() if priority == "critical"}
    covered = {_key(item.get("competency")) for item in session_plan}
    critical_target = min(len(critical_available), expected_count)
    critical_covered = len(critical_available & covered)
    gates = [
        _gate("question_count", len(session_plan) == expected_count and len(numbered) == expected_count, 30, f"{len(session_plan)} of {expected_count} question slots planned"),
        _gate("scoring_rubrics", len(complete) == len(session_plan), 30, f"{len(complete)} of {len(session_plan)} slots have intent and scoring dimensions"),
        _gate("role_priority_coverage", critical_covered >= critical_target or not critical_available, 25, f"{critical_covered} high-priority competencies covered"),
        _gate("varied_interview", unique_ratio >= 0.5 or len(session_plan) <= 2, 15, f"{round(unique_ratio * 100)}% distinct competency and question-type combinations"),
    ]
    return _report("mock_interview", gates, {
        "planned_questions": len(session_plan),
        "critical_competencies_covered": critical_covered,
    })


def question_text_is_usable(question: str) -> bool:
    text = re.sub(r"\s+", " ", question or "").strip()
    return len(text) >= 35 and "?" in text and not any(
        placeholder in text.casefold()
        for placeholder in ("insert question", "your question here", "placeholder")
    )


def choose_higher_quality(first: StudyNoteResponse, second: StudyNoteResponse) -> StudyNoteResponse:
    first_score = int((first.quality_report or {}).get("score") or 0)
    second_score = int((second.quality_report or {}).get("score") or 0)
    return second if second_score > first_score else first


def report_from_issues(artifact_type: str, issues: list[dict], *, metadata: Optional[dict] = None) -> dict:
    issue_count = len(issues)
    score = max(0, 100 - issue_count * 12)
    return {
        "version": QUALITY_REPORT_VERSION,
        "artifact_type": artifact_type,
        "passed": issue_count == 0,
        "score": score,
        "issue_count": issue_count,
        "issues": issues,
        "gates": [],
        **(metadata or {}),
    }


def _report(artifact_type: str, gates: list[dict], metadata: Optional[dict] = None) -> dict:
    score = round(sum(gate["weight"] for gate in gates if gate["passed"]))
    issues = [
        {"type": gate["key"], "detail": gate["detail"]}
        for gate in gates
        if not gate["passed"]
    ]
    return {
        "version": QUALITY_REPORT_VERSION,
        "artifact_type": artifact_type,
        "passed": score >= 75 and not any(not gate["passed"] and gate["weight"] >= 25 for gate in gates),
        "score": score,
        "issue_count": len(issues),
        "issues": issues,
        "gates": gates,
        **(metadata or {}),
    }


def _gate(key: str, passed: bool, weight: int, detail: str) -> dict:
    return {"key": key, "passed": bool(passed), "weight": weight, "detail": detail}


def _key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()


def _duplicates(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    duplicates: list[str] = []
    for value in values:
        key = _key(value)
        if not key:
            continue
        if key in seen and value not in duplicates:
            duplicates.append(value)
        seen.add(key)
    return duplicates


def _instruction_difficulty(instructions: str) -> str:
    match = re.search(r"difficulty:\s*(easy|medium|hard)", instructions or "", flags=re.IGNORECASE)
    return match.group(1).casefold() if match else ""
