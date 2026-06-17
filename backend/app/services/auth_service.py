import hashlib
import hmac
import base64
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import EmailVerificationOTP, User
from app.schemas.auth import LoginRequest, RegisterRequest, RegistrationOtpRequest
from app.services.email_service import email_configured, send_registration_otp

HASH_NAME = "sha256"
ITERATIONS = 100_000
MAX_OTP_ATTEMPTS = 5


def request_registration_otp(db: Session, request: RegistrationOtpRequest, settings: Settings) -> tuple[str, Optional[str]]:
    """Create and send a short-lived registration OTP."""

    email = _normalize_email(request.email)
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.email_otp_expire_minutes)
    db.query(EmailVerificationOTP).filter(
        EmailVerificationOTP.email == email,
        EmailVerificationOTP.purpose == "register",
        EmailVerificationOTP.consumed_at.is_(None),
    ).update({"consumed_at": datetime.now(timezone.utc)})
    otp = EmailVerificationOTP(
        email=email,
        purpose="register",
        code_hash=_hash_otp(email, code, settings),
        expires_at=expires_at,
    )
    db.add(otp)

    if email_configured(settings):
        try:
            send_registration_otp(email, code, settings)
        except Exception as exc:  # pragma: no cover - network/provider failures are environment-specific.
            db.rollback()
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not send verification email. Try again soon.") from exc
        db.commit()
        return "Verification code sent to your email.", None

    if settings.email_otp_dev_mode:
        db.commit()
        return "Verification code generated. Configure Gmail SMTP for real email delivery.", code

    db.rollback()
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email OTP delivery is not configured.")


def create_user(db: Session, request: RegisterRequest) -> User:
    """Create a new account after checking that the email is unused."""

    email = _normalize_email(request.email)
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    user = User(
        name=request.name.strip(),
        email=email,
        password_hash=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def verify_registration_otp(db: Session, email_value: str, code_value: Optional[str], settings: Settings) -> None:
    """Validate a registration OTP before creating the account."""

    if not settings.registration_otp_required:
        return

    email = _normalize_email(email_value)
    code = (code_value or "").strip()
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter the 6-digit verification code sent to your email.")

    now = datetime.now(timezone.utc)
    otp = db.query(EmailVerificationOTP).filter(
        EmailVerificationOTP.email == email,
        EmailVerificationOTP.purpose == "register",
        EmailVerificationOTP.consumed_at.is_(None),
    ).order_by(EmailVerificationOTP.created_at.desc()).first()
    if not otp or _as_aware(otp.expires_at) < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code expired. Request a new code.")
    if otp.attempts >= MAX_OTP_ATTEMPTS:
        otp.consumed_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many incorrect code attempts. Request a new code.")
    if not hmac.compare_digest(otp.code_hash, _hash_otp(email, code, settings)):
        otp.attempts += 1
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is incorrect.")

    otp.consumed_at = now
    db.commit()


def authenticate_user(db: Session, request: LoginRequest) -> User:
    """Return the matching user when the password is correct."""

    email = _normalize_email(request.email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")
    return user


def create_access_token(user: User, settings: Settings) -> str:
    """Create a signed bearer token without storing server-side sessions."""

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user.id,
        "email": user.email,
        "exp": int(expires_at.timestamp()),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_part = _urlsafe_b64encode(payload_bytes)
    signature = hmac.new(settings.auth_secret_key.encode("utf-8"), payload_part.encode("utf-8"), HASH_NAME).digest()
    return f"{payload_part}.{_urlsafe_b64encode(signature)}"


def verify_access_token(token: str, settings: Settings) -> dict:
    try:
        payload_part, signature_part = token.split(".", 1)
        expected_signature = hmac.new(settings.auth_secret_key.encode("utf-8"), payload_part.encode("utf-8"), HASH_NAME).digest()
        if not hmac.compare_digest(_urlsafe_b64encode(expected_signature), signature_part):
            raise ValueError("Bad signature")
        payload = json.loads(_urlsafe_b64decode(payload_part))
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth token.")

    if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Auth token expired.")
    return payload


def get_request_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Optional[User]:
    """Return the logged-in user, or allow anonymous dev requests when configured."""

    if not authorization:
        if settings.require_auth:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required.")
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header.")

    payload = verify_access_token(token, settings)
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists.")
    return user


def get_current_user(current_user: Optional[User] = Depends(get_request_user)) -> User:
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required.")
    return current_user


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(HASH_NAME, password.encode("utf-8"), salt.encode("utf-8"), ITERATIONS)
    return f"pbkdf2_{HASH_NAME}${ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected_hash = stored_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != f"pbkdf2_{HASH_NAME}":
        return False

    digest = hashlib.pbkdf2_hmac(HASH_NAME, password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
    return hmac.compare_digest(digest.hex(), expected_hash)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_otp(email: str, code: str, settings: Settings) -> str:
    return hmac.new(settings.auth_secret_key.encode("utf-8"), f"{email}:{code}".encode("utf-8"), HASH_NAME).hexdigest()


def _as_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _urlsafe_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _urlsafe_b64decode(value: str) -> str:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}").decode("utf-8")
