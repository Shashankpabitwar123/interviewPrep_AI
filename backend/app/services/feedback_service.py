from typing import Optional

from sqlalchemy.orm import Session

from app.models import ArtifactFeedback, Exam, JobPost, MockInterview, PrepPlan, User
from app.schemas.feedback import ArtifactFeedbackRequest


def save_artifact_feedback(
    db: Session,
    request: ArtifactFeedbackRequest,
    user: Optional[User],
) -> Optional[ArtifactFeedback]:
    resolved = _resolve_scope(db, request, user)
    if resolved is None:
        return None
    job, plan = resolved
    query = db.query(ArtifactFeedback).filter(
        ArtifactFeedback.job_post_id == job.id,
        ArtifactFeedback.artifact_type == request.artifact_type,
        ArtifactFeedback.artifact_id == request.artifact_id,
    )
    query = query.filter(ArtifactFeedback.user_id == user.id) if user else query.filter(ArtifactFeedback.user_id.is_(None))
    feedback = query.first()
    if feedback is None:
        feedback = ArtifactFeedback(
            user_id=user.id if user else None,
            job_post_id=job.id,
            prep_plan_id=plan.id if plan else None,
            artifact_type=request.artifact_type,
            artifact_id=request.artifact_id,
        )
        db.add(feedback)
    feedback.rating = request.rating
    feedback.reason = (request.reason or "").strip() or None
    feedback.detail = request.detail or {}
    db.commit()
    db.refresh(feedback)
    return feedback


def _resolve_scope(
    db: Session,
    request: ArtifactFeedbackRequest,
    user: Optional[User],
) -> Optional[tuple[JobPost, Optional[PrepPlan]]]:
    plan: Optional[PrepPlan] = None
    job: Optional[JobPost] = None
    try:
        numeric_artifact_id = int(request.artifact_id)
    except (TypeError, ValueError):
        numeric_artifact_id = None

    if request.artifact_type == "exam" and numeric_artifact_id is not None:
        exam = db.get(Exam, numeric_artifact_id)
        plan = exam.prep_plan if exam else None
    elif request.artifact_type == "mock_interview" and numeric_artifact_id is not None:
        interview = db.get(MockInterview, numeric_artifact_id)
        plan = interview.prep_plan if interview else None
    elif request.artifact_type == "prep_plan" and numeric_artifact_id is not None:
        plan = db.get(PrepPlan, numeric_artifact_id)
    elif request.prep_plan_id is not None:
        plan = db.get(PrepPlan, request.prep_plan_id)

    if plan is not None:
        job = plan.job_post
    elif request.job_post_id is not None:
        job = db.get(JobPost, request.job_post_id)
    if job is None or job.user_id != (user.id if user else None):
        return None
    if request.artifact_type in {"prep_plan", "study_note", "exam", "mock_interview"} and plan is None:
        return None
    return job, plan
