from datetime import date, timedelta
from typing import Any
from uuid import UUID

import pandas as pd

from app.analytics.aggregations import weekday_distribution
from app.analytics.anomalies import top_anomalies_by_z_score, top_transactions_by_percentile
from app.analytics.category_metrics import (
    avg_4w_by_category,
    delta_vs_avg,
    weekly_total_by_category,
    z_score_by_category,
)
from app.analytics.recurring_detector import detect_implicit_recurring
from app.analytics.trends import consistent_trend_categories

_AVG_WINDOW_WEEKS = 4
_HISTORY_WEEKS = 8
_WEEKS_PER_MONTH = 4.345


def build_insight_snapshot(
    user_id: UUID,
    week_start: date,
    df: pd.DataFrame,
    known_merchants: set[str],
    currency: str = "EUR",
) -> dict[str, Any] | None:
    if not _has_transactions_in_week(df, week_start):
        return None

    df_expense = df[df["type"] == "EXPENSE"]
    total_spend = _week_total_spend(df_expense, week_start)
    total_income = _week_total_income(df, week_start)
    avg_4w_spend = _avg_prior_weeks_spend(df_expense, week_start)

    recurring = detect_implicit_recurring(df_expense, known_merchants)

    return {
        "week_start": week_start.isoformat(),
        "user_currency": currency,
        "summary_numbers": {
            "total_spend": total_spend,
            "total_income": total_income,
            "savings_rate": (total_income - total_spend) / total_income if total_income else 0.0,
            "vs_avg_4w_pct": delta_vs_avg(total_spend, avg_4w_spend),
        },
        "comparisons_by_category": _comparisons_by_category(df_expense, week_start),
        "trends": consistent_trend_categories(df_expense),
        "anomalies_z_score": top_anomalies_by_z_score(df_expense, week_start),
        "implicit_recurring_detected": recurring,
        "weekday_distribution": [
            {"weekday": weekday, "pct": pct}
            for weekday, pct in sorted(weekday_distribution(df).items())
        ],
        "top_transactions": top_transactions_by_percentile(df, week_start),
        "weekly_total_last_8w": _weekly_total_last_8w(df_expense, week_start),
        "active_subscriptions_count": len(recurring),
        "active_subscriptions_monthly_total": _monthly_total(recurring),
    }


def _has_transactions_in_week(df: pd.DataFrame, week_start: date) -> bool:
    if df.empty:
        return False
    start = pd.Timestamp(week_start)
    end = start + pd.Timedelta(days=6)
    return bool(((df["date"] >= start) & (df["date"] <= end)).any())


def _week_total_spend(df_expense: pd.DataFrame, week_start: date) -> float:
    return sum(weekly_total_by_category(df_expense, week_start).values())


def _week_total_income(df: pd.DataFrame, week_start: date) -> float:
    start = pd.Timestamp(week_start)
    end = start + pd.Timedelta(days=6)
    mask = (df["date"] >= start) & (df["date"] <= end) & (df["type"] == "INCOME")
    return float(df.loc[mask, "amount"].sum())


def _avg_prior_weeks_spend(df_expense: pd.DataFrame, week_start: date) -> float:
    totals = [
        _week_total_spend(df_expense, week_start - timedelta(weeks=weeks_back))
        for weeks_back in range(1, _AVG_WINDOW_WEEKS + 1)
    ]
    return sum(totals) / _AVG_WINDOW_WEEKS


def _comparisons_by_category(df_expense: pd.DataFrame, week_start: date) -> list[dict[str, Any]]:
    current = weekly_total_by_category(df_expense, week_start)
    avg = avg_4w_by_category(df_expense, week_start)
    z_scores = z_score_by_category(df_expense, week_start)
    return [
        {
            "category": category,
            "current": amount,
            "avg_4w": avg.get(category, 0.0),
            "delta_pct": delta_vs_avg(amount, avg.get(category, 0.0)),
            "z_score": z_scores.get(category, 0.0),
        }
        for category, amount in current.items()
    ]


def _weekly_total_last_8w(df_expense: pd.DataFrame, week_start: date) -> list[dict[str, Any]]:
    return [
        {
            "week_start": (week_start - timedelta(weeks=weeks_back)).isoformat(),
            "total": _week_total_spend(df_expense, week_start - timedelta(weeks=weeks_back)),
        }
        for weeks_back in range(_HISTORY_WEEKS - 1, -1, -1)
    ]


def _monthly_total(recurring: list[dict[str, Any]]) -> float:
    return float(
        sum(
            item["amount"] * (_WEEKS_PER_MONTH if item["frequency"] == "weekly" else 1.0)
            for item in recurring
        )
    )
