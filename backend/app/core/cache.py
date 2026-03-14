import json
import functools
import hashlib
from typing import Any, Callable, TypeVar
from app.db.redis import redis_client

T = TypeVar("T")

def cache_response(ttl_seconds: int = 300, key_prefix: str = "filim:cache:"):
    """Decorator to cache function results in Redis."""
    def decorator(func: Callable[..., Any]):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a unique key based on function name and arguments
            # We skip 'self' for instance methods to avoid including object memory addresses
            cache_args = args[1:] if args and hasattr(args[0], "__class__") else args
            arg_str = json.dumps([cache_args, kwargs], sort_keys=True, default=str)
            arg_hash = hashlib.md5(arg_str.encode()).hexdigest()
            key = f"{key_prefix}{func.__name__}:{arg_hash}"

            # Check cache
            try:
                cached = await redis_client.get(key)
                if cached:
                    return json.loads(cached)
            except Exception:
                # Log error or fail gracefully
                pass

            # Call original function
            result = await func(*args, **kwargs)

            # Store in cache if not None
            if result is not None:
                try:
                    # Handle Pydantic models or lists of models
                    data_to_cache = result
                    if hasattr(result, "model_dump"):
                        data_to_cache = result.model_dump()
                    elif isinstance(result, list) and result:
                        if hasattr(result[0], "model_dump"):
                            data_to_cache = [item.model_dump() for item in result]
                    
                    await redis_client.setex(
                        key,
                        ttl_seconds,
                        json.dumps(data_to_cache)
                    )
                except Exception:
                    pass

            return result
        return wrapper
    return decorator
