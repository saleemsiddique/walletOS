from datetime import date
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pandas as pd

from app.analytics.loader import COLUMNS, load_transactions_df, normalize_note


def _txn(txn_id: str, note: str | None, amount: float = 10.0) -> dict[str, Any]:
    return {
        "id": txn_id,
        "wallet_id": "w1",
        "type": "EXPENSE",
        "amount": amount,
        "category": {"id": "c1", "name": "Comida", "icon": "🍔", "type": "EXPENSE"},
        "note": note,
        "date": "2026-04-18",
        "transfer_id": None,
        "created_at": "2026-04-18T10:30:00Z",
    }


async def test_empty_list_returns_empty_df_with_columns() -> None:
    wallet = AsyncMock()
    wallet.get_transactions.return_value = []

    df = await load_transactions_df(wallet, uuid4(), date(2026, 3, 1), date(2026, 4, 30))

    assert df.empty
    assert list(df.columns) == COLUMNS


async def test_builds_rows_with_correct_types() -> None:
    wallet = AsyncMock()
    wallet.get_transactions.return_value = [_txn(str(i), f"nota {i}") for i in range(10)]

    df = await load_transactions_df(wallet, uuid4(), date(2026, 3, 1), date(2026, 4, 30))

    assert len(df) == 10
    assert df["amount"].dtype == float
    assert pd.api.types.is_datetime64_any_dtype(df["date"])
    assert df["category_id"].iloc[0] == "c1"
    assert df["category_name"].iloc[0] == "Comida"


async def test_note_norm_strips_accents_and_lowercases() -> None:
    wallet = AsyncMock()
    wallet.get_transactions.return_value = [_txn("1", "Café Münch ")]

    df = await load_transactions_df(wallet, uuid4(), date(2026, 3, 1), date(2026, 4, 30))

    assert df["note_norm"].iloc[0] == "cafe munch"


def test_normalize_note_handles_none_and_accents() -> None:
    assert normalize_note(None) == ""
    assert normalize_note("  Cañas y Tapas ") == "canas y tapas"
