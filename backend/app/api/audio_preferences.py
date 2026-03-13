from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.preferences.audio import AudioPreferenceModel, AudioPreferencesService


class AudioPreferenceItem(BaseModel):
    audio_language_id: str

    @classmethod
    def from_model(cls, model: AudioPreferenceModel) -> "AudioPreferenceItem":
        return cls(audio_language_id=model.audio_language_id)


class UpdateAudioPreferenceBody(BaseModel):
    audio_language_id: Optional[str] = None


router = APIRouter()


def _get_audio_preferences_service(
    db: AsyncSession = Depends(get_db),
) -> AudioPreferencesService:
    return AudioPreferencesService(db=db)


@router.get("/audio-preference")
async def get_audio_preference(
    x_profile_id: str | None = Header(None, alias="X-Profile-Id"),
    service: AudioPreferencesService = Depends(_get_audio_preferences_service),
) -> dict[str, Optional[AudioPreferenceItem]]:
    if not x_profile_id:
        return {"item": None}
    pref = await service.get_audio_preference_for_profile(profile_id=x_profile_id)
    if pref is None:
        return {"item": None}
    return {"item": AudioPreferenceItem.from_model(pref)}


@router.post("/audio-preference")
async def update_audio_preference(
    body: UpdateAudioPreferenceBody,
    x_profile_id: str | None = Header(None, alias="X-Profile-Id"),
    service: AudioPreferencesService = Depends(_get_audio_preferences_service),
) -> dict[str, Optional[AudioPreferenceItem]]:
    if not x_profile_id:
        raise HTTPException(status_code=400, detail="Profile header required")
    pref = await service.set_audio_preference(
        profile_id=x_profile_id,
        audio_language_id=body.audio_language_id,
    )
    if pref is None:
        return {"item": None}
    return {"item": AudioPreferenceItem.from_model(pref)}
