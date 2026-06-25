from app.clients.llm.anthropic_client import AnthropicClient
from app.clients.llm.factory import get_llm_client
from app.clients.llm.openai_client import OpenAIClient
from app.core.config import get_settings


def test_factory_returns_openai_when_provider_is_openai() -> None:
    get_settings.cache_clear()

    assert isinstance(get_llm_client("categorize"), OpenAIClient)


def test_factory_returns_anthropic_when_provider_is_anthropic(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER_INSIGHTS", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "ak-test")
    get_settings.cache_clear()
    try:
        assert isinstance(get_llm_client("insights"), AnthropicClient)
    finally:
        get_settings.cache_clear()
