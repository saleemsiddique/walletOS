from datetime import date
from typing import Any

import pandas as pd

from app.analytics.category_metrics import weekly_total_by_category, z_score_by_category


def top_anomalies_by_z_score(
    df: pd.DataFrame, week_start: date, threshold: float = 1.5
) -> list[dict[str, Any]]:
    scores = z_score_by_category(df, week_start)
    totals = weekly_total_by_category(df, week_start)
    anomalies = [
        {"category": category, "z_score": score, "amount": totals.get(category, 0.0)}
        for category, score in scores.items()
        if abs(score) >= threshold
    ]
    return sorted(anomalies, key=lambda anomaly: abs(anomaly["z_score"]), reverse=True)


def top_transactions_by_percentile(
    df: pd.DataFrame, week_start: date, percentile: float = 0.95
) -> list[dict[str, Any]]:
    if df.empty:
        return []

    start = pd.Timestamp(week_start)
    end = start + pd.Timedelta(days=6)
    week_mask = (df["date"] >= start) & (df["date"] <= end) & df["category_name"].notna()

    thresholds = df.groupby("category_name")["amount"].quantile(percentile)

    outliers: list[dict[str, Any]] = []
    for _, transaction in df.loc[week_mask].iterrows():
        category = transaction["category_name"]
        if transaction["amount"] > float(thresholds[category]):
            outliers.append(
                {
                    "id": transaction["id"],
                    "category": category,
                    "amount": float(transaction["amount"]),
                    "note": transaction["note"],
                    "date": transaction["date"].date().isoformat(),
                }
            )
    return sorted(outliers, key=lambda transaction: transaction["amount"], reverse=True)
