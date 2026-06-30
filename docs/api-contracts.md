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

## User Service — :3001

Nginx: `/api/register`, `/api/login`, `/api/apple`, `/api/google`, `/api/refresh`, `/api/logout`, `/api/auth/`, `/api/me`

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

Defaults: timezone=`UTC`, default_currency=`EUR`.

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

Verifica `identity_token` contra las JWKs de Apple. Si `apple_id` no existe, crea usuario (name obligatorio la primera vez).

### POST `/google`

```json
// Request
{ "id_token": "eyJhbGci...", "name?": "Saleem" }

// Response 200 — mismo shape que register
```

Verifica `id_token` con la librería oficial de Google (`google-auth-library`). Si `google_id` no existe, crea usuario (name obligatorio la primera vez, o se toma del token).

### POST `/refresh`

```json
// Request
{ "refresh_token": "dGhp..." }

// Response 200
{ "access_token": "eyJ...", "refresh_token": "bmV3..." }
```

Rota el refresh token: elimina el anterior de la DB y crea uno nuevo en una transacción atómica. Sin blacklist Redis — el token viejo deja de existir en la tabla `refresh_tokens`.

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

## Wallet Service — :3002

Nginx: `/api/banks`, `/api/wallets`, `/api/transactions`, `/api/transfers`, `/api/categories`, `/api/recurring`, `/api/stats`, `/api/stats/daily`, `/api/dashboard`, `/api/investment-transactions`

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
{ "name": "Ahorro", "type?": "CASH", "initial_balance?": 1200.00, "icon?": "💰", "color?": "#34C759" }

// Response 201
{ "id": "uuid", "bank_id": "uuid", "name": "Ahorro", "icon": "💰", "color": "#34C759", "balance": 1200.00, "is_archived": false, "created_at": "...", "updated_at": "..." }
```

Defaults: `type=CASH`, `initial_balance=0.00`, `icon=💳`, `color=#007AFF`. `type` puede ser `CASH | INVESTMENT`; los wallets `INVESTMENT` ignoran `initial_balance` y su balance se calcula desde `investment_transactions` (ver `/wallets/:id/portfolio`).

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

Solo wallets no archivados del banco. 404 si el banco no existe o pertenece a otro user.

### GET `/wallets`

Lista plana de todos los wallets activos del user con `bank_name` resuelto, útil para selectores cross-bank.

```json
// Response 200
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
{ "id?": "uuid", "type": "EXPENSE", "amount": 42.30, "category_id?": "uuid", "note?": "Mercadona", "date?": "2026-04-18" }

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

type=`INCOME|EXPENSE`, amount > 0. `category_id` opcional — si se envía debe pertenecer al user (o ser predefinida) y coincidir en `type`; si se omite la transacción queda sin categoría (`category: null`). Default `date=hoy`. El campo `id?` es opcional y permite al cliente móvil enviar su UUID generado offline (si se omite, lo genera el servidor). Publica `transaction.created`. 409 si `id` enviado ya existe.

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

Transferencias: solo pata EXPENSE (la app muestra como fila única).

### GET `/transactions/:id`

```json
// Response 200 — mismo shape que POST /wallets/:id/transactions
```

404 si la transacción no existe o no pertenece al usuario.

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

Solo custom. Reasigna transacciones y reglas recurrentes a "Otros" del mismo type en `prisma.$transaction`. 403 si es predefinida.

### GET `/recurring`

Lista de reglas recurrentes activas del usuario (suscripciones, nómina, alquiler…).

```json
// Response 200
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
      "next_run": "2026-06-15",
      "is_active": true,
      "created_at": "2026-04-15T10:00:00Z"
    }
  ]
}
```

Solo reglas con `is_active = true`. Las inactivas se ocultan.

### POST `/recurring`

```json
// Request
{
  "wallet_id": "uuid",
  "type": "EXPENSE",
  "amount": 9.99,
  "category_id?": "uuid",
  "note?": "Spotify",
  "frequency": "DAILY|WEEKLY|MONTHLY",
  "day_of_month?": 15,
  "day_of_week?": 0,
  "starts_at?": "2026-05-15"
}

// Response 201 — misma forma que GET /recurring item
```

- `day_of_month` (1-31): **obligatorio** si `frequency=MONTHLY`. Si excede los días del mes destino, se clamp al último día (ej. `31` en febrero → 28/29).
- `day_of_week` (0=lunes … 6=domingo): **obligatorio** si `frequency=WEEKLY`.
- `starts_at` default = hoy.
- `next_run` se calcula al crear: primer día ≥ `starts_at` que cumple el patrón.
- 400 si `category_id` no pertenece al user o el type no coincide.
- 404 si `wallet_id` no existe o pertenece a otro user.

### PATCH `/recurring/:id`

```json
// Request (todos opcionales)
{
  "amount?": 12.99,
  "note?": "Spotify Premium",
  "category_id?": "uuid",
  "is_active?": false
}

// Response 200 — regla actualizada
```

404 si la regla no pertenece al usuario.

### DELETE `/recurring/:id`

```
Response 204
```

Hard delete. 404 si la regla no pertenece al usuario.

**Materialización automática**: un cron interno (`0 6 * * *` UTC) recorre las reglas con `next_run <= today AND is_active = true`, crea la transacción correspondiente con `date = rule.next_run` y avanza `next_run` al siguiente disparo, todo en una `prisma.$transaction` por regla. Publica `transaction.created` por cada materialización.

### POST `/wallets/:id/investment-transactions`

Registrar una operación bursátil (compra, venta o dividendo) en un wallet de tipo `INVESTMENT`.

```json
// Request
{
  "ticker": "VWCE",
  "asset_name": "Vanguard FTSE All-World ETF",
  "type": "BUY",
  "shares": 10,
  "price_per_share": 87.50,
  "currency?": "EUR",
  "note?": "Primera compra",
  "date?": "2026-01-15"
}

// Response 201
{
  "id": "uuid",
  "wallet_id": "uuid",
  "ticker": "VWCE",
  "asset_name": "Vanguard FTSE All-World ETF",
  "type": "BUY",
  "shares": "10",
  "price_per_share": "87.5",
  "total_amount": "875",
  "currency": "EUR",
  "note": "Primera compra",
  "date": "2026-01-15",
  "created_at": "2026-01-15T10:30:00Z"
}
```

- `type` = `BUY | SELL | DIVIDEND`. `BUY` y `SELL` ajustan posición; `DIVIDEND` solo registra ingreso (no afecta shares ni avg_cost).
- `total_amount = shares × price_per_share` calculado server-side con precisión decimal.
- Default `currency=EUR`, default `date=hoy`.
- 400 si `shares <= 0` o `price_per_share <= 0`.
- 400 si el wallet es de tipo `CASH` (debe ser `INVESTMENT`).
- 404 si el wallet no existe o pertenece a otro user.

`shares`, `price_per_share` y `total_amount` se serializan como string para preservar precisión (Decimal 18/8 y 12/4 respectivamente en DB).

### GET `/wallets/:id/investment-transactions`

```
Query: cursor?, limit? (default 20, max 50), ticker?, type?, from?, to?
Orden: date DESC, created_at DESC, id DESC (cursor estable)
```

```json
// Response 200
{
  "transactions": [
    {
      "id": "uuid",
      "wallet_id": "uuid",
      "ticker": "VWCE",
      "asset_name": "...",
      "type": "BUY",
      "shares": "10",
      "price_per_share": "87.5",
      "total_amount": "875",
      "currency": "EUR",
      "note": null,
      "date": "2026-01-15",
      "created_at": "..."
    }
  ],
  "next_cursor": "uuid-or-null"
}
```

400 si el wallet es de tipo `CASH`. 404 si no existe o ajeno.

### DELETE `/investment-transactions/:id`

```
Response 204
```

Hard delete. 404 si la operación no existe o pertenece a otro user.

### GET `/wallets/:id/portfolio`

Posiciones netas del wallet de inversión con cotización en tiempo real (cacheada).

```json
// Response 200
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
  "last_updated": "2026-05-31T10:30:00Z"
}
```

- `shares = Σ BUY.shares − Σ SELL.shares`. Posiciones con `shares = 0` (cerradas) no aparecen.
- `avg_cost_per_share = Σ BUY.total_amount / Σ BUY.shares` (DIVIDEND no afecta).
- `value = current_price × shares`, `gain = value − cost`, `gain_pct = gain / cost × 100`.
- `current_price` viene de `price_cache` (TwelveData free tier 800 credits/día). TTL: **30 min** si mercado abierto, **24 h** si cerrado. Cache es por `ticker`, compartida entre todos los users → escala a N usuarios con M tickers únicos sin escalar requests.
- `last_updated` = timestamp más antiguo de las cotizaciones usadas en la respuesta.
- 400 si el wallet es de tipo `CASH`. 404 si no existe o ajeno.

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

## AI Service — :3003

Nginx: `/api/insights`, `/api/categorize`

**Modelo de respuesta del insight (estructura tripartita):**

- `headline` (string, requerido): una frase de 80-120 caracteres con el hecho más relevante de la semana.
- `facts` (array de string, requerido, 3-5 elementos): hechos objetivos verificables contra `summary_data`. **Los números en estos textos provienen del análisis determinista, no del LLM** — el cliente puede confiar en que coinciden con `charts` y `summary_data`.
- `recommendations` (array de string, requerido, 0-3 elementos): sugerencias accionables. **Puede ser un array vacío `[]`** cuando los datos no soportan recomendaciones — en ese caso la app no muestra el bloque "Sugerencias".
- `charts` (objeto, requerido): datos estructurados para que la app dibuje gráficos nativos sin abrir el PDF.
- `summary_text` (string, requerido): concatenación legible (`headline` + facts en prosa) para retro-compatibilidad y vista resumida del listado.

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
      "headline": "Has ahorrado el 82% de tus ingresos esta semana, tu mejor cifra en 2 meses",
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
  "headline": "Has ahorrado el 82% de tus ingresos esta semana, tu mejor cifra en 2 meses",
  "facts": [
    "Gastaste 387,50€, un 12% menos que tu media de las últimas 4 semanas",
    "Restaurantes subió un 64% (87€) respecto a tu media habitual de 53€",
    "El 73% de tu gasto en restaurantes se concentra en viernes y sábado",
    "Tienes 6 suscripciones activas por 78€/mes",
    "Gasto inusual: 145€ en Decathlon, tu mayor compra de esa categoría en 8 semanas"
  ],
  "recommendations": [
    "Tu gasto en Ocio lleva creciendo 6 semanas seguidas. Si quieres frenar la tendencia, fijar un tope semanal podría ayudar."
  ],
  "charts": {
    "category_breakdown": [
      { "name": "Comida", "amount": 89.0, "color": "#FF6B6B" },
      { "name": "Transporte", "amount": 45.0, "color": "#4ECDC4" }
    ],
    "weekly_total_last_8w": [
      { "week_start": "2026-02-24", "total": 412.3 },
      { "week_start": "2026-03-03", "total": 387.1 }
    ],
    "actual_vs_avg_by_category": [
      { "category": "Restaurantes", "actual": 87.0, "avg_4w": 53.0 },
      { "category": "Transporte", "actual": 22.0, "avg_4w": 35.0 }
    ],
    "top_transactions": [
      {
        "note": "Decathlon",
        "amount": 145.0,
        "category": "Deporte",
        "date": "2026-04-17"
      }
    ]
  },
  "summary_text": "Esta semana gastaste 387,50€, un 12% menos que tu media...",
  "has_pdf": true,
  "created_at": "2026-04-21T06:00:00Z"
}
```

`charts` permite a la app dibujar gráficos nativos (Swift Charts) sin descargar el PDF. Si `recommendations` viene `[]`, la app no renderiza el bloque "💡 Sugerencias".

### POST `/insights/generate`

Body vacío. Síncrono. Genera para la última semana completa (último lunes UTC). Si ya existe, regenera (UPDATE). Si el usuario no tuvo transacciones esa semana, responde `204` sin llamar al LLM.

```json
// Response 201
{
  "id": "uuid",
  "week_start": "2026-04-14",
  "headline": "Has ahorrado el 82% de tus ingresos esta semana, tu mejor cifra en 2 meses",
  "facts": ["..."],
  "recommendations": ["..."],
  "charts": { "...": "..." },
  "summary_text": "...",
  "has_pdf": true,
  "created_at": "..."
}
```

Rate limit: 5/min por user (endpoint pesado).

**Flujo interno:**

1. Calcula `week_start` = último lunes UTC.
2. `GET wallet-service:3002/internal/transactions?user_id={id}&from={hace_8_semanas}&to={domingo_anterior}` con `X-Internal-Secret` (histórico configurable vía `INSIGHTS_HISTORY_WEEKS`, default 8).
3. Si la semana objetivo no tiene transacciones → responde `204` sin generar.
4. `app/analytics/snapshot.build_insight_snapshot(...)` calcula deterministamente todas las métricas (gasto vs media móvil 4w, tendencias, Z-scores, recurrentes implícitos, distribución temporal, ratio ahorro, top transacciones, etc.) → produce `summary_data` JSON.
5. Llama al LLM con system prompt estricto: "no inventes números, distingue hecho de recomendación, recommendations puede ser []". Input ~3 000 tokens, output ~800 tokens.
6. Parsea respuesta JSON (`headline`, `facts`, `recommendations`).
7. Persiste en `weekly_insights` con `summary_data` completo.
8. Renderiza PDF con ReportLab + matplotlib (donut + barras actual vs media 4w + línea últimas 8 semanas + tabla top 5 transacciones + hechos + recomendaciones si no vacío).
9. Sube a S3 `walletos-exports-{env}/{user_id}/{week_start}.pdf`, actualiza `s3_key`.
10. Publica `insight.generated { user_id, insight_id, week_start }` en `walletOS.events`.

### GET `/insights/{week_start}/export`

```json
// Response 200
{
  "url": "https://s3.../walletos-exports-.../uuid/2026-04-14.pdf?signature=...",
  "expires_in": 3600
}
```

URL firmada S3, TTL 1 hora. Si el PDF no existe pero el insight sí (caso borde), genera y sube on-the-fly antes de devolver la URL.

### POST `/categorize`

```json
// Request
{ "note": "Mercadona semanal", "type": "EXPENSE" }

// Response 200
{ "category_id": "uuid", "category_name": "Comida", "category_icon": "🍔", "confidence": 0.92 }

// Si confidence < 0.5
{ "category_id": null, "category_name": null, "category_icon": null, "confidence": 0.31 }
```

Cache: `cat:user:{user_id}:categories` (TTL 24h) para la lista de categorías del usuario (invalidada por evento RabbitMQ al crear/editar/borrar categoría), `cat:{hash(note+type+user_id)}` (TTL 24h) para el resultado de la categorización. La app llama con debounce 500ms. Rate limit: 60/min por user.

---

## Notification Service — :3004

Nginx: `/api/devices`, `/api/notifications`

### POST `/devices`

```json
// Request
{ "token": "a1b2c3d4e5f6..." }

// Response 201
{ "id": "uuid", "user_id": "uuid", "token": "a1b2c3d4e5f6...", "platform": "ios", "created_at": "..." }
```

Upsert por `token`: si ya existe no duplica; si existe para otro usuario, reasigna `user_id`. El cliente es nativo iOS → el envío es siempre por **APNs** (`platform` se almacena como `ios`).

### DELETE `/devices/:token`

```
Response 204
```

### GET `/notifications`

Centro de notificaciones (historial). Paginación cursor-based, `created_at DESC` con desempate por `id` (keyset estable: `created_at` no es único).

```
Query: cursor (string opaco, opcional), limit (default 20, max 50)
```

El `cursor` es un token opaco devuelto en `next_cursor`; el cliente lo reenvía tal cual, no debe interpretarlo.

```json
// Response 200
{
  "notifications": [
    {
      "id": "uuid",
      "type": "high_spend | weekly_insight | reminder",
      "title": "Resumen semanal",
      "body": "Tu resumen semanal está listo",
      "status": "sent | failed",
      "read_at": null,
      "created_at": "2026-04-21T06:00:00Z"
    }
  ],
  "unread_count": 3,
  "next_cursor": "opaque-string-or-null"
}
```

### PATCH `/notifications/:id/read`

Marca una notificación como leída. 404 si no pertenece al usuario.

```
Response 200 — la notificación actualizada (mismo shape que en la lista, con read_at ya seteado)
```

### POST `/notifications/read-all`

Marca como leídas todas las notificaciones del usuario.

```
Response 204
```

---

## Eventos RabbitMQ

Exchange: `walletOS.events` (topic, durable). Queues: una por consumidor, durable, ack manual.

> Los eventos `user.registered` y `user.updated` se propusieron en el diseño inicial pero **no se implementaron** en v1: ningún consumidor los necesitó. Los servicios crean datos lazy al primer uso y, si Notification Service necesita reaccionar a cambios de timezone o preferencias, consulta `/internal/users/:id` en el momento de enviar el push.

### 1. `user.deleted`

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

### 2. `transaction.created`

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

### 3. `insight.generated`

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
App nativa iOS (SwiftUI) → Nginx → User Service / Wallet Service / AI Service / Notification Service

RabbitMQ (walletOS.events):
  User Service    → user.deleted          → Wallet, AI, Notification
  Wallet Service  → transaction.created   → Notification Service
  AI Service      → insight.generated     → Notification Service

HTTP interno (red Docker, con X-Internal-Secret):
  AI Service           → Wallet Service   (GET /internal/transactions, /internal/categories)
  Notification Service → User Service     (GET /internal/users, /internal/users/:id)
```

## Conteo

| Servicio             | Públicos | Internos | Eventos publicados |
| -------------------- | -------- | -------- | ------------------ |
| User Service         | 11       | 2        | 1                  |
| Wallet Service       | 31       | 2        | 1                  |
| AI Service           | 5        | 0        | 1                  |
| Notification Service | 5        | 0        | 0                  |
| **Total**            | **52**   | **4**    | **3**              |
