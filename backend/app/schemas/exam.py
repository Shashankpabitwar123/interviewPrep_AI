from typing import Optional

from pydantic import BaseModel, Field


class ExamGenerateRequest(BaseModel):
    prep_plan_id: int
    day: int = Field(default=1, ge=1)
    question_count: int = Field(default=20, ge=3, le=60)
    difficulty: str = Field(default="medium", examples=["easy", "medium", "hard"])
    time_limit_minutes: Optional[int] = Field(default=None, ge=5, le=180)
    focus_topics: Optional[list[str]] = None
    auto_question_types: bool = True
    question_types: list[str] = Field(
        default_factory=lambda: ["multiple_choice", "short_answer", "one_word", "fill_blank", "multiple_select", "coding"],
        examples=[["multiple_choice", "short_answer", "one_word", "fill_blank", "multiple_select", "coding"]],
    )


class QuestionOption(BaseModel):
    label: str
    text: str
    is_correct: bool = False


class QuestionResponse(BaseModel):
    id: int
    question_type: str
    prompt: str
    topics: list[str]
    expected_answer: Optional[str] = None
    options: Optional[list[QuestionOption]] = None


class ExamResponse(BaseModel):
    id: int
    prep_plan_id: int
    title: str
    day: int
    time_limit_minutes: int
    questions: list[QuestionResponse]


class AnswerSubmission(BaseModel):
    question_id: int
    answer_text: str = Field(min_length=1)


class ExamSubmissionRequest(BaseModel):
    answers: list[AnswerSubmission]


class AnswerResult(BaseModel):
    question_id: int
    score: float
    feedback: str


class ExamSubmissionResponse(BaseModel):
    exam_id: int
    average_score: float
    results: list[AnswerResult]
