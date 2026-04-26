# WalletOS — Fase 5: User Service

Primer microservicio del backend. Desbloquea la autenticación para el resto de servicios. Se construye en ramas cortas de feature, cada una con su PR a `develop`. Al terminar la fase, `develop` → `main`.

## Flujo de ramas

```
develop
 ├── feature/user-service-scaffold       → PR → develop
 ├── feature/user-service-schema         → PR → develop
 ├── feature/user-service-utilities      → PR → develop
 ├── feature/user-service-auth           → PR → develop
 ├── feature/user-service-password-reset → PR → develop
 ├── feature/user-service-me             → PR → develop
 ├── feature/user-service-internal       → PR → develop
 └── feature/user-service-docker-prod    → PR → develop
develop → PR → main  (cuando Fase 5 esté completa)
```

---

## Rama 1 — `feature/user-service-scaffold` ✅ PR pendiente

### Objetivo

Estructura base del servicio: dependencias, TypeScript, Express, testing, hot reload y endpoint de salud.

### Checklist de desarrollo

- [x] `package.json` con scripts `dev`, `build`, `test`, `lint`, `typecheck`
- [x] Dependencias de producción:
  - `express`, `cors`, `helmet`, `express-rate-limit`
  - `@prisma/client`, `prisma`
  - `zod`, `bcryptjs`, `jsonwebtoken`
  - `ioredis`, `amqplib`
  - `resend`
  - `apple-signin-auth`, `google-auth-library`
  - `tsx` (dev), `typescript`
- [x] `tsconfig.json` (strict: true, target ES2022, moduleResolution bundler)
- [x] Estructura de carpetas:
  ```
  src/
    config/       — env.ts (Zod parse de process.env)
    controllers/  — un archivo por recurso
    services/     — lógica de negocio
    middleware/   — auth, errorHandler, rateLimiter, internalAuth
    routes/       — index.ts agrupa todos los routers
    lib/          — jwt.ts, token.ts, hash.ts
    types/        — tipos compartidos
  ```
- [x] `src/app.ts` — Express app factory (sin `listen`, para supertest)
- [x] `src/server.ts` — entry point con `app.listen(PORT)`
- [x] `src/config/env.ts` — parse y validación de todas las env vars con Zod; falla en arranque si faltan
- [x] ESLint flat config + Prettier + `tsconfig.eslint.json` (incluye test files)
- [x] `vitest.config.ts` con globals: true, environment: node, coverage con v8
- [x] `src/test/setup.ts` — estructura con hooks vacíos (Prisma se conecta en Rama 2)
- [x] `GET /health` → `200 { status: "ok", service: "user-service" }`
- [x] `Dockerfile.dev` con tsx watch y volumen montado (hot reload)
- [x] Añadir bloque `user-service` en `infra/docker-compose.yml` (puerto 3001, `depends_on` postgres + redis + rabbitmq)
- [x] Actualizar `services/user-service/.env.example` con todas las variables

### Checklist de tests

- [x] `GET /health` → 200 con body correcto
- [x] `GET /health` sin credenciales → 200 (es público)
- [x] App arranca sin errores con env vars de test completas

### Commits del PR

```
feat(user-service): inicializar package.json y dependencias
feat(user-service): tsconfig strict mode
feat(user-service): estructura de carpetas src/
feat(user-service): vitest + supertest setup
feat(user-service): GET /health endpoint
feat(user-service): Dockerfile.dev con hot reload
chore(infra): añadir user-service a docker-compose.yml
feat(user-service): tsconfig.eslint.json y globals vitest en ESLint
```

### Criterio Done

`npm run dev` arranca en puerto 3001, `npm test` verde, `curl localhost:3001/health` responde.

**Estado:** `typecheck` ✅ · `lint` ✅ · `test` ✅ (4/4) · PR pendiente de abrir → develop

---

## Rama 2 — `feature/user-service-schema`

### Objetivo

Definir el schema de base de datos con Prisma y ejecutar la primera migración.

### Checklist de desarrollo

- [x] `prisma/schema.prisma` con las 3 tablas:

**`users`**

```prisma
model User {
  id                    String   @id @default(uuid()) @db.Uuid
  email                 String   @unique
  password_hash         String?
  apple_id              String?  @unique
  google_id             String?  @unique
  name                  String
  timezone              String   @default("UTC")
  default_currency      String   @default("EUR")
  reminder_enabled      Boolean  @default(true)
  high_spend_enabled    Boolean  @default(false)
  high_spend_threshold  Decimal  @default(100.00) @db.Decimal(10, 2)
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
  refresh_tokens        RefreshToken[]
  password_reset_tokens PasswordResetToken[]
}
```

**`refresh_tokens`**

```prisma
model RefreshToken {
  id         String   @id @default(uuid()) @db.Uuid
  user_id    String   @db.Uuid
  token_hash String   @unique
  expires_at DateTime
  created_at DateTime @default(now())
  user       User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

**`password_reset_tokens`**

```prisma
model PasswordResetToken {
  id         String    @id @default(uuid()) @db.Uuid
  user_id    String    @db.Uuid
  token_hash String    @unique
  expires_at DateTime
  used_at    DateTime?
  created_at DateTime  @default(now())
  user       User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

- [x] Índices adicionales vía `@@index` en el schema:
  - `refresh_tokens(user_id)`
  - `password_reset_tokens(user_id)`
- [x] `prisma migrate dev --name init` — primera migración
- [x] Verificar que `onDelete: Cascade` en refresh_tokens y password_reset_tokens funciona

### Checklist de tests

- [x] Crear user, verificar que se guarda con defaults correctos
- [x] Intentar crear user con email duplicado → error de constraint
- [x] Eliminar user → refresh_tokens y password_reset_tokens eliminados en cascada
- [x] Crear refresh_token, verificar que `token_hash` es UNIQUE

### Commits del PR

```
feat(user-service): prisma schema — users, refresh_tokens, password_reset_tokens
feat(user-service): migración inicial con índices
```

### Criterio Done

`npx prisma migrate dev` exitoso en la DB de test, constraints y cascadas verificadas.

---

## Rama 3 — `feature/user-service-utilities` ✅ PR pendiente

### Objetivo

Todas las piezas reutilizables que usan el resto de endpoints: auth lib, error classes, validators, rate limiter, internal auth.

### Checklist de desarrollo

**`src/lib/jwt.ts`**

- [x] `signAccessToken(payload: { userId: string }): string` — JWT HS256, exp 15min
- [x] `verifyAccessToken(token: string): { userId: string }` — lanza `UnauthorizedError` si inválido/expirado
- [x] Usa `JWT_SECRET` de env

**`src/lib/token.ts`**

- [x] `generateOpaqueToken(): string` — 32 bytes hex (64 chars)
- [x] `hashToken(token: string): string` — SHA-256 hex (para guardar en DB)

**`src/lib/hash.ts`**

- [x] `hashPassword(password: string): Promise<string>` — bcrypt, cost 12
- [x] `comparePassword(plain: string, hash: string): Promise<boolean>`

**`src/middleware/errorHandler.ts`**

- [x] Clases: `AppError(message, statusCode, code)`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`
- [x] Middleware Express: captura `AppError` → responde `{ error: { code, message, details? } }`; captura errores Zod → `ValidationError`; cualquier otro → 500 INTERNAL_ERROR
- [x] No exponer stack traces en producción

**`src/middleware/authenticate.ts`**

- [x] Extrae `Authorization: Bearer {token}`
- [x] Verifica con `verifyAccessToken`
- [x] Añade `req.userId` al request
- [x] 401 si falta o inválido

**`src/middleware/rateLimiter.ts`**

- [x] Sliding window con Redis: clave `rl:{ip}:{endpoint}`, max N requests/ventana
- [x] `createRateLimiter(max: number, windowSeconds: number, keyFn?)` — factory que devuelve middleware Express
- [x] 429 con `{ error: { code: "RATE_LIMITED", message: "..." } }` si excede límite
- [x] Límites: auth endpoints = 10 req/min; me endpoints = 60 req/min; password reset = 5 req/15min

**`src/middleware/internalAuth.ts`**

- [x] Valida `X-Internal-Secret` contra `INTERNAL_SECRET` env var
- [x] 401 si falta o no coincide

**`src/validators/`**

- [x] `auth.validators.ts` — schemas Zod para register, login, apple, google, refresh, logout, forgot-password, reset-password
- [x] `me.validators.ts` — schema Zod para PATCH /me
- [x] Exportar schemas y tipos inferidos (`z.infer<typeof schema>`)

### Checklist de tests

**jwt.ts**

- [x] Sign → verify round-trip con payload correcto
- [x] Token expirado lanza UnauthorizedError
- [x] Token con firma incorrecta lanza UnauthorizedError

**token.ts**

- [x] `generateOpaqueToken` genera string de 64 chars hexadecimales
- [x] `hashToken` es determinista (mismo input → mismo output)
- [x] Dos tokens distintos tienen hashes distintos

**hash.ts**

- [x] `hashPassword` devuelve string distinto al input
- [x] `comparePassword` true con el password original
- [x] `comparePassword` false con password diferente

**errorHandler.ts** (con supertest)

- [x] 400 para ValidationError con `details`
- [x] 401 para UnauthorizedError
- [x] 409 para ConflictError
- [x] 500 para error genérico sin exponer mensaje interno

**authenticate.ts** (con supertest)

- [x] 401 sin header Authorization
- [x] 401 con token mal formado
- [x] 401 con token expirado
- [x] `req.userId` correctamente poblado con token válido

**rateLimiter.ts** (con Redis de test)

- [x] N requests permitidos
- [x] Request N+1 → 429
- [x] Ventana se resetea tras expiración

**internalAuth.ts**

- [x] 401 sin X-Internal-Secret
- [x] 401 con secret incorrecto
- [x] Pasa con secret correcto

### Commits del PR

```
feat(user-service): auth lib — jwt, opaque token, bcrypt
feat(user-service): error handler — clases y middleware global
feat(user-service): zod validators
feat(user-service): rate limiting middleware con Redis sliding window
feat(user-service): internal auth middleware
```

### Criterio Done

`npm test` verde en todos los tests de utilidades.

**Estado:** `typecheck` ✅ · `lint` ✅ · `test` ✅ (34/34) · PR pendiente de abrir → develop

---

## Rama 4 — `feature/user-service-auth`

### Objetivo

Los 6 endpoints de autenticación pública: register, login, apple, google, refresh, logout.

### Contratos (de api-contracts.md)

**POST /register** → `201`

```json
Request:  { "email": "...", "password": "min8", "name": "...", "timezone?": "...", "default_currency?": "EUR" }
Response: { "user": { "id": "uuid", "email": "...", "name": "...", "timezone": "...", "default_currency": "...", "reminder_enabled": true, "high_spend_enabled": false, "high_spend_threshold": 100.00, "created_at": "..." }, "access_token": "...", "refresh_token": "..." }
```

Errors: 400 VALIDATION_ERROR, 409 CONFLICT

**POST /login** → `200` (mismo shape que register)

**POST /apple** → `200`

```json
Request: { "identity_token": "eyJ...", "name?": "..." }
```

Verifica contra JWK de Apple. Crea user si `apple_id` no existe (`name` obligatorio la primera vez).

**POST /google** → `200`

```json
Request: { "id_token": "eyJ...", "name?": "..." }
```

Verifica con `google-auth-library`. `audience`: `GOOGLE_IOS_CLIENT_ID`.

**POST /refresh** → `200`

```json
Request:  { "refresh_token": "..." }
Response: { "access_token": "...", "refresh_token": "..." }
```

Rota el refresh token: genera nuevo, elimina el anterior de DB, mete el anterior en blacklist Redis (`blacklist:{hash}`, TTL = tiempo restante del token viejo).

**POST /logout** → `204`

```json
Request: { "refresh_token": "..." }
```

Elimina refresh token de DB. Idempotente: 204 aunque el token ya no exista.

### Checklist de desarrollo

- [ ] `src/services/auth.service.ts` — lógica de negocio
- [ ] `src/controllers/auth.controller.ts` — manejo HTTP
- [ ] `src/routes/auth.routes.ts` — routers con rate limiter aplicado
- [ ] Refresh token almacenado como `hashToken(token)` en DB; se devuelve el token plano
- [ ] Refresh rotation en transacción DB atómica

### Checklist de tests

**POST /register**

- [ ] 201 con user + tokens válidos
- [ ] `password_hash` no se incluye en la response
- [ ] `refresh_token` guardado en DB como hash (no plano)
- [ ] 400 con email inválido
- [ ] 400 con password < 8 chars
- [ ] 400 sin `name`
- [ ] 409 con email ya existente

**POST /login**

- [ ] 200 con tokens para credenciales correctas
- [ ] 401 con password incorrecto (mismo mensaje que email inexistente)
- [ ] 401 con email inexistente
- [ ] 400 con body inválido

**POST /apple**

- [ ] Mock `apple-signin-auth.verifyIdToken` → crea user nuevo, devuelve 200 + tokens
- [ ] Mock → user ya existe, hace login, devuelve 200 + tokens
- [ ] 400 si `identity_token` falta
- [ ] 401 si `verifyIdToken` lanza error

**POST /google**

- [ ] Mock `OAuth2Client.verifyIdToken` → crea user nuevo
- [ ] Mock → user ya existe
- [ ] 401 si token inválido

**POST /refresh**

- [ ] 200 con nuevos tokens
- [ ] Token anterior está en blacklist Redis (intento de reuso → 401)
- [ ] 401 con refresh token inexistente
- [ ] 401 con refresh token expirado

**POST /logout**

- [ ] 204 con token válido → token eliminado de DB
- [ ] 204 con token ya eliminado (idempotente)

### Commits del PR

```
feat(user-service): POST /register + tests
feat(user-service): POST /login + tests
feat(user-service): POST /refresh con rotación + tests
feat(user-service): POST /logout + tests
feat(user-service): POST /apple con verificación JWK + tests
feat(user-service): POST /google con google-auth-library + tests
```

### Criterio Done

6 endpoints funcionando, tests de integración verdes con DB y Redis reales.

---

## Rama 5 — `feature/user-service-password-reset`

### Objetivo

Flujo completo de recuperación de contraseña: generar token → email → reset.

### Contratos

**POST /auth/forgot-password** → `204`

```json
Request: { "email": "user@email.com" }
```

Siempre 204 (no revela si el email existe). Si existe: genera token UUID, guarda `hashToken(token)` en `password_reset_tokens` (`expires_at = now + 1h`), envía email vía Resend con deep link `walletos://reset?token={token_plano}`.

**POST /auth/reset-password** → `204`

```json
Request: { "token": "...", "new_password": "min8chars" }
```

Busca `hashToken(token)` en `password_reset_tokens`. Verifica `expires_at > now()` y `used_at IS NULL`. Actualiza `password_hash`. Marca `used_at = now()`. Elimina todos los `refresh_tokens` del user.

### Checklist de desarrollo

- [ ] `src/services/password.service.ts`
- [ ] `src/controllers/password.controller.ts`
- [ ] Template de email HTML con el deep link
- [ ] Rate limiting estricto: 5 req/15min por IP en ambos endpoints

### Checklist de tests

**POST /auth/forgot-password**

- [ ] 204 con email existente
- [ ] 204 con email inexistente (no revela)
- [ ] Token guardado en DB con `hashToken` correcto
- [ ] Resend client llamado con el email correcto (mock)
- [ ] `expires_at` ≈ now + 1h

**POST /auth/reset-password**

- [ ] 204 con token válido, `password_hash` actualizado en DB
- [ ] Todos los `refresh_tokens` del user eliminados
- [ ] `used_at` marcado en el token usado
- [ ] 400 con token ya usado (`used_at IS NOT NULL`)
- [ ] 400 con token expirado (`expires_at < now()`)
- [ ] 400 con token inexistente
- [ ] 400 con `new_password` < 8 chars

### Commits del PR

```
feat(user-service): POST /auth/forgot-password + tests
feat(user-service): POST /auth/reset-password + tests
```

---

## Rama 6 — `feature/user-service-me`

### Objetivo

Gestión del perfil autenticado: consultar, actualizar y eliminar cuenta.

### Contratos

**GET /me** → `200`

```json
{
  "id": "uuid",
  "email": "user@email.com",
  "name": "Saleem",
  "timezone": "Europe/Madrid",
  "default_currency": "EUR",
  "has_password": true,
  "apple_linked": false,
  "google_linked": true,
  "reminder_enabled": true,
  "high_spend_enabled": false,
  "high_spend_threshold": 100.0,
  "created_at": "2026-04-22T10:00:00Z"
}
```

**PATCH /me** → `200` (mismo shape)

```json
Request: { "name?": "...", "timezone?": "...", "default_currency?": "...", "reminder_enabled?": bool, "high_spend_enabled?": bool, "high_spend_threshold?": number }
```

**DELETE /me** → `204`
Elimina user (CASCADE en DB). Publica `user.deleted { user_id }` en RabbitMQ exchange `walletOS.events`.

### Checklist de desarrollo

- [ ] `src/services/user.service.ts`
- [ ] `src/controllers/user.controller.ts`
- [ ] `src/routes/user.routes.ts` (todas con `authenticate` middleware)
- [ ] `src/lib/rabbitmq.ts` — conexión con reintentos, publisher
- [ ] RabbitMQ: declare exchange `walletOS.events` (topic, durable) al arrancar

### Checklist de tests

**GET /me**

- [ ] 200 con todos los campos incluyendo flags `has_password`, `apple_linked`, `google_linked`
- [ ] `has_password: false` si `password_hash` es null
- [ ] `apple_linked: true` si `apple_id` no es null
- [ ] 401 sin token

**PATCH /me**

- [ ] 200 actualizando `name`
- [ ] 200 actualizando `timezone` con valor IANA válido (ej. `Europe/Madrid`)
- [ ] 400 con timezone inválida (ej. `Fake/Zone`)
- [ ] 200 con body vacío → devuelve datos actuales sin cambios
- [ ] 401 sin token

**DELETE /me**

- [ ] 204, user eliminado de DB
- [ ] refresh_tokens y password_reset_tokens eliminados en cascada
- [ ] Evento `user.deleted` publicado en RabbitMQ
- [ ] 401 sin token

### Commits del PR

```
feat(user-service): GET /me + tests
feat(user-service): PATCH /me + tests
feat(user-service): lib/rabbitmq.ts — publisher con reintentos
feat(user-service): DELETE /me con evento user.deleted + tests
```

---

## Rama 7 — `feature/user-service-internal`

### Objetivo

Endpoints internos para consumo por AI Service y Notification Service. Solo accesibles desde la red Docker.

### Contratos

**GET /internal/users/:id** → `200`

```json
{
  "id": "uuid", "email": "...", "name": "...", "timezone": "...", "default_currency": "...",
  "has_password": bool, "apple_linked": bool, "google_linked": bool,
  "reminder_enabled": bool, "high_spend_enabled": bool, "high_spend_threshold": 100.00
}
```

404 si no existe.

**GET /internal/users** → `200`

```json
Query:    ?timezone=Europe/Madrid&reminder_enabled=true
Response: { "users": [...], "total": N }
```

Usado por Notification Service para listar usuarios a notificar. Sin paginación cursor (consumo interno).

### Checklist de desarrollo

- [ ] `src/routes/internal.routes.ts` con `internalAuth` en todos los endpoints
- [ ] Sin `authenticate` JWT (las llamadas internas no tienen access token)
- [ ] Nginx (Fase 9) bloqueará `/internal/*` externamente

### Checklist de tests

- [ ] `GET /internal/users/:id` → 200 con user existente
- [ ] `GET /internal/users/:id` → 404 con UUID inexistente
- [ ] `GET /internal/users` → 200 filtrando por `reminder_enabled=true`
- [ ] `GET /internal/users` → 200 filtrando por `timezone`
- [ ] Ambos → 401 sin `X-Internal-Secret`
- [ ] Ambos → 401 con secret incorrecto

### Commits del PR

```
feat(user-service): GET /internal/users/:id + tests
feat(user-service): GET /internal/users con filtros + tests
```

---

## Rama 8 — `feature/user-service-docker-prod`

### Objetivo

Imagen Docker de producción optimizada, sin código de desarrollo y con usuario no-root.

### Checklist de desarrollo

- [ ] `Dockerfile` multi-stage:
  - Stage `builder`: `node:20-alpine`, instala todas las deps, compila TypeScript → `dist/`
  - Stage `runner`: `node:20-alpine`, copia `dist/` + solo `node_modules` de producción
  - Usuario no-root: `addgroup -S app && adduser -S app -G app && USER app`
  - `HEALTHCHECK CMD curl --fail http://localhost:$PORT/health || exit 1`
- [ ] `.dockerignore`: excluir `src/`, `*.test.ts`, `node_modules/`, `.env*`
- [ ] Verificar que la imagen final no incluye devDependencies ni fuentes TypeScript

### Checklist de tests

- [ ] `docker build -t user-service:prod .` exitoso
- [ ] `docker run` con las env vars → health check responde
- [ ] `docker inspect` confirma usuario no-root

### Commits del PR

```
feat(user-service): Dockerfile prod multi-stage con usuario no-root
```

---

## Optimizaciones del servicio

Estas optimizaciones se implementan dentro de las ramas correspondientes, no como ramas separadas.

### Base de datos

- [ ] Pool de conexiones Prisma configurado (`connection_limit`)
- [ ] Queries con `select` explícito — nunca devolver `password_hash` al cliente
- [ ] Transacciones DB en: refresh rotation, reset-password (eliminar todos los refresh tokens)

### Redis

- [ ] Conexión con reintentos y backoff exponencial al arrancar
- [ ] Blacklist de refresh tokens con TTL automático
- [ ] Rate limiter con Lua script atómico (evitar race conditions en sliding window)

### RabbitMQ

- [ ] Conexión con reintentos hasta que RabbitMQ esté healthy
- [ ] Exchange `durable: true` + mensajes `persistent: true`

### Seguridad

- [ ] `helmet()` aplicado globalmente
- [ ] CORS con `origin` explícita (no `*`)
- [ ] Rate limiting en todos los endpoints de auth
- [ ] Logs sin datos sensibles (no loggear passwords ni tokens)
- [ ] `password_hash` nunca expuesto en responses

### Observabilidad

- [ ] Logger estructurado (pino) con niveles configurables por `NODE_ENV`
- [ ] Log por request: método, path, status code, latencia
- [ ] Stack trace en development, solo mensaje en production

---

## Integración con la infra

### Bloque a añadir en `infra/docker-compose.yml`

```yaml
user-service:
  build:
    context: ../services/user-service
    dockerfile: Dockerfile.dev
  ports:
    - "3001:3001"
  volumes:
    - ../services/user-service/src:/app/src
  env_file:
    - ../services/user-service/.env
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
  networks:
    - walletos-net
```

### Variables de entorno (`services/user-service/.env`)

```env
DATABASE_URL=postgresql://walletos:secret@postgres:5432/walletos_users
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://walletos:secret@rabbitmq:5672
JWT_SECRET=<min 32 chars aleatorio>
INTERNAL_SECRET=<min 32 chars aleatorio>
RESEND_API_KEY=re_...
APPLE_TEAM_ID=...
APPLE_SIGN_IN_KEY_ID=...
APPLE_SIGN_IN_CLIENT_ID=com.walletOS.app
GOOGLE_IOS_CLIENT_ID=...
PORT=3001
NODE_ENV=development
```

### CI (`.github/workflows/ci.yml`)

El workflow ya está configurado. Al añadir código al servicio:

- `npm run lint` — ESLint sin warnings
- `npm test` — Vitest con variables inyectadas por CI (DB, Redis, RabbitMQ ya configurados)

---

## Criterio "Done" de la Fase 5

- [ ] 11 endpoints públicos implementados con tests pasando
- [ ] 2 endpoints internos implementados con tests pasando
- [ ] `npm test` verde (unitarios + integración)
- [ ] `npm run lint` y `npm run typecheck` sin errores
- [ ] `docker compose up user-service` arranca sin errores
- [ ] `curl localhost:3001/health` → `{ "status": "ok", "service": "user-service" }`
- [ ] Flujo manual: register → login → refresh → GET /me → PATCH /me → forgot-password → reset-password → DELETE /me
- [ ] `user.deleted` publicado en RabbitMQ al hacer DELETE /me
- [ ] CI verde en todos los PRs a `develop`
- [ ] PR final `develop` → `main` con todos los checks verdes
- [ ] Checklist de Fase 5 en `ROADMAP.md` completamente marcado
