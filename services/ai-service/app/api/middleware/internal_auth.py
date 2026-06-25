from fastapi import Header

from app.core.config import get_settings
from app.core.errors import UnauthorizedError


async def require_internal_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    if x_internal_secret is None or x_internal_secret != get_settings().internal_secret:
        raise UnauthorizedError("Invalid or missing internal secret")
