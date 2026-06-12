from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class PrepTaskType(str, Enum):
    diagnostic = "diagnostic"
    study = "study"
    exam = "exam"
    coding = "coding"
    mock_interview = "mock_interview"
    revision = "revision"


class PrepPlanRequest(BaseModel):
    job_title: str = Field(default="Auto-detect role", min_length=2, examples=["Backend Software Engineer Intern"])
    job_description: Optional[str] = Field(default=None, min_length=20)
    source_url: Optional[str] = Field(default=None, examples=["https://company.com/jobs/backend-intern"])
    interview_at: datetime
    hours_per_day: float = Field(default=2.0, ge=0.5, le=10)
    comfort_level: str = Field(default="intermediate", examples=["beginner", "intermediate", "advanced"])

    @model_validator(mode="after")
    def require_description_or_url(self) -> "PrepPlanRequest":
        if not self.job_description and not self.source_url:
            raise ValueError("Provide either job_description or source_url.")
        return self


class SkillSignal(BaseModel):
    name: str
    confidence: float = Field(ge=0, le=1)


class PrepTask(BaseModel):
    id: Optional[int] = None
    day: int
    title: str
    task_type: PrepTaskType
    duration_minutes: int
    topics: list[str]
    instructions: str


class PrepPlanResponse(BaseModel):
    job_post_id: Optional[int] = None
    prep_plan_id: Optional[int] = None
    job_title: str
    days_until_interview: int
    detected_skills: list[SkillSignal]
    plan_summary: str
    plan_source: str = "heuristic"
    tasks: list[PrepTask]


class PrepPlanSummary(BaseModel):
    id: int
    job_post_id: int
    job_title: str
    days_until_interview: int
    task_count: int
    summary: str
