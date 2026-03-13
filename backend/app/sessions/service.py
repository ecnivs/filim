from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel
from sqlalchemy import Select, and_, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Anime, Device, DeviceToken, WatchProgress


class DeviceProfileModel(BaseModel):
    device_token: str
    mac_address: str
    device_name: Optional[str]


class WatchProgressModel(BaseModel):
    anime_id: str
    episode: str
    position_seconds: float
    duration_seconds: float
    last_updated: datetime
    is_finished: bool
    anime_title: str | None = None
    cover_image_url: str | None = None


def _normalize_mac(mac: str) -> str:
    value = mac.strip().lower().replace("-", ":")
    if ":" not in value and len(value) == 12:
        value = ":".join(value[i : i + 2] for i in range(0, 12, 2))
    return value


def _lookup_mac_for_ip(ip: str) -> str | None:
    """Best-effort lookup of a MAC address for a given IP from the ARP table."""

    try:
        with open("/proc/net/arp", encoding="utf8") as fh:
            # skip header
            next(fh)
            for line in fh:
                parts = line.split()
                if len(parts) >= 4 and parts[0] == ip:
                    mac = parts[3]
                    if mac != "00:00:00:00:00:00":
                        return mac
    except OSError:
        return None

    return None


@dataclass
class SessionService:
    db: AsyncSession

    async def register_device(self, mac_address: str, device_name: str | None) -> str:
        mac_norm = _normalize_mac(mac_address)

        stmt: Select[tuple[Device]] = select(Device).where(
            Device.mac_address == mac_norm
        )
        result = await self.db.execute(stmt)
        device = result.scalar_one_or_none()

        if device is None:
            device = Device(mac_address=mac_norm, device_name=device_name or None)
            self.db.add(device)
            await self.db.flush()

        token_value = str(uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.device_token_ttl_days
        )
        token = DeviceToken(
            device_id=device.id,
            token=token_value,
            expires_at=expires_at,
        )
        self.db.add(token)
        await self.db.commit()
        return token_value

    async def _get_device_by_token(self, device_token: str) -> Device:
        stmt = (
            select(Device)
            .join(DeviceToken, DeviceToken.device_id == Device.id)
            .where(
                and_(
                    DeviceToken.token == device_token,
                    or_(
                        DeviceToken.expires_at.is_(None),
                        DeviceToken.expires_at > datetime.now(timezone.utc),
                    ),
                )
            )
        )
        result = await self.db.execute(stmt)
        device = result.scalar_one_or_none()
        if device is None:
            raise ValueError("Invalid or expired device token")
        return device

    async def _get_or_create_device_by_mac(self, mac: str) -> Device:
        mac_norm = _normalize_mac(mac)
        stmt: Select[tuple[Device]] = select(Device).where(
            Device.mac_address == mac_norm
        )
        result = await self.db.execute(stmt)
        device = result.scalar_one_or_none()
        if device is None:
            device = Device(mac_address=mac_norm, device_name=None)
            self.db.add(device)
            await self.db.flush()
        return device

    async def resolve_device(
        self,
        device_token: str | None,  # unused; kept for API compatibility
        client_ip: str | None,  # unused; kept for API compatibility
    ) -> Device:
        """Resolve a Device without relying on MAC addresses or tokens.

        For now we treat all requests as coming from a single anonymous device so
        that "continue watching" works without any per-user tracking or ARP
        lookups. This keeps the rest of the session API stable while avoiding
        MAC-based identification.
        """

        return await self._get_or_create_device_by_mac("anonymous")

    async def get_device(self, device_token: str) -> DeviceProfileModel:
        device = await self._get_device_by_token(device_token)
        return DeviceProfileModel(
            device_token=device_token,
            mac_address=device.mac_address,
            device_name=device.device_name,
        )

    async def update_progress(
        self,
        device_token: str | None,
        client_ip: str | None,
        profile_id: str | None,
        anime_id: str,
        episode: str,
        position_seconds: float,
        duration_seconds: float,
        is_finished: bool | None,
    ) -> None:
        # Progress is always scoped to a profile; when no profile is active we
        # skip persistence so different profiles cannot share a single history.
        if not profile_id:
            return

        try:
            device = await self.resolve_device(
                device_token=device_token,
                client_ip=client_ip,
            )
        except ValueError:
            # When we cannot associate the request with a known device (no
            # token yet, ARP lookup failed, or token expired), skip persisting
            # progress instead of failing the endpoint. Playback should remain
            # functional even without resume support.
            return
        finished = bool(is_finished)
        if is_finished is None and duration_seconds > 0:
            ratio = position_seconds / duration_seconds
            finished = ratio >= 0.9

        now = datetime.now(timezone.utc)
        stmt = insert(WatchProgress).values(
            device_id=device.id,
            profile_id=profile_id,
            anime_id=anime_id,
            episode=episode,
            position_seconds=position_seconds,
            duration_seconds=duration_seconds,
            is_finished=finished,
            last_updated=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["device_id", "profile_id", "anime_id", "episode"],
            set_={
                "position_seconds": position_seconds,
                "duration_seconds": duration_seconds,
                "is_finished": finished,
                "last_updated": now,
            },
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def get_continue_watching(
        self,
        device_token: str | None,
        client_ip: str | None,
        profile_id: str | None,
        limit: int = 20,
    ) -> List[WatchProgressModel]:
        if not profile_id:
            return []

        device = await self.resolve_device(
            device_token=device_token, client_ip=client_ip
        )
        stmt: Select[tuple[WatchProgress, Anime]] = (
            select(WatchProgress, Anime)
            .join(Anime, Anime.source_id == WatchProgress.anime_id, isouter=True)
            .where(
                and_(
                    WatchProgress.device_id == device.id,
                    WatchProgress.profile_id == profile_id,
                    WatchProgress.is_finished.is_(False),
                )
            )
            .order_by(WatchProgress.last_updated.desc())
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).all()
        items: list[WatchProgressModel] = []
        for wp, anime in rows:
            items.append(
                WatchProgressModel(
                    anime_id=wp.anime_id,
                    episode=wp.episode,
                    position_seconds=wp.position_seconds,
                    duration_seconds=wp.duration_seconds,
                    last_updated=wp.last_updated,
                    is_finished=wp.is_finished,
                    anime_title=anime.title if anime is not None else None,
                    cover_image_url=(
                        anime.cover_image_url or anime.poster_url
                        if anime is not None
                        else None
                    ),
                )
            )
        return items
