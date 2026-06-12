from functools import lru_cache
import os
from typing import Optional

from pydantic import BaseModel


class Settings(BaseModel):
    app_env: str = "development"
    database_url: str = "sqlite:///./interviewprep.db"
    frontend_origins: list[str] = ["*"]
    auth_secret_key: str = "change-this-local-development-secret"
    access_token_expire_minutes: int = 60 * 24 * 7
    require_auth: bool = False
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.5-flash"
    tavily_api_key: Optional[str] = None

    @property
    def openai_enabled(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def ai_enabled(self) -> bool:
        return self.openai_enabled or self.gemini_enabled

    @property
    def tavily_enabled(self) -> bool:
        return bool(self.tavily_api_key)


@lru_cache
def get_settings() -> Settings:
    frontend_origins = [
        origin.strip()
        for origin in os.getenv("FRONTEND_ORIGINS", "*").split(",")
        if origin.strip()
    ]
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        database_url=os.getenv("DATABASE_URL", "sqlite:///./interviewprep.db"),
        frontend_origins=frontend_origins or ["*"],
        auth_secret_key=os.getenv("AUTH_SECRET_KEY", "change-this-local-development-secret"),
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7))),
        require_auth=os.getenv("REQUIRE_AUTH", "false").lower() in {"1", "true", "yes"},
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        tavily_api_key=os.getenv("TAVILY_API_KEY"),
    )
