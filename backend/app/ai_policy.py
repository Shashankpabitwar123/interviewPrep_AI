from contextvars import ContextVar


class AIUnavailableError(RuntimeError):
    """Raised when AI generation is required but no provider returns a result."""


_allow_local_fallback: ContextVar[bool] = ContextVar("allow_local_fallback", default=True)


def set_allow_local_fallback(value: bool):
    return _allow_local_fallback.set(value)


def reset_allow_local_fallback(token) -> None:
    _allow_local_fallback.reset(token)


def allow_local_fallback() -> bool:
    return _allow_local_fallback.get()


def require_ai_result(message: str) -> None:
    if not allow_local_fallback():
        raise AIUnavailableError(message)
