from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import PrepPlan, User
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
from app.services.generation_run_service import record_generation_run
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/study-notes", tags=["study notes"])


@router.post("/generate", response_model=StudyNoteResponse)
def generate_note(
    request: StudyNoteRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> StudyNoteResponse:
    generation_started = perf_counter()
    try:
        note = generate_study_note(db, request, settings, current_user)
    except Exception as exc:
        db.rollback()
        plan = db.get(PrepPlan, request.prep_plan_id)
        record_generation_run(
            db,
            artifact_type="study_note",
            prompt_version="study-note-v4",
            settings=settings,
            user=current_user,
            job_post_id=plan.job_post_id if plan else None,
            prep_plan_id=request.prep_plan_id,
            input_value=request.model_dump(),
            status="failed",
            detail={"error_type": type(exc).__name__, "stage": "note_generation"},
            latency_ms=round((perf_counter() - generation_started) * 1000),
        )
        raise
    if note is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    plan = db.get(PrepPlan, request.prep_plan_id)
    record_generation_run(
        db,
        artifact_type="study_note",
        prompt_version="study-note-v4",
        settings=settings,
        provider=note.source,
        model=settings.generation_model if note.source == "openai" else None,
        user=current_user,
        job_post_id=plan.job_post_id if plan else None,
        prep_plan_id=request.prep_plan_id,
        input_value=request.model_dump(),
        output_value=note.model_dump(mode="json"),
        quality=note.quality_report,
        detail={"day": request.day, "topics": request.topics},
        latency_ms=round((perf_counter() - generation_started) * 1000),
    )
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
