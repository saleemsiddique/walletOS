# WalletOS — Fase 6: Wallet Service

Motor financiero del sistema. El servicio con más endpoints y la lógica más delicada (transferencias atómicas, balance calculado, recurring rules). Se construye en ramas cortas de feature, cada una con su PR a `develop`. Al terminar la fase, `develop` → `main`.

## Contexto

El User Service (Fase 5) está completo y emite el access token JWT que este servicio consume para autenticar cada request. El Wallet Service no tiene FK hacia `walletos_users` — la integridad referencial se mantiene a nivel de aplicación y por el evento `user.deleted` de RabbitMQ.

**Base de datos:** `walletos_wallets` en la instancia `postgres:5432`.  
**Puerto:** `3002`.  
**Contratos de referencia:** `docs/api-contracts.md` (sección Wallet Service, líneas 222–647).  
**Schema SQL:** `docs/user-flow-and-bdd.md` (líneas 765–927).  
**Nota de discrepancia:** el ROADMAP menciona `GET /stats/summary`, `GET /stats/by-category` e internos como `GET /internal/users/:userId/transactions` — se usan los nombres de `api-contracts.md` que son los definitivos: `GET /stats`, `GET /stats/daily`, `GET /internal/transactions`, `GET /internal/categories`.

---

## Flujo de ramas

```
develop
 ├── feature/wallet-service-scaffold              ✅ MERGEADO (PR #50)
 ├── feature/wallet-service-schema                ✅ MERGEADO (PR #51)
 ├── feature/wallet-service-seed-utilities        ✅ MERGEADO (PR #52)
 ├── feature/wallet-service-categories            ✅ MERGEADO (PR #53)
 ├── feature/wallet-service-banks                 ✅ MERGEADO (PR #54)
 ├── feature/wallet-service-wallets               ✅ MERGEADO (PR #55)
 ├── feature/wallet-service-transactions-create   ✅ MERGEADO (PR #57)
 ├── feature/wallet-service-transactions-crud     ✅ MERGEADO (PR #58)
 ├── feature/wallet-service-transfers             ✅ MERGEADO (PR #59)
 ├── feature/wallet-service-recurring             ✅ MERGEADO (PR #60)
 ├── feature/wallet-service-stats                 ✅ MERGEADO (PR #61)
 ├── feature/wallet-service-internal-rabbitmq     ✅ MERGEADO (PR #62)
 ├── feature/wallet-service-docker-prod           ✅ MERGEADO (PR #63)
 ├── feature/wallet-service-investment-transactions ✅ MERGEADO (PR #65)
 └── feature/wallet-service-portfolio             ✅ MERGEADO (PR #66)
main ← develop  ✅ Fase 6 completa (PR #67 mergeado 2026-05-30)
```

---

## Rama 1 — `feature/wallet-service-scaffold` ✅ COMPLETADA

> Mergeada a `develop` en PR #50 (2026-05-13). CI verde, 2 tests pasando.

### Objetivo

Mismo patrón que user-service. Estructura base, TypeScript, Express, testing, hot reload, health endpoint e integración con docker-compose.

### Checklist de desarrollo

- [x] `package.json` con scripts `dev`, `build`, `test`, `lint`, `typecheck`
- [x] Dependencias de producción:
  - `express`, `cors`, `helmet`, `express-rate-limit`
  - `@prisma/client`, `prisma`
  - `zod`, `jsonwebtoken`
  - `ioredis`, `amqplib`
  - `node-cron`
  - `tsx` (dev), `typescript`
- [x] `tsconfig.json` (strict: true, target ES2022, moduleResolution bundler)
- [x] Estructura de carpetas:
  ```
  src/
    config/       — env.ts (Zod parse de process.env)
    controllers/  — un archivo por recurso
    services/     — lógica de negocio
    middleware/   — authenticate, errorHandler, rateLimiter, internalAuth
    routes/       — index.ts agrupa todos los routers
    lib/          — jwt.ts, prisma.ts, redis.ts, rabbitmq.ts
    types/        — express.d.ts (req.userId)
    validators/   — schemas Zod por recurso
    jobs/         — recurring.job.ts (cron)
  ```
- [x] `src/app.ts` — Express app factory (sin `listen`, para supertest)
- [x] `src/server.ts` — entry point con `app.listen(PORT)`
- [x] `src/config/env.ts` — parse de todas las env vars con Zod; falla al arrancar si faltan
- [x] ESLint flat config + Prettier + `tsconfig.eslint.json`
- [x] `vitest.config.ts` con globals: true, environment: node, coverage con v8
- [x] `src/test/setup.ts` — hooks vacíos (Prisma en Rama 2)
- [x] `GET /health` → `200 { status: "ok", service: "wallet-service" }`
- [x] `Dockerfile.dev` con tsx watch y volumen montado
- [x] Añadir bloque `wallet-service` en `infra/docker-compose.yml` (puerto 3002, `depends_on` postgres + redis + rabbitmq)
- [x] Actualizar `services/wallet-service/.env.example` con todas las variables
- [x] Añadir regla `services/wallet-service/**/*.ts` en `lint-staged.config.mjs` raíz

### Checklist de tests

- [x] `GET /health` → 200 con body correcto
- [x] `GET /health` sin credenciales → 200 (público)
- [x] App arranca sin errores con env vars de test completas

### Commits del PR

```
feat(wallet-service): inicializar package.json y dependencias
feat(wallet-service): tsconfig strict mode
feat(wallet-service): estructura de carpetas src/
feat(wallet-service): vitest + supertest setup
feat(wallet-service): GET /health endpoint
feat(wallet-service): Dockerfile.dev con hot reload
chore(infra): añadir wallet-service a docker-compose.yml
feat(wallet-service): tsconfig.eslint.json y globals vitest en ESLint
```

### Criterio Done

`npm run dev` arranca en puerto 3002, `npm test` verde, `curl localhost:3002/health` responde.

---

## Rama 2 — `feature/wallet-service-schema` ✅ COMPLETADA

> Mergeada a `develop` en PR #51 (2026-05-13). CI verde, 11 tests pasando (9 schema + 2 health). Migración `20260513175714_init` aplicada.

### Objetivo

Definir el schema de base de datos con Prisma y ejecutar la primera migración.

### Checklist de desarrollo

- [x] `prisma/schema.prisma` con las 5 tablas:

**`banks`**

```prisma
model Bank {
  id          String   @id @default(uuid()) @db.Uuid
  user_id     String   @db.Uuid
  name        String   @db.VarChar(100)
  icon        String   @default("🏦") @db.VarChar(50)
  color       String   @default("#007AFF") @db.VarChar(7)
  is_archived Boolean  @default(false)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  wallets     Wallet[]

  @@index([user_id])
  @@map("banks")
}
```

**`wallets`**

```prisma
enum WalletType {
  CASH
  INVESTMENT
}

model Wallet {
  id              String          @id @default(uuid()) @db.Uuid
  bank_id         String          @db.Uuid
  user_id         String          @db.Uuid
  name            String          @db.VarChar(100)
  type            WalletType      @default(CASH)
  initial_balance Decimal         @default(0.00) @db.Decimal(12, 2)
  icon            String          @default("💳") @db.VarChar(50)
  color           String          @default("#007AFF") @db.VarChar(7)
  is_archived     Boolean         @default(false)
  created_at      DateTime        @default(now())
  updated_at      DateTime        @updatedAt
  bank            Bank            @relation(fields: [bank_id], references: [id], onDelete: Cascade)
  transactions    Transaction[]
  recurring_rules RecurringRule[]

  @@index([bank_id])
  @@index([user_id])
  @@map("wallets")
}
```

> **Nota:** `initial_balance` y `recurring_rules` solo aplican a wallets `CASH`. Los wallets `INVESTMENT` los ignoran; su balance se calcula en Rama 15 a partir de `investment_transactions × precio_actual`.

**`categories`**

```prisma
model Category {
  id              String          @id @default(uuid()) @db.Uuid
  user_id         String?         @db.Uuid
  name            String          @db.VarChar(100)
  icon            String          @db.VarChar(50)
  type            CategoryType
  created_at      DateTime        @default(now())
  transactions    Transaction[]
  recurring_rules RecurringRule[]

  @@unique([user_id, name, type])
  @@index([user_id])
  @@map("categories")
}

enum CategoryType {
  INCOME
  EXPENSE
}
```

**`transactions`**

```prisma
model Transaction {
  id          String          @id @default(uuid()) @db.Uuid
  wallet_id   String          @db.Uuid
  user_id     String          @db.Uuid
  category_id String?         @db.Uuid
  type        TransactionType
  amount      Decimal         @db.Decimal(12, 2)
  note        String?         @db.VarChar(500)
  date        DateTime        @db.Date
  transfer_id String?         @db.Uuid
  created_at  DateTime        @default(now())
  updated_at  DateTime        @updatedAt
  wallet      Wallet          @relation(fields: [wallet_id], references: [id], onDelete: Cascade)
  category    Category?       @relation(fields: [category_id], references: [id])

  @@index([wallet_id])
  @@index([user_id])
  @@index([user_id, date(sort: Desc)])
  @@index([category_id])
  @@index([transfer_id])
  @@index([date(sort: Desc)])
  @@map("transactions")
}

enum TransactionType {
  INCOME
  EXPENSE
}
```

**`recurring_rules`**

```prisma
model RecurringRule {
  id           String             @id @default(uuid()) @db.Uuid
  user_id      String             @db.Uuid
  wallet_id    String             @db.Uuid
  category_id  String?            @db.Uuid
  type         TransactionType
  amount       Decimal            @db.Decimal(12, 2)
  note         String?            @db.VarChar(500)
  frequency    RecurringFrequency
  day_of_month Int?
  day_of_week  Int?
  starts_at    DateTime           @db.Date
  ends_at      DateTime?          @db.Date
  next_run     DateTime           @db.Date
  is_active    Boolean            @default(true)
  created_at   DateTime           @default(now())
  updated_at   DateTime           @updatedAt
  wallet       Wallet             @relation(fields: [wallet_id], references: [id], onDelete: Cascade)
  category     Category?          @relation(fields: [category_id], references: [id])

  @@index([user_id])
  @@index([next_run])
  @@index([is_active])
  @@map("recurring_rules")
}

enum RecurringFrequency {
  DAILY
  WEEKLY
  MONTHLY
}
```

- [x] `prisma migrate dev --name init` — primera migración
- [x] Verificar `onDelete: Cascade` en wallets → bank, transactions → wallet
- [x] Verificar constraint `UNIQUE NULLS NOT DISTINCT (user_id, name, type)` en categories (requiere Postgres 15+)

### Checklist de tests

- [x] Crear bank, verificar defaults (icon, color, is_archived=false)
- [x] Crear wallet con bank_id → relación correcta
- [x] Eliminar bank → wallets eliminados en cascada
- [x] Crear category con user_id=null (predefinida) → OK
- [x] Intentar duplicar category (mismo user_id, name, type) → error constraint
- [x] Crear transaction con category_id null (transferencia) → OK
- [x] Crear recurring_rule con frequency MONTHLY y day_of_month 15 → OK

### Commits del PR

```
feat(wallet-service): prisma schema — banks, wallets, categories, transactions, recurring_rules
feat(wallet-service): migración inicial con índices y constraints
```

### Criterio Done

`npx prisma migrate dev` exitoso en DB de test, constraints y cascadas verificadas.

---

## Rama 3 — `feature/wallet-service-seed-utilities` ✅ COMPLETADA

> Mergeada a `develop` en PR #52 (2026-05-13). CI verde, 29 tests pasando (health + schema + balance + authenticate + internalAuth + rateLimiter + seed). Nota: la lógica del seed vive en `src/lib/seed.ts`; `prisma/seed.ts` actúa como entry point del CLI.

### Objetivo

Seed idempotente de categorías predefinidas + módulo de balance + todas las utilidades reutilizables: error handler, authenticate middleware, rate limiter, internal auth, validators.

### Checklist de desarrollo

**`prisma/seed.ts` + `src/lib/seed.ts`**

- [x] Seed idempotente: `findFirst` + `create` de las 14 categorías predefinidas (user_id = null) al arrancar el servicio
- [x] 9 EXPENSE: Comida 🍔, Transporte 🚗, Ocio 🎮, Suscripciones 📱, Compras 🛍, Salud 🏥, Casa 🏠, Educación 📚, Otros ···
- [x] 5 INCOME: Nómina 💰, Freelance 💻, Inversiones 📈, Regalos 🎁, Otros ···
- [x] Llamar al seed en `src/server.ts` al arrancar (antes de `app.listen`)

**`src/lib/balance.ts`**

- [x] `calculateWalletBalance(walletId: string): Promise<Decimal>` — `initial_balance + SUM(INCOME) - SUM(EXPENSE)` (excluye is_archived)
- [x] `calculateUserTotalBalance(userId: string): Promise<Decimal>` — suma de balances de todos los wallets CASH no archivados del user (los INVESTMENT se cubren en Rama 15)

**`src/lib/jwt.ts`**

- [x] `verifyAccessToken(token: string): { userId: string }` — verifica JWT emitido por User Service (mismo `JWT_SECRET`); lanza `UnauthorizedError` si inválido
- [x] Solo `verify`, no `sign` — este servicio no emite tokens

**`src/lib/prisma.ts`** — singleton de PrismaClient ✅

**`src/lib/redis.ts`** — singleton de ioredis con reintentos ✅

**`src/lib/rabbitmq.ts`** — conexión con reintentos, publisher (consumer en Rama 12) ✅

**`src/middleware/authenticate.ts`**

- [x] Extrae `Authorization: Bearer {token}`
- [x] Verifica con `verifyAccessToken`
- [x] Añade `req.userId` al request
- [x] 401 si falta o inválido

**`src/middleware/errorHandler.ts`**

- [x] Clases: `AppError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`
- [x] Middleware Express: misma lógica que user-service

**`src/middleware/rateLimiter.ts`**

- [x] `createRateLimiter(max, windowSeconds, keyFn?)` — sliding window Redis con Lua script atómico
- [x] Límites: endpoints autenticados = 60 req/min por user (se aplican en ramas siguientes)

**`src/middleware/internalAuth.ts`**

- [x] Valida `X-Internal-Secret` contra `INTERNAL_SECRET` env var

**`src/validators/`**

- [x] `bank.validators.ts` — schemas Zod para POST /banks, PATCH /banks/:id
- [x] `wallet.validators.ts` — schemas Zod para POST /banks/:id/wallets, PATCH /wallets/:id
- [x] `transaction.validators.ts` — schemas Zod para POST /wallets/:id/transactions, PATCH /transactions/:id
- [x] `transfer.validators.ts` — schema Zod para POST /transfers
- [x] `category.validators.ts` — schemas Zod para POST /categories, PATCH /categories/:id
- [x] `recurring.validators.ts` — schemas Zod para POST /recurring, PATCH /recurring/:id
- [x] `stats.validators.ts` — schemas Zod para query params de GET /stats, GET /stats/daily

### Checklist de tests

**balance.ts**

- [x] Wallet sin transacciones → balance = initial_balance
- [x] Wallet con transacciones INCOME → balance aumenta
- [x] Wallet con transacciones EXPENSE → balance disminuye
- [x] Balance total usuario suma correctamente múltiples wallets
- [x] Wallets archivados no se incluyen en balance total
- [x] Wallets INVESTMENT no se incluyen en balance total (extra)

**authenticate.ts** (con supertest)

- [x] 401 sin Authorization header
- [x] 401 con token mal formado
- [x] 401 con token de firma incorrecta
- [x] `req.userId` correctamente poblado con token válido

**rateLimiter.ts**

- [x] N requests permitidos, N+1 → 429

**internalAuth.ts**

- [x] 401 sin X-Internal-Secret
- [x] 401 con secret incorrecto
- [x] Pasa con secret correcto

**seed**

- [x] Seed idempotente: ejecutar dos veces → no duplica categorías
- [x] 14 categorías predefinidas con user_id=null tras el seed

### Commits del PR

```
feat(wallet-service): prisma seed — 14 categorías predefinidas idempotente
feat(wallet-service): balance calculator — wallet y total usuario
feat(wallet-service): lib/jwt.ts — verify only (token emitido por user-service)
feat(wallet-service): error handler — clases y middleware global
feat(wallet-service): authenticate middleware
feat(wallet-service): rate limiting middleware con Redis sliding window
feat(wallet-service): internal auth middleware
feat(wallet-service): zod validators — banks, wallets, transactions, transfers, categories, recurring, stats
```

### Criterio Done

`npm test` verde en todos los tests de utilidades. Seed ejecutable con `npx prisma db seed`.

---

## Rama 4 — `feature/wallet-service-categories` ✅ COMPLETADA

PR #53 mergeado.

### Objetivo

CRUD de categorías: predefinidas (solo lectura) y custom del usuario.

### Contratos (de api-contracts.md)

**GET /categories** → `200`

```json
Query: type? (INCOME|EXPENSE)
Response: {
  "categories": [
    { "id": "uuid", "name": "Comida", "icon": "🍔", "type": "EXPENSE", "is_custom": false },
    { "id": "uuid", "name": "Gimnasio", "icon": "💪", "type": "EXPENSE", "is_custom": true }
  ]
}
```

`is_custom` = `user_id != NULL`. Orden: predefinidas primero (user_id=null), luego custom. Sin paginación.

**POST /categories** → `201`

```json
Request:  { "name": "Gimnasio", "icon": "💪", "type": "EXPENSE" }
Response: { "id": "uuid", "name": "Gimnasio", "icon": "💪", "type": "EXPENSE", "is_custom": true }
```

409 si name+type ya existe para el usuario.

**PATCH /categories/:id** → `200`

```json
Request:  { "name?": "Gym", "icon?": "🏋️" }
Response: { "id": "uuid", "name": "Gym", "icon": "🏋️", "type": "EXPENSE", "is_custom": true }
```

403 si es predefinida (user_id=null). 404 si no existe o no pertenece al usuario.

**DELETE /categories/:id** → `204`

Solo custom. Reasigna transacciones a la categoría "Otros" del mismo type en transacción atómica. 403 si es predefinida.

### Checklist de desarrollo

- [x] `src/services/category.service.ts` — lógica de negocio
- [x] `src/controllers/category.controller.ts` — manejo HTTP
- [x] `src/routes/category.routes.ts` — todas con `authenticate`
- [x] Reasignación a "Otros" en `DELETE`: además de `transactions`, también `recurring_rules` apuntando a la categoría borrada se reasignan al fallback en la misma `prisma.$transaction`

### Checklist de tests

**GET /categories**

- [x] 200 devuelve todas las categorías (predefinidas + custom del user)
- [x] Predefinidas primero, custom al final
- [x] Filtro `?type=EXPENSE` devuelve solo EXPENSE
- [x] No incluye categorías custom de otros usuarios
- [x] 401 sin token

**POST /categories**

- [x] 201 crea categoría custom del usuario
- [x] `is_custom: true` en la respuesta
- [x] 409 con name+type duplicado para el mismo usuario
- [x] 400 con body inválido (falta name, icon o type)
- [x] 401 sin token

**PATCH /categories/:id**

- [x] 200 actualiza name e icon de categoría custom propia
- [x] 403 intentando editar predefinida
- [x] 404 con id inexistente
- [x] 404 intentando editar categoría custom de otro usuario
- [x] 401 sin token

**DELETE /categories/:id**

- [x] 204, categoría eliminada
- [x] Transacciones reasignadas a "Otros" del mismo type
- [x] 403 intentando eliminar predefinida
- [x] 404 con id inexistente
- [x] 401 sin token

### Commits del PR

```
feat(wallet-service): get /categories con filtro por type + tests
feat(wallet-service): post /categories + tests
feat(wallet-service): patch /categories/:id + tests
feat(wallet-service): delete /categories/:id con reasignación a otros + tests
```

> Subjects en minúsculas para satisfacer commitlint (`subject-case: lower-case`).

### Criterio Done

4 endpoints de categorías con tests de integración verdes. 18 tests nuevos en `src/test/category.test.ts`.

---

## Rama 5 — `feature/wallet-service-banks` ✅ COMPLETADA

PR #54 mergeado.

### Objetivo

CRUD de bancos del usuario. DELETE es soft delete (archiva banco + wallets).

### Contratos

**POST /banks** → `201`

```json
Request:  { "name": "Santander", "icon?": "🏦", "color?": "#E31837" }
Response: { "id": "uuid", "name": "Santander", "icon": "🏦", "color": "#E31837", "is_archived": false, "created_at": "...", "updated_at": "..." }
```

Defaults: icon=`🏦`, color=`#007AFF`.

**GET /banks** → `200`

Solo no archivados. Balance calculado por query (ver `docs/user-flow-and-bdd.md` líneas 883–904).

```json
{
  "banks": [
    {
      "id": "uuid",
      "name": "Santander",
      "icon": "🏦",
      "color": "#E31837",
      "wallets": [
        {
          "id": "uuid",
          "name": "Ahorro",
          "icon": "💰",
          "color": "#34C759",
          "balance": 1200.0
        },
        {
          "id": "uuid",
          "name": "Nómina",
          "icon": "💳",
          "color": "#007AFF",
          "balance": 2100.5
        }
      ],
      "total_balance": 3300.5
    }
  ],
  "total_balance": 4870.5
}
```

Solo wallets no archivados.

**PATCH /banks/:id** → `200`

```json
Request:  { "name?": "Banco Santander", "icon?": "🏛", "color?": "#CC0000" }
Response: { "id": "uuid", "name": "Banco Santander", "icon": "🏛", "color": "#CC0000", "is_archived": false, "updated_at": "..." }
```

404 si no existe o no pertenece al usuario.

**DELETE /banks/:id** → `200`

Soft delete: `is_archived = true` en banco + todos sus wallets. Las transacciones se conservan.

```json
{ "id": "uuid", "name": "Santander", "is_archived": true, "updated_at": "..." }
```

### Checklist de desarrollo

- [x] `src/services/bank.service.ts`
- [x] `src/controllers/bank.controller.ts`
- [x] `src/routes/bank.routes.ts` (todas con `authenticate`)
- [x] GET /banks: `include: { wallets: { where: { is_archived: false } } }` + una sola `groupBy(['wallet_id','type'])` sobre las wallets cargadas para evitar N+1; balance = `initial_balance + Σ INCOME − Σ EXPENSE`.
- [x] DELETE: `prisma.$transaction` → `updateMany` wallets activos + `update` bank a `is_archived = true`. Transactions se preservan.
- [x] Verificar ownership: `bank.user_id === req.userId` en PATCH y DELETE (helper `loadOwnedBank`).

### Checklist de tests

**POST /banks**

- [x] 201 con datos correctos
- [x] Defaults icon=`🏦`, color=`#007AFF` cuando se omiten
- [x] 400 con body inválido (falta name)
- [x] 401 sin token

**GET /banks**

- [x] 200 devuelve solo bancos no archivados del user
- [x] Wallets anidados con balance calculado correcto
- [x] `total_balance` es la suma de todos los wallets activos
- [x] No devuelve bancos de otros usuarios
- [x] 401 sin token

**PATCH /banks/:id**

- [x] 200 actualiza name, icon, color
- [x] 404 con id inexistente
- [x] 404 con banco de otro usuario
- [x] 401 sin token

**DELETE /banks/:id**

- [x] 200 con `is_archived: true`
- [x] Todos los wallets del banco quedan archivados
- [x] Transacciones se conservan
- [x] 404 con id inexistente
- [x] 401 sin token

### Commits del PR

```
feat(wallet-service): post /banks + tests
feat(wallet-service): get /banks con balances calculados + tests
feat(wallet-service): patch /banks/:id + tests
feat(wallet-service): delete /banks/:id soft delete + tests
```

### Criterio Done

4 endpoints de bancos con tests de integración verdes. 17 tests nuevos en `src/test/bank.test.ts`.

---

## Rama 6 — `feature/wallet-service-wallets` ✅ COMPLETADA

PR #55 mergeado.

### Objetivo

CRUD de wallets bajo un banco: crear, listar por banco, listar todos (flat), actualizar y archivar.

### Contratos

**POST /banks/:id/wallets** → `201`

```json
Request:  { "name": "Ahorro", "initial_balance?": 1200.00, "icon?": "💰", "color?": "#34C759" }
Response: { "id": "uuid", "bank_id": "uuid", "name": "Ahorro", "icon": "💰", "color": "#34C759", "balance": 1200.00, "is_archived": false, "created_at": "...", "updated_at": "..." }
```

Defaults: initial_balance=`0.00`, icon=`💳`, color=`#007AFF`. 404 si el banco no existe o no pertenece al usuario.

**GET /banks/:id/wallets** → `200`

```json
{
  "wallets": [
    {
      "id": "uuid",
      "bank_id": "uuid",
      "name": "Ahorro",
      "icon": "💰",
      "color": "#34C759",
      "balance": 1200.0
    }
  ]
}
```

Solo wallets no archivados del banco.

**GET /wallets** → `200`

Lista plana de todos los wallets activos del usuario (sin anidar por banco). Útil para el selector de wallet al crear transacción.

```json
{
  "wallets": [
    {
      "id": "uuid",
      "bank_id": "uuid",
      "bank_name": "Santander",
      "name": "Ahorro",
      "icon": "💰",
      "color": "#34C759",
      "balance": 1200.0
    }
  ]
}
```

**PATCH /wallets/:id** → `200`

```json
Request:  { "name?": "Cuenta ahorro", "icon?": "🏦", "color?": "#FF9500" }
Response: { "id": "uuid", "bank_id": "uuid", "name": "Cuenta ahorro", "icon": "🏦", "color": "#FF9500", "balance": 1200.0, "is_archived": false, "updated_at": "..." }
```

No se puede cambiar `initial_balance` ni `bank_id`. 404 si no existe o no pertenece al usuario.

**DELETE /wallets/:id** → `200`

Soft delete. Las transacciones se conservan.

```json
{ "id": "uuid", "name": "Ahorro", "is_archived": true, "updated_at": "..." }
```

### Checklist de desarrollo

- [x] `src/services/wallet.service.ts`
- [x] `src/controllers/wallet.controller.ts`
- [x] `src/routes/wallet.routes.ts` (todas con `authenticate`)
- [x] Helper privado `balancesForWallets(walletIds)` con una sola `groupBy(['wallet_id','type'])`; se reusa en GET por bank, GET flat, PATCH y DELETE — evita N+1 y duplicar lógica.
- [x] GET /banks/:id/wallets + GET /wallets: balance calculado con el helper anterior.
- [x] Verificar ownership del banco en POST y GET /banks/:id/wallets (helper `loadOwnedBank`).
- [x] Verificar ownership del wallet en PATCH y DELETE (helper `loadOwnedWallet`).

### Checklist de tests

**POST /banks/:id/wallets**

- [x] 201 crea wallet con initial_balance correcto
- [x] `balance` en respuesta = `initial_balance` (sin transacciones)
- [x] Defaults aplicados cuando se omiten icon y color
- [x] 404 con bank_id inexistente
- [x] 404 con banco de otro usuario
- [x] 401 sin token

**GET /banks/:id/wallets**

- [x] 200 lista wallets activos del banco
- [x] No incluye wallets archivados
- [x] 404 con banco inexistente o de otro usuario
- [x] 401 sin token

**GET /wallets**

- [x] 200 lista todos los wallets activos del usuario
- [x] Incluye `bank_name` en cada wallet
- [x] No incluye wallets de otros usuarios ni archivados
- [x] 401 sin token

**PATCH /wallets/:id**

- [x] 200 actualiza name, icon, color
- [x] `initial_balance` no se puede actualizar (campo no contemplado en `updateWalletSchema` — se ignora silenciosamente si llega)
- [x] 404 con id inexistente
- [x] 404 con wallet de otro usuario
- [x] 401 sin token

**DELETE /wallets/:id**

- [x] 200 con `is_archived: true`
- [x] Transacciones se conservan
- [x] 404 con id inexistente
- [x] 401 sin token

### Commits del PR

```
feat(wallet-service): post /banks/:id/wallets + tests
feat(wallet-service): get /banks/:id/wallets + tests
feat(wallet-service): get /wallets lista plana + tests
feat(wallet-service): patch /wallets/:id + tests
feat(wallet-service): delete /wallets/:id soft delete + tests
```

### Criterio Done

5 endpoints de wallets con tests de integración verdes. 20 tests nuevos en `src/test/wallet.test.ts`. Suite total wallet-service: 84 tests.

---

## Rama 7 — `feature/wallet-service-transactions-create` ✅ COMPLETADA

> Mergeada a `develop` en PR #57. CI verde.

### Objetivo

Crear transacciones (con soporte offline-first via UUID del cliente) y listar transacciones de un wallet con paginación cursor-based.

### Contratos

**POST /wallets/:id/transactions** → `201`

```json
Request: {
  "id?": "uuid",
  "type": "EXPENSE",
  "amount": 42.30,
  "category_id": "uuid",
  "note?": "Mercadona",
  "date?": "2026-04-18"
}
Response: {
  "id": "uuid", "wallet_id": "uuid", "wallet_name": "Nómina", "bank_name": "Santander",
  "type": "EXPENSE", "amount": 42.30,
  "category": { "id": "uuid", "name": "Comida", "icon": "🍔" },
  "note": "Mercadona", "date": "2026-04-18",
  "transfer_id": null, "paired_wallet_name": null,
  "created_at": "2026-04-18T10:30:00Z"
}
```

- `id?` opcional: si el cliente lo envía (offline-first), se usa; si no, el servidor lo genera
- type = `INCOME|EXPENSE`; amount > 0
- `category_id` debe pertenecer al usuario o ser predefinida (user_id=null); type de categoría debe coincidir con type de transacción
- Default date = hoy
- Publica `transaction.created` en RabbitMQ
- 404 si wallet no existe o no pertenece al usuario
- 409 si se envía un `id` que ya existe

**GET /wallets/:id/transactions** → `200`

```
Query: cursor?, limit? (default 20, max 50), from?, to?, category_id?
Orden: date DESC, created_at DESC
```

```json
{
  "transactions": [
    {
      "id": "uuid",
      "wallet_id": "uuid",
      "wallet_name": "Nómina",
      "bank_name": "Santander",
      "type": "EXPENSE",
      "amount": 42.3,
      "category": { "id": "uuid", "name": "Comida", "icon": "🍔" },
      "note": "Mercadona",
      "date": "2026-04-18",
      "transfer_id": null,
      "paired_wallet_name": null,
      "created_at": "2026-04-18T10:30:00Z"
    }
  ],
  "next_cursor": "uuid-or-null"
}
```

Incluye transferencias con `paired_wallet_name` del wallet contraparte. Cursor basado en `id` de la última transacción devuelta.

### Checklist de desarrollo

- [x] `src/services/transaction.service.ts`
- [x] `src/controllers/transaction.controller.ts`
- [x] `src/routes/transaction.routes.ts` (todas con `authenticate`)
- [x] `createTransaction`: si `id` viene en body → verificar que no exista → 409; si no viene → generar UUID
- [x] `createTransaction`: verificar que category_id pertenece al user o es predefinida (user_id=null) y que su type coincide
- [x] Paginación cursor estable `(date, created_at, id)`: cursor es solo el `id` enviado por el cliente; el service carga (date, created_at) de esa fila y aplica filtro tupla `(date, created_at, id) < cursor` con orden `date DESC, created_at DESC, id DESC`
- [x] `paired_wallet_name`: para transacciones con `transfer_id != null`, buscar la transacción hermana y su wallet
- [x] Publicar `transaction.created` en RabbitMQ — sí desde `POST /wallets/:id/transactions`. **No** se publica desde transferencias (`POST /transfers`) ni desde la materialización del cron de recurring → la pata EXPENSE/INCOME del transfer no dispara evento.

### Checklist de tests

**POST /wallets/:id/transactions**

- [x] 201 crea transacción EXPENSE con datos correctos
- [x] 201 crea transacción INCOME con datos correctos
- [x] `id` generado por servidor cuando no se envía
- [x] `id` del cliente respetado cuando se envía (offline-first)
- [x] 409 si `id` enviado ya existe
- [x] Default date = fecha de hoy cuando no se envía
- [x] 400 con amount ≤ 0
- [x] 400 si type de categoría no coincide con type de transacción
- [x] 400 si category_id no existe o no pertenece al usuario
- [x] 404 con wallet_id inexistente
- [x] 404 con wallet de otro usuario
- [x] Evento `transaction.created` publicado en RabbitMQ
- [x] 401 sin token

**GET /wallets/:id/transactions**

- [x] 200 lista transacciones en orden date DESC, created_at DESC
- [x] Paginación cursor: primer page sin cursor, siguiente page con cursor
- [x] `next_cursor: null` en última página
- [x] Filtro `?from=2026-04-01&to=2026-04-30`
- [x] Filtro `?category_id=uuid`
- [x] Transferencias incluidas con `paired_wallet_name` correcto
- [x] 404 con wallet inexistente o de otro usuario
- [x] 401 sin token

### Commits del PR

```
feat(wallet-service): POST /wallets/:id/transactions con soporte offline-first + tests
feat(wallet-service): GET /wallets/:id/transactions con paginación cursor + tests
```

### Criterio Done

2 endpoints de transacciones con tests de integración verdes. Evento `transaction.created` publicado correctamente.

---

## Rama 8 — `feature/wallet-service-transactions-crud` ✅ COMPLETADA

> Mergeada a `develop` en PR #58. CI verde.

### Objetivo

Obtener, editar y eliminar transacciones individuales, más la lista cross-wallet con filtros.

### Contratos

**GET /transactions/:id** → `200`

```json
{ ...mismo shape que POST response... }
```

404 si no existe o no pertenece al usuario.

**PATCH /transactions/:id** → `200`

```json
Request: {
  "type?": "INCOME",
  "amount?": 50.0,
  "category_id?": "uuid",
  "note?": "Corregido",
  "date?": "2026-04-17",
  "wallet_id?": "uuid"
}
Response: { ...transacción actualizada... }
```

403 si `transfer_id != null` (las transferencias no se editan — se borran y recrean). 404 si no existe o es de otro usuario.

**DELETE /transactions/:id** → `204`

Hard delete. Si tiene `transfer_id`, borra ambas transacciones del par en transacción atómica.

**GET /transactions** → `200`

Cross-wallet. Para "ver más" en Home.

```
Query: cursor?, limit? (default 20), from?, to?, category_id?, wallet_id?, type?
```

Transferencias: solo pata EXPENSE (la app la muestra como fila única). Mismo shape que GET /wallets/:id/transactions.

### Checklist de desarrollo

- [x] GET /transactions/:id: verificar `transaction.user_id === req.userId` (helper `loadOwnedTransaction`)
- [x] PATCH /transactions/:id: si `wallet_id` cambia, verificar que el nuevo wallet pertenece al usuario; 403 si la tx es transfer; 400 si se cambia `type` y la categoría existente no coincide
- [x] DELETE /transactions/:id: si `transfer_id != null` → `prisma.transaction.deleteMany({ where: { transfer_id } })` (borra ambas patas atómicamente)
- [x] GET /transactions: filtro `OR: [{ transfer_id: null }, { type: 'EXPENSE' }]` para mostrar transferencias solo por su pata EXPENSE

### Checklist de tests

**GET /transactions/:id**

- [x] 200 con transacción propia
- [x] 404 con id inexistente
- [x] 404 con transacción de otro usuario
- [x] 401 sin token

**PATCH /transactions/:id**

- [x] 200 actualiza type, amount, category_id, note, date
- [x] 200 mueve transacción a otro wallet del mismo usuario
- [x] 403 intentando editar transacción con transfer_id
- [x] 400 si nuevo category_id no coincide en type
- [x] 404 con id inexistente
- [x] 404 con wallet_id de otro usuario
- [x] 401 sin token

**DELETE /transactions/:id**

- [x] 204, transacción eliminada
- [x] Si tiene transfer_id: ambas transacciones del par eliminadas en una operación atómica
- [x] 404 con id inexistente
- [x] 401 sin token

**GET /transactions**

- [x] 200 lista transacciones de todos los wallets del usuario
- [x] Transferencias: solo pata EXPENSE visible
- [x] Filtros: from, to, category_id, wallet_id, type
- [x] Paginación cursor correcta
- [x] No incluye transacciones de otros usuarios
- [x] 401 sin token

### Commits del PR

```
feat(wallet-service): GET /transactions/:id + tests
feat(wallet-service): PATCH /transactions/:id + tests
feat(wallet-service): DELETE /transactions/:id con borrado atómico de transferencias + tests
feat(wallet-service): GET /transactions cross-wallet con filtros + tests
```

### Criterio Done

4 endpoints con tests verdes.

---

## Rama 9 — `feature/wallet-service-transfers` ✅ COMPLETADA

> Mergeada a `develop` en PR #59. CI verde.

### Objetivo

Crear transferencias entre wallets del mismo usuario en una única transacción SQL atómica.

### Contratos

**POST /transfers** → `201`

```json
Request: {
  "from_wallet_id": "uuid",
  "to_wallet_id": "uuid",
  "amount": 500.00,
  "note?": "Ahorro mensual",
  "date?": "2026-04-18"
}
Response: {
  "transfer_id": "shared-uuid",
  "expense": {
    "id": "uuid", "wallet_id": "uuid", "wallet_name": "Nómina", "bank_name": "Santander",
    "type": "EXPENSE", "amount": 500.00, "category": null,
    "note": "Ahorro mensual", "date": "2026-04-18",
    "transfer_id": "shared-uuid", "paired_wallet_name": "Ahorro",
    "created_at": "2026-04-18T10:30:00Z"
  },
  "income": {
    "id": "uuid", "wallet_id": "uuid", "wallet_name": "Ahorro", "bank_name": "Santander",
    "type": "INCOME", "amount": 500.00, "category": null,
    "note": "Ahorro mensual", "date": "2026-04-18",
    "transfer_id": "shared-uuid", "paired_wallet_name": "Nómina",
    "created_at": "2026-04-18T10:30:00Z"
  }
}
```

- Operación atómica (`prisma.$transaction`)
- Sin categoría (`category_id = null`)
- **No publica** `transaction.created`
- No afecta balance total del usuario (suma cero)
- Se excluyen de stats
- 400 si `from_wallet_id === to_wallet_id`
- 404 si cualquiera de los dos wallets no existe o no pertenece al usuario

### Checklist de desarrollo

- [x] `src/services/transfer.service.ts`
- [x] `src/controllers/transfer.controller.ts`
- [x] `src/routes/transfer.routes.ts` (con `authenticate`)
- [x] Generar un UUID compartido (`transfer_id`) con `crypto.randomUUID()` antes del `prisma.$transaction`
- [x] Insertar EXPENSE en `from_wallet_id` e INCOME en `to_wallet_id` con el mismo `transfer_id`
- [x] Verificar ownership de ambos wallets (carga en paralelo con `Promise.all` antes del `$transaction`)

### Checklist de tests

**POST /transfers**

- [x] 201 crea par EXPENSE+INCOME con mismo `transfer_id`
- [x] `category: null` en ambas transacciones
- [x] El balance de `from_wallet` disminuye en `amount`
- [x] El balance de `to_wallet` aumenta en `amount`
- [x] El balance total del usuario no cambia
- [x] Default date = hoy
- [x] 400 con `from_wallet_id === to_wallet_id`
- [x] 400 con amount ≤ 0
- [x] 404 con `from_wallet_id` inexistente o de otro usuario
- [x] 404 con `to_wallet_id` inexistente o de otro usuario
- [x] Evento `transaction.created` NO publicado en RabbitMQ
- [x] 401 sin token

### Commits del PR

```
feat(wallet-service): POST /transfers con transacción atómica + tests
```

### Criterio Done

Transferencias atómicas verificadas con tests. Balance total invariante validado.

---

## Rama 10 — `feature/wallet-service-recurring` ✅ COMPLETADA

> Mergeada a `develop` en PR #60. CI verde.

### Objetivo

CRUD de reglas de transacciones recurrentes + cron job diario que materializa las transacciones pendientes.

### Contratos

Los endpoints de recurring no están en api-contracts.md — se diseñan aquí de forma consistente con el resto del servicio.

**GET /recurring** → `200`

```json
{
  "recurring": [
    {
      "id": "uuid",
      "wallet_id": "uuid",
      "wallet_name": "Nómina",
      "bank_name": "Santander",
      "type": "EXPENSE",
      "amount": 9.99,
      "category": { "id": "uuid", "name": "Suscripciones", "icon": "📱" },
      "note": "Spotify",
      "frequency": "MONTHLY",
      "day_of_month": 15,
      "day_of_week": null,
      "next_run": "2026-05-15",
      "is_active": true,
      "created_at": "2026-04-15T10:00:00Z"
    }
  ]
}
```

Solo activas del usuario (`is_active = true`).

**POST /recurring** → `201`

```json
Request: {
  "wallet_id": "uuid",
  "type": "EXPENSE",
  "amount": 9.99,
  "category_id": "uuid",
  "note?": "Spotify",
  "frequency": "DAILY|WEEKLY|MONTHLY",
  "day_of_month?": 15,
  "day_of_week?": 0,
  "starts_at?": "2026-05-01"
}
Response: { ...mismo shape que item de GET... }
```

- `day_of_month` (1-31): obligatorio si frequency=MONTHLY
- `day_of_week` (0=lunes...6=domingo): obligatorio si frequency=WEEKLY
- `starts_at` default = hoy
- `next_run` se calcula al crear según frequency + starts_at

**PATCH /recurring/:id** → `200`

```json
Request: { "amount?": 12.99, "note?": "Spotify Premium", "category_id?": "uuid", "is_active?": false }
Response: { ...rule actualizada... }
```

404 si no existe o no pertenece al usuario.

**DELETE /recurring/:id** → `204`

Hard delete. 404 si no existe o de otro usuario.

**Cron scheduler (interno)** — `src/jobs/recurring.job.ts`

- `node-cron`: se ejecuta a las `0 6 * * *` (06:00 UTC diario)
- Query: `WHERE next_run <= TODAY AND is_active = true`
- Para cada regla: crear transacción (mismos parámetros que POST /wallets/:id/transactions; publica `transaction.created`)
- Calcular `next_run` siguiente y actualizar la regla
- Todo en `prisma.$transaction` por regla (crear transacción + actualizar next_run atómicamente)

**Cálculo de `next_run`:**

```
DAILY:   next_run = next_run + 1 día
WEEKLY:  next_run = próximo día_of_week a partir de next_run + 1 día
MONTHLY: next_run = next_run + 1 mes (mismo day_of_month)
```

### Checklist de desarrollo

- [x] `src/services/recurring.service.ts`
- [x] `src/controllers/recurring.controller.ts`
- [x] `src/routes/recurring.routes.ts` (con `authenticate`)
- [x] `src/jobs/recurring.job.ts` — cron diario con node-cron (`0 6 * * *`)
- [x] **`src/lib/nextRun.ts`** — dos funciones puras testeables (sustituyen al `calculateNextRun` original):
  - `computeFirstMatch(from, params): Date` — primer match ≥ fecha (POST inicial al crear regla)
  - `computeNextAfter(prev, params): Date` — siguiente match > fecha (cron tras materializar)
  - Lógica UTC, con clamp del `day_of_month` al último día del mes (ej. 31 → 28/29 en febrero)
- [x] Integrar `scheduleRecurringJob()` en `src/server.ts` (arranca con el servicio)

### Checklist de tests

**GET /recurring**

- [x] 200 devuelve solo reglas activas del usuario
- [x] No incluye reglas de otros usuarios
- [x] 401 sin token

**POST /recurring**

- [x] 201 crea regla MONTHLY con day_of_month
- [x] 201 crea regla WEEKLY con day_of_week
- [x] 201 crea regla DAILY
- [x] `next_run` calculado correctamente en cada caso
- [x] 400 si frequency=MONTHLY y no se envía day_of_month
- [x] 400 si frequency=WEEKLY y no se envía day_of_week
- [x] 400 si category_id no pertenece al usuario
- [x] 404 si wallet_id no existe o es de otro usuario
- [x] 401 sin token

**PATCH /recurring/:id**

- [x] 200 actualiza amount, note, category_id, is_active
- [x] 404 con id de otro usuario
- [x] 401 sin token

**DELETE /recurring/:id**

- [x] 204, regla eliminada
- [x] 404 con id inexistente
- [x] 401 sin token

**computeFirstMatch & computeNextAfter** (unit tests)

- [x] DAILY: next = mismo día (firstMatch) / + 1 día (nextAfter)
- [x] WEEKLY: primer día con `day_of_week` objetivo, mismo día si coincide; +7 días si prev ya coincidía
- [x] MONTHLY: mismo mes si day_of_month aún no pasó, sino siguiente mes; clamp `day_of_month=31` a último día (28/29 en febrero) y recovery a 31 en marzo

**recurring.job.ts** (integration)

- [x] Reglas con next_run = hoy o pasado → transacción creada, next_run actualizado
- [x] Reglas con next_run futuro → no procesadas
- [x] Reglas con is_active=false → no procesadas
- [x] Evento `transaction.created` publicado por cada materialización

### Commits del PR

```
feat(wallet-service): GET /recurring + tests
feat(wallet-service): POST /recurring con cálculo de next_run + tests
feat(wallet-service): PATCH /recurring/:id + tests
feat(wallet-service): DELETE /recurring/:id + tests
feat(wallet-service): recurring job — cron diario materializa transacciones + tests
```

### Criterio Done

4 endpoints + cron con tests verdes. Scheduler arranca con el servicio.

---

## Rama 11 — `feature/wallet-service-stats` ✅ COMPLETADA

> Mergeada a `develop` en PR #61. CI verde.

### Objetivo

Estadísticas por período + desglose diario para el gráfico de barras + dashboard home con una sola llamada.

### Contratos

**GET /stats** → `200`

```
Query: month (1-12, req), year (req), bank_id?, wallet_id?
```

```json
{
  "period": { "month": 4, "year": 2026 },
  "total_expense": 820.5,
  "total_income": 2100.0,
  "previous_period": { "total_expense": 731.25, "total_income": 2100.0 },
  "expense_change_pct": 12.2,
  "income_change_pct": 0.0,
  "by_category": [
    {
      "category_id": "uuid",
      "name": "Comida",
      "icon": "🍔",
      "total": 287.0,
      "pct": 35.0,
      "transaction_count": 15
    },
    {
      "category_id": "uuid",
      "name": "Transporte",
      "icon": "🚗",
      "total": 164.1,
      "pct": 20.0,
      "transaction_count": 8
    }
  ]
}
```

Excluye transferencias (`transfer_id IS NOT NULL`). `by_category` ordenado por total DESC.

**GET /stats/daily** → `200`

```
Query: from (req), to (req, max 31 días de from), bank_id?, wallet_id?
```

```json
{
  "days": [
    { "date": "2026-04-01", "expense": 45.3, "income": 0.0 },
    { "date": "2026-04-02", "expense": 0.0, "income": 0.0 }
  ]
}
```

Incluye todos los días del rango aunque no tengan transacciones. Excluye transferencias.

**GET /dashboard** → `200`

```json
{
  "total_balance": 4870.5,
  "month_expense": 820.5,
  "month_expense_change_pct": 12.3,
  "recent_transactions": [
    {
      "id": "uuid",
      "wallet_id": "uuid",
      "wallet_name": "Nómina",
      "bank_name": "Santander",
      "type": "EXPENSE",
      "amount": 42.3,
      "category": { "id": "uuid", "name": "Comida", "icon": "🍔" },
      "note": "Mercadona",
      "date": "2026-04-18",
      "transfer_id": null,
      "paired_wallet_name": null,
      "created_at": "2026-04-18T10:30:00Z"
    }
  ]
}
```

- `recent_transactions`: últimas 10 del usuario (incluye transferencias: solo pata EXPENSE con `paired_wallet_name`)
- `total_balance`: suma de todos los wallets activos del usuario (usar `calculateUserTotalBalance`)
- `month_expense_change_pct`: positivo = gasta más vs mes anterior; `(actual - anterior) / anterior * 100`

### Checklist de desarrollo

- [x] `src/services/stats.service.ts`
- [x] `src/controllers/stats.controller.ts`
- [x] `src/routes/stats.routes.ts` (con `authenticate`)
- [x] GET /stats: `groupBy(['type'])` para totales + `groupBy(['category_id'])` solo EXPENSE para `by_category`. Filtros `bank_id` resueltos vía `walletIdsForBank` (helper privado) + filtro `wallet_id IN [...]`.
- [x] GET /stats/daily: `groupBy(['date', 'type'])` + generador `eachDayUTC(from, to)` para rellenar días vacíos con 0
- [x] GET /dashboard: combina `calculateUserTotalBalance` + `investmentTotalForUser` (Rama 15) + `totalsForPeriod` mes actual/anterior + `listUserTransactions({limit:10})` con `Promise.all`
- [x] Todas las queries excluyen `transfer_id: null` (es decir, **incluyen solo no-transfer** — la condición es `transfer_id IS NULL`)

### Checklist de tests

**GET /stats**

- [x] 200 con expense, income y by_category correctos
- [x] Transferencias excluidas de los totales
- [x] `previous_period` calculado para el mes anterior
- [x] `expense_change_pct` correcto
- [x] Filtro `?wallet_id=uuid` restringe a un wallet
- [x] Filtro `?bank_id=uuid` restringe a un banco
- [x] 400 con month o year no numérico (validador Zod)
- [x] 401 sin token

**GET /stats/daily**

- [x] 200 con todos los días del rango (incluidos días sin transacciones con 0.0)
- [x] Transferencias excluidas
- [x] 400 si rango > 31 días
- [x] 400 si from > to
- [x] 401 sin token

**GET /dashboard**

- [x] 200 con total_balance correcto (cash + inversión)
- [x] `recent_transactions` máximo 10 items en orden fecha DESC
- [x] Transferencias: solo pata EXPENSE con `paired_wallet_name`
- [x] `month_expense` del mes actual
- [x] 401 sin token

### Commits del PR

```
feat(wallet-service): GET /stats con desglose por categoría + tests
feat(wallet-service): GET /stats/daily con serie temporal + tests
feat(wallet-service): GET /dashboard con balance y recientes + tests
```

### Criterio Done

3 endpoints de stats/dashboard con tests verdes.

---

## Rama 12 — `feature/wallet-service-internal-rabbitmq` ✅ COMPLETADA

> Mergeada a `develop` en PR #62. CI verde.

### Objetivo

Endpoints internos para AI Service + publisher de `transaction.created` (ya usado en Rama 7, aquí se centraliza y consolida) + consumer de `user.deleted`.

### Contratos — Endpoints internos

**GET /internal/transactions** → `200`

Llamado por AI Service para generar insights semanales.

```
Query: user_id (req), from (req, YYYY-MM-DD), to (req, YYYY-MM-DD)
Header: X-Internal-Secret
```

```json
{
  "transactions": [
    {
      "id": "uuid",
      "wallet_id": "uuid",
      "wallet_name": "Nómina",
      "bank_name": "Santander",
      "type": "EXPENSE",
      "amount": 42.3,
      "category": {
        "id": "uuid",
        "name": "Comida",
        "icon": "🍔",
        "type": "EXPENSE"
      },
      "note": "Mercadona",
      "date": "2026-04-18",
      "transfer_id": null,
      "created_at": "2026-04-18T10:30:00Z"
    }
  ]
}
```

Excluye transferencias. Sin paginación (consumo interno acotado por rango de fechas).

**GET /internal/categories** → `200`

Llamado por AI Service para auto-categorización. Cachear en Redis 24h con clave `internal:categories:{user_id}`.

```
Query: user_id (req)
Header: X-Internal-Secret
```

```json
{
  "categories": [
    { "id": "uuid", "name": "Comida", "icon": "🍔", "type": "EXPENSE" }
  ]
}
```

Devuelve predefinidas (user_id=null) + custom del usuario.

### RabbitMQ

**Publisher: `transaction.created`**

Payload (de `api-contracts.md` líneas 826–841):

```json
{
  "event": "transaction.created",
  "timestamp": "2026-04-18T10:30:00Z",
  "data": {
    "user_id": "uuid",
    "transaction_id": "uuid",
    "wallet_id": "uuid",
    "type": "EXPENSE",
    "amount": 42.3,
    "category_id": "uuid",
    "category_name": "Comida",
    "date": "2026-04-18",
    "transfer_id": null
  }
}
```

Solo se publica en `POST /wallets/:id/transactions` (no en `POST /transfers` ni en materialización de recurring). El publisher ya se integró en Rama 7; aquí se consolida en `src/lib/rabbitmq.ts`.

**Consumer: `user.deleted`**

- Queue: `wallet-service.user.deleted` (durable, ack manual)
- Binding: exchange `walletOS.events`, routing key `user.deleted`
- Al consumir: borra en cascada todos los datos del usuario

```
prisma.$transaction([
  deleteMany categories  WHERE user_id = data.user_id
  deleteMany banks       WHERE user_id = data.user_id  → cascades wallets → transactions
])
```

El `deleteMany banks` elimina por cascada sus wallets y transacciones. Las categorías custom se borran explícitamente.

### Checklist de desarrollo

- [x] `src/routes/internal.routes.ts` con `internalAuth` en todos los endpoints
- [x] Cache Redis para GET /internal/categories: `SET ... EX 86400` con clave `internal:categories:{user_id}`; invalidación automática (`invalidateUserCategoriesCache`) llamada al final de `createCategory`/`updateCategory`/`deleteCategory` en `category.service.ts`
- [x] Consumer de `user.deleted` registrado en `src/server.ts` al arrancar (`startUserDeletedConsumer`)
- [x] Helper genérico `subscribe(queueName, routingKey, handler)` en `lib/rabbitmq.ts` con ack manual: `ack(msg)` tras éxito, `nack(msg, false, false)` (sin requeue) si el handler tira → evita loops infinitos con payloads inválidos
- [x] Publisher consolidado en `lib/events.ts::publishTransactionCreated(data)`. Construye el payload canónico `{event, timestamp, data}` definido en `api-contracts.md`. Reemplaza los dos callsites duplicados (`transaction.service.ts::createTransaction` y `recurring.job.ts::runRecurringJob`)

### Checklist de tests

**GET /internal/transactions**

- [x] 200 con transacciones del usuario en el rango
- [x] Transferencias excluidas
- [x] 400 sin user_id, from o to
- [x] 401 sin X-Internal-Secret
- [x] 401 con secret incorrecto
- [x] No incluye transacciones de otros users

**GET /internal/categories**

- [x] 200 devuelve predefinidas + custom del usuario
- [x] Cache poblado en Redis tras primer GET
- [x] Segunda llamada sirve cache (cambios DB no aparecen)
- [x] Invalidación tras POST de categoría vía API
- [x] 401 sin X-Internal-Secret

**user.deleted consumer**

- [x] Al consumir evento: bancos, wallets, transacciones, recurring y categorías custom del usuario eliminados
- [x] Datos de otros usuarios no afectados
- [x] Cache Redis invalidada para el user borrado
- [x] Throws con payload inválido (validación defensiva)

### Commits del PR

```
feat(wallet-service): GET /internal/transactions + tests
feat(wallet-service): GET /internal/categories con cache redis + tests
feat(wallet-service): rabbitmq publisher — transaction.created
feat(wallet-service): rabbitmq consumer — user.deleted con borrado en cascada + tests
```

### Criterio Done

2 endpoints internos con tests verdes. Consumer procesa `user.deleted` correctamente.

---

## Rama 13 — `feature/wallet-service-docker-prod` ✅ COMPLETADA

> Mergeada a `develop` en PR #63. CI verde. Hotfix paralelo en user-service: PR #64.

### Objetivo

Imagen Docker de producción optimizada, sin código de desarrollo y con usuario no-root.

### Checklist de desarrollo

- [x] `Dockerfile` multi-stage:
  - Stage `builder`: `node:20-alpine`, instala todas las deps, compila TypeScript → `dist/`, genera Prisma Client
  - Stage `runner`: `node:20-alpine`, instala solo deps de producción (`npm ci --omit=dev`), regenera Prisma Client en runtime para que coincida con la arquitectura de la imagen, copia `dist/` del builder, añade `curl` para el healthcheck
  - Usuario no-root: `addgroup -S app && adduser -S app -G app && USER app`
  - `HEALTHCHECK CMD curl --fail http://localhost:$PORT/health || exit 1`
- [x] `tsconfig.build.json` con `module: CommonJS` + `moduleResolution: Node` — necesario porque el `tsconfig.json` principal usa ESM (`ESNext`/`bundler`) para `tsx`/`vitest`, pero Node 20 no ejecuta el output ESM sin extensiones `.js` explícitas. Build compila a CommonJS, dev/test siguen en ESM.
- [x] `.dockerignore`: solo `node_modules/`, `dist/`, `coverage/`, `.env*`, `.git/`, `.github/`. El `Dockerfile` usa COPY granular (`COPY tsconfig*.json ./`, `COPY src ./src/`), por lo que **NO** se puede ignorar `src/` ni `tsconfig*.json` (rompería el build con `error: cache key … "/src": not found`).
- [x] Verificar que la imagen final no incluye devDependencies

### Checklist de tests

- [x] `docker build -t wallet-service:prod .` exitoso
- [x] `docker run` con env vars contra `infra_walletos-net` → health check responde `{"status":"ok","service":"wallet-service"}` con 200
- [x] `docker inspect` confirma usuario no-root (`Config.User: "app"`)

### Commits del PR

```
feat(wallet-service): Dockerfile prod multi-stage con usuario no-root
```

---

## Rama 14 — `feature/wallet-service-investment-transactions` ✅ COMPLETADA

> Mergeada a `develop` en PR #65. CI verde.

### Objetivo

Registrar operaciones bursátiles (compras, ventas, dividendos) en wallets de tipo INVESTMENT.

### Checklist de desarrollo

- [x] Añadir tabla `investment_transactions` al schema de Prisma:

```prisma
enum InvestmentTransactionType {
  BUY
  SELL
  DIVIDEND
}

model InvestmentTransaction {
  id              String                    @id @default(uuid()) @db.Uuid
  wallet_id       String                    @db.Uuid
  user_id         String                    @db.Uuid
  ticker          String                    @db.VarChar(20)
  asset_name      String                    @db.VarChar(100)
  type            InvestmentTransactionType
  shares          Decimal                   @db.Decimal(18, 8)
  price_per_share Decimal                   @db.Decimal(12, 4)
  total_amount    Decimal                   @db.Decimal(12, 2)
  currency        String                    @default("EUR") @db.VarChar(3)
  note            String?                   @db.VarChar(500)
  date            DateTime                  @db.Date
  created_at      DateTime                  @default(now())
  updated_at      DateTime                  @updatedAt
  wallet          Wallet                    @relation(fields: [wallet_id], references: [id], onDelete: Cascade)

  @@index([wallet_id])
  @@index([user_id])
  @@index([ticker])
  @@index([date(sort: Desc)])
  @@map("investment_transactions")
}
```

- [x] Añadir relación `investment_transactions InvestmentTransaction[]` al modelo `Wallet`
- [x] Migración Prisma `20260530170034_investment_transactions`
- [x] `src/services/investment-transaction.service.ts`
- [x] `src/controllers/investment-transaction.controller.ts`
- [x] `src/routes/investment-transaction.routes.ts` (todas con `authenticate`)
- [x] `src/validators/investment-transaction.validators.ts`
- [x] Verificar que el wallet es de tipo `INVESTMENT` antes de crear/listar — 400 si es `CASH` (helper `loadInvestmentWallet`)

### Contratos

**POST /wallets/:id/investment-transactions** → `201`

```json
Request: {
  "ticker": "VWCE",
  "asset_name": "Vanguard FTSE All-World ETF",
  "type": "BUY",
  "shares": 10,
  "price_per_share": 87.50,
  "currency": "EUR",
  "note?": "Primera compra",
  "date?": "2026-01-15"
}
Response: { "id": "uuid", "wallet_id": "uuid", "ticker": "VWCE", "asset_name": "...", "type": "BUY", "shares": "10", "price_per_share": "87.50", "total_amount": "875.00", "currency": "EUR", "note": "Primera compra", "date": "2026-01-15", "created_at": "..." }
```

- `total_amount` = `shares × price_per_share` (calculado en servidor)
- 400 si `shares <= 0` o `price_per_share <= 0`
- 400 si el wallet es de tipo `CASH`
- 404 si el wallet no existe o no pertenece al usuario

**GET /wallets/:id/investment-transactions** → `200`

```
Query: cursor?, limit? (default 20), ticker?, type?, from?, to?
Orden: date DESC, created_at DESC
```

```json
{ "transactions": [...], "next_cursor": "uuid-or-null" }
```

**DELETE /investment-transactions/:id** → `204`

Hard delete. 404 si no existe o de otro usuario.

### Checklist de tests

**POST /wallets/:id/investment-transactions**

- [x] 201 crea operación BUY con `total_amount` calculado correctamente
- [x] 201 crea operación SELL
- [x] 201 crea operación DIVIDEND
- [x] Default date = hoy cuando no se envía
- [x] 400 si `shares <= 0`
- [x] 400 si el wallet es de tipo CASH
- [x] 404 con wallet inexistente o de otro usuario
- [x] 401 sin token

**GET /wallets/:id/investment-transactions**

- [x] 200 lista operaciones en orden date DESC
- [x] Paginación cursor correcta
- [x] Filtro `?ticker=VWCE`
- [x] Filtro `?type=BUY`
- [x] 400 si el wallet es de tipo CASH
- [x] 404 con wallet inexistente o de otro usuario
- [x] 401 sin token

**DELETE /investment-transactions/:id**

- [x] 204, operación eliminada
- [x] 404 con id inexistente
- [x] 401 sin token

### Commits del PR

```
feat(wallet-service): investment_transactions schema + migración
feat(wallet-service): POST /wallets/:id/investment-transactions + tests
feat(wallet-service): GET /wallets/:id/investment-transactions con cursor + tests
feat(wallet-service): DELETE /investment-transactions/:id + tests
```

### Criterio Done

3 endpoints con tests de integración verdes.

---

## Rama 15 — `feature/wallet-service-portfolio` ✅ COMPLETADA

> Mergeada a `develop` en PR #66. CI verde.

### Objetivo

Calcular posiciones en tiempo real desde el historial de operaciones y servir precios actuales de TwelveData con cache.

### Checklist de desarrollo

- [x] Añadir tabla `price_cache` al schema de Prisma (migración `20260530172701_price_cache`):

```prisma
model PriceCache {
  ticker       String   @id @db.VarChar(20)
  price        Decimal  @db.Decimal(12, 4)
  currency     String   @db.VarChar(3)
  market_open  Boolean
  last_updated DateTime

  @@map("price_cache")
}
```

- [x] `src/lib/twelvedata.ts`:
  - `fetchPrice(ticker: string): Promise<Quote>` — llama a `GET https://api.twelvedata.com/quote?symbol={ticker}&apikey={TWELVE_DATA_API_KEY}` via `globalThis.fetch`. Lanza `NotFoundError` si TwelveData responde con `status: 'error'` o HTTP no-2xx
  - `getOrRefreshPrice(ticker)`: lee `price_cache`; si TTL expirado (**30 min** si `market_open`, 24h si cerrado) llama a `fetchPrice` y `upsert` en cache; devuelve `CachedPrice`. TTL elegido para encajar **50 tickers únicos en los 800 credits/día del free tier** (`30 min × 16 ciclos × 50 tickers = 800`). La cache es compartida por `ticker`, por lo que escala a cualquier número de usuarios siempre que la base de ETFs únicos esté acotada. La UI debe mostrar sello "actualizado hace X min" — es app de monitorización de cartera, no day-trading.
- [x] `src/services/portfolio.service.ts`:
  - `getPortfolio(userId, walletId)`: agrupa `investment_transactions` por ticker → `shares = Σ BUY − Σ SELL`, `avg_cost = Σ BUY.total_amount / Σ BUY.shares` (DIVIDEND no afecta shares ni avg_cost). Para cada posición con `shares > 0` llama a `getOrRefreshPrice(ticker)` **una sola vez por ticker** (no por transacción)
- [x] `src/controllers/portfolio.controller.ts`
- [x] `src/routes/portfolio.routes.ts` (con `authenticate`)
- [x] Añadir `TWELVE_DATA_API_KEY` a `src/config/env.ts` y `.env.example`
- [x] Actualizar `GET /dashboard` (introducido en Rama 11): `total_balance` += `total_value` de wallets INVESTMENT del usuario (helper privado `investmentTotalForUser` en `stats.service.ts` que delega en `portfolioService.getPortfolio`)

### Contrato — `GET /wallets/:id/portfolio` → `200`

```json
{
  "positions": [
    {
      "ticker": "VWCE",
      "asset_name": "Vanguard FTSE All-World ETF",
      "shares": "12.5",
      "avg_cost_per_share": "89.23",
      "current_price": "94.87",
      "currency": "EUR",
      "market_open": true,
      "value": "1185.87",
      "cost": "1115.37",
      "gain": "70.50",
      "gain_pct": "6.31"
    }
  ],
  "total_value": "1185.87",
  "total_cost": "1115.37",
  "total_gain": "70.50",
  "total_gain_pct": "6.31",
  "last_updated": "2026-05-13T10:30:00Z"
}
```

- Tickers con `shares = 0` (posición cerrada) no se incluyen en la respuesta
- 400 si el wallet es de tipo `CASH`
- 404 si el wallet no existe o no pertenece al usuario

### Checklist de tests

**GET /wallets/:id/portfolio**

- [x] 200 con posiciones calculadas correctamente tras BUY
- [x] SELL reduce shares; posición con shares=0 desaparece
- [x] DIVIDEND no afecta shares ni avg_cost
- [x] `gain` y `gain_pct` calculados correctamente
- [x] Una sola llamada a `getOrRefreshPrice` por ticker distinto (no por transacción) — mock verificado
- [x] 400 si el wallet es de tipo CASH
- [x] 404 con wallet inexistente o de otro usuario
- [x] 401 sin token

**price_cache (unit tests en `twelvedata.test.ts`)**

- [x] Cache actualizada en DB tras primera llamada
- [x] TTL 30 min respetado cuando `market_open = true` (test con age 10 min sirve cache, age 31 min refresca)
- [x] TTL 24h respetado cuando `market_open = false` (test con age 6h sirve cache, age 25h refresca)
- [x] `fetchPrice` lanza `NotFoundError` con `status:error` y con HTTP no-2xx

**GET /dashboard** (regresión)

- [x] `total_balance` incluye `total_value` de wallets INVESTMENT activos

### Commits del PR

```
feat(wallet-service): price_cache schema + migración
feat(wallet-service): lib/twelvedata.ts — fetch con cache ttl
feat(wallet-service): GET /wallets/:id/portfolio con posiciones calculadas + tests
feat(wallet-service): dashboard — total_balance incluye carteras de inversión
```

### Criterio Done

`GET /wallets/:id/portfolio` devuelve posiciones con precio en tiempo real. Tests con mock de TwelveData verdes. Cache validada.

---

## Integración con la infra

### Bloque a añadir en `infra/docker-compose.yml`

```yaml
wallet-service:
  build:
    context: ../services/wallet-service
    dockerfile: Dockerfile.dev
  ports:
    - "3002:3002"
  volumes:
    - ../services/wallet-service/src:/app/src
  env_file:
    - ../services/wallet-service/.env
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

### Variables de entorno (`services/wallet-service/.env`)

```env
DATABASE_URL=postgresql://walletos:secret@postgres:5432/walletos_wallets
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://walletos:secret@rabbitmq:5672
JWT_SECRET=<mismo que user-service, min 32 chars>
INTERNAL_SECRET=<mismo que user-service, min 32 chars>
TWELVE_DATA_API_KEY=<api key de TwelveData — añadir en Rama 15>
PORT=3002
NODE_ENV=development
```

### CI (`.github/workflows/ci.yml`)

El workflow ya cubre `wallet-service` en la matrix. Al añadir código:

- `npm run lint` — ESLint sin warnings
- `npm test` — Vitest con DB, Redis y RabbitMQ reales configurados en CI

---

## Criterio "Done" de la Fase 6 ✅

- [x] 21 endpoints públicos (CASH) implementados con tests pasando
- [x] 3 endpoints de inversión implementados con tests pasando (Ramas 14–15)
- [x] 2 endpoints internos implementados con tests pasando (`/internal/transactions`, `/internal/categories`)
- [x] `npm test` verde — **237 tests** pasando (unitarios + integración)
- [x] `npm run lint` y `npm run typecheck` sin errores
- [x] `docker compose up wallet-service` arranca sin errores
- [x] `curl localhost:3002/health` → `{ "status": "ok", "service": "wallet-service" }`
- [x] Seed de 14 categorías ejecutado al arrancar
- [x] Flujo manual CASH: crear banco → crear wallet → crear transacción → GET /dashboard → GET /stats
- [x] Transferencia atómica verificada: balances correctos antes y después
- [x] Flujo manual INVESTMENT: crear wallet tipo INVESTMENT → registrar BUY → GET /portfolio con precio en tiempo real (TwelveData)
- [x] `price_cache` actualizada en DB; segunda llamada dentro del TTL no llama a TwelveData
- [x] `transaction.created` publicado en RabbitMQ al crear transacción
- [x] Consumer `user.deleted` elimina todos los datos del usuario en cascada
- [x] Cron de recurring materializa transacciones pendientes correctamente
- [x] CI verde en todos los PRs a `develop`
- [x] PR final `develop` → `main` con todos los checks verdes (PR #67 mergeado 2026-05-30)
- [x] Checklist de Fase 6 en `ROADMAP.md` completamente marcado

---

## Archivos críticos a modificar / crear

| Archivo                                         | Acción                                |
| ----------------------------------------------- | ------------------------------------- |
| `services/wallet-service/package.json`          | Crear (Rama 1)                        |
| `services/wallet-service/tsconfig.json`         | Crear (Rama 1)                        |
| `services/wallet-service/Dockerfile.dev`        | Crear (Rama 1)                        |
| `services/wallet-service/Dockerfile`            | Crear (Rama 13)                       |
| `services/wallet-service/prisma/schema.prisma`  | Crear (Rama 2)                        |
| `services/wallet-service/prisma/seed.ts`        | Crear (Rama 3)                        |
| `services/wallet-service/src/**`                | Crear (Ramas 1-15)                    |
| `services/wallet-service/src/lib/twelvedata.ts` | Crear (Rama 15)                       |
| `infra/docker-compose.yml`                      | Añadir bloque wallet-service (Rama 1) |
| `lint-staged.config.mjs`                        | Añadir regla wallet-service (Rama 1)  |
| `ROADMAP.md`                                    | Marcar checklist Fase 6 (al terminar) |

## Patrones reutilizados de user-service

| Patrón                    | Ubicación en user-service                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `authenticate` middleware | `src/middleware/authenticate.ts` — misma lógica, JWT_SECRET compartido |
| `internalAuth` middleware | `src/middleware/internalAuth.ts` — mismo patrón                        |
| `errorHandler` + clases   | `src/middleware/errorHandler.ts` — copiar y adaptar                    |
| `rateLimiter`             | `src/middleware/rateLimiter.ts` — misma factory                        |
| `rabbitmq.ts` publisher   | `src/lib/rabbitmq.ts` — misma lógica de reintentos                     |
| `env.ts` con Zod          | `src/config/env.ts` — mismo patrón de parse                            |
| App factory (`app.ts`)    | `src/app.ts` — mismo patrón Express                                    |
| Vitest + supertest        | `vitest.config.ts`, `src/test/setup.ts` — mismo setup                  |
