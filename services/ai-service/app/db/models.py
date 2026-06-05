from datetime import date, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WeeklyInsight(Base):
    __tablename__ = "weekly_insights"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(nullable=False)
    week_start: Mapped[date] = mapped_column(nullable=False)
    headline: Mapped[str] = mapped_column(Text, nullable=False)
    facts: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    recommendations: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    summary_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    s3_key: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "week_start"),
        Index("idx_weekly_insights_user_id", "user_id"),
    )
