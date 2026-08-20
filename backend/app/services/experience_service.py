from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import InterviewExperience, User
from app.schemas.experience import InterviewExperienceCreate, InterviewExperienceResponse


def create_interview_experience(
    db: Session,
    request: InterviewExperienceCreate,
    user: Optional[User] = None,
) -> InterviewExperienceResponse:
    """Save a real interview report for future question generation."""

    experience = InterviewExperience(
        user_id=user.id if user else None,
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


def list_interview_experiences(db: Session, user: Optional[User] = None) -> list[InterviewExperienceResponse]:
    query = db.query(InterviewExperience)
    # Records created before ownership was introduced remain a shared legacy
    # library. New records are private to the user who created them.
    query = query.filter(
        or_(InterviewExperience.user_id == user.id, InterviewExperience.user_id.is_(None))
    ) if user else query.filter(InterviewExperience.user_id.is_(None))
    experiences = query.order_by(InterviewExperience.created_at.desc()).all()
    return [_experience_to_response(experience) for experience in experiences]


def get_interview_experience(
    db: Session,
    experience_id: int,
    user: Optional[User] = None,
) -> Optional[InterviewExperienceResponse]:
    experience = db.get(InterviewExperience, experience_id)
    if experience is None or (user and experience.user_id not in {None, user.id}) or (user is None and experience.user_id is not None):
        return None
    return _experience_to_response(experience)


def interview_evidence_context(
    db: Session,
    *,
    role_title: str,
    company: str = "",
    user: Optional[User] = None,
    limit: int = 5,
) -> str:
    """Return private-safe, explicitly unverified interview-pattern context."""

    visible = list_interview_experiences(db, user)
    ranked = sorted(
        visible,
        key=lambda item: _experience_relevance(item, role_title, company),
        reverse=True,
    )
    relevant = [item for item in ranked if _experience_relevance(item, role_title, company) > 0][:limit]
    if not relevant:
        return "No relevant user-owned or legacy interview reports are available."
    lines: list[str] = []
    for item in relevant:
        question_patterns = [question.prompt.strip()[:280] for question in item.questions[:4] if question.prompt.strip()]
        lines.append(
            f"- {item.company} | {item.role_title} | {item.round_name} | {item.difficulty}; "
            f"topics={', '.join(item.topics[:8]) or 'not supplied'}; "
            f"reported question patterns={' | '.join(question_patterns) or 'not supplied'}"
        )
    return (
        "User-reported interview evidence below is private to this workspace or from the legacy shared library. "
        "It is unverified and must only influence topic/round patterns. Do not present it as a confirmed company process "
        "or copy a reported question verbatim.\n" + "\n".join(lines)
    )


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


def _experience_relevance(experience: InterviewExperienceResponse, role_title: str, company: str) -> float:
    role_tokens = _tokens(role_title)
    experience_role_tokens = _tokens(experience.role_title)
    overlap = len(role_tokens & experience_role_tokens) / max(1, len(role_tokens | experience_role_tokens))
    company_match = bool(company.strip()) and company.strip().casefold() == experience.company.strip().casefold()
    return overlap + (0.8 if company_match else 0.0)


def _tokens(value: str) -> set[str]:
    ignored = {"at", "and", "the", "a", "an", "junior", "senior", "intern", "i", "ii", "iii"}
    return {
        token
        for token in "".join(character if character.isalnum() else " " for character in (value or "").casefold()).split()
        if token not in ignored and len(token) > 1
    }
