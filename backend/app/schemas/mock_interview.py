from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class MockInterviewStartRequest(BaseModel):
    prep_plan_id: int
    topic: Optional[str] = None
    scope: Literal["selected_day", "through_selected_day", "full_plan"] = "full_plan"
    day: Optional[int] = Field(default=None, ge=1)
    focus_topics: list[str] = Field(default_factory=list, max_length=12)
    difficulty: str = Field(default="medium", examples=["easy", "medium", "hard"])
    question_count: Optional[int] = Field(default=None, ge=1, le=12)
    question_types: list[str] = Field(
        default_factory=lambda: ["technical", "coding", "behavioral", "team_problem_solving"],
        examples=[["technical", "one_word", "multiple_choice", "multiple_select", "coding", "team_problem_solving"]],
    )


class MockAnswerRequest(BaseModel):
    answer_text: str = Field(min_length=1)


class MockMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    score: Optional[float] = None
    detail: dict = Field(default_factory=dict)


class MockQuestionPlan(BaseModel):
    number: int
    topic: str
    competency: str
    question_type: str
    intent: str
    rubric: list[str] = Field(default_factory=list)
    question: str = ""


class MockVoiceTurn(BaseModel):
    role: Literal["interviewer", "candidate"]
    content: str = Field(min_length=1, max_length=5000)


class MockVoiceCompleteRequest(BaseModel):
    turns: list[MockVoiceTurn] = Field(default_factory=list, max_length=100)


class MockInterviewResponse(BaseModel):
    id: int
    prep_plan_id: int
    current_topic: str
    status: str
    difficulty: str = "medium"
    question_count: int = 6
    scope: str = "full_plan"
    focus_topics: list[str] = Field(default_factory=list)
    answered_questions: int = 0
    average_score: Optional[float] = None
    session_plan: list[MockQuestionPlan] = Field(default_factory=list)
    overall_feedback: dict = Field(default_factory=dict)
    quality_report: dict = Field(default_factory=dict)
    created_at: datetime
    messages: list[MockMessageResponse]
