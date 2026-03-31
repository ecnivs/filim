from __future__ import annotations
import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="FILIM_", env_file=".env", extra="ignore"
    )

    environment: str = "development"
    debug: bool = True

    host: str = "0.0.0.0"
    port: int = 8000

    @property
    def project_root(self) -> str:
        return os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )

    @property
    def database_url(self) -> str:
        db_path = os.path.join(self.project_root, "filim.db")
        return f"sqlite+aiosqlite:///{db_path}"

    allanime_api_url: str = "https://api.allanime.day/api"
    allanime_referer: str = "https://allmanga.to"
    http_timeout_seconds: float = 15.0

    trending_window_days: int = 30

    log_level: str = "INFO"

    cors_origins: list[str] = ["*"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()


settings = get_settings()
