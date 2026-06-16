import respx
from httpx import Response

from app.clients.user_client import UserClient

_USER = "http://localhost:3001"


@respx.mock
async def test_list_active_users_parses_and_sends_internal_secret() -> None:
    route = respx.get(f"{_USER}/internal/users").mock(
        return_value=Response(200, json={"users": [{"id": "u1", "timezone": "Europe/Madrid"}]})
    )
    client = UserClient()

    result = await client.list_active_users()
    await client.aclose()

    assert result == [{"id": "u1", "timezone": "Europe/Madrid"}]
    assert route.calls.last.request.headers["x-internal-secret"] == "test-internal-secret"
