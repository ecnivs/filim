from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.profiles import Profile


class ProfileListEntry(Base):
    __tablename__ = "profile_list_entries"

    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    anime_id: Mapped[str] = mapped_column(String, nullable=False)

    profile: Mapped[Profile] = relationship(back_populates="list_entries")

    __table_args__ = (
        UniqueConstraint(
            "profile_id",
            "anime_id",
            name="uq_profile_list_profile_anime",
        ),
    )


class ProfileRating(Base):
    __tablename__ = "profile_ratings"

    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    anime_id: Mapped[str] = mapped_column(String, nullable=False)
    # Simple string rating; constrained at the service/API layer to
    # \"like\" / \"dislike\" values.
    rating: Mapped[str] = mapped_column(String, nullable=False)

    profile: Mapped[Profile] = relationship(back_populates="ratings")

    __table_args__ = (
        UniqueConstraint(
            "profile_id",
            "anime_id",
            name="uq_profile_rating_profile_anime",
        ),
    )
