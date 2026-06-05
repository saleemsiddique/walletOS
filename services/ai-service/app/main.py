from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import health


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # El scheduler (Rama 23) y el consumer de RabbitMQ (Rama 25) se conectan aquí.
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="WalletOS AI Service", lifespan=lifespan)
    app.include_router(health.router)
    return app


app = create_app()
