from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.exam import ExamGenerateRequest, ExamResponse, ExamSubmissionRequest, ExamSubmissionResponse
from app.services.auth_service import get_request_user
from app.services.exam_service import generate_exam_for_plan, get_exam_detail, submit_exam_answers

router = APIRouter(prefix="/exams", tags=["exams"])


@router.post("/generate", response_model=ExamResponse)
def generate_exam(
    request: ExamGenerateRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> ExamResponse:
    exam = generate_exam_for_plan(db, request, settings, current_user)
    if exam is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    return exam


@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> ExamResponse:
    exam = get_exam_detail(db, exam_id, current_user)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.post("/{exam_id}/submit", response_model=ExamSubmissionResponse)
def submit_exam(
    exam_id: int,
    request: ExamSubmissionRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> ExamSubmissionResponse:
    result = submit_exam_answers(db, exam_id, request, settings, current_user)
    if result is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return result
