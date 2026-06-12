from typing import Optional

from sqlalchemy.orm import Session

from app.models import InterviewExperience
from app.schemas.experience import InterviewExperienceCreate, InterviewExperienceResponse


def create_interview_experience(
    db: Session,
    request: InterviewExperienceCreate,
) -> InterviewExperienceResponse:
    """Save a real interview report for future question generation."""

    experience = InterviewExperience(
        company=request.company,
        role_title=request.role_title,
        round_name=request.round_name,
        topics=request.topics,
        questions=[question.model_dump() for question in request.questions],
        difficulty=request.difficulty,
        notes=request.notes,
    )
    db.add(experience)
    db.commit()
    db.refresh(experience)
    return _experience_to_response(experience)


def list_interview_experiences(db: Session) -> list[InterviewExperienceResponse]:
    experiences = db.query(InterviewExperience).order_by(InterviewExperience.created_at.desc()).all()
    return [_experience_to_response(experience) for experience in experiences]


def get_interview_experience(
    db: Session,
    experience_id: int,
) -> Optional[InterviewExperienceResponse]:
    experience = db.get(InterviewExperience, experience_id)
    if experience is None:
        return None
    return _experience_to_response(experience)


def _experience_to_response(experience: InterviewExperience) -> InterviewExperienceResponse:
    return InterviewExperienceResponse(
        id=experience.id,
        company=experience.company,
        role_title=experience.role_title,
        round_name=experience.round_name,
        topics=experience.topics,
        questions=experience.questions,
        difficulty=experience.difficulty,
        notes=experience.notes,
    )
