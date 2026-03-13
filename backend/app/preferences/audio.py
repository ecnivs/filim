from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile_audio_preferences import ProfileAudioPreference


class AudioPreferenceModel(BaseModel):
    profile_id: str
    audio_language_id: str

    class Config:
        from_attributes = True


@dataclass
class AudioPreferencesService:
    db: AsyncSession

    async def get_audio_preference_for_profile(
        self, profile_id: str
    ) -> Optional[AudioPreferenceModel]:
        stmt = select(ProfileAudioPreference).where(
            ProfileAudioPreference.profile_id == profile_id
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            return None
        return AudioPreferenceModel.from_orm(row)

    async def set_audio_preference(
        self, profile_id: str, audio_language_id: str | None
    ) -> Optional[AudioPreferenceModel]:
        if audio_language_id is None:
            stmt = delete(ProfileAudioPreference).where(
                ProfileAudioPreference.profile_id == profile_id
            )
            await self.db.execute(stmt)
            await self.db.commit()
            return None

        stmt = select(ProfileAudioPreference).where(
            ProfileAudioPreference.profile_id == profile_id
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            row = ProfileAudioPreference(
                profile_id=profile_id, audio_language_id=audio_language_id
            )
            self.db.add(row)
        else:
            row.audio_language_id = audio_language_id

        await self.db.commit()
        return AudioPreferenceModel.from_orm(row)
