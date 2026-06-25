from datetime import timedelta
from io import BytesIO
from typing import Any

import matplotlib

matplotlib.use("Agg")  # backend sin GUI, obligatorio antes de importar pyplot

import matplotlib.pyplot as plt  # noqa: E402
from reportlab.lib import colors  # noqa: E402
from reportlab.lib.pagesizes import A4  # noqa: E402
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # noqa: E402
from reportlab.lib.units import cm  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.db.models import WeeklyInsight  # noqa: E402

_MONTHS_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
_CHART_DPI = 110


class PDFRenderer:
    def __init__(self) -> None:
        styles = getSampleStyleSheet()
        self._title = ParagraphStyle("title", parent=styles["Title"], fontSize=18)
        self._headline = ParagraphStyle("headline", parent=styles["Heading2"], fontSize=15)
        self._heading = styles["Heading3"]
        self._body = styles["BodyText"]
        self._footer = ParagraphStyle(
            "footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey
        )

    def render(self, insight: WeeklyInsight, snapshot: dict[str, Any]) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, title="Resumen semanal WalletOS")

        story: list[Any] = []
        story.append(Paragraph(self._title_text(insight), self._title))
        story.append(Spacer(1, 0.3 * cm))
        story.append(Paragraph(insight.headline, self._headline))
        story.append(Spacer(1, 0.4 * cm))
        story.append(self._key_cards(snapshot["summary_numbers"]))
        story.append(Spacer(1, 0.5 * cm))

        comparisons = snapshot["comparisons_by_category"]
        story.append(self._chart_image(self._chart_donut(comparisons), width=10 * cm))
        story.append(self._chart_image(self._chart_bars_actual_vs_avg(comparisons), width=15 * cm))
        story.extend(self._top_5_table(snapshot["top_transactions"]))
        story.extend(self._bullet_block("Hechos destacados", insight.facts))

        if insight.recommendations:
            story.extend(self._bullet_block("💡 Sugerencias", insight.recommendations))

        story.append(
            self._chart_image(
                self._chart_line_last_8w(snapshot["weekly_total_last_8w"]), width=15 * cm
            )
        )
        story.append(Spacer(1, 0.5 * cm))
        story.append(Paragraph("Generado por WalletOS", self._footer))

        doc.build(story)
        return buffer.getvalue()

    def _title_text(self, insight: WeeklyInsight) -> str:
        start = insight.week_start
        end = start + timedelta(days=6)
        return f"Resumen semanal del {start.day} al {end.day} de {_MONTHS_ES[end.month - 1]}"

    def _key_cards(self, numbers: dict[str, Any]) -> Table:
        cards = [
            ("Gasto", _money(numbers["total_spend"])),
            ("Ingresos", _money(numbers["total_income"])),
            ("Tasa de ahorro", _percent(numbers["savings_rate"] * 100)),
            ("vs media 4 sem", _percent(numbers["vs_avg_4w_pct"])),
        ]
        header = [Paragraph(f"<b>{value}</b>", self._body) for _, value in cards]
        labels = [Paragraph(label, self._footer) for label, _ in cards]
        table = Table([header, labels], colWidths=[4 * cm] * 4)
        table.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return table

    def _top_5_table(self, top_transactions: list[dict[str, Any]]) -> list[Any]:
        if not top_transactions:
            return []
        rows = [["Fecha", "Categoría", "Nota", "Importe"]]
        for transaction in top_transactions[:5]:
            rows.append(
                [
                    transaction["date"],
                    transaction["category"],
                    str(transaction.get("note") or "")[:30],
                    _money(transaction["amount"]),
                ]
            )
        table = Table(rows, colWidths=[3 * cm, 4 * cm, 6 * cm, 2.5 * cm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return [
            Paragraph("Transacciones destacadas", self._heading),
            table,
            Spacer(1, 0.4 * cm),
        ]

    def _bullet_block(self, title: str, items: list[str]) -> list[Any]:
        block: list[Any] = [Paragraph(title, self._heading)]
        block.extend(Paragraph(f"• {item}", self._body) for item in items)
        block.append(Spacer(1, 0.4 * cm))
        return block

    @staticmethod
    def _chart_image(buffer: BytesIO, width: float) -> Image:
        image = Image(buffer)
        ratio = image.imageHeight / image.imageWidth
        image.drawWidth = width
        image.drawHeight = width * ratio
        return image

    def _chart_donut(self, comparisons: list[dict[str, Any]]) -> BytesIO:
        labels = [item["category"] for item in comparisons]
        values = [item["current"] for item in comparisons]
        figure, axes = plt.subplots(figsize=(4, 4))
        if values:
            axes.pie(values, labels=labels, autopct="%1.0f%%", wedgeprops={"width": 0.4})
        axes.set_title("Gasto por categoría")
        return _save(figure)

    def _chart_bars_actual_vs_avg(self, comparisons: list[dict[str, Any]]) -> BytesIO:
        labels = [item["category"] for item in comparisons]
        current = [item["current"] for item in comparisons]
        average = [item["avg_4w"] for item in comparisons]
        positions = range(len(labels))
        figure, axes = plt.subplots(figsize=(6, 3))
        axes.bar([p - 0.2 for p in positions], current, width=0.4, label="Esta semana")
        axes.bar([p + 0.2 for p in positions], average, width=0.4, label="Media 4 sem")
        axes.set_xticks(list(positions))
        axes.set_xticklabels(labels, rotation=30, ha="right")
        axes.set_title("Actual vs media 4 semanas")
        axes.legend()
        return _save(figure)

    def _chart_line_last_8w(self, weekly_totals: list[dict[str, Any]]) -> BytesIO:
        weeks = [str(item["week_start"])[5:] for item in weekly_totals]
        totals = [item["total"] for item in weekly_totals]
        figure, axes = plt.subplots(figsize=(6, 3))
        axes.plot(weeks, totals, marker="o")
        axes.set_title("Evolución últimas 8 semanas")
        axes.tick_params(axis="x", rotation=45)
        return _save(figure)


def _save(figure: Any) -> BytesIO:
    buffer = BytesIO()
    figure.savefig(buffer, format="png", dpi=_CHART_DPI, bbox_inches="tight")
    plt.close(figure)
    buffer.seek(0)
    return buffer


def _money(amount: float) -> str:
    return f"{amount:,.2f} €"


def _percent(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:+.0f}%"
