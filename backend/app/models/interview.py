from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimestampMixin:
    """Shared created/updated timestamps for all database records."""

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(TimestampMixin, Base):
    """A person using InterviewPrep AI."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class JobPost(TimestampMixin, Base):
    """A job description or posting that the user wants to prepare for."""

    __tablename__ = "job_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    interview_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    analysis: Mapped[Optional["JobAnalysis"]] = relationship(back_populates="job_post", cascade="all, delete-orphan")
    prep_plans: Mapped[list["PrepPlan"]] = relationship(back_populates="job_post", cascade="all, delete-orphan")


class JobAnalysis(TimestampMixin, Base):
    """Structured skills and interview signals extracted from a job post."""

    __tablename__ = "job_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_post_id: Mapped[int] = mapped_column(ForeignKey("job_posts.id"), unique=True)
    seniority: Mapped[str] = mapped_column(String(80))
    required_skills: Mapped[list[str]] = mapped_column(JSON)
    interview_focus: Mapped[list[dict]] = mapped_column(JSON)
    coding_difficulty: Mapped[str] = mapped_column(String(40))
    behavioral_themes: Mapped[list[str]] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(40))

    job_post: Mapped["JobPost"] = relationship(back_populates="analysis")


class PrepPlan(TimestampMixin, Base):
    """A generated preparation plan tied to one job post."""

    __tablename__ = "prep_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_post_id: Mapped[int] = mapped_column(ForeignKey("job_posts.id"))
    days_until_interview: Mapped[int] = mapped_column(Integer)
    summary: Mapped[str] = mapped_column(Text)

    job_post: Mapped["JobPost"] = relationship(back_populates="prep_plans")
    tasks: Mapped[list["PrepTask"]] = relationship(back_populates="prep_plan", cascade="all, delete-orphan")
    exams: Mapped[list["Exam"]] = relationship(back_populates="prep_plan", cascade="all, delete-orphan")
    mock_interviews: Mapped[list["MockInterview"]] = relationship(back_populates="prep_plan", cascade="all, delete-orphan")


class PrepTask(TimestampMixin, Base):
    """One scheduled action inside a prep plan, such as an exam or revision block."""

    __tablename__ = "prep_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    prep_plan_id: Mapped[int] = mapped_column(ForeignKey("prep_plans.id"))
    day: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    task_type: Mapped[str] = mapped_column(String(80))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    topics: Mapped[list[str]] = mapped_column(JSON)
    instructions: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="not_started")

    prep_plan: Mapped["PrepPlan"] = relationship(back_populates="tasks")


class Exam(TimestampMixin, Base):
    """A timed exam generated for a prep plan."""

    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(primary_key=True)
    prep_plan_id: Mapped[int] = mapped_column(ForeignKey("prep_plans.id"))
    title: Mapped[str] = mapped_column(String(200))
    day: Mapped[int] = mapped_column(Integer)
    time_limit_minutes: Mapped[int] = mapped_column(Integer)

    prep_plan: Mapped["PrepPlan"] = relationship(back_populates="exams")
    questions: Mapped[list["Question"]] = relationship(back_populates="exam", cascade="all, delete-orphan")


class Question(TimestampMixin, Base):
    """A question inside an exam."""

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"))
    question_type: Mapped[str] = mapped_column(String(80))
    prompt: Mapped[str] = mapped_column(Text)
    topics: Mapped[list[str]] = mapped_column(JSON)
    expected_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    options: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)

    exam: Mapped["Exam"] = relationship(back_populates="questions")
    attempts: Mapped[list["AnswerAttempt"]] = relationship(back_populates="question", cascade="all, delete-orphan")


class AnswerAttempt(TimestampMixin, Base):
    """A user's answer, score, and feedback for one question."""

    __tablename__ = "answer_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    answer_text: Mapped[str] = mapped_column(Text)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    question: Mapped["Question"] = relationship(back_populates="attempts")


class InterviewExperience(TimestampMixin, Base):
    """Future data submitted by users about real interview experiences."""

    __tablename__ = "interview_experiences"

    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(String(160))
    role_title: Mapped[str] = mapped_column(String(200))
    round_name: Mapped[str] = mapped_column(String(120))
    topics: Mapped[list[str]] = mapped_column(JSON)
    questions: Mapped[list[dict]] = mapped_column(JSON)
    difficulty: Mapped[str] = mapped_column(String(40))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class MockInterview(TimestampMixin, Base):
    """A saved mock interview session for one prep plan."""

    __tablename__ = "mock_interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    prep_plan_id: Mapped[int] = mapped_column(ForeignKey("prep_plans.id"))
    current_topic: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(40), default="active")
    average_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    prep_plan: Mapped["PrepPlan"] = relationship(back_populates="mock_interviews")
    messages: Mapped[list["MockMessage"]] = relationship(back_populates="mock_interview", cascade="all, delete-orphan")


class MockMessage(TimestampMixin, Base):
    """One interviewer question, user answer, or feedback message."""

    __tablename__ = "mock_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    mock_interview_id: Mapped[int] = mapped_column(ForeignKey("mock_interviews.id"))
    role: Mapped[str] = mapped_column(String(40))
    content: Mapped[str] = mapped_column(Text)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    mock_interview: Mapped["MockInterview"] = relationship(back_populates="messages")
