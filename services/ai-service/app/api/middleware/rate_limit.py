from collections.abc import Awaitable, Callable
from uuid import UUID

from fastapi import Depends

from app.api.deps import get_current_user_id
from app.core.errors import RateLimitedError
from app.services.cache import CacheClient, get_cache_client

KeyFn = Callable[[UUID], str]


def rate_limit(
    window_seconds: int, max_requests: int, key_fn: KeyFn | None = None
) -> Callable[..., Awaitable[None]]:
    async def dependency(
        user_id: UUID = Depends(get_current_user_id),
        cache: CacheClient = Depends(get_cache_client),
    ) -> None:
        identifier = key_fn(user_id) if key_fn is not None else str(user_id)
        if not await cache.is_within_rate_limit(identifier, window_seconds, max_requests):
            raise RateLimitedError()

    return dependency
