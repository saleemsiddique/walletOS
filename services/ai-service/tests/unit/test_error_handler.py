from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.middleware.error_handler import register_error_handlers
from app.core.errors import NotFoundError


def _build_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/known-error")
    async def known_error() -> None:
        raise NotFoundError("insight no encontrado")

    @app.get("/unexpected-error")
    async def unexpected_error() -> None:
        raise RuntimeError("kaboom")

    @app.get("/needs-param")
    async def needs_param(value: int) -> dict[str, int]:
        return {"value": value}

    return app


def test_app_error_serializes_to_expected_shape() -> None:
    client = TestClient(_build_app())

    response = client.get("/known-error")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": "insight no encontrado"}
    }


def test_request_validation_error_returns_400() -> None:
    client = TestClient(_build_app())

    response = client.get("/needs-param")

    assert response.status_code == 400
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert "details" in body


def test_unexpected_exception_returns_500_internal_error() -> None:
    client = TestClient(_build_app(), raise_server_exceptions=False)

    response = client.get("/unexpected-error")

    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}
    }
