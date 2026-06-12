from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.schemas.mock_interview import MockAnswerRequest, MockInterviewResponse, MockInterviewStartRequest
from app.services.mock_interview_service import answer_mock_question, get_mock_interview, start_mock_interview

router = APIRouter(prefix="/mock-interviews", tags=["mock interviews"])


@router.post("/start", response_model=MockInterviewResponse)
def start_interview(
    request: MockInterviewStartRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MockInterviewResponse:
    interview = start_mock_interview(db, request, settings)
    if interview is None:
        raise HTTPException(status_code=404, detail="Prep plan not found")
    return interview


@router.get("/{mock_interview_id}", response_model=MockInterviewResponse)
def get_interview(mock_interview_id: int, db: Session = Depends(get_db)) -> MockInterviewResponse:
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
) -> MockInterviewResponse:
    interview = answer_mock_question(db, mock_interview_id, request, settings)
    if interview is None:
        raise HTTPException(status_code=404, detail="Mock interview not found")
    return interview
