import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import User, UserUsageEvent


def estimate_tokens(value: Any) -> int:
    """Small, transparent token estimate for admin usage reporting."""

    if value is None:
        return 0
    if not isinstance(value, str):
        try:
            value = json.dumps(value, default=str, ensure_ascii=False)
        except TypeError:
            value = str(value)
    value = value.strip()
    if not value:
        return 0
    return max(1, round(len(value) / 4))


def record_usage_event(
    db: Session,
    user: User | None,
    event_type: str,
    feature: str,
    *,
    settings: Settings | None = None,
    provider: str | None = None,
    model: str | None = None,
    input_value: Any = None,
    output_value: Any = None,
    total_tokens: int | None = None,
    detail: dict | None = None,
    commit: bool = True,
) -> None:
    """Persist a best-effort usage event without breaking the main product flow."""

    input_tokens = estimate_tokens(input_value)
    output_tokens = estimate_tokens(output_value)
    if total_tokens is None:
        total_tokens = input_tokens + output_tokens
    if settings and provider is None:
        provider = "openai" if settings.openai_enabled else "local"
    if settings and model is None and provider == "openai":
        model = settings.openai_model
    try:
        db.add(UserUsageEvent(
            user_id=user.id if user else None,
            event_type=event_type,
            feature=feature,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=max(0, int(total_tokens or 0)),
            detail=detail or {},
        ))
        if user is not None:
            user.last_seen_at = datetime.now(timezone.utc)
        if commit:
            db.commit()
    except Exception:
        db.rollback()


def mark_login(db: Session, user: User) -> None:
    now = datetime.now(timezone.utc)
    user.last_login_at = now
    user.last_seen_at = now
    db.commit()
