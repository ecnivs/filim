from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Anime(Base):
    __tablename__ = "anime"

    # AllAnime or other source identifier
    source_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    english_title: Mapped[str | None] = mapped_column(String, nullable=True)
    alt_names: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    slug: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    synopsis: Mapped[str | None] = mapped_column(Text, nullable=True)
    genres: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    episode_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    poster_url: Mapped[str | None] = mapped_column(String, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    allanime_raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    episodes: Mapped[list["Episode"]] = relationship(
        back_populates="anime",
        cascade="all, delete-orphan",
    )


class Episode(Base):
    __tablename__ = "episodes"

    anime_id: Mapped[str] = mapped_column(
        ForeignKey("anime.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    episode_no: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    air_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    allanime_raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    anime: Mapped[Anime] = relationship(back_populates="episodes")


class AnimeStats(Base):
    __tablename__ = "anime_stats"

    anime_id: Mapped[str] = mapped_column(
        ForeignKey("anime.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    device_count_30d: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    watch_time_sum_30d: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    is_trending: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
