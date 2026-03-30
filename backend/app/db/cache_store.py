import asyncio
from typing import Dict, Optional


class InMemoryCache:
    """A simple thread-safe-ish in-memory cache with TTL support."""

    def __init__(self):
        self._storage: Dict[str, str] = {}
        self._expiries: Dict[str, float] = {}

    async def get(self, key: str) -> Optional[str]:
        """Get a value from the cache if it hasn't expired."""
        now = asyncio.get_event_loop().time()
        if key in self._expiries:
            if self._expiries[key] < now:
                del self._storage[key]
                del self._expiries[key]
                return None
        return self._storage.get(key)

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        """Set a value in the cache with a TTL in seconds."""
        self._storage[key] = value
        self._expiries[key] = asyncio.get_event_loop().time() + seconds
        return True


cache_client = InMemoryCache()
