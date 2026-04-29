from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import AppSettings, Profile
from app.profiles.service import ProfileModel, ProfileService, _hash_pin

router = APIRouter()

SETTINGS_ID = "singleton"


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def _get_settings(db: AsyncSession) -> AppSettings:
    s = await db.get(AppSettings, SETTINGS_ID)
    if s is None:
        raise HTTPException(500, "Settings not initialized")
    return s


async def require_admin(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> AppSettings:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    token = authorization.split(" ", 1)[1]
    s = await _get_settings(db)
    if s.admin_token != token:
        raise HTTPException(401, "Invalid token")
    if s.admin_token_expires and datetime.now(timezone.utc) > s.admin_token_expires:
        raise HTTPException(401, "Token expired")
    return s


# ── Public ────────────────────────────────────────────────────────────────────

class LoginBody(BaseModel):
    password: str


class VerifyLockBody(BaseModel):
    password: str


@router.post("/login")
async def admin_login(
    body: LoginBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    s = await _get_settings(db)
    if s.admin_password_hash != _sha256(body.password):
        raise HTTPException(401, "Invalid password")
    token = str(uuid4())
    s.admin_token = token
    s.admin_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.commit()
    return {"token": token}


@router.get("/public")
async def get_public_settings(db: AsyncSession = Depends(get_db)) -> dict:
    s = await _get_settings(db)
    return {
        "app_lock_enabled": s.app_lock_enabled,
        "allow_creating_profiles": s.allow_creating_profiles,
        "guest_profile_enabled": s.guest_profile_enabled,
        "max_profiles": s.max_profiles,
    }


@router.post("/verify-lock")
async def verify_lock(
    body: VerifyLockBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    s = await _get_settings(db)
    if not s.app_lock_enabled:
        return {"valid": True}
    if not s.app_lock_password_hash:
        return {"valid": True}
    if s.app_lock_password_hash != _sha256(body.password):
        raise HTTPException(403, "Invalid password")
    return {"valid": True}


# ── Admin-only ────────────────────────────────────────────────────────────────

class UpdateSettingsBody(BaseModel):
    admin_password: str | None = None
    app_lock_enabled: bool | None = None
    app_lock_password: str | None = None
    clear_app_lock_password: bool | None = None
    allow_creating_profiles: bool | None = None
    guest_profile_enabled: bool | None = None
    max_profiles: int | None = None
    clear_max_profiles: bool | None = None


class AdminSettingsResponse(BaseModel):
    app_lock_enabled: bool
    app_lock_has_password: bool
    allow_creating_profiles: bool
    guest_profile_enabled: bool
    max_profiles: int | None


@router.get("/settings")
async def get_settings(
    s: AppSettings = Depends(require_admin),
) -> AdminSettingsResponse:
    return AdminSettingsResponse(
        app_lock_enabled=s.app_lock_enabled,
        app_lock_has_password=bool(s.app_lock_password_hash),
        allow_creating_profiles=s.allow_creating_profiles,
        guest_profile_enabled=s.guest_profile_enabled,
        max_profiles=s.max_profiles,
    )


@router.patch("/settings")
async def update_settings(
    body: UpdateSettingsBody,
    s: AppSettings = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if body.admin_password is not None:
        s.admin_password_hash = _sha256(body.admin_password)
        # Invalidate current session so caller must re-login
        s.admin_token = None
        s.admin_token_expires = None

    if body.app_lock_enabled is not None:
        s.app_lock_enabled = body.app_lock_enabled

    if body.app_lock_password is not None:
        s.app_lock_password_hash = _sha256(body.app_lock_password)

    if body.clear_app_lock_password:
        s.app_lock_password_hash = None

    if body.allow_creating_profiles is not None:
        s.allow_creating_profiles = body.allow_creating_profiles

    if body.guest_profile_enabled is not None:
        s.guest_profile_enabled = body.guest_profile_enabled

    if body.clear_max_profiles:
        s.max_profiles = None
    elif body.max_profiles is not None:
        s.max_profiles = max(1, body.max_profiles)

    await db.commit()
    password_changed = body.admin_password is not None
    return {"status": "ok", "password_changed": password_changed}


class AdminProfileResponse(BaseModel):
    id: str
    name: str
    is_locked: bool
    is_guest: bool


@router.get("/profiles")
async def admin_list_profiles(
    _: AppSettings = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows = (await db.execute(select(Profile).order_by(Profile.created_at.asc()))).scalars().all()
    return {
        "items": [
            AdminProfileResponse(
                id=r.id, name=r.name, is_locked=r.is_locked, is_guest=r.is_guest
            )
            for r in rows
        ]
    }


class AdminCreateProfileBody(BaseModel):
    name: str
    pin: str | None = None


@router.post("/profiles")
async def admin_create_profile(
    body: AdminCreateProfileBody,
    _: AppSettings = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminProfileResponse:
    service = ProfileService(db=db)
    profile = await service.create_profile(name=body.name, pin=body.pin)
    return AdminProfileResponse(
        id=profile.id, name=profile.name, is_locked=profile.is_locked, is_guest=profile.is_guest
    )


@router.delete("/profiles/{profile_id}")
async def admin_delete_profile(
    profile_id: str,
    _: AppSettings = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await db.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(404, "Profile not found")
    await db.delete(profile)
    await db.commit()
    return {"status": "ok"}
