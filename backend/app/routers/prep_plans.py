from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.prep_plan import PrepPlanRequest, PrepPlanResponse, PrepPlanSummary, PrepTaskStatusUpdate
from app.services.auth_service import get_request_user
from app.services.job_analyzer import analysis_from_job_brief, build_job_description_brief
from app.services.job_source import resolve_job_description
from app.services.planner import generate_prep_plan
from app.services.persistence import (
    delete_prep_plan,
    get_job_detail,
    get_prep_plan_detail,
    get_saved_job_brief,
    list_prep_plans,
    save_job_brief,
    save_prep_plan,
)
from app.models import PrepTask
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/prep-plans", tags=["prep plans"])


@router.post("", response_model=PrepPlanResponse)
def create_prep_plan(
    request: PrepPlanRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> PrepPlanResponse:
    existing_job = get_job_detail(db, request.job_post_id, current_user) if request.job_post_id else None
    if request.job_post_id and existing_job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    description = existing_job.description if existing_job and not request.job_description and not request.source_url else resolve_job_description(request.job_description, request.source_url)
    source_url = request.source_url or (existing_job.source_url if existing_job else None)
    requested_title = request.job_title if request.job_title != "Auto-detect role" else (existing_job.title if existing_job else request.job_title)
    requested_company = request.company if request.company != "Auto-detect company" else (existing_job.company if existing_job else request.company)
    # A new plan always receives the fixed job analysis in this same request.
    # Existing current analysis is reused, so "generate plan" does not spend
    # time or provider calls rebuilding information the user already has.
    brief = get_saved_job_brief(db, request.job_post_id, current_user) if request.job_post_id else None
    if brief is None:
        brief = build_job_description_brief(requested_title, description, source_url, settings)
    title_is_auto = request.job_title.strip().lower() in {"auto-detect role", "auto detect role"}
    company_is_auto = (request.company or "").strip().lower() in {"", "auto-detect company", "auto detect company"}
    inferred_title = brief.role_title if title_is_auto and brief.role_title else requested_title
    inferred_company = brief.company if company_is_auto and brief.company else (requested_company or "")
    plan_request = request.model_copy(update={"job_title": inferred_title, "company": inferred_company, "job_description": description, "source_url": source_url})
    plan = generate_prep_plan(plan_request, settings)
    saved_plan = save_prep_plan(
        db,
        inferred_title,
        description,
        plan,
        source_url=source_url,
        company=inferred_company,
        user=current_user,
        interview_at=request.interview_at,
        hours_per_day=request.hours_per_day,
        job_post_id=request.job_post_id,
    )
    stored_brief = save_job_brief(
        db,
        saved_plan.job_post_id,
        brief.model_copy(update={"role_title": inferred_title, "company": inferred_company or brief.company}),
        analysis_from_job_brief(brief).model_copy(update={"role_title": inferred_title, "company": inferred_company or brief.company}),
        current_user,
    )
    if stored_brief is None:
        raise HTTPException(status_code=404, detail="Job not found")
    record_usage_event(
        db,
        current_user,
        "prep_plan_generated",
        "prep_plans",
        settings=settings,
        input_value=plan_request.model_dump(),
        output_value=saved_plan.model_dump(),
        detail={"prep_plan_id": saved_plan.prep_plan_id, "job_post_id": saved_plan.job_post_id, "title": inferred_title},
    )
    return saved_plan


@router.patch("/tasks/{task_id}", response_model=dict)
def update_task_status(
    task_id: int,
    request: PrepTaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> dict:
    task = db.get(PrepTask, task_id)
    if task is None or get_prep_plan_detail(db, task.prep_plan_id, current_user) is None:
        raise HTTPException(status_code=404, detail="Prep task not found")
    task.status = request.status
    db.commit()
    return {"task_id": task.id, "status": task.status}


@router.get("", response_model=list[PrepPlanSummary])
def get_prep_plans(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> list[PrepPlanSummary]:
    return list_prep_plans(db, current_user)


@router.get("/{prep_plan_id}", response_model=PrepPlanResponse)
def get_prep_plan(
    prep_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> PrepPlanResponse:
    plan = get_prep_plan_detail(db, prep_plan_id, current_user)
    if plan is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    return plan


@router.delete("/{prep_plan_id}", status_code=204)
def remove_prep_plan(
    prep_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> None:
    deleted = delete_prep_plan(db, prep_plan_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    record_usage_event(
        db,
        current_user,
        "prep_plan_deleted",
        "prep_plans",
        provider="system",
        detail={"prep_plan_id": prep_plan_id},
    )
