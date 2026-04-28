"""Background cache warm-up for homepage endpoints.

Runs once per worker after startup. Fetches popular shows and top genre
searches so first-user requests hit L1 cache instead of FlareSolverr.
Failures are swallowed — warmup is best-effort and must never crash the app.
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

_SHOW_TARGETS = [
    {"limit": 40, "page": 1, "mode": "sub"},
    {"limit": 40, "page": 1, "mode": "dub"},
    {"limit": 40, "page": 1, "mode": "sub", "show_type": "Movie"},
]

# Top genres pre-warmed for discovery — covers first two scroll loads.
_TOP_GENRES = [
    "Action",
    "Adventure",
    "Comedy",
    "Fantasy",
    "Romance",
    "Drama",
    "Supernatural",
    "Sci-Fi",
    "Thriller",
    "Slice of Life",
]

_STAGGER_SECONDS = 1.2


async def warm_catalog_cache() -> None:
    from app.sources import get_catalog_adapter

    adapter = get_catalog_adapter()
    warmed = 0

    for kwargs in _SHOW_TARGETS:
        try:
            await adapter.get_popular_shows(**kwargs)
            warmed += 1
            logger.info("Warmup: get_popular_shows(%s)", kwargs)
        except Exception as exc:
            logger.warning("Warmup: failed get_popular_shows(%s): %s", kwargs, exc)
        await asyncio.sleep(_STAGGER_SECONDS)

    # Genre discovery — fire concurrently; cache_response deduplicates identical
    # in-flight requests so FlareSolverr won't get hammered.
    genre_tasks = [
        adapter.search_shows(query="", genres=[g], page=1) for g in _TOP_GENRES
    ]
    results = await asyncio.gather(*genre_tasks, return_exceptions=True)
    genre_hits = sum(1 for r in results if not isinstance(r, Exception) and r)
    logger.info("Warmup: genres %d/%d cached", genre_hits, len(_TOP_GENRES))
    warmed += genre_hits

    logger.info("Warmup complete: %d targets cached", warmed)


async def run_warmup() -> None:
    await asyncio.sleep(2)
    await warm_catalog_cache()
