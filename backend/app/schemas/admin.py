from datetime import datetime

from pydantic import BaseModel, Field


class AdminUsageEventResponse(BaseModel):
    id: int
    user_id: int | None = None
    event_type: str
    feature: str
    provider: str | None = None
    model: str | None = None
    input_tokens: int
    output_tokens: int
    total_tokens: int
    detail: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserSummary(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    created_at: datetime
    last_login_at: datetime | None = None
    last_seen_at: datetime | None = None
    blocked_at: datetime | None = None
    block_reason: str | None = None
    total_tokens: int = 0
    total_events: int = 0
    jobs_count: int = 0
    prep_plans_count: int = 0
    exams_count: int = 0
    mock_interviews_count: int = 0
    notes_events_count: int = 0


class AdminUserDetail(BaseModel):
    user: AdminUserSummary
    recent_events: list[AdminUsageEventResponse]


class AdminOverview(BaseModel):
    total_users: int
    active_users: int
    blocked_users: int
    admin_users: int
    accounts_created_today: int
    logins_today: int
    total_api_tokens: int
    total_events: int
    recent_events: list[AdminUsageEventResponse]
    users: list[AdminUserSummary]


class AdminBlockRequest(BaseModel):
    reason: str = Field(default="Blocked by developer review.", max_length=500)
