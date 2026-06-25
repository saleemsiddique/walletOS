from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.middleware.error_handler import register_error_handlers
from app.api.routes import categorize, health, insights


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # El scheduler (Rama 23) y el consumer de RabbitMQ (Rama 25) se conectan aquí.
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="WalletOS AI Service", lifespan=lifespan)
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(categorize.router)
    app.include_router(insights.router)
    return app


app = create_app()
