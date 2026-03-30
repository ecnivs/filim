from __future__ import annotations
from dataclasses import dataclass
from typing import Any, List, Optional
import json
import re
import httpx
from pydantic import BaseModel
from app.core.config import settings
from app.core.cache import cache_response


class AnimeSummaryModel(BaseModel):
    id: Optional[str] = None
    title: str
    english_title: Optional[str] = None
    episode_count: int
    synopsis: Optional[str] = None
    tags: list[str] = []
    poster_image_url: Optional[str] = None

    available_audio_languages: list[str] = []
    related_shows: list[dict[str, Any]] = []
    alt_names: list[str] = []


class EpisodeSummaryModel(BaseModel):
    number: str
    title: Optional[str] = None
    duration_seconds: Optional[int] = None


class StreamCandidateModel(BaseModel):
    provider: str
    kind: str
    resolution: Optional[str] = None
    url: str
    has_subtitles: bool = False
    referer: Optional[str] = None


@dataclass
class _AllAnimeClient:
    base_url: str
    referer: str
    timeout: float

    async def query(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        """Execute a GraphQL query against the AllAnime API."""

        async with httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0 Safari/537.36"
                ),
                "Referer": self.referer,
                "Content-Type": "application/json",
            },
            timeout=self.timeout,
        ) as client:
            try:
                response = await client.get(
                    "",
                    params={
                        "query": query,
                        "variables": json.dumps(variables, separators=(",", ":")),
                    },
                )
                response.raise_for_status()
            except httpx.HTTPError:
                return {}

            data = response.json()
            if "errors" in data:
                return {}
            return data.get("data", {})


import html


def strip_html(text: str | None) -> str | None:
    if not text:
        return text
    text = html.unescape(text)
    text = re.sub(r"<(br\s*/?|/p)>", "\n", text, flags=re.IGNORECASE)
    return re.sub(r"<[^>]+>", "", text).strip()


class AllAnimeSourceAdapter:
    """Adapter that reimplements ani-cli behavior against the AllAnime GraphQL API."""

    def __init__(self) -> None:
        self._client = _AllAnimeClient(
            base_url=settings.allanime_api_url,
            referer=settings.allanime_referer,
            timeout=settings.http_timeout_seconds,
        )

    @cache_response(ttl_seconds=3600, response_model=AnimeSummaryModel)
    async def search_shows(
        self,
        query: str,
        mode: str = "sub",
    ) -> List[AnimeSummaryModel]:
        gql = (
            "query( $search: SearchInput $limit: Int $page: Int "
            "$translationType: VaildTranslationTypeEnumType "
            "$countryOrigin: VaildCountryOriginEnumType ) { "
            "shows( search: $search limit: $limit page: $page "
            "translationType: $translationType countryOrigin: $countryOrigin ) { "
            "edges { _id name englishName altNames description genres thumbnail "
            "availableEpisodesDetail __typename } } }"
        )
        variables = {
            "search": {
                "query": query,
                "allowAdult": False,
                "allowUnknown": False,
            },
            "limit": 40,
            "page": 1,
            "translationType": mode,
            "countryOrigin": "ALL",
        }
        data = await self._client.query(gql, variables)
        edges = data.get("shows", {}).get("edges", []) or []
        results: list[AnimeSummaryModel] = []
        for edge in edges:
            episodes_detail = edge.get("availableEpisodesDetail") or {}
            episode_count = len(episodes_detail.get(mode, []) or [])

            languages: list[str] = []
            if episodes_detail.get("sub"):
                languages.append("ja")
            if episodes_detail.get("dub"):
                languages.append("en")

            thumb = edge.get("thumbnail") or None
            if thumb and not thumb.startswith("http"):
                base = settings.allanime_api_url.rsplit("/api", 1)[0]
                thumb = f"{base}/{thumb.lstrip('/')}"
            source_id = edge.get("_id")
            title = edge.get("englishName") or edge.get("name") or ""
            results.append(
                AnimeSummaryModel(
                    id=str(source_id) if source_id else None,
                    title=title,
                    english_title=edge.get("englishName"),
                    episode_count=episode_count,
                    synopsis=strip_html(edge.get("description")) or None,
                    tags=list(edge.get("genres") or []),
                    poster_image_url=thumb,
                    available_audio_languages=languages,
                    alt_names=list(edge.get("altNames") or []),
                )
            )
        return results

    @cache_response(ttl_seconds=1800, response_model=AnimeSummaryModel)
    async def get_popular_shows(
        self,
        limit: int = 20,
        mode: str = "sub",
    ) -> list[AnimeSummaryModel]:
        """Best-effort popular list for use as a fallback 'Trending' row.

        This mirrors the search GraphQL but uses an empty query with
        allowUnknown=true to let the upstream API decide a reasonable default
        ordering.
        """

        gql = (
            "query( $search: SearchInput $limit: Int $page: Int "
            "$translationType: VaildTranslationTypeEnumType "
            "$countryOrigin: VaildCountryOriginEnumType ) { "
            "shows( search: $search limit: $limit page: $page "
            "translationType: $translationType countryOrigin: $countryOrigin ) { "
            "edges { _id name englishName altNames description genres thumbnail "
            "availableEpisodesDetail __typename } } }"
        )
        variables = {
            "search": {
                "query": "",
                "allowAdult": False,
                "allowUnknown": True,
            },
            "limit": limit,
            "page": 1,
            "translationType": mode,
            "countryOrigin": "ALL",
        }
        data = await self._client.query(gql, variables)
        edges = data.get("shows", {}).get("edges", []) or []
        results: list[AnimeSummaryModel] = []
        for edge in edges:
            episodes_detail = edge.get("availableEpisodesDetail") or {}
            episode_count = len(episodes_detail.get(mode, []) or [])

            languages: list[str] = []
            if episodes_detail.get("sub"):
                languages.append("ja")
            if episodes_detail.get("dub"):
                languages.append("en")

            thumb = edge.get("thumbnail") or None
            if thumb and not thumb.startswith("http"):
                base = settings.allanime_api_url.rsplit("/api", 1)[0]
                thumb = f"{base}/{thumb.lstrip('/')}"
            source_id = edge.get("_id")
            title = edge.get("englishName") or edge.get("name") or ""
            results.append(
                AnimeSummaryModel(
                    id=str(source_id) if source_id else None,
                    title=title,
                    english_title=edge.get("englishName"),
                    episode_count=episode_count,
                    synopsis=strip_html(edge.get("description")) or None,
                    tags=list(edge.get("genres") or []),
                    poster_image_url=thumb,
                    available_audio_languages=languages,
                    alt_names=list(edge.get("altNames") or []),
                )
            )
        return results

    @cache_response(ttl_seconds=3600, response_model=AnimeSummaryModel)
    async def get_show_details(
        self,
        show_id: str,
        mode: str = "sub",
    ) -> AnimeSummaryModel:
        gql = """
        query ($id: String!) {
          show(_id: $id) {
            _id
            name
            englishName
            altNames
            description
            genres
            thumbnail
            status
            relatedShows
            availableEpisodesDetail
          }
        }
        """
        variables = {"id": show_id}
        data = await self._client.query(gql, variables)
        show = data.get("show") or {}
        episodes_detail = show.get("availableEpisodesDetail") or {}

        primary_eps = episodes_detail.get(mode, []) or []
        if not primary_eps:
            fallback_mode = "dub" if mode == "sub" else "sub"
            primary_eps = episodes_detail.get(fallback_mode, []) or []

        episode_count = len(primary_eps)

        languages: list[str] = []
        if episodes_detail.get("sub"):
            languages.append("ja")
        if episodes_detail.get("dub"):
            languages.append("en")

        thumb = show.get("thumbnail") or None
        if thumb and not thumb.startswith("http"):
            base = settings.allanime_api_url.rsplit("/api", 1)[0]
            thumb = f"{base}/{thumb.lstrip('/')}"
        source_id = show.get("_id")
        title = show.get("englishName") or show.get("name") or ""
        return AnimeSummaryModel(
            id=str(source_id) if source_id else None,
            title=title,
            english_title=show.get("englishName"),
            episode_count=episode_count,
            synopsis=strip_html(show.get("description")) or None,
            tags=list(show.get("genres") or []),
            poster_image_url=thumb,
            available_audio_languages=languages,
            related_shows=list(show.get("relatedShows") or []),
            alt_names=list(show.get("altNames") or []),
        )

    @cache_response(ttl_seconds=3600, response_model=EpisodeSummaryModel)
    async def get_episode_list(
        self,
        show_id: str,
        mode: str = "sub",
    ) -> list[EpisodeSummaryModel]:
        gql = """
        query ($id: String!) {
          show(_id: $id) {
            availableEpisodesDetail
          }
        }
        """
        variables = {"id": show_id}
        data = await self._client.query(gql, variables)
        episodes_detail = data.get("show", {}).get("availableEpisodesDetail", {}) or {}

        detail = episodes_detail.get(mode, []) or []
        if not detail:
            fallback_mode = "dub" if mode == "sub" else "sub"
            detail = episodes_detail.get(fallback_mode, []) or []

        numbers = sorted({str(ep) for ep in detail})
        return [EpisodeSummaryModel(number=n) for n in numbers]

    async def get_stream_candidates(
        self,
        show_id: str,
        episode: str,
        mode: str = "sub",
    ) -> list[StreamCandidateModel]:
        """Resolve provider stream candidates for a given episode.

        This mirrors ani-cli's episode → sourceUrls → provider-flow at a high level,
        but uses Python and Pydantic instead of shell utilities.
        """

        gql = """
        query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
          episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) {
            episodeString
            sourceUrls
          }
        }
        """
        variables = {
            "showId": show_id,
            "translationType": mode,
            "episodeString": str(episode),
        }
        data = await self._client.query(gql, variables)
        episode_data = data.get("episode") or {}
        source_urls = episode_data.get("sourceUrls") or []

        if not source_urls:
            fallback_mode = "dub" if mode == "sub" else "sub"
            variables = {
                "showId": show_id,
                "translationType": fallback_mode,
                "episodeString": str(episode),
            }
            data = await self._client.query(gql, variables)
            episode_data = data.get("episode") or {}
            source_urls = episode_data.get("sourceUrls") or []

        candidates: list[StreamCandidateModel] = []
        for src in source_urls:
            source_name = (src.get("sourceName") or "").lower()

            downloads = src.get("downloads") or {}
            raw_url = downloads.get("downloadUrl") or src.get("sourceUrl") or ""

            url, kind, resolution, has_subtitles = self._decode_provider_url(
                source_name,
                raw_url,
            )
            if not url:
                continue
            candidates.append(
                StreamCandidateModel(
                    provider=source_name,
                    kind=kind,
                    resolution=resolution,
                    url=url,
                    has_subtitles=has_subtitles,
                    referer=settings.allanime_referer,
                )
            )
        return candidates

    def _decode_provider_url(
        self,
        provider: str,
        encoded: str,
    ) -> tuple[str | None, str, str | None, bool]:
        """Decode a provider-specific source URL token.

        The exact obfuscation used by AllAnime providers may change over time;
        this implementation intentionally mirrors ani-cli at a structural level
        without copying its code. It should be adapted as protocols evolve.
        """

        url = encoded
        kind = "m3u8" if ".m3u8" in url else "mp4"

        resolution: str | None = None
        if "1080" in url:
            resolution = "1080p"
        elif "720" in url:
            resolution = "720p"
        elif "480" in url:
            resolution = "480p"
        elif "360" in url:
            resolution = "360p"

        has_subtitles = "vtt" in url or "sub" in url
        return url, kind, resolution, has_subtitles
