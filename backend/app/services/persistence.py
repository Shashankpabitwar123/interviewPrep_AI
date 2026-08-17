from datetime import datetime
from hashlib import sha256
from typing import Optional

from sqlalchemy.orm import Session

from app.models import JobAnalysis, JobPost, PrepPlan, PrepTask, User
from app.schemas.job_analysis import JobAnalysisResponse, JobDescriptionBrief, JobPostDetail, JobPostSummary
from app.schemas.prep_plan import PrepPlanResponse, PrepPlanSummary, SkillSignal


def save_job_analysis(
    db: Session,
    title: str,
    description: str,
    analysis: JobAnalysisResponse,
    source_url: Optional[str] = None,
    company: str = "",
    user: Optional[User] = None,
    interview_at: Optional[datetime] = None,
    hours_per_day: Optional[float] = None,
    structured_brief: Optional[JobDescriptionBrief] = None,
) -> JobAnalysisResponse:
    """Save one analyzed job and return the same response with database IDs."""

    job_post = JobPost(
        title=title,
        company=company or None,
        description=description,
        source_url=source_url,
        user_id=user.id if user else None,
        interview_at=interview_at,
        hours_per_day=hours_per_day,
    )
    db.add(job_post)
    db.flush()

    db_analysis = JobAnalysis(
        job_post_id=job_post.id,
        seniority=analysis.seniority,
        required_skills=analysis.required_skills,
        interview_focus=[focus.model_dump() for focus in analysis.interview_focus],
        coding_difficulty=analysis.coding_difficulty,
        behavioral_themes=analysis.behavioral_themes,
        source=analysis.source,
        structured_brief=structured_brief.model_dump() if structured_brief else None,
        structured_brief_version=structured_brief.analysis_version if structured_brief else None,
        structured_brief_description_hash=_description_hash(description) if structured_brief else None,
    )
    db.add(db_analysis)
    db.commit()
    db.refresh(job_post)
    db.refresh(db_analysis)

    return analysis.model_copy(update={"job_post_id": job_post.id, "analysis_id": db_analysis.id, "company": company or analysis.company})


def save_prep_plan(
    db: Session,
    title: str,
    description: str,
    plan: PrepPlanResponse,
    source_url: Optional[str] = None,
    company: str = "",
    user: Optional[User] = None,
    interview_at: Optional[datetime] = None,
    hours_per_day: float = 2.0,
    job_post_id: Optional[int] = None,
) -> PrepPlanResponse:
    """Save a generated prep plan and every scheduled task."""

    job_post = db.get(JobPost, job_post_id) if job_post_id else None
    if job_post is not None and not _owns_job(job_post, user):
        job_post = None
    if job_post is None:
        job_post = JobPost(
            title=title,
            company=company or None,
            description=description,
            source_url=source_url,
            user_id=user.id if user else None,
            interview_at=interview_at,
            hours_per_day=hours_per_day,
        )
        db.add(job_post)
        db.flush()
    else:
        job_post.title = title
        job_post.company = company or job_post.company
        job_post.description = description
        job_post.source_url = source_url or job_post.source_url
        job_post.interview_at = interview_at or job_post.interview_at
        job_post.hours_per_day = hours_per_day

    db_plan = PrepPlan(
        job_post_id=job_post.id,
        days_until_interview=plan.days_until_interview,
        summary=plan.plan_summary,
    )
    db.add(db_plan)
    db.flush()

    saved_tasks: list[PrepTask] = []
    for task in plan.tasks:
        db_task = PrepTask(
            prep_plan_id=db_plan.id,
            day=task.day,
            title=task.title,
            task_type=task.task_type.value,
            duration_minutes=task.duration_minutes,
            topics=task.topics,
            instructions=task.instructions,
        )
        db.add(db_task)
        saved_tasks.append(db_task)

    db.commit()
    db.refresh(job_post)
    db.refresh(db_plan)
    for task in saved_tasks:
        db.refresh(task)

    response_tasks = [
        task.model_copy(update={"id": saved_task.id})
        for task, saved_task in zip(plan.tasks, saved_tasks)
    ]
    return plan.model_copy(
        update={
            "job_post_id": job_post.id,
            "prep_plan_id": db_plan.id,
            "company": company or plan.company,
            "tasks": response_tasks,
            "interview_at": job_post.interview_at,
            "hours_per_day": job_post.hours_per_day or hours_per_day,
        }
    )


def list_jobs(db: Session, user: Optional[User] = None) -> list[JobPostSummary]:
    query = db.query(JobPost)
    query = query.filter(JobPost.user_id == user.id) if user else query.filter(JobPost.user_id.is_(None))
    jobs = query.order_by(JobPost.created_at.desc()).all()
    return [
        JobPostSummary(
            id=job.id,
            title=job.title,
            company=job.company or "",
            description_preview=_preview(job.description),
            source_url=job.source_url,
            analysis_source=job.analysis.source if job.analysis else None,
            interview_at=job.interview_at,
            hours_per_day=job.hours_per_day,
        )
        for job in jobs
    ]


def get_job_detail(db: Session, job_post_id: int, user: Optional[User] = None) -> Optional[JobPostDetail]:
    job = db.get(JobPost, job_post_id)
    if job is None or not _owns_job(job, user):
        return None

    analysis = None
    if job.analysis:
        analysis = JobAnalysisResponse(
            job_post_id=job.id,
            analysis_id=job.analysis.id,
            role_title=job.title,
            company=job.company or "",
            seniority=job.analysis.seniority,
            required_skills=job.analysis.required_skills,
            interview_focus=job.analysis.interview_focus,
            coding_difficulty=job.analysis.coding_difficulty,
            behavioral_themes=job.analysis.behavioral_themes,
            source=job.analysis.source,
        )

    return JobPostDetail(
        id=job.id,
        title=job.title,
        company=job.company or "",
        description=job.description,
        source_url=job.source_url,
        analysis=analysis,
        interview_at=job.interview_at,
        hours_per_day=job.hours_per_day,
    )


def update_job_description(
    db: Session,
    job_post_id: int,
    description: str,
    user: Optional[User] = None,
) -> Optional[JobPostDetail]:
    """Update the saved job text and mark its analysis stale.

    The previous plan remains available, but the next plan-generation request
    or an explicit refresh will rebuild the structured analysis from the new
    source text.
    """

    job = db.get(JobPost, job_post_id)
    if job is None or not _owns_job(job, user):
        return None

    job.description = description.strip()
    if job.analysis:
        job.analysis.structured_brief = None
        job.analysis.structured_brief_version = None
        job.analysis.structured_brief_description_hash = None
    db.commit()
    db.refresh(job)
    return get_job_detail(db, job_post_id, user)


def delete_job(db: Session, job_post_id: int, user: Optional[User] = None) -> bool:
    job = db.get(JobPost, job_post_id)
    if job is None or not _owns_job(job, user):
        return False
    db.delete(job)
    db.commit()
    return True


def get_saved_job_brief(
    db: Session,
    job_post_id: int,
    user: Optional[User] = None,
) -> Optional[JobDescriptionBrief]:
    """Return the canonical analysis only when it matches the current job text."""

    job = db.get(JobPost, job_post_id)
    if job is None or not _owns_job(job, user) or not job.analysis:
        return None
    analysis = job.analysis
    if (
        not analysis.structured_brief
        or analysis.structured_brief_version != "v2"
        or analysis.structured_brief_description_hash != _description_hash(job.description)
    ):
        return None
    try:
        return JobDescriptionBrief.model_validate(analysis.structured_brief)
    except Exception:
        # A malformed legacy cache should never prevent a fresh structured
        # analysis from being generated.
        return None


def save_job_brief(
    db: Session,
    job_post_id: int,
    brief: JobDescriptionBrief,
    legacy_analysis: JobAnalysisResponse,
    user: Optional[User] = None,
) -> Optional[JobDescriptionBrief]:
    """Persist one canonical analysis and keep the compact planner fields in sync."""

    job = db.get(JobPost, job_post_id)
    if job is None or not _owns_job(job, user):
        return None

    analysis = job.analysis
    if analysis is None:
        analysis = JobAnalysis(job_post_id=job.id)
        db.add(analysis)

    analysis.seniority = legacy_analysis.seniority
    analysis.required_skills = legacy_analysis.required_skills
    analysis.interview_focus = [focus.model_dump() for focus in legacy_analysis.interview_focus]
    analysis.coding_difficulty = legacy_analysis.coding_difficulty
    analysis.behavioral_themes = legacy_analysis.behavioral_themes
    analysis.source = brief.source
    analysis.structured_brief = brief.model_dump()
    analysis.structured_brief_version = brief.analysis_version
    analysis.structured_brief_description_hash = _description_hash(job.description)
    db.commit()
    db.refresh(analysis)
    return JobDescriptionBrief.model_validate(analysis.structured_brief)


def list_prep_plans(db: Session, user: Optional[User] = None) -> list[PrepPlanSummary]:
    query = db.query(PrepPlan).join(JobPost)
    query = query.filter(JobPost.user_id == user.id) if user else query.filter(JobPost.user_id.is_(None))
    plans = query.order_by(PrepPlan.created_at.desc()).all()
    return [
        PrepPlanSummary(
            id=plan.id,
            job_post_id=plan.job_post_id,
            job_title=plan.job_post.title,
            company=plan.job_post.company or "",
            days_until_interview=plan.days_until_interview,
            task_count=len(plan.tasks),
            summary=plan.summary,
            interview_at=plan.job_post.interview_at,
            hours_per_day=plan.job_post.hours_per_day or 2.0,
        )
        for plan in plans
    ]


def get_prep_plan_detail(db: Session, prep_plan_id: int, user: Optional[User] = None) -> Optional[PrepPlanResponse]:
    plan = db.get(PrepPlan, prep_plan_id)
    if plan is None or not _owns_job(plan.job_post, user):
        return None

    tasks = [
        {
            "id": task.id,
            "day": task.day,
            "title": task.title,
            "task_type": task.task_type,
            "duration_minutes": task.duration_minutes,
            "topics": task.topics,
            "instructions": task.instructions,
            "status": task.status,
        }
        for task in sorted(plan.tasks, key=lambda task: (task.day, task.id))
    ]

    return PrepPlanResponse(
        job_post_id=plan.job_post_id,
        prep_plan_id=plan.id,
        job_title=plan.job_post.title,
        company=plan.job_post.company or "",
        days_until_interview=plan.days_until_interview,
        detected_skills=[SkillSignal(name=topic, confidence=1.0) for topic in _topics_from_tasks(plan.tasks)],
        plan_summary=plan.summary,
        plan_source="saved",
        tasks=tasks,
        interview_at=plan.job_post.interview_at,
        hours_per_day=plan.job_post.hours_per_day or 2.0,
    )


def delete_prep_plan(db: Session, prep_plan_id: int, user: Optional[User] = None) -> bool:
    plan = db.get(PrepPlan, prep_plan_id)
    if plan is None or not _owns_job(plan.job_post, user):
        return False
    db.delete(plan)
    db.commit()
    return True


def _preview(text: str, limit: int = 120) -> str:
    return text if len(text) <= limit else f"{text[:limit].rstrip()}..."


def _description_hash(description: str) -> str:
    normalized = " ".join((description or "").split())
    return sha256(normalized.encode("utf-8")).hexdigest()


def _topics_from_tasks(tasks: list[PrepTask]) -> list[str]:
    seen: list[str] = []
    for task in tasks:
        for topic in task.topics:
            if topic not in seen:
                seen.append(topic)
    return seen[:8]


def _owns_job(job: JobPost, user: Optional[User]) -> bool:
    if user:
        return job.user_id == user.id
    return job.user_id is None
