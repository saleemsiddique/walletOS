from datetime import date, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.core.errors import NotFoundError, ValidationError
from app.db.base import get_session
from app.db.models import WeeklyInsight

router = APIRouter(prefix="/insights", tags=["insights"])

_DEFAULT_LIMIT = 20
_MAX_LIMIT = 50
_CHART_PALETTE = [
    "#FF6B6B", "#4ECDC4", "#FFD93D", "#6C5CE7",
    "#00B894", "#FD79A8", "#FDCB6E", "#0984E3",
]


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


class InsightDetailResponse(BaseModel):
    id: UUID
    week_start: date
    headline: str
    facts: list[str]
    recommendations: list[str]
    charts: dict[str, Any]
    summary_text: str
    has_pdf: bool
    created_at: datetime


@router.get("/{week_start}")
async def get_insight(
    week_start: date,
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> InsightDetailResponse:
    if week_start.weekday() != 0:
        raise ValidationError("week_start debe ser un lunes")

    insight = await session.scalar(
        select(WeeklyInsight).where(
            WeeklyInsight.user_id == user_id, WeeklyInsight.week_start == week_start
        )
    )
    if insight is None:
        raise NotFoundError("insight no encontrado")

    return InsightDetailResponse(
        id=insight.id,
        week_start=insight.week_start,
        headline=insight.headline,
        facts=insight.facts,
        recommendations=insight.recommendations,
        charts=_build_charts(insight.summary_data),
        summary_text=insight.summary_text,
        has_pdf=insight.s3_key is not None,
        created_at=insight.created_at,
    )


def _build_charts(snapshot: dict[str, Any]) -> dict[str, Any]:
    comparisons = snapshot.get("comparisons_by_category", [])
    return {
        "category_breakdown": [
            {
                "name": item["category"],
                "amount": item["current"],
                "color": _CHART_PALETTE[index % len(_CHART_PALETTE)],
            }
            for index, item in enumerate(comparisons)
        ],
        "weekly_total_last_8w": snapshot.get("weekly_total_last_8w", []),
        "actual_vs_avg_by_category": [
            {"category": item["category"], "actual": item["current"], "avg_4w": item["avg_4w"]}
            for item in comparisons
        ],
        "top_transactions": [
            {
                "note": item.get("note"),
                "amount": item["amount"],
                "category": item["category"],
                "date": item["date"],
            }
            for item in snapshot.get("top_transactions", [])
        ],
    }
