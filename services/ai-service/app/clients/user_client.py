from typing import Any

import httpx

from app.clients.http_retry import DEFAULT_TIMEOUT, with_retry
from app.core.config import get_settings


class UserClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = httpx.AsyncClient(
            base_url=settings.user_service_url,
            timeout=DEFAULT_TIMEOUT,
            headers={"X-Internal-Secret": settings.internal_secret},
        )

    @with_retry
    async def list_active_users(self) -> list[dict[str, Any]]:
        response = await self._client.get("/internal/users")
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return list(data["users"])

    async def aclose(self) -> None:
        await self._client.aclose()
