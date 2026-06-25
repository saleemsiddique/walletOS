from collections.abc import AsyncIterator
from datetime import date
from typing import Any
from uuid import UUID, uuid4

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.deps import get_current_user_id
from app.core.config import get_settings
from app.db.base import Base, get_session
from app.db.models import WeeklyInsight
from app.main import create_app

_MONDAY = date(2026, 4, 13)  # lunes
_TUESDAY = date(2026, 4, 14)

_SNAPSHOT: dict[str, Any] = {
    "comparisons_by_category": [
        {"category": "Comida", "current": 89.0, "avg_4w": 70.0, "delta_pct": 27.0, "z_score": 1.1},
        {"category": "Transporte", "current": 45.0, "avg_4w": 50.0, "delta_pct": -10.0, "z_score": 0.0},  # noqa: E501
    ],
    "weekly_total_last_8w": [{"week_start": "2026-02-23", "total": 300.0}],
    "top_transactions": [
        {"id": "t1", "category": "Deporte", "amount": 145.0, "note": "Decathlon", "date": "2026-04-17"},  # noqa: E501
    ],
}


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as db_session:
            yield db_session
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


async def _seed(session: AsyncSession, user_id: UUID) -> None:
    session.add(
        WeeklyInsight(
            user_id=user_id,
            week_start=_MONDAY,
            headline="Has ahorrado el 82%",
            facts=["Gastaste 387€"],
            recommendations=["Fija un tope semanal"],
            summary_data=_SNAPSHOT,
            summary_text="Esta semana gastaste 387€.",
            s3_key="key",
        )
    )
    await session.commit()


def _app(session: AsyncSession, user_id: UUID | None = None) -> FastAPI:
    app = create_app()
    app.dependency_overrides[get_session] = lambda: session
    if user_id is not None:
        app.dependency_overrides[get_current_user_id] = lambda: user_id
    return app


async def _get(app: FastAPI, path: str) -> Response:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path)


async def test_requires_authentication(session: AsyncSession) -> None:
    assert (await _get(_app(session), f"/insights/{_MONDAY.isoformat()}")).status_code == 401


async def test_returns_detail_with_charts(session: AsyncSession) -> None:
    user_id = uuid4()
    await _seed(session, user_id)

    response = await _get(_app(session, user_id), f"/insights/{_MONDAY.isoformat()}")

    assert response.status_code == 200
    body = response.json()
    assert body["headline"] == "Has ahorrado el 82%"
    assert body["recommendations"] == ["Fija un tope semanal"]
    assert body["has_pdf"] is True
    charts = body["charts"]
    assert charts["category_breakdown"][0] == {"name": "Comida", "amount": 89.0, "color": "#FF6B6B"}
    assert charts["actual_vs_avg_by_category"][0] == {
        "category": "Comida",
        "actual": 89.0,
        "avg_4w": 70.0,
    }
    assert charts["weekly_total_last_8w"] == [{"week_start": "2026-02-23", "total": 300.0}]
    assert charts["top_transactions"][0]["note"] == "Decathlon"


async def test_not_found_returns_404(session: AsyncSession) -> None:
    response = await _get(_app(session, uuid4()), f"/insights/{_MONDAY.isoformat()}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


async def test_non_monday_returns_400(session: AsyncSession) -> None:
    response = await _get(_app(session, uuid4()), f"/insights/{_TUESDAY.isoformat()}")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
