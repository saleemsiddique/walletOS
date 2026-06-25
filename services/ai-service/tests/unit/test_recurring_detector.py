from datetime import date, timedelta

import pandas as pd

from app.analytics.recurring_detector import detect_implicit_recurring

_START = date(2026, 1, 5)


def _df(rows: list[tuple[str, float, date]]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"note_norm": note, "amount": float(amount), "date": pd.Timestamp(day)}
            for note, amount, day in rows
        ]
    )


def _monthly(note: str, amount: float, count: int) -> list[tuple[str, float, date]]:
    return [(note, amount, _START + timedelta(days=30 * i)) for i in range(count)]


def test_detects_monthly_subscription_with_stable_amount() -> None:
    df = _df(_monthly("netflix", 12.99, 6))

    recurring = detect_implicit_recurring(df, known_merchants=set())

    assert len(recurring) == 1
    assert recurring[0]["merchant"] == "netflix"
    assert recurring[0]["frequency"] == "monthly"
    assert recurring[0]["amount"] == 12.99


def test_inconsistent_amounts_not_detected() -> None:
    rows = [
        ("mercadona", amount, _START + timedelta(days=30 * i))
        for i, amount in enumerate([10, 55, 22, 80, 15, 60])
    ]

    assert detect_implicit_recurring(_df(rows), known_merchants=set()) == []


def test_known_merchant_excluded() -> None:
    df = _df(_monthly("spotify", 9.99, 6))

    assert detect_implicit_recurring(df, known_merchants={"spotify"}) == []


def test_irregular_intervals_not_detected() -> None:
    irregular_days = [0, 5, 25, 28, 73]
    rows = [("bar pepe", 8.0, _START + timedelta(days=offset)) for offset in irregular_days]

    assert detect_implicit_recurring(_df(rows), known_merchants=set()) == []
