from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class JobAnalysisRequest(BaseModel):
    job_title: str = Field(default="Auto-detect role", min_length=2, examples=["Backend Software Engineer Intern"])
    company: Optional[str] = Field(default="Auto-detect company", examples=["Amazon"])
    job_description: Optional[str] = Field(default=None, min_length=20)
    source_url: Optional[str] = Field(default=None, examples=["https://company.com/jobs/backend-intern"])
    save_mode: Optional[str] = Field(default=None, examples=["url"])
    interview_at: Optional[datetime] = None
    hours_per_day: Optional[float] = Field(default=None, ge=0.5, le=10)

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
    company: str = ""
    seniority: str
    required_skills: list[str]
    interview_focus: list[InterviewFocus]
    coding_difficulty: str
    behavioral_themes: list[str]
    source: str


class JobPostSummary(BaseModel):
    id: int
    title: str
    company: str = ""
    description_preview: str
    source_url: Optional[str] = None
    analysis_source: Optional[str] = None
    interview_at: Optional[datetime] = None
    hours_per_day: Optional[float] = None


class JobPostDetail(BaseModel):
    id: int
    title: str
    company: str = ""
    description: str
    source_url: Optional[str] = None
    analysis: Optional[JobAnalysisResponse] = None
    interview_at: Optional[datetime] = None
    hours_per_day: Optional[float] = None


class JobDescriptionUpdateRequest(BaseModel):
    description: str = Field(min_length=20, max_length=8000)


class JobAnalysisPriority(BaseModel):
    """One employer signal, ranked so the user knows what to prepare first."""

    title: str
    why_it_matters: str
    priority: Literal["critical", "important", "supporting"] = "important"


class JobAnalysisRequirements(BaseModel):
    """Requirements are separated so a user can distinguish must-haves from bonuses."""

    must_have: list[str] = Field(default_factory=list)
    preferred: list[str] = Field(default_factory=list)
    experience_and_education: list[str] = Field(default_factory=list)
    eligibility_constraints: list[str] = Field(default_factory=list)


class JobInterviewTopic(BaseModel):
    """A concrete topic to study, with an explicit reason and priority."""

    topic: str
    why_it_matters: str
    priority: Literal["critical", "important", "supporting"] = "important"
    category: Literal["technical", "domain", "behavioral", "case", "system", "other"] = "other"


class JobDescriptionBrief(BaseModel):
    """The fixed, persisted job-analysis contract used by every workspace surface."""

    analysis_version: str = "v2"
    company: str = ""
    role_title: str
    role_summary: str
    what_matters_most: list[JobAnalysisPriority] = Field(default_factory=list)
    requirements: JobAnalysisRequirements = Field(default_factory=JobAnalysisRequirements)
    responsibilities: list[str] = Field(default_factory=list)
    interview_topics: list[JobInterviewTopic] = Field(default_factory=list)
    behavioral_story_prompts: list[str] = Field(default_factory=list)
    positioning_prompts: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    unknowns_to_verify: list[str] = Field(default_factory=list)
    source: str = "openai"


class JobDescriptionAskRequest(BaseModel):
    question: str = Field(min_length=2)


class JobDescriptionAskResponse(BaseModel):
    answer: str
    interview_use: str
    next_steps: list[str] = Field(default_factory=list)
    source: str = "openai"
