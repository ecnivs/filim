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

    database_url: str = "sqlite+aiosqlite:///./filim.db"

    allanime_api_url: str = "https://api.allanime.day/api"
    allanime_referer: str = "https://allmanga.to"
    http_timeout_seconds: float = 15.0

    trending_window_days: int = 30

    log_level: str = "INFO"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()


settings = get_settings()
