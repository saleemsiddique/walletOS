from datetime import date, timedelta
from io import BytesIO
from typing import Any
from uuid import uuid4

from pypdf import PdfReader

from app.db.models import WeeklyInsight
from app.services.pdf_renderer import PDFRenderer

_SNAPSHOT: dict[str, Any] = {
    "week_start": "2026-04-13",
    "user_currency": "EUR",
    "summary_numbers": {
        "total_spend": 320.5,
        "total_income": 1500.0,
        "savings_rate": 0.78,
        "vs_avg_4w_pct": 12.0,
    },
    "comparisons_by_category": [
        {"category": "Comida", "current": 120.0, "avg_4w": 100.0, "delta_pct": 20.0, "z_score": 1.2},  # noqa: E501
        {"category": "Ocio", "current": 120.0, "avg_4w": 60.0, "delta_pct": 100.0, "z_score": 2.1},
    ],
    "weekly_total_last_8w": [
        {"week_start": (date(2026, 2, 16) + timedelta(weeks=i)).isoformat(), "total": 300 + i * 5}
        for i in range(8)
    ],
    "top_transactions": [
        {"id": "t1", "category": "Ocio", "amount": 120.0, "note": "Concierto", "date": "2026-04-15"},  # noqa: E501
    ],
}


def _insight(*, recommendations: list[str]) -> WeeklyInsight:
    return WeeklyInsight(
        user_id=uuid4(),
        week_start=date(2026, 4, 13),
        headline="Has ahorrado el 78% de tus ingresos",
        facts=["Gastaste 320,50 €", "Ingresaste 1500,00 €"],
        recommendations=recommendations,
        summary_data=_SNAPSHOT,
        summary_text="Has ahorrado el 78% de tus ingresos.",
    )


def _text(pdf_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() for page in reader.pages)


def test_render_produces_pdf_bytes() -> None:
    pdf = PDFRenderer().render(_insight(recommendations=["Reduce el ocio"]), _SNAPSHOT)

    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 5000


def test_includes_suggestions_block_when_present() -> None:
    pdf = PDFRenderer().render(_insight(recommendations=["Reduce el ocio"]), _SNAPSHOT)

    assert "Sugerencias" in _text(pdf)


def test_omits_suggestions_block_when_empty() -> None:
    pdf = PDFRenderer().render(_insight(recommendations=[]), _SNAPSHOT)

    assert "Sugerencias" not in _text(pdf)


def test_minimal_snapshot_does_not_raise() -> None:
    minimal: dict[str, Any] = {
        "summary_numbers": {
            "total_spend": 0.0,
            "total_income": 0.0,
            "savings_rate": 0.0,
            "vs_avg_4w_pct": None,
        },
        "comparisons_by_category": [],
        "weekly_total_last_8w": [],
        "top_transactions": [],
    }

    pdf = PDFRenderer().render(_insight(recommendations=[]), minimal)

    assert pdf[:4] == b"%PDF"
