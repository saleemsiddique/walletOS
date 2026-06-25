from datetime import date, timedelta

import pandas as pd

from app.analytics.anomalies import top_anomalies_by_z_score, top_transactions_by_percentile
from app.analytics.trends import consistent_trend_categories, linear_trend

_MONDAY = date(2026, 4, 13)


def _df(rows: list[dict[str, object]]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "id": row.get("id", "t"),
                "category_name": row["cat"],
                "amount": float(row["amt"]),  # type: ignore[arg-type]
                "note": row.get("note", ""),
                "date": pd.Timestamp(row["date"]),  # type: ignore[arg-type]
            }
            for row in rows
        ]
    )


def _week_back(weeks: int) -> date:
    return _MONDAY - timedelta(weeks=weeks)


def test_linear_trend_increasing() -> None:
    slope, r_squared = linear_trend([10, 20, 30, 40])

    assert slope == 10.0
    assert r_squared > 0.99


def test_linear_trend_flat_returns_zero() -> None:
    assert linear_trend([100, 100, 100, 100]) == (0.0, 0.0)


def test_consistent_trend_detects_up_and_ignores_flat() -> None:
    rows: list[dict[str, object]] = []
    for offset, amount in enumerate([10, 20, 30, 40, 50, 60]):
        week = _MONDAY - timedelta(weeks=5 - offset)
        rows.append({"date": week, "cat": "Ocio", "amt": amount})
        rows.append({"date": week, "cat": "Fijo", "amt": 100})

    trends = consistent_trend_categories(_df(rows))

    assert any(t["category"] == "Ocio" and t["direction"] == "up" for t in trends)
    assert all(t["category"] != "Fijo" for t in trends)


def test_top_anomalies_by_z_score_detects_spike() -> None:
    rows: list[dict[str, object]] = [
        {"date": _week_back(weeks), "cat": "Comida", "amt": amount}
        for weeks, amount in zip(range(1, 9), [90, 110, 95, 105, 100, 98, 102, 100], strict=True)
    ]
    rows.append({"date": _MONDAY, "cat": "Comida", "amt": 300})

    anomalies = top_anomalies_by_z_score(_df(rows), _MONDAY)

    assert anomalies[0]["category"] == "Comida"
    assert anomalies[0]["z_score"] > 1.5


def test_top_transactions_returns_only_atypical() -> None:
    rows: list[dict[str, object]] = [
        {"date": _week_back(weeks), "cat": "Comida", "amt": 20} for weeks in range(1, 13)
    ]
    rows += [
        {"date": _MONDAY, "cat": "Comida", "amt": 20},
        {"date": _MONDAY + timedelta(days=1), "cat": "Comida", "amt": 20},
        {"date": _MONDAY + timedelta(days=2), "cat": "Comida", "amt": 200, "id": "big"},
    ]

    outliers = top_transactions_by_percentile(_df(rows), _MONDAY)

    assert len(outliers) == 1
    assert outliers[0]["id"] == "big"
    assert outliers[0]["amount"] == 200.0
