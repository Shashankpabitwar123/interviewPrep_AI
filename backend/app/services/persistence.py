from typing import Optional

from sqlalchemy.orm import Session

from app.models import JobAnalysis, JobPost, PrepPlan, PrepTask, User
from app.schemas.job_analysis import JobAnalysisResponse, JobPostDetail, JobPostSummary
from app.schemas.prep_plan import PrepPlanResponse, PrepPlanSummary, SkillSignal


def save_job_analysis(
    db: Session,
    title: str,
    description: str,
    analysis: JobAnalysisResponse,
    source_url: Optional[str] = None,
    company: str = "",
    user: Optional[User] = None,
) -> JobAnalysisResponse:
    """Save one analyzed job and return the same response with database IDs."""

    job_post = JobPost(title=title, company=company or None, description=description, source_url=source_url, user_id=user.id if user else None)
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
) -> PrepPlanResponse:
    """Save a generated prep plan and every scheduled task."""

    job_post = JobPost(title=title, company=company or None, description=description, source_url=source_url, user_id=user.id if user else None)
    db.add(job_post)
    db.flush()

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
    )


def delete_job(db: Session, job_post_id: int, user: Optional[User] = None) -> bool:
    job = db.get(JobPost, job_post_id)
    if job is None or not _owns_job(job, user):
        return False
    db.delete(job)
    db.commit()
    return True


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
