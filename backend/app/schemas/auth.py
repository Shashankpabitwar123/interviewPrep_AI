from datetime import datetime

from pydantic import BaseModel, Field, computed_field, field_validator


PASSWORD_REQUIREMENTS_MESSAGE = (
    "Password must be 8–128 characters and include an uppercase letter, lowercase letter, number, and symbol."
)


def validate_password_strength(value: str) -> str:
    has_uppercase = any(character.isupper() for character in value)
    has_lowercase = any(character.islower() for character in value)
    has_number = any(character.isdigit() for character in value)
    has_symbol = any(not character.isalnum() and not character.isspace() for character in value)
    if not all((has_uppercase, has_lowercase, has_number, has_symbol)):
        raise ValueError(PASSWORD_REQUIREMENTS_MESSAGE)
    return value


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    otp_code: str | None = Field(default=None, min_length=6, max_length=6)

    @field_validator("password")
    @classmethod
    def password_meets_requirements(cls, value: str) -> str:
        return validate_password_strength(value)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class RegistrationOtpRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class RegistrationOtpResponse(BaseModel):
    message: str
    expires_in_minutes: int
    dev_otp: str | None = None


class PasswordResetOtpRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    otp_code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def new_password_meets_requirements(cls, value: str) -> str:
        return validate_password_strength(value)


class MessageResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str = "user"
    status: str = "active"
    blocked_at: datetime | None = None
    block_reason: str | None = None
    last_login_at: datetime | None = None
    last_seen_at: datetime | None = None
    created_at: datetime

    @computed_field
    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"
    message: str
