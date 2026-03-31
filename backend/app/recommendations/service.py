from __future__ import annotations
from collections import Counter
from typing import List
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Anime, AnimeStats, ProfileListEntry
from app.catalog.service import CatalogService


class AnimeSummaryModel(BaseModel):
    id: str
    title: str
    episode_count: int
    synopsis: str | None = None
    tags: list[str] = []
    poster_image_url: str | None = None
    banner_image_url: str | None = None

    @staticmethod
    def from_source(src) -> "AnimeSummaryModel":
        """Convert a source adapter AnimeSummaryModel to the local one."""
        return AnimeSummaryModel(
            id=src.id or "",
            title=src.title,
            episode_count=src.episode_count,
            synopsis=src.synopsis,
            tags=src.tags,
            poster_image_url=src.poster_image_url,
            banner_image_url=src.banner_image_url,
        )


class RecommendationSectionModel(BaseModel):
    id: str
    title: str
    items: list[AnimeSummaryModel]


class RecommendationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.catalog = CatalogService(db=db)

    async def _anime_from_rows(self, rows: list[Anime]) -> list[AnimeSummaryModel]:
        return [
            AnimeSummaryModel(
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
            select(Anime)
            .join(AnimeStats, AnimeStats.anime_id == Anime.id)
            .order_by(AnimeStats.is_trending.desc(), AnimeStats.device_count_30d.desc())
            .limit(30)
        )
        try:
            rows = (await self.db.execute(stmt)).scalars().all()
        except Exception:
            rows = []

        items = await self._anime_from_rows(rows)
        if len(items) < 10:
            popular = await self.catalog.source.get_popular_shows(limit=30)
            items = items + [
                AnimeSummaryModel.from_source(p)
                for p in popular
                if not any(existing.id == p.id for existing in items)
            ]

        return RecommendationSectionModel(
            id="trending", title="Trending now", items=items
        )

    async def get_my_list_section(
        self, profile_id: str
    ) -> RecommendationSectionModel | None:
        """Build a 'My List' section from the user's saved list entries."""
        stmt = select(ProfileListEntry).where(ProfileListEntry.profile_id == profile_id)
        try:
            entries = (await self.db.execute(stmt)).scalars().all()
        except Exception:
            entries = []

        if not entries:
            return None

        anime_ids = [e.anime_id for e in entries]

        stmt = select(Anime).where(Anime.source_id.in_(anime_ids))
        try:
            db_rows = (await self.db.execute(stmt)).scalars().all()
        except Exception:
            db_rows = []

        db_map = {row.source_id: row for row in db_rows}

        items: list[AnimeSummaryModel] = []
        for aid in anime_ids:
            if aid in db_map:
                row = db_map[aid]
                items.append(
                    AnimeSummaryModel(
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
                    details = await self.catalog.get_show_details(anime_id=aid)
                    items.append(AnimeSummaryModel.from_source(details))
                except Exception:
                    continue

        if not items:
            return None

        return RecommendationSectionModel(id="my_list", title="My List", items=items)

    async def get_for_you_section(
        self, profile_id: str | None = None
    ) -> RecommendationSectionModel:
        """Build a personalized 'For You' section based on library genres.

        Falls back to a distinct offset of popular shows so it never
        duplicates the Trending row.
        """
        genre_counts: Counter[str] = Counter()

        try:
            stmt = select(Anime.genres)
            result = await self.db.execute(stmt)
            for row in result.scalars().all():
                if row:
                    genre_counts.update([g.strip().title() for g in row if g.strip()])
        except Exception:
            pass

        if genre_counts:
            top_genre = genre_counts.most_common(1)[0][0]
            results = await self.catalog.search(query=top_genre, page=1)
            genre_lower = top_genre.lower()
            filtered = [
                r for r in results if any(tag.lower() == genre_lower for tag in r.tags)
            ]
            if len(filtered) >= 5:
                return RecommendationSectionModel(
                    id="for_you",
                    title="Recommended for you",
                    items=[AnimeSummaryModel.from_source(r) for r in filtered[:20]],
                )

        popular = await self.catalog.source.get_popular_shows(limit=50)
        offset_items = popular[10:30] if len(popular) > 10 else popular

        return RecommendationSectionModel(
            id="for_you",
            title="Recommended for you",
            items=[AnimeSummaryModel.from_source(r) for r in offset_items],
        )

    async def _get_dynamic_genres(self, exclude: List[str] | None = None) -> List[str]:
        """Extract and rank unique genres from the database and top trending source content."""
        counts = Counter()
        exclude_set = {g.strip().title() for g in (exclude or [])}

        try:
            stmt = select(Anime.genres)
            result = await self.db.execute(stmt)
            genre_rows = result.scalars().all()
            for row in genre_rows:
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
        seen = set()
        for g, _ in counts.most_common(200):
            if g not in seen and g not in exclude_set:
                seen.add(g)
                dynamic.append(g)
                if len(dynamic) >= 100:
                    break

        if not dynamic:
            return [
                g for g in ["Action", "Adventure", "Comedy"] if g not in exclude_set
            ]

        return dynamic

    async def get_discovery_sections(
        self, page: int = 1, limit: int = 3, profile_id: str | None = None
    ) -> List[RecommendationSectionModel]:
        """Fetch discovery sections (genres) for infinite scrolling.

        Tries to skip empty/failed genres to ensure each 'page' has content.
        """
        exclude_genres = []
        try:
            for_you = await self.get_for_you_section(profile_id=profile_id)
            if "Recommended for " in for_you.title:
                genre_counts: Counter[str] = Counter()
                stmt = select(Anime.genres)
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

        sections: list[RecommendationSectionModel] = []
        seen_ids: set[str] = set()

        batch_size = limit * 5
        start_idx = (page - 1) * limit
        genre_pool = genres[start_idx : start_idx + batch_size]

        if not genre_pool:
            return []

        for genre in genre_pool:
            if len(sections) >= limit:
                break

            try:
                results = await self.catalog.search(query=genre, page=1)
                if not results:
                    continue

                genre_lower = genre.lower()
                filtered = [
                    r
                    for r in results
                    if any(tag.lower() == genre_lower for tag in r.tags)
                    and r.id not in seen_ids
                ]

                if filtered:
                    section_items = [
                        AnimeSummaryModel.from_source(r) for r in filtered[:20]
                    ]
                    for item in section_items:
                        seen_ids.add(item.id)

                    sections.append(
                        RecommendationSectionModel(
                            id=f"genre_{genre.lower().replace(' ', '_')}_p{page}",
                            title=f"{genre} Anime",
                            items=section_items,
                        )
                    )
            except Exception:
                continue

        return sections

    async def get_device_recommendations(
        self,
        device_token: str,
        profile_id: str | None = None,
    ) -> List[RecommendationSectionModel]:
        sections: list[RecommendationSectionModel] = []
        is_guest = False

        if profile_id:
            from app.models.profiles import Profile

            profile = await self.db.get(Profile, profile_id)
            if profile and profile.is_guest:
                is_guest = True

        if not is_guest:
            for_you = await self.get_for_you_section(profile_id=profile_id)
            sections.append(for_you)

        trending = await self.get_trending_section()
        sections.append(trending)

        if profile_id and not is_guest:
            my_list = await self.get_my_list_section(profile_id=profile_id)
            if my_list:
                sections.append(my_list)

        return sections

    async def get_global_recommendations(self) -> List[RecommendationSectionModel]:
        trending = await self.get_trending_section()
        return [trending]
