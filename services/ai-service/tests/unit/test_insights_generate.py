from datetime import UTC, date, datetime
from uuid import UUID, uuid4

from fakeredis import aioredis
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response

from app.api.deps import get_current_user_id
from app.api.routes.insights import get_insight_service
from app.db.models import WeeklyInsight
from app.main import create_app
from app.services.cache import CacheClient, get_cache_client


class _FakeInsightService:
    def __init__(self, result: WeeklyInsight | None) -> None:
        self._result = result

    async def generate(self, user_id: UUID, week_start: date) -> WeeklyInsight | None:
        return self._result


def _insight() -> WeeklyInsight:
    return WeeklyInsight(
        id=uuid4(),
        user_id=uuid4(),
        week_start=date(2026, 4, 13),
        headline="Resumen semanal",
        facts=["Gastaste 50 EUR"],
        recommendations=[],
        summary_data={
            "comparisons_by_category": [],
            "weekly_total_last_8w": [],
            "top_transactions": [],
        },
        summary_text="Resumen semanal.",
        s3_key="key",
        created_at=datetime(2026, 4, 20, 6, tzinfo=UTC),
    )


def _app(
    *,
    result: WeeklyInsight | None,
    user_id: UUID | None = None,
    cache: CacheClient | None = None,
) -> FastAPI:
    app = create_app()
    app.dependency_overrides[get_insight_service] = lambda: _FakeInsightService(result)
    app.dependency_overrides[get_cache_client] = lambda: cache or CacheClient(
        client=aioredis.FakeRedis()
    )
    if user_id is not None:
        app.dependency_overrides[get_current_user_id] = lambda: user_id
    return app


async def _post(app: FastAPI) -> Response:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/insights/generate")


async def test_requires_authentication() -> None:
    assert (await _post(_app(result=_insight()))).status_code == 401


async def test_returns_201_with_insight() -> None:
    response = await _post(_app(result=_insight(), user_id=uuid4()))

    assert response.status_code == 201
    assert response.json()["headline"] == "Resumen semanal"


async def test_returns_204_when_no_transactions() -> None:
    response = await _post(_app(result=None, user_id=uuid4()))

    assert response.status_code == 204
    assert response.content == b""


async def test_rate_limited_after_five_requests() -> None:
    shared_cache = CacheClient(client=aioredis.FakeRedis())
    app = _app(result=_insight(), user_id=uuid4(), cache=shared_cache)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for _ in range(5):
            assert (await client.post("/insights/generate")).status_code == 201
        assert (await client.post("/insights/generate")).status_code == 429
