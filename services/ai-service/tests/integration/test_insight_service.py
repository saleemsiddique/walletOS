from collections.abc import AsyncIterator
from datetime import date, timedelta
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.clients.llm.base import InsightResult
from app.core.config import get_settings
from app.db.base import Base
from app.db.models import WeeklyInsight
from app.services.insight_service import InsightService

_MONDAY = date(2026, 4, 13)


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


def _wallet_txn(day: date, txn_type: str, amount: float) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "wallet_id": "w1",
        "wallet_name": "Nómina",
        "bank_name": "Banco",
        "type": txn_type,
        "amount": amount,
        "category": {"id": "comida", "name": "Comida", "icon": "🍔", "type": txn_type},
        "note": "Comida",
        "date": day.isoformat(),
        "transfer_id": None,
        "created_at": f"{day.isoformat()}T10:00:00Z",
    }


def _service(session: AsyncSession, wallet_txns: list[dict[str, Any]], llm: AsyncMock) -> tuple:
    wallet = AsyncMock()
    wallet.get_transactions.return_value = wallet_txns
    s3 = AsyncMock()
    s3.put_pdf.return_value = "user/2026-04-13.pdf"
    publisher = AsyncMock()
    pdf = Mock()
    pdf.render.return_value = b"%PDF-1.4 fake"
    service = InsightService(llm, wallet, s3, publisher, pdf, session)
    return service, wallet, s3, publisher, pdf


def _llm_ok() -> AsyncMock:
    llm = AsyncMock()
    llm.insight.return_value = InsightResult(
        headline="Has gastado 50 EUR", facts=["Gastaste 50 EUR en Comida"], recommendations=[]
    )
    return llm


async def _count(session: AsyncSession) -> int:
    return int(await session.scalar(select(func.count()).select_from(WeeklyInsight)) or 0)


async def test_generates_persists_uploads_and_publishes(session: AsyncSession) -> None:
    llm = _llm_ok()
    service, _wallet, s3, publisher, pdf = _service(
        session, [_wallet_txn(_MONDAY, "EXPENSE", 50)], llm
    )

    insight = await service.generate(uuid4(), _MONDAY)

    assert insight is not None
    assert insight.headline == "Has gastado 50 EUR"
    assert insight.s3_key == "user/2026-04-13.pdf"
    assert insight.summary_text.startswith("Has gastado 50 EUR.")
    assert await _count(session) == 1
    pdf.render.assert_called_once()
    s3.put_pdf.assert_awaited_once()
    publisher.publish_insight_generated.assert_awaited_once()


async def test_no_transactions_in_target_week_returns_none(session: AsyncSession) -> None:
    llm = _llm_ok()
    service, _wallet, s3, _publisher, pdf = _service(
        session, [_wallet_txn(_MONDAY - timedelta(weeks=2), "EXPENSE", 50)], llm
    )

    insight = await service.generate(uuid4(), _MONDAY)

    assert insight is None
    llm.insight.assert_not_called()
    pdf.render.assert_not_called()
    s3.put_pdf.assert_not_called()
    assert await _count(session) == 0


async def test_second_run_updates_instead_of_inserting(session: AsyncSession) -> None:
    llm = _llm_ok()
    service, _wallet, _s3, _publisher, _pdf = _service(
        session, [_wallet_txn(_MONDAY, "EXPENSE", 50)], llm
    )
    user_id = uuid4()

    await service.generate(user_id, _MONDAY)
    await service.generate(user_id, _MONDAY)

    assert await _count(session) == 1


async def test_invalid_llm_response_does_not_persist(session: AsyncSession) -> None:
    llm = AsyncMock()
    llm.insight.side_effect = ValueError("respuesta inválida del modelo")
    service, _wallet, s3, _publisher, _pdf = _service(
        session, [_wallet_txn(_MONDAY, "EXPENSE", 50)], llm
    )

    with pytest.raises(ValueError, match="inválida"):
        await service.generate(uuid4(), _MONDAY)

    assert await _count(session) == 0
    s3.put_pdf.assert_not_called()
