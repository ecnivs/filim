from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.profiles import Profile


class Device(Base):
    __tablename__ = "devices"

    mac_address: Mapped[str] = mapped_column(String, nullable=False, index=True)
    device_name: Mapped[str | None] = mapped_column(String, nullable=True)

    tokens: Mapped[list["DeviceToken"]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
    )
    watch_progress: Mapped[list["WatchProgress"]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        # One logical device per MAC for now; can be relaxed later.
        UniqueConstraint("mac_address", name="uq_devices_mac_address"),
    )


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    device_id: Mapped[str] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    device: Mapped[Device] = relationship(back_populates="tokens")


class WatchProgress(Base):
    __tablename__ = "watch_progress"

    device_id: Mapped[str] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    anime_id: Mapped[str] = mapped_column(String, nullable=False)
    episode: Mapped[str] = mapped_column(String, nullable=False)
    position_seconds: Mapped[float] = mapped_column(nullable=False)
    duration_seconds: Mapped[float] = mapped_column(nullable=False)
    is_finished: Mapped[bool] = mapped_column(nullable=False, default=False)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )

    device: Mapped[Device] = relationship(back_populates="watch_progress")
    profile: Mapped[Profile | None] = relationship(back_populates="watch_progress")

    __table_args__ = (
        UniqueConstraint(
            "device_id",
            "profile_id",
            "anime_id",
            "episode",
            name="uq_watch_progress_device_profile_anime_episode",
        ),
    )
