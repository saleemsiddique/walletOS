FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .


FROM python:3.12-slim AS runtime

WORKDIR /app

RUN groupadd --system aiservice && useradd --system --gid aiservice aiservice

COPY --from=builder --chown=aiservice:aiservice /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    MPLCONFIGDIR=/tmp/matplotlib

USER aiservice

EXPOSE 3003

CMD ["./prestart.sh"]
