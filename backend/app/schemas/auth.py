from datetime import datetime

from pydantic import BaseModel, Field, computed_field, field_validator


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    otp_code: str | None = Field(default=None, min_length=6, max_length=6)

    @field_validator("password")
    @classmethod
    def password_has_letter_and_number(cls, value: str) -> str:
        has_letter = any(character.isalpha() for character in value)
        has_number = any(character.isdigit() for character in value)
        if not has_letter or not has_number:
            raise ValueError("Password must include at least one letter and one number.")
        return value


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class RegistrationOtpRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class RegistrationOtpResponse(BaseModel):
    message: str
    expires_in_minutes: int
    dev_otp: str | None = None


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
