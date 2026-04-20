# WalletOS — Plan de proyecto

## Contexto

Proyecto personal backend-heavy para expandir currículum. Sin fines comerciales. El objetivo es gestionar infraestructura propia (VPS, Docker, microservicios) alejándose de plataformas managed (Vercel, Supabase, Firebase). Se pivota de MoodOS (diario de ánimo) a una app de gestión de gastos personales con IA — algo útil en el día a día.

La app debe sentirse **rápida y a mano**: abrir, anotar un gasto en 3 toques, cerrar. Sin formularios pesados ni sensación de pereza.

> **Flujo de usuario, pantallas, jerarquía de datos y schemas SQL detallados:** ver [`user-flow-and-bdd.md`](user-flow-and-bdd.md)
>
> **Roadmap táctico de ejecución (fases, checklists):** ver [`ROADMAP.md`](ROADMAP.md)

---

## Descripción

App iOS de gestión de finanzas personales. El usuario organiza sus finanzas por **bancos** (Santander, N26, etc.) y dentro de cada banco tiene **wallets** (ahorro, nómina, conjunta...). En cada wallet registra **transacciones** (gasto, ingreso o transferencia entre wallets) con categoría, cantidad y comentario opcional. La IA genera un resumen semanal de hábitos de gasto, y puede auto-categorizar transacciones a partir de la descripción.

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
| Caché / Blacklist    | Redis (compartido)                                             |
| Mensajería asíncrona | RabbitMQ                                                       |
| Object storage       | AWS S3 (bucket dev y bucket prod)                              |
| Email transaccional  | Resend                                                         |
| API Gateway          | Nginx                                                          |
| SSL                  | Certbot (Let's Encrypt) + Cloudflare Full Strict               |
| Servidor             | Hetzner VPS (4 vCPU ARM, 8GB RAM, 80GB SSD)                    |
| Contenedores         | Docker + docker-compose                                        |
| CI/CD                | GitHub Actions + ghcr.io                                       |
| Observabilidad       | Grafana + Loki                                                 |
| iOS                  | Swift + SwiftUI                                                |

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
│   ├── user-service/                 # Node.js + Express + Prisma  :8001
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   ├── wallet-service/               # Node.js + Express + Prisma  :8002
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   ├── ai-service/                   # Python + FastAPI + SQLAlchemy :8003
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── alembic/
│   │   └── src/
│   └── notification-service/         # Node.js + Express + Prisma  :8004
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
user-service          :8001
wallet-service        :8002
ai-service            :8003
notification-service  :8004
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

### User Service — :8001

**Responsabilidades:** registro, login con email/password, Apple Sign In, Google Sign In, JWT (access + refresh con rotación y blacklist), forgot/reset password (vía Resend), eliminación de cuenta, perfil, timezone, moneda preferida, preferencias de notificación.

**Entidades:** User (con `google_id`, `apple_id` y campos `reminder_enabled`, `high_spend_enabled`, `high_spend_threshold`), RefreshToken, PasswordResetToken — schemas en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#walletOS_users--user-service).

**Endpoints:** 11 públicos + 2 internos — contratos detallados en [`api-contracts.md`](api-contracts.md#user-service--8001-apiusers).

Resumen: register, login, apple, google, refresh, logout, forgot-password, reset-password, GET/PATCH/DELETE me, `/internal/users`, `/internal/users/:id`.

**Eventos RabbitMQ publicados:**

- `user.registered { user_id, email, name, timezone, default_currency }`
- `user.updated { user_id, changed_fields }` — solo cuando cambian timezone o preferencias de notificación
- `user.deleted { user_id }` — tras `DELETE /me`, para que otros servicios limpien sus datos

---

### Wallet Service — :8002

**Responsabilidades:** CRUD de bancos, CRUD de wallets, CRUD de transacciones, transferencias entre wallets, categorías, balances, estadísticas.

**Endpoints:** 21 endpoints públicos + 2 internos — contratos detallados en [`api-contracts.md`](api-contracts.md#wallet-service--8002).

Resumen: GET /dashboard, CRUD bancos, CRUD wallets, CRUD transacciones, POST /transfers, CRUD categorías (predefinidas + custom), GET /stats, GET /stats/daily, GET /internal/transactions, GET /internal/categories.

**Entidades:** Bank, Wallet, Transaction, Category — schemas en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#walletOS_wallets--wallet-service).

**Categorías predefinidas (seed):**

- Gastos: Comida, Transporte, Ocio, Suscripciones, Compras, Salud, Casa, Educación, Otros
- Ingresos: Nómina, Freelance, Inversiones, Regalos, Otros

**Balance de un wallet:** `initial_balance + SUM(INCOME) - SUM(EXPENSE)` — calculado en query, no almacenado.

**Transferencias:** crean 2 transacciones vinculadas por `transfer_id` (EXPENSE en origen, INCOME en destino). Operación atómica en una transacción SQL. No afectan al balance total. Se excluyen de estadísticas de gasto.

**Offline-first:** `POST /wallets/:id/transactions` acepta un `id?` opcional generado por el cliente iOS para soportar sincronización offline (ver sección _Sincronización offline-first_).

**Eventos RabbitMQ publicados:**

- `transaction.created { user_id, transaction_id, wallet_id, type, amount, category_id, category_name, date, transfer_id }`

**Eventos RabbitMQ consumidos:**

- `user.deleted` → borra bancos, wallets, transacciones y categorías custom del usuario.

---

### AI Service — :8003

**Responsabilidades:** insights semanales de gasto, auto-categorización de transacciones, exportación PDF.

**Endpoints:** 5 públicos — contratos detallados en [`api-contracts.md`](api-contracts.md#ai-service--8003-apiai).

Resumen: GET /insights, GET /insights/{week_start}, POST /insights/generate, GET /insights/{week_start}/export, POST /categorize.

**Flujo del insight semanal:**

1. Llama a Wallet Service: `GET http://wallet-service:8002/internal/transactions?user_id=X&from=...&to=...`
2. Construye prompt con: transacciones de la semana agrupadas por categoría, totales, comparativa con semana anterior
3. Llama a OpenAI → genera el texto del insight (patrones de gasto, sugerencias de ahorro, observaciones)
4. Renderiza PDF con gráfico de categorías + texto
5. Sube a S3: `walletos-exports-{env}/{user_id}/{week_start}.pdf`
6. Guarda en DB
7. Publica `insight.generated { user_id, week_start }`

**Auto-categorización:**

- El usuario escribe una nota al crear la transacción (ej: "Mercadona", "Uber al aeropuerto", "Sueldo marzo")
- El endpoint `/categorize` recibe el texto y devuelve la categoría sugerida
- Se usa un prompt ligero con las categorías del usuario como contexto
- La app iOS llama a esto en tiempo real mientras el usuario escribe (debounce 500ms)
- Si el usuario no escribe nota, la app no llama al endpoint — el usuario elige categoría manualmente

**Scheduled job:** cada lunes a las 6:00 UTC (APScheduler).

**Entidades:** WeeklyInsight — schema en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#walletOS_ai--ai-service).

**S3:**

- Bucket dev: `walletos-exports-dev`
- Bucket prod: `walletos-exports-prod`
- Path: `{user_id}/{week_start}.pdf`
- URLs firmadas con TTL de 1 hora

**Eventos RabbitMQ consumidos:**

- `user.deleted` → borra los insights del usuario y los objetos S3 asociados.

---

### Notification Service — :8004

**Responsabilidades:** device tokens APNs, push notifications, recordatorios. Corre un scheduler interno (`node-cron`) cada hora para el recordatorio diario.

**Endpoints:** 2 públicos — contratos en [`api-contracts.md`](api-contracts.md#notification-service--8004-apinotifs). POST /tokens, DELETE /tokens/:token.

**Push notifications:**

- **Recordatorio diario (21:00 hora local, ventana ±30 min):** "¿Has anotado tus gastos de hoy?" — solo si no ha registrado ninguna transacción ese día. Comprueba contra Wallet Service internamente. Redis key `notif:{user_id}:{date}:reminder` con TTL 2h para evitar duplicados.
- **Insight listo:** al recibir `insight.generated` → "Tu resumen semanal está listo"
- **Gasto alto:** al recibir `transaction.created` con amount > umbral configurable por usuario → "Has registrado un gasto de X€ en {categoría}" (opcional, se puede activar/desactivar)

**Eventos RabbitMQ escuchados:**

| Evento                | Acción                                                                     |
| --------------------- | -------------------------------------------------------------------------- |
| `transaction.created` | Marca día como activo (suprime recordatorio) + evalúa alerta de gasto alto |
| `insight.generated`   | Push "Tu resumen semanal está listo"                                       |
| `user.registered`     | Sin acción directa                                                         |
| `user.deleted`        | Borra los `device_tokens` del usuario                                      |

**Entidades:** DeviceToken — schema en [`user-flow-and-bdd.md`](user-flow-and-bdd.md#walletOS_notifications--notification-service).

---

## Autenticación interna entre servicios

Los endpoints `/internal/*` solo son llamados por otros servicios dentro de la red Docker. No se exponen a través de Nginx: el gateway rechaza cualquier ruta que contenga `/internal/`.

Como defensa en profundidad, todos los endpoints `/internal/*` exigen una cabecera compartida:

```
X-Internal-Secret: {shared_secret}
```

El secret es una variable de entorno (`INTERNAL_SECRET`) que comparten los 4 servicios. Un middleware en cada servicio valida la cabecera y devuelve `401` si falta o no coincide. El secret se rota desde el gestor de secretos cuando sea necesario.

---

## Sincronización offline-first (iOS)

Para que la app se sienta inmediata al anotar un gasto (3 toques), las transacciones se guardan en CoreData antes de hablar con el servidor.

**Estrategia:**

1. **UUIDs generados en cliente.** El cliente iOS genera un `UUID v4` al crear cualquier recurso (transacción, banco, wallet). El endpoint `POST /wallets/:id/transactions` acepta un campo `id?` opcional; si viene, se usa; si no, el servidor genera uno.
2. **Cola FIFO en CoreData.** Cada operación pendiente se encola con su payload completo y un estado (`pending`, `syncing`, `failed`).
3. **Sincronización al reconectar.** Cuando el dispositivo detecta conexión, drena la cola en orden.
4. **Reintentos.** Cada operación se reintenta hasta 5 veces con backoff exponencial. Si persiste el error, queda `failed` y se muestra en un banner para que el usuario decida (reintentar o descartar).
5. **Resolución de conflictos.** Last-write-wins: si el servidor detecta una transacción con el mismo `id` pero contenido distinto, gana la escritura más reciente por `updated_at`. No se fusionan campos.
6. **Operaciones no-idempotentes.** Eliminar una transacción con `transfer_id` borra el par en el servidor; la cola de iOS debe tratar esto como una sola operación.

Esta estrategia no cubre sincronización multi-dispositivo en tiempo real (eso es v2). Si el usuario usa dos dispositivos, el más reciente en hablar con el servidor gana.

---

## Infraestructura compartida

### Nginx — API Gateway

```nginx
/api/users/        → http://user-service:8001
/api/auth/         → http://user-service:8001
/api/dashboard/    → http://wallet-service:8002
/api/banks/        → http://wallet-service:8002
/api/wallets/      → http://wallet-service:8002
/api/transactions/ → http://wallet-service:8002
/api/transfers/    → http://wallet-service:8002
/api/categories/   → http://wallet-service:8002
/api/stats/        → http://wallet-service:8002
/api/ai/           → http://ai-service:8003
/api/notifs/       → http://notification-service:8004
```

Nginx rechaza cualquier URI que contenga `/internal/` con 404.

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

| Uso                            | Key pattern                       | TTL                        |
| ------------------------------ | --------------------------------- | -------------------------- |
| Blacklist refresh tokens       | `blacklist:{token_hash}`          | Hasta expiración del token |
| Rate limiting                  | `rate:{ip}` / `rate:{user_id}`    | Ventana configurable       |
| Día con actividad              | `activity:{user_id}:{date}`       | 26 horas                   |
| Recordatorio enviado           | `notif:{user_id}:{date}:reminder` | 2 horas                    |
| Cache categorías usuario       | `cat:user:{user_id}:categories`   | 24 horas                   |
| Cache resultado categorización | `cat:{hash(note+type+user_id)}`   | 24 horas                   |

### RabbitMQ

```
Exchange: walletOS.events (tipo: topic, durable)

Routing key             Publicado por       Consumido por
─────────────────────────────────────────────────────────
user.registered         User Service        (sin consumidores activos)
user.updated            User Service        (sin consumidores activos)
user.deleted            User Service        Wallet, AI, Notification
transaction.created     Wallet Service      Notification Service
insight.generated       AI Service          Notification Service
```

Payloads detallados en [`api-contracts.md`](api-contracts.md#eventos-rabbitmq).

---

## iOS — Swift + SwiftUI

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

- **Clean Architecture**: Domain, Data, Presentation
- **Repository pattern**: `UserRepository`, `BankRepository`, `WalletRepository`, `TransactionRepository`, `InsightRepository`, `TokenRepository`
- **Silent token refresh**: interceptor 401 → refresh → reintento transparente
- **CoreData (offline-first)**: ver sección _Sincronización offline-first_
- **Widget de pantalla de inicio**: balance total + gasto del día. Tap abre el modal de añadir transacción vía deep link `walletos://add`.
- **Push notifications**: permisos + registro APNs al login
- **Deep linking**: `walletos://reset?token=...`, `walletos://add`

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
