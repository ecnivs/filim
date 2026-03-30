from datetime import datetime
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    name: Mapped[str] = mapped_column(String, nullable=False)
    pin_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )

    watch_progress: Mapped[list["WatchProgress"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    list_entries: Mapped[list["ProfileListEntry"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    ratings: Mapped[list["ProfileRating"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    audio_preferences: Mapped[list["ProfileAudioPreference"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
    )
