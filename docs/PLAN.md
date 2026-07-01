# WalletOS — Plan de proyecto

## Contexto

Proyecto personal backend-heavy para expandir currículum. Sin fines comerciales. El objetivo es gestionar infraestructura propia (VPS, Docker, microservicios) alejándose de plataformas managed (Vercel, Supabase, Firebase). Se pivota de MoodOS (diario de ánimo) a una app de gestión de gastos personales con IA — algo útil en el día a día.

La app debe sentirse **rápida y a mano**: abrir, anotar un gasto en 3 toques, cerrar. Sin formularios pesados ni sensación de pereza.

> **Flujo de usuario, pantallas, jerarquía de datos y schemas SQL detallados:** ver [`user-flow-and-bdd.md`](user-flow-and-bdd.md)
>
> **Roadmap táctico de ejecución (fases, checklists):** ver [`ROADMAP.md`](ROADMAP.md)

---

## Descripción

App móvil multiplataforma (iOS + Android) de gestión de finanzas personales. El usuario organiza sus finanzas por **bancos** (Santander, N26, Trade Republic, etc.) y dentro de cada banco tiene **wallets**. Existen dos tipos de wallet: **CASH** (cuenta de efectivo: ahorro, nómina, conjunta…) y **INVESTMENT** (cartera de inversión). En wallets CASH el usuario registra transacciones de gasto, ingreso o transferencia con categoría, cantidad y comentario opcional. En wallets INVESTMENT registra operaciones bursátiles (BUY, SELL, DIVIDEND) sobre activos identificados por ticker; el balance se calcula como la suma de posiciones × precio actual obtenido de TwelveData. La IA genera un resumen semanal de hábitos de gasto, y puede auto-categorizar transacciones a partir de la descripción.

---

## Stack tecnológico

| Capa                 | Tecnología                                                     |
| -------------------- | -------------------------------------------------------------- |
| User Service         | Node.js + Express + Prisma                                     |
| Wallet Service       | Node.js + Express + Prisma                                     |
| AI Service           | Python + FastAPI + SQLAlchemy                                  |
| Notification Service | Node.js + Express + Prisma                                     |
| Base de datos        | PostgreSQL 16 (2 instancias: principal 3 DB + ai-service 1 DB) |
| ORM                  | Prisma (Node) / SQLAlchemy + Alembic (Python)                  |
| Caché                | Redis (compartido)                                             |
| Mensajería asíncrona | RabbitMQ                                                       |
| Object storage       | AWS S3 (bucket dev y bucket prod)                              |
| Email transaccional  | Resend                                                         |
| API Gateway          | Nginx                                                          |
| SSL                  | Certbot (Let's Encrypt) + Cloudflare Full Strict               |
| Servidor             | Hetzner VPS (4 vCPU ARM, 8GB RAM, 80GB SSD)                    |
| Contenedores         | Docker + docker-compose                                        |
| CI/CD                | GitHub Actions + ghcr.io                                       |
| Observabilidad       | Grafana + Loki                                                 |
| Precios de mercado   | TwelveData (free tier — 800 req/día, WebSocket disponible)     |
| Móvil                | Swift + SwiftUI (iOS nativo, iOS 16+)                          |

---

## Estructura del repositorio (monorepo)

```
walletOS/
├── PLAN.md
├── ROADMAP.md
├── api-contracts.md
├── user-flow-and-bdd.md
├── docker-compose.yml
├── nginx/
│   ├── nginx.conf
│   └── certs/
├── services/
│   ├── user-service/                 # Node.js + Express + Prisma  :3001
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   ├── wallet-service/               # Node.js + Express + Prisma  :3002
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   ├── ai-service/                   # Python + FastAPI + SQLAlchemy :3003
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── alembic/
│   │   └── src/
│   └── notification-service/         # Node.js + Express + Prisma  :3004
│       ├── Dockerfile
│       ├── package.json
│       ├── prisma/schema.prisma
│       └── src/
├── ios/
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

---

## Containers Docker (12 en total)

```
user-service          :3001
wallet-service        :3002
ai-service            :3003
notification-service  :3004
postgres              PostgreSQL 16 (3 databases: users, wallets, notifications)
postgres-ai           PostgreSQL 16 (1 database: ai)
redis
rabbitmq
nginx
grafana
loki
certbot               (one-shot para renovación de certs)
```

S3 y Resend se usan como servicios externos reales (también en desarrollo local, con bucket y API key separados de los de producción).

---

## Arquitectura de servicios

### User Service — :3001

**Responsabilidades:** registro, login con email/password, Apple Sign In, Google Sign In, JWT (access + refresh con rotación; el refresh anterior se elimina de la DB, sin blacklist Redis), forgot/reset password (vía Resend), eliminación de cuenta, perfil, timezone, moneda preferida, preferencias de notificación.

**Entidades:** User (con `google_id`, `apple_id` y campos `reminder_enabled`, `high_spend_enabled`, `high_spend_threshold`), RefreshToken, PasswordResetToken — schemas en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#walletOS_users--user-service).

**Endpoints:** 11 públicos + 2 internos — contratos detallados en [`api-contracts.md`](api-contracts.md#user-service--3001-apiusers).

Resumen: register, login, apple, google, refresh, logout, forgot-password, reset-password, GET/PATCH/DELETE me, `/internal/users`, `/internal/users/:id`.

**Eventos RabbitMQ publicados:**

- `user.deleted { user_id }` — tras `DELETE /me`, para que otros servicios limpien sus datos en cascada.

> Los eventos `user.registered` y `user.updated` (propuestos en el diseño inicial) **no se implementaron**: ningún servicio los necesitó. Los consumidores crean datos lazy en el primer uso y, si Notification Service (Fase 8) necesita reaccionar a cambios de `timezone` o preferencias del user, consulta `/internal/users/:id` en el momento de enviar el push.

---

### Wallet Service — :3002

**Responsabilidades:** CRUD de bancos, CRUD de wallets, CRUD de transacciones, transferencias entre wallets, categorías, balances, estadísticas.

**Endpoints:** 31 públicos + 2 internos — contratos detallados en [`api-contracts.md`](api-contracts.md#wallet-service--3002).

Desglose canónico (cuenta cada ruta única registrada en `routes/`):

- Banks (4): GET/POST/PATCH/DELETE `/banks`
- Wallets (5): GET `/wallets`, GET `/banks/:id/wallets`, POST `/banks/:id/wallets`, PATCH/DELETE `/wallets/:id`
- Transactions (6): GET `/transactions`, GET `/wallets/:id/transactions`, POST `/wallets/:id/transactions`, GET/PATCH/DELETE `/transactions/:id`
- Transfers (1): POST `/transfers`
- Categories (4): GET/POST `/categories`, PATCH/DELETE `/categories/:id`
- Recurring (4): GET/POST `/recurring`, PATCH/DELETE `/recurring/:id`
- Stats (3): GET `/stats`, `/stats/daily`, `/dashboard`
- Investment transactions (3): POST/GET `/wallets/:id/investment-transactions`, DELETE `/investment-transactions/:id`
- Portfolio (1): GET `/wallets/:id/portfolio`
- **Internos (2)**: GET `/internal/transactions`, GET `/internal/categories`

**Entidades:** Bank, Wallet, Transaction, Category — schemas en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#walletOS_wallets--wallet-service).

**Categorías predefinidas (seed):**

- Gastos: Comida, Transporte, Ocio, Suscripciones, Compras, Salud, Casa, Educación, Otros
- Ingresos: Nómina, Freelance, Inversiones, Regalos, Otros

**Balance de un wallet:** `initial_balance + SUM(INCOME) - SUM(EXPENSE)` — calculado en query, no almacenado.

**Transferencias:** crean 2 transacciones vinculadas por `transfer_id` (EXPENSE en origen, INCOME en destino). Operación atómica en una transacción SQL. No afectan al balance total. Se excluyen de estadísticas de gasto.

**Offline-first:** `POST /wallets/:id/transactions` acepta un `id?` opcional generado por la app para soportar sincronización offline (ver sección _Sincronización offline-first_).

**Eventos RabbitMQ publicados:**

- `transaction.created { user_id, transaction_id, wallet_id, type, amount, category_id, category_name, date, transfer_id }`

**Eventos RabbitMQ consumidos:**

- `user.deleted` → borra bancos, wallets, transacciones y categorías custom del usuario.

---

### AI Service — :3003

**Responsabilidades:** insights semanales de gasto con análisis profundo, auto-categorización de transacciones, exportación PDF con gráficos.

**Endpoints:** 5 públicos — contratos detallados en [`api-contracts.md`](api-contracts.md#ai-service--3003-apiai).

Resumen: GET /insights, GET /insights/{week_start}, POST /insights/generate, GET /insights/{week_start}/export, POST /categorize.

**Principio rector — analytics deterministas + LLM solo redacta:**

Todo el análisis numérico se hace en `app/analytics/` con código Python puro. El LLM recibe los datos **ya digeridos** en JSON y devuelve únicamente texto estructurado (`headline`, `facts[]`, `recommendations[]`). Consecuencias:

- **Cero alucinaciones numéricas:** los números en `facts` provienen de `summary_data` ya calculado, no del LLM.
- **Calidad desacoplada del modelo:** el valor del insight viene del análisis, no de la capacidad cognitiva del modelo. `gpt-4o-mini` es suficiente.
- **Coste predecible:** input al LLM ~3 000 tokens, output ~800 tokens. Independiente del histórico real del usuario.
- **Sin lock-in:** cliente LLM abstracto multi-provider permite cambiar de OpenAI a Anthropic con una env var.

**Métricas deterministas calculadas (en `app/analytics/`) con histórico de 8 semanas:**

- Gasto semanal por categoría vs media móvil 4 semanas (`delta_vs_avg`, `z_score`).
- Tendencias por categoría (regresión lineal 8 semanas; reporta pendiente y consistencia).
- Anomalías por Z-score (umbral 1.5).
- Top merchants por nota normalizada (`lower(unaccent(note))`).
- Recurrentes implícitos (mismo merchant + cantidad ±5% a intervalos regulares no registrados en `recurring_rules`).
- Distribución temporal (concentración por día de semana).
- Ratio de ahorro mensual.
- Top transacciones por percentil (≥95) en su categoría.
- Suscripciones activas y suma mensual.
- Comparativa mes vs mes por categoría.
- Si el wallet del usuario tiene tipo INVESTMENT: variación de valor del portfolio.

**Estructura del insight (tripartita):**

```json
{
  "headline": "Una frase con el hecho más relevante (80-120 chars)",
  "facts": ["3-5 hechos objetivos verificables contra summary_data"],
  "recommendations": [
    "0-3 sugerencias accionables. Si los datos no soportan ninguna, queda [] vacío y la app no muestra el bloque."
  ]
}
```

Regla estricta: **si los datos no soportan una recomendación, no se fuerza**. Los `facts` son hechos numéricos verificables; las `recommendations` son acciones sugeridas marcadas como tales.

**Flujo del insight semanal:**

1. Cron lunes 06:00 UTC dispara para cada usuario activo, o el usuario fuerza con `POST /insights/generate`.
2. Calcula `week_start` = último lunes UTC.
3. Llama a Wallet Service: `GET http://wallet-service:3002/internal/transactions?user_id=X&from=hace_8_semanas&to=domingo` con `X-Internal-Secret`.
4. Si la semana objetivo no tiene transacciones → responde `204` sin generar (api-contracts.md).
5. `app/analytics/snapshot.build_insight_snapshot(...)` orquesta todas las métricas → `snapshot JSON`.
6. Llama al LLM (`LLMClient.insight(snapshot)`) con system prompt estricto (no inventar números, distinguir hecho de recomendación).
7. Parsea respuesta (`headline`, `facts`, `recommendations`).
8. Guarda en DB con `summary_data=snapshot` para regeneración futura y para que la app dibuje gráficos nativos.
9. Renderiza PDF con ReportLab + matplotlib (donut por categoría + barras actual vs media 4 semanas + línea últimas 8 semanas + tabla top 5 transacciones + hechos + recomendaciones si no vacío).
10. Sube a S3: `walletos-exports-{env}/{user_id}/{week_start}.pdf`.
11. Publica `insight.generated { user_id, insight_id, week_start }`.

**Auto-categorización:**

- El usuario escribe una nota al crear la transacción (ej: "Mercadona", "Uber al aeropuerto", "Sueldo marzo").
- El endpoint `/categorize` recibe el texto y devuelve la categoría sugerida con `confidence`.
- Se usa un prompt ligero con las categorías del usuario como contexto.
- La app llama a esto en tiempo real mientras el usuario escribe (debounce 500ms).
- Si el usuario no escribe nota, la app no llama al endpoint — el usuario elige categoría manualmente.
- **Caché Redis dos niveles** (TTL 24h en ambos): `cat:user:{user_id}:categories` (lista de categorías del usuario, invalidada por evento RabbitMQ al crear/editar/borrar categoría) y `cat:{hash(note+type+user_id)}` (resultado de la categorización). Reduce ~70% las llamadas reales al LLM.
- Si `confidence < 0.5`, devuelve `category_id=null` y la app no pre-rellena.

**Scheduled job:** cada lunes a las 06:00 UTC (APScheduler async, paralelismo con semáforo de concurrencia limitada). Idempotente: si ya existe el insight para `(user_id, week_start)`, hace UPDATE.

**Entidades:** WeeklyInsight con `headline`, `facts JSONB`, `recommendations JSONB`, `summary_data JSONB`, `summary_text`, `s3_key` — schema en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#walletOS_ai--ai-service).

**PDF con gráficos:** ReportLab compone el documento; matplotlib genera los 3 gráficos como PNG en memoria (donut, barras horizontales, línea temporal). Tablas con `Table` + `TableStyle` de ReportLab. Tamaño típico: 150-300 KB.

**S3:**

- Bucket dev: `walletos-exports-dev`
- Bucket prod: `walletos-exports-prod`
- Path: `{user_id}/{week_start}.pdf`
- URLs firmadas con TTL de 1 hora

**Decisiones de proveedor LLM (v1):**

- Cliente LLM abstracto multi-provider (`LLMClient` con implementaciones `OpenAIClient`, `AnthropicClient`).
- `LLM_PROVIDER_CATEGORIZE=openai`, modelo `gpt-4o-mini`.
- `LLM_PROVIDER_INSIGHTS=openai`, modelo `gpt-4o-mini`.
- Cambiar a Anthropic Claude Haiku 4.5 si en dogfooding la redacción de gpt-4o-mini queda corta: cambio de env vars, sin tocar código.
- LLM local descartado en v1 (no cabe en CAX21 con calidad y latencia útiles).

**Eventos RabbitMQ consumidos:**

- `user.deleted` → borra los insights del usuario y los objetos S3 asociados (prefijo `{user_id}/`). Idempotente.

**Eventos RabbitMQ publicados:**

- `insight.generated { user_id, insight_id, week_start }` tras cada generación exitosa.

---

### Notification Service — :3004

**Responsabilidades:** device tokens APNs (cliente nativo iOS, sin FCM/Android), push notifications, centro de notificaciones (historial), recordatorios. Corre un scheduler interno (`node-cron`) cada hora para el recordatorio diario. Plan por rama en [`phase-8-notification-service.md`](phase-8-notification-service.md).

**Endpoints:** 5 públicos — contratos en [`api-contracts.md`](api-contracts.md#notification-service--3004-apinotifs). `POST /devices`, `DELETE /devices/:token`, `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`.

**Push notifications:**

- **Recordatorio diario (21:00 hora local, ventana ±30 min):** "¿Has anotado tus gastos de hoy?" — solo si no ha registrado ninguna transacción ese día. Lo sabe por la Redis key `activity:{user_id}:{date}` (seteada al consumir `transaction.created`), no consultando a Wallet. Idempotencia con `notif:{user_id}:{date}:reminder` TTL 2h.
- **Insight listo:** al recibir `insight.generated` → "Tu resumen semanal está listo"
- **Gasto alto:** al recibir `transaction.created` con amount > umbral configurable por usuario → "Has registrado un gasto de X€ en {categoría}" (opcional, se puede activar/desactivar)

**Eventos RabbitMQ escuchados:**

| Evento                | Acción                                                                     |
| --------------------- | -------------------------------------------------------------------------- |
| `transaction.created` | Marca día como activo (suprime recordatorio) + evalúa alerta de gasto alto |
| `insight.generated`   | Push "Tu resumen semanal está listo"                                       |
| `user.deleted`        | Borra los `device_tokens` y `notifications` del usuario                    |

Cada push se **persiste** en `notifications` (centro de notificaciones de la app).

**Entidades:** `DeviceToken`, `Notification` — schema en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#walletOS_notifications--notification-service).

---

## Autenticación interna entre servicios

Los endpoints `/internal/*` solo son llamados por otros servicios dentro de la red Docker. No se exponen a través de Nginx: el gateway rechaza cualquier ruta que contenga `/internal/`.

Como defensa en profundidad, todos los endpoints `/internal/*` exigen una cabecera compartida:

```
X-Internal-Secret: {shared_secret}
```

El secret es una variable de entorno (`INTERNAL_SECRET`) que comparten los 4 servicios. Un middleware en cada servicio valida la cabecera y devuelve `401` si falta o no coincide. El secret se rota desde el gestor de secretos cuando sea necesario.

---

## Sincronización offline-first

Para que la app se sienta inmediata al anotar un gasto (3 toques), las transacciones se guardan en la base de datos local antes de hablar con el servidor.

**Estrategia:**

1. **UUIDs generados en cliente.** La app genera un `UUID v4` al crear cualquier recurso (transacción, banco, wallet). El endpoint `POST /wallets/:id/transactions` acepta un campo `id?` opcional; si viene, se usa; si no, el servidor genera uno.
2. **Cola FIFO en base de datos local.** Cada operación pendiente se encola con su payload completo y un estado (`pending`, `syncing`, `failed`).
3. **Sincronización al reconectar.** Cuando el dispositivo detecta conexión, drena la cola en orden.
4. **Reintentos.** Cada operación se reintenta hasta 5 veces con backoff exponencial. Si persiste el error, queda `failed` y se muestra en un banner para que el usuario decida (reintentar o descartar).
5. **Resolución de conflictos.** Last-write-wins: si el servidor detecta una transacción con el mismo `id` pero contenido distinto, gana la escritura más reciente por `updated_at`. No se fusionan campos.
6. **Operaciones no-idempotentes.** Eliminar una transacción con `transfer_id` borra el par en el servidor; la cola de operaciones debe tratar esto como una sola operación.

Esta estrategia no cubre sincronización multi-dispositivo en tiempo real (eso es v2). Si el usuario usa dos dispositivos, el más reciente en hablar con el servidor gana.

---

## Infraestructura compartida

### Nginx — API Gateway

```nginx
/api/{register,login,apple,google,refresh,logout}                     → http://user-service:3001
/api/auth/, /api/me                                                   → http://user-service:3001
/api/banks, /api/wallets, /api/transactions, /api/transfers,
/api/categories, /api/recurring, /api/stats, /api/dashboard,
/api/investment-transactions                                         → http://wallet-service:3002
/api/insights, /api/categorize                                        → http://ai-service:3003
/api/devices, /api/notifications                                      → http://notification-service:3004
```

Los prefijos de colección van sin barra final (matchean colección y sub-recursos; con barra nginx responde 301). Nginx bloquea cualquier URI bajo `/api/internal/` con **403**.

### PostgreSQL — 2 instancias

```
postgres (servicios principales)
  ├── walletOS_users          → User Service
  ├── walletOS_wallets        → Wallet Service
  └── walletOS_notifications  → Notification Service

postgres-ai (AI Service aislado)
  └── walletOS_ai             → AI Service
```

Cada servicio se conecta únicamente a su database. La instancia `postgres-ai` está aislada del resto: si el AI Service tiene carga o falla, no afecta a los otros servicios.

### Redis (compartido)

| Uso                            | Key pattern                       | TTL                  |
| ------------------------------ | --------------------------------- | -------------------- |
| Rate limiting                  | `rate:{ip}` / `rate:{user_id}`    | Ventana configurable |
| Día con actividad              | `activity:{user_id}:{date}`       | 26 horas             |
| Recordatorio enviado           | `notif:{user_id}:{date}:reminder` | 2 horas              |
| Cache categorías usuario       | `cat:user:{user_id}:categories`   | 24 horas             |
| Cache resultado categorización | `cat:{hash(note+type+user_id)}`   | 24 horas             |

### RabbitMQ

```
Exchange: walletOS.events (tipo: topic, durable)

Routing key             Publicado por       Consumido por
─────────────────────────────────────────────────────────
user.deleted            User Service        Wallet, AI, Notification
transaction.created     Wallet Service      Notification Service
insight.generated       AI Service          Notification Service
```

Payloads detallados en [`api-contracts.md`](api-contracts.md#eventos-rabbitmq).

---

## Móvil — Swift / SwiftUI (iOS nativo)

### Pantallas

Ver mockups detallados en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#pantallas).

1. **Auth** — Login/Registro + Apple Sign In + Google Sign In + link Forgot password
2. **Forgot password** — input email
3. **Reset password** — desde deep link `walletos://reset?token=...`
4. **Setup** — Crear primer banco + wallet (solo primera vez)
5. **Home** — Balance total, gasto del mes, últimas transacciones, botón "+"
6. **Añadir/editar transacción** — Modal: numpad + categorías + toggle gasto/ingreso/transferencia
7. **Cuentas** — Lista agrupada por banco con wallets y balances
8. **Crear/editar banco** — modal
9. **Crear/editar wallet** — modal
10. **Transacciones del wallet** — lista filtrada por wallet
11. **Estadísticas** — Donut, barras diarias, comparativa mensual
12. **Insights** — Lista de resúmenes semanales IA
13. **Detalle de insight** — Texto completo + gráfico + botón PDF
14. **Ajustes** — Perfil, notificaciones, logout, eliminar cuenta
15. **Widget** — Balance total + gasto del día en pantalla de inicio

### Arquitectura

- **Clean Architecture**: Domain, Data, Presentation, Core
- **Repository pattern**: `UserRepository`, `BankRepository`, `WalletRepository`, `TransactionRepository`, `InsightRepository`, `TokenRepository`
- **Silent token refresh**: interceptor `URLSession` 401 → refresh → reintento transparente
- **GRDB (offline-first)**: ver sección _Sincronización offline-first_
- **Widget de pantalla de inicio**: balance total + gasto del día vía `WidgetKit`. Tap abre el modal de añadir transacción vía deep link `walletos://add`.
- **Push notifications**: permisos + registro del device token APNs al login (`UserNotifications`, sin FCM/Firebase)
- **Deep linking**: `walletos://reset?token=...`, `walletos://add` gestionados con `onOpenURL` nativo

---

## CI/CD — GitHub Actions

1. Lint + tests en paralelo por servicio (matrix con paths filter)
2. `docker build` de imágenes modificadas
3. Push a `ghcr.io`
4. SSH al VPS: `docker-compose pull && docker-compose up -d`

Branch protection en `main`: requiere PR, CI verde, linear history (squash only). Commits con Conventional Commits validados por commitlint en CI.

---

## Observabilidad — Grafana + Loki

- Loki colecta logs de todos los containers (via Promtail)
- Dashboards: errores HTTP por servicio, latencia p50/p95, tasa APNs, jobs AI, transacciones/día
- Alertas si un servicio no responde en 2 minutos o tasa de errores alta

---

## Cloudflare + SSL

DNS en Cloudflare, proxy activo, Certbot en VPS, Full (Strict).

---

## Fases de desarrollo

El **roadmap de ejecución detallado** (checklists, PRs, criterios "done" por fase) vive en [`ROADMAP.md`](ROADMAP.md). Esta sección es solo un resumen de alto nivel.

1. **GitHub y flujo profesional** — repo, branch protection, PR/issue templates, Dependabot, pre-commit hooks, commitlint.
2. **Cuentas externas** — Apple Developer, Google Cloud, OpenAI, Resend, AWS.
3. **Monorepo e infra local** — estructura de carpetas, `docker-compose.yml` (2x Postgres + Redis + RabbitMQ), `.env.example` por servicio, seed de categorías.
4. **CI base** — workflows de lint + tests por servicio, status checks requeridos.
5. **User Service** — auth completa, forgot/reset password, Google Sign In, DELETE /me, eventos.
6. **Wallet Service** — CRUD completo, transferencias atómicas, stats, consumer `user.deleted`.
7. **AI Service** — insights, auto-categorización, PDF, S3, scheduler, consumer `user.deleted`.
8. **Notification Service** — APNs, consumers, scheduler de recordatorio.
9. **Nginx local + E2E** — gateway, flow completo en `http://localhost/api/...`.
10. **iOS app** — todas las pantallas, widget, push, offline-first.
11. **Infra producción** — Hetzner, dominio, Cloudflare, Certbot.
12. **CD** — deploy automático vía GitHub Actions.
13. **Observabilidad producción** — Grafana + Loki.
14. **Hardening + v1.0** — rate limits, seguridad, release.

---

## Decisiones pendientes para v2

Se registran aquí los gaps conocidos que no se abordan en v1. No bloquean el lanzamiento, pero conviene documentarlos.

- **Rate limits concretos** por endpoint (reg/login/forgot especialmente). En v1 se aplicarán valores razonables por defecto en Fase 14.
- **i18n** — v1 es solo español. La UI, las notificaciones push y las plantillas de email están hardcoded en ES. v2 añade inglés.
- **Moneda única por usuario** — si un usuario cambia `default_currency`, las transacciones históricas mantienen el valor numérico pero cambian de significado. v2 podría (a) congelar la moneda tras el primer uso, (b) añadir `currency` por wallet.
- **Límites por recurso** — sin límite explícito de bancos/wallets/categorías custom por usuario. v2 añade límites blandos.
- **`updated_at` en `categories` y `device_tokens`** — ambas tablas no lo tienen. Si se necesita para trazabilidad futura, añadir.
- **Insight sin transacciones** — el job no debería generar insights para usuarios sin transacciones esa semana. v1 implementa esta guarda simple, pero la política definitiva (¿insight "semana tranquila"? ¿saltar?) es v2.
- **Timezones no enteros** — el job de recordatorio corre cada hora con ventana ±30 min, lo que cubre la mayoría. Zonas `+5:45` (Nepal) pueden recibir el recordatorio con desplazamiento. v2 puede ajustar la ventana.
- **Multi-device sync** — offline-first actual es last-write-wins. Sincronización en tiempo real entre dispositivos es v2.
- **Recuperación de transacciones borradas** — hard delete sin papelera. Undo solo durante 3s vía toast. v2 puede añadir papelera soft-delete con TTL.
