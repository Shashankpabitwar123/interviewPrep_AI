from typing import Optional

from pydantic import BaseModel, Field, model_validator


class JobAnalysisRequest(BaseModel):
    job_title: str = Field(default="Auto-detect role", min_length=2, examples=["Backend Software Engineer Intern"])
    job_description: Optional[str] = Field(default=None, min_length=20)
    source_url: Optional[str] = Field(default=None, examples=["https://company.com/jobs/backend-intern"])
    save_mode: Optional[str] = Field(default=None, examples=["url"])

    @model_validator(mode="after")
    def require_description_or_url(self) -> "JobAnalysisRequest":
        if not self.job_description and not self.source_url:
            raise ValueError("Provide either job_description or source_url.")
        return self


class InterviewFocus(BaseModel):
    category: str
    topics: list[str]


class JobAnalysisResponse(BaseModel):
    job_post_id: Optional[int] = None
    analysis_id: Optional[int] = None
    role_title: str
    seniority: str
    required_skills: list[str]
    interview_focus: list[InterviewFocus]
    coding_difficulty: str
    behavioral_themes: list[str]
    source: str


class JobPostSummary(BaseModel):
    id: int
    title: str
    description_preview: str
    source_url: Optional[str] = None
    analysis_source: Optional[str] = None


class JobPostDetail(BaseModel):
    id: int
    title: str
    description: str
    source_url: Optional[str] = None
    analysis: Optional[JobAnalysisResponse] = None
