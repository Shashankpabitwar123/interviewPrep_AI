from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.prep_plan import PrepPlanRequest, PrepPlanResponse, PrepPlanSummary
from app.services.auth_service import get_request_user
from app.services.job_analyzer import infer_role_title
from app.services.job_source import resolve_job_description
from app.services.planner import generate_prep_plan
from app.services.persistence import delete_prep_plan, get_prep_plan_detail, list_prep_plans, save_prep_plan

router = APIRouter(prefix="/prep-plans", tags=["prep plans"])


@router.post("", response_model=PrepPlanResponse)
def create_prep_plan(
    request: PrepPlanRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> PrepPlanResponse:
    description = resolve_job_description(request.job_description, request.source_url)
    inferred_title = infer_role_title(request.job_title, description, request.source_url)
    plan_request = request.model_copy(update={"job_title": inferred_title, "job_description": description})
    plan = generate_prep_plan(plan_request, settings)
    return save_prep_plan(db, inferred_title, description, plan, source_url=request.source_url, user=current_user)


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
