from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.db.base import get_session
from app.db.models import WeeklyInsight

router = APIRouter(prefix="/insights", tags=["insights"])

_DEFAULT_LIMIT = 20
_MAX_LIMIT = 50


class InsightListItem(BaseModel):
    id: UUID
    week_start: date
    headline: str
    summary_text: str
    has_pdf: bool
    created_at: datetime


class InsightListResponse(BaseModel):
    insights: list[InsightListItem]
    next_cursor: UUID | None


@router.get("")
async def list_insights(
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
    cursor: UUID | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> InsightListResponse:
    stmt = select(WeeklyInsight).where(WeeklyInsight.user_id == user_id)

    if cursor is not None:
        anchor = await session.scalar(select(WeeklyInsight).where(WeeklyInsight.id == cursor))
        if anchor is not None:
            stmt = stmt.where(
                tuple_(WeeklyInsight.created_at, WeeklyInsight.id) < (anchor.created_at, anchor.id)
            )

    stmt = stmt.order_by(WeeklyInsight.created_at.desc(), WeeklyInsight.id.desc()).limit(limit + 1)
    rows = list(await session.scalars(stmt))

    has_more = len(rows) > limit
    items = rows[:limit]
    return InsightListResponse(
        insights=[
            InsightListItem(
                id=row.id,
                week_start=row.week_start,
                headline=row.headline,
                summary_text=row.summary_text,
                has_pdf=row.s3_key is not None,
                created_at=row.created_at,
            )
            for row in items
        ],
        next_cursor=items[-1].id if has_more and items else None,
    )
