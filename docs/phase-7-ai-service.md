# WalletOS — Fase 7: AI Service

Servicio más diferente del stack: Python 3.12, FastAPI async, SQLAlchemy async, Alembic, APScheduler. Consume transacciones del Wallet Service vía endpoint interno, calcula métricas deterministas con pandas, usa el LLM **solo para redactar** y renderiza PDFs con ReportLab + matplotlib subidos a S3. Se construye en ramas cortas de feature, cada una con su PR a `develop`. Al terminar la fase, `develop` → `main`.

## Contexto

Las Fases 5 (User Service) y 6 (Wallet Service) están completas en `main` (2026-05-30). Sus endpoints internos (`GET /internal/transactions`, `GET /internal/categories`, `GET /internal/users`) y el secret compartido `X-Internal-Secret` están operativos. El exchange RabbitMQ `walletOS.events` recibe `user.deleted` (User Service) y `transaction.created` (Wallet Service).

**Base de datos:** `walletos_ai` en la instancia `postgres-ai:5433` (aislada del Postgres principal para no acoplar carga ni backups).
**Puerto:** `3003`.
**Contratos de referencia:** `docs/api-contracts.md` (sección AI Service).
**Schema SQL:** `docs/user-flow-and-bdd.md` (sección `walletOS_ai`).
**Pantallas en la app:** `docs/user-flow-and-bdd.md` pantallas 12 (Insights) y 13 (Detalle de insight).

### Principio rector — analytics deterministas + LLM solo redacta

Todo el análisis numérico se hace en `app/analytics/` con código Python puro y verificable. El LLM recibe el snapshot ya digerido en JSON y devuelve únicamente texto estructurado (`headline`, `facts[]`, `recommendations[]`).

Consecuencias:

- Cero alucinaciones numéricas — cada número en `facts` se deriva de `summary_data`.
- Calidad desacoplada del modelo — `gpt-4o-mini` es suficiente.
- Coste predecible — input ~3 000 tokens, output ~800 tokens, independiente del histórico.
- Sin lock-in — cliente LLM abstracto multi-provider, cambio de proveedor por env var.

### Decisiones cerradas (recordatorio)

| Decisión                            | Elección                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| Modelo LLM local vs API             | API. Local descartado en v1 (CAX21 no aguanta calidad+latencia).                    |
| Provider primario v1                | OpenAI `gpt-4o-mini` para categorización **y** insights.                            |
| Cliente LLM                         | Abstracto multi-provider (`LLMClient` con `OpenAIClient` y `AnthropicClient` stub). |
| Sincronía `POST /insights/generate` | Síncrono.                                                                           |
| Caché Redis categorize              | Dos niveles, TTL 24h.                                                               |
| Histórico para insights             | 8 semanas (`INSIGHTS_HISTORY_WEEKS`).                                               |
| Cron weekly                         | Lunes 06:00 UTC (`INSIGHTS_CRON_HOUR_UTC`).                                         |
| Semana sin transacciones            | 204 sin llamar al LLM.                                                              |
| Gráficos                            | Donut + barras actual vs media 4w + línea últimas 8w + tabla top 5.                 |
| Librería gráficos                   | matplotlib (PDF) + `fl_chart` (Flutter).                                            |

---

## Flujo de ramas

```
develop
 ├── feature/docs-phase-7-alcance              (en curso — Bloque 0)
 ├── feature/ai-service-scaffold
 ├── feature/ai-service-config
 ├── feature/ai-service-models
 ├── feature/ai-service-alembic
 ├── feature/ai-service-auth-middleware
 ├── feature/ai-service-llm-client
 ├── feature/ai-service-wallet-user-clients
 ├── feature/ai-service-s3-client
 ├── feature/ai-service-redis-cache
 ├── feature/ai-service-categorize-service
 ├── feature/ai-service-categorize-endpoint
 ├── feature/ai-service-analytics-loader
 ├── feature/ai-service-analytics-categories
 ├── feature/ai-service-analytics-trends
 ├── feature/ai-service-analytics-recurring
 ├── feature/ai-service-analytics-snapshot
 ├── feature/ai-service-insight-service
 ├── feature/ai-service-pdf-renderer
 ├── feature/ai-service-insights-list
 ├── feature/ai-service-insight-detail
 ├── feature/ai-service-insights-generate
 ├── feature/ai-service-insights-export
 ├── feature/ai-service-weekly-cron
 ├── feature/ai-service-rabbitmq-publisher
 ├── feature/ai-service-rabbitmq-consumer
 └── feature/ai-service-dockerfile-prod
main ← develop  (al cerrar la fase)
```

---

## Rama 1 — `feature/ai-service-scaffold`

### Objetivo

Estructura base del servicio: dependencias con `uv`, FastAPI, linters, testing, hot reload y endpoint de salud.

### Checklist de desarrollo

- [ ] `pyproject.toml` con `uv` como gestor.
- [ ] Dependencias de producción:
  - `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`
  - `sqlalchemy[asyncio]`, `asyncpg`, `alembic`
  - `httpx`, `redis`, `aio-pika`, `boto3`
  - `openai`, `anthropic`, `tenacity`
  - `apscheduler`, `pandas`, `matplotlib`, `reportlab`
  - `python-jose[cryptography]`, `unidecode`
- [ ] Dependencias dev: `ruff`, `mypy`, `pytest`, `pytest-asyncio`, `respx`, `fakeredis`.
- [ ] `ruff.toml` (line-length 100, target py312).
- [ ] `mypy.ini` (strict para `app/`).
- [ ] `pytest.ini` (asyncio_mode=auto).
- [ ] Estructura de carpetas:
  ```
  app/
    api/
      routes/
      middleware/
      deps.py
    core/        — config.py, errors.py, logging.py
    db/          — base.py, models.py
    services/    — cache.py, categorize_service.py, insight_service.py, pdf_renderer.py
    clients/
      llm/       — base.py, openai_client.py, anthropic_client.py, factory.py
      wallet_client.py, user_client.py, s3_client.py
    analytics/   — loader.py, category_metrics.py, trends.py, anomalies.py, recurring_detector.py, aggregations.py, snapshot.py
    prompts/     — categorize.py, insight.py
    tasks/       — weekly_insights_cron.py
    events/      — publisher.py, consumer.py
    main.py
  ```
- [ ] `app/main.py` con factory FastAPI + `lifespan` (vacío por ahora; scheduler y consumer se conectan en sus ramas).
- [ ] `app/api/routes/health.py` → `GET /health` devuelve `{ "status": "ok", "service": "ai-service" }`.
- [ ] `Dockerfile.dev` con `uvicorn app.main:app --reload --host 0.0.0.0 --port 3003`.
- [ ] Bloque `ai-service` en `infra/docker-compose.yml` (puerto 3003, `depends_on` postgres-ai + redis + rabbitmq, volumen montado para hot reload).
- [ ] Añadir regla `services/ai-service/**/*.py` en `lint-staged.config.mjs` raíz → `ruff check --fix`.
- [ ] `services/ai-service/README.md` con instrucciones de arranque local (`uv sync`, `uv run uvicorn ...`).

### Checklist de tests

- [ ] `GET /health` → 200 con body correcto.
- [ ] `GET /health` sin credenciales → 200 (es público).
- [ ] App arranca con env vars de test completas.

### Commits del PR

```
feat(ai-service): inicializar pyproject.toml con uv y dependencias
feat(ai-service): ruff mypy pytest configurados
feat(ai-service): estructura de carpetas app/
feat(ai-service): factory FastAPI con lifespan vacío
feat(ai-service): GET /health endpoint
feat(ai-service): Dockerfile.dev con hot reload
chore(infra): añadir ai-service a docker-compose.yml
chore(root): añadir regla services/ai-service en lint-staged
```

### Criterio Done

`uv run uvicorn app.main:app` arranca en puerto 3003, `uv run pytest` verde, `curl localhost:3003/health` responde 200.

---

## Rama 2 — `feature/ai-service-config`

### Objetivo

Configuración tipada con `pydantic-settings`, cargando todas las env vars con validación.

### Checklist de desarrollo

**`app/core/config.py`**

- [ ] `Settings(BaseSettings)` con todas las variables del servicio:
  - `database_url`, `redis_url`, `rabbitmq_url`
  - `internal_secret`, `jwt_secret`
  - `wallet_service_url`, `user_service_url`
  - `llm_provider_categorize`, `llm_provider_insights`
  - `openai_api_key`, `openai_categorize_model`, `openai_insights_model`
  - `anthropic_api_key` (opcional)
  - `aws_region`, `aws_access_key_id`, `aws_secret_access_key`, `aws_s3_bucket`
  - `insights_history_weeks` (default 8)
  - `insights_cron_hour_utc` (default 6)
  - `insights_cron_concurrency` (default 10)
  - `port` (default 3003)
- [ ] `model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)`.
- [ ] Singleton `get_settings()` cacheado con `@lru_cache`.
- [ ] Falla al arrancar si falta alguna variable crítica.

**`app/core/logging.py`**

- [ ] Logger estructurado JSON con campos `timestamp`, `level`, `service`, `message`, `extra`.

**`services/ai-service/.env.example`**

- [ ] Ampliar con todas las variables nuevas listadas arriba.

### Checklist de tests

- [ ] `Settings` parsea correctamente un `.env` válido.
- [ ] Arranque falla si falta `OPENAI_API_KEY` cuando `LLM_PROVIDER_*=openai`.
- [ ] Logger emite JSON parseable.

### Commits del PR

```
feat(ai-service): settings tipadas con pydantic-settings
feat(ai-service): logger estructurado json
chore(ai-service): ampliar .env.example con variables del servicio
```

### Criterio Done

`uv run python -c "from app.core.config import get_settings; print(get_settings())"` imprime todas las variables sin errores.

---

## Rama 3 — `feature/ai-service-models`

### Objetivo

Modelo SQLAlchemy de `WeeklyInsight` con el schema ampliado.

### Checklist de desarrollo

**`app/db/base.py`**

- [ ] `create_async_engine(settings.database_url)`.
- [ ] `async_sessionmaker(engine, expire_on_commit=False)`.
- [ ] Dependency `get_session()` async para usar en endpoints.

**`app/db/models.py`**

- [ ] `WeeklyInsight` con columnas:

```python
class WeeklyInsight(Base):
    __tablename__ = "weekly_insights"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(nullable=False)
    week_start: Mapped[date] = mapped_column(nullable=False)
    headline: Mapped[str] = mapped_column(Text, nullable=False)
    facts: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    recommendations: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    summary_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    s3_key: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "week_start"),
        Index("idx_weekly_insights_user_id", "user_id"),
    )
```

### Checklist de tests

- [ ] Insertar `WeeklyInsight` con datos válidos.
- [ ] Insertar dos veces el mismo `(user_id, week_start)` → error de constraint.
- [ ] `facts` y `recommendations` se serializan/deserializan como listas de strings.
- [ ] `summary_data` se persiste como JSONB.

### Commits del PR

```
feat(ai-service): sqlalchemy async engine y session factory
feat(ai-service): modelo weekly_insight con headline facts recommendations summary_data
```

### Criterio Done

Tests de modelo verdes contra postgres-ai de test.

---

## Rama 4 — `feature/ai-service-alembic`

### Objetivo

Alembic configurado y migración inicial autogenerada.

### Checklist de desarrollo

- [ ] `alembic init alembic`.
- [ ] `alembic.ini` con `sqlalchemy.url` parametrizado vía env (`%(DATABASE_URL)s`).
- [ ] `alembic/env.py` adaptado para SQLAlchemy async (usa `engine_from_config` con `AsyncEngine`).
- [ ] `target_metadata = Base.metadata` importando de `app.db.models`.
- [ ] `alembic revision --autogenerate -m "init"` → crea `weekly_insights` + índice.
- [ ] Revisar la migración generada (eliminar nombres autogenerados feos).
- [ ] `prestart.sh` en raíz del servicio que ejecuta `alembic upgrade head` antes de uvicorn.
- [ ] Documentar en `README.md` cómo crear migraciones nuevas.

### Checklist de tests

- [ ] `alembic upgrade head` deja la DB con `weekly_insights` y el índice.
- [ ] `alembic downgrade base` deja la DB limpia.
- [ ] Migración es idempotente (re-aplicar no rompe).

### Commits del PR

```
feat(ai-service): alembic init con engine async
feat(ai-service): migración inicial weekly_insights
chore(ai-service): prestart.sh ejecuta alembic upgrade head
```

### Criterio Done

`docker compose up postgres-ai ai-service` deja la DB migrada y el servicio arranca contra ella.

---

## Rama 5 — `feature/ai-service-auth-middleware`

### Objetivo

Dependency de autenticación JWT + clases de error + handler global con shape JSON consistente.

### Checklist de desarrollo

**`app/core/errors.py`**

- [ ] `AppError(Exception)` con `code: str`, `message: str`, `status: int`, `details: list | None`.
- [ ] `ValidationError(400)`, `UnauthorizedError(401)`, `ForbiddenError(403)`, `NotFoundError(404)`, `ConflictError(409)`, `RateLimitedError(429)`.

**`app/api/middleware/error_handler.py`**

- [ ] Handler global FastAPI que captura `AppError` y devuelve:
  ```json
  { "error": { "code": "...", "message": "...", "details": [...] } }
  ```
- [ ] Maneja también `RequestValidationError` (Pydantic) → 400.
- [ ] Maneja `Exception` no esperada → 500 `INTERNAL_ERROR`.

**`app/api/deps.py`**

- [ ] `get_current_user_id(authorization: str = Header(...)) -> UUID`:
  - Valida `Authorization: Bearer ...`.
  - Decodifica JWT HS256 con `JWT_SECRET`.
  - Lanza `UnauthorizedError` si inválido/expirado.
  - Devuelve `userId` como UUID.

**`app/api/middleware/internal_auth.py`** (preparado, no usado en v1)

- [ ] Dependency que valida `X-Internal-Secret` contra env.

### Checklist de tests

- [ ] Token válido → user_id correcto.
- [ ] Token expirado → 401.
- [ ] Token con firma incorrecta → 401.
- [ ] Sin header → 401.
- [ ] `AppError` se serializa al shape esperado.
- [ ] Excepción no controlada → 500 con shape `INTERNAL_ERROR`.

### Commits del PR

```
feat(ai-service): clases AppError y subtipos
feat(ai-service): error handler global con shape json consistente
feat(ai-service): dependency get_current_user_id con jwt hs256
feat(ai-service): internal auth middleware preparado
```

### Criterio Done

Tests unitarios verdes; cualquier endpoint protegido rechaza requests sin JWT válido.

---

## Rama 6 — `feature/ai-service-llm-client`

### Objetivo

Cliente LLM abstracto multi-provider con implementaciones intercambiables vía env var.

### Checklist de desarrollo

**`app/clients/llm/base.py`**

- [ ] `LLMClient` abstracta con métodos async:
  - `categorize(note: str, txn_type: str, categories: list[CategoryInput]) -> CategorizeResult`.
  - `insight(snapshot: dict) -> InsightResult`.
- [ ] Schemas Pydantic `CategorizeResult` (`category_id`, `confidence`) y `InsightResult` (`headline`, `facts`, `recommendations`).

**`app/clients/llm/openai_client.py`**

- [ ] Implementación con SDK `openai` async.
- [ ] Retry con `tenacity`: 3 intentos, backoff exponencial, NO reintentar 4xx.
- [ ] Timeout total 20s.
- [ ] `response_format={"type": "json_object"}` para garantizar JSON.
- [ ] Modelos configurables vía `OPENAI_CATEGORIZE_MODEL` / `OPENAI_INSIGHTS_MODEL`.

**`app/clients/llm/anthropic_client.py`**

- [ ] Stub funcional con SDK `anthropic`. No se usa en v1 pero compila y los tests pasan.

**`app/clients/llm/factory.py`**

- [ ] `get_llm_client(purpose: Literal["categorize", "insights"]) -> LLMClient`.
- [ ] Lee `LLM_PROVIDER_CATEGORIZE` / `LLM_PROVIDER_INSIGHTS` y devuelve la implementación correspondiente.

### Checklist de tests

- [ ] `OpenAIClient.categorize` con mock `respx` → parsea respuesta correctamente.
- [ ] `OpenAIClient.insight` con mock → parsea `headline`, `facts`, `recommendations`.
- [ ] Retry funciona en errores 5xx; NO reintenta 4xx.
- [ ] Timeout se respeta.
- [ ] Factory devuelve la clase correcta según env var.

### Commits del PR

```
feat(ai-service): llm client abstracto con categorize e insight
feat(ai-service): openai client con retry tenacity y json mode
feat(ai-service): anthropic client stub funcional
feat(ai-service): factory de llm client por env var
```

### Criterio Done

Tests con `respx` verdes; `get_llm_client("insights")` devuelve `OpenAIClient` cuando `LLM_PROVIDER_INSIGHTS=openai`.

---

## Rama 7 — `feature/ai-service-wallet-user-clients`

### Objetivo

Clientes HTTP para llamar a endpoints internos de Wallet Service y User Service con `X-Internal-Secret`.

### Checklist de desarrollo

**`app/clients/wallet_client.py`**

- [ ] `WalletClient` con `httpx.AsyncClient` (singleton).
- [ ] `get_transactions(user_id: UUID, from_: date, to: date) -> list[dict]`.
- [ ] `get_categories(user_id: UUID) -> list[dict]`.
- [ ] Header `X-Internal-Secret` en todas las requests.
- [ ] Timeouts: connect 2s, read 10s.
- [ ] Retry 3 intentos con backoff.

**`app/clients/user_client.py`**

- [ ] `UserClient` con `httpx.AsyncClient`.
- [ ] `list_active_users() -> list[dict]` (llama a `GET /internal/users` sin filtros para el cron weekly).

### Checklist de tests

- [ ] `get_transactions` con `respx` mock → lista parseada.
- [ ] `get_categories` con `respx` mock.
- [ ] Llamadas incluyen header `X-Internal-Secret`.
- [ ] Timeouts respetados.
- [ ] Retry sobre 5xx; NO retry sobre 4xx.

### Commits del PR

```
feat(ai-service): wallet client con get_transactions y get_categories
feat(ai-service): user client con list_active_users
```

### Criterio Done

Tests con `respx` verdes; clientes envían `X-Internal-Secret` y respetan timeouts.

---

## Rama 8 — `feature/ai-service-s3-client`

### Objetivo

Wrapper `boto3` para subir PDFs y generar URLs pre-signed.

### Checklist de desarrollo

**`app/clients/s3_client.py`**

- [ ] `S3Client` envolviendo `boto3.client("s3")` (configurado con creds de env).
- [ ] `put_pdf(user_id: UUID, week_start: date, pdf_bytes: bytes) -> str` — devuelve `s3_key`.
- [ ] Path: `{user_id}/{week_start}.pdf`. Bucket de env.
- [ ] `presigned_url(s3_key: str, ttl: int = 3600) -> str`.
- [ ] `delete_by_prefix(prefix: str) -> int` — devuelve número de objetos eliminados.
- [ ] Llamadas a `boto3` envueltas en `asyncio.to_thread` (boto3 es sync).

### Checklist de tests

- [ ] `put_pdf` con `moto` o stub → verifica path y bucket.
- [ ] `presigned_url` devuelve URL parseable con TTL correcto.
- [ ] `delete_by_prefix` borra solo los objetos del prefijo dado.

### Commits del PR

```
feat(ai-service): s3 client con put_pdf presigned_url delete_by_prefix
```

### Criterio Done

Tests con `moto` verdes; subida y borrado funcionan localmente.

---

## Rama 9 — `feature/ai-service-redis-cache`

### Objetivo

Wrapper Redis async + helpers de caché para categorize + rate limiter sliding window.

### Checklist de desarrollo

**`app/services/cache.py`**

- [ ] `CacheClient` con `redis.asyncio`.
- [ ] `get_json(key) -> Any | None`, `set_json(key, value, ttl)`, `delete(key)`.

**Helpers específicos**

- [ ] `cache_user_categories(user_id, categories, ttl=86400)`.
- [ ] `get_cached_user_categories(user_id) -> list[dict] | None`.
- [ ] `cache_categorize_result(note, type, user_id, result, ttl=86400)`.
- [ ] `get_cached_categorize_result(note, type, user_id) -> dict | None`.
- [ ] Hash con SHA-256 de `note+type+user_id` para la key.

**`app/api/middleware/rate_limit.py`**

- [ ] Sliding window con Redis (mismo patrón que user/wallet adaptado a Python).
- [ ] Factory `rate_limit(window_seconds, max_requests, key_fn)` que devuelve dependency.
- [ ] `key_fn` por defecto: `user_id` del JWT.

### Checklist de tests

- [ ] `set_json` + `get_json` round-trip.
- [ ] TTL se respeta (con `fakeredis` + time advance).
- [ ] Rate limit permite `max_requests` y bloquea el siguiente.
- [ ] Rate limit se resetea tras `window_seconds`.

### Commits del PR

```
feat(ai-service): cache client redis async
feat(ai-service): helpers de cache para categorize
feat(ai-service): rate limit sliding window redis
```

### Criterio Done

Tests con `fakeredis` verdes; rate limit funciona en integración.

---

## Rama 10 — `feature/ai-service-categorize-service`

### Objetivo

Servicio de categorización con doble caché Redis y prompt corto.

### Checklist de desarrollo

**`app/prompts/categorize.py`**

- [ ] `SYSTEM_PROMPT` constante en español:
  ```
  Eres un clasificador de transacciones. Dada una nota corta y el tipo
  (EXPENSE/INCOME), elige una de las categorías disponibles del usuario.
  Devuelve JSON: { "category_id": "uuid-o-null", "confidence": 0.0-1.0 }.
  Si no estás seguro, baja la confidence. Si confidence<0.5 devuelve category_id=null.
  ```
- [ ] `build_user_prompt(note, txn_type, categories)` que serializa el input.

**`app/services/categorize_service.py`**

- [ ] `CategorizeService` con dependencias inyectadas (`LLMClient`, `WalletClient`, `CacheClient`).
- [ ] `async def categorize(note: str, txn_type: str, user_id: UUID) -> CategorizeResult`:
  1. `get_cached_categorize_result(note, type, user_id)` → si hit, devuelve.
  2. `get_cached_user_categories(user_id)` → si miss, `wallet_client.get_categories` y cachea 24h.
  3. Llama a `LLMClient.categorize`.
  4. Si `confidence < 0.5` → `category_id=None`, `category_name=None`.
  5. Enriquece con `category_name` y `category_icon` buscando en la lista de categorías.
  6. Cachea resultado 24h.
  7. Devuelve `CategorizeResult`.

### Checklist de tests

- [ ] Caché hit en resultado → no llama a LLM ni a Wallet.
- [ ] Caché hit solo en categorías → llama solo a LLM.
- [ ] Caché miss total → llama a Wallet + LLM y cachea ambos.
- [ ] `confidence < 0.5` devuelve `category_id=None`.
- [ ] Cuando LLM devuelve `category_id` inválido (no está en la lista) → trata como `confidence=0`.

### Commits del PR

```
feat(ai-service): system prompt categorize en español
feat(ai-service): categorize service con doble cache redis
```

### Criterio Done

Tests verdes con todos los caminos de caché y baja confianza.

---

## Rama 11 — `feature/ai-service-categorize-endpoint`

### Objetivo

Endpoint público `POST /categorize` con rate limit.

### Contratos

```json
// Request
{ "note": "Mercadona semanal", "type": "EXPENSE" }

// Response 200 (confidence >= 0.5)
{ "category_id": "uuid", "category_name": "Comida", "category_icon": "🍔", "confidence": 0.92 }

// Response 200 (confidence < 0.5)
{ "category_id": null, "category_name": null, "category_icon": null, "confidence": 0.31 }
```

### Checklist de desarrollo

**`app/api/routes/categorize.py`**

- [ ] Router con prefix `/categorize`.
- [ ] Schemas Pydantic `CategorizeRequest` y `CategorizeResponse`.
- [ ] `POST /` con dependencies `get_current_user_id` + `rate_limit(60s, 60)`.
- [ ] Inyección de `CategorizeService` vía `Depends`.
- [ ] Registrar router en `app/main.py`.

### Checklist de tests

- [ ] Sin JWT → 401.
- [ ] JWT válido + nota conocida → 200 con `category_id`.
- [ ] Caso baja confianza → 200 con `category_id=null`.
- [ ] Rate limit: la request 61 en 60s → 429.
- [ ] Schema inválido → 400 con shape de error.

### Commits del PR

```
feat(ai-service): endpoint POST /categorize con rate limit 60 min
```

### Criterio Done

Test integración E2E con LLM y Wallet mockeados verde.

---

## Rama 12 — `feature/ai-service-analytics-loader`

### Objetivo

Carga las últimas 8 semanas de transacciones del Wallet Service y las convierte en `pandas.DataFrame` con normalización de notas.

### Checklist de desarrollo

**`app/analytics/loader.py`**

- [ ] `async def load_transactions_df(user_id: UUID, from_: date, to: date) -> pd.DataFrame`:
  - Llama a `wallet_client.get_transactions`.
  - Construye DataFrame con columnas: `id`, `type`, `amount`, `category_id`, `category_name`, `note`, `note_norm` (`lower(unaccent(note))`), `date`, `wallet_id`.
  - Tipos: `amount` float, `date` datetime, resto strings/UUIDs.
- [ ] `def normalize_note(note: str | None) -> str` — `lower` + `unidecode` + strip.

### Checklist de tests

- [ ] Lista vacía → DataFrame vacío con columnas correctas.
- [ ] Lista con 10 transacciones → DataFrame con 10 filas y tipos correctos.
- [ ] `note_norm` quita acentos y baja a minúsculas.

### Commits del PR

```
feat(ai-service): analytics loader con pandas dataframe y normalización de notas
```

### Criterio Done

Tests verdes con datasets fijos.

---

## Rama 13 — `feature/ai-service-analytics-categories`

### Objetivo

Métricas por categoría: total semanal, media móvil 4 semanas, delta vs media, Z-score.

### Checklist de desarrollo

**`app/analytics/category_metrics.py`**

- [ ] `weekly_total_by_category(df, week_start: date) -> dict[str, float]`.
- [ ] `avg_4w_by_category(df, week_start: date) -> dict[str, float]` — media de las 4 semanas anteriores a `week_start`.
- [ ] `delta_vs_avg(actual: float, avg: float) -> float | None` — porcentaje (None si avg=0).
- [ ] `z_score_by_category(df, week_start: date) -> dict[str, float]` — sobre las 8 semanas previas a la objetivo.

### Checklist de tests

- [ ] Dataset con patrón conocido → totales semanales esperados.
- [ ] Z-score > 1.5 cuando hay un pico claro.
- [ ] Z-score ≈ 0 cuando los datos son estables.
- [ ] Categoría sin gasto en la semana → 0, no error.

### Commits del PR

```
feat(ai-service): analytics métricas por categoría semanal y media 4 semanas
feat(ai-service): analytics z-score por categoría
```

### Criterio Done

Tests verdes con tres datasets fijos (estable, pico, sin gasto).

---

## Rama 14 — `feature/ai-service-analytics-trends`

### Objetivo

Detección de tendencias por categoría y de anomalías + top transacciones por percentil.

### Checklist de desarrollo

**`app/analytics/trends.py`**

- [ ] `linear_trend(values: list[float]) -> tuple[float, float]` — devuelve `(slope_per_week, r_squared)`.
- [ ] `consistent_trend_categories(df, weeks: int = 6) -> list[dict]` — categorías con tendencia clara (r²>0.5 y |slope|>umbral). Devuelve `{category, direction, weeks, slope}`.

**`app/analytics/anomalies.py`**

- [ ] `top_anomalies_by_z_score(df, week_start, threshold: float = 1.5) -> list[dict]`.
- [ ] `top_transactions_by_percentile(df, week_start, percentile: float = 0.95) -> list[dict]` — top transacciones de la semana cuyo `amount` está por encima del percentil dentro de su categoría.

### Checklist de tests

- [ ] Tendencia creciente clara → detectada con `direction="up"`.
- [ ] Tendencia plana → no aparece en la lista.
- [ ] Anomalía Z>1.5 → detectada.
- [ ] Top transacciones excluye las habituales y devuelve solo las atípicas.

### Commits del PR

```
feat(ai-service): analytics tendencias por categoría con regresión lineal
feat(ai-service): analytics anomalías z-score y top transacciones por percentil
```

### Criterio Done

Tests verdes con datasets sintéticos cubriendo tendencia, anomalía y normalidad.

---

## Rama 15 — `feature/ai-service-analytics-recurring`

### Objetivo

Detección de gastos recurrentes implícitos (merchants periódicos no registrados en `recurring_rules`).

### Checklist de desarrollo

**`app/analytics/recurring_detector.py`**

- [ ] `detect_implicit_recurring(df, known_merchants: set[str]) -> list[dict]`:
  - Agrupa por `note_norm`.
  - Filtra grupos con ≥3 transacciones en los últimos meses.
  - Para cada grupo verifica regularidad de intervalos (28-32 días → mensual; 6-8 días → semanal) y consistencia de cantidad (±5%).
  - Excluye merchants que ya aparecen en `known_merchants` (de `recurring_rules`).
  - Devuelve `{merchant, amount, frequency, months_observed}`.

### Checklist de tests

- [ ] Merchant con 6 transacciones mensuales misma cantidad → detectado.
- [ ] Merchant con cantidades muy distintas → no detectado.
- [ ] Merchant ya en `known_merchants` → no detectado.
- [ ] Merchant con intervalos irregulares → no detectado.

### Commits del PR

```
feat(ai-service): analytics detector de recurrentes implícitos
```

### Criterio Done

Tests con datasets fijos cubren los 4 casos.

---

## Rama 16 — `feature/ai-service-analytics-snapshot`

### Objetivo

Agregaciones varias + función orquestadora `build_insight_snapshot` que devuelve el JSON completo a pasar al LLM.

### Checklist de desarrollo

**`app/analytics/aggregations.py`**

- [ ] `weekday_distribution(df, category_id: str) -> dict[int, float]` — porcentaje de gasto por día de semana (0=lunes).
- [ ] `monthly_savings_rate(df, month: date) -> float`.
- [ ] `monthly_by_category_last_3_months(df) -> dict[str, dict[str, float]]`.

**`app/analytics/snapshot.py`**

- [ ] `build_insight_snapshot(user_id, week_start, df, known_merchants) -> dict`:
  - Compone el JSON descrito en `docs/PLAN.md` (sección AI Service) con:
    - `week_start`, `user_currency`
    - `summary_numbers`: `total_spend`, `total_income`, `savings_rate`, `vs_avg_4w_pct`
    - `comparisons_by_category[]`
    - `trends[]`
    - `anomalies_z_score[]`
    - `implicit_recurring_detected[]`
    - `weekday_distribution[]`
    - `top_transactions[]`
    - `active_subscriptions_count`, `active_subscriptions_monthly_total`
- [ ] Maneja el caso "semana objetivo con 0 transacciones" devolviendo `None`.

### Checklist de tests

- [ ] Snapshot tiene todas las claves esperadas.
- [ ] Números cuadran con cálculos manuales de los datasets fijos.
- [ ] Semana sin transacciones → función devuelve `None`.

### Commits del PR

```
feat(ai-service): analytics agregaciones distribución y ratio ahorro
feat(ai-service): analytics snapshot orquesta todas las métricas
```

### Criterio Done

Tests verdes con datasets fijos y dos perfiles distintos.

---

## Rama 17 — `feature/ai-service-insight-service`

### Objetivo

Servicio de generación de insight: snapshot → LLM → persistir → PDF → S3 → evento.

### Checklist de desarrollo

**`app/prompts/insight.py`**

- [ ] `SYSTEM_PROMPT` estricto en español (no inventar números, distinguir hecho de recomendación, `recommendations` puede ser `[]`, formato JSON exacto).
- [ ] `build_user_prompt(snapshot)` que serializa el snapshot.

**`app/services/insight_service.py`**

- [ ] `InsightService` con dependencias inyectadas (`LLMClient`, `WalletClient`, `S3Client`, `EventPublisher`, `PDFRenderer`, `session`).
- [ ] `async def generate(user_id, week_start) -> WeeklyInsight | None`:
  1. Calcula rango `from_ = week_start - 7*INSIGHTS_HISTORY_WEEKS días`, `to = week_start + 6 días`.
  2. `load_transactions_df(user_id, from_, to)`.
  3. Si transacciones en la semana objetivo == 0 → `return None`.
  4. (Opcional) cargar `known_merchants` desde `recurring_rules` si el endpoint existe; si no, set vacío.
  5. `snapshot = build_insight_snapshot(...)`.
  6. `llm_result = await llm_client.insight(snapshot)`.
  7. Construir `summary_text` = `headline` + `". "` + facts en prosa.
  8. UPSERT en `weekly_insights` por `(user_id, week_start)`.
  9. `pdf_bytes = pdf_renderer.render(insight, snapshot)`.
  10. `s3_key = await s3_client.put_pdf(user_id, week_start, pdf_bytes)`.
  11. Actualizar `s3_key` en DB.
  12. `await publisher.publish_insight_generated(user_id, insight.id, week_start)`.
  13. Devolver el insight.

### Checklist de tests

- [ ] Sin transacciones en la semana objetivo → devuelve `None`, no UPSERT, no LLM, no PDF.
- [ ] Con transacciones → UPSERT crea registro nuevo.
- [ ] Llamar dos veces con misma `(user_id, week_start)` → UPDATE, no segundo INSERT.
- [ ] LLM devuelve JSON inválido → error capturado, sin persistir.
- [ ] PDF se sube a S3 y `s3_key` queda guardado.
- [ ] Evento `insight.generated` se publica al final.

### Commits del PR

```
feat(ai-service): system prompt insight estricto sin inventar números
feat(ai-service): insight service orquesta snapshot llm pdf s3 evento
```

### Criterio Done

Test integración con LLM y S3 mockeados E2E verde.

---

## Rama 18 — `feature/ai-service-pdf-renderer`

### Objetivo

Renderizado de PDF con ReportLab + matplotlib según composición acordada.

### Checklist de desarrollo

**`app/services/pdf_renderer.py`**

- [ ] `def render(insight: WeeklyInsight, snapshot: dict) -> bytes`.
- [ ] Helpers privados:
  - `_chart_donut(category_breakdown) -> BytesIO PNG`.
  - `_chart_bars_actual_vs_avg(comparisons) -> BytesIO PNG`.
  - `_chart_line_last_8w(weekly_totals) -> BytesIO PNG`.
  - `_table_top_5(top_transactions) -> Table`.
- [ ] Composición del documento:
  1. Cabecera con logo + título "Resumen semanal del DD al DD de MMMM".
  2. Headline grande.
  3. Tarjetas de datos clave (4 cards con números).
  4. Donut.
  5. Barras actual vs media 4w.
  6. Tabla top 5.
  7. Bloque "Hechos destacados" (lista).
  8. Bloque "💡 Sugerencias" — **omitido si `recommendations == []`**.
  9. Línea evolución últimas 8 semanas.
  10. Pie con branding.

### Checklist de tests

- [ ] PDF generado tiene magic header `%PDF`.
- [ ] PDF generado pesa entre 100 KB y 600 KB para snapshot típico.
- [ ] Con `recommendations == []` → texto del PDF no incluye "Sugerencias".
- [ ] Con `recommendations != []` → texto del PDF incluye el bloque.
- [ ] No lanza excepción con snapshot mínimo.

### Commits del PR

```
feat(ai-service): pdf renderer con matplotlib y reportlab
feat(ai-service): omitir bloque sugerencias en pdf si recommendations vacío
```

### Criterio Done

PDF generado abre correctamente en un visor y contiene todos los bloques esperados.

---

## Rama 19 — `feature/ai-service-insights-list`

### Objetivo

Endpoint `GET /insights` con paginación cursor-based.

### Contratos

```json
// Response 200
{
  "insights": [
    {
      "id": "uuid",
      "week_start": "2026-04-14",
      "headline": "Has ahorrado el 82% de tus ingresos...",
      "summary_text": "...",
      "has_pdf": true,
      "created_at": "2026-04-21T06:00:00Z"
    }
  ],
  "next_cursor": "uuid-or-null"
}
```

### Checklist de desarrollo

**`app/api/routes/insights.py`**

- [ ] Router con prefix `/insights`.
- [ ] `GET /` con query `cursor: UUID | None`, `limit: int = 20` (max 50).
- [ ] Orden `created_at DESC`.
- [ ] Filtro por `user_id` (del JWT).
- [ ] Response incluye `headline` además de `summary_text`.
- [ ] `has_pdf = s3_key IS NOT NULL`.

### Checklist de tests

- [ ] Sin insights → array vacío y `next_cursor = null`.
- [ ] Con 25 insights y `limit=20` → primera página devuelve 20 + cursor; segunda devuelve 5 + cursor null.
- [ ] Sin JWT → 401.

### Commits del PR

```
feat(ai-service): endpoint GET /insights paginado con headline
```

### Criterio Done

Test integración E2E verde.

---

## Rama 20 — `feature/ai-service-insight-detail`

### Objetivo

Endpoint `GET /insights/{week_start}` con detalle completo y `charts` estructurados.

### Contratos

Ver `docs/api-contracts.md` (response con `headline`, `facts`, `recommendations`, `charts`).

### Checklist de desarrollo

- [ ] `GET /insights/{week_start}` con path param `week_start: date`.
- [ ] Validar que `week_start` es lunes.
- [ ] Buscar por `(user_id, week_start)`. 404 si no existe.
- [ ] Construir `charts` a partir de `summary_data`:
  - `category_breakdown`.
  - `weekly_total_last_8w`.
  - `actual_vs_avg_by_category`.
  - `top_transactions`.

### Checklist de tests

- [ ] Insight existente → 200 con shape completo.
- [ ] Insight inexistente → 404.
- [ ] `week_start` que no es lunes → 400.
- [ ] Sin JWT → 401.

### Commits del PR

```
feat(ai-service): endpoint GET /insights/{week_start} con facts recommendations y charts
```

### Criterio Done

Test E2E verde; la app Flutter puede dibujar gráficos desde `charts`.

---

## Rama 21 — `feature/ai-service-insights-generate`

### Objetivo

Endpoint síncrono `POST /insights/generate` que dispara `InsightService.generate` para la última semana completa.

### Checklist de desarrollo

- [ ] `POST /insights/generate` con body vacío.
- [ ] Rate limit 5/min por user.
- [ ] Calcular `week_start = last_complete_monday(now_utc)`.
- [ ] Llamar a `InsightService.generate(user_id, week_start)`.
- [ ] Si devuelve `None` → 204.
- [ ] Si devuelve insight → 201 con shape completo (mismo que GET detail).

### Checklist de tests

- [ ] Con transacciones → 201 con insight.
- [ ] Sin transacciones la semana objetivo → 204.
- [ ] Idempotente: dos requests consecutivas → segunda hace UPDATE, no duplicado.
- [ ] Rate limit: 6ª request en 60s → 429.

### Commits del PR

```
feat(ai-service): endpoint POST /insights/generate síncrono
```

### Criterio Done

Test E2E verde con LLM mockeado.

---

## Rama 22 — `feature/ai-service-insights-export`

### Objetivo

Endpoint `GET /insights/{week_start}/export` que devuelve URL pre-signed S3 con TTL 1h.

### Checklist de desarrollo

- [ ] `GET /insights/{week_start}/export`.
- [ ] Buscar insight por `(user_id, week_start)`. 404 si no existe.
- [ ] Si `s3_key` existe → `presigned_url(s3_key, 3600)`.
- [ ] Si `s3_key` no existe pero el insight sí → renderizar PDF on-the-fly, subir, actualizar `s3_key`, devolver URL.
- [ ] Response `{ "url": "...", "expires_in": 3600 }`.

### Checklist de tests

- [ ] Insight con PDF → URL pre-signed válida.
- [ ] Insight sin PDF → genera y devuelve URL.
- [ ] Insight inexistente → 404.

### Commits del PR

```
feat(ai-service): endpoint GET /insights/{week_start}/export con presigned url
```

### Criterio Done

Abrir la URL devuelta en navegador descarga el PDF correctamente.

---

## Rama 23 — `feature/ai-service-weekly-cron`

### Objetivo

Scheduler APScheduler que genera insights para todos los usuarios activos cada lunes 06:00 UTC.

### Checklist de desarrollo

**`app/tasks/weekly_insights_cron.py`**

- [ ] `AsyncIOScheduler` con job cron `day_of_week=mon, hour=INSIGHTS_CRON_HOUR_UTC, timezone=UTC`.
- [ ] Handler `run_weekly_insights()`:
  1. `users = await user_client.list_active_users()`.
  2. `week_start = last_complete_monday(now_utc)`.
  3. `sem = asyncio.Semaphore(INSIGHTS_CRON_CONCURRENCY)`.
  4. Para cada user, lanzar `_safe_generate(user_id, week_start, sem)` con `asyncio.gather`.
  5. `_safe_generate` captura excepciones por usuario y loggea sin abortar el batch.
  6. Loggear resumen al final: `total`, `success`, `skipped_204`, `errors`.

**`app/main.py`**

- [ ] Arranque del scheduler en `lifespan` (start al `startup`, shutdown al `shutdown`).

### Checklist de tests

- [ ] Job se registra con cron correcto.
- [ ] Trigger manual procesa N users sin abortar al fallar uno.
- [ ] Concurrencia respeta el semáforo.
- [ ] Idempotente: si ya hay insight para la semana, hace UPDATE.

### Commits del PR

```
feat(ai-service): scheduler apscheduler weekly insights lunes 06 utc
feat(ai-service): handler con semáforo y resiliente a fallos por usuario
```

### Criterio Done

Trigger manual del job en local procesa varios usuarios correctamente.

---

## Rama 24 — `feature/ai-service-rabbitmq-publisher`

### Objetivo

Publicador de `insight.generated` con `aio-pika`.

### Checklist de desarrollo

**`app/events/publisher.py`**

- [ ] `EventPublisher` con conexión `aio-pika` singleton.
- [ ] Declara exchange `walletOS.events` (topic, durable) idempotentemente.
- [ ] `async def publish_insight_generated(user_id, insight_id, week_start)`:
  - Payload:
    ```json
    {
      "event": "insight.generated",
      "timestamp": "ISO-8601",
      "data": {
        "user_id": "...",
        "insight_id": "...",
        "week_start": "YYYY-MM-DD"
      }
    }
    ```
  - Routing key `insight.generated`.
  - `delivery_mode=PERSISTENT`.
- [ ] Llamado al final de `InsightService.generate`.

### Checklist de tests

- [ ] Con RabbitMQ real (docker-compose) → mensaje aparece en la cola con el payload correcto.
- [ ] Reconexión automática si la conexión se cae.

### Commits del PR

```
feat(ai-service): event publisher con aio-pika
feat(ai-service): publicar insight.generated tras cada generación
```

### Criterio Done

Integración con RabbitMQ local verde; Notification Service (futuro) puede consumir.

---

## Rama 25 — `feature/ai-service-rabbitmq-consumer`

### Objetivo

Consumer de `user.deleted` que borra insights del usuario y los objetos S3 con prefijo `{user_id}/`.

### Checklist de desarrollo

**`app/events/consumer.py`**

- [ ] Declarar cola `ai-service.user.deleted` (durable).
- [ ] Bind al exchange `walletOS.events` con routing key `user.deleted`.
- [ ] Handler `on_user_deleted(message)`:
  1. Parsear payload.
  2. Borrar `weekly_insights WHERE user_id = X`.
  3. `s3_client.delete_by_prefix(f"{user_id}/")`.
  4. Ack manual.
  5. En caso de error: no ack, RabbitMQ reintenta. Logging.
- [ ] Idempotente: re-procesar el mismo mensaje no debe fallar.

**`app/main.py`**

- [ ] Arranque del worker en `lifespan` con `asyncio.create_task`.

### Checklist de tests

- [ ] Publicar `user.deleted` fake → insights del user borrados.
- [ ] Publicar `user.deleted` fake → objetos S3 con prefijo borrados.
- [ ] Re-procesar mensaje → no falla (idempotente).
- [ ] Excepción en handler → no ack → reintento.

### Commits del PR

```
feat(ai-service): event consumer aio-pika con cola dedicada
feat(ai-service): handler user.deleted borra insights y objetos s3
```

### Criterio Done

Test integración con RabbitMQ + S3 reales (docker-compose) verde.

---

## Rama 26 — `feature/ai-service-dockerfile-prod`

### Objetivo

Dockerfile multi-stage de producción listo para CI/CD.

### Checklist de desarrollo

- [ ] `Dockerfile` con dos stages:
  - **`builder`**: `python:3.12-slim`, instala `uv`, ejecuta `uv sync --frozen --no-dev`, copia código.
  - **`runtime`**: `python:3.12-slim`, copia `.venv` del builder y el código, crea usuario no-root `aiservice`.
- [ ] `EXPOSE 3003`.
- [ ] `CMD ["./prestart.sh"]` → ejecuta `alembic upgrade head` y luego `uvicorn app.main:app --host 0.0.0.0 --port 3003 --workers 2`.
- [ ] `.dockerignore` con `__pycache__/`, `.venv/`, `*.pyc`, `tests/`, `.env`, `.git/`.
- [ ] Imagen final < 400 MB.

### Checklist de tests

- [ ] `docker build` ejecuta sin errores.
- [ ] Contenedor arranca y `GET /health` responde 200.
- [ ] Migraciones se aplican antes de uvicorn.
- [ ] Usuario no-root verificado con `whoami` dentro del contenedor.

### Commits del PR

```
feat(ai-service): Dockerfile prod multi-stage con uv y usuario no-root
```

### Criterio Done

`docker compose -f docker-compose.prod.yml up ai-service` arranca el servicio con migraciones aplicadas y healthcheck verde.

---

## Integración con la infra

### `infra/docker-compose.yml`

- Bloque `ai-service` con `image: ghcr.io/.../ai-service:dev` (en local se construye `Dockerfile.dev`).
- `depends_on`: `postgres-ai`, `redis`, `rabbitmq` con `condition: service_healthy`.
- Puerto `3003:3003`.
- Volumen `./services/ai-service:/app` para hot reload.
- Variables de entorno tomadas de `.env`.

### `infra/init-db/postgres-ai/`

Ya existe (Fase 3). No tocar.

### `.github/workflows/ci.yml`

- Job `test-ai-service`:
  - Trigger por `paths-filter` en `services/ai-service/**`.
  - Setup Python 3.12 + `uv`.
  - Cache de `uv.lock`.
  - Services: postgres-ai, redis, rabbitmq.
  - Pasos: `uv sync`, `uv run ruff check`, `uv run mypy app/`, `uv run pytest`.
- Añadir a la matrix de status checks requeridos en branch protection.

### `lint-staged.config.mjs` (raíz)

```js
'services/ai-service/**/*.py': () => ['ruff check --fix services/ai-service'],
```

---

## Criterio "Done" de la Fase 7

- [ ] Los 5 endpoints públicos responden correctamente con autenticación JWT.
- [ ] Auto-categorización: p95 < 50 ms con caché hit, < 600 ms sin caché. Tasa cache hit > 65% tras 1 semana de uso.
- [ ] Insight semanal contiene `headline` + `facts[]` (verificables contra `summary_data`) + `recommendations[]` (vacío permitido).
- [ ] **Cero alucinaciones numéricas**: tests sobre 5 perfiles sintéticos verifican que cada número en `facts` se deriva de `summary_data`.
- [ ] PDF generado contiene donut + barras actual vs media 4w + línea últimas 8w + tabla top 5 + hechos + sugerencias (omitido si vacío).
- [ ] `GET /insights/{week_start}/export` devuelve URL pre-signed válida con TTL 1h.
- [ ] Cron lunes 06:00 UTC genera insights sin errores; concurrencia respeta semáforo.
- [ ] `insight.generated` se publica tras cada generación exitosa.
- [ ] `user.deleted` borra `weekly_insights` del user y objetos S3 con prefijo `{user_id}/`.
- [ ] CI verde en todos los PRs; cobertura mínima `app/analytics/` ≥ 80%.
- [ ] `docker compose up ai-service` arranca contra postgres-ai/redis/rabbitmq con `GET /health` 200.

---

## Archivos críticos a modificar / crear

| Path                                                                                                                       | Acción                                              |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `services/ai-service/pyproject.toml`, `Dockerfile`, `Dockerfile.dev`, `alembic.ini`, `prestart.sh`                         | Crear                                               |
| `services/ai-service/app/main.py`                                                                                          | Crear (FastAPI + lifespan con scheduler + consumer) |
| `services/ai-service/app/core/{config,errors,logging}.py`                                                                  | Crear                                               |
| `services/ai-service/app/db/{base,models}.py`                                                                              | Crear                                               |
| `services/ai-service/app/api/deps.py`, `app/api/middleware/{error_handler,rate_limit,internal_auth}.py`                    | Crear                                               |
| `services/ai-service/app/api/routes/{health,categorize,insights}.py`                                                       | Crear                                               |
| `services/ai-service/app/clients/llm/{base,openai_client,anthropic_client,factory}.py`                                     | Crear                                               |
| `services/ai-service/app/clients/{wallet_client,user_client,s3_client}.py`                                                 | Crear                                               |
| `services/ai-service/app/services/{cache,categorize_service,insight_service,pdf_renderer}.py`                              | Crear                                               |
| `services/ai-service/app/analytics/{loader,category_metrics,trends,anomalies,recurring_detector,aggregations,snapshot}.py` | Crear                                               |
| `services/ai-service/app/prompts/{categorize,insight}.py`                                                                  | Crear                                               |
| `services/ai-service/app/tasks/weekly_insights_cron.py`                                                                    | Crear                                               |
| `services/ai-service/app/events/{publisher,consumer}.py`                                                                   | Crear                                               |
| `services/ai-service/tests/{unit,integration}/...`                                                                         | Crear                                               |
| `services/ai-service/.env.example`                                                                                         | Ampliar                                             |
| `services/ai-service/README.md`                                                                                            | Actualizar                                          |
| `infra/docker-compose.yml`                                                                                                 | Añadir bloque `ai-service`                          |
| `lint-staged.config.mjs` (raíz)                                                                                            | Añadir regla `services/ai-service/**/*.py`          |
| `.github/workflows/ci.yml`                                                                                                 | Añadir job `test-ai-service`                        |

---

## Patrones reutilizados de user-service y wallet-service

| Patrón                                           | Origen                                  | Adaptación a AI Service                                                                                                   |
| ------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Endpoint interno con `X-Internal-Secret`         | user-service, wallet-service            | Mismo header. Clientes HTTP en `app/clients/wallet_client.py`, `user_client.py`.                                          |
| Sliding window rate limit Redis                  | user-service, wallet-service            | Misma lógica reescrita en Python en `app/api/middleware/rate_limit.py`.                                                   |
| Error handler global + clases `AppError`         | user-service, wallet-service            | `app/core/errors.py` + handler FastAPI con el mismo shape JSON.                                                           |
| Validación JWT HS256 con `JWT_SECRET` compartido | wallet-service                          | `app/api/deps.py:get_current_user_id` con `python-jose`.                                                                  |
| Idempotencia de schema y eventos                 | wallet-service                          | `UNIQUE(user_id, week_start)`; consumer `user.deleted` idempotente.                                                       |
| Cache Redis con invalidación por evento          | wallet-service (categorías 24h, PR #62) | `cat:user:{user_id}:categories` se invalida cuando Wallet publique evento de cambio de categoría (TODO si aún no existe). |
| Bucket S3 + URLs pre-signed                      | Diseño original Fase 7                  | Cliente `boto3` reusa credenciales AWS de Fase 2.                                                                         |
| Docker multi-stage + usuario no-root             | user-service, wallet-service            | Misma estructura adaptada a `python:3.12-slim`.                                                                           |
| Healthcheck `GET /health`                        | user-service, wallet-service            | Idéntico shape `{ "status": "ok", "service": "..." }`.                                                                    |
