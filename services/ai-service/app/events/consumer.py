import json
from collections.abc import Callable
from typing import Any
from uuid import UUID

import aio_pika
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.clients.s3_client import S3Client
from app.core.logging import get_logger
from app.db.models import WeeklyInsight

logger = get_logger(__name__)

_EXCHANGE = "walletOS.events"
_QUEUE = "ai-service.user.deleted"
_ROUTING_KEY = "user.deleted"

SessionFactory = Callable[[], AsyncSession]


async def handle_user_deleted(
    payload: dict[str, Any], session_factory: SessionFactory, s3_client: S3Client
) -> None:
    user_id = UUID(payload["data"]["user_id"])

    async with session_factory() as session:
        await session.execute(delete(WeeklyInsight).where(WeeklyInsight.user_id == user_id))
        await session.commit()

    await s3_client.delete_by_prefix(f"{user_id}/")


class UserDeletedConsumer:
    def __init__(
        self, url: str, s3_client: S3Client, session_factory: async_sessionmaker[AsyncSession]
    ) -> None:
        self._url = url
        self._s3 = s3_client
        self._session_factory = session_factory
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None

    async def start(self) -> None:
        self._connection = await aio_pika.connect_robust(self._url)
        channel = await self._connection.channel()
        await channel.set_qos(prefetch_count=10)
        exchange = await channel.declare_exchange(
            _EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
        )
        queue = await channel.declare_queue(_QUEUE, durable=True)
        await queue.bind(exchange, routing_key=_ROUTING_KEY)
        await queue.consume(self._on_message)

    async def _on_message(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        # `requeue=True`: si el handler lanza, no se hace ack y RabbitMQ reentrega.
        async with message.process(requeue=True):
            payload = json.loads(message.body)
            await handle_user_deleted(payload, self._session_factory, self._s3)
            logger.info("user.deleted procesado", extra={"user_id": payload["data"]["user_id"]})

    async def stop(self) -> None:
        if self._connection is not None and not self._connection.is_closed:
            await self._connection.close()
