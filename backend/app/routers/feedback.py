from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.feedback import ArtifactFeedbackRequest, ArtifactFeedbackResponse
from app.services.auth_service import get_request_user
from app.services.feedback_service import save_artifact_feedback
from app.services.usage_service import record_usage_event


router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=ArtifactFeedbackResponse)
def submit_artifact_feedback(
    request: ArtifactFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> ArtifactFeedbackResponse:
    feedback = save_artifact_feedback(db, request, current_user)
    if feedback is None:
        raise HTTPException(status_code=404, detail="Generated item not found")
    record_usage_event(
        db,
        current_user,
        "artifact_feedback_submitted",
        "generation_quality",
        provider="system",
        detail={
            "artifact_type": feedback.artifact_type,
            "artifact_id": feedback.artifact_id,
            "rating": feedback.rating,
            "job_post_id": feedback.job_post_id,
        },
    )
    return ArtifactFeedbackResponse.model_validate(feedback)
