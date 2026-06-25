from typing import Any

import pandas as pd

from app.analytics.category_metrics import weekly_total_by_category

_MIN_R_SQUARED = 0.5
_MIN_SLOPE = 1.0


def linear_trend(values: list[float]) -> tuple[float, float]:
    n = len(values)
    if n < 2:
        return 0.0, 0.0

    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    sxx = sum((x - mean_x) ** 2 for x in xs)
    syy = sum((y - mean_y) ** 2 for y in values)
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values, strict=True))

    if sxx == 0 or syy == 0:
        return 0.0, 0.0

    slope = sxy / sxx
    r_squared = (sxy**2) / (sxx * syy)
    return slope, r_squared


def consistent_trend_categories(
    df: pd.DataFrame,
    weeks: int = 6,
    min_slope: float = _MIN_SLOPE,
    min_r_squared: float = _MIN_R_SQUARED,
) -> list[dict[str, Any]]:
    if df.empty:
        return []

    week_starts = _recent_week_starts(df, weeks)
    weekly_totals = [weekly_total_by_category(df, week_start) for week_start in week_starts]
    categories = {category for week in weekly_totals for category in week}

    trends: list[dict[str, Any]] = []
    for category in categories:
        series = [week.get(category, 0.0) for week in weekly_totals]
        slope, r_squared = linear_trend(series)
        if r_squared > min_r_squared and abs(slope) > min_slope:
            trends.append(
                {
                    "category": category,
                    "direction": "up" if slope > 0 else "down",
                    "weeks": weeks,
                    "slope": slope,
                }
            )
    return trends


def _recent_week_starts(df: pd.DataFrame, weeks: int) -> list[pd.Timestamp]:
    last_date = pd.Timestamp(df["date"].max())
    last_monday = (last_date - pd.Timedelta(days=last_date.weekday())).normalize()
    return [last_monday - pd.Timedelta(weeks=offset) for offset in range(weeks - 1, -1, -1)]
