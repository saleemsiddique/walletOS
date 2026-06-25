import asyncio
from datetime import date
from uuid import UUID, uuid4

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.tasks.weekly_insights_cron import run_weekly_insights, schedule_weekly_insights


def _users(count: int) -> list[dict[str, str]]:
    return [{"id": str(uuid4())} for _ in range(count)]


async def test_summarizes_success_skipped_and_errors() -> None:
    users = _users(4)
    failing_id = users[0]["id"]

    async def list_active_users() -> list[dict[str, str]]:
        return users

    async def generate_for_user(user_id: UUID, week_start: date) -> object | None:
        if str(user_id) == failing_id:
            raise RuntimeError("boom")
        if str(user_id) == users[1]["id"]:
            return None  # semana sin transacciones → skipped
        return object()  # insight generado

    summary = await run_weekly_insights(list_active_users, generate_for_user, concurrency=10)

    assert summary == {"total": 4, "success": 2, "skipped_204": 1, "errors": 1}


async def test_respects_concurrency_limit() -> None:
    users = _users(6)
    state = {"current": 0, "max": 0}

    async def list_active_users() -> list[dict[str, str]]:
        return users

    async def generate_for_user(user_id: UUID, week_start: date) -> object:
        state["current"] += 1
        state["max"] = max(state["max"], state["current"])
        await asyncio.sleep(0.01)
        state["current"] -= 1
        return object()

    await run_weekly_insights(list_active_users, generate_for_user, concurrency=2)

    assert state["max"] <= 2


def test_job_registered_with_monday_cron() -> None:
    scheduler = AsyncIOScheduler(timezone="UTC")

    schedule_weekly_insights(scheduler)

    job = scheduler.get_job("weekly_insights")
    assert job is not None
    trigger = str(job.trigger)
    assert "day_of_week='mon'" in trigger
    assert "hour='6'" in trigger
