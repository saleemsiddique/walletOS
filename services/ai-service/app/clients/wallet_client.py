from datetime import date
from functools import lru_cache
from typing import Any
from uuid import UUID

import httpx

from app.clients.http_retry import DEFAULT_TIMEOUT, with_retry
from app.core.config import get_settings


class WalletClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = httpx.AsyncClient(
            base_url=settings.wallet_service_url,
            timeout=DEFAULT_TIMEOUT,
            headers={"X-Internal-Secret": settings.internal_secret},
        )

    @with_retry
    async def get_transactions(
        self, user_id: UUID, from_: date, to: date
    ) -> list[dict[str, Any]]:
        response = await self._client.get(
            "/internal/transactions",
            params={"user_id": str(user_id), "from": from_.isoformat(), "to": to.isoformat()},
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return list(data["transactions"])

    @with_retry
    async def get_categories(self, user_id: UUID) -> list[dict[str, Any]]:
        response = await self._client.get(
            "/internal/categories", params={"user_id": str(user_id)}
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return list(data["categories"])

    async def aclose(self) -> None:
        await self._client.aclose()


@lru_cache
def get_wallet_client() -> WalletClient:
    return WalletClient()
