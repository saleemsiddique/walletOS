from datetime import date
from uuid import uuid4

import httpx
import pytest
import respx
from httpx import Response

from app.clients.wallet_client import WalletClient

_WALLET = "http://localhost:3002"


@respx.mock
async def test_get_transactions_parses_and_sends_internal_secret() -> None:
    route = respx.get(f"{_WALLET}/internal/transactions").mock(
        return_value=Response(200, json={"transactions": [{"id": "1", "amount": 42.3}]})
    )
    client = WalletClient()

    result = await client.get_transactions(uuid4(), date(2026, 4, 1), date(2026, 4, 30))
    await client.aclose()

    assert result == [{"id": "1", "amount": 42.3}]
    request = route.calls.last.request
    assert request.headers["x-internal-secret"] == "test-internal-secret"
    assert "user_id=" in str(request.url)
    assert "from=2026-04-01" in str(request.url)


@respx.mock
async def test_get_categories_parses() -> None:
    respx.get(f"{_WALLET}/internal/categories").mock(
        return_value=Response(200, json={"categories": [{"id": "c1", "name": "Comida"}]})
    )
    client = WalletClient()

    result = await client.get_categories(uuid4())
    await client.aclose()

    assert result == [{"id": "c1", "name": "Comida"}]


def test_wallet_client_timeouts() -> None:
    client = WalletClient()

    assert client._client.timeout.connect == 2.0
    assert client._client.timeout.read == 10.0


@respx.mock
async def test_retries_on_server_error() -> None:
    route = respx.get(f"{_WALLET}/internal/categories").mock(
        side_effect=[Response(500), Response(200, json={"categories": []})]
    )
    client = WalletClient()

    result = await client.get_categories(uuid4())
    await client.aclose()

    assert route.call_count == 2
    assert result == []


@respx.mock
async def test_does_not_retry_on_client_error() -> None:
    route = respx.get(f"{_WALLET}/internal/transactions").mock(return_value=Response(404))
    client = WalletClient()

    with pytest.raises(httpx.HTTPStatusError):
        await client.get_transactions(uuid4(), date(2026, 4, 1), date(2026, 4, 30))
    await client.aclose()

    assert route.call_count == 1
