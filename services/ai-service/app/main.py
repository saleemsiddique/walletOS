from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from app.api.middleware.error_handler import register_error_handlers
from app.api.routes import categorize, health, insights
from app.clients.s3_client import get_s3_client
from app.core.config import get_settings
from app.db.base import async_session_factory
from app.events.consumer import UserDeletedConsumer
from app.tasks.weekly_insights_cron import schedule_weekly_insights


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    scheduler = AsyncIOScheduler(timezone="UTC")
    schedule_weekly_insights(scheduler)
    scheduler.start()

    consumer = UserDeletedConsumer(
        get_settings().rabbitmq_url, get_s3_client(), async_session_factory
    )
    await consumer.start()

    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        await consumer.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="WalletOS AI Service", lifespan=lifespan)
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(categorize.router)
    app.include_router(insights.router)
    return app


app = create_app()
