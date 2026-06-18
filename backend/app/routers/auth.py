from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, RegistrationOtpRequest, RegistrationOtpResponse, UserResponse
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_user,
    delete_user_account,
    get_current_user,
    request_registration_otp,
    verify_registration_otp,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    verify_registration_otp(db, request.email, request.otp_code, settings)
    user = create_user(db, request)
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
    token = create_access_token(user, settings)
    return AuthResponse(user=user, access_token=token, message="Logged in successfully.")


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
    delete_user_account(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
