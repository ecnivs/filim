from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.sessions import SessionService, WatchProgressModel


class RegisterDeviceBody(BaseModel):
    mac_address: str
    device_name: Optional[str] = None


class RegisterDeviceResponse(BaseModel):
    device_token: str


class DeviceProfileResponse(BaseModel):
    device_token: str
    mac_address: str
    device_name: Optional[str]


class ProgressBody(BaseModel):
    anime_id: str
    episode: str
    position_seconds: float
    duration_seconds: float
    is_finished: Optional[bool] = None


class ContinueWatchingItem(BaseModel):
    anime_id: str
    episode: str
    position_seconds: float
    duration_seconds: float
    progress: float
    anime_title: Optional[str] = None
    cover_image_url: Optional[str] = None


router = APIRouter()


def _get_session_service(db: AsyncSession = Depends(get_db)) -> SessionService:
    return SessionService(db=db)


@router.post("/devices/register")
async def register_device(
    body: RegisterDeviceBody,
    service: SessionService = Depends(_get_session_service),
) -> RegisterDeviceResponse:
    token = await service.register_device(
        mac_address=body.mac_address,
        device_name=body.device_name,
    )
    return RegisterDeviceResponse(device_token=token)


@router.get("/devices/me")
async def get_device_me(
    x_device_token: str = Header(..., alias="X-Device-Token"),
    service: SessionService = Depends(_get_session_service),
) -> DeviceProfileResponse:
    profile = await service.get_device(device_token=x_device_token)
    return DeviceProfileResponse(
        device_token=profile.device_token,
        mac_address=profile.mac_address,
        device_name=profile.device_name,
    )


@router.post("/user/progress")
async def update_progress(
    body: ProgressBody,
    request: Request,
    x_device_token: str | None = Header(None, alias="X-Device-Token"),
    x_profile_id: str | None = Header(None, alias="X-Profile-Id"),
    service: SessionService = Depends(_get_session_service),
) -> dict[str, str]:
    await service.update_progress(
        device_token=x_device_token,
        client_ip=request.client.host if request.client else None,
        profile_id=x_profile_id,
        anime_id=body.anime_id,
        episode=body.episode,
        position_seconds=body.position_seconds,
        duration_seconds=body.duration_seconds,
        is_finished=body.is_finished,
    )
    return {"status": "ok"}


@router.get("/user/continue-watching")
async def continue_watching(
    request: Request,
    x_device_token: str | None = Header(None, alias="X-Device-Token"),
    x_profile_id: str | None = Header(None, alias="X-Profile-Id"),
    service: SessionService = Depends(_get_session_service),
) -> dict[str, list[ContinueWatchingItem]]:
    rows: list[WatchProgressModel] = await service.get_continue_watching(
        device_token=x_device_token,
        client_ip=request.client.host if request.client else None,
        profile_id=x_profile_id,
    )
    items: list[ContinueWatchingItem] = []
    for row in rows:
        progress = (
            row.position_seconds / row.duration_seconds
            if row.duration_seconds > 0
            else 0.0
        )
        items.append(
            ContinueWatchingItem(
                anime_id=row.anime_id,
                episode=row.episode,
                position_seconds=row.position_seconds,
                duration_seconds=row.duration_seconds,
                progress=progress,
                anime_title=row.anime_title,
                cover_image_url=row.cover_image_url,
            )
        )
    return {"items": items}
