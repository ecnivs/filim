from __future__ import annotations
from typing import List
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Anime, AnimeStats


class AnimeSummaryModel(BaseModel):
    id: str
    title: str
    episode_count: int
    synopsis: str | None = None
    tags: list[str] = []
    poster_image_url: str | None = None


class RecommendationSectionModel(BaseModel):
    id: str
    title: str
    items: list[AnimeSummaryModel]


class RecommendationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _anime_from_rows(self, rows: list[Anime]) -> list[AnimeSummaryModel]:
        return [
            AnimeSummaryModel(
                id=row.source_id,
                title=row.title,
                episode_count=row.episode_count or 0,
                synopsis=row.synopsis,
                tags=row.genres or [],
                poster_image_url=row.poster_url,
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
        return RecommendationSectionModel(
            id="trending", title="Trending now", items=items
        )

    async def get_device_recommendations(
        self,
        device_token: str,
    ) -> List[RecommendationSectionModel]:
        trending = await self.get_trending_section()
        for_you = RecommendationSectionModel(
            id="for_you",
            title="Recommended for you",
            items=trending.items,
        )
        return [for_you, trending]

    async def get_global_recommendations(self) -> List[RecommendationSectionModel]:
        trending = await self.get_trending_section()
        return [trending]
