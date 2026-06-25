import time
from typing import Any
from uuid import uuid4

import pytest
from jose import jwt

from app.api.deps import get_current_user_id
from app.core.config import get_settings
from app.core.errors import UnauthorizedError


def _encode(payload: dict[str, Any], secret: str | None = None) -> str:
    return jwt.encode(payload, secret or get_settings().jwt_secret, algorithm="HS256")


async def test_valid_token_returns_user_id() -> None:
    user_id = uuid4()
    token = _encode({"userId": str(user_id)})

    assert await get_current_user_id(f"Bearer {token}") == user_id


async def test_expired_token_raises_401() -> None:
    token = _encode({"userId": str(uuid4()), "exp": int(time.time()) - 10})

    with pytest.raises(UnauthorizedError):
        await get_current_user_id(f"Bearer {token}")


async def test_wrong_signature_raises_401() -> None:
    token = _encode({"userId": str(uuid4())}, secret="otro-secreto-distinto")

    with pytest.raises(UnauthorizedError):
        await get_current_user_id(f"Bearer {token}")


async def test_missing_header_raises_401() -> None:
    with pytest.raises(UnauthorizedError):
        await get_current_user_id(None)


async def test_non_bearer_header_raises_401() -> None:
    with pytest.raises(UnauthorizedError):
        await get_current_user_id("Basic abc")
