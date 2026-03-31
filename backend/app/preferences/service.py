from __future__ import annotations
from dataclasses import dataclass
from typing import Literal, Optional
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import ProfileAudioPreference, ProfileListEntry, ProfileRating


class PreferenceModel(BaseModel):
    anime_id: str
    in_list: bool
    rating: Literal["like", "dislike"] | None

    class Config:
        from_attributes = True


class AudioPreferenceModel(BaseModel):
    profile_id: str
    audio_language_id: str

    class Config:
        from_attributes = True


AllowedRating = Literal["like", "dislike"]


@dataclass
class PreferencesService:
    db: AsyncSession

    async def get_preferences_for_profile(
        self, profile_id: str
    ) -> list[PreferenceModel]:
        list_stmt = select(ProfileListEntry).where(
            ProfileListEntry.profile_id == profile_id
        )
        rating_stmt = select(ProfileRating).where(
            ProfileRating.profile_id == profile_id
        )

        list_rows = (await self.db.execute(list_stmt)).scalars().all()
        rating_rows = (await self.db.execute(rating_stmt)).scalars().all()

        in_list_map: dict[str, bool] = {}
        rating_map: dict[str, AllowedRating] = {}

        for entry in list_rows:
            in_list_map[entry.anime_id] = True
        for rating in rating_rows:
            rating_map[rating.anime_id] = rating.rating

        anime_ids = set(in_list_map.keys()) | set(rating_map.keys())
        items: list[PreferenceModel] = []
        for anime_id in sorted(anime_ids):
            items.append(
                PreferenceModel(
                    anime_id=anime_id,
                    in_list=in_list_map.get(anime_id, False),
                    rating=rating_map.get(anime_id),
                )
            )
        return items

    async def get_list_anime_ids(self, profile_id: str) -> list[str]:
        stmt = select(ProfileListEntry.anime_id).where(
            ProfileListEntry.profile_id == profile_id
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return list(rows)

    async def set_in_list(
        self,
        profile_id: str,
        anime_id: str,
        in_list: bool,
    ) -> PreferenceModel:
        if in_list:
            stmt = select(ProfileListEntry).where(
                ProfileListEntry.profile_id == profile_id,
                ProfileListEntry.anime_id == anime_id,
            )
            row = (await self.db.execute(stmt)).scalar_one_or_none()
            if row is None:
                row = ProfileListEntry(profile_id=profile_id, anime_id=anime_id)
                self.db.add(row)
        else:
            stmt = delete(ProfileListEntry).where(
                ProfileListEntry.profile_id == profile_id,
                ProfileListEntry.anime_id == anime_id,
            )
            await self.db.execute(stmt)

        await self.db.commit()
        return await self._build_single(
            preferred_anime_id=anime_id, profile_id=profile_id
        )

    async def set_rating(
        self,
        profile_id: str,
        anime_id: str,
        rating: AllowedRating | None,
    ) -> PreferenceModel:
        if rating is not None and rating not in ("like", "dislike"):
            raise ValueError("Invalid rating value")

        if rating is None:
            stmt = delete(ProfileRating).where(
                ProfileRating.profile_id == profile_id,
                ProfileRating.anime_id == anime_id,
            )
            await self.db.execute(stmt)
        else:
            stmt = select(ProfileRating).where(
                ProfileRating.profile_id == profile_id,
                ProfileRating.anime_id == anime_id,
            )
            row = (await self.db.execute(stmt)).scalar_one_or_none()
            if row is None:
                row = ProfileRating(
                    profile_id=profile_id,
                    anime_id=anime_id,
                    rating=rating,
                )
                self.db.add(row)
            else:
                row.rating = rating

        await self.db.commit()
        return await self._build_single(
            preferred_anime_id=anime_id, profile_id=profile_id
        )

    async def _build_single(
        self, preferred_anime_id: str, profile_id: str
    ) -> PreferenceModel:
        in_list_stmt = select(ProfileListEntry).where(
            ProfileListEntry.profile_id == profile_id,
            ProfileListEntry.anime_id == preferred_anime_id,
        )
        rating_stmt = select(ProfileRating).where(
            ProfileRating.profile_id == profile_id,
            ProfileRating.anime_id == preferred_anime_id,
        )
        list_entry = (await self.db.execute(in_list_stmt)).scalar_one_or_none()
        rating_entry = (await self.db.execute(rating_stmt)).scalar_one_or_none()

        return PreferenceModel(
            anime_id=preferred_anime_id,
            in_list=bool(list_entry),
            rating=rating_entry.rating if rating_entry is not None else None,
        )

    # Audio Preferences (Merged)
    async def get_audio_preference_for_profile(
        self, profile_id: str
    ) -> Optional[AudioPreferenceModel]:
        stmt = select(ProfileAudioPreference).where(
            ProfileAudioPreference.profile_id == profile_id
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            return None
        return AudioPreferenceModel.model_validate(row)

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
        return AudioPreferenceModel.model_validate(row)
