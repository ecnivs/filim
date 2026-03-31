from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.profiles import ProfileModel, ProfileService


class ProfileResponse(BaseModel):
    id: str
    name: str
    is_locked: bool
    is_guest: bool

    @classmethod
    def from_model(cls, model: ProfileModel) -> "ProfileResponse":
        return cls(
            id=model.id,
            name=model.name,
            is_locked=model.is_locked,
            is_guest=model.is_guest,
        )


class CreateProfileBody(BaseModel):
    name: str
    pin: str | None = None


class UpdateProfileBody(BaseModel):
    name: str | None = None
    pin: str | None = None


class VerifyPinBody(BaseModel):
    pin: str


router = APIRouter()


def _get_profile_service(db: AsyncSession = Depends(get_db)) -> ProfileService:
    return ProfileService(db=db)


@router.get("")
async def list_profiles(
    service: ProfileService = Depends(_get_profile_service),
) -> dict[str, list[ProfileResponse]]:
    profiles = await service.list_profiles()
    return {"items": [ProfileResponse.from_model(p) for p in profiles]}


@router.get("/{profile_id}")
async def get_profile(
    profile_id: str,
    service: ProfileService = Depends(_get_profile_service),
) -> ProfileResponse:
    profile = await service.get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileResponse.from_model(profile)


@router.post("")
async def create_profile(
    body: CreateProfileBody,
    service: ProfileService = Depends(_get_profile_service),
) -> ProfileResponse:
    profile = await service.create_profile(name=body.name, pin=body.pin)
    return ProfileResponse.from_model(profile)


@router.patch("/{profile_id}")
async def update_profile(
    profile_id: str,
    body: UpdateProfileBody,
    service: ProfileService = Depends(_get_profile_service),
) -> ProfileResponse:
    try:
        profile = await service.update_profile(
            profile_id,
            name=body.name,
            pin=body.pin,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ProfileResponse.from_model(profile)


@router.delete("/{profile_id}")
async def delete_profile(
    profile_id: str,
    service: ProfileService = Depends(_get_profile_service),
) -> dict[str, str]:
    try:
        await service.delete_profile(profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "ok"}


@router.post("/{profile_id}/verify-pin")
async def verify_pin(
    profile_id: str,
    body: VerifyPinBody,
    service: ProfileService = Depends(_get_profile_service),
) -> dict[str, bool]:
    valid = await service.verify_pin(profile_id, pin=body.pin)
    if not valid:
        raise HTTPException(status_code=403, detail="Invalid PIN")
    return {"valid": True}
