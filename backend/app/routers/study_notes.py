from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.study_note import (
    StudyNoteAskRequest,
    StudyNoteAskResponse,
    StudyNoteImproveRequest,
    StudyNoteImproveResponse,
    StudyNoteRequest,
    StudyNoteResponse,
)
from app.services.auth_service import get_request_user
from app.services.study_note_service import answer_note_question, generate_study_note, improve_note
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/study-notes", tags=["study notes"])


@router.post("/generate", response_model=StudyNoteResponse)
def generate_note(
    request: StudyNoteRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> StudyNoteResponse:
    note = generate_study_note(db, request, settings)
    if note is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    record_usage_event(
        db,
        current_user,
        "study_note_generated",
        "study_notes",
        settings=settings,
        input_value=request.model_dump(),
        output_value=note.model_dump(),
        detail={"prep_plan_id": request.prep_plan_id, "day": request.day, "topics": request.topics},
    )
    return note


@router.post("/ask", response_model=StudyNoteAskResponse)
def ask_note_question(
    request: StudyNoteAskRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> StudyNoteAskResponse:
    answer = answer_note_question(request, settings)
    record_usage_event(
        db,
        current_user,
        "study_note_asked",
        "study_notes",
        settings=settings,
        input_value=request.model_dump(),
        output_value=answer.model_dump(),
        detail={"topics": request.topics},
    )
    return answer


@router.post("/improve", response_model=StudyNoteImproveResponse)
def improve_study_note(
    request: StudyNoteImproveRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> StudyNoteImproveResponse:
    improved = improve_note(request, settings)
    record_usage_event(
        db,
        current_user,
        "study_note_improved",
        "study_notes",
        settings=settings,
        input_value=request.model_dump(),
        output_value=improved.model_dump(),
        detail={"title": request.title},
    )
    return improved
