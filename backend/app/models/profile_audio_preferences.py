from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.profiles import Profile


class ProfileAudioPreference(Base):
    __tablename__ = "profile_audio_preferences"

    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Stores a lightweight audio language identifier such as \"sub\", \"dub\",
    # or a language code like \"ja\"/\"en\".
    audio_language_id: Mapped[str] = mapped_column(String, nullable=False)

    profile: Mapped[Profile] = relationship(back_populates="audio_preferences")

    __table_args__ = (
        UniqueConstraint(
            "profile_id",
            name="uq_profile_audio_pref_profile",
        ),
    )
