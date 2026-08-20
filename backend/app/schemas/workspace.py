from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class WorkspaceStateUpdate(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    expected_updated_at: Optional[datetime] = None
    expected_revision: Optional[int] = Field(default=None, ge=0)


class WorkspaceStateResponse(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    updated_at: Optional[datetime] = None


class ReadinessComponent(BaseModel):
    key: str
    label: str
    score: int = Field(ge=0, le=100)
    weight: float = Field(ge=0, le=1)
    detail: str


class CompetencyProgress(BaseModel):
    key: str
    name: str
    category: str = "other"
    priority: str = "important"
    score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    evidence_count: int = 0
    source_types: list[str] = Field(default_factory=list)
    last_practiced_at: Optional[datetime] = None
    why_it_matters: str = ""
    next_action: str


class LearningAction(BaseModel):
    competency_key: str
    competency_name: str
    action_type: str
    title: str
    detail: str


class LearningStateResponse(BaseModel):
    prep_plan_id: int
    job_post_id: int
    overall_mastery: int = Field(ge=0, le=100)
    evidence_count: int = 0
    competencies: list[CompetencyProgress] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    focus_areas: list[str] = Field(default_factory=list)
    next_actions: list[LearningAction] = Field(default_factory=list)


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
    competency_mastery: int = Field(default=0, ge=0, le=100)
    competencies: list[CompetencyProgress] = Field(default_factory=list)
    next_actions: list[LearningAction] = Field(default_factory=list)
