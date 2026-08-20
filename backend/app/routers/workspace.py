from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.workspace import ReadinessResponse, WorkspaceStateResponse, WorkspaceStateUpdate
from app.services.auth_service import get_request_user
from app.services.usage_service import record_usage_event
from app.services.workspace_service import WorkspaceConflictError, calculate_readiness, get_workspace_state, save_workspace_state


router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("", response_model=WorkspaceStateResponse)
def read_workspace(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> WorkspaceStateResponse:
    return get_workspace_state(db, current_user)


@router.put("", response_model=WorkspaceStateResponse)
def update_workspace(
    request: WorkspaceStateUpdate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> WorkspaceStateResponse:
    try:
        result = save_workspace_state(db, current_user, request.data, request.expected_updated_at, request.expected_revision)
    except WorkspaceConflictError as error:
        raise HTTPException(status_code=409, detail="Workspace changed in another session. Refresh before saving again.") from error
    record_usage_event(db, current_user, "workspace_synced", "workspace", provider="system")
    return result


@router.get("/readiness", response_model=ReadinessResponse)
def read_readiness(
    prep_plan_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> ReadinessResponse:
    readiness = calculate_readiness(db, current_user, prep_plan_id)
    if readiness is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    return readiness
