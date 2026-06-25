import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings

REQUIRED_FIELDS = {
    "database_url": "postgresql+asyncpg://walletos:test@localhost:5433/walletos_ai",
    "redis_url": "redis://localhost:6379",
    "rabbitmq_url": "amqp://walletos:test@localhost:5672",
    "internal_secret": "internal-secret",
    "jwt_secret": "jwt-secret",
    "wallet_service_url": "http://localhost:3002",
    "user_service_url": "http://localhost:3001",
    "aws_region": "eu-west-1",
    "aws_access_key_id": "key",
    "aws_secret_access_key": "secret",
    "aws_s3_bucket": "walletos-exports-dev",
}


def test_settings_parses_valid_env_file(tmp_path, monkeypatch):
    for key in [*[k.upper() for k in REQUIRED_FIELDS], "OPENAI_API_KEY"]:
        monkeypatch.delenv(key, raising=False)

    lines = [f"{key.upper()}={value}" for key, value in REQUIRED_FIELDS.items()]
    lines.append("OPENAI_API_KEY=sk-test")
    env_file = tmp_path / ".env"
    env_file.write_text("\n".join(lines))

    settings = Settings(_env_file=str(env_file))

    assert settings.port == 3003
    assert settings.insights_history_weeks == 8
    assert settings.insights_cron_hour_utc == 6
    assert settings.llm_provider_insights == "openai"
    assert settings.openai_insights_model == "gpt-4o-mini"
    assert settings.aws_s3_bucket == "walletos-exports-dev"


def test_settings_requires_openai_key_when_provider_is_openai(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None, **REQUIRED_FIELDS)


def test_settings_allows_missing_openai_key_when_provider_is_anthropic(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    settings = Settings(
        _env_file=None,
        llm_provider_categorize="anthropic",
        llm_provider_insights="anthropic",
        anthropic_api_key="ak-test",
        **REQUIRED_FIELDS,
    )

    assert settings.openai_api_key is None


def test_get_settings_returns_cached_instance(monkeypatch):
    for key, value in REQUIRED_FIELDS.items():
        monkeypatch.setenv(key.upper(), value)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    get_settings.cache_clear()

    first = get_settings()
    second = get_settings()

    assert first is second
