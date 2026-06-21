from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    PasswordResetOtpRequest,
    PasswordResetRequest,
    RegisterRequest,
    RegistrationOtpRequest,
    RegistrationOtpResponse,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_user,
    delete_user_account,
    get_current_user,
    prepare_authenticated_user,
    request_password_reset_otp,
    request_registration_otp,
    reset_password_with_otp,
    verify_registration_otp,
)
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    verify_registration_otp(db, request.email, request.otp_code, settings)
    user = create_user(db, request, settings)
    record_usage_event(
        db,
        user,
        "account_created",
        "auth",
        provider="system",
        detail={"email": user.email, "role": user.role},
    )
    token = create_access_token(user, settings)
    return AuthResponse(user=user, access_token=token, message="Account created successfully.")


@router.post("/register/otp", response_model=RegistrationOtpResponse)
def register_otp(
    request: RegistrationOtpRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RegistrationOtpResponse:
    message, dev_otp = request_registration_otp(db, request, settings)
    return RegistrationOtpResponse(
        message=message,
        expires_in_minutes=settings.email_otp_expire_minutes,
        dev_otp=dev_otp,
    )


@router.post("/login", response_model=AuthResponse)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    user = authenticate_user(db, request)
    prepare_authenticated_user(db, user, settings)
    record_usage_event(db, user, "login", "auth", provider="system", detail={"email": user.email})
    token = create_access_token(user, settings)
    return AuthResponse(user=user, access_token=token, message="Logged in successfully.")


@router.post("/password-reset/otp", response_model=RegistrationOtpResponse)
def password_reset_otp(
    request: PasswordResetOtpRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RegistrationOtpResponse:
    message, dev_otp = request_password_reset_otp(db, request, settings)
    return RegistrationOtpResponse(
        message=message,
        expires_in_minutes=settings.email_otp_expire_minutes,
        dev_otp=dev_otp,
    )


@router.post("/password-reset", response_model=MessageResponse)
def password_reset(
    request: PasswordResetRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    user = reset_password_with_otp(db, request, settings)
    record_usage_event(db, user, "password_reset", "auth", provider="system", detail={"email": user.email})
    return MessageResponse(message="Password updated. You can log in with your new password.")


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    return _delete_current_account(db, current_user)


@router.post("/me/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_me_via_post(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    return _delete_current_account(db, current_user)


def _delete_current_account(db: Session, current_user: User) -> Response:
    record_usage_event(
        db,
        current_user,
        "account_deleted",
        "auth",
        provider="system",
        detail={"email": current_user.email},
        commit=False,
    )
    delete_user_account(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
