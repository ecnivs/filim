import asyncio
from typing import Dict, Optional


class InMemoryCache:
    """A simple thread-safe-ish in-memory cache with background TTL cleanup."""

    def __init__(self):
        self._storage: Dict[str, str] = {}
        self._expiries: Dict[str, float] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start_cleanup(self, interval: int = 60):
        """Start a background task to prune expired keys."""
        if self._cleanup_task:
            return

        async def _cleanup_loop():
            while True:
                try:
                    await asyncio.sleep(interval)
                    await self.prune()
                except asyncio.CancelledError:
                    break
                except Exception:
                    pass

        self._cleanup_task = asyncio.create_task(_cleanup_loop())

    async def stop_cleanup(self):
        """Stop the background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

    async def prune(self):
        """One-pass pruning of all expired keys."""
        now = asyncio.get_event_loop().time()
        expired_keys = [k for k, t in self._expiries.items() if t < now]
        for k in expired_keys:
            self._storage.pop(k, None)
            self._expiries.pop(k, None)

    async def get(self, key: str) -> Optional[str]:
        """Get a value from the cache if it hasn't expired."""
        now = asyncio.get_event_loop().time()
        if key in self._expiries:
            if self._expiries[key] < now:
                self._storage.pop(key, None)
                self._expiries.pop(key, None)
                return None
        return self._storage.get(key)

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        """Set a value in the cache with a TTL in seconds."""
        self._storage[key] = value
        self._expiries[key] = asyncio.get_event_loop().time() + seconds
        return True


cache_client = InMemoryCache()
