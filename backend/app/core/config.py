from __future__ import annotations

import os
from functools import lru_cache

from app.core import constants


class Settings:
    """Application configuration using static constants for simplicity."""

    def __init__(self):
        self.environment: str = os.environ.get("ENVIRONMENT", "development")
        self.debug: bool = os.environ.get("DEBUG", "").lower() in ("1", "true", "yes")

        self.host: str = constants.DEFAULT_HOST
        self.port: int = constants.DEFAULT_PORT

        self.allanime_api_url: str = os.environ.get("ALLANIME_API_URL", constants.ALLANIME_API_URL)
        self.allanime_base_url: str = constants.ALLANIME_BASE_URL
        self.allanime_referer: str = constants.ALLANIME_REFERER
        self.http_timeout_seconds: float = constants.HTTP_TIMEOUT_SECONDS

        self.trending_window_days: int = constants.TRENDING_WINDOW_DAYS
        self.log_level: str = os.environ.get("LOG_LEVEL", constants.DEFAULT_LOG_LEVEL)

        self.flaresolverr_url: str = os.environ.get("FLARESOLVERR_URL", "http://localhost:8191/v1")

        self.cors_origins: list[str] = ["*"]

    @property
    def project_root(self) -> str:
        """Returns the absolute root directory of the backend."""
        return os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )

    @property
    def database_url(self) -> str:
        """Dynamically calculates the SQLite path relative to the project root."""
        db_path = os.path.join(self.project_root, "filim.db")
        return f"sqlite+aiosqlite:///{db_path}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()


settings = get_settings()
