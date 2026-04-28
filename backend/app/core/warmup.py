"""Background cache warm-up for homepage endpoints.

Runs once per worker after startup. Fetches the exact cache keys that
/catalog/shows, /catalog/movies, and /catalog/trending hit so first-user
requests are served from L1 instead of hammering upstream via FlareSolverr.

Failures are swallowed — warmup is best-effort and must never crash the app.
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

# (limit, page, mode) tuples matching the actual homepage API calls.
_WARM_TARGETS = [
    # /catalog/shows and /catalog/movies both call get_popular_shows(40, 1, "sub")
    {"limit": 40, "page": 1, "mode": "sub"},
    # /catalog/trending fallback calls get_popular_shows(20, 1) — mode defaults to "sub"
    {"limit": 20, "page": 1, "mode": "sub"},
    # dub variant for users who switch language
    {"limit": 40, "page": 1, "mode": "dub"},
]

# Delay between upstream fetches to avoid hammering the API.
_STAGGER_SECONDS = 1.5


async def warm_catalog_cache() -> None:
    """Pre-fetch homepage catalog data into the cache."""
    from app.sources import AllanimeCatalogAdapter

    adapter = AllanimeCatalogAdapter()
    warmed = 0

    for kwargs in _WARM_TARGETS:
        try:
            await adapter.get_popular_shows(**kwargs)
            warmed += 1
            logger.info("Warmup: cached get_popular_shows(%s)", kwargs)
        except Exception as exc:
            logger.warning("Warmup: failed get_popular_shows(%s): %s", kwargs, exc)

        if kwargs is not _WARM_TARGETS[-1]:
            await asyncio.sleep(_STAGGER_SECONDS)

    logger.info("Warmup complete: %d/%d targets cached", warmed, len(_WARM_TARGETS))


async def run_warmup() -> None:
    """Entry point — run as a background task from lifespan."""
    # Small delay so the server finishes binding before we fire upstream requests.
    await asyncio.sleep(2)
    await warm_catalog_cache()
