from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.services.email_service import email_configured

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/providers")
def provider_health(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    """Report provider readiness without returning credentials or secret values."""

    return {
        "status": "ok",
        "environment": settings.app_env,
        "providers": {
            "openai": {"configured": settings.openai_enabled, "model": settings.openai_model},
            "gemini": {"configured": settings.gemini_enabled, "model": settings.gemini_model},
            "tavily": {"configured": settings.tavily_enabled},
            "resend": {
                "credential_configured": bool(settings.resend_api_key),
                "sender_configured": bool(settings.email_from),
            },
            "email": {"configured": email_configured(settings), "provider": settings.email_provider},
        },
    }
