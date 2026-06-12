from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.experience import InterviewExperienceCreate, InterviewExperienceResponse
from app.services.experience_service import create_interview_experience, get_interview_experience, list_interview_experiences

router = APIRouter(prefix="/interview-experiences", tags=["interview experiences"])


@router.post("", response_model=InterviewExperienceResponse)
def create_experience(
    request: InterviewExperienceCreate,
    db: Session = Depends(get_db),
) -> InterviewExperienceResponse:
    return create_interview_experience(db, request)


@router.get("", response_model=list[InterviewExperienceResponse])
def get_experiences(db: Session = Depends(get_db)) -> list[InterviewExperienceResponse]:
    return list_interview_experiences(db)


@router.get("/{experience_id}", response_model=InterviewExperienceResponse)
def get_experience(experience_id: int, db: Session = Depends(get_db)) -> InterviewExperienceResponse:
    experience = get_interview_experience(db, experience_id)
    if experience is None:
        raise HTTPException(status_code=404, detail="Interview experience not found")
    return experience
