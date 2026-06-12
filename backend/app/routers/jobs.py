from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.job_analysis import JobAnalysisRequest, JobAnalysisResponse, JobPostDetail, JobPostSummary
from app.services.job_analyzer import analyze_job_description, infer_role_title
from app.services.job_source import resolve_job_description
from app.services.persistence import delete_job, get_job_detail, list_jobs, save_job_analysis
from app.services.auth_service import get_request_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/analyze", response_model=JobAnalysisResponse)
def analyze_job(
    request: JobAnalysisRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> JobAnalysisResponse:
    description = resolve_job_description(request.job_description, request.source_url)
    inferred_title = infer_role_title(request.job_title, description, request.source_url)
    analysis_request = request.model_copy(update={"job_title": inferred_title, "job_description": description})
    analysis = analyze_job_description(analysis_request, settings)
    return save_job_analysis(db, inferred_title, description, analysis, source_url=request.source_url, user=current_user)


@router.get("", response_model=list[JobPostSummary])
def get_jobs(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> list[JobPostSummary]:
    return list_jobs(db, current_user)


@router.get("/{job_post_id}", response_model=JobPostDetail)
def get_job(
    job_post_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> JobPostDetail:
    job = get_job_detail(db, job_post_id, current_user)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/{job_post_id}", status_code=204)
def remove_job(
    job_post_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> None:
    deleted = delete_job(db, job_post_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
