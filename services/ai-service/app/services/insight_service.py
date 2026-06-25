from datetime import date, timedelta
from functools import lru_cache
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.loader import load_transactions_df
from app.analytics.snapshot import build_insight_snapshot
from app.clients.llm.base import InsightResult, LLMClient
from app.clients.s3_client import S3Client
from app.clients.wallet_client import WalletClient
from app.db.models import WeeklyInsight

_DEFAULT_HISTORY_WEEKS = 8


class PdfRenderer(Protocol):
    def render(self, insight: WeeklyInsight, snapshot: dict[str, Any]) -> bytes: ...


class EventPublisher(Protocol):
    async def publish_insight_generated(
        self, user_id: UUID, insight_id: UUID, week_start: date
    ) -> None: ...


@lru_cache
def get_event_publisher() -> EventPublisher:
    from app.events.publisher import build_event_publisher

    return build_event_publisher()


class InsightService:
    def __init__(
        self,
        llm_client: LLMClient,
        wallet_client: WalletClient,
        s3_client: S3Client,
        publisher: EventPublisher,
        pdf_renderer: PdfRenderer,
        session: AsyncSession,
        history_weeks: int = _DEFAULT_HISTORY_WEEKS,
    ) -> None:
        self._llm = llm_client
        self._wallet = wallet_client
        self._s3 = s3_client
        self._publisher = publisher
        self._pdf_renderer = pdf_renderer
        self._session = session
        self._history_weeks = history_weeks

    async def generate(self, user_id: UUID, week_start: date) -> WeeklyInsight | None:
        from_ = week_start - timedelta(weeks=self._history_weeks)
        to = week_start + timedelta(days=6)
        df = await load_transactions_df(self._wallet, user_id, from_, to)

        snapshot = build_insight_snapshot(user_id, week_start, df, known_merchants=set())
        if snapshot is None:  # semana objetivo sin transacciones
            return None

        llm_result = await self._llm.insight(snapshot)
        insight = await self._upsert(user_id, week_start, llm_result, snapshot)

        pdf_bytes = self._pdf_renderer.render(insight, snapshot)
        insight.s3_key = await self._s3.put_pdf(user_id, week_start, pdf_bytes)
        await self._session.commit()

        await self._publisher.publish_insight_generated(user_id, insight.id, week_start)
        return insight

    async def _upsert(
        self,
        user_id: UUID,
        week_start: date,
        llm_result: InsightResult,
        snapshot: dict[str, Any],
    ) -> WeeklyInsight:
        existing = await self._session.scalar(
            select(WeeklyInsight).where(
                WeeklyInsight.user_id == user_id, WeeklyInsight.week_start == week_start
            )
        )
        insight = existing if existing is not None else WeeklyInsight(
            user_id=user_id, week_start=week_start
        )
        insight.headline = llm_result.headline
        insight.facts = llm_result.facts
        insight.recommendations = llm_result.recommendations
        insight.summary_data = snapshot
        insight.summary_text = self._summary_text(llm_result)
        if existing is None:
            self._session.add(insight)
        await self._session.flush()
        return insight

    @staticmethod
    def _summary_text(llm_result: InsightResult) -> str:
        return f"{llm_result.headline}. {' '.join(llm_result.facts)}".strip()
