from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.mock_interview import MockAnswerRequest, MockInterviewResponse, MockInterviewStartRequest
from app.services.auth_service import get_request_user
from app.services.mock_interview_service import answer_mock_question, get_mock_interview, start_mock_interview
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/mock-interviews", tags=["mock interviews"])


@router.post("/start", response_model=MockInterviewResponse)
def start_interview(
    request: MockInterviewStartRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_request_user),
) -> MockInterviewResponse:
    interview = start_mock_interview(db, request, settings)
    if interview is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
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
    interview = get_mock_interview(db, mock_interview_id)
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
    interview = answer_mock_question(db, mock_interview_id, request, settings)
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
