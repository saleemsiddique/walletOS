# WalletOS — Contratos de API y eventos RabbitMQ

## Convenciones

| Concepto      | Convención                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Base URL      | `https://{domain}/api`                                                                                     |
| Auth          | `Authorization: Bearer {access_token}` (JWT HS256, exp 15min)                                              |
| Refresh token | Opaco, hasheado en DB, exp 30 días, rotación en cada uso                                                   |
| Content-Type  | `application/json`                                                                                         |
| Paginación    | cursor-based: `?cursor={last_id}&limit=20` (max 50). Response incluye `next_cursor` (null = última página) |
| Fechas        | `YYYY-MM-DD` (dates), `YYYY-MM-DDTHH:mm:ssZ` (timestamps)                                                  |
| Montos        | number, 2 decimales, siempre positivos                                                                     |
| IDs           | UUID v4                                                                                                    |
| Internos      | Prefijo `/internal/`, solo red Docker, sin JWT                                                             |

### Endpoints internos — `X-Internal-Secret`

Todos los endpoints `/internal/*` requieren la cabecera:

```
X-Internal-Secret: {shared_secret}
```

El secret es una env var compartida por los 4 servicios (`INTERNAL_SECRET`). Un middleware lo valida y responde `401` si falta o no coincide. Nginx no enruta `/internal/*` — solo son accesibles desde dentro de la red Docker.

### Errores

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": [{ "field": "amount", "message": "..." }]
  }
}
```

Códigos: 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT, 429 RATE_LIMITED, 500 INTERNAL_ERROR

---

## User Service — :8001 (`/api/users/`, `/api/auth/`)

### POST `/register`

```json
// Request
{ "email": "user@email.com", "password": "min8chars", "name": "Saleem", "timezone?": "Europe/Madrid", "default_currency?": "EUR" }

// Response 201
{
  "user": {
    "id": "uuid", "email": "user@email.com", "name": "Saleem",
    "timezone": "Europe/Madrid", "default_currency": "EUR",
    "reminder_enabled": true, "high_spend_enabled": false, "high_spend_threshold": 100.00,
    "created_at": "2026-04-18T10:30:00Z"
  },
  "access_token": "eyJ...",
  "refresh_token": "dGhp..."
}
```

Defaults: timezone=`UTC`, default_currency=`EUR`. Publica `user.registered`.

### POST `/login`

```json
// Request
{ "email": "user@email.com", "password": "min8chars" }

// Response 200 — mismo shape que register
```

### POST `/apple`

```json
// Request
{ "identity_token": "eyJraWQi...", "name?": "Saleem" }

// Response 200 — mismo shape que register
```

Verifica `identity_token` contra las JWKs de Apple. Si `apple_id` no existe, crea usuario (name obligatorio la primera vez). Publica `user.registered` si es nuevo.

### POST `/google`

```json
// Request
{ "id_token": "eyJhbGci...", "name?": "Saleem" }

// Response 200 — mismo shape que register
```

Verifica `id_token` con la librería oficial de Google (`google-auth-library`). Si `google_id` no existe, crea usuario (name obligatorio la primera vez, o se toma del token). Publica `user.registered` si es nuevo.

### POST `/refresh`

```json
// Request
{ "refresh_token": "dGhp..." }

// Response 200
{ "access_token": "eyJ...", "refresh_token": "bmV3..." }
```

Rota el refresh token. El anterior va a blacklist en Redis (`blacklist:{token_hash}`, TTL = tiempo restante).

### POST `/logout`

```json
// Request
{ "refresh_token": "dGhp..." }

// Response 204
```

### POST `/auth/forgot-password`

```json
// Request
{ "email": "user@email.com" }

// Response 204
```

Genera un token aleatorio (UUID + hash), guarda el hash en `password_reset_tokens` con TTL 1h y envía un email vía Resend con el link `walletos://reset?token={token_plano}`. Responde siempre 204, exista o no el email (no revela).

### POST `/auth/reset-password`

```json
// Request
{ "token": "plain_token_from_email", "new_password": "min8chars" }

// Response 204
```

Valida el token (busca su hash en `password_reset_tokens`, verifica `expires_at > NOW()` y `used_at IS NULL`). Actualiza `password_hash`, marca el token como `used_at = NOW()` e invalida todos los `refresh_tokens` del usuario.

### GET `/me`

```json
// Response 200
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
  "created_at": "2026-04-18T10:30:00Z"
}
```

`has_password`, `apple_linked`, `google_linked` permiten a la UI saber qué métodos de auth tiene el usuario.

### PATCH `/me`

```json
// Request (todos opcionales)
{
  "name?": "Saleem S.",
  "timezone?": "America/New_York",
  "default_currency?": "USD",
  "reminder_enabled?": false,
  "high_spend_enabled?": true,
  "high_spend_threshold?": 200.0
}

// Response 200 — mismo shape que GET /me
```

Publica `user.updated` si cambian: timezone, reminder_enabled, high_spend_enabled, high_spend_threshold.

### DELETE `/me`

```
Response 204
```

Publica `user.deleted { user_id }` y borra el registro de `users` (cascada a `refresh_tokens` y `password_reset_tokens`). Los otros servicios consumen el evento para limpiar sus datos.

### GET `/internal/users`

Para reminder job del Notification Service.

```
Query: timezone (required), reminder_enabled=true
```

```json
// Response 200
{
  "users": [
    { "id": "uuid", "timezone": "Europe/Madrid", "reminder_enabled": true }
  ]
}
```

### GET `/internal/users/:id`

Para evaluar alerta de gasto alto.

```json
// Response 200
{
  "id": "uuid",
  "timezone": "Europe/Madrid",
  "reminder_enabled": true,
  "high_spend_enabled": true,
  "high_spend_threshold": 100.0
}
```

---

## Wallet Service — :8002

Nginx: `/api/dashboard/`, `/api/banks/`, `/api/wallets/`, `/api/transactions/`, `/api/transfers/`, `/api/categories/`, `/api/stats/`

### GET `/dashboard`

Datos del Home en una sola llamada.

```json
// Response 200
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

- `recent_transactions`: últimas 10
- `month_expense_change_pct`: positivo = gasta más vs mes anterior
- Transferencias: solo pata EXPENSE con `paired_wallet_name` del destino

### POST `/banks`

```json
// Request
{ "name": "Santander", "icon?": "🏦", "color?": "#E31837" }

// Response 201
{ "id": "uuid", "name": "Santander", "icon": "🏦", "color": "#E31837", "is_archived": false, "created_at": "...", "updated_at": "..." }
```

Defaults: icon=`🏦`, color=`#007AFF`.

### GET `/banks`

Pantalla Cuentas. Solo no archivados. Balances calculados en query.

```json
// Response 200
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

### PATCH `/banks/:id`

```json
// Request (todos opcionales)
{ "name?": "Banco Santander", "icon?": "🏛", "color?": "#CC0000" }

// Response 200 — banco sin wallets
```

### DELETE `/banks/:id`

Soft delete. Archiva banco + todos sus wallets. Las transacciones se conservan.

```json
// Response 200
{ "id": "uuid", "name": "Santander", "is_archived": true, "updated_at": "..." }
```

### POST `/banks/:id/wallets`

```json
// Request
{ "name": "Ahorro", "initial_balance?": 1200.00, "icon?": "💰", "color?": "#34C759" }

// Response 201
{ "id": "uuid", "bank_id": "uuid", "name": "Ahorro", "icon": "💰", "color": "#34C759", "balance": 1200.00, "is_archived": false, "created_at": "...", "updated_at": "..." }
```

Defaults: initial_balance=`0.00`, icon=`💳`, color=`#007AFF`.

### GET `/banks/:id/wallets`

```json
// Response 200
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

### PATCH `/wallets/:id`

```json
// Request (todos opcionales)
{ "name?": "Cuenta ahorro", "icon?": "🏦", "color?": "#FF9500" }

// Response 200 — wallet con balance
```

No se puede cambiar `initial_balance` ni `bank_id` después de creado.

### DELETE `/wallets/:id`

Soft delete. Las transacciones se conservan.

```json
// Response 200
{ "id": "uuid", "name": "Ahorro", "is_archived": true, "updated_at": "..." }
```

### POST `/wallets/:id/transactions`

```json
// Request
{ "id?": "uuid", "type": "EXPENSE", "amount": 42.30, "category_id": "uuid", "note?": "Mercadona", "date?": "2026-04-18" }

// Response 201
{
  "id": "uuid", "wallet_id": "uuid", "wallet_name": "Nómina", "bank_name": "Santander",
  "type": "EXPENSE", "amount": 42.30,
  "category": { "id": "uuid", "name": "Comida", "icon": "🍔" },
  "note": "Mercadona", "date": "2026-04-18",
  "transfer_id": null, "paired_wallet_name": null,
  "created_at": "2026-04-18T10:30:00Z"
}
```

type=`INCOME|EXPENSE`, amount > 0, category_id debe coincidir en type. Default date=hoy. El campo `id?` es opcional y permite al cliente iOS enviar su UUID generado offline (si se omite, lo genera el servidor). Publica `transaction.created`.

### GET `/wallets/:id/transactions`

```
Query: cursor?, limit? (20), from?, to?, category_id?
Orden: date DESC, created_at DESC
```

```json
// Response 200
{ "transactions": [{ ...shape de transacción... }], "next_cursor": "uuid-or-null" }
```

Incluye transferencias con ambas patas y `paired_wallet_name`.

### GET `/transactions`

Cross-wallet. Para Home "ver más".

```
Query: cursor?, limit? (20), from?, to?, category_id?, wallet_id?, type?
```

```json
// Response 200 — mismo shape que anterior
```

Transferencias: solo pata EXPENSE (iOS muestra como fila única).

### PATCH `/transactions/:id`

```json
// Request (todos opcionales)
{
  "type?": "INCOME",
  "amount?": 50.0,
  "category_id?": "uuid",
  "note?": "Corregido",
  "date?": "2026-04-17",
  "wallet_id?": "uuid"
}

// Response 200 — transacción actualizada
```

No se puede editar transacciones con `transfer_id != NULL` (borrar y recrear).

### DELETE `/transactions/:id`

```
Response 204
```

Hard delete. Si tiene `transfer_id`, borra ambas transacciones del par (atómico).

### POST `/transfers`

```json
// Request
{ "from_wallet_id": "uuid", "to_wallet_id": "uuid", "amount": 500.00, "note?": "Ahorro mensual", "date?": "2026-04-18" }

// Response 201
{
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

Operación atómica (transacción SQL). Sin categoría. **No publica evento.** No afecta balance total. Se excluyen de stats.

### GET `/categories`

```
Query: type? (INCOME|EXPENSE)
```

```json
// Response 200
{
  "categories": [
    {
      "id": "uuid",
      "name": "Comida",
      "icon": "🍔",
      "type": "EXPENSE",
      "is_custom": false
    },
    {
      "id": "uuid",
      "name": "Gimnasio",
      "icon": "💪",
      "type": "EXPENSE",
      "is_custom": true
    }
  ]
}
```

`is_custom` = `user_id != NULL`. Orden: predefinidas primero, luego custom. Sin paginación.

### POST `/categories`

```json
// Request
{ "name": "Gimnasio", "icon": "💪", "type": "EXPENSE" }

// Response 201
{ "id": "uuid", "name": "Gimnasio", "icon": "💪", "type": "EXPENSE", "is_custom": true }
```

Name unique por usuario + type (constraint `UNIQUE NULLS NOT DISTINCT (user_id, name, type)` en DB; devuelve 409 si colisiona).

### PATCH `/categories/:id`

```json
// Request (todos opcionales)
{ "name?": "Gym", "icon?": "🏋️" }

// Response 200 — categoría actualizada
```

Solo custom. 403 si es predefinida.

### DELETE `/categories/:id`

```
Response 204
```

Solo custom. Reasigna transacciones a "Otros" del mismo type (atómico). 403 si es predefinida.

### GET `/stats`

Pantalla Estadísticas.

```
Query: month (1-12), year, bank_id?, wallet_id?
```

```json
// Response 200
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

Excluye transferencias. `by_category` ordenado por total DESC.

### GET `/stats/daily`

Gráfico de barras.

```
Query: from, to (max 31 días), bank_id?, wallet_id?
```

```json
// Response 200
{
  "days": [
    { "date": "2026-04-01", "expense": 45.3, "income": 0.0 },
    { "date": "2026-04-02", "expense": 0.0, "income": 0.0 }
  ]
}
```

Incluye días sin transacciones. Excluye transferencias.

### GET `/internal/transactions`

Para AI Service (insights semanales).

```
Query: user_id (req), from (req), to (req)
```

```json
// Response 200
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

### GET `/internal/categories`

Para AI Service (auto-categorización). Cache Redis 24h.

```
Query: user_id (req)
```

```json
// Response 200
{
  "categories": [
    { "id": "uuid", "name": "Comida", "icon": "🍔", "type": "EXPENSE" }
  ]
}
```

---

## AI Service — :8003 (`/api/ai/`)

### GET `/insights`

```
Query: cursor?, limit? (20)
Orden: week_start DESC
```

```json
// Response 200
{
  "insights": [
    {
      "id": "uuid",
      "week_start": "2026-04-14",
      "summary_text": "Esta semana gastaste 210€...",
      "has_pdf": true,
      "created_at": "2026-04-21T06:00:00Z"
    }
  ],
  "next_cursor": "uuid-or-null"
}
```

### GET `/insights/{week_start}`

Param: fecha del lunes (YYYY-MM-DD).

```json
// Response 200
{
  "id": "uuid",
  "week_start": "2026-04-14",
  "summary_text": "Esta semana gastaste 210€...",
  "has_pdf": true,
  "created_at": "2026-04-21T06:00:00Z"
}
```

### POST `/insights/generate`

Body vacío. Genera para la última semana completa. Si ya existe, regenera (UPDATE). Si el usuario no tuvo transacciones esa semana, responde `204` sin generar.

```json
// Response 201
{
  "id": "uuid",
  "week_start": "2026-04-14",
  "summary_text": "...",
  "has_pdf": true,
  "created_at": "..."
}
```

**Flujo interno:**

1. `GET wallet-service:8002/internal/transactions?user_id={id}&from={lunes}&to={domingo}` (con `X-Internal-Secret`)
2. Prompt OpenAI con transacciones agrupadas + comparativa semana anterior
3. Renderiza PDF → sube a S3 `walletos-exports-{env}/{user_id}/{week_start}.pdf`
4. Guarda en DB
5. Publica `insight.generated`

### GET `/insights/{week_start}/export`

```json
// Response 200
{
  "url": "https://s3.../walletos-exports-.../uuid/2026-04-14.pdf?signature=...",
  "expires_in": 3600
}
```

URL firmada S3, TTL 1 hora. Si PDF no existe, genera y sube primero.

### POST `/categorize`

```json
// Request
{ "note": "Mercadona semanal", "type": "EXPENSE" }

// Response 200
{ "category_id": "uuid", "category_name": "Comida", "category_icon": "🍔", "confidence": 0.92 }

// Si confidence < 0.5
{ "category_id": null, "category_name": null, "category_icon": null, "confidence": 0.31 }
```

Cache: `cat:user:{user_id}:categories` (TTL 24h) para categorías, `cat:{hash(note+type+user_id)}` (TTL 24h) para resultados. iOS llama con debounce 500ms.

---

## Notification Service — :8004 (`/api/notifs/`)

### POST `/tokens`

```json
// Request
{ "token": "a1b2c3d4e5f6...", "platform?": "ios" }

// Response 201
{ "id": "uuid", "token": "a1b2c3d4e5f6...", "platform": "ios", "created_at": "..." }
```

Upsert: si token ya existe, no duplica. Si existe para otro usuario, actualiza user_id.

### DELETE `/tokens/:token`

```
Response 204
```

---

## Eventos RabbitMQ

Exchange: `walletOS.events` (topic, durable). Queues: una por consumidor, durable, ack manual.

### 1. `user.registered`

Publisher: User Service. Consumidores: ninguno activo (extensibilidad).

```json
{
  "event": "user.registered",
  "timestamp": "2026-04-18T10:30:00Z",
  "data": {
    "user_id": "uuid",
    "email": "user@email.com",
    "name": "Saleem",
    "timezone": "Europe/Madrid",
    "default_currency": "EUR"
  }
}
```

### 2. `user.updated`

Publisher: User Service (PATCH /me). Consumidores: ninguno activo. Solo se publica si cambian: timezone, reminder_enabled, high_spend_enabled, high_spend_threshold.

```json
{
  "event": "user.updated",
  "timestamp": "2026-04-18T12:00:00Z",
  "data": {
    "user_id": "uuid",
    "changed_fields": {
      "timezone": "America/New_York",
      "high_spend_threshold": 200.0
    }
  }
}
```

### 3. `user.deleted`

Publisher: User Service (DELETE /me). Consumidores: Wallet Service, AI Service, Notification Service.

```json
{
  "event": "user.deleted",
  "timestamp": "2026-04-18T15:30:00Z",
  "data": { "user_id": "uuid" }
}
```

**Lógica de los consumidores:**

- Wallet Service: borra bancos, wallets, transacciones y categorías custom del usuario.
- AI Service: borra `weekly_insights` del usuario y todos los objetos S3 bajo `walletos-exports-{env}/{user_id}/`.
- Notification Service: borra todos los `device_tokens` del usuario.

### 4. `transaction.created`

Publisher: Wallet Service (POST /wallets/:id/transactions). Consumidor: Notification Service.

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

**Lógica del consumidor:**

1. Set Redis `activity:{user_id}:{date}` TTL 26h (suprime recordatorio)
2. Si `type == EXPENSE` → `GET /internal/users/{user_id}` → si `high_spend_enabled && amount >= threshold` → push "Has registrado un gasto de {amount}€ en {category_name}"

### 5. `insight.generated`

Publisher: AI Service. Consumidor: Notification Service.

```json
{
  "event": "insight.generated",
  "timestamp": "2026-04-21T06:00:00Z",
  "data": {
    "user_id": "uuid",
    "insight_id": "uuid",
    "week_start": "2026-04-14"
  }
}
```

Push: "Tu resumen semanal está listo"

---

## Recordatorio diario

Scheduled job en Notification Service (cada hora, `node-cron`):

1. Calcular qué timezones tienen las 21:00 ahora (ventana ±30 min para cubrir desplazamientos no enteros)
2. `GET /internal/users?timezone={tz}&reminder_enabled=true`
3. Para cada usuario:
   - `EXISTS activity:{user_id}:{today}` → skip
   - `EXISTS notif:{user_id}:{today}:reminder` → skip
   - Enviar push: "¿Has anotado tus gastos de hoy?"
   - `SET notif:{user_id}:{today}:reminder` TTL 2h

---

## Comunicación entre servicios

```
iOS → Nginx → User Service / Wallet Service / AI Service / Notification Service

RabbitMQ (walletOS.events):
  User Service    → user.registered, user.updated     → (sin consumidores activos)
  User Service    → user.deleted                       → Wallet, AI, Notification
  Wallet Service  → transaction.created               → Notification Service
  AI Service      → insight.generated                  → Notification Service

HTTP interno (red Docker, con X-Internal-Secret):
  AI Service           → Wallet Service   (GET /internal/transactions, /internal/categories)
  Notification Service → User Service     (GET /internal/users, /internal/users/:id)
```

## Conteo

| Servicio             | Públicos | Internos | Eventos publicados |
| -------------------- | -------- | -------- | ------------------ |
| User Service         | 11       | 2        | 3                  |
| Wallet Service       | 21       | 2        | 1                  |
| AI Service           | 5        | 0        | 1                  |
| Notification Service | 2        | 0        | 0                  |
| **Total**            | **39**   | **4**    | **5**              |
