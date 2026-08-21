from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import JobPost, User
from app.schemas.job_analysis import (
    JobAnalysisRequest,
    JobAnalysisResponse,
    JobDescriptionAskRequest,
    JobDescriptionAskResponse,
    JobDescriptionBrief,
    JobDescriptionUpdateRequest,
    JobPostDetail,
    JobPostSummary,
)
from app.schemas.role_intelligence import RoleIntelligenceResponse
from app.services.job_analyzer import (
    analysis_from_job_brief,
    answer_job_description_question,
    build_job_description_brief,
    identity_hints,
    resolve_job_identity,
)
from app.services.job_source import ResolvedJobSource, resolve_job_source
from app.services.persistence import (
    delete_job,
    get_job_detail,
    get_saved_job_brief,
    list_jobs,
    save_job_analysis,
    save_job_brief,
    update_job_description,
)
from app.services.auth_service import get_request_user
from app.services.usage_service import record_usage_event
from app.services.generation_run_service import record_generation_run
from app.services.role_intelligence_service import ensure_role_blueprint, get_saved_role_blueprint

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/analyze", response_model=JobAnalysisResponse)
def analyze_job(
    request: JobAnalysisRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> JobAnalysisResponse:
    if request.save_mode == "url" and request.source_url and not request.job_description:
        try:
            source = resolve_job_source(None, request.source_url, settings)
        except ValueError:
            source = ResolvedJobSource(
                text=f"Saved URL bookmark. Open the source URL to view the job description. URL: {request.source_url}",
                extraction_method="bookmark",
                source_url=request.source_url,
                warnings=["The job page could not be read; identity was limited to captured page metadata."],
            )
    else:
        try:
            source = resolve_job_source(request.job_description, request.source_url, settings)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    description = source.text
    # Generate one canonical analysis during upload. It detects missing role
    # details and feeds the compact planner fields, so new jobs never need a
    # separate title/company or analysis generation request.
    title_hint, _ = identity_hints(request.job_title, request.company, description, request.source_url)
    brief = build_job_description_brief(title_hint, description, request.source_url, settings)
    identity = resolve_job_identity(
        request.job_title,
        request.company,
        description,
        request.source_url,
        ai_title=brief.role_title,
        ai_company=brief.company,
    )
    inferred_title = identity.role_title
    inferred_company = identity.company
    brief = brief.model_copy(update={"role_title": inferred_title, "company": inferred_company})
    analysis_request = request.model_copy(update={"job_title": inferred_title, "company": inferred_company, "job_description": description})
    analysis = analysis_from_job_brief(brief)
    saved_job = save_job_analysis(
        db,
        inferred_title,
        description,
        analysis,
        source_url=request.source_url,
        company=inferred_company,
        user=current_user,
        interview_at=request.interview_at,
        hours_per_day=request.hours_per_day,
        structured_brief=brief,
        capture_metadata={**source.metadata(), "identity": identity.metadata()},
    )
    job = db.get(JobPost, saved_job.job_post_id)
    blueprint = None
    research_bundle = None
    if job is not None and request.save_mode != "url":
        blueprint, research_bundle = ensure_role_blueprint(
            db,
            job,
            brief,
            settings,
            current_user,
        )
        record_generation_run(
            db,
            artifact_type="role_blueprint",
            prompt_version="role-blueprint-v3",
            settings=settings,
            provider="tavily+system" if research_bundle.results else "system",
            user=current_user,
            job_post_id=job.id,
            input_value=description,
            output_value=blueprint.model_dump(mode="json"),
            quality={"competency_count": len(blueprint.competencies), "research_status": research_bundle.status},
        )
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


@router.patch("/{job_post_id}/description", response_model=JobPostDetail)
def update_saved_job_description(
    job_post_id: int,
    request: JobDescriptionUpdateRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> JobPostDetail:
    job = update_job_description(db, job_post_id, request.description, current_user)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    record_usage_event(
        db,
        current_user,
        "job_description_updated",
        "jobs",
        provider="system",
        settings=settings,
        input_value={"description_length": len(job.description)},
        detail={"job_post_id": job_post_id, "title": job.title},
    )
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
    brief = get_saved_job_brief(db, job_post_id, current_user)
    if brief is not None:
        db_job = db.get(JobPost, job_post_id)
        if db_job is not None and not db_job.description.startswith("Saved URL bookmark."):
            ensure_role_blueprint(db, db_job, brief, settings, current_user)
        return brief

    # This route only repairs old/stale saved jobs. New jobs receive their
    # analysis in the upload/plan-generation request, so opening the tab is a
    # read and never triggers a second generation.
    brief = build_job_description_brief(job.title, job.description, job.source_url, settings)
    stored = save_job_brief(db, job_post_id, brief, analysis_from_job_brief(brief), current_user)
    if stored is None:
        raise HTTPException(status_code=404, detail="Job not found")
    db_job = db.get(JobPost, job_post_id)
    if db_job is not None and not db_job.description.startswith("Saved URL bookmark."):
        ensure_role_blueprint(db, db_job, stored, settings, current_user)
    record_usage_event(
        db,
        current_user,
        "job_description_reviewed",
        "jobs",
        settings=settings,
        input_value=job.description,
        output_value=stored.model_dump(),
        detail={"job_post_id": job_post_id, "title": job.title},
    )
    return stored


@router.get("/{job_post_id}/intelligence", response_model=RoleIntelligenceResponse)
def get_role_intelligence(
    job_post_id: int,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_request_user),
) -> RoleIntelligenceResponse:
    job = db.get(JobPost, job_post_id)
    detail = get_job_detail(db, job_post_id, current_user)
    if job is None or detail is None:
        raise HTTPException(status_code=404, detail="Job not found")
    brief = get_saved_job_brief(db, job_post_id, current_user)
    if brief is None:
        brief = build_job_description_brief(job.title, job.description, job.source_url, settings)
        save_job_brief(db, job.id, brief, analysis_from_job_brief(brief), current_user)
    cached = get_saved_role_blueprint(db, job.id, current_user)
    blueprint, bundle = ensure_role_blueprint(db, job, brief, settings, current_user)
    return RoleIntelligenceResponse(
        blueprint=blueprint,
        research_status=bundle.status,
        research_source_count=max(0, len(blueprint.research_sources) - 1),
        cached=cached is not None or bundle.cached,
    )


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
    blueprint = get_saved_role_blueprint(db, job_post_id, current_user)
    answer = answer_job_description_question(job.title, job.description, request.question, settings, blueprint)
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
