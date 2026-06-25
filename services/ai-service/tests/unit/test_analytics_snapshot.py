from datetime import date, timedelta
from typing import Any
from uuid import uuid4

import pandas as pd

from app.analytics.aggregations import (
    monthly_by_category_last_3_months,
    monthly_savings_rate,
    weekday_distribution,
)
from app.analytics.snapshot import build_insight_snapshot

_MONDAY = date(2026, 4, 13)

_EXPECTED_KEYS = {
    "week_start",
    "user_currency",
    "summary_numbers",
    "comparisons_by_category",
    "trends",
    "anomalies_z_score",
    "implicit_recurring_detected",
    "weekday_distribution",
    "top_transactions",
    "weekly_total_last_8w",
    "active_subscriptions_count",
    "active_subscriptions_monthly_total",
}


def _row(day: date, txn_type: str, amount: float, category: str) -> dict[str, Any]:
    return {
        "id": f"{category}-{day.isoformat()}",
        "type": txn_type,
        "amount": float(amount),
        "category_id": category.lower(),
        "category_name": category,
        "note": category,
        "note_norm": category.lower(),
        "date": pd.Timestamp(day),
        "wallet_id": "w1",
    }


def _history_and_target() -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for weeks_back in range(1, 9):
        monday = _MONDAY - timedelta(weeks=weeks_back)
        rows.append(_row(monday, "EXPENSE", 50, "Comida"))
        rows.append(_row(monday, "EXPENSE", 10, "Transporte"))
    rows.append(_row(_MONDAY, "EXPENSE", 50, "Comida"))
    rows.append(_row(_MONDAY, "EXPENSE", 10, "Transporte"))
    rows.append(_row(_MONDAY, "INCOME", 1000, "Nómina"))
    return pd.DataFrame(rows)


def test_snapshot_has_all_expected_keys() -> None:
    snapshot = build_insight_snapshot(uuid4(), _MONDAY, _history_and_target(), set())

    assert snapshot is not None
    assert set(snapshot.keys()) == _EXPECTED_KEYS


def test_snapshot_numbers_match_dataset() -> None:
    snapshot = build_insight_snapshot(uuid4(), _MONDAY, _history_and_target(), set())

    assert snapshot is not None
    numbers = snapshot["summary_numbers"]
    assert numbers["total_spend"] == 60.0
    assert numbers["total_income"] == 1000.0
    assert round(numbers["savings_rate"], 2) == 0.94
    assert numbers["vs_avg_4w_pct"] == 0.0
    assert len(snapshot["weekly_total_last_8w"]) == 8
    assert snapshot["weekday_distribution"] == [{"weekday": 0, "pct": 100.0}]


def test_snapshot_returns_none_when_target_week_empty() -> None:
    rows = [
        _row(_MONDAY - timedelta(weeks=weeks_back), "EXPENSE", 50, "Comida")
        for weeks_back in range(1, 5)
    ]

    assert build_insight_snapshot(uuid4(), _MONDAY, pd.DataFrame(rows), set()) is None


def test_monthly_savings_rate() -> None:
    df = pd.DataFrame(
        [
            _row(date(2026, 4, 2), "INCOME", 1000, "Nómina"),
            _row(date(2026, 4, 10), "EXPENSE", 200, "Comida"),
            _row(date(2026, 3, 5), "EXPENSE", 999, "Comida"),  # otro mes, no cuenta
        ]
    )

    assert monthly_savings_rate(df, date(2026, 4, 1)) == 0.8


def test_monthly_by_category_last_3_months() -> None:
    df = pd.DataFrame(
        [
            _row(date(2026, 4, 10), "EXPENSE", 30, "Comida"),
            _row(date(2026, 4, 12), "EXPENSE", 20, "Comida"),
            _row(date(2026, 3, 8), "EXPENSE", 40, "Transporte"),
        ]
    )

    result = monthly_by_category_last_3_months(df)

    assert result["2026-04"]["Comida"] == 50.0
    assert result["2026-03"]["Transporte"] == 40.0


def test_weekday_distribution_percentages() -> None:
    df = pd.DataFrame(
        [
            _row(date(2026, 4, 13), "EXPENSE", 30, "Comida"),  # lunes
            _row(date(2026, 4, 15), "EXPENSE", 10, "Comida"),  # miércoles
        ]
    )

    assert weekday_distribution(df) == {0: 75.0, 2: 25.0}
