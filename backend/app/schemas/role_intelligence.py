from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.job_analysis import JobAnalysisRequirements


EvidenceOrigin = Literal["job_posting", "company_official", "official_reference", "occupation_standard", "web_research"]
CompetencyPriority = Literal["critical", "important", "supporting"]


class EvidenceSource(BaseModel):
    """One source that can be traced back from generated preparation content."""

    source_id: str
    title: str
    url: Optional[str] = None
    origin: EvidenceOrigin = "web_research"
    authority: float = Field(default=0.5, ge=0, le=1)
    relevance_score: float = Field(default=0.5, ge=0, le=1)
    summary: str = ""
    query: str = ""
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EvidenceClaim(BaseModel):
    """A concise fact plus the evidence that supports it."""

    statement: str
    origin: EvidenceOrigin = "job_posting"
    confidence: float = Field(default=1.0, ge=0, le=1)
    source_ids: list[str] = Field(default_factory=list)
    evidence_excerpt: str = ""


class RoleCompetency(BaseModel):
    """A reusable preparation target shared by plans, notes, exams, and mocks."""

    name: str
    category: Literal["technical", "domain", "behavioral", "case", "system", "other"] = "other"
    priority: CompetencyPriority = "important"
    why_it_matters: str
    source_ids: list[str] = Field(default_factory=lambda: ["job-posting"])
    learning_objectives: list[str] = Field(default_factory=list)
    common_mistakes: list[str] = Field(default_factory=list)
    assessment_modes: list[str] = Field(default_factory=list)


class InterviewRoundBlueprint(BaseModel):
    name: str
    purpose: str
    competency_names: list[str] = Field(default_factory=list)
    question_styles: list[str] = Field(default_factory=list)


class RoleBlueprint(BaseModel):
    """Versioned source of truth for every job-scoped AI feature."""

    version: str = "v3"
    job_post_id: Optional[int] = None
    source_fingerprint: str
    role_title: str
    company: str = ""
    role_summary: str
    competencies: list[RoleCompetency] = Field(default_factory=list)
    requirements: JobAnalysisRequirements = Field(default_factory=JobAnalysisRequirements)
    responsibilities: list[EvidenceClaim] = Field(default_factory=list)
    behavioral_story_prompts: list[str] = Field(default_factory=list)
    positioning_prompts: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    interview_rounds: list[InterviewRoundBlueprint] = Field(default_factory=list)
    research_sources: list[EvidenceSource] = Field(default_factory=list)
    unknowns_to_verify: list[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RoleIntelligenceResponse(BaseModel):
    blueprint: RoleBlueprint
    research_status: str = "not_requested"
    research_source_count: int = 0
    cached: bool = True
