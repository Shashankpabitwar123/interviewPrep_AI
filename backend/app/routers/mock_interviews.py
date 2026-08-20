from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import MockInterview, User
from app.schemas.mock_interview import MockAnswerRequest, MockInterviewResponse, MockInterviewStartRequest
from app.services.auth_service import get_request_user
from app.services.mock_interview_service import answer_mock_question, complete_mock_interview, delete_mock_interview, get_mock_interview, list_mock_interviews, start_mock_interview
from app.services.generation_run_service import record_generation_run
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/mock-interviews", tags=["mock interviews"])


@router.get("", response_model=list[MockInterviewResponse])
def list_interviews(
    prep_plan_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> list[MockInterviewResponse]:
    return list_mock_interviews(db, current_user, prep_plan_id)


@router.post("/start", response_model=MockInterviewResponse)
def start_interview(
    request: MockInterviewStartRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> MockInterviewResponse:
    interview = start_mock_interview(db, request, settings, current_user)
    if interview is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    db_interview = db.get(MockInterview, interview.id)
    plan = db_interview.prep_plan if db_interview is not None else None
    record_generation_run(
        db,
        artifact_type="mock_interview",
        prompt_version="mock-v3",
        settings=settings,
        model=settings.generation_model if settings.openai_enabled else None,
        user=current_user,
        job_post_id=plan.job_post_id if plan else None,
        prep_plan_id=interview.prep_plan_id,
        input_value=request.model_dump(),
        output_value={"mock_interview_id": interview.id, "session_plan": [item.model_dump() for item in interview.session_plan]},
        quality={"planned_questions": len(interview.session_plan)},
        detail={"scope": interview.scope, "difficulty": interview.difficulty},
    )
    record_usage_event(
        db,
        current_user,
        "mock_interview_started",
        "mock_interviews",
        settings=settings,
        input_value=request.model_dump(),
        output_value=interview.model_dump(),
        detail={"mock_interview_id": interview.id, "prep_plan_id": interview.prep_plan_id, "difficulty": interview.difficulty},
    )
    return interview


@router.get("/{mock_interview_id}", response_model=MockInterviewResponse)
def get_interview(
    mock_interview_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> MockInterviewResponse:
    interview = get_mock_interview(db, mock_interview_id, current_user)
    if interview is None:
        raise HTTPException(status_code=404, detail="Mock interview not found")
    return interview


@router.delete("/{mock_interview_id}", status_code=204)
def remove_interview(
    mock_interview_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> None:
    if not delete_mock_interview(db, mock_interview_id, current_user):
        raise HTTPException(status_code=404, detail="Mock interview not found")


@router.post("/{mock_interview_id}/complete", response_model=MockInterviewResponse)
def complete_interview(
    mock_interview_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> MockInterviewResponse:
    interview = complete_mock_interview(db, mock_interview_id, current_user)
    if interview is None:
        raise HTTPException(status_code=404, detail="Mock interview not found")
    return interview


@router.post("/{mock_interview_id}/answer", response_model=MockInterviewResponse)
def answer_interview_question(
    mock_interview_id: int,
    request: MockAnswerRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> MockInterviewResponse:
    interview = answer_mock_question(db, mock_interview_id, request, settings, current_user)
    if interview is None:
        raise HTTPException(status_code=404, detail="Mock interview not found")
    record_usage_event(
        db,
        current_user,
        "mock_interview_answered",
        "mock_interviews",
        settings=settings,
        input_value=request.model_dump(),
        output_value=interview.model_dump(),
        detail={"mock_interview_id": mock_interview_id, "score": interview.average_score},
    )
    return interview
