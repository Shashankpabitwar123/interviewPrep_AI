import re
from typing import Optional

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import JobPost, RoleBlueprintRecord, User
from app.schemas.job_analysis import JobDescriptionBrief
from app.schemas.role_intelligence import (
    EvidenceClaim,
    EvidenceSource,
    InterviewRoundBlueprint,
    RoleBlueprint,
    RoleCompetency,
)
from app.services.research_service import (
    ResearchBundle,
    description_hash,
    get_research_bundle,
    get_or_create_research_snapshot,
)


ROLE_BLUEPRINT_VERSION = "v3"


def get_saved_role_blueprint(
    db: Session,
    job_post_id: int,
    user: Optional[User] = None,
) -> Optional[RoleBlueprint]:
    job = db.get(JobPost, job_post_id)
    if job is None or not _owns_job(job, user) or job.role_blueprint is None:
        return None
    record = job.role_blueprint
    if record.version != ROLE_BLUEPRINT_VERSION or record.description_hash != description_hash(job.description):
        return None
    try:
        return RoleBlueprint.model_validate(record.blueprint)
    except Exception:
        return None


def ensure_role_blueprint(
    db: Session,
    job: JobPost,
    brief: JobDescriptionBrief,
    settings: Settings | None,
    user: Optional[User] = None,
) -> tuple[RoleBlueprint, ResearchBundle]:
    saved = get_saved_role_blueprint(db, job.id, user)
    if saved is not None:
        snapshot_id = job.role_blueprint.research_snapshot_id if job.role_blueprint else None
        cached_bundle = get_research_bundle(db, snapshot_id)
        return saved, cached_bundle or ResearchBundle(status="not_requested", cached=True)

    topics = [item.topic for item in brief.interview_topics]
    bundle = get_or_create_research_snapshot(db, job, settings, topics=topics)
    blueprint = build_role_blueprint(
        brief,
        job.description,
        job.source_url,
        bundle,
        job_post_id=job.id,
    )
    save_role_blueprint(db, job.id, blueprint, bundle.snapshot_id, user)
    return blueprint, bundle


def build_role_blueprint(
    brief: JobDescriptionBrief,
    description: str,
    source_url: str | None,
    research: ResearchBundle | None = None,
    *,
    job_post_id: int | None = None,
) -> RoleBlueprint:
    research = research or ResearchBundle()
    posting_source = EvidenceSource(
        source_id="job-posting",
        title=f"{brief.role_title} job posting",
        url=source_url,
        origin="job_posting",
        authority=1.0,
        relevance_score=1.0,
        summary=_excerpt(description, brief.role_title, limit=900),
        query="",
    )
    sources = [posting_source, *(item.to_evidence_source() for item in research.results)]
    competencies = _competencies_from_brief(brief)
    responsibilities = [
        EvidenceClaim(
            statement=item,
            origin="job_posting",
            confidence=1.0,
            source_ids=["job-posting"],
            evidence_excerpt=_excerpt(description, item),
        )
        for item in brief.responsibilities
    ]
    return RoleBlueprint(
        job_post_id=job_post_id,
        source_fingerprint=description_hash(description),
        role_title=brief.role_title,
        company=brief.company,
        role_summary=brief.role_summary,
        competencies=competencies,
        requirements=brief.requirements,
        responsibilities=responsibilities,
        behavioral_story_prompts=brief.behavioral_story_prompts,
        positioning_prompts=brief.positioning_prompts,
        questions_to_ask=brief.questions_to_ask,
        interview_rounds=_interview_rounds(competencies),
        research_sources=sources,
        unknowns_to_verify=brief.unknowns_to_verify,
    )


def save_role_blueprint(
    db: Session,
    job_post_id: int,
    blueprint: RoleBlueprint,
    research_snapshot_id: int | None,
    user: Optional[User] = None,
) -> Optional[RoleBlueprint]:
    job = db.get(JobPost, job_post_id)
    if job is None or not _owns_job(job, user):
        return None
    record = job.role_blueprint
    if record is None:
        record = RoleBlueprintRecord(job_post_id=job.id)
        db.add(record)
    stored = blueprint.model_copy(update={"job_post_id": job.id})
    record.version = ROLE_BLUEPRINT_VERSION
    record.description_hash = description_hash(job.description)
    record.blueprint = stored.model_dump(mode="json")
    record.research_snapshot_id = research_snapshot_id
    db.commit()
    db.refresh(record)
    return RoleBlueprint.model_validate(record.blueprint)


def blueprint_context(blueprint: RoleBlueprint | None, *, include_sources: bool = True) -> str:
    if blueprint is None:
        return "No role blueprint is available. Use the saved job description as the source of truth."
    competency_lines = [
        f"- [{item.priority}] {item.name} ({item.category}): {item.why_it_matters}"
        for item in blueprint.competencies
    ]
    responsibility_lines = [f"- {item.statement}" for item in blueprint.responsibilities]
    source_lines: list[str] = []
    if include_sources:
        source_lines = [
            f"- {source.source_id} | {source.origin} | authority={source.authority:.2f} | {source.title}: {source.summary[:420]}"
            for source in blueprint.research_sources[:8]
        ]
    return (
        f"Role Blueprint version: {blueprint.version}\n"
        f"Role: {blueprint.role_title}\n"
        f"Company: {blueprint.company or 'Not stated'}\n"
        f"Summary: {blueprint.role_summary}\n\n"
        f"Prioritized competencies:\n{chr(10).join(competency_lines) or '- Role fundamentals'}\n\n"
        f"Responsibilities from the posting:\n{chr(10).join(responsibility_lines) or '- Not explicitly listed'}\n\n"
        f"Behavioral evidence to prepare:\n{chr(10).join('- ' + item for item in blueprint.behavioral_story_prompts)}\n\n"
        f"Unknowns to verify:\n{chr(10).join('- ' + item for item in blueprint.unknowns_to_verify)}"
        + (f"\n\nSupporting research sources:\n{chr(10).join(source_lines)}" if source_lines else "")
    )


def critical_competency_names(blueprint: RoleBlueprint | None) -> list[str]:
    if blueprint is None:
        return []
    critical = [item.name for item in blueprint.competencies if item.priority == "critical"]
    return critical or [item.name for item in blueprint.competencies[:3]]


def _competencies_from_brief(brief: JobDescriptionBrief) -> list[RoleCompetency]:
    competencies: list[RoleCompetency] = []
    seen: set[str] = set()
    topics = list(brief.interview_topics)
    for skill in brief.core_skills:
        matching_topic = next((item for item in topics if item.topic.casefold() == skill.name.casefold()), None)
        competencies.append(_competency(
            skill.name,
            matching_topic.category if matching_topic else "technical",
            skill.priority,
            matching_topic.why_it_matters if matching_topic else "The job posting explicitly names this tool or capability.",
        ))
        seen.add(skill.name.casefold())
    for topic in topics:
        if topic.topic.casefold() in seen:
            continue
        competencies.append(_competency(topic.topic, topic.category, topic.priority, topic.why_it_matters))
        seen.add(topic.topic.casefold())
    for priority in brief.what_matters_most:
        if priority.title.casefold() in seen:
            continue
        competencies.append(_competency(priority.title, "domain", priority.priority, priority.why_it_matters))
        seen.add(priority.title.casefold())
    return competencies[:12]


def _competency(name: str, category: str, priority: str, why: str) -> RoleCompetency:
    modes = {
        "technical": ["scenario", "short_answer", "practical"],
        "system": ["design", "tradeoff", "debugging"],
        "case": ["case", "estimation", "decision"],
        "behavioral": ["behavioral", "follow_up"],
        "domain": ["scenario", "explanation", "case"],
    }.get(category, ["scenario", "explanation"])
    return RoleCompetency(
        name=name,
        category=category,
        priority=priority,
        why_it_matters=why,
        learning_objectives=[
            f"Explain {name} clearly in the context of this role.",
            f"Apply {name} to a realistic responsibility from the posting.",
            f"Discuss one tradeoff, risk, or validation step involving {name}.",
        ],
        common_mistakes=[
            f"Giving a memorized definition of {name} without applying it to the role.",
            "Making unsupported claims instead of using a concrete example.",
        ],
        assessment_modes=modes,
    )


def _interview_rounds(competencies: list[RoleCompetency]) -> list[InterviewRoundBlueprint]:
    technical = [item.name for item in competencies if item.category in {"technical", "system"}]
    domain = [item.name for item in competencies if item.category in {"domain", "case", "other"}]
    behavioral = [item.name for item in competencies if item.category == "behavioral"]
    rounds = [InterviewRoundBlueprint(
        name="Role and motivation screen",
        purpose="Confirm role understanding, motivation, and evidence of fit.",
        competency_names=[item.name for item in competencies[:3]],
        question_styles=["role_fit", "motivation", "resume_evidence"],
    )]
    if technical:
        rounds.append(InterviewRoundBlueprint(
            name="Technical or practical assessment",
            purpose="Test applied knowledge, reasoning, correctness, and tradeoffs.",
            competency_names=technical[:6],
            question_styles=["scenario", "debugging", "practical", "tradeoff"],
        ))
    if domain:
        rounds.append(InterviewRoundBlueprint(
            name="Role-specific discussion",
            purpose="Evaluate judgment in the role's real day-to-day work.",
            competency_names=domain[:6],
            question_styles=["case", "prioritization", "stakeholder"],
        ))
    rounds.append(InterviewRoundBlueprint(
        name="Behavioral evidence",
        purpose="Evaluate ownership, communication, learning, and collaboration through examples.",
        competency_names=behavioral or ["Communication", "Ownership", "Collaboration"],
        question_styles=["STAR", "follow_up", "reflection"],
    ))
    return rounds


def _excerpt(description: str, needle: str, limit: int = 360) -> str:
    clean = " ".join((description or "").split())
    if not clean:
        return ""
    words = [word for word in re.findall(r"[A-Za-z0-9+#.]+", needle or "") if len(word) > 3]
    lowered = clean.casefold()
    position = next((lowered.find(word.casefold()) for word in words if lowered.find(word.casefold()) >= 0), 0)
    start = max(0, position - 100)
    return clean[start:start + limit].strip()


def _owns_job(job: JobPost, user: Optional[User]) -> bool:
    return job.user_id == (user.id if user else None)
