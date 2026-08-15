from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import PrepPlan, User, WorkspaceState
from app.schemas.workspace import ReadinessComponent, ReadinessResponse, WorkspaceStateResponse


READINESS_FORMULA = "30% plan + 20% learning + 25% exams + 20% mock interviews + 5% consistency"


def get_workspace_state(db: Session, user: Optional[User]) -> WorkspaceStateResponse:
    state = _workspace_record(db, user)
    return WorkspaceStateResponse(data=state.data if state else {}, updated_at=state.updated_at if state else None)


def save_workspace_state(db: Session, user: Optional[User], data: dict[str, Any]) -> WorkspaceStateResponse:
    state = _workspace_record(db, user)
    if state is None:
        state = WorkspaceState(user_id=user.id if user else None, data=data)
        db.add(state)
    else:
        state.data = data
    db.commit()
    db.refresh(state)
    return WorkspaceStateResponse(data=state.data or {}, updated_at=state.updated_at)


def calculate_readiness(
    db: Session,
    user: Optional[User],
    prep_plan_id: Optional[int] = None,
) -> Optional[ReadinessResponse]:
    query = db.query(PrepPlan).join(PrepPlan.job_post)
    query = query.filter(PrepPlan.job_post.has(user_id=user.id)) if user else query.filter(PrepPlan.job_post.has(user_id=None))
    if prep_plan_id is not None:
        query = query.filter(PrepPlan.id == prep_plan_id)
    plan = query.order_by(PrepPlan.created_at.desc()).first()
    if plan is None:
        return None

    workspace = _workspace_record(db, user)
    state = (workspace.data or {}) if workspace else {}
    completed_task_keys = state.get("completedTasks") or state.get("completed_tasks") or {}
    tasks = list(plan.tasks)
    completed_tasks = [task for task in tasks if _task_is_complete(task.id, task.status, completed_task_keys)]
    plan_score = _percentage(len(completed_tasks), len(tasks))

    learning_tasks = [task for task in tasks if task.task_type not in {"exam", "practice_exam", "mock_interview"}]
    completed_learning = [task for task in learning_tasks if _task_is_complete(task.id, task.status, completed_task_keys)]
    learning_score = _percentage(len(completed_learning), len(learning_tasks))

    exam_scores = [_exam_score(exam) for exam in plan.exams]
    exam_scores = [score for score in exam_scores if score is not None]
    exam_score = round(sum(exam_scores) / len(exam_scores)) if exam_scores else 0

    mock_scores = [round(float(mock.average_score) * 100) for mock in plan.mock_interviews if mock.average_score is not None]
    mock_score = round(sum(mock_scores) / len(mock_scores)) if mock_scores else 0

    consistency_score = _consistency_score(state, completed_tasks, plan)

    components = [
        ReadinessComponent(key="plan", label="Plan completion", score=plan_score, weight=0.30, detail=f"{len(completed_tasks)} of {len(tasks)} tasks complete"),
        ReadinessComponent(key="learning", label="Learning", score=learning_score, weight=0.20, detail=f"{len(completed_learning)} of {len(learning_tasks)} learning tasks complete"),
        ReadinessComponent(key="exams", label="Exam performance", score=exam_score, weight=0.25, detail=f"{len(exam_scores)} scored exam{'s' if len(exam_scores) != 1 else ''}"),
        ReadinessComponent(key="mocks", label="Mock interviews", score=mock_score, weight=0.20, detail=f"{len(mock_scores)} scored mock interview{'s' if len(mock_scores) != 1 else ''}"),
        ReadinessComponent(key="consistency", label="Consistency", score=consistency_score, weight=0.05, detail="Active preparation days during the last week"),
    ]
    score = round(sum(component.score * component.weight for component in components))
    ordered = sorted(components, key=lambda component: component.score)
    strengths = [component.label for component in components if component.score >= 70]
    needs_work = [component.label for component in ordered if component.score < 60]
    return ReadinessResponse(
        prep_plan_id=plan.id,
        job_post_id=plan.job_post_id,
        score=score,
        label=_readiness_label(score),
        formula=READINESS_FORMULA,
        components=components,
        strengths=strengths,
        needs_work=needs_work,
        next_action=_next_action(ordered[0], plan),
    )


def _workspace_record(db: Session, user: Optional[User]) -> Optional[WorkspaceState]:
    query = db.query(WorkspaceState)
    return query.filter(WorkspaceState.user_id == user.id).first() if user else query.filter(WorkspaceState.user_id.is_(None)).first()


def _task_is_complete(task_id: int, status: str, completed_task_keys: dict[str, Any]) -> bool:
    if status == "complete":
        return True
    suffix = f":task:{task_id}"
    return any(str(key).endswith(suffix) and bool(value) for key, value in completed_task_keys.items())


def _exam_score(exam) -> Optional[int]:
    if not exam.questions:
        return None
    latest_scores: list[float] = []
    has_attempt = False
    for question in exam.questions:
        attempts = sorted(question.attempts, key=lambda attempt: attempt.id)
        if attempts:
            has_attempt = True
            latest_scores.append(float(attempts[-1].score or 0))
        else:
            latest_scores.append(0.0)
    return round((sum(latest_scores) / len(exam.questions)) * 100) if has_attempt else None


def _consistency_score(state: dict[str, Any], completed_tasks: list, plan: PrepPlan) -> int:
    today = datetime.now(timezone.utc).date()
    cutoff = today - timedelta(days=6)
    active_days: set = set()
    for item in state.get("recentActivity") or state.get("recent_activity") or []:
        raw = item.get("createdAt") or item.get("created_at")
        parsed = _parse_datetime(raw)
        if parsed and cutoff <= parsed.date() <= today:
            active_days.add(parsed.date())
    for task in completed_tasks:
        parsed = task.updated_at
        if parsed and cutoff <= parsed.date() <= today:
            active_days.add(parsed.date())
    for exam in plan.exams:
        for question in exam.questions:
            for attempt in question.attempts:
                if attempt.created_at and cutoff <= attempt.created_at.date() <= today:
                    active_days.add(attempt.created_at.date())
    return min(100, round((len(active_days) / 7) * 100))


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _percentage(done: int, total: int) -> int:
    return round((done / total) * 100) if total else 0


def _readiness_label(score: int) -> str:
    if score >= 85:
        return "Interview ready"
    if score >= 65:
        return "Solid progress"
    if score >= 40:
        return "Building momentum"
    return "Needs a focused start"


def _next_action(lowest: ReadinessComponent, plan: PrepPlan) -> str:
    actions = {
        "plan": "Complete the next unfinished task in your preparation plan.",
        "learning": "Finish the next learning note, then mark the task complete.",
        "exams": "Take a focused exam for the topics you studied most recently.",
        "mocks": "Run a mock interview and answer every question aloud.",
        "consistency": "Schedule one focused preparation block today.",
    }
    return actions.get(lowest.key, f"Continue the next task for {plan.job_post.title}.")
