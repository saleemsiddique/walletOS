import json

from app.clients.llm.base import CategoryInput

SYSTEM_PROMPT = (
    "Eres un clasificador de transacciones. Dada una nota corta y el tipo "
    "(EXPENSE/INCOME), elige una de las categorías disponibles del usuario.\n"
    'Devuelve JSON: { "category_id": "uuid-o-null", "confidence": 0.0-1.0 }.\n'
    "Si no estás seguro, baja la confidence. Si confidence<0.5 devuelve category_id=null."
)


def build_user_prompt(note: str, txn_type: str, categories: list[CategoryInput]) -> str:
    return json.dumps(
        {
            "note": note,
            "type": txn_type,
            "categories": [category.model_dump() for category in categories],
        },
        ensure_ascii=False,
    )
