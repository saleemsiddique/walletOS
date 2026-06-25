import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.clients.llm.factory import get_llm_client
from app.clients.s3_client import get_s3_client
from app.clients.user_client import get_user_client
from app.clients.wallet_client import get_wallet_client
from app.core.config import get_settings
from app.core.dates import last_complete_monday
from app.core.logging import get_logger
from app.db.base import async_session_factory
from app.db.models import WeeklyInsight
from app.services.insight_service import InsightService, get_event_publisher
from app.services.pdf_renderer import PDFRenderer

logger = get_logger(__name__)

GenerateForUser = Callable[[UUID, date], Awaitable[WeeklyInsight | None]]
ActiveUsers = Callable[[], Awaitable[list[dict[str, Any]]]]


async def run_weekly_insights(
    list_active_users: ActiveUsers,
    generate_for_user: GenerateForUser,
    concurrency: int,
    now: datetime | None = None,
) -> dict[str, int]:
    week_start = last_complete_monday(now if now is not None else datetime.now(UTC))
    users = await list_active_users()
    semaphore = asyncio.Semaphore(concurrency)

    async def _safe(user: dict[str, Any]) -> str:
        async with semaphore:
            try:
                insight = await generate_for_user(UUID(user["id"]), week_start)
                return "success" if insight is not None else "skipped"
            except Exception:
                logger.exception("weekly insight failed", extra={"user_id": user.get("id")})
                return "error"

    outcomes = await asyncio.gather(*(_safe(user) for user in users))
    summary = {
        "total": len(users),
        "success": outcomes.count("success"),
        "skipped_204": outcomes.count("skipped"),
        "errors": outcomes.count("error"),
    }
    logger.info("weekly insights batch complete", extra=summary)
    return summary


async def _generate_for_user(user_id: UUID, week_start: date) -> WeeklyInsight | None:
    async with async_session_factory() as session:
        service = InsightService(
            llm_client=get_llm_client("insights"),
            wallet_client=get_wallet_client(),
            s3_client=get_s3_client(),
            publisher=get_event_publisher(),
            pdf_renderer=PDFRenderer(),
            session=session,
            history_weeks=get_settings().insights_history_weeks,
        )
        return await service.generate(user_id, week_start)


async def _run() -> None:
    settings = get_settings()
    await run_weekly_insights(
        get_user_client().list_active_users, _generate_for_user, settings.insights_cron_concurrency
    )


def schedule_weekly_insights(scheduler: AsyncIOScheduler) -> None:
    scheduler.add_job(
        _run,
        CronTrigger(
            day_of_week="mon", hour=get_settings().insights_cron_hour_utc, timezone="UTC"
        ),
        id="weekly_insights",
    )
