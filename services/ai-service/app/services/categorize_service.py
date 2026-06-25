from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.clients.llm.base import CategorizeResult, CategoryInput, LLMClient
from app.clients.wallet_client import WalletClient
from app.services.cache import CacheClient

_CONFIDENCE_THRESHOLD = 0.5


class CategorizationResult(BaseModel):
    category_id: str | None
    category_name: str | None
    category_icon: str | None
    confidence: float


class CategorizeService:
    def __init__(
        self, llm_client: LLMClient, wallet_client: WalletClient, cache: CacheClient
    ) -> None:
        self._llm = llm_client
        self._wallet = wallet_client
        self._cache = cache

    async def categorize(
        self, note: str, txn_type: str, user_id: UUID
    ) -> CategorizationResult:
        cached = await self._cache.get_cached_categorize_result(note, txn_type, user_id)
        if cached is not None:
            return CategorizationResult.model_validate(cached)

        categories = await self._load_categories(user_id)
        llm_result = await self._llm.categorize(
            note, txn_type, [CategoryInput.model_validate(category) for category in categories]
        )

        result = self._enrich(llm_result, categories)
        await self._cache.cache_categorize_result(note, txn_type, user_id, result.model_dump())
        return result

    async def _load_categories(self, user_id: UUID) -> list[dict[str, Any]]:
        cached = await self._cache.get_cached_user_categories(user_id)
        if cached is not None:
            return cached
        categories = await self._wallet.get_categories(user_id)
        await self._cache.cache_user_categories(user_id, categories)
        return categories

    @staticmethod
    def _enrich(
        llm_result: CategorizeResult, categories: list[dict[str, Any]]
    ) -> CategorizationResult:
        if llm_result.confidence < _CONFIDENCE_THRESHOLD or llm_result.category_id is None:
            return CategorizationResult(
                category_id=None, category_name=None, category_icon=None,
                confidence=llm_result.confidence,
            )

        match = next(
            (category for category in categories if category["id"] == llm_result.category_id),
            None,
        )
        if match is None:
            # El LLM devolvió un id que no existe en la lista: trátalo como sin categoría.
            return CategorizationResult(
                category_id=None, category_name=None, category_icon=None, confidence=0.0
            )

        return CategorizationResult(
            category_id=llm_result.category_id,
            category_name=match["name"],
            category_icon=match.get("icon"),
            confidence=llm_result.confidence,
        )
