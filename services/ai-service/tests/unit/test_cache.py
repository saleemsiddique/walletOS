from uuid import uuid4

from fakeredis import aioredis

from app.services import cache as cache_module
from app.services.cache import CacheClient


def _client() -> CacheClient:
    return CacheClient(client=aioredis.FakeRedis())


async def test_set_and_get_json_round_trip() -> None:
    client = _client()

    await client.set_json("k", {"a": 1, "b": [2, 3]}, ttl=60)

    assert await client.get_json("k") == {"a": 1, "b": [2, 3]}


async def test_get_json_missing_returns_none() -> None:
    assert await _client().get_json("missing") is None


async def test_set_json_applies_ttl() -> None:
    fake = aioredis.FakeRedis()
    client = CacheClient(client=fake)

    await client.set_json("k", 1, ttl=60)

    ttl = await fake.ttl("k")
    assert 0 < ttl <= 60


async def test_categorize_result_helpers_hash_by_inputs() -> None:
    client = _client()
    user_id = uuid4()
    result = {"category_id": "x", "confidence": 0.9}

    await client.cache_categorize_result("Mercadona", "EXPENSE", user_id, result)

    assert await client.get_cached_categorize_result("Mercadona", "EXPENSE", user_id) == result
    assert await client.get_cached_categorize_result("Otra nota", "EXPENSE", user_id) is None


async def test_rate_limit_allows_up_to_max_then_blocks() -> None:
    client = _client()

    for _ in range(3):
        assert await client.is_within_rate_limit("user-1", 60, 3) is True

    assert await client.is_within_rate_limit("user-1", 60, 3) is False


async def test_rate_limit_resets_after_window(monkeypatch) -> None:
    client = _client()
    base = 1_000_000.0
    monkeypatch.setattr(cache_module.time, "time", lambda: base)

    for _ in range(2):
        assert await client.is_within_rate_limit("u", 10, 2) is True
    assert await client.is_within_rate_limit("u", 10, 2) is False

    monkeypatch.setattr(cache_module.time, "time", lambda: base + 11)
    assert await client.is_within_rate_limit("u", 10, 2) is True
