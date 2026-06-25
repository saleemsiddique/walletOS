from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel


class CategoryInput(BaseModel):
    id: str
    name: str
    icon: str | None = None


class CategorizeResult(BaseModel):
    category_id: str | None
    confidence: float


class InsightResult(BaseModel):
    headline: str
    facts: list[str]
    recommendations: list[str]


class LLMClient(ABC):
    @abstractmethod
    async def categorize(
        self, note: str, txn_type: str, categories: list[CategoryInput]
    ) -> CategorizeResult: ...

    @abstractmethod
    async def insight(self, snapshot: dict[str, Any]) -> InsightResult: ...
