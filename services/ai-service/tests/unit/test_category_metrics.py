from datetime import date, timedelta

import pandas as pd

from app.analytics.category_metrics import (
    avg_4w_by_category,
    delta_vs_avg,
    weekly_total_by_category,
    z_score_by_category,
)

_WEEK_START = date(2026, 4, 13)


def _df(rows: list[tuple[date, str, float]]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"date": pd.Timestamp(day), "category_name": category, "amount": float(amount)}
            for day, category, amount in rows
        ]
    )


def _week_back(weeks: int) -> date:
    return _WEEK_START - timedelta(weeks=weeks)


def test_weekly_total_by_category_sums_target_week() -> None:
    df = _df(
        [
            (_WEEK_START, "Comida", 30),
            (_WEEK_START + timedelta(days=2), "Comida", 20),
            (_WEEK_START + timedelta(days=1), "Transporte", 10),
            (_week_back(1), "Comida", 999),  # semana anterior, no cuenta
        ]
    )

    assert weekly_total_by_category(df, _WEEK_START) == {"Comida": 50.0, "Transporte": 10.0}


def test_avg_4w_and_delta_vs_avg() -> None:
    rows = [(_week_back(weeks), "Comida", 100) for weeks in range(1, 5)]
    rows.append((_WEEK_START, "Comida", 150))
    df = _df(rows)

    avg = avg_4w_by_category(df, _WEEK_START)
    actual = weekly_total_by_category(df, _WEEK_START)["Comida"]

    assert avg["Comida"] == 100.0
    assert delta_vs_avg(actual, avg["Comida"]) == 50.0


def test_delta_vs_avg_returns_none_when_avg_zero() -> None:
    assert delta_vs_avg(50.0, 0.0) is None


def test_z_score_detects_clear_spike() -> None:
    rows = [
        (_week_back(weeks), "Comida", amount)
        for weeks, amount in zip(range(1, 9), [90, 110, 95, 105, 100, 98, 102, 100], strict=True)
    ]
    rows.append((_WEEK_START, "Comida", 300))
    df = _df(rows)

    assert z_score_by_category(df, _WEEK_START)["Comida"] > 1.5


def test_z_score_near_zero_when_stable() -> None:
    rows = [
        (_week_back(weeks), "Comida", amount)
        for weeks, amount in zip(range(1, 9), [90, 110, 95, 105, 100, 98, 102, 100], strict=True)
    ]
    rows.append((_WEEK_START, "Comida", 100))
    df = _df(rows)

    assert abs(z_score_by_category(df, _WEEK_START)["Comida"]) < 1.0


def test_category_without_spend_in_week_does_not_error() -> None:
    df = _df([(_week_back(weeks), "Suscripciones", 15) for weeks in range(1, 9)])

    totals = weekly_total_by_category(df, _WEEK_START)
    scores = z_score_by_category(df, _WEEK_START)

    assert "Suscripciones" not in totals
    assert scores["Suscripciones"] == 0.0
