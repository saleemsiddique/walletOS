import json
from typing import Any

import pytest
import respx
from httpx import Response
from openai import APIStatusError

from app.clients.llm.base import CategoryInput
from app.clients.llm.openai_client import _REQUEST_TIMEOUT_SECONDS, OpenAIClient

_ENDPOINT = "https://api.openai.com/v1/chat/completions"


def _completion(content: str) -> dict[str, Any]:
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 0,
        "model": "gpt-4o-mini",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
    }


def _client() -> OpenAIClient:
    return OpenAIClient(
        api_key="sk-test", categorize_model="gpt-4o-mini", insights_model="gpt-4o-mini"
    )


@respx.mock
async def test_categorize_parses_response() -> None:
    respx.post(_ENDPOINT).mock(
        return_value=Response(
            200, json=_completion(json.dumps({"category_id": "abc", "confidence": 0.9}))
        )
    )

    categories = [CategoryInput(id="abc", name="Comida")]
    result = await _client().categorize("Mercadona", "EXPENSE", categories)

    assert result.category_id == "abc"
    assert result.confidence == 0.9


@respx.mock
async def test_insight_parses_response() -> None:
    payload = {
        "headline": "Has ahorrado el 30%",
        "facts": ["Gastaste 700 EUR"],
        "recommendations": ["Revisa restaurantes"],
    }
    respx.post(_ENDPOINT).mock(return_value=Response(200, json=_completion(json.dumps(payload))))

    result = await _client().insight({"total_spend": 700})

    assert result.headline == "Has ahorrado el 30%"
    assert result.facts == ["Gastaste 700 EUR"]
    assert result.recommendations == ["Revisa restaurantes"]


@respx.mock
async def test_retries_on_server_error() -> None:
    route = respx.post(_ENDPOINT).mock(
        side_effect=[
            Response(500),
            Response(200, json=_completion(json.dumps({"category_id": None, "confidence": 0.1}))),
        ]
    )

    result = await _client().categorize("x", "EXPENSE", [])

    assert route.call_count == 2
    assert result.category_id is None


@respx.mock
async def test_does_not_retry_on_client_error() -> None:
    route = respx.post(_ENDPOINT).mock(
        return_value=Response(400, json={"error": {"message": "bad"}})
    )

    with pytest.raises(APIStatusError):
        await _client().categorize("x", "EXPENSE", [])

    assert route.call_count == 1


def test_timeout_is_configured() -> None:
    assert _client()._client.timeout == _REQUEST_TIMEOUT_SECONDS
