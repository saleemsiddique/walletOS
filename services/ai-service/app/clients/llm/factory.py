from typing import Literal

from app.clients.llm.anthropic_client import AnthropicClient
from app.clients.llm.base import LLMClient
from app.clients.llm.openai_client import OpenAIClient
from app.core.config import get_settings

Purpose = Literal["categorize", "insights"]


def get_llm_client(purpose: Purpose) -> LLMClient:
    settings = get_settings()
    provider = (
        settings.llm_provider_categorize
        if purpose == "categorize"
        else settings.llm_provider_insights
    )

    if provider == "anthropic":
        if settings.anthropic_api_key is None:
            raise ValueError("ANTHROPIC_API_KEY no configurada")
        return AnthropicClient(api_key=settings.anthropic_api_key)

    if settings.openai_api_key is None:
        raise ValueError("OPENAI_API_KEY no configurada")
    return OpenAIClient(
        api_key=settings.openai_api_key,
        categorize_model=settings.openai_categorize_model,
        insights_model=settings.openai_insights_model,
    )
