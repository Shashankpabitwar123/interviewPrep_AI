from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class WorkspaceStateUpdate(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class WorkspaceStateResponse(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    updated_at: Optional[datetime] = None


class ReadinessComponent(BaseModel):
    key: str
    label: str
    score: int = Field(ge=0, le=100)
    weight: float = Field(ge=0, le=1)
    detail: str


class ReadinessResponse(BaseModel):
    prep_plan_id: int
    job_post_id: int
    score: int = Field(ge=0, le=100)
    label: str
    formula: str
    components: list[ReadinessComponent]
    strengths: list[str] = Field(default_factory=list)
    needs_work: list[str] = Field(default_factory=list)
    next_action: str
