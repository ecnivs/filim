"""Two-tier persistent cache: in-memory L1 + SQLite L2.

L1 (dict) serves reads with zero latency.  L2 (SQLite with WAL) ensures
cached API responses survive backend restarts so cold starts don't hammer
upstream through FlareSolverr.

On first access the L2 table is created (if needed) and all non-expired
rows are loaded into L1.  Every write goes to both tiers.  A background
task periodically prunes expired entries from both layers.

A single persistent aiosqlite connection is kept open for the worker's
lifetime, avoiding the overhead of open/close on every cache operation.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Dict, Optional, Tuple

import aiosqlite

logger = logging.getLogger(__name__)


def _db_path() -> str:
    from app.core.config import settings

    return os.path.join(settings.project_root, "cache.db")


class PersistentCache:
    """Two-tier cache backed by SQLite for cross-restart persistence."""

    def __init__(self) -> None:
        self._l1: Dict[str, Tuple[str, float]] = {}
        self._db: Optional[aiosqlite.Connection] = None
        self._initialized: bool = False
        self._init_lock: Optional[asyncio.Lock] = None
        self._cleanup_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Lazy initialisation (called on first get/set)
    # ------------------------------------------------------------------

    async def _ensure_init(self) -> None:
        if self._initialized:
            return
        if self._init_lock is None:
            self._init_lock = asyncio.Lock()
        async with self._init_lock:
            if self._initialized:
                return
            await self._bootstrap()
            self._initialized = True

    async def _get_db(self) -> aiosqlite.Connection:
        if self._db is None:
            self._db = await aiosqlite.connect(_db_path())
        return self._db

    async def _bootstrap(self) -> None:
        """Create schema and hydrate L1 from L2."""
        db = await self._get_db()
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA synchronous=NORMAL")
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS cache (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                expires_at REAL NOT NULL
            )
            """
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_cache_exp ON cache(expires_at)"
        )
        await db.commit()

        now = time.time()
        cursor = await db.execute(
            "SELECT key, value, expires_at FROM cache WHERE expires_at > ?",
            (now,),
        )
        rows = await cursor.fetchall()
        for key, value, exp in rows:
            self._l1[key] = (value, exp)
        logger.info("Cache: loaded %d entries from disk", len(rows))

        await db.execute("DELETE FROM cache WHERE expires_at <= ?", (now,))
        await db.commit()

    # ------------------------------------------------------------------
    # Public API (matches the old InMemoryCache interface)
    # ------------------------------------------------------------------

    async def get(self, key: str) -> Optional[str]:
        await self._ensure_init()
        now = time.time()

        entry = self._l1.get(key)
        if entry is not None:
            value, exp = entry
            if exp > now:
                return value
            del self._l1[key]
            return None

        # L2 lookup (another process may have written)
        try:
            db = await self._get_db()
            cursor = await db.execute(
                "SELECT value, expires_at FROM cache WHERE key = ?", (key,)
            )
            row = await cursor.fetchone()
            if row and row[1] > now:
                self._l1[key] = (row[0], row[1])
                return row[0]
        except Exception:
            logger.exception("Cache L2 read error for key: %s", key)

        return None

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        await self._ensure_init()
        expires_at = time.time() + seconds

        self._l1[key] = (value, expires_at)

        try:
            db = await self._get_db()
            await db.execute(
                "INSERT OR REPLACE INTO cache (key, value, expires_at) "
                "VALUES (?, ?, ?)",
                (key, value, expires_at),
            )
            await db.commit()
        except Exception:
            logger.exception("Cache L2 write error for key: %s", key)

        return True

    # ------------------------------------------------------------------
    # Lifecycle helpers (called from app lifespan)
    # ------------------------------------------------------------------

    async def start_cleanup(self, interval: int = 300) -> None:
        """Begin periodic pruning of expired entries."""
        await self._ensure_init()
        if self._cleanup_task is not None:
            return

        async def _loop() -> None:
            while True:
                try:
                    await asyncio.sleep(interval)
                    await self._prune()
                except asyncio.CancelledError:
                    break
                except Exception:
                    logger.exception("Cache cleanup tick failed")

        self._cleanup_task = asyncio.create_task(_loop())

    async def stop_cleanup(self) -> None:
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

        if self._db is not None:
            try:
                await self._db.close()
            except Exception:
                logger.exception("Cache DB close error")
            self._db = None

    async def _prune(self) -> None:
        now = time.time()
        expired = [k for k, (_, exp) in self._l1.items() if exp <= now]
        for k in expired:
            del self._l1[k]

        try:
            db = await self._get_db()
            await db.execute("DELETE FROM cache WHERE expires_at <= ?", (now,))
            await db.execute("PRAGMA wal_checkpoint(PASSIVE)")
            await db.commit()
        except Exception:
            logger.exception("Cache L2 prune error")

    async def clear(self) -> None:
        """Wipe both tiers entirely."""
        self._l1.clear()
        try:
            db = await self._get_db()
            await db.execute("DELETE FROM cache")
            await db.commit()
        except Exception:
            logger.exception("Cache clear error")


cache_client = PersistentCache()
