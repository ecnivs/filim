from __future__ import annotations

import asyncio
import time
from collections import Counter
from typing import List

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.service import CatalogService
from app.models import ProfileListEntry, Show, ShowStats
from app.sources import ShowSummaryModel

# Module-level genre cache — recomputed every 5 min across all requests in worker.
_genres_cache: tuple[list[str], float] | None = None
_GENRES_TTL = 300


class RecommendationSectionModel(BaseModel):
    id: str
    title: str
    items: list[ShowSummaryModel]


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

    async def get_for_you_section(
        self, profile_id: str | None = None
    ) -> RecommendationSectionModel:
        genre_counts: Counter[str] = Counter()

        try:
            stmt = select(Show.genres)
            result = await self.db.execute(stmt)
            for row in result.scalars().all():
                if row:
                    genre_counts.update([g.strip().title() for g in row if g.strip()])
        except Exception:
            pass

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
        counts: Counter[str] = Counter()

        try:
            stmt = select(Show.genres)
            result = await self.db.execute(stmt)
            for row in result.scalars().all():
                if row:
                    counts.update([g.strip().title() for g in row if g.strip()])
        except Exception:
            pass

        if len(counts) < 20:
            try:
                popular = await self.catalog.source.get_popular_shows(limit=50)
                for show in popular:
                    if show.tags:
                        counts.update(
                            [g.strip().title() for g in show.tags if g.strip()]
                        )
            except Exception:
                pass

        dynamic = []
        seen: set[str] = set()
        for g, _ in counts.most_common(200):
            if g not in seen:
                seen.add(g)
                dynamic.append(g)
                if len(dynamic) >= 100:
                    break

        return dynamic or ["Action", "Adventure", "Comedy"]

    async def _get_dynamic_genres(self, exclude: List[str] | None = None) -> List[str]:
        global _genres_cache
        now = time.monotonic()

        if _genres_cache is None or now > _genres_cache[1]:
            genres = await self._fetch_raw_genres()
            _genres_cache = (genres, now + _GENRES_TTL)
        else:
            genres = _genres_cache[0]

        exclude_set = {g.strip().title() for g in (exclude or [])}
        return [g for g in genres if g not in exclude_set]

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
                genre_counts: Counter[str] = Counter()
                stmt = select(Show.genres)
                result = await self.db.execute(stmt)
                for row in result.scalars().all():
                    if row:
                        genre_counts.update(
                            [g.strip().title() for g in row if g.strip()]
                        )
                if genre_counts:
                    exclude_genres.append(genre_counts.most_common(1)[0][0])
        except Exception:
            pass

        genres = await self._get_dynamic_genres(exclude=exclude_genres)

        if cursor >= len(genres) or not genres:
            return [], None

        # Fetch limit*2 genres concurrently to have buffer for empty results.
        batch_size = min(limit * 2, 10)
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

        # Build coroutines in display order, run all concurrently.
        coros = []
        include_for_you = not is_guest
        include_my_list = bool(profile_id and not is_guest)

        if include_for_you:
            coros.append(self.get_for_you_section(profile_id=profile_id))
        coros.append(self.get_trending_section())
        if include_my_list:
            coros.append(self.get_my_list_section(profile_id=profile_id))

        results = await asyncio.gather(*coros, return_exceptions=True)

        sections: list[RecommendationSectionModel] = []
        for r in results:
            if isinstance(r, Exception) or r is None:
                continue
            sections.append(r)

        return sections

    async def get_global_recommendations(self) -> List[RecommendationSectionModel]:
        trending = await self.get_trending_section()
        return [trending]
