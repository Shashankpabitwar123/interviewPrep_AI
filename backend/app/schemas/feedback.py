from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


ArtifactType = Literal["job_analysis", "prep_plan", "study_note", "exam", "mock_interview"]
ArtifactRating = Literal["helpful", "needs_work"]


class ArtifactFeedbackRequest(BaseModel):
    artifact_type: ArtifactType
    artifact_id: str = Field(min_length=1, max_length=180)
    rating: ArtifactRating
    job_post_id: Optional[int] = None
    prep_plan_id: Optional[int] = None
    reason: Optional[str] = Field(default=None, max_length=1000)
    detail: dict = Field(default_factory=dict)


class ArtifactFeedbackResponse(BaseModel):
    id: int
    artifact_type: str
    artifact_id: str
    rating: str
    job_post_id: int
    prep_plan_id: Optional[int] = None
    reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
