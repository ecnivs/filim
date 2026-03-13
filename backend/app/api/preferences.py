from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.preferences import PreferenceModel, PreferencesService


class PreferenceItem(BaseModel):
    anime_id: str
    in_list: bool
    rating: Optional[Literal["like", "dislike"]] = None

    @classmethod
    def from_model(cls, model: PreferenceModel) -> "PreferenceItem":
        return cls(anime_id=model.anime_id, in_list=model.in_list, rating=model.rating)


class UpdateListBody(BaseModel):
    anime_id: str
    in_list: bool


class UpdateRatingBody(BaseModel):
    anime_id: str
    rating: Optional[Literal["like", "dislike"]] = None


router = APIRouter()


def _get_preferences_service(db: AsyncSession = Depends(get_db)) -> PreferencesService:
    return PreferencesService(db=db)


@router.get("/preferences")
async def get_preferences(
    x_profile_id: str | None = Header(None, alias="X-Profile-Id"),
    service: PreferencesService = Depends(_get_preferences_service),
) -> dict[str, list[PreferenceItem]]:
    if not x_profile_id:
        return {"items": []}
    items = await service.get_preferences_for_profile(profile_id=x_profile_id)
    return {"items": [PreferenceItem.from_model(item) for item in items]}


@router.post("/preferences/list")
async def update_list_membership(
    body: UpdateListBody,
    x_profile_id: str | None = Header(None, alias="X-Profile-Id"),
    service: PreferencesService = Depends(_get_preferences_service),
) -> dict[str, object]:
    if not x_profile_id:
        raise HTTPException(status_code=400, detail="Profile header required")
    item = await service.set_in_list(
        profile_id=x_profile_id,
        anime_id=body.anime_id,
        in_list=body.in_list,
    )
    return {"ok": True, "item": PreferenceItem.from_model(item)}


@router.post("/preferences/rating")
async def update_rating(
    body: UpdateRatingBody,
    x_profile_id: str | None = Header(None, alias="X-Profile-Id"),
    service: PreferencesService = Depends(_get_preferences_service),
) -> dict[str, object]:
    if not x_profile_id:
        raise HTTPException(status_code=400, detail="Profile header required")
    item = await service.set_rating(
        profile_id=x_profile_id,
        anime_id=body.anime_id,
        rating=body.rating,
    )
    return {"ok": True, "item": PreferenceItem.from_model(item)}
