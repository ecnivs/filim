from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="FILIM_", env_file=".env", extra="ignore"
    )

    # General
    environment: str = "development"
    debug: bool = True

    # Networking
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "postgresql+asyncpg://filim:filim@localhost:5432/filim"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # AllAnime / external sources
    allanime_api_url: str = "https://api.allanime.day/api"
    allanime_referer: str = "https://allmanga.to"
    http_timeout_seconds: float = 15.0

    # HLS
    hls_root: str = "/var/media/hls"
    hls_base_url: str = "http://localhost:8080/hls"

    # Hardware / Processing
    # Security / Auth limits could go here

    # Recommendations
    trending_window_days: int = 30

    # Observability
    log_level: str = "INFO"

    # Optional: feature flags
    enable_remote_hls_proxy: bool = True
    enable_local_transcoding: bool = True

    # Reserved for future Rust modules
    enable_rust_parsers: bool = False
    rust_library_path: Optional[str] = None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()


settings = get_settings()
