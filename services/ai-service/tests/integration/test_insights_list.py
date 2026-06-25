from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta
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

_MONDAY = date(2026, 1, 5)
_BASE_TIME = datetime(2026, 1, 5, 6, 0, tzinfo=UTC)


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


async def _seed(session: AsyncSession, user_id: UUID, count: int) -> None:
    for index in range(count):
        session.add(
            WeeklyInsight(
                user_id=user_id,
                week_start=_MONDAY + timedelta(weeks=index),
                headline=f"Insight {index}",
                facts=[],
                recommendations=[],
                summary_data={},
                summary_text=f"texto {index}",
                s3_key="key" if index % 2 == 0 else None,
                created_at=_BASE_TIME + timedelta(seconds=index),
            )
        )
    await session.commit()


def _app(session: AsyncSession, user_id: UUID | None = None) -> FastAPI:
    app = create_app()
    app.dependency_overrides[get_session] = lambda: session
    if user_id is not None:
        app.dependency_overrides[get_current_user_id] = lambda: user_id
    return app


async def _get(app: FastAPI, params: dict[str, Any] | None = None) -> Response:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get("/insights", params=params)


async def test_requires_authentication(session: AsyncSession) -> None:
    response = await _get(_app(session))

    assert response.status_code == 401


async def test_empty_returns_no_insights(session: AsyncSession) -> None:
    response = await _get(_app(session, uuid4()))

    assert response.status_code == 200
    assert response.json() == {"insights": [], "next_cursor": None}


async def test_cursor_pagination_over_25_insights(session: AsyncSession) -> None:
    user_id = uuid4()
    await _seed(session, user_id, 25)
    app = _app(session, user_id)

    first = (await _get(app, {"limit": 20})).json()
    assert len(first["insights"]) == 20
    assert first["next_cursor"] is not None
    assert first["insights"][0]["headline"] == "Insight 24"  # más reciente primero
    assert first["insights"][0]["has_pdf"] is True

    second = (await _get(app, {"limit": 20, "cursor": first["next_cursor"]})).json()
    assert len(second["insights"]) == 5
    assert second["next_cursor"] is None
