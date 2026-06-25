from collections.abc import AsyncIterator
from datetime import date
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import UUID, uuid4

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.deps import get_current_user_id
from app.api.routes.insights import get_pdf_renderer
from app.clients.s3_client import get_s3_client
from app.core.config import get_settings
from app.db.base import Base, get_session
from app.db.models import WeeklyInsight
from app.main import create_app

_MONDAY = date(2026, 4, 13)
_SNAPSHOT: dict[str, Any] = {
    "comparisons_by_category": [],
    "weekly_total_last_8w": [],
    "top_transactions": [],
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


async def _seed(session: AsyncSession, user_id: UUID, *, s3_key: str | None) -> None:
    session.add(
        WeeklyInsight(
            user_id=user_id,
            week_start=_MONDAY,
            headline="Resumen",
            facts=[],
            recommendations=[],
            summary_data=_SNAPSHOT,
            summary_text="Resumen.",
            s3_key=s3_key,
        )
    )
    await session.commit()


def _s3_mock() -> AsyncMock:
    s3 = AsyncMock()
    s3.presigned_url.return_value = "https://bucket.s3/signed-url"
    s3.put_pdf.return_value = f"{uuid4()}/2026-04-13.pdf"
    return s3


def _app(session: AsyncSession, s3: AsyncMock, user_id: UUID | None = None) -> FastAPI:
    app = create_app()
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_s3_client] = lambda: s3
    app.dependency_overrides[get_pdf_renderer] = lambda: Mock(render=Mock(return_value=b"%PDF"))
    if user_id is not None:
        app.dependency_overrides[get_current_user_id] = lambda: user_id
    return app


async def _get(app: FastAPI) -> Response:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(f"/insights/{_MONDAY.isoformat()}/export")


async def test_requires_authentication(session: AsyncSession) -> None:
    assert (await _get(_app(session, _s3_mock()))).status_code == 401


async def test_existing_pdf_returns_presigned_url(session: AsyncSession) -> None:
    user_id = uuid4()
    await _seed(session, user_id, s3_key="user/2026-04-13.pdf")
    s3 = _s3_mock()

    response = await _get(_app(session, s3, user_id))

    assert response.status_code == 200
    assert response.json() == {"url": "https://bucket.s3/signed-url", "expires_in": 3600}
    s3.put_pdf.assert_not_called()


async def test_missing_pdf_is_generated_on_the_fly(session: AsyncSession) -> None:
    user_id = uuid4()
    await _seed(session, user_id, s3_key=None)
    s3 = _s3_mock()

    response = await _get(_app(session, s3, user_id))

    assert response.status_code == 200
    assert response.json()["url"] == "https://bucket.s3/signed-url"
    s3.put_pdf.assert_awaited_once()


async def test_not_found_returns_404(session: AsyncSession) -> None:
    response = await _get(_app(session, _s3_mock(), uuid4()))

    assert response.status_code == 404
