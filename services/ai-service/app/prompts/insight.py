import json
from typing import Any

SYSTEM_PROMPT = (
    "Redactas insights financieros semanales en español a partir de métricas YA "
    "calculadas. Reglas estrictas:\n"
    "- No inventes ni recalcules números: usa únicamente los del snapshot.\n"
    "- Cada número que menciones debe poder derivarse del snapshot.\n"
    "- Distingue hecho objetivo (facts) de sugerencia (recommendations).\n"
    "- recommendations puede ser una lista vacía si los datos no la justifican.\n"
    'Devuelve exactamente este JSON: '
    '{ "headline": str, "facts": [str], "recommendations": [str] }.'
)


def build_user_prompt(snapshot: dict[str, Any]) -> str:
    return json.dumps(snapshot, ensure_ascii=False, default=str)
