from collections.abc import AsyncIterator
from datetime import date
from typing import Any
from uuid import UUID, uuid4

import boto3
import pytest
import pytest_asyncio
from moto import mock_aws
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.clients.s3_client import S3Client
from app.core.config import get_settings
from app.db.base import Base
from app.db.models import WeeklyInsight
from app.events.consumer import handle_user_deleted

_BUCKET = "walletos-exports-test"
_REGION = "eu-west-1"


@pytest_asyncio.fixture
async def session_factory() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


def _payload(user_id: UUID) -> dict[str, Any]:
    return {"event": "user.deleted", "data": {"user_id": str(user_id)}}


async def _add_insight(factory: async_sessionmaker[AsyncSession], user_id: UUID) -> None:
    async with factory() as session:
        session.add(
            WeeklyInsight(
                user_id=user_id,
                week_start=date(2026, 4, 13),
                headline="x",
                facts=[],
                recommendations=[],
                summary_data={},
                summary_text="x",
            )
        )
        await session.commit()


async def _count(factory: async_sessionmaker[AsyncSession], user_id: UUID) -> int:
    async with factory() as session:
        total = await session.scalar(
            select(func.count()).select_from(WeeklyInsight).where(WeeklyInsight.user_id == user_id)
        )
        return int(total or 0)


class _S3Spy:
    def __init__(self) -> None:
        self.prefixes: list[str] = []

    async def delete_by_prefix(self, prefix: str) -> int:
        self.prefixes.append(prefix)
        return 0


async def test_deletes_only_target_user_insights(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    user_a, user_b = uuid4(), uuid4()
    await _add_insight(session_factory, user_a)
    await _add_insight(session_factory, user_b)
    spy = _S3Spy()

    await handle_user_deleted(_payload(user_a), session_factory, spy)  # type: ignore[arg-type]

    assert await _count(session_factory, user_a) == 0
    assert await _count(session_factory, user_b) == 1
    assert spy.prefixes == [f"{user_a}/"]


async def test_is_idempotent(session_factory: async_sessionmaker[AsyncSession]) -> None:
    user_id = uuid4()
    await _add_insight(session_factory, user_id)
    spy = _S3Spy()

    await handle_user_deleted(_payload(user_id), session_factory, spy)  # type: ignore[arg-type]
    await handle_user_deleted(_payload(user_id), session_factory, spy)  # type: ignore[arg-type]

    assert await _count(session_factory, user_id) == 0


async def test_malformed_payload_raises(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    with pytest.raises(KeyError):
        await handle_user_deleted({"data": {}}, session_factory, _S3Spy())  # type: ignore[arg-type]


async def test_deletes_s3_objects_by_prefix(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    user_a, user_b = uuid4(), uuid4()
    with mock_aws():
        s3 = boto3.client("s3", region_name=_REGION)
        s3.create_bucket(
            Bucket=_BUCKET, CreateBucketConfiguration={"LocationConstraint": _REGION}
        )
        s3.put_object(Bucket=_BUCKET, Key=f"{user_a}/2026-04-13.pdf", Body=b"x")
        s3.put_object(Bucket=_BUCKET, Key=f"{user_b}/2026-04-13.pdf", Body=b"x")

        await handle_user_deleted(_payload(user_a), session_factory, S3Client())

        remaining = {obj["Key"] for obj in s3.list_objects_v2(Bucket=_BUCKET).get("Contents", [])}
        assert remaining == {f"{user_b}/2026-04-13.pdf"}
