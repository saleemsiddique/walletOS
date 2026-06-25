from datetime import date
from typing import cast

import pandas as pd

_RECENT_MONTHS = 3


def weekday_distribution(df: pd.DataFrame, category_id: str | None = None) -> dict[int, float]:
    expense = df[df["type"] == "EXPENSE"]
    if category_id is not None:
        expense = expense[expense["category_id"] == category_id]
    if expense.empty:
        return {}

    by_weekday = expense.groupby(expense["date"].dt.weekday)["amount"].sum()
    total = float(by_weekday.sum())
    if total == 0:
        return {}
    return {
        cast("int", weekday): float(amount) / total * 100
        for weekday, amount in by_weekday.items()
    }


def monthly_savings_rate(df: pd.DataFrame, month: date) -> float:
    if df.empty:
        return 0.0

    period = pd.Timestamp(month).to_period("M")
    in_month = df[df["date"].dt.to_period("M") == period]
    income = float(in_month.loc[in_month["type"] == "INCOME", "amount"].sum())
    expense = float(in_month.loc[in_month["type"] == "EXPENSE", "amount"].sum())
    if income == 0:
        return 0.0
    return (income - expense) / income


def monthly_by_category_last_3_months(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    expense = df[(df["type"] == "EXPENSE") & df["category_name"].notna()]
    if expense.empty:
        return {}

    last_month = expense["date"].max().to_period("M")
    result: dict[str, dict[str, float]] = {}
    for offset in range(_RECENT_MONTHS):
        month = last_month - offset
        in_month = expense[expense["date"].dt.to_period("M") == month]
        grouped = in_month.groupby("category_name")["amount"].sum()
        result[str(month)] = {str(name): float(total) for name, total in grouped.items()}
    return result
