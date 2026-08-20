from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.exam import ExamGenerateRequest, ExamResponse, ExamStoredAttemptResponse, ExamSubmissionRequest, ExamSubmissionResponse
from app.services.auth_service import get_request_user
from app.services.exam_service import delete_exam, generate_exam_for_plan, get_exam_detail, list_exam_attempts, submit_exam_answers
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("", response_model=list[ExamStoredAttemptResponse])
def list_exams(
    prep_plan_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> list[ExamStoredAttemptResponse]:
    return list_exam_attempts(db, current_user, prep_plan_id)


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
    record_usage_event(
        db,
        current_user,
        "exam_generated",
        "exams",
        settings=settings,
        input_value=request.model_dump(),
        output_value=exam.model_dump(),
        detail={"exam_id": exam.id, "prep_plan_id": exam.prep_plan_id, "day": exam.day, "questions": len(exam.questions)},
    )
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


@router.delete("/{exam_id}", status_code=204)
def remove_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> None:
    if not delete_exam(db, exam_id, current_user):
        raise HTTPException(status_code=404, detail="Exam not found")


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
    record_usage_event(
        db,
        current_user,
        "exam_submitted",
        "exams",
        settings=settings,
        input_value=request.model_dump(),
        output_value=result.model_dump(),
        detail={"exam_id": exam_id, "score": result.average_score, "answers": len(result.results)},
    )
    return result
