from datetime import date
from typing import Any
from uuid import UUID

import pandas as pd
from unidecode import unidecode

from app.clients.wallet_client import WalletClient

COLUMNS = [
    "id",
    "type",
    "amount",
    "category_id",
    "category_name",
    "note",
    "note_norm",
    "date",
    "wallet_id",
]


def normalize_note(note: str | None) -> str:
    if not note:
        return ""
    return unidecode(note).lower().strip()


def _to_row(transaction: dict[str, Any]) -> dict[str, Any]:
    category = transaction.get("category") or {}
    note = transaction.get("note")
    return {
        "id": transaction["id"],
        "type": transaction["type"],
        "amount": float(transaction["amount"]),
        "category_id": category.get("id"),
        "category_name": category.get("name"),
        "note": note,
        "note_norm": normalize_note(note),
        "date": transaction["date"],
        "wallet_id": transaction["wallet_id"],
    }


async def load_transactions_df(
    wallet_client: WalletClient, user_id: UUID, from_: date, to: date
) -> pd.DataFrame:
    transactions = await wallet_client.get_transactions(user_id, from_, to)
    if not transactions:
        return pd.DataFrame(columns=COLUMNS)

    df = pd.DataFrame([_to_row(transaction) for transaction in transactions], columns=COLUMNS)
    df["amount"] = df["amount"].astype(float)
    df["date"] = pd.to_datetime(df["date"])
    return df
