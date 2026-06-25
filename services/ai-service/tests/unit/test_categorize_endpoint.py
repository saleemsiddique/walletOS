from typing import Any
from uuid import UUID, uuid4

from fakeredis import aioredis
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user_id
from app.api.routes.categorize import get_categorize_service
from app.main import create_app
from app.services.cache import CacheClient, get_cache_client
from app.services.categorize_service import CategorizationResult

_MATCHED = CategorizationResult(
    category_id="c1", category_name="Comida", category_icon="🍔", confidence=0.92
)
_UNMATCHED = CategorizationResult(
    category_id=None, category_name=None, category_icon=None, confidence=0.31
)


class _FakeCategorizeService:
    def __init__(self, result: CategorizationResult) -> None:
        self._result = result

    async def categorize(self, note: str, txn_type: str, user_id: UUID) -> CategorizationResult:
        return self._result


def _make_app(
    *,
    user_id: UUID | None = None,
    result: CategorizationResult = _MATCHED,
    cache: CacheClient | None = None,
) -> FastAPI:
    app = create_app()
    fake_cache = cache or CacheClient(client=aioredis.FakeRedis())
    app.dependency_overrides[get_cache_client] = lambda: fake_cache
    app.dependency_overrides[get_categorize_service] = lambda: _FakeCategorizeService(result)
    if user_id is not None:
        app.dependency_overrides[get_current_user_id] = lambda: user_id
    return app


def _post(app: FastAPI, body: dict[str, Any]) -> Any:
    return TestClient(app).post("/categorize", json=body)


def test_requires_authentication() -> None:
    response = _post(_make_app(), {"note": "Mercadona", "type": "EXPENSE"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_returns_enriched_category() -> None:
    app = _make_app(user_id=uuid4(), result=_MATCHED)

    response = _post(app, {"note": "Mercadona", "type": "EXPENSE"})

    assert response.status_code == 200
    assert response.json() == {
        "category_id": "c1",
        "category_name": "Comida",
        "category_icon": "🍔",
        "confidence": 0.92,
    }


def test_low_confidence_returns_null_category() -> None:
    app = _make_app(user_id=uuid4(), result=_UNMATCHED)

    response = _post(app, {"note": "???", "type": "EXPENSE"})

    assert response.status_code == 200
    body = response.json()
    assert body["category_id"] is None
    assert body["confidence"] == 0.31


def test_invalid_type_returns_400() -> None:
    app = _make_app(user_id=uuid4())

    response = _post(app, {"note": "Mercadona", "type": "FOO"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_rate_limit_blocks_after_max_requests() -> None:
    shared_cache = CacheClient(client=aioredis.FakeRedis())
    app = _make_app(user_id=uuid4(), result=_MATCHED, cache=shared_cache)
    client = TestClient(app)

    for _ in range(60):
        assert client.post("/categorize", json={"note": "x", "type": "EXPENSE"}).status_code == 200

    blocked = client.post("/categorize", json={"note": "x", "type": "EXPENSE"})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"
