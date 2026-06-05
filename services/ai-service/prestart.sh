#!/usr/bin/env sh
set -e

# Aplica las migraciones pendientes antes de arrancar el servidor.
alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-3003}"
