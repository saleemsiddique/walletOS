from collections.abc import AsyncIterator
from datetime import date
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.db.base import Base
from app.db.models import WeeklyInsight


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    # Engine dedicado por test con NullPool: evita reutilizar conexiones asyncpg
    # entre los event loops que pytest-asyncio crea por función.
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


def _make_insight(user_id, week_start: date) -> WeeklyInsight:
    return WeeklyInsight(
        user_id=user_id,
        week_start=week_start,
        headline="Has ahorrado el 30% de tus ingresos",
        facts=["Gastaste 700 EUR", "Ingresaste 1000 EUR"],
        recommendations=["Revisa el gasto en restaurantes"],
        summary_data={"total_spend": 700.0, "total_income": 1000.0},
        summary_text="Has ahorrado el 30% de tus ingresos. Gastaste 700 EUR.",
    )


async def test_insert_and_read_weekly_insight(session: AsyncSession) -> None:
    user_id = uuid4()
    session.add(_make_insight(user_id, date(2026, 4, 13)))
    await session.commit()

    result = await session.scalar(
        select(WeeklyInsight).where(WeeklyInsight.user_id == user_id)
    )

    assert result is not None
    assert result.headline == "Has ahorrado el 30% de tus ingresos"
    assert result.facts == ["Gastaste 700 EUR", "Ingresaste 1000 EUR"]
    assert result.recommendations == ["Revisa el gasto en restaurantes"]
    assert result.summary_data == {"total_spend": 700.0, "total_income": 1000.0}
    assert result.s3_key is None
    assert result.created_at is not None


async def test_unique_user_id_week_start(session: AsyncSession) -> None:
    user_id = uuid4()
    week_start = date(2026, 4, 13)
    session.add(_make_insight(user_id, week_start))
    await session.commit()

    session.add(_make_insight(user_id, week_start))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_jsonb_fields_default_to_empty_lists(session: AsyncSession) -> None:
    insight = WeeklyInsight(
        user_id=uuid4(),
        week_start=date(2026, 4, 13),
        headline="Sin sugerencias",
        summary_data={"total_spend": 0.0},
        summary_text="Sin sugerencias.",
    )
    session.add(insight)
    await session.commit()
    await session.refresh(insight)

    assert insight.facts == []
    assert insight.recommendations == []
