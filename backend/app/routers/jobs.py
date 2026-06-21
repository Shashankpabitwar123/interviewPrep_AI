from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.job_analysis import (
    JobAnalysisRequest,
    JobAnalysisResponse,
    JobDescriptionAskRequest,
    JobDescriptionAskResponse,
    JobDescriptionBrief,
    JobPostDetail,
    JobPostSummary,
)
from app.services.job_analyzer import (
    analyze_job_description,
    answer_job_description_question,
    build_job_description_brief,
    identify_job,
)
from app.services.job_source import resolve_job_description
from app.services.persistence import delete_job, get_job_detail, list_jobs, save_job_analysis
from app.services.auth_service import get_request_user
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/analyze", response_model=JobAnalysisResponse)
def analyze_job(
    request: JobAnalysisRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> JobAnalysisResponse:
    if request.save_mode == "url" and request.source_url and not request.job_description:
        description = f"Saved URL bookmark. Open the source URL to view the job description. URL: {request.source_url}"
    else:
        description = resolve_job_description(request.job_description, request.source_url)
    inferred_title, inferred_company = identify_job(request.job_title, request.company, description, request.source_url, settings)
    analysis_request = request.model_copy(update={"job_title": inferred_title, "company": inferred_company, "job_description": description})
    analysis = analyze_job_description(analysis_request, settings)
    saved_job = save_job_analysis(db, inferred_title, description, analysis, source_url=request.source_url, company=inferred_company, user=current_user)
    record_usage_event(
        db,
        current_user,
        "job_saved",
        "jobs",
        settings=settings,
        input_value=analysis_request.model_dump(),
        output_value=saved_job.model_dump(),
        detail={"job_post_id": saved_job.job_post_id, "title": inferred_title, "company": inferred_company},
    )
    return saved_job


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


@router.get("/{job_post_id}/brief", response_model=JobDescriptionBrief)
def get_job_brief(
    job_post_id: int,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> JobDescriptionBrief:
    job = get_job_detail(db, job_post_id, current_user)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    brief = build_job_description_brief(job.title, job.description, job.source_url, settings)
    record_usage_event(
        db,
        current_user,
        "job_description_reviewed",
        "jobs",
        settings=settings,
        input_value=job.description,
        output_value=brief.model_dump(),
        detail={"job_post_id": job_post_id, "title": job.title},
    )
    return brief


@router.post("/{job_post_id}/ask", response_model=JobDescriptionAskResponse)
def ask_job_description(
    job_post_id: int,
    request: JobDescriptionAskRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> JobDescriptionAskResponse:
    job = get_job_detail(db, job_post_id, current_user)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    answer = answer_job_description_question(job.title, job.description, request.question, settings)
    record_usage_event(
        db,
        current_user,
        "job_description_asked",
        "jobs",
        settings=settings,
        input_value={"description": job.description, "question": request.question},
        output_value=answer.model_dump(),
        detail={"job_post_id": job_post_id, "title": job.title},
    )
    return answer


@router.delete("/{job_post_id}", status_code=204)
def remove_job(
    job_post_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> None:
    deleted = delete_job(db, job_post_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
    record_usage_event(
        db,
        current_user,
        "job_deleted",
        "jobs",
        provider="system",
        detail={"job_post_id": job_post_id},
    )
