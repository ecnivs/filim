from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Profile


class ProfileModel(BaseModel):
    id: str
    name: str
    is_locked: bool
    created_at: datetime

    class Config:
        from_attributes = True


def _hash_pin(pin: str) -> str:
    """Return a stable hash for a numeric PIN.

    This is intentionally simple – the frontend already limits input to a short
    numeric code and this service only runs on a trusted LAN. We still avoid
    storing the raw PIN.
    """

    return hashlib.sha256(pin.encode("utf-8")).hexdigest()


@dataclass
class ProfileService:
    db: AsyncSession

    async def list_profiles(self) -> list[ProfileModel]:
        stmt = select(Profile).order_by(Profile.created_at.asc())
        rows = (await self.db.execute(stmt)).scalars().all()
        return [ProfileModel.model_validate(row) for row in rows]

    async def create_profile(self, name: str, pin: str | None = None) -> ProfileModel:
        now = datetime.now(timezone.utc)
        pin_hash = _hash_pin(pin) if pin else None
        profile = Profile(
            name=name,
            pin_hash=pin_hash,
            is_locked=bool(pin_hash),
            created_at=now,
        )
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return ProfileModel.model_validate(profile)

    async def update_profile(
        self,
        profile_id: str,
        *,
        name: str | None = None,
        pin: str | None | object = object(),
    ) -> ProfileModel:
        profile = await self.db.get(Profile, profile_id)
        if profile is None:
            raise ValueError("Profile not found")

        if name is not None:
            profile.name = name

        # `pin` uses a sentinel so callers can distinguish between
        # \"no change\" and \"clear\" (None).
        if pin is not object():
            if pin:
                profile.pin_hash = _hash_pin(pin)
                profile.is_locked = True
            else:
                profile.pin_hash = None
                profile.is_locked = False

        await self.db.commit()
        await self.db.refresh(profile)
        return ProfileModel.model_validate(profile)

    async def delete_profile(self, profile_id: str) -> None:
        profile = await self.db.get(Profile, profile_id)
        if profile is None:
            return
        await self.db.delete(profile)
        await self.db.commit()

    async def verify_pin(self, profile_id: str, pin: str) -> bool:
        profile = await self.db.get(Profile, profile_id)
        if profile is None or not profile.pin_hash:
            return False
        return profile.pin_hash == _hash_pin(pin)
