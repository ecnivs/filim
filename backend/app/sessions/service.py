from __future__ import annotations

from dataclasses import dataclass
import uuid
from datetime import datetime, timezone
from typing import List

from pydantic import BaseModel
from sqlalchemy import Select, and_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Anime, Device, WatchProgress


class WatchProgressModel(BaseModel):
    anime_id: str | None = None
    episode: str
    position_seconds: float
    duration_seconds: float
    last_updated: datetime
    is_finished: bool
    anime_title: str | None = None
    cover_image_url: str | None = None


@dataclass
class SessionService:
    db: AsyncSession

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
        stmt: Select[tuple[Device]] = select(Device).where(
            Device.mac_address == "anonymous"
        )
        result = await self.db.execute(stmt)
        device = result.scalar_one_or_none()
        if device is None:
            device = Device(mac_address="anonymous", device_name=None)
            self.db.add(device)
            await self.db.flush()
        return device

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
        def is_valid_uuid(val: str) -> bool:
            try:
                uuid.UUID(str(val))
                return True
            except (ValueError, TypeError):
                return False

        if not profile_id or not is_valid_uuid(profile_id):
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
        def is_valid_uuid(val: str) -> bool:
            try:
                uuid.UUID(str(val))
                return True
            except (ValueError, TypeError):
                return False

        if not profile_id or not is_valid_uuid(profile_id):
            return []

        device = await self.resolve_device(
            device_token=device_token, client_ip=client_ip
        )
        # Subquery: find the most recently updated row per anime_id so we only
        # return one entry per series (the latest episode the user watched).
        from sqlalchemy import func

        latest_sub = (
            select(
                WatchProgress.anime_id,
                func.max(WatchProgress.last_updated).label("max_updated"),
            )
            .where(
                and_(
                    WatchProgress.device_id == device.id,
                    WatchProgress.profile_id == profile_id,
                    WatchProgress.is_finished.is_(False),
                )
            )
            .group_by(WatchProgress.anime_id)
            .subquery()
        )

        stmt: Select[tuple[WatchProgress, Anime]] = (
            select(WatchProgress, Anime)
            .join(
                latest_sub,
                and_(
                    WatchProgress.anime_id == latest_sub.c.anime_id,
                    WatchProgress.last_updated == latest_sub.c.max_updated,
                ),
            )
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
