from uuid import UUID

from fastapi import Header
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.errors import UnauthorizedError


async def get_current_user_id(authorization: str | None = Header(default=None)) -> UUID:
    if authorization is None or not authorization.startswith("Bearer "):
        raise UnauthorizedError("Missing authorization header")

    token = authorization.removeprefix("Bearer ")

    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except JWTError as error:
        raise UnauthorizedError("Invalid or expired token") from error

    user_id = payload.get("userId")
    if not isinstance(user_id, str):
        raise UnauthorizedError("Invalid token payload")

    try:
        return UUID(user_id)
    except ValueError as error:
        raise UnauthorizedError("Invalid token payload") from error
