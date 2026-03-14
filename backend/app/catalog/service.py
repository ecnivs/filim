from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Anime, AnimeStats
from app.sources import AllAnimeSourceAdapter, AnimeSummaryModel, EpisodeSummaryModel


class CatalogService:
    """Catalog facade combining local cache and AllAnime source adapter."""

    def __init__(self, db: AsyncSession, source: AllAnimeSourceAdapter | None = None):
        self.db = db
        self.source = source or AllAnimeSourceAdapter()

    async def search(self, query: str, mode: str = "sub") -> list[AnimeSummaryModel]:
        results = await self.source.search_shows(query=query, mode=mode)
        if not results:
            return []

        # Group by english_title if available, otherwise title.
        # This helps merge entries that AllAnime lists separately for sub/dub
        # or different seasons that we might want to group (though usually seasons
        # stay separate unless titles are identical).
        merged: dict[str, AnimeSummaryModel] = {}
        for item in results:
            key = (item.english_title or item.title).lower().strip()
            if key not in merged:
                merged[key] = item
            else:
                # If we have a duplicate, we can try to merge metadata
                # but for simplicity we'll just keep the first one found
                # as the source usually orders by relevance.
                pass

        return list(merged.values())

    async def _upsert_anime_from_summary(self, summary: AnimeSummaryModel) -> None:
        """Persist or update a minimal Anime row for downstream features.

        This ensures that other services (e.g. sessions/continue-watching) can
        reliably join watch progress against anime metadata for titles and posters.
        """

        if not summary.id:
            return

        result = await self.db.execute(
            select(Anime).where(Anime.source_id == summary.id)
        )
        anime = result.scalar_one_or_none()

        if anime is None:
            anime = Anime(
                source_id=summary.id,
                title=summary.title or "",
                english_title=summary.english_title,
                alt_names=summary.alt_names,
                synopsis=summary.synopsis,
                genres=summary.tags or None,
                episode_count=summary.episode_count or None,
                poster_url=summary.poster_image_url,
            )
            self.db.add(anime)
        else:
            if summary.title:
                anime.title = summary.title
            if summary.english_title:
                anime.english_title = summary.english_title
            if summary.alt_names:
                anime.alt_names = summary.alt_names
            if summary.synopsis:
                anime.synopsis = summary.synopsis
            if summary.tags:
                anime.genres = summary.tags
            if summary.episode_count:
                anime.episode_count = summary.episode_count
            if summary.poster_image_url:
                anime.poster_url = summary.poster_image_url

        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()

    async def get_show_details(
        self,
        anime_id: str,
        mode: str = "sub",
        search_query: str | None = None,
    ) -> AnimeSummaryModel:
        """Return show metadata, with fallbacks for IDs that only resolve via search."""

        details = await self.source.get_show_details(show_id=anime_id, mode=mode)

        # Primary path: dedicated show details query returned something usable.
        summary: AnimeSummaryModel = details
        if not (details.title or details.episode_count):
            # Fallback 1: if the caller knows which search term produced this ID
            # (e.g. from the UI's search box), try to recover the matching entry
            # from a fresh search against the upstream API.
            if search_query:
                search_results = await self.source.search_shows(
                    query=search_query, mode=mode
                )
                for item in search_results:
                    if item.id == anime_id:
                        summary = item
                        break
                else:
                    summary = details
            else:
                # Fallback 2: broaden to a popular list so long-running or niche shows
                # like Boruto still have a good chance of being included.
                popular = await self.source.get_popular_shows(limit=400, mode=mode)
                for item in popular:
                    if item.id == anime_id:
                        summary = item
                        break
                else:
                    summary = details

        await self._upsert_anime_from_summary(summary)
        return summary

    async def get_episode_list(
        self,
        anime_id: str,
        mode: str = "sub",
        search_query: str | None = None,
    ) -> list[EpisodeSummaryModel]:
        episodes = await self.source.get_episode_list(show_id=anime_id, mode=mode)

        if episodes:
            return episodes

        # If the upstream episode list is empty but we know how many episodes
        # exist from the show details, synthesize a simple numeric list so the
        # UI can still present playable episodes.
        details = await self.get_show_details(
            anime_id=anime_id,
            mode=mode,
            search_query=search_query,
        )
        if details.episode_count > 0:
            return [
                EpisodeSummaryModel(number=str(i))
                for i in range(1, details.episode_count + 1)
            ]

        return episodes

    async def get_trending(self, limit: int = 20) -> list[AnimeSummaryModel]:
        """Return trending shows based on AnimeStats and source metadata."""

        try:
            stmt = (
                select(AnimeStats, Anime)
                .join(Anime, Anime.id == AnimeStats.anime_id)
                .order_by(
                    AnimeStats.is_trending.desc(), AnimeStats.device_count_30d.desc()
                )
                .limit(limit)
            )
            rows: Sequence[tuple[AnimeStats, Anime]] = (
                await self.db.execute(stmt)
            ).all()
        except Exception:
            rows = []

        if rows:
            results: list[AnimeSummaryModel] = []
            for _stats, anime in rows:
                results.append(
                    AnimeSummaryModel(
                        id=anime.source_id,
                        title=anime.title,
                        episode_count=anime.episode_count or 0,
                        synopsis=anime.synopsis,
                        tags=anime.genres or [],
                        poster_image_url=anime.poster_url,
                    )
                )
            return results

        # Fallback: when no local stats/DB are available yet, ask the source
        # adapter for a generic popular list so the home screen still has a
        # 'Trending' row.
        return await self.source.get_popular_shows(limit=limit)

    async def get_series_lineup(
        self, anime_id: str, mode: str = "sub"
    ) -> list[AnimeSummaryModel]:
        """Fetch all related seasons/shows for a given anime to build a series lineup.

        This currently only does a single-level fetch of related shows to stay
        performant, but could be extended to be recursive if needed.
        """
        root = await self.get_show_details(anime_id, mode=mode)
        if not root.related_shows:
            return [root]

        lineup = [root]
        # We only want to include clear seasons/sequels, not every
        # single related entity.
        for rel in root.related_shows:
            rel_id = rel.get("showId")
            relation = (rel.get("relation") or "").lower()

            # Filter for true seasons/sequels
            if relation not in [
                "sequel",
                "prequel",
                "side_story",
                "parent_story",
                "alternative_setting",
            ]:
                continue

            if not rel_id or any(item.id == rel_id for item in lineup):
                continue

            try:
                rel_show = await self.get_show_details(rel_id, mode=mode)
                lineup.append(rel_show)
            except Exception:
                continue

        # Sort by title or a hypothetical season number if we had one.
        # For now, we'll keep the root first and then others.
        return lineup
