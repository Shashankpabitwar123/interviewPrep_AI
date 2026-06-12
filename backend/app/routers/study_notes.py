from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.schemas.study_note import (
    StudyNoteAskRequest,
    StudyNoteAskResponse,
    StudyNoteImproveRequest,
    StudyNoteImproveResponse,
    StudyNoteRequest,
    StudyNoteResponse,
)
from app.services.study_note_service import answer_note_question, generate_study_note, improve_note

router = APIRouter(prefix="/study-notes", tags=["study notes"])


@router.post("/generate", response_model=StudyNoteResponse)
def generate_note(
    request: StudyNoteRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> StudyNoteResponse:
    note = generate_study_note(db, request, settings)
    if note is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    return note


@router.post("/ask", response_model=StudyNoteAskResponse)
def ask_note_question(
    request: StudyNoteAskRequest,
    settings: Settings = Depends(get_settings),
) -> StudyNoteAskResponse:
    return answer_note_question(request, settings)


@router.post("/improve", response_model=StudyNoteImproveResponse)
def improve_study_note(
    request: StudyNoteImproveRequest,
    settings: Settings = Depends(get_settings),
) -> StudyNoteImproveResponse:
    return improve_note(request, settings)
