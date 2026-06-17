from typing import Optional

from pydantic import BaseModel, Field, model_validator


class JobAnalysisRequest(BaseModel):
    job_title: str = Field(default="Auto-detect role", min_length=2, examples=["Backend Software Engineer Intern"])
    company: Optional[str] = Field(default="Auto-detect company", examples=["Amazon"])
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


class JobPostDetail(BaseModel):
    id: int
    title: str
    company: str = ""
    description: str
    source_url: Optional[str] = None
    analysis: Optional[JobAnalysisResponse] = None


class JobDescriptionBrief(BaseModel):
    company: str = ""
    role_title: str
    overview: str
    requirements: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    looking_for: list[str] = Field(default_factory=list)
    interview_signals: list[str] = Field(default_factory=list)
    must_prepare: list[str] = Field(default_factory=list)
    resume_keywords: list[str] = Field(default_factory=list)
    candidate_positioning: list[str] = Field(default_factory=list)
    possible_interview_questions: list[str] = Field(default_factory=list)
    red_flags_to_avoid: list[str] = Field(default_factory=list)
    company_context: list[str] = Field(default_factory=list)
    prep_advice: list[str] = Field(default_factory=list)
    source: str = "openai"


class JobDescriptionAskRequest(BaseModel):
    question: str = Field(min_length=2)


class JobDescriptionAskResponse(BaseModel):
    answer: str
    interview_use: str
    next_steps: list[str] = Field(default_factory=list)
    source: str = "openai"
