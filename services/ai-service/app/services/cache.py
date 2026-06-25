import json
import time
from functools import lru_cache
from hashlib import sha256
from typing import Any, cast
from uuid import UUID, uuid4

import redis.asyncio as redis

from app.core.config import get_settings

_DAY_TTL_SECONDS = 86400

# Sliding window atómico (mismo patrón que user/wallet): elimina entradas viejas,
# cuenta, y solo añade la petición actual si está bajo el límite.
_SLIDING_WINDOW_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)

if count < max then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window_ms + 1000)
  return 0
else
  return 1
end
"""


class CacheClient:
    def __init__(self, client: redis.Redis | None = None) -> None:
        self._client = client if client is not None else redis.from_url(get_settings().redis_url)

    async def get_json(self, key: str) -> Any | None:
        raw = await self._client.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    async def set_json(self, key: str, value: Any, ttl: int) -> None:
        await self._client.set(key, json.dumps(value), ex=ttl)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def cache_user_categories(
        self, user_id: UUID, categories: list[dict[str, Any]], ttl: int = _DAY_TTL_SECONDS
    ) -> None:
        await self.set_json(self._categories_key(user_id), categories, ttl)

    async def get_cached_user_categories(self, user_id: UUID) -> list[dict[str, Any]] | None:
        return cast(
            "list[dict[str, Any]] | None", await self.get_json(self._categories_key(user_id))
        )

    async def cache_categorize_result(
        self,
        note: str,
        txn_type: str,
        user_id: UUID,
        result: dict[str, Any],
        ttl: int = _DAY_TTL_SECONDS,
    ) -> None:
        await self.set_json(self._categorize_key(note, txn_type, user_id), result, ttl)

    async def get_cached_categorize_result(
        self, note: str, txn_type: str, user_id: UUID
    ) -> dict[str, Any] | None:
        return cast(
            "dict[str, Any] | None",
            await self.get_json(self._categorize_key(note, txn_type, user_id)),
        )

    async def is_within_rate_limit(
        self, identifier: str, window_seconds: int, max_requests: int
    ) -> bool:
        now_ms = int(time.time() * 1000)
        member = f"{now_ms}:{uuid4().hex}"
        result = await self._client.eval(
            _SLIDING_WINDOW_SCRIPT,
            1,
            f"rl:{identifier}",
            str(now_ms),
            str(window_seconds * 1000),
            str(max_requests),
            member,
        )
        return int(result) == 0

    @staticmethod
    def _categories_key(user_id: UUID) -> str:
        return f"cat:user:{user_id}:categories"

    @staticmethod
    def _categorize_key(note: str, txn_type: str, user_id: UUID) -> str:
        digest = sha256(f"{note}|{txn_type}|{user_id}".encode()).hexdigest()
        return f"cat:result:{digest}"


@lru_cache
def get_cache_client() -> CacheClient:
    return CacheClient()
