from datetime import date

import pandas as pd

_AVG_WINDOW_WEEKS = 4
_ZSCORE_WINDOW_WEEKS = 8


def _week_bounds(week_start: date, weeks_back: int = 0) -> tuple[pd.Timestamp, pd.Timestamp]:
    start = pd.Timestamp(week_start) - pd.Timedelta(weeks=weeks_back)
    return start, start + pd.Timedelta(days=6)


def _totals_in_range(
    df: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp
) -> dict[str, float]:
    if df.empty:
        return {}
    mask = (df["date"] >= start) & (df["date"] <= end) & df["category_name"].notna()
    grouped = df.loc[mask].groupby("category_name")["amount"].sum()
    return {str(name): float(total) for name, total in grouped.items()}


def weekly_total_by_category(df: pd.DataFrame, week_start: date) -> dict[str, float]:
    start, end = _week_bounds(week_start)
    return _totals_in_range(df, start, end)


def avg_4w_by_category(df: pd.DataFrame, week_start: date) -> dict[str, float]:
    weekly_totals = [
        _totals_in_range(df, *_week_bounds(week_start, weeks_back))
        for weeks_back in range(1, _AVG_WINDOW_WEEKS + 1)
    ]
    categories = {category for week in weekly_totals for category in week}
    return {
        category: sum(week.get(category, 0.0) for week in weekly_totals) / _AVG_WINDOW_WEEKS
        for category in categories
    }


def delta_vs_avg(actual: float, avg: float) -> float | None:
    if avg == 0:
        return None
    return (actual - avg) / avg * 100


def z_score_by_category(df: pd.DataFrame, week_start: date) -> dict[str, float]:
    history = [
        _totals_in_range(df, *_week_bounds(week_start, weeks_back))
        for weeks_back in range(1, _ZSCORE_WINDOW_WEEKS + 1)
    ]
    target = weekly_total_by_category(df, week_start)
    categories = set(target) | {category for week in history for category in week}

    scores: dict[str, float] = {}
    for category in categories:
        series = [week.get(category, 0.0) for week in history]
        mean = sum(series) / len(series)
        std = (sum((value - mean) ** 2 for value in series) / len(series)) ** 0.5
        actual = target.get(category, 0.0)
        scores[category] = (actual - mean) / std if std > 0 else 0.0
    return scores
