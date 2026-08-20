from hashlib import sha256
from typing import Any

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import GenerationRun, User
from app.services.usage_service import estimate_tokens


def context_hash(value: Any) -> str:
    normalized = str(value or "").strip()
    return sha256(normalized.encode("utf-8")).hexdigest()


def record_generation_run(
    db: Session,
    *,
    artifact_type: str,
    prompt_version: str,
    settings: Settings | None = None,
    provider: str | None = None,
    model: str | None = None,
    user: User | None = None,
    job_post_id: int | None = None,
    prep_plan_id: int | None = None,
    input_value: Any = None,
    output_value: Any = None,
    status: str = "complete",
    quality: dict | None = None,
    detail: dict | None = None,
    latency_ms: int | None = None,
) -> None:
    """Best-effort trace record; observability must never break generation."""

    resolved_provider = provider or ("openai" if settings and settings.openai_enabled else "local")
    resolved_model = model or (
        settings.openai_model
        if settings and settings.openai_enabled and resolved_provider == "openai"
        else None
    )
    try:
        db.add(GenerationRun(
            user_id=user.id if user else None,
            job_post_id=job_post_id,
            prep_plan_id=prep_plan_id,
            artifact_type=artifact_type,
            provider=resolved_provider,
            model=resolved_model,
            prompt_version=prompt_version,
            context_hash=context_hash(input_value),
            status=status,
            latency_ms=latency_ms,
            input_tokens=estimate_tokens(input_value),
            output_tokens=estimate_tokens(output_value),
            quality=quality or {},
            detail=detail or {},
        ))
        db.commit()
    except Exception:
        db.rollback()
