from __future__ import annotations

import asyncio
import hashlib
import time
from collections import Counter
from datetime import datetime, timezone
from typing import List

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.service import CatalogService
from app.core.constants import COMMON_GENRES
from app.models import ProfileListEntry, Show, ShowStats, WatchProgress
from app.sources import ShowSummaryModel

# Module-level genre cache — recomputed every 5 min across all requests in worker.
_genres_cache: tuple[list[str], float] | None = None
_GENRES_TTL = 300


class RecommendationSectionModel(BaseModel):
    id: str
    title: str
    items: list[ShowSummaryModel]


def _seeded_shuffle(items: list, seed: str) -> list:
    """Deterministic Fisher-Yates shuffle using a string seed (LCG PRNG)."""
    items = list(items)
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    for i in range(len(items) - 1, 0, -1):
        h = (h * 1664525 + 1013904223) & 0xFFFFFFFF
        j = h % (i + 1)
        items[i], items[j] = items[j], items[i]
    return items


class RecommendationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.catalog = CatalogService(db=db)

    async def _shows_from_rows(self, rows: list[Show]) -> list[ShowSummaryModel]:
        return [
            ShowSummaryModel(
                id=row.source_id,
                title=row.title,
                episode_count=row.episode_count or 0,
                synopsis=row.synopsis,
                tags=row.genres or [],
                poster_image_url=row.poster_url,
                banner_image_url=row.cover_image_url,
            )
            for row in rows
        ]

    async def get_trending_section(self) -> RecommendationSectionModel:
        stmt = (
            select(Show)
            .join(ShowStats, ShowStats.show_id == Show.id)
            .order_by(ShowStats.is_trending.desc(), ShowStats.device_count_30d.desc())
            .limit(30)
        )
        try:
            rows = (await self.db.execute(stmt)).scalars().all()
        except Exception:
            rows = []

        items = await self._shows_from_rows(rows)
        if len(items) < 10:
            popular = await self.catalog.source.get_popular_shows(limit=30)
            items = items + [
                p
                for p in popular
                if not any(existing.id == p.id for existing in items)
            ]

        return RecommendationSectionModel(
            id="trending", title="Trending now", items=items
        )

    async def get_my_list_section(
        self, profile_id: str
    ) -> RecommendationSectionModel | None:
        stmt = select(ProfileListEntry).where(ProfileListEntry.profile_id == profile_id)
        try:
            entries = (await self.db.execute(stmt)).scalars().all()
        except Exception:
            entries = []

        if not entries:
            return None

        show_ids = [e.show_id for e in entries]

        stmt = select(Show).where(Show.source_id.in_(show_ids))
        try:
            db_rows = (await self.db.execute(stmt)).scalars().all()
        except Exception:
            db_rows = []

        db_map = {row.source_id: row for row in db_rows}

        items: list[ShowSummaryModel] = []
        for sid in show_ids:
            if sid in db_map:
                row = db_map[sid]
                items.append(
                    ShowSummaryModel(
                        id=row.source_id,
                        title=row.title,
                        episode_count=row.episode_count or 0,
                        synopsis=row.synopsis,
                        tags=row.genres or [],
                        poster_image_url=row.poster_url,
                        banner_image_url=row.cover_image_url,
                    )
                )
            else:
                try:
                    details = await self.catalog.get_show_details(show_id=sid)
                    items.append(details)
                except Exception:
                    continue

        if not items:
            return None

        return RecommendationSectionModel(id="my_list", title="My List", items=items)

    async def _profile_genre_counts(self, profile_id: str) -> Counter[str]:
        """Genre counts derived from this profile's watch history."""
        try:
            stmt = (
                select(WatchProgress.show_id)
                .where(WatchProgress.profile_id == profile_id)
                .distinct()
            )
            result = await self.db.execute(stmt)
            watched_ids = [row[0] for row in result.all()]
        except Exception:
            return Counter()

        if not watched_ids:
            return Counter()

        try:
            stmt = select(Show.genres).where(Show.source_id.in_(watched_ids))
            result = await self.db.execute(stmt)
            counts: Counter[str] = Counter()
            for row in result.scalars().all():
                if row:
                    counts.update([g.strip().title() for g in row if g.strip()])
            return counts
        except Exception:
            return Counter()

    async def _global_genre_counts(self) -> Counter[str]:
        counts: Counter[str] = Counter()
        try:
            result = await self.db.execute(select(Show.genres))
            for row in result.scalars().all():
                if row:
                    counts.update([g.strip().title() for g in row if g.strip()])
        except Exception:
            pass
        return counts

    async def get_for_you_section(
        self, profile_id: str | None = None
    ) -> RecommendationSectionModel:
        # Prefer profile watch-history genres; fall back to global distribution.
        genre_counts: Counter[str] = Counter()
        if profile_id:
            genre_counts = await self._profile_genre_counts(profile_id)
        if not genre_counts:
            genre_counts = await self._global_genre_counts()

        if genre_counts:
            top_genre = genre_counts.most_common(1)[0][0]
            filtered = await self.catalog.search(query="", genres=[top_genre], page=1)
            if len(filtered) >= 5:
                return RecommendationSectionModel(
                    id="for_you",
                    title="Recommended for you",
                    items=filtered[:20],
                )

        popular = await self.catalog.source.get_popular_shows(limit=50)
        offset_items = popular[10:30] if len(popular) > 10 else popular
        return RecommendationSectionModel(
            id="for_you",
            title="Recommended for you",
            items=offset_items,
        )

    async def _fetch_raw_genres(self) -> list[str]:
        # Always start with all known genres as a floor so the pool is never tiny.
        counts: Counter[str] = Counter({g: 1 for g in COMMON_GENRES})

        try:
            result = await self.db.execute(select(Show.genres))
            for row in result.scalars().all():
                if row:
                    counts.update([g.strip().title() for g in row if g.strip()])
        except Exception:
            pass

        # Fetch two pages of popular shows to pull in additional upstream genres.
        for page in (1, 2):
            try:
                popular = await self.catalog.source.get_popular_shows(
                    limit=50, page=page
                )
                for show in popular:
                    if show.tags:
                        counts.update(
                            [g.strip().title() for g in show.tags if g.strip()]
                        )
                if len(counts) >= 60:
                    break
            except Exception:
                break

        dynamic = []
        seen: set[str] = set()
        for g, _ in counts.most_common(200):
            if g not in seen:
                seen.add(g)
                dynamic.append(g)
                if len(dynamic) >= 150:
                    break

        return dynamic

    async def _get_dynamic_genres(
        self, exclude: List[str] | None = None, profile_id: str | None = None
    ) -> List[str]:
        global _genres_cache
        now = time.monotonic()

        if _genres_cache is None or now > _genres_cache[1]:
            genres = await self._fetch_raw_genres()
            _genres_cache = (genres, now + _GENRES_TTL)
        else:
            genres = _genres_cache[0]

        exclude_set = {g.strip().title() for g in (exclude or [])}
        genres = [g for g in genres if g not in exclude_set]

        # Shuffle deterministically per profile per day so different profiles
        # and different days yield different discovery orderings.
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        seed = f"{profile_id or 'guest'}:{today}"
        return _seeded_shuffle(genres, seed)

    async def get_discovery_sections(
        self,
        cursor: int = 0,
        limit: int = 3,
        profile_id: str | None = None,
    ) -> tuple[list[RecommendationSectionModel], int | None]:
        exclude_genres: list[str] = []
        try:
            for_you = await self.get_for_you_section(profile_id=profile_id)
            if "Recommended for " in for_you.title:
                genre_counts = await self._global_genre_counts()
                if genre_counts:
                    exclude_genres.append(genre_counts.most_common(1)[0][0])
        except Exception:
            pass

        genres = await self._get_dynamic_genres(
            exclude=exclude_genres, profile_id=profile_id
        )

        if not genres or cursor >= len(genres):
            return [], None

        batch_size = min(limit * 5, 25)
        end = min(cursor + batch_size, len(genres))
        batch = genres[cursor:end]

        results = await asyncio.gather(
            *[self.catalog.search(query="", genres=[g], page=1) for g in batch],
            return_exceptions=True,
        )

        sections: list[RecommendationSectionModel] = []
        seen_ids: set[str] = set()

        for genre, result in zip(batch, results):
            if len(sections) >= limit:
                break
            if isinstance(result, Exception) or not result:
                continue
            final_items = []
            for r in result:
                if r.id not in seen_ids:
                    final_items.append(r)
                    seen_ids.add(r.id)
                if len(final_items) >= 20:
                    break
            if final_items:
                slug = genre.lower().replace(" ", "_")
                sections.append(
                    RecommendationSectionModel(
                        id=f"genre_{slug}",
                        title=genre,
                        items=final_items,
                    )
                )

        next_cursor: int | None = end if end < len(genres) else None
        return sections, next_cursor

    async def get_device_recommendations(
        self,
        device_token: str,
        profile_id: str | None = None,
    ) -> List[RecommendationSectionModel]:
        is_guest = False

        if profile_id:
            from app.models.profiles import Profile

            profile = await self.db.get(Profile, profile_id)
            if profile and profile.is_guest:
                is_guest = True

        coros = []
        if not is_guest:
            coros.append(self.get_for_you_section(profile_id=profile_id))
        coros.append(self.get_trending_section())
        if profile_id and not is_guest:
            coros.append(self.get_my_list_section(profile_id=profile_id))

        results = await asyncio.gather(*coros, return_exceptions=True)

        sections: list[RecommendationSectionModel] = []
        seen_ids: set[str] = set()
        for r in results:
            if isinstance(r, Exception) or r is None:
                continue
            deduped = [item for item in r.items if item.id not in seen_ids]
            seen_ids.update(item.id for item in deduped)
            if deduped:
                sections.append(RecommendationSectionModel(
                    id=r.id, title=r.title, items=deduped
                ))

        return sections

    async def get_global_recommendations(self) -> List[RecommendationSectionModel]:
        trending = await self.get_trending_section()
        return [trending]
