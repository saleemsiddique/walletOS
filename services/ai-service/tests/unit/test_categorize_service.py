from unittest.mock import AsyncMock
from uuid import uuid4

from app.clients.llm.base import CategorizeResult
from app.services.categorize_service import CategorizeService

_CATEGORIES = [
    {"id": "c1", "name": "Comida", "icon": "🍔", "type": "EXPENSE"},
    {"id": "c2", "name": "Transporte", "icon": "🚌", "type": "EXPENSE"},
]


def _service(cache: AsyncMock, llm: AsyncMock, wallet: AsyncMock) -> CategorizeService:
    return CategorizeService(llm_client=llm, wallet_client=wallet, cache=cache)


async def test_result_cache_hit_skips_llm_and_wallet() -> None:
    cache = AsyncMock()
    cache.get_cached_categorize_result.return_value = {
        "category_id": "c1",
        "category_name": "Comida",
        "category_icon": "🍔",
        "confidence": 0.9,
    }
    llm = AsyncMock()
    wallet = AsyncMock()

    result = await _service(cache, llm, wallet).categorize("Mercadona", "EXPENSE", uuid4())

    assert result.category_id == "c1"
    llm.categorize.assert_not_called()
    wallet.get_categories.assert_not_called()


async def test_categories_cache_hit_skips_wallet_but_calls_llm() -> None:
    cache = AsyncMock()
    cache.get_cached_categorize_result.return_value = None
    cache.get_cached_user_categories.return_value = _CATEGORIES
    llm = AsyncMock()
    llm.categorize.return_value = CategorizeResult(category_id="c1", confidence=0.9)
    wallet = AsyncMock()

    result = await _service(cache, llm, wallet).categorize("Mercadona", "EXPENSE", uuid4())

    assert result.category_name == "Comida"
    assert result.category_icon == "🍔"
    wallet.get_categories.assert_not_called()
    llm.categorize.assert_awaited_once()
    cache.cache_categorize_result.assert_awaited_once()


async def test_total_cache_miss_calls_wallet_and_caches_both() -> None:
    cache = AsyncMock()
    cache.get_cached_categorize_result.return_value = None
    cache.get_cached_user_categories.return_value = None
    wallet = AsyncMock()
    wallet.get_categories.return_value = _CATEGORIES
    llm = AsyncMock()
    llm.categorize.return_value = CategorizeResult(category_id="c2", confidence=0.95)

    result = await _service(cache, llm, wallet).categorize("Metro", "EXPENSE", uuid4())

    assert result.category_id == "c2"
    assert result.category_name == "Transporte"
    wallet.get_categories.assert_awaited_once()
    cache.cache_user_categories.assert_awaited_once()
    cache.cache_categorize_result.assert_awaited_once()


async def test_low_confidence_returns_null_category() -> None:
    cache = AsyncMock()
    cache.get_cached_categorize_result.return_value = None
    cache.get_cached_user_categories.return_value = _CATEGORIES
    llm = AsyncMock()
    llm.categorize.return_value = CategorizeResult(category_id="c1", confidence=0.31)
    wallet = AsyncMock()

    result = await _service(cache, llm, wallet).categorize("???", "EXPENSE", uuid4())

    assert result.category_id is None
    assert result.category_name is None
    assert result.confidence == 0.31


async def test_unknown_category_id_is_treated_as_no_match() -> None:
    cache = AsyncMock()
    cache.get_cached_categorize_result.return_value = None
    cache.get_cached_user_categories.return_value = _CATEGORIES
    llm = AsyncMock()
    llm.categorize.return_value = CategorizeResult(category_id="inexistente", confidence=0.9)
    wallet = AsyncMock()

    result = await _service(cache, llm, wallet).categorize("Algo", "EXPENSE", uuid4())

    assert result.category_id is None
    assert result.confidence == 0.0
