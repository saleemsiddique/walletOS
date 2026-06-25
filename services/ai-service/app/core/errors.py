from typing import Any


class AppError(Exception):
    def __init__(
        self,
        message: str,
        status: int,
        code: str,
        details: list[Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.details = details


class ValidationError(AppError):
    def __init__(
        self, message: str = "Validation failed", details: list[Any] | None = None
    ) -> None:
        super().__init__(message, 400, "VALIDATION_ERROR", details)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, 401, "UNAUTHORIZED")


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message, 403, "FORBIDDEN")


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found") -> None:
        super().__init__(message, 404, "NOT_FOUND")


class ConflictError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 409, "CONFLICT")


class RateLimitedError(AppError):
    def __init__(self, message: str = "Too many requests") -> None:
        super().__init__(message, 429, "RATE_LIMITED")
