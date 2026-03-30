from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import CatalogService
from app.db.session import get_db
from app.sources import EpisodeSummaryModel


class AnimeSummaryResponse(BaseModel):
    id: str | None = None
    title: str
    episode_count: int
    poster_image_url: str | None = None
    synopsis: str | None = None
    tags: list[str] = []
    available_audio_languages: list[str] = []

    @classmethod
    def from_source(cls, src: Any) -> "AnimeSummaryResponse":
        if isinstance(src, dict):
            return cls(
                id=src.get("id"),
                title=src.get("title", ""),
                episode_count=src.get("episode_count", 0),
                poster_image_url=src.get("poster_image_url"),
                synopsis=src.get("synopsis"),
                tags=src.get("tags", []),
                available_audio_languages=src.get("available_audio_languages", []),
            )

        return cls(
            id=src.id,
            title=src.title,
            episode_count=src.episode_count,
            poster_image_url=src.poster_image_url,
            synopsis=src.synopsis,
            tags=src.tags,
            available_audio_languages=src.available_audio_languages,
        )


class EpisodeSummaryResponse(BaseModel):
    number: str
    title: str | None = None
    duration_seconds: int | None = None

    @classmethod
    def from_source(cls, src: EpisodeSummaryModel) -> "EpisodeSummaryResponse":
        return cls(
            number=src.number,
            title=src.title,
            duration_seconds=src.duration_seconds,
        )


class AnimeDetailsResponse(BaseModel):
    id: str | None = None
    title: str
    episode_count: int
    episodes: list[EpisodeSummaryResponse]
    synopsis: str | None = None
    tags: list[str] = []
    cover_image_url: str | None = None
    status: str | None = None
    available_audio_languages: list[str] = []


router = APIRouter()


def _get_catalog_service(db: AsyncSession = Depends(get_db)) -> CatalogService:
    return CatalogService(db=db)


@router.get("/search")
async def search_catalog(
    q: str = Query(..., min_length=1),
    mode: str = Query("sub", pattern="^(sub|dub)$"),
    catalog: CatalogService = Depends(_get_catalog_service),
) -> dict[str, list[AnimeSummaryResponse]]:
    items = await catalog.search(query=q, mode=mode)
    return {"items": [AnimeSummaryResponse.from_source(i) for i in items]}


@router.get("/trending")
async def get_trending(
    catalog: CatalogService = Depends(_get_catalog_service),
) -> dict[str, list[AnimeSummaryResponse]]:
    items = await catalog.get_trending()
    return {"items": [AnimeSummaryResponse.from_source(i) for i in items]}


@router.get("/{anime_id}")
async def get_anime_details(
    anime_id: str,
    mode: str = Query("sub", pattern="^(sub|dub)$"),
    q: str | None = Query(None, min_length=1),
    catalog: CatalogService = Depends(_get_catalog_service),
) -> AnimeDetailsResponse:
    details = await catalog.get_show_details(
        anime_id=anime_id,
        mode=mode,
        search_query=q,
    )
    episodes = await catalog.get_episode_list(
        anime_id=anime_id,
        mode=mode,
        search_query=q,
    )

    if (not details.title and details.episode_count == 0) and not episodes:
        raise HTTPException(status_code=404, detail="Anime not found")

    return AnimeDetailsResponse(
        id=details.id,
        title=details.title,
        episode_count=details.episode_count,
        episodes=[EpisodeSummaryResponse.from_source(e) for e in episodes],
        synopsis=details.synopsis,
        tags=details.tags,
        cover_image_url=details.poster_image_url,
        status=None,
        available_audio_languages=details.available_audio_languages,
    )


@router.get("/{anime_id}/episodes")
async def get_anime_episodes(
    anime_id: str,
    mode: str = Query("sub", pattern="^(sub|dub)$"),
    catalog: CatalogService = Depends(_get_catalog_service),
) -> dict[str, list[EpisodeSummaryResponse]]:
    episodes = await catalog.get_episode_list(anime_id=anime_id, mode=mode)
    return {"items": [EpisodeSummaryResponse.from_source(e) for e in episodes]}


@router.get("/{anime_id}/series")
async def get_anime_series(
    anime_id: str,
    mode: str = Query("sub", pattern="^(sub|dub)$"),
    catalog: CatalogService = Depends(_get_catalog_service),
) -> dict[str, list[AnimeSummaryResponse]]:
    """Return all related seasons/shows for a given anime to build a series lineup."""
    items = await catalog.get_series_lineup(anime_id=anime_id, mode=mode)
    return {"items": [AnimeSummaryResponse.from_source(i) for i in items]}
