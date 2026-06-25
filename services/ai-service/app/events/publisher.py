import asyncio
import json
from datetime import UTC, date, datetime
from uuid import UUID

import aio_pika

from app.core.config import get_settings

_EXCHANGE = "walletOS.events"
_EVENT = "insight.generated"


class RabbitMQEventPublisher:
    def __init__(self, url: str) -> None:
        self._url = url
        self._lock = asyncio.Lock()
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._exchange: aio_pika.abc.AbstractExchange | None = None

    async def _exchange_handle(self) -> aio_pika.abc.AbstractExchange:
        async with self._lock:
            if self._connection is None or self._connection.is_closed:
                self._connection = await aio_pika.connect_robust(self._url)
                channel = await self._connection.channel()
                self._exchange = await channel.declare_exchange(
                    _EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
                )
            assert self._exchange is not None
            return self._exchange

    async def publish_insight_generated(
        self, user_id: UUID, insight_id: UUID, week_start: date
    ) -> None:
        exchange = await self._exchange_handle()
        payload = {
            "event": _EVENT,
            "timestamp": datetime.now(UTC).isoformat(),
            "data": {
                "user_id": str(user_id),
                "insight_id": str(insight_id),
                "week_start": week_start.isoformat(),
            },
        }
        message = aio_pika.Message(
            body=json.dumps(payload).encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await exchange.publish(message, routing_key=_EVENT)

    async def close(self) -> None:
        if self._connection is not None and not self._connection.is_closed:
            await self._connection.close()


def build_event_publisher() -> RabbitMQEventPublisher:
    return RabbitMQEventPublisher(get_settings().rabbitmq_url)
