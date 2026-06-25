from typing import Any

import pandas as pd

_MIN_OCCURRENCES = 3
_AMOUNT_TOLERANCE = 0.05
_MONTHLY_DAYS = range(28, 33)
_WEEKLY_DAYS = range(6, 9)


def detect_implicit_recurring(
    df: pd.DataFrame, known_merchants: set[str]
) -> list[dict[str, Any]]:
    if df.empty:
        return []

    recurring: list[dict[str, Any]] = []
    for note_norm, group in df.groupby("note_norm"):
        merchant = str(note_norm)
        if not merchant or merchant in known_merchants or len(group) < _MIN_OCCURRENCES:
            continue

        dates = sorted(group["date"].tolist())
        pairs = zip(dates, dates[1:], strict=False)
        intervals = [(later - earlier).days for earlier, later in pairs]
        frequency = _classify_frequency(intervals)
        amounts = [float(amount) for amount in group["amount"].tolist()]
        if frequency is None or not _amounts_consistent(amounts):
            continue

        recurring.append(
            {
                "merchant": merchant,
                "amount": sum(amounts) / len(amounts),
                "frequency": frequency,
                "months_observed": max(1, round((dates[-1] - dates[0]).days / 30)),
            }
        )
    return recurring


def _classify_frequency(intervals: list[int]) -> str | None:
    if not intervals:
        return None
    if all(days in _MONTHLY_DAYS for days in intervals):
        return "monthly"
    if all(days in _WEEKLY_DAYS for days in intervals):
        return "weekly"
    return None


def _amounts_consistent(amounts: list[float]) -> bool:
    mean = sum(amounts) / len(amounts)
    if mean == 0:
        return False
    return all(abs(amount - mean) / mean <= _AMOUNT_TOLERANCE for amount in amounts)
