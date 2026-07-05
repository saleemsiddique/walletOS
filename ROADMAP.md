# WalletOS — ROADMAP de ejecución

Plan táctico, fase por fase, desde la configuración del repositorio hasta el release de v1.0 en producción.

**Convenciones del roadmap:**

- Cada fase empieza con un mini-contexto, un checklist granular y termina con un criterio "Done cuando".
- Las fases se desarrollan en ramas `feature/...` y se mergean a `main` vía Pull Request con CI verde y self-review.
- Conventional Commits obligatorios; squash merge only en `main`.
- Todo lo que requiera pago externo (VPS, dominio) está agrupado al final para no bloquear el desarrollo local.
- Las 3 decisiones de diseño (PLAN.md, api-contracts.md, user-flow-and-bdd.md) están ya alineadas; ver sección final "Decisiones ya tomadas".

---

## Fase 1 — GitHub y flujo profesional

Montar el repositorio con todas las barreras de calidad antes de escribir una sola línea de producto. El primer PR ya debe pasar por las mismas reglas que el último.

- [x] Crear repositorio `walletOS` en GitHub (público).
- [x] Inicializar `git` local, primer commit en `main`.
- [x] Añadir `.gitignore` (Node, Python, macOS, Xcode, `.env`, `dist/`, `__pycache__/`, `*.pyc`, `node_modules/`, `.DS_Store`).
- [x] Añadir `.editorconfig` (LF, UTF-8, indent 2 spaces para JS/TS/YAML/JSON, 4 para Python, final newline).
- [x] Añadir `LICENSE` (propietaria — source available, all rights reserved).
- [x] Añadir `README.md` inicial (nombre del proyecto, 1 párrafo de descripción, "docs" con enlaces a PLAN.md, api-contracts.md, user-flow-and-bdd.md).
- [x] Añadir `CODEOWNERS` (`* @saleemsiddique`).
- [x] Añadir `.github/PULL_REQUEST_TEMPLATE.md` con secciones: Qué cambia, Por qué, Cómo se probó, Checklist (lint, tests, docs).
- [x] Añadir `.github/ISSUE_TEMPLATE/bug.md` y `feature.md`.
- [x] Crear labels estándar: `bug`, `feature`, `refactor`, `docs`, `chore`, `ci`, `blocked`, `priority:high`, `service:user`, `service:wallet`, `service:ai`, `service:notification`, `service:ios`, `service:infra`.
- [x] Instalar y configurar **Husky** + **lint-staged** (hooks `pre-commit` y `commit-msg`).
- [x] Instalar y configurar **commitlint** con `@commitlint/config-conventional`.
- [x] Documentar convención de ramas: `feature/<scope>-<desc>`, `fix/<scope>-<desc>`, `chore/<desc>`.
- [x] Configurar **branch protection en `main`**: require PR, require 1 approval (self-review vale), require conversations resolved, no force-push, no deletion. ⚠️ CI status checks se añaden en Fase 4.
- [x] Configurar merge commit como opción por defecto y eliminar rama tras merge.
- [x] Habilitar **Dependabot** (`.github/dependabot.yml`) para `npm`, `pip` y `github-actions` semanal.
- [x] Habilitar secret scanning y push protection en GitHub.
- [x] Crear rama `develop`.

**Done cuando:** El repo acepta PRs con commitlint verde, lint-staged ejecuta en pre-commit, branch protection bloquea pushes directos a `main`, y Dependabot aparece configurado.

---

## Fase 2 — Cuentas externas necesarias

Crear todas las cuentas y extraer credenciales que los servicios van a necesitar desde su primera versión. Dejar para Fase 11 solo lo que implica pagar infraestructura de ejecución (VPS, dominio).

### Apple Developer

- [x] Alta en Apple Developer Program (con cuenta ya pagada).
- [x] Crear App ID `com.walletOS.app` con capabilities: Sign in with Apple, Push Notifications.
- [x] Generar **Apple Sign In** key (`AuthKey_AH5KSJB2U2.p8`), anotar `keyId`, `teamId`, `clientId`.
- [x] Generar **APNs** auth key (`AuthKey_38KDR9XZDG.p8`) separada, anotar `keyId`, `teamId`, `bundleId`.
- [x] Guardar ambas `.p8` en `~/keys/`.

### Google Cloud

- [x] Crear proyecto en Google Cloud Console (`walletos-493814`).
- [x] Configurar pantalla de consentimiento OAuth (External, scopes `email`, `profile`, `openid`).
- [x] Crear **OAuth 2.0 Client ID** tipo iOS (bundle `com.walletOS.app`) → `GOOGLE_IOS_CLIENT_ID` anotado.
- [x] Segundo Client ID Web no necesario en v1.

### OpenAI

- [x] Crear cuenta OpenAI Platform.
- [x] Generar **API key** con scope write (solo para AI Service).
- [x] Configurar límites mensuales de gasto para evitar sorpresas.

### Resend

- [x] Crear cuenta en Resend.
- [x] Generar **API key**.
- [x] Añadir dominio más adelante (Fase 11); en dev se envía desde el dominio sandbox de Resend.

### AWS

- [x] Crear cuenta AWS desde cero.
- [x] Crear IAM user `walletos-dev` con política mínima (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` sobre los dos buckets).
- [x] Crear bucket **`walletos-exports-dev`** (región `eu-west-1`), lifecycle: expire tras 30 días.
- [x] Crear bucket **`walletos-exports-prod`**, lifecycle: expire tras 90 días.
- [x] Generar **Access Key + Secret** para el IAM user.

### Gestor de secretos local

- [x] `.env.master` local (gitignoreado) con todas las credenciales. `.p8` en `~/keys/`.
- [x] En producción: GitHub Actions Secrets + `.env.prod` en el VPS.

**Done cuando:** Todas las credenciales (Apple p8, Google Client IDs, OpenAI key, Resend key, AWS key+secret, buckets S3 creados) están disponibles y guardadas de forma segura.

---

## Fase 3 — Monorepo e infra local

Estructura de carpetas del monorepo, `docker-compose.yml` con las piezas que sí se dockerizan (Postgres, Redis, RabbitMQ), y `.env.example` por servicio. S3 y Resend son servicios reales externos, no se dockerizan.

### Estructura del monorepo

- [x] Crear estructura de carpetas:
  ```
  walletOS/
    services/
      user-service/
      wallet-service/
      ai-service/
      notification-service/
    infra/
      docker-compose.yml
      nginx/
      init-db/
    ios/
    docs/
      PLAN.md
      api-contracts.md
      user-flow-and-bdd.md
  ```
- [x] Mover los 3 `.md` de diseño a `docs/`.
- [x] Añadir `README.md` en cada `services/*` (stub con "scaffold en Fase N").

### Docker Compose base

- [x] Crear `infra/docker-compose.yml` con servicios:
  - `postgres` (imagen `postgres:16-alpine`, volumen persistente, puerto `5432`, env `POSTGRES_USER=walletos`).
  - `postgres-ai` (imagen `postgres:16-alpine`, volumen persistente, puerto `5433`, env `POSTGRES_USER=walletos`).
  - `redis` (imagen `redis:7-alpine`, puerto `6379`).
  - `rabbitmq` (imagen `rabbitmq:3-management`, puertos `5672` y `15672`).
- [x] Declarar network `walletos-net` compartida.
- [x] Configurar healthchecks en los 4 servicios.
- [x] Volúmenes con nombre (`postgres_data`, `postgres_ai_data`, `rabbitmq_data`).

### Inicialización de Postgres

- [x] Crear `infra/init-db/postgres/01-create-databases.sh` que cree las 3 DBs de la instancia principal: `walletos_users`, `walletos_wallets`, `walletos_notifications`.
- [x] Crear `infra/init-db/postgres/02-create-extensions.sql` con `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` y `pgcrypto` en cada una de las 3 DBs.
- [x] Crear `infra/init-db/postgres-ai/01-create-database.sh` que cree `walletos_ai` en la instancia AI.
- [x] Crear `infra/init-db/postgres-ai/02-create-extensions.sql` con las mismas extensiones en `walletos_ai`.
- [x] Montar `infra/init-db/postgres/` como `/docker-entrypoint-initdb.d` en el contenedor `postgres`.
- [x] Montar `infra/init-db/postgres-ai/` como `/docker-entrypoint-initdb.d` en el contenedor `postgres-ai`.

### RabbitMQ inicial

- [x] Documentar en `infra/rabbitmq/README.md` el topic exchange `walletOS.events` y las queues que cada servicio creará.
- [x] No crear exchanges por adelantado — cada servicio los declara idempotentemente al arrancar.

### Variables de entorno

- [x] Crear `.env.example` en cada `services/*` con las variables que necesita (DB_URL, REDIS_URL, RABBITMQ_URL, JWT_SECRET, INTERNAL_SECRET, credenciales externas relevantes).
- [x] Documentar en `infra/README.md` cómo crear el `.env` local partiendo del `.env.example`.
- [x] Añadir `.env*` al `.gitignore` (ya debería estar) y verificar que `.env.example` sí está trackeado.

### Seed

- [x] Documentar que el seed de categorías por defecto vive en Wallet Service (Fase 6) y se ejecuta en `wallet-service/prisma/seed.ts`.

**Done cuando:** `docker compose up` en `infra/` levanta Postgres principal con 3 DBs + `postgres-ai` con 1 DB, Redis y RabbitMQ; la UI de management de RabbitMQ es accesible en `localhost:15672`; `psql` conecta a las 4 bases (2 instancias).

---

## Fase 4 — CI base (GitHub Actions)

Dejar CI configurado antes del primer servicio. Aunque al inicio los tests sean mínimos, el primer PR del primer servicio ya pasa por lint + test automáticos.

- [x] Crear `.github/workflows/ci.yml` con triggers `pull_request` y `push` a `main`.
- [x] Definir **matrix strategy** por servicio: `user-service`, `wallet-service`, `notification-service` (Node 20), `ai-service` (Python 3.12).
- [x] Job "lint" por servicio: corre solo si hay cambios en ese path (`dorny/paths-filter@v3`).
- [x] Job "test" por servicio: monta Postgres + Redis + RabbitMQ como services de GitHub Actions (AI Service usa `postgres-ai` en puerto 5433 en lugar del postgres principal).
- [x] Cache de dependencias: `actions/setup-node@v4` con `cache: npm`, `actions/setup-python@v5` con `cache: pip`.
- [x] Añadir workflow `commitlint.yml` que valida los commits del PR.
- [x] Añadir badge de CI en `README.md`.
- [x] Configurar **status checks requeridos** en branch protection de `main` y `develop` (`Check formatting`, `Lint commit messages`).
- [x] Añadir workflow `markdown-lint.yml` (cubierto por el job `format` con Prettier).

**Done cuando:** Al abrir un PR, GitHub Actions ejecuta lint + test + commitlint, y merge a `main` está bloqueado si alguno falla.

---

## Fase 5 — User Service

Primer servicio del backend. Se construye en múltiples PRs pequeñas, cada una con su ámbito claro. Es el servicio que desbloquea todo lo demás (autenticación compartida por el resto).

### Scaffold

- [x] PR "user-service: scaffold": crear `package.json`, `tsconfig.json`, estructura de carpetas (`src/controllers`, `src/services`, `src/middleware`, `src/routes`, `src/lib`, `src/config`), ESLint + Prettier, script `dev` con `tsx watch`.
- [x] Añadir `Dockerfile.dev` (hot reload con tsx watch y volumen montado).
- [x] Healthcheck endpoint `GET /health` → `200 { status: "ok" }`.
- [x] Integrar servicio al `docker-compose.yml` con puerto `3001`.

### Base de datos

- [x] PR "user-service: prisma schema": añadir Prisma, crear `schema.prisma` con tablas `users`, `refresh_tokens`, `password_reset_tokens`.
- [x] Ejecutar primera migración: `prisma migrate dev --name init`.
- [x] Índices: `users(email)`, `users(apple_id)`, `users(google_id)`, `refresh_tokens(user_id)`, `refresh_tokens(token_hash)`, `password_reset_tokens(token_hash)`.

### Utilidades compartidas

- [x] PR "user-service: auth lib": helpers JWT (sign/verify), bcrypt wrapper, generador de refresh tokens opacos (32 bytes hex).
- [x] PR "user-service: rate limiting": middleware con Redis (sliding window).
- [x] PR "user-service: error handler": middleware global, clases de error (`ValidationError`, `UnauthorizedError`, etc.).
- [x] PR "user-service: zod validators": schemas de entrada para todos los endpoints.
- [x] PR "user-service: internal auth middleware": valida `X-Internal-Secret` contra env var.

### Endpoints — autenticación pública

- [x] PR "user-service: register": `POST /register` + tests.
- [x] PR "user-service: login": `POST /login` + tests.
- [x] PR "user-service: apple sign in": `POST /apple` + verificación de identity token + tests.
- [x] PR "user-service: google sign in": `POST /google` + verificación de id_token (librería `google-auth-library`) + tests.
- [x] PR "user-service: refresh": `POST /refresh` (rotación de refresh token en transacción atómica) + tests.
- [x] PR "user-service: logout": `POST /logout` (elimina refresh token de DB, idempotente) + tests.

### Endpoints — password reset

- [x] PR "user-service: forgot-password": `POST /auth/forgot-password`, genera token, guarda hash en `password_reset_tokens`, envía email vía Resend (con deep link `walletos://reset?token=...`).
- [x] PR "user-service: reset-password": `POST /auth/reset-password`, valida token, actualiza `password_hash`, marca token como usado, revoca todos los refresh tokens del user.

### Endpoints — me

- [x] PR "user-service: get me": `GET /me` (incluye flags `has_password`, `apple_linked`, `google_linked`).
- [x] PR "user-service: patch me": `PATCH /me` (name, currency, tz).
- [x] PR "user-service: delete me": `DELETE /me` publica `user.deleted` a RabbitMQ y borra en cascada.

### Endpoints internos

- [x] PR "user-service: internal endpoints": `GET /internal/users/:id`, `GET /internal/users` (filtros `timezone`, `reminder_enabled`) con `X-Internal-Secret`.

### RabbitMQ

- [x] PR "user-service: event publisher": publica `user.deleted` en `walletOS.events`.

### Docker de producción

- [x] PR "user-service: Dockerfile prod": multi-stage build, imagen final `node:20-alpine`, usuario no-root.

**Done cuando:** Los 11 endpoints públicos + 2 internos están implementados, con tests unitarios y de integración pasando, `docker compose up user-service` lo arranca, y el servicio publica `user.deleted` al eliminar una cuenta.

---

## Fase 6 — Wallet Service

Motor financiero. Es el servicio con más endpoints y la lógica más delicada (transferencias atómicas).

### Scaffold

- [x] PR "wallet-service: scaffold" (mismo patrón que user-service). — PR #50 mergeado
- [x] Añadir regla `services/wallet-service/**/*.ts` en `lint-staged.config.mjs` raíz (lint + typecheck). — PR #50
- [x] Puerto `3002`. — PR #50
- [x] Middleware `authenticate` que verifica JWT emitido por User Service (mismo `JWT_SECRET`). — PR #52

### Base de datos

- [x] PR "wallet-service: prisma schema": `banks`, `wallets`, `categories`, `transactions`, `recurring_rules`. — PR #51 mergeado
- [x] Campo `type WalletType (CASH | INVESTMENT)` en `wallets` — preparado para Ramas 14-15. — PR #51
- [x] Constraint `UNIQUE NULLS NOT DISTINCT (user_id, name, type)` en `categories`. — PR #51
- [x] Índices: `wallets(user_id)`, `wallets(bank_id)`, `transactions(wallet_id, date DESC)`, `transactions(user_id, date DESC)`, `categories(user_id)`. — PR #51
- [x] Migración inicial `prisma migrate dev --name init`. — PR #51

### Seed

- [x] PR "wallet-service: seed categorías": seed idempotente que, al arrancar el servicio, inserta categorías por defecto (`user_id = NULL`) si no existen. — PR #52 mergeado

### Utilidades

- [x] PR "wallet-service: balance calculator": módulo que calcula balance de un wallet por agregación de transacciones. — PR #52
- [x] PR "wallet-service: internal auth middleware". — PR #52
- [x] PR "wallet-service: error handler + clases AppError". — PR #52
- [x] PR "wallet-service: rate limiter sliding window Redis". — PR #52
- [x] PR "wallet-service: zod validators (banks, wallets, transactions, transfers, categories, recurring, stats)". — PR #52

### Endpoints — categorías

- [x] PR "wallet-service: categories": `GET /categories`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`. — PR #53

### Endpoints — banks

- [x] PR "wallet-service: banks": `GET /banks`, `POST /banks`, `PATCH /banks/:id`, `DELETE /banks/:id` (soft delete: archiva banco y wallets, transactions se conservan). — PR #54

### Endpoints — wallets

- [x] PR "wallet-service: wallets list": `GET /banks/:id/wallets`, `GET /wallets` (plano con `bank_name`). — PR #55
- [x] PR "wallet-service: wallets crud": `POST /banks/:id/wallets`, `PATCH /wallets/:id`, `DELETE /wallets/:id` soft delete. — PR #55
- [ ] PR "wallet-service: wallet transactions": `GET /wallets/:id/transactions` con paginación cursor-based.

### Endpoints — transactions

- [x] PR "wallet-service: create transaction": `POST /wallets/:id/transactions` con soporte para `id?` UUID opcional (offline sync). — PR #57
- [x] PR "wallet-service: transactions crud": `GET /transactions/:id`, `PATCH /transactions/:id`, `DELETE /transactions/:id`. — PR #58
- [x] PR "wallet-service: transfer": `POST /transfers` en transacción DB atómica (par EXPENSE+INCOME con `transfer_id` compartido). — PR #59
- [x] PR "wallet-service: list transactions": `GET /transactions` cross-wallet con filtros (fecha, tipo, wallet, categoría). — PR #58

### Endpoints — recurring

- [x] PR "wallet-service: recurring crud": `GET /recurring`, `POST /recurring`, `PATCH /recurring/:id`, `DELETE /recurring/:id`. — PR #60
- [x] PR "wallet-service: recurring scheduler": cron diario (node-cron `0 6 * * *`) que materializa transactions pendientes de reglas recurrentes. — PR #60

### Endpoints — stats

- [x] PR "wallet-service: stats": `GET /stats` (totales mes + previo + by_category), `GET /stats/daily` (serie temporal), `GET /dashboard` (balance + recientes). — PR #61

### Endpoints internos

- [x] PR "wallet-service: internal endpoints": `GET /internal/transactions?user_id&from&to`, `GET /internal/categories?user_id` (con cache Redis 24h y auto-invalidación). — PR #62. _Nota: el endpoint de wallets internos del plan original no se implementó porque no se necesitó; el AI Service solo requería transactions y categories para insights y auto-categorización._

### RabbitMQ

- [x] PR "wallet-service: event publisher": publica `transaction.created` tras cada POST de transaction (no en transferencias). Consolidado en `lib/events.ts`. — PR #62
- [x] PR "wallet-service: user.deleted consumer": al consumir `user.deleted`, borra en cascada todos los datos del user (bancos+wallets+transactions+recurring+categorías custom) + invalida cache Redis. — PR #62

### Docker

- [x] PR "wallet-service: Dockerfile prod". Multi-stage con usuario no-root + `tsconfig.build.json` que compila a CommonJS para que Node 20 ejecute `dist/server.js` sin extensiones `.js`. — PR #63 (hotfix paralelo en user-service: PR #64)

### Carteras de inversión

- [x] PR "wallet-service: investment transactions": tabla `investment_transactions`, endpoints `POST /wallets/:id/investment-transactions`, `GET /wallets/:id/investment-transactions`, `DELETE /investment-transactions/:id`. — PR #65
- [x] PR "wallet-service: portfolio": tabla `price_cache`, integración TwelveData (TTL 30 min abierto / 24h cerrado), `GET /wallets/:id/portfolio` (posiciones calculadas + precio en tiempo real) + dashboard actualizado para incluir valor de inversión. — PR #66

**Done cuando:** Los **31 endpoints públicos + 2 internos** están implementados (desglose canónico en `docs/PLAN.md`), transferencias atómicas verificadas con tests, `transaction.created` se publica correctamente, seed de categorías se ejecuta al arrancar, `GET /wallets/:id/portfolio` devuelve posiciones con precio en tiempo real. ✅ **Fase 6 completa: PR #67 mergeado a main el 2026-05-30 con 237 tests verdes.**

---

## Fase 7 — AI Service (Python / FastAPI)

Servicio más diferente del stack: Python 3.12, SQLAlchemy async, Alembic, APScheduler. Consume transacciones de Wallet Service vía endpoint interno, calcula métricas deterministas con pandas, usa el LLM **solo para redactar** (nunca para calcular), renderiza PDFs con ReportLab + matplotlib y los sube a S3.

**Principio rector:** todo el análisis numérico se hace en `app/analytics/` con código Python verificable. El LLM recibe datos ya digeridos en JSON y devuelve únicamente texto estructurado (`headline`, `facts[]`, `recommendations[]`). Esto elimina alucinaciones numéricas y desacopla la calidad del modelo del valor del producto.

### Decisiones de modelo y proveedor (v1)

- **Cliente LLM abstracto multi-provider** (`LLMClient` con implementaciones `OpenAIClient`, `AnthropicClient`). Selección por env vars `LLM_PROVIDER_CATEGORIZE` y `LLM_PROVIDER_INSIGHTS`.
- **Provider v1:** OpenAI `gpt-4o-mini` para ambas funcionalidades (categorización e insights). Cambiar a Anthropic Claude Haiku 4.5 es cambiar una variable de entorno.
- **Histórico para insights:** 8 semanas (`INSIGHTS_HISTORY_WEEKS=8`).
- **Cron weekly:** lunes 06:00 UTC (`INSIGHTS_CRON_HOUR_UTC=6`).
- **LLM local descartado en v1**: ningún modelo con calidad y latencia útiles cabe en el CAX21 sin asfixiar al resto del stack. Self-hosting con GPU dedicado solo compensa con >20k usuarios activos.

**Progreso (2026-06-16):** ✅ **Las 26 ramas (Bloques 0–J) completas en `develop`** (PRs #81–#110). Suite 107 tests verdes, ruff + mypy strict limpios. Mergeado a `main` el 2026-06-30. Detalle por rama en [`docs/phase-7-ai-service.md`](docs/phase-7-ai-service.md).

### Bloque 0 — Documentación (antes de tocar código)

- [x] PR "docs(root): actualizar ROADMAP fase 7 con alcance ampliado".
- [x] PR "docs(plan): actualizar PLAN.md con responsabilidades ampliadas del AI Service".
- [x] PR "docs(api-contracts): ampliar contratos del AI Service" (`headline`, `facts`, `recommendations`, `charts`).
- [x] PR "docs(user-flow-and-bdd): actualizar schema y pantallas de insight".
- [x] PR "docs(phase-7): crear `docs/phase-7-ai-service.md`".

### Bloque A — Scaffold y base

- [x] PR "ai-service: scaffold": `pyproject.toml` con `uv`, FastAPI, uvicorn, estructura `app/{api,core,db,services,clients,analytics,prompts,tasks,events}`, ruff + mypy + pytest, `Dockerfile.dev`, healthcheck `GET /health`, integración en `infra/docker-compose.yml` puerto `3003`. — PR #81. _Decisión: `uv` como gestor único y CI migrado de pip a uv; config de ruff/mypy/pytest consolidada en `pyproject.toml`._
- [x] Añadir regla `services/ai-service/**/*.py` en `lint-staged.config.mjs` raíz (`ruff check --fix`). — PR #81
- [x] PR "ai-service: config y settings": `pydantic-settings` con todas las env vars (DB, Redis, RabbitMQ, secretos internos, LLM providers + modelos, AWS, `INSIGHTS_HISTORY_WEEKS`, `INSIGHTS_CRON_HOUR_UTC`). Logger JSON estructurado. — PR #82

### Bloque B — Base de datos

- [x] PR "ai-service: sqlalchemy models": `WeeklyInsight` con columnas `id`, `user_id`, `week_start`, `headline`, `facts JSONB`, `recommendations JSONB`, `summary_data JSONB`, `summary_text`, `s3_key`, `created_at`. Constraint `UNIQUE(user_id, week_start)`. — PR #83
- [x] PR "ai-service: alembic setup": `alembic init`, migración inicial autogenerada con índice `idx_weekly_insights_user_id`. Script `prestart.sh` que ejecuta `alembic upgrade head`. — PR #84

### Bloque C — Middleware y utilidades

- [x] PR "ai-service: auth middleware": dependency `get_current_user_id` que valida JWT HS256 (mismo `JWT_SECRET` que User Service). Clases `AppError`, `UnauthorizedError`, `NotFoundError`, `ValidationError` con handler global. — PR #87
- [x] PR "ai-service: cliente LLM abstracto": `LLMClient` base + `OpenAIClient` + `AnthropicClient` (stub funcional) + factory por env var. Retry con `tenacity`. — PR #88
- [x] PR "ai-service: wallet y user clients": `httpx.AsyncClient` para `GET /internal/transactions` y `GET /internal/categories` con `X-Internal-Secret`. Timeouts + retry. — PR #89
- [x] PR "ai-service: s3 client": wrapper `boto3` con `put_object`, `generate_presigned_url` (TTL 3600s), `delete_objects_by_prefix`. — PR #90
- [x] PR "ai-service: redis cache": wrapper `redis.asyncio` + helpers `cache_user_categories(user_id)`, `cache_categorize_result(note, type, user_id)`. — PR #91

### Bloque D — Auto-categorización

- [x] PR "ai-service: categorize service": prompt corto con nota + tipo + categorías del usuario. Doble caché Redis (lista categorías 24h + resultado 24h por `hash(note+type+user_id)`). Si `confidence < 0.5`, devuelve `category_id=null`. — PR #93
- [x] PR "ai-service: endpoint POST /categorize": router, schemas Pydantic, rate limit Redis (60/min por user). — PR #95

### Bloque E — Analytics deterministas para insights

- [x] PR "ai-service: analytics — loader": carga últimas 8 semanas del Wallet Service y construye `pandas.DataFrame`. Normalización de notas (`lower(unaccent)`) para agrupar merchants. — PR #96
- [x] PR "ai-service: analytics — métricas por categoría": `weekly_total_by_category`, `avg_4w_by_category`, `delta_vs_avg`, `z_score_by_category`. — PR #97
- [x] PR "ai-service: analytics — tendencias y anomalías": regresión lineal por categoría, anomalías Z-score, top transacciones por percentil. — PR #98
- [x] PR "ai-service: analytics — recurrentes implícitos": detecta merchants con cantidad ±5% a intervalos regulares no registrados en `recurring_rules`. — PR #99
- [x] PR "ai-service: analytics — agregaciones varias": distribución por día de semana, ratio ahorro mensual, mes vs mes por categoría. Función `build_insight_snapshot` que orquesta todos los analytics y devuelve el JSON pre-calculado. — PR #100

### Bloque F — Generación de insight (LLM + PDF)

- [x] PR "ai-service: prompt e insight service": `app/prompts/insight.py` con system prompt estricto (no inventar números, separar hecho de recomendación, recommendations puede ser vacío). `insight_service.generate(user_id, week_start)` orquesta snapshot → LLM → guardar → PDF → S3 → publicar evento. — PR #101
- [x] PR "ai-service: pdf renderer con gráficos": ReportLab + matplotlib. Composición: cabecera, datos clave, donut por categoría, barras actual vs media 4 semanas, línea últimas 8 semanas, tabla top 5 transacciones, hechos, recomendaciones (omitido si vacío), pie. — PR #102

### Bloque G — Endpoints de insights

- [x] PR "ai-service: GET /insights": lista paginada cursor-based con `headline` además de `summary_text`. — PR #103
- [x] PR "ai-service: GET /insights/{week_start}": detalle completo con `headline`, `facts`, `recommendations`, `charts.{category_breakdown, weekly_total_last_8w, actual_vs_avg_by_category}`, `summary_text`, `has_pdf`. — PR #104
- [x] PR "ai-service: POST /insights/generate": síncrono. Calcula `week_start` = último lunes UTC. 201 con insight, 204 si no había transacciones. Rate limit 5/min por user. — PR #105
- [x] PR "ai-service: GET /insights/{week_start}/export": URL pre-signed S3 TTL 1h. Si PDF no existe, genera on-the-fly. — PR #106

### Bloque H — Scheduler

- [x] PR "ai-service: apscheduler weekly insights cron": cada lunes 06:00 UTC. Itera usuarios activos (`user-service:/internal/users`), genera insight con `asyncio.gather` + semáforo (concurrencia limitada, p.ej. 10). Idempotente: si ya existe, UPDATE. — PR #107

### Bloque I — RabbitMQ

- [x] PR "ai-service: insight.generated publisher": publica en `walletOS.events` con `aio-pika` al final de `insight_service.generate`. — PR #108
- [x] PR "ai-service: user.deleted consumer": consume del exchange, filtra routing key, borra `weekly_insights` del user + objetos S3 con prefijo `{user_id}/`. Idempotente. — PR #109

### Bloque J — Producción

- [x] PR "ai-service: Dockerfile prod": multi-stage `python:3.12-slim` con `uv` para resolver deps, imagen final sin uv. Usuario no-root. `CMD` ejecuta `prestart.sh` (alembic upgrade) y luego `uvicorn` con workers. — PR #110

**Done cuando:** Los **5 endpoints públicos** funcionan; las categorizaciones tienen latencia <600ms p95 sin caché y <50ms con caché hit; el insight semanal contiene `headline` + `facts[]` (verificables contra `summary_data`) + `recommendations[]` (vacío permitido); los **PDFs** se generan con donut + barras + línea + tabla top 5 y son descargables vía URL pre-signed S3; el cron del lunes 06:00 UTC genera insights sin errores; `insight.generated` se publica correctamente; `user.deleted` borra insights y objetos S3 del usuario; **cero alucinaciones numéricas** en `facts` verificadas contra el snapshot. ✅ **Fase 7 completa y mergeada a `main` el 2026-06-30 (PRs #81–#110, 107 tests verdes).**

---

## Fase 8 — Notification Service

Servicio final del backend. Consume eventos de los otros y envía push notifications vía APNs.

### Scaffold

- [x] PR "notification-service: scaffold" (Node.js, mismo patrón que user/wallet). — PR #115
- [x] Añadir regla `services/notification-service/**/*.ts` en `lint-staged.config.mjs` raíz (lint + typecheck). — PR #115
- [x] Puerto `3004`. — PR #115

> Plan detallado por rama en [`docs/phase-8-notification-service.md`](docs/phase-8-notification-service.md). Cliente nativo iOS → **APNs directo** (sin FCM/Android). Servicio terminal: consume eventos, no publica ninguno.

### Base de datos

- [x] PR "notification-service: prisma schema": `device_tokens` (token APNs, `platform` default `ios`), `notifications` (centro de notificaciones: `type`, `title`, `body`, `status`, `read_at`). — PR #117
- [x] Migración inicial. — PR #117

### APNs

- [x] PR "notification-service: apns client": librería **`apns2`** (HTTP/2, auth por token JWT con `.p8` + keyId + teamId), modo sandbox en dev. Purga tokens caducados (`410`). — PR #119

### Endpoints

- [x] PR "notification-service: devices": `POST /devices` (upsert del token), `DELETE /devices/:token` (unregister, idempotente). — PR #122
- [x] PR "notification-service: centro de notificaciones": `GET /notifications` (paginado cursor + `unread_count`), `PATCH /notifications/:id/read`, `POST /notifications/read-all`. — PR #123

### RabbitMQ consumers

- [x] PR "notification-service: transaction.created consumer": marca `activity:{user_id}:{date}` (Redis) y, si `type=EXPENSE && high_spend_enabled && amount >= threshold` (consulta `/internal/users/:id`), envía **alerta de gasto alto**. — PR #125
- [x] PR "notification-service: insight.generated consumer": push "Tu resumen semanal está listo". — PR #126
- [x] PR "notification-service: user.deleted consumer": borra `device_tokens` y `notifications` del user. — PR #124

### Scheduler

- [x] PR "notification-service: reminder cron": node-cron horario; a las **21:00 hora local** del user (ventana ±30 min) envía recordatorio a quien tenga `reminder_enabled` y no haya registrado gasto ese día (`activity` key), con idempotencia Redis. — PR #127

### Docker

- [x] PR "notification-service: Dockerfile prod". — PR #128

> Ramas auxiliares de utilidades (config, utilities, user-client, sender) en PRs #116, #118, #120, #121.

**Done cuando:** Los **5 endpoints** funcionan (devices + centro de notificaciones), los 3 consumers procesan eventos (incl. alerta de gasto alto y borrado en `user.deleted`), cada push queda persistida en `notifications`, el recordatorio diario llega a las 21:00 local sin duplicados ni a quien ya registró gasto, los tokens caducados se purgan, y las push llegan a un iPhone de prueba en sandbox APNs. ✅ **Fase 8 completa y mergeada a `main` el 2026-06-30 (PRs #115–#128, 76 tests verdes, typecheck + lint limpios).** La verificación de **push real a un iPhone en sandbox APNs** queda pendiente (manual; requiere dispositivo + clave `.p8` real, se hará con la app nativa en Fase 10).

---

## Fase 9 — Nginx local y flujo E2E

Atar todos los servicios detrás de un Nginx local para validar el flujo completo como lo vería la app.

**Progreso (2026-06-30):** `infra/nginx/nginx.conf` y bloque en `docker-compose.yml` implementados. Colección Bruno committada en `docs/api-collection/`. Verificación E2E completada con el stack completo en Docker: **los 8 escenarios pasan** (con claves reales OpenAI/AWS; PDF de insight descargado de S3). La verificación destapó y corrigió 4 bugs reales (routing nginx con barra final, contrato del evento `user.deleted`, `Dockerfile.dev` sin `prisma generate`/migración en los 3 Node, ai-service sin `alembic upgrade`). Detalle en [`docs/phase-9-nginx-e2e.md`](docs/phase-9-nginx-e2e.md).

> Plan detallado de implementación en [`docs/phase-9-nginx-e2e.md`](docs/phase-9-nginx-e2e.md).

- [x] Crear `infra/nginx/nginx.conf`:
  - `location ~ ^/api/(register|login|apple|google|refresh|logout)$` → user-service.
  - `location /api/auth/` y `/api/me` → user-service.
  - `location /api/banks`, `/api/wallets`, `/api/transactions`, `/api/transfers`, `/api/categories`, `/api/recurring`, `/api/stats`, `/api/dashboard`, `/api/investment-transactions` → wallet-service.
  - `location /api/insights`, `/api/categorize` → ai-service.
  - `location /api/devices`, `/api/notifications` → notification-service.
  - **`/api/internal/` → retorna `403`**.
- [x] Añadir servicio `nginx` al `docker-compose.yml` en puerto `80`.
- [x] CORS headers configurados en nginx (`Access-Control-Allow-Origin: *` en dev).
- [x] Crear colección Bruno y commitearla en `docs/api-collection/`.
- [x] Flujo E2E con todos los servicios arriba (verificado vía `curl` contra `http://localhost/api`):
  - [x] Register → login → refresh → me.
  - [x] Crear bank → crear wallet → crear transaction → GET transactions.
  - [ ] Crear recurring → avanzar reloj del host → verificar materialización. _(no incluido en esta tanda)_
  - [x] `POST /insights/generate` → insight 201 + PDF descargado de S3 vía URL pre-signed.
  - [x] Forgot password → reset password (envío Resend OK; revisión de bandeja queda manual).
  - [x] DELETE /me → wallets, transactions, banks e insights del user desaparecen (evento `user.deleted` corregido).
  - [x] `GET /api/internal/users` → 403 desde nginx.

**Done cuando:** Todo el flujo de la app se puede ejecutar contra `http://localhost/api/...` sin errores y los 8 escenarios E2E de la colección Bruno pasan. ✅ **Fase 9 completa y mergeada a `main` el 2026-06-30 (PR #131): 8/8 escenarios E2E verdes con el stack completo en Docker; 4 bugs reales corregidos (routing nginx, evento `user.deleted`, `Dockerfile.dev` de los 3 Node sin prisma generate/migrate, ai-service sin alembic upgrade).**

---

## Fase 10 — App nativa iOS (Swift / SwiftUI)

La app del usuario final, **nativa iOS** (Swift + SwiftUI, iOS 16+). Se desarrolla una vez el API está estable.

**Progreso (2026-07-04):** 🚧 implementación en marcha en Mac (Xcode 26.6, Swift 6.3). **Ramas 1–9 completas en `develop`** (PRs #146, #148–#152, #154–#156, #158) — Bloque B (Core/infraestructura) cerrado y pantalla de auth funcional. Proyecto generado con **XcodeGen**, arquitectura **feature-first** (`Features/`+`Core/`+`Shared/`), capa de red (interceptor Bearer + refresh coalesced), Keychain/TokenStore, base de datos local GRDB, motor de sincronización offline-first (cola FIFO + backoff), configuración de entornos y auth email+password contra el backend. Verificación en simulador iPhone 17 (iOS 26.5) como criterio de "hecho". Plan detallado por rama en [`docs/phase-10-ios-app.md`](docs/phase-10-ios-app.md).

> **Pivote estético (2026-07-04):** la identidad inicial con mascota (Rama 3, PR #149) se **retiró del producto** (PR #160) y la dirección visual se re-estipuló: **"Ledger" — terminal premium nativa** (monocromo 6 tokens, acento fósforo, negro OLED, SF Pro + SF Mono en números, una acción primaria por pantalla) — documentada en [`docs/design-system.md`](docs/design-system.md) (PR #161) y **ya aplicada en código**: `Core/Theme` re-tokenizado y auth re-skineada (PR #162). No hay specs por pantalla: la UI se deriva del design system y de `docs/user-flow-and-bdd.md`; los checklists de pantallas de abajo describen el alcance funcional, no el layout.

### Setup del proyecto

- [x] Crear proyecto Xcode `WalletOS` (Swift + SwiftUI, iOS 16+), bundle id `com.walletOS.app`; capabilities: Sign in with Apple, Push Notifications, Background Modes. — PR #146 (vía XcodeGen; `project.yml` es la fuente de verdad)
- [x] Estructura **feature-first**: `Features/<Feature>/{Domain,Data,Presentation}` + `Core/` (infra) + `Shared/` (dominio y UI cross-feature). — PR #146 / #151
- [x] `SwiftLint` + `swift-format` configurados, integrados en pre-commit del monorepo. — PR #146
- [x] PR "ios: design system": tokens de color light/dark, tipografía, spacing/radios/motion, haptics, `IconCatalog` (emoji↔SF Symbol), `PrimaryButton`, formato EUR. — PR #148 · **re-tokenizado a "Ledger" en el PR #162**
- [x] PR "ios: motor de la mascota": `MascotView`/`MascotPanel` + 4 PNG base. — PR #149 · **retirado en el pivote estético (PR #160)**

### Core / infraestructura

- [x] PR "ios: networking layer": cliente HTTP con `URLSession` (async/await), interceptor que añade `Authorization: Bearer` y refresh silencioso ante 401 (coalesced). — PR #150
- [x] PR "ios: secure storage": **Keychain** para guardar access + refresh tokens (`TokenStore` actor + `AuthState`). — PR #152
- [x] PR "ios: local db setup": **GRDB** (SQLite) con entidades `Bank`, `Wallet`, `Transaction`, `Category`, `RecurringRule`, `SyncOperation` (tablas espejo + DAOs con upsert). — PR #154
- [x] PR "ios: offline sync engine": FIFO queue de operaciones, UUID v4 generado en cliente, 5 reintentos con backoff exponencial, last-write-wins. — PR #155
- [x] PR "ios: feature flags": sistema simple para apuntar a backend staging vs prod (`AppEnvironment` + `FeatureFlags`). — PR #156

### Autenticación

- [x] PR "ios: auth screen": pantalla Login/Register con email+password, placeholders Apple/Google, link "Forgot password". — PR #158 · re-skin "Ledger" en el PR #162
- [x] PR "ios: apple sign in integration": `AuthenticationServices` (Sign in with Apple nativo). — PR #164 (e2e real pendiente de device)
- [x] PR "ios: google sign in integration": SDK `GoogleSignIn` para iOS (`GOOGLE_IOS_CLIENT_ID`). — PR #165
- [x] PR "ios: forgot password screen" + handler de deep link `walletos://reset?token=...`. — PR #165
- [x] PR "ios: reset password screen". — PR #165

### Setup inicial

- [ ] PR "ios: setup flow": pantalla de bienvenida tras registro, selector de divisa/tz, creación del primer bank + wallet.
- [ ] Lógica post-login: si `GET /banks` vacío → Setup; si no → Home.

### Pantallas principales (SwiftUI)

- [ ] PR "ios: home screen": dashboard con balance total + últimas transacciones + tab bar.
- [ ] PR "ios: add transaction modal": modal para crear ingreso / gasto / transferencia.
- [ ] PR "ios: edit transaction": reutiliza el modal de add.
- [ ] PR "ios: cuentas tab": lista de bancos → wallets.
- [ ] PR "ios: crear/editar banco modal".
- [ ] PR "ios: crear/editar wallet modal".
- [ ] PR "ios: transacciones del wallet": detalle con historial.
- [ ] PR "ios: stats tab": gráficos por categoría y por período con **Swift Charts**.
- [ ] PR "ios: insights tab (Ins.)": lista de insights semanales.
- [ ] PR "ios: detalle insight": vista de un insight (gráficos nativos con Swift Charts desde `charts`) con opción "Exportar PDF".
- [ ] PR "ios: ajustes screen": perfil, notificaciones, logout, eliminar cuenta.

### Widget

- [ ] PR "ios: home screen widget": widget (S/M) con balance total y gasto del día, usando **WidgetKit**.

### Push notifications

- [ ] PR "ios: push notifications": **APNs nativo** (`UserNotifications` + registro de remote notifications); registro del **device token APNs** tras login con `POST /devices`, unregister tras logout con `DELETE /devices/:token`. Sin FCM/Firebase.

### i18n

- [ ] PR "ios: i18n": **String Catalog** (`.xcstrings`) en español (solo `es` para v1, ver Decisiones).

**Done cuando:** La app corre en simulador y dispositivo iOS contra `http://localhost/api/...` (con ngrok o equivalente si hace falta), el flujo completo de usuario funciona, offline-first persiste y reconcilia correctamente, y las push notifications llegan en modo dev por **APNs sandbox**.

---

## Fase 11 — Infraestructura de producción

Ahora sí, comprar y provisionar lo que cuesta dinero.

### Compra

- [ ] Comprar **Hetzner VPS** CAX21 (4 vCPU ARM, 8 GB RAM, 80 GB NVMe) en Nuremberg.
- [ ] Comprar **dominio** (ej. `walletos.app`) en el registrar preferido.
- [ ] Crear cuenta **Cloudflare** (free tier) y apuntar nameservers.

### Setup del VPS

- [ ] SSH inicial como root → crear usuario `deploy` no-root con sudo.
- [ ] Copiar clave pública SSH, deshabilitar login password en `/etc/ssh/sshd_config`.
- [ ] Configurar **ufw**: permitir solo `22`, `80`, `443`.
- [ ] Instalar **Docker** + **Docker Compose plugin**.
- [ ] Instalar **fail2ban**.
- [ ] Configurar timezone UTC.

### DNS

- [ ] En Cloudflare, crear A record `api.walletos.app` → IP del VPS (proxy off para Certbot).
- [ ] Tras obtener cert, activar proxy en Cloudflare.

### SSL

- [ ] Instalar **Certbot** en el VPS.
- [ ] Emitir certificado para `api.walletos.app` con plugin nginx.
- [ ] Configurar renovación automática con cron.

### Producción — docker-compose

- [ ] Crear `infra/docker-compose.prod.yml`: mismos servicios pero con imágenes desde `ghcr.io/<user>/walletos-*:latest`, variables de entorno desde archivo `.env.prod` (no commiteado).
- [ ] Configurar nginx de prod con SSL + upstream a los containers.
- [ ] Configurar ambas instancias Postgres (`postgres` y `postgres-ai`) con volúmenes persistentes y backups (`pg_dump` cron → S3).
- [ ] Documentar en `infra/README.md` el procedimiento de arranque inicial en el VPS.

### Tuning de conexiones

- [ ] Configurar `connection_limit` en la `DATABASE_URL` de cada servicio Node.js (`?connection_limit=N`) según RAM del VPS y número de servicios concurrentes para no agotar el pool de PostgreSQL.

**Done cuando:** `https://api.walletos.app/health` responde 200 con SSL válido, Postgres (principal + AI)/Redis/RabbitMQ corren como containers, los 4 microservicios están desplegados detrás de Nginx, backups automáticos configurados en ambas instancias Postgres.

---

## Fase 12 — CD automático

Deploy automatizado al VPS desde GitHub Actions.

- [ ] Generar par de claves SSH dedicado para CI (`walletos-deploy`).
- [ ] Añadir clave pública al `authorized_keys` del usuario `deploy` en el VPS.
- [ ] Guardar clave privada como secret de GitHub: `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`.
- [ ] Guardar credenciales prod como secrets: `DB_URL_PROD`, `JWT_SECRET_PROD`, `INTERNAL_SECRET_PROD`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `AWS_ACCESS_KEY_ID_PROD`, `AWS_SECRET_ACCESS_KEY_PROD`, `APPLE_KEY_P8`, `APNS_KEY_P8`, `GOOGLE_CLIENT_ID_IOS`.
- [ ] Crear workflow `.github/workflows/deploy.yml`:
  - Trigger: push de tag `v*.*.*` (tag-based deploy).
  - Job 1: build de las 4 imágenes Docker.
  - Job 2: push a `ghcr.io/<user>/walletos-user-service:<tag>`, idem para los otros 3.
  - Job 3: SSH al VPS, `docker compose pull && docker compose up -d`.
- [ ] Añadir health check post-deploy: curl `https://api.walletos.app/health` esperando 200.
- [ ] Documentar proceso de rollback: re-tag con versión anterior y re-ejecutar workflow.

**Done cuando:** `git tag v0.1.0 && git push --tags` despliega automáticamente a prod, el workflow falla si cualquier servicio no responde 200 tras 30s.

---

## Fase 13 — Observabilidad en producción

Visibilidad básica para operar sin volar a ciegas.

### Logs centralizados

- [ ] Añadir **Loki** + **Promtail** + **Grafana** al `docker-compose.prod.yml`.
- [ ] Configurar Promtail para leer logs de containers Docker.
- [ ] Configurar retention 30 días.

### Dashboards

- [ ] Dashboard "Service health": errores 5xx por servicio, latencia p95 por endpoint.
- [ ] Dashboard "Business metrics": transacciones creadas/día, usuarios activos/semana, insights generados.
- [ ] Dashboard "Background jobs": éxito/fallo del cron de recurring, del weekly insight, de los recordatorios.
- [ ] Dashboard "Push notifications": enviadas, entregadas, errores APNs.

### Alertas

- [ ] Alertmanager configurado con webhook a email / Slack.
- [ ] Regla: tasa de 5xx > 1% sobre 5min → alerta.
- [ ] Regla: servicio down (no responde health) > 1min → alerta.
- [ ] Regla: DB queue de jobs AI > 100 pendientes → alerta.

### Acceso

- [ ] Grafana protegido con auth básica + IP allowlist en Cloudflare.

**Done cuando:** Grafana accesible en `https://grafana.walletos.app`, dashboards poblados con datos reales tras 24h, al menos una alerta activada y recibida por canal configurado.

---

## Fase 14 — Hardening y release v1.0

Última pasada antes de considerar la v1 lista.

- [ ] Definir **rate limits concretos** por endpoint público:
  - `POST /register`, `POST /login`, `POST /apple`, `POST /google`, `POST /refresh`, `POST /logout`: 10/min por IP.
  - `POST /auth/forgot-password`, `POST /auth/reset-password`: 5 req/15min por IP.
  - Endpoints autenticados (`/me`, etc.): 60/min por user.
- [ ] Audit de seguridad: revisar headers (HSTS, CSP, X-Frame-Options, etc.) en Nginx.
- [ ] Revisión manual de endpoints internos: confirmar que Nginx los bloquea desde fuera.
- [ ] Auditar que los `.env` de prod no están en el repo ni en imágenes Docker.
- [ ] Verificar que Apple/Google/OpenAI/Resend/AWS tienen límites de gasto configurados.
- [ ] Escribir documento `docs/incident-response.md` con pasos para: DB caída, VPS caído, API key filtrada, rollback de deploy.
- [ ] Registrar las **decisiones diferidas a v2** en `docs/v2-backlog.md` (referencias cruzadas a las decisiones C mencionadas en PLAN.md).
- [ ] Release checklist:
  - [ ] TestFlight (iOS) con 3-5 users.
  - [ ] 1 semana de dogfooding personal con datos reales.
  - [ ] Fix de bugs críticos reportados.
  - [ ] Tag `v1.0.0` → deploy a prod.
  - [ ] Submit a App Store Review.

**Done cuando:** v1.0 está en App Store, métricas de observabilidad muestran uso real sin errores críticos durante 7 días, y el backlog v2 está documentado.

---

## Decisiones ya tomadas

Estas decisiones están congeladas a partir de la revisión y alineación de los 3 `.md` de diseño realizada antes de iniciar este roadmap. No re-abrir sin motivo fuerte.

### Alcance y producto

- **v1 solo en español** (`es`). `en` se difiere a v2 salvo que App Store lo exija.
- **Divisa única**: solo EUR en v1. Multi-currency en v2.
- **Autenticación en v1**: email+password, Apple Sign In **y Google Sign In**. Los 3 métodos conviven; un user puede tener `password_hash` + `apple_id` + `google_id` enlazados.
- **Recuperación de contraseña**: flujo completo `POST /auth/forgot-password` (envía email vía Resend con deep link) + `POST /auth/reset-password` (consume token, invalida todos los refresh tokens).
- **Eliminación de cuenta**: `DELETE /me` incluido en v1. Publica `user.deleted` y propaga borrado en cascada a Wallet, AI, Notification.
- **Offline-first iOS**: UUID v4 generado en cliente y aceptado opcionalmente en `POST /wallets/:id/transactions`. FIFO queue, 5 reintentos con backoff exponencial, resolución last-write-wins.

### Stack y arquitectura

- **Monorepo** con 4 microservicios: User (Node+Prisma), Wallet (Node+Prisma), AI (Python+FastAPI+SQLAlchemy+Alembic), Notification (Node+Prisma).
- **2 instancias Postgres 16**: instancia principal con 3 databases (users, wallets, notifications) + instancia dedicada para AI Service (walletOS_ai).
- **Mensajería**: RabbitMQ topic exchange `walletOS.events`. Eventos: `transaction.created`, `insight.generated`, `user.deleted`.
- **Auth interna entre servicios**: header `X-Internal-Secret` compartido. Endpoints internos bajo `/internal/*` y Nginx **no** los enruta.
- **JWT**: HS256, access 15 min, refresh opaco 30 días rotado, hash bcrypt en DB.
- **Scheduler**: APScheduler en AI Service (weekly insights), node-cron en Wallet Service (recurring) y Notification Service (recordatorio diario).

### Carteras de inversión (v1)

- **Entrada manual, no Open Banking**: el usuario registra sus operaciones manualmente. Sin integración PSD2 ni scrapers bancarios.
- **Wallet type CASH | INVESTMENT**: campo `type` en el modelo `Wallet` desde Rama 2 de Fase 6. Los wallets INVESTMENT no usan `initial_balance` ni transacciones ordinarias.
- **Historial como fuente de verdad**: posiciones calculadas de `SUM(BUY.shares) - SUM(SELL.shares)`; precio medio de compra como media ponderada. El estado no se guarda — se deriva.
- **Precios en tiempo real**: TwelveData free tier (800 credits/día). `price_cache` en DB compartida por `ticker`. TTL: **30 min mercado abierto** / 24h cerrado. Dimensionado para soportar hasta 50 ETFs únicos en toda la base de usuarios (`30 min × 16 ciclos × 50 = 800`); escala a cualquier número de usuarios mientras la base de tickers únicos no supere 50.
- **Scope en Fase 6**: Rama 2 añade el enum `WalletType` y el campo `type`; Ramas 14–15 implementan la lógica completa de inversión.

### Servicios externos

- **Email transaccional**: Resend (en dev y en prod).
- **Storage de PDFs**: S3 real en ambos entornos. Buckets `walletos-exports-dev` y `walletos-exports-prod`. **No se usa MinIO.**
- **Observabilidad**: Grafana + Loki + Promtail en el VPS (no SaaS en v1).
- **Push**: APNs nativo con `.p8` (sandbox en dev, prod en release).

### Esquema de datos (anclas)

- `categories` con constraint `UNIQUE NULLS NOT DISTINCT (user_id, name, type)` para cubrir el caso `user_id = NULL` (defaults).
- `users` con columnas `apple_id`, `google_id` (ambas nullable, ambas UNIQUE).
- Tabla `password_reset_tokens` con `token_hash`, `expires_at`, `used_at`.

### Flujo de desarrollo

- **Branch protection en `main`**: PR + 1 review (self) + CI verde obligatorio + commitlint.
- **Conventional Commits** + **Husky** + **lint-staged**.
- **Merge commit** como estrategia por defecto.
- **Ramas `feature/...`**, nunca commits directos a `main`.
- **Dev local con Docker** para todo lo dockerizable; S3 y Resend son reales.
- **Infra de producción** (VPS + dominio + Cloudflare + Certbot) se pospone a Fase 11 para no bloquear el desarrollo local.
- **CD tag-based**: deploys disparados por `git tag v*.*.*`.

### Rate limiting (referencia — valores finales en Fase 14)

- Auth-público (register, login, apple, google, refresh, logout): 10/min por IP.
- Password reset (forgot-password, reset-password): 5 req/15min por IP.
- Autenticado general: 60/min por user.
- Endpoints pesados (generate insight, export): 5/min por user.

### Diferido explícitamente a v2 (no v1)

- Multi-currency.
- Idiomas adicionales (en, otros).
- 2FA/MFA.
- Presupuestos mensuales con alertas.
- Compartir wallets entre usuarios.
- Importación CSV.
- App Android (v1 es solo iOS nativo; antes se planteó Flutter multiplataforma).
- Web app.
- Watch app.
