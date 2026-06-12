from typing import Optional

from pydantic import BaseModel, Field


class ExperienceQuestion(BaseModel):
    prompt: str
    topic: str
    question_type: str = Field(default="technical", examples=["technical", "coding", "behavioral", "system_design"])


class InterviewExperienceCreate(BaseModel):
    company: str = Field(min_length=2)
    role_title: str = Field(min_length=2)
    round_name: str = Field(min_length=2, examples=["Phone Screen", "Technical Round", "Final Round"])
    topics: list[str]
    questions: list[ExperienceQuestion]
    difficulty: str = Field(examples=["easy", "medium", "hard"])
    notes: Optional[str] = None


class InterviewExperienceResponse(InterviewExperienceCreate):
    id: int
