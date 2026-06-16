import json
from typing import Any, cast

from openai import APIConnectionError, APIStatusError, AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.clients.llm.base import (
    CategorizeResult,
    CategoryInput,
    InsightResult,
    LLMClient,
)

_REQUEST_TIMEOUT_SECONDS = 20.0

# Prompts mínimos inline; las Ramas 10 y 17 los mueven a app/prompts/.
_CATEGORIZE_SYSTEM = (
    "Eres un clasificador de transacciones. Dada una nota y el tipo (EXPENSE/INCOME), "
    "elige una de las categorías del usuario. Devuelve JSON "
    '{ "category_id": "uuid-o-null", "confidence": 0.0-1.0 }.'
)
_INSIGHT_SYSTEM = (
    "Redactas insights financieros a partir de métricas ya calculadas. No inventes "
    'números. Devuelve JSON { "headline": str, "facts": [str], "recommendations": [str] }.'
)


def _is_retryable(exc: BaseException) -> bool:
    # Reintentar solo errores de servidor (5xx) y de conexión/timeout; nunca 4xx.
    if isinstance(exc, APIStatusError):
        return exc.status_code >= 500
    return isinstance(exc, APIConnectionError)


class OpenAIClient(LLMClient):
    def __init__(self, api_key: str, categorize_model: str, insights_model: str) -> None:
        self._client = AsyncOpenAI(
            api_key=api_key,
            timeout=_REQUEST_TIMEOUT_SECONDS,
            max_retries=0,
        )
        self._categorize_model = categorize_model
        self._insights_model = insights_model

    async def categorize(
        self, note: str, txn_type: str, categories: list[CategoryInput]
    ) -> CategorizeResult:
        user_prompt = json.dumps(
            {
                "note": note,
                "type": txn_type,
                "categories": [category.model_dump() for category in categories],
            },
            ensure_ascii=False,
        )
        data = await self._complete_json(self._categorize_model, _CATEGORIZE_SYSTEM, user_prompt)
        return CategorizeResult.model_validate(data)

    async def insight(self, snapshot: dict[str, Any]) -> InsightResult:
        user_prompt = json.dumps(snapshot, ensure_ascii=False, default=str)
        data = await self._complete_json(self._insights_model, _INSIGHT_SYSTEM, user_prompt)
        return InsightResult.model_validate(data)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, max=8),
        retry=retry_if_exception(_is_retryable),
        reraise=True,
    )
    async def _complete_json(
        self, model: str, system_prompt: str, user_prompt: str
    ) -> dict[str, Any]:
        messages: list[ChatCompletionMessageParam] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0,
        )
        content = response.choices[0].message.content
        if content is None:
            raise ValueError("respuesta vacía del modelo")
        return cast(dict[str, Any], json.loads(content))
