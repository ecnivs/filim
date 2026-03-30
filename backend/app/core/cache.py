import json
import functools
import hashlib
import logging
from typing import Any, Callable, TypeVar, Type, Optional
from pydantic import BaseModel
from app.db.cache_store import cache_client as redis_client

T = TypeVar("T")


def cache_response(
    ttl_seconds: int = 300,
    key_prefix: str = "filim:cache:",
    response_model: Optional[Type[BaseModel]] = None,
):
    """Decorator to cache function results with Pydantic model awareness."""

    def decorator(func: Callable[..., Any]):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            cache_args = args[1:] if args and hasattr(args[0], "__class__") else args
            arg_str = json.dumps([cache_args, kwargs], sort_keys=True, default=str)
            arg_hash = hashlib.md5(arg_str.encode()).hexdigest()
            key = f"{key_prefix}{func.__name__}:{arg_hash}"

            try:
                cached = await redis_client.get(key)
                if cached:
                    data = json.loads(cached)
                    if response_model:
                        if isinstance(data, list):
                            return [
                                response_model.model_validate(item) for item in data
                            ]
                        return response_model.model_validate(data)
                    return data
            except Exception:
                logging.exception(f"Cache read error for key: {key}")
                pass

            result = await func(*args, **kwargs)

            if result is not None:
                try:
                    data_to_cache = result
                    if isinstance(result, BaseModel):
                        data_to_cache = result.model_dump()
                    elif isinstance(result, list) and result:
                        if isinstance(result[0], BaseModel):
                            data_to_cache = [item.model_dump() for item in result]

                    await redis_client.setex(
                        key, ttl_seconds, json.dumps(data_to_cache)
                    )
                except Exception:
                    logging.exception(f"Cache write error for key: {key}")
                    pass

            return result

        return wrapper

    return decorator
