import json
from datetime import date
from uuid import uuid4

import aio_pika
import pytest_asyncio

from app.core.config import get_settings
from app.events.publisher import RabbitMQEventPublisher


@pytest_asyncio.fixture
async def insight_queue() -> aio_pika.abc.AbstractQueue:
    connection = await aio_pika.connect_robust(get_settings().rabbitmq_url)
    channel = await connection.channel()
    exchange = await channel.declare_exchange(
        "walletOS.events", aio_pika.ExchangeType.TOPIC, durable=True
    )
    queue = await channel.declare_queue("", exclusive=True)
    await queue.bind(exchange, routing_key="insight.generated")
    try:
        yield queue
    finally:
        await connection.close()


async def test_publishes_insight_generated_with_expected_payload(
    insight_queue: aio_pika.abc.AbstractQueue,
) -> None:
    publisher = RabbitMQEventPublisher(get_settings().rabbitmq_url)
    user_id, insight_id, week_start = uuid4(), uuid4(), date(2026, 4, 13)

    await publisher.publish_insight_generated(user_id, insight_id, week_start)

    incoming = await insight_queue.get(timeout=5)
    assert incoming is not None
    payload = json.loads(incoming.body)
    await incoming.ack()
    await publisher.close()

    assert payload["event"] == "insight.generated"
    assert payload["data"] == {
        "user_id": str(user_id),
        "insight_id": str(insight_id),
        "week_start": "2026-04-13",
    }
    assert incoming.delivery_mode == aio_pika.DeliveryMode.PERSISTENT
