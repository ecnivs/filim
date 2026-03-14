from redis.asyncio import Redis, from_url
from app.core.config import settings

class RedisClient:
    _instance: Redis | None = None

    @classmethod
    def get_instance(cls) -> Redis:
        if cls._instance is None:
            cls._instance = from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
        return cls._instance

redis_client = RedisClient.get_instance()
