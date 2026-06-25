# ai-service

Servicio de IA de WalletOS (Python 3.12 + FastAPI). Auto-categorización de transacciones
e insights semanales con analytics deterministas. El LLM solo redacta; nunca calcula.

Puerto: `3003`. Base de datos: `walletos_ai` en la instancia `postgres-ai` (`:5433`).

## Requisitos

- [`uv`](https://docs.astral.sh/uv/) como gestor de paquetes y entornos.
- Python 3.12 (lo instala `uv python install 3.12`).

## Arranque local

```bash
uv sync                       # crea .venv e instala dependencias desde uv.lock
cp .env.example .env          # rellenar los secretos
uv run uvicorn app.main:app --reload --port 3003
```

Comprobar que arranca:

```bash
curl localhost:3003/health    # { "status": "ok", "service": "ai-service" }
```

## Calidad

```bash
uv run ruff check .           # linter
uv run mypy app/              # type checking estricto
uv run pytest                 # tests
```

## Migraciones (Alembic)

La URL de conexión se inyecta en `alembic/env.py` desde `DATABASE_URL`; `alembic.ini`
la deja vacía a propósito. Con el `.env` cargado en el entorno:

```bash
uv run alembic upgrade head                       # aplica migraciones pendientes
uv run alembic revision --autogenerate -m "desc"  # genera una nueva desde los modelos
uv run alembic downgrade -1                        # revierte la última
```

En arranque (local Docker y producción) `prestart.sh` ejecuta `alembic upgrade head`
antes de uvicorn.

## Vía Docker (con el resto del stack)

```bash
docker compose -f ../../infra/docker-compose.yml up ai-service
```
