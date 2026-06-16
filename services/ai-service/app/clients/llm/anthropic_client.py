import json
from typing import Any, cast

from anthropic import AsyncAnthropic

from app.clients.llm.base import (
    CategorizeResult,
    CategoryInput,
    InsightResult,
    LLMClient,
)
from app.clients.llm.openai_client import _INSIGHT_SYSTEM
from app.prompts.categorize import SYSTEM_PROMPT as CATEGORIZE_SYSTEM
from app.prompts.categorize import build_user_prompt as build_categorize_prompt

_REQUEST_TIMEOUT_SECONDS = 20.0
_MAX_TOKENS = 1024
_DEFAULT_CATEGORIZE_MODEL = "claude-haiku-4-5"
_DEFAULT_INSIGHTS_MODEL = "claude-haiku-4-5"


class AnthropicClient(LLMClient):
    """Stub funcional. No se usa en v1, pero compila y cumple el contrato `LLMClient`."""

    def __init__(
        self,
        api_key: str,
        categorize_model: str = _DEFAULT_CATEGORIZE_MODEL,
        insights_model: str = _DEFAULT_INSIGHTS_MODEL,
    ) -> None:
        self._client = AsyncAnthropic(api_key=api_key, timeout=_REQUEST_TIMEOUT_SECONDS)
        self._categorize_model = categorize_model
        self._insights_model = insights_model

    async def categorize(
        self, note: str, txn_type: str, categories: list[CategoryInput]
    ) -> CategorizeResult:
        user_prompt = build_categorize_prompt(note, txn_type, categories)
        data = await self._complete_json(self._categorize_model, CATEGORIZE_SYSTEM, user_prompt)
        return CategorizeResult.model_validate(data)

    async def insight(self, snapshot: dict[str, Any]) -> InsightResult:
        user_prompt = json.dumps(snapshot, ensure_ascii=False, default=str)
        data = await self._complete_json(self._insights_model, _INSIGHT_SYSTEM, user_prompt)
        return InsightResult.model_validate(data)

    async def _complete_json(
        self, model: str, system_prompt: str, user_prompt: str
    ) -> dict[str, Any]:
        message = await self._client.messages.create(
            model=model,
            max_tokens=_MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        block = message.content[0]
        text = getattr(block, "text", None)
        if text is None:
            raise ValueError("respuesta vacía del modelo")
        return cast(dict[str, Any], json.loads(text))
