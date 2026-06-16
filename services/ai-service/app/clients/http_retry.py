from collections.abc import Callable
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

# Timeouts compartidos para las llamadas a endpoints internos.
DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=2.0)


def is_retryable_http_error(exc: BaseException) -> bool:
    # Reintentar solo errores de servidor (5xx) y de transporte (conexión/timeout); nunca 4xx.
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return isinstance(exc, httpx.TransportError)


def with_retry() -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    return retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, max=8),
        retry=retry_if_exception(is_retryable_http_error),
        reraise=True,
    )
