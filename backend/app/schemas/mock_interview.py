from typing import Optional

from pydantic import BaseModel, Field


class MockInterviewStartRequest(BaseModel):
    prep_plan_id: int
    topic: Optional[str] = None
    difficulty: str = Field(default="medium", examples=["easy", "medium", "hard"])
    question_count: Optional[int] = Field(default=None, ge=1, le=12)
    question_types: list[str] = Field(
        default_factory=lambda: ["technical", "multiple_choice", "coding", "behavioral"],
        examples=[["technical", "one_word", "multiple_choice", "multiple_select", "coding", "team_problem_solving"]],
    )


class MockAnswerRequest(BaseModel):
    answer_text: str = Field(min_length=1)


class MockMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    score: Optional[float] = None


class MockInterviewResponse(BaseModel):
    id: int
    prep_plan_id: int
    current_topic: str
    status: str
    difficulty: str = "medium"
    question_count: int = 6
    answered_questions: int = 0
    average_score: Optional[float] = None
    messages: list[MockMessageResponse]
