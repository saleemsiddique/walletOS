from functools import lru_cache
from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LlmProvider = Literal["openai", "anthropic"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str
    redis_url: str
    rabbitmq_url: str

    internal_secret: str
    jwt_secret: str

    wallet_service_url: str
    user_service_url: str

    llm_provider_categorize: LlmProvider = "openai"
    llm_provider_insights: LlmProvider = "openai"

    openai_api_key: str | None = None
    openai_categorize_model: str = "gpt-4o-mini"
    openai_insights_model: str = "gpt-4o-mini"

    anthropic_api_key: str | None = None

    aws_region: str
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_s3_bucket: str

    insights_history_weeks: int = 8
    insights_cron_hour_utc: int = 6
    insights_cron_concurrency: int = 10

    port: int = 3003

    @model_validator(mode="after")
    def _require_active_provider_keys(self) -> Self:
        providers = {self.llm_provider_categorize, self.llm_provider_insights}
        if "openai" in providers and not self.openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY es obligatorio cuando algún LLM_PROVIDER_* es 'openai'"
            )
        if "anthropic" in providers and not self.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY es obligatorio cuando algún LLM_PROVIDER_* es 'anthropic'"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
