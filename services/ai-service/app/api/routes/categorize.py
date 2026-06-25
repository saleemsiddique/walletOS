from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user_id
from app.api.middleware.rate_limit import rate_limit
from app.clients.llm.factory import get_llm_client
from app.clients.wallet_client import WalletClient, get_wallet_client
from app.services.cache import CacheClient, get_cache_client
from app.services.categorize_service import CategorizeService

router = APIRouter(prefix="/categorize", tags=["categorize"])

_rate_limited = rate_limit("categorize", window_seconds=60, max_requests=60)


class CategorizeRequest(BaseModel):
    note: str
    type: Literal["EXPENSE", "INCOME"]


class CategorizeResponse(BaseModel):
    category_id: str | None
    category_name: str | None
    category_icon: str | None
    confidence: float


def get_categorize_service(
    wallet: WalletClient = Depends(get_wallet_client),
    cache: CacheClient = Depends(get_cache_client),
) -> CategorizeService:
    return CategorizeService(
        llm_client=get_llm_client("categorize"), wallet_client=wallet, cache=cache
    )


@router.post("", dependencies=[Depends(_rate_limited)])
async def categorize_transaction(
    body: CategorizeRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: CategorizeService = Depends(get_categorize_service),
) -> CategorizeResponse:
    result = await service.categorize(body.note, body.type, user_id)
    return CategorizeResponse.model_validate(result.model_dump())
