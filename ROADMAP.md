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
- [ ] Configurar **status checks requeridos** en branch protection de `main` (manual en GitHub UI tras el merge de este PR).
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

- [ ] PR "user-service: forgot-password": `POST /auth/forgot-password`, genera token, guarda hash en `password_reset_tokens`, envía email vía Resend (con deep link `walletos://reset?token=...`).
- [ ] PR "user-service: reset-password": `POST /auth/reset-password`, valida token, actualiza `password_hash`, marca token como usado, revoca todos los refresh tokens del user.

### Endpoints — me

- [ ] PR "user-service: get me": `GET /me` (incluye flags `has_password`, `apple_linked`, `google_linked`).
- [ ] PR "user-service: patch me": `PATCH /me` (name, currency, tz).
- [ ] PR "user-service: delete me": `DELETE /me` publica `user.deleted` a RabbitMQ y borra en cascada.

### Endpoints internos

- [ ] PR "user-service: internal endpoints": `GET /internal/users/:id`, `GET /internal/users/by-email` con `X-Internal-Secret`.

### RabbitMQ

- [ ] PR "user-service: event publisher": publica `user.deleted` en `walletOS.events`.

### Docker de producción

- [ ] PR "user-service: Dockerfile prod": multi-stage build, imagen final `node:20-alpine`, usuario no-root.

**Done cuando:** Los 11 endpoints públicos + 2 internos están implementados, con tests unitarios y de integración pasando, `docker compose up user-service` lo arranca, y el servicio publica `user.deleted` al eliminar una cuenta.

---

## Fase 6 — Wallet Service

Motor financiero. Es el servicio con más endpoints y la lógica más delicada (transferencias atómicas).

### Scaffold

- [ ] PR "wallet-service: scaffold" (mismo patrón que user-service).
- [ ] Añadir regla `services/wallet-service/**/*.ts` en `lint-staged.config.mjs` raíz (lint + typecheck).
- [ ] Puerto `3002`.
- [ ] Middleware `authenticate` que verifica JWT emitido por User Service (mismo `JWT_SECRET`).

### Base de datos

- [ ] PR "wallet-service: prisma schema": `banks`, `wallets`, `categories`, `transactions`, `recurring_rules`.
- [ ] Constraint `UNIQUE NULLS NOT DISTINCT (user_id, name, type)` en `categories`.
- [ ] Índices: `wallets(user_id)`, `wallets(bank_id)`, `transactions(wallet_id, date DESC)`, `transactions(user_id, date DESC)`, `categories(user_id)`.
- [ ] Migración inicial `prisma migrate dev --name init`.

### Seed

- [ ] PR "wallet-service: seed categorías": seed idempotente que, al arrancar el servicio, inserta categorías por defecto (`user_id = NULL`) si no existen.

### Utilidades

- [ ] PR "wallet-service: balance calculator": módulo que calcula balance de un wallet por agregación de transacciones.
- [ ] PR "wallet-service: internal auth middleware".

### Endpoints — categorías

- [ ] PR "wallet-service: categories": `GET /categories`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`.

### Endpoints — banks

- [ ] PR "wallet-service: banks": `GET /banks`, `POST /banks`, `PATCH /banks/:id`, `DELETE /banks/:id` (cascada wallets y transactions).

### Endpoints — wallets

- [ ] PR "wallet-service: wallets list": `GET /banks/:id/wallets`, `GET /wallets` (plano).
- [ ] PR "wallet-service: wallets crud": `POST /banks/:id/wallets`, `PATCH /wallets/:id`, `DELETE /wallets/:id`.
- [ ] PR "wallet-service: wallet transactions": `GET /wallets/:id/transactions` con paginación cursor-based.

### Endpoints — transactions

- [ ] PR "wallet-service: create transaction": `POST /wallets/:id/transactions` con soporte para `id?` UUID opcional (offline sync).
- [ ] PR "wallet-service: transactions crud": `GET /transactions/:id`, `PATCH /transactions/:id`, `DELETE /transactions/:id`.
- [ ] PR "wallet-service: transfer": `POST /transactions/transfer` en transacción DB atómica (2 movimientos + validación de saldo).
- [ ] PR "wallet-service: list transactions": `GET /transactions` con filtros (fecha, tipo, wallet, categoría).

### Endpoints — recurring

- [ ] PR "wallet-service: recurring crud": `GET /recurring`, `POST /recurring`, `PATCH /recurring/:id`, `DELETE /recurring/:id`.
- [ ] PR "wallet-service: recurring scheduler": cron diario (node-cron) que materializa transactions pendientes de reglas recurrentes.

### Endpoints — stats

- [ ] PR "wallet-service: stats": `GET /stats/summary`, `GET /stats/by-category`.

### Endpoints internos

- [ ] PR "wallet-service: internal endpoints": `GET /internal/users/:userId/transactions`, `GET /internal/users/:userId/wallets`.

### RabbitMQ

- [ ] PR "wallet-service: event publisher": publica `transaction.created` tras cada POST de transaction.
- [ ] PR "wallet-service: user.deleted consumer": al consumir `user.deleted`, borra en cascada todos los datos del user.

### Docker

- [ ] PR "wallet-service: Dockerfile prod".

**Done cuando:** Los 21 endpoints públicos + 2 internos están implementados, transferencias atómicas verificadas con tests, `transaction.created` se publica correctamente, seed de categorías se ejecuta al arrancar.

---

## Fase 7 — AI Service (Python / FastAPI)

Servicio más diferente del stack: Python, SQLAlchemy, Alembic, APScheduler. Consume transacciones de Wallet Service vía endpoint interno.

### Scaffold

- [ ] PR "ai-service: scaffold": `pyproject.toml` (poetry o uv), FastAPI, uvicorn, estructura `app/api`, `app/models`, `app/services`, `app/tasks`.
- [ ] Añadir regla `services/ai-service/**/*.py` en `lint-staged.config.mjs` raíz (comando: `ruff check`).
- [ ] Puerto `3003`.
- [ ] Ruff + mypy configurados.
- [ ] `Dockerfile.dev`.

### Base de datos

- [ ] PR "ai-service: sqlalchemy models": `insights`, `insight_exports`.
- [ ] PR "ai-service: alembic setup": `alembic init`, primera migración autogenerada.

### Utilidades

- [ ] PR "ai-service: openai client": wrapper del cliente OpenAI con retry y timeout.
- [ ] PR "ai-service: wallet client": cliente HTTP para llamar a endpoints internos de Wallet Service con `X-Internal-Secret`.
- [ ] PR "ai-service: user client": cliente HTTP para User Service.
- [ ] PR "ai-service: s3 client": wrapper boto3 para subir PDFs al bucket real (`walletos-exports-dev`).

### Endpoints

- [ ] PR "ai-service: categorize": `POST /categorize` (sugerir categoría de una transacción usando OpenAI).
- [ ] PR "ai-service: insights list": `GET /insights` (paginado).
- [ ] PR "ai-service: insight detail": `GET /insights/:id`.
- [ ] PR "ai-service: generate insight": `POST /insights/generate` (sincrónico o async vía background task).
- [ ] PR "ai-service: export insight": `POST /insights/:id/export` → genera PDF con ReportLab, sube a S3, devuelve URL pre-signed (24h).

### Scheduler

- [ ] PR "ai-service: weekly insight cron": APScheduler que cada lunes 8:00 AM (tz del user) genera insight semanal de cada usuario activo.
- [ ] PR "ai-service: user.deleted consumer": borra insights del user eliminado.

### RabbitMQ

- [ ] PR "ai-service: insight.generated publisher": publica evento tras generar un insight.

### Docker

- [ ] PR "ai-service: Dockerfile prod".

**Done cuando:** Los 5 endpoints funcionan, el insight semanal se genera automáticamente, los PDFs se suben a S3 real y son descargables vía URL pre-signed, `insight.generated` se publica.

---

## Fase 8 — Notification Service

Servicio final del backend. Consume eventos de los otros y envía push notifications vía APNs.

### Scaffold

- [ ] PR "notification-service: scaffold" (Node.js, mismo patrón que user/wallet).
- [ ] Añadir regla `services/notification-service/**/*.ts` en `lint-staged.config.mjs` raíz (lint + typecheck).
- [ ] Puerto `3004`.

### Base de datos

- [ ] PR "notification-service: prisma schema": `device_tokens`, `notifications`.
- [ ] Migración inicial.

### APNs

- [ ] PR "notification-service: apns client": librería `@parse/node-apn` o equivalente, configurada con `.p8` via env, modo sandbox en dev.

### Endpoints

- [ ] PR "notification-service: register device": `POST /devices` (registrar device token del iPhone).
- [ ] PR "notification-service: delete device": `DELETE /devices/:token` (unregister tras logout).

### RabbitMQ consumers

- [ ] PR "notification-service: transaction.created consumer": si la configuración del user tiene notificaciones activas, envía push "Nueva transacción registrada".
- [ ] PR "notification-service: insight.generated consumer": push "Tu insight semanal está listo".
- [ ] PR "notification-service: user.deleted consumer": borra device_tokens del user.

### Scheduler

- [ ] PR "notification-service: reminder cron": node-cron que a las 20:00 (tz user) envía recordatorio a users sin transacciones ese día (si tienen la preferencia activa).

### Docker

- [ ] PR "notification-service: Dockerfile prod".

**Done cuando:** Los 2 endpoints funcionan, los 3 consumers procesan eventos correctamente, recordatorio diario funciona, push notifications llegan a un iPhone de prueba en sandbox.

---

## Fase 9 — Nginx local y flujo E2E

Atar todos los servicios detrás de un Nginx local para validar el flujo completo como lo vería la app.

- [ ] Crear `infra/nginx/nginx.conf`:
  - `location /api/auth/` → user-service.
  - `location /api/me` y `/api/users` → user-service.
  - `location /api/banks/`, `/api/wallets/`, `/api/transactions/`, `/api/categories/`, `/api/recurring/`, `/api/stats/` → wallet-service.
  - `location /api/insights/`, `/api/categorize` → ai-service.
  - `location /api/devices/` → notification-service.
  - **No exponer `/internal/*`**.
- [ ] Añadir servicio `nginx` al `docker-compose.yml` en puerto `80`.
- [ ] Verificar CORS headers (si se necesitan en dev para alguna herramienta web).
- [ ] Flujo E2E manual desde Postman / Insomnia / Bruno:
  - [ ] Register → login → refresh → me.
  - [ ] Crear bank → crear wallet → crear transaction → GET transactions.
  - [ ] Crear recurring → avanzar reloj del host → verificar materialización.
  - [ ] Forzar `POST /insights/generate` → verificar PDF en S3.
  - [ ] Forgot password → revisar email en Resend → reset password.
  - [ ] DELETE /me → verificar que wallets, insights, device_tokens desaparecen.
- [ ] Crear colección de Postman/Bruno y commitearla en `docs/`.

**Done cuando:** Todo el flujo de la app se puede ejecutar contra `http://localhost/api/...` sin errores y la colección Postman queda documentada.

---

## Fase 10 — App iOS (Swift + SwiftUI)

La app del usuario final. Se desarrolla en paralelo con el backend una vez los primeros endpoints estén listos, pero el grueso se hace ahora porque depende del API ya estable.

### Setup del proyecto

- [ ] Crear proyecto Xcode `WalletOS` (iOS 17+, SwiftUI, Swift 5.9+).
- [ ] Configurar bundle id `com.walletOS.app`, capabilities: Sign in with Apple, Push Notifications, Background Modes (Remote notifications), App Groups (para widget).
- [ ] Estructura Clean Architecture: `Domain/`, `Data/`, `Presentation/`, `Core/`.
- [ ] SwiftLint + SwiftFormat configurados, integrados en pre-commit del monorepo.

### Core / infraestructura

- [ ] PR "ios: networking layer": cliente HTTP con async/await, interceptor que añade `Authorization: Bearer`, refresh silencioso ante 401.
- [ ] PR "ios: keychain storage": wrapper de Keychain para guardar access + refresh tokens.
- [ ] PR "ios: coredata setup": modelo con entidades `Bank`, `Wallet`, `Transaction`, `Category`, `RecurringRule`, `SyncOperation`.
- [ ] PR "ios: offline sync engine": FIFO queue de operaciones, UUID v4 generado en cliente, 5 reintentos con backoff exponencial, last-write-wins.
- [ ] PR "ios: feature flags": sistema simple (plist o remoto) para apuntar a backend staging vs prod.

### Autenticación

- [ ] PR "ios: auth screen": pantalla Login/Register con email+password, botón Apple, botón Google, link "Forgot password".
- [ ] PR "ios: apple sign in integration".
- [ ] PR "ios: google sign in integration" (librería oficial).
- [ ] PR "ios: forgot password screen" + deep link handler para `walletos://reset?token=...`.
- [ ] PR "ios: reset password screen".

### Setup inicial

- [ ] PR "ios: setup flow": pantalla de bienvenida tras registro, selector de divisa/tz, creación del primer bank + wallet.
- [ ] Lógica post-login: si `GET /banks` vacío → Setup; si no → Home.

### Pantallas principales

- [ ] PR "ios: home screen": dashboard con balance total + últimas transacciones + tabs inferiores.
- [ ] PR "ios: add transaction modal": modal para crear ingreso / gasto / transferencia.
- [ ] PR "ios: edit transaction": reutiliza el modal de add.
- [ ] PR "ios: cuentas tab": lista de bancos → wallets.
- [ ] PR "ios: crear/editar banco modal".
- [ ] PR "ios: crear/editar wallet modal".
- [ ] PR "ios: transacciones del wallet": detalle con historial.
- [ ] PR "ios: stats tab": gráficos por categoría y por período.
- [ ] PR "ios: insights tab (Ins.)": lista de insights semanales.
- [ ] PR "ios: detalle insight": vista de un insight con opción "Exportar PDF".
- [ ] PR "ios: ajustes screen": perfil, notificaciones, logout, eliminar cuenta.

### Widget

- [ ] PR "ios: widget extension": widget de Home Screen (S/M) con balance total y última transacción. Datos vía App Group + CoreData compartido.

### Push notifications

- [ ] PR "ios: push notifications": registro de device token tras login, `POST /devices`, unregister tras logout con `DELETE /devices/:token`.

### i18n

- [ ] PR "ios: i18n setup": `Localizable.strings` en español (solo `es` para v1, ver Decisiones).

**Done cuando:** La app corre en simulador contra `http://localhost/api/...` (con ngrok o equivalente si hace falta), el flujo completo de usuario funciona, offline-first persiste y reconcilia correctamente, y las push notifications llegan en sandbox APNs.

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
  - [ ] TestFlight interno de la app iOS con 3-5 users.
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
- Web app.
- Watch app.
