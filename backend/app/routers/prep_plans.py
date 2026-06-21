from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.prep_plan import PrepPlanRequest, PrepPlanResponse, PrepPlanSummary
from app.services.auth_service import get_request_user
from app.services.job_analyzer import identify_job
from app.services.job_source import resolve_job_description
from app.services.planner import generate_prep_plan
from app.services.persistence import delete_prep_plan, get_prep_plan_detail, list_prep_plans, save_prep_plan
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/prep-plans", tags=["prep plans"])


@router.post("", response_model=PrepPlanResponse)
def create_prep_plan(
    request: PrepPlanRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> PrepPlanResponse:
    description = resolve_job_description(request.job_description, request.source_url)
    inferred_title, inferred_company = identify_job(request.job_title, request.company, description, request.source_url, settings)
    plan_request = request.model_copy(update={"job_title": inferred_title, "company": inferred_company, "job_description": description})
    plan = generate_prep_plan(plan_request, settings)
    saved_plan = save_prep_plan(db, inferred_title, description, plan, source_url=request.source_url, company=inferred_company, user=current_user)
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
