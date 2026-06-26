# WalletOS — Fase 8: Notification Service

Último servicio del backend. Node.js + Express + Prisma (mismo patrón que User y Wallet). Consume eventos del exchange `walletOS.events`, persiste un historial de notificaciones (centro de notificaciones en la app) y envía push a iOS vía **APNs**. Corre un scheduler horario para el recordatorio diario. Se construye en ramas cortas de feature, cada una con su PR a `develop`. Al terminar la fase, `develop` → `main`.

## Contexto

Las Fases 5–7 están completas en `main`. El Notification Service es **terminal**: solo consume eventos, no publica ninguno. Depende de:

- **User Service** (`GET /internal/users`, `GET /internal/users/:id`) para timezone y preferencias (`reminder_enabled`, `high_spend_enabled`, `high_spend_threshold`) con `X-Internal-Secret`. Las preferencias **viven en user-service**, no aquí.
- **RabbitMQ** `walletOS.events`: consume `user.deleted` (User), `transaction.created` (Wallet), `insight.generated` (AI).
- **Redis** compartido para idempotencia/actividad del recordatorio.
- **APNs** con la `.p8` `AuthKey_38KDR9XZDG.p8` (provisionada en Fase 2; App ID `com.walletOS.app` con capability Push Notifications).

**Base de datos:** `walletos_notifications` en la instancia Postgres principal (`:5432`).
**Puerto:** `3004`.
**Contratos de referencia:** `docs/api-contracts.md` (sección Notification Service).
**Schema SQL:** `docs/user-flow-and-bdd.md` (sección `walletOS_notifications`).
**Pantalla en la app:** centro de notificaciones (Fase 10).

### Decisiones cerradas (acordadas con el usuario)

| Decisión                 | Elección                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Cliente push             | **App nativa iOS → APNs directo** (sin FCM/Firebase, sin Android en v1).                               |
| Librería APNs            | **`apns2`** (HTTP/2 + auth por token JWT con `.p8` + keyId + teamId).                                  |
| Endpoints de dispositivo | **`/devices`** (`POST /devices`, `DELETE /devices/:token`). No `/tokens`.                              |
| Centro de notificaciones | **Sí**: tabla `notifications` + endpoints de lista/leído.                                              |
| Alcance del centro v1    | Lista paginada + `unread_count` + marcar leída(s). Tabla con `read_at`.                                |
| Preferencias de usuario  | En user-service; se consultan vía `/internal/users/:id` al enviar.                                     |
| `transaction.created`    | **Alerta de gasto alto** (no "nueva transacción"): solo si `high_spend_enabled && amount ≥ threshold`. |
| Recordatorio diario      | **21:00 hora local** del usuario, ventana ±30 min, cron horario.                                       |
| Endpoints internos       | Ninguno (0). El servicio no expone `/internal/*`.                                                      |
| Eventos publicados       | Ninguno (servicio terminal).                                                                           |

### Alineación de docs (Bloque 0)

`api-contracts.md` y el ROADMAP tenían inconsistencias resueltas en esta fase: endpoint `/tokens`→`/devices`, recordatorio 20:00→**21:00**, `platform`/FCM/Android eliminados (cliente nativo iOS), y se añade el centro de notificaciones (tabla + 3 endpoints).

---

## Endpoints públicos (5)

| Método | Ruta                      | Descripción                                                      |
| ------ | ------------------------- | ---------------------------------------------------------------- |
| POST   | `/devices`                | Alta/upsert del device token APNs del dispositivo.               |
| DELETE | `/devices/:token`         | Baja del token (al logout). Idempotente → 204.                   |
| GET    | `/notifications`          | Historial paginado (cursor, `created_at DESC`) + `unread_count`. |
| PATCH  | `/notifications/:id/read` | Marca una notificación como leída.                               |
| POST   | `/notifications/read-all` | Marca todas las del usuario como leídas.                         |

Todos requieren JWT (`Authorization: Bearer`). Filtran por el `user_id` del token.

---

## Schema (`walletos_notifications`)

```sql
CREATE TABLE device_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL,
    token      VARCHAR(500) NOT NULL UNIQUE,
    platform   VARCHAR(10)  NOT NULL DEFAULT 'ios',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL,
    type       VARCHAR(40)  NOT NULL,   -- high_spend | weekly_insight | reminder
    title      VARCHAR(120) NOT NULL,
    body       TEXT         NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'sent',  -- sent | failed (resultado APNs)
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
```

- `platform` se mantiene con default `'ios'` (futuro-proof) pero v1 solo enruta a APNs.
- La fila de `notifications` se crea **siempre** (es el registro del centro); `status` refleja el resultado del envío APNs (best-effort encima).

---

## Flujo de ramas

```
develop
 ├── feature/docs-phase-8-alcance              (Bloque 0 — este doc + alineación)
 ├── feature/notification-service-scaffold
 ├── feature/notification-service-config
 ├── feature/notification-service-prisma-schema
 ├── feature/notification-service-utilities
 ├── feature/notification-service-apns-client
 ├── feature/notification-service-user-client
 ├── feature/notification-service-sender
 ├── feature/notification-service-devices-endpoints
 ├── feature/notification-service-center-endpoints
 ├── feature/notification-service-user-deleted-consumer
 ├── feature/notification-service-transaction-created-consumer
 ├── feature/notification-service-insight-generated-consumer
 ├── feature/notification-service-reminder-cron
 └── feature/notification-service-dockerfile-prod
main ← develop  (al cerrar la fase)
```

---

## Bloque A — Scaffold y base

### Rama 1 — `notification-service-scaffold`

- `package.json` (mismo stack que wallet: `express`, `@prisma/client`, `amqplib`, `ioredis`, `jsonwebtoken`, `node-cron`, `pino`/`pino-http`, `zod`, `cors`, `helmet`, `express-rate-limit`; dev: `tsx`, `vitest`, `supertest`, `eslint`, `prettier`, `typescript`, `prisma`). Añadir **`apns2`**.
- `tsconfig.json` + `tsconfig.build.json` (CommonJS para prod, como wallet).
- Estructura `src/{controllers,services,middleware,routes,lib,config,consumers,tasks}`.
- ESLint + Prettier; script `dev` con `tsx watch`.
- `Dockerfile.dev` (hot reload), puerto `3004`.
- `GET /health` → `{ "status": "ok" }`.
- Bloque `notification-service` en `infra/docker-compose.yml` (puerto 3004, `depends_on` postgres/redis/rabbitmq, volumen `src`).
- Regla `services/notification-service/**/*.ts` en `lint-staged.config.mjs` (lint + typecheck).

**Criterio Done:** `docker compose up notification-service` arranca, `curl :3004/health` → 200.

### Rama 2 — `notification-service-config`

- `src/config/env.ts` tipado (validación Zod): `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, `JWT_SECRET`, `INTERNAL_SECRET`, `USER_SERVICE_URL`, `APNS_KEY_PATH`/`APNS_KEY` (.p8), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` (`com.walletOS.app`), `APNS_ENV` (`sandbox`|`production`), `PORT` (3004).
- Logger pino estructurado.
- Ampliar `services/notification-service/.env.example`.

**Criterio Done:** arranca y falla rápido si falta una env crítica.

---

## Bloque B — Base de datos

### Rama 3 — `notification-service-prisma-schema`

- `schema.prisma` con `DeviceToken` y `Notification` (schema de arriba).
- `prisma migrate dev --name init`.
- Índices `device_tokens(user_id)`, `notifications(user_id, created_at DESC)`, `device_tokens(token)` UNIQUE.

**Tests:** insertar token; UNIQUE en `token`; insertar notificación; round-trip.

---

## Bloque C — Utilidades y clientes

### Rama 4 — `notification-service-utilities`

Portadas de wallet/user (mismo shape): `lib/prisma.ts`, `lib/redis.ts` (ioredis), `lib/rabbitmq.ts` (amqplib, exchange `walletOS.events` topic durable, helper de consumer con ack manual), `lib/jwt.ts` (verify HS256, claim `userId`), `middleware/{authenticate,errorHandler,rateLimiter}.ts`, `validators` Zod (devices, notifications query). **Sin `internalAuth`** (no hay endpoints internos).

### Rama 5 — `notification-service-apns-client`

- `lib/apns.ts`: wrapper de **`apns2`** con `ApnsClient({ team, keyId, signingKey, host })` (host sandbox/prod según `APNS_ENV`). `sendPush(token, { title, body, type })`.
- Manejo de errores APNs: token inválido/`410 Unregistered` → devolver señal para purgar el token de `device_tokens`.

**Tests:** construir el cliente con env de test; mapear payload `{title, body}` a `aps.alert`; manejar respuesta de token caducado (mock).

### Rama 6 — `notification-service-user-client`

- `lib/userClient.ts`: `fetch` (Node 20) a `GET /internal/users/:id` y `GET /internal/users?timezone&reminder_enabled=true` con header `X-Internal-Secret`. Timeout + 1 reintento.

**Tests:** mock de fetch → parsea preferencias; incluye `X-Internal-Secret`.

### Rama 7 — `notification-service-sender`

- `services/notificationSender.ts`: función única `sendNotification(userId, { type, title, body })` que (1) **persiste** una fila en `notifications` (status según resultado), (2) carga los `device_tokens` del usuario y (3) envía APNs a cada uno; si un token devuelve `410`, lo borra. La usan los 3 consumers y el cron.

**Tests:** persiste la notificación; envía a todos los tokens; borra el token caducado; sin tokens → persiste igual (status `sent`, el centro la muestra).

---

## Bloque D — Endpoints

### Rama 8 — `notification-service-devices-endpoints`

- `POST /devices` `{ token, platform? }` → upsert por `token` (si existe para otro user, reasigna `user_id`). 201 con el registro.
- `DELETE /devices/:token` → borra; idempotente 204.
- Rate limit 60/min por user.

**Tests:** alta crea; alta repetida no duplica (upsert); reasignación de user; delete idempotente; sin JWT → 401.

### Rama 9 — `notification-service-center-endpoints`

- `GET /notifications` cursor-based (`created_at DESC`, `limit` ≤ 50), filtra por user; respuesta `{ notifications[], unread_count, next_cursor }`.
- `PATCH /notifications/:id/read` → marca `read_at`; 404 si no es del user.
- `POST /notifications/read-all` → marca todas las del user.

**Tests:** paginación; `unread_count` correcto; marcar una → baja el contador; read-all; aislamiento por user; sin JWT → 401.

---

## Bloque E — Consumers (cola dedicada por evento, durable, ack manual)

### Rama 10 — `notification-service-user-deleted-consumer`

- Cola `notification-service.user.deleted`, routing key `user.deleted`.
- Borra `device_tokens` **y** `notifications` del user. Idempotente.

### Rama 11 — `notification-service-transaction-created-consumer`

- Cola `notification-service.transaction.created`, routing key `transaction.created`.
- (1) `SET activity:{user_id}:{date}` TTL 26h (suprime recordatorio).
- (2) Si `type == EXPENSE` → `GET /internal/users/:id` → si `high_spend_enabled && amount >= high_spend_threshold` → `sendNotification(type="high_spend", "Gasto alto", "Has registrado un gasto de {amount}€ en {category_name}")`.

### Rama 12 — `notification-service-insight-generated-consumer`

- Cola `notification-service.insight.generated`, routing key `insight.generated`.
- `sendNotification(type="weekly_insight", "Resumen semanal", "Tu resumen semanal está listo")`.

**Tests (por consumer):** procesa el payload fake; idempotente; alerta de gasto alto solo cuando supera umbral y está habilitada; `activity` key seteada; error en handler → no ack → reintento.

---

## Bloque F — Scheduler

### Rama 13 — `notification-service-reminder-cron`

- `tasks/reminderCron.ts`: `node-cron` cada hora.
  1. Calcular timezones cuya hora local sea ~21:00 (ventana ±30 min).
  2. Por cada tz: `GET /internal/users?timezone={tz}&reminder_enabled=true`.
  3. Por user: skip si `EXISTS activity:{user_id}:{today}` o `EXISTS notif:{user_id}:{today}:reminder`; si no → `sendNotification(type="reminder", "Recordatorio", "¿Has anotado tus gastos de hoy?")` y `SET notif:{user_id}:{today}:reminder` TTL 2h.
- Arranque del scheduler en el bootstrap del servidor.

**Tests:** selección de timezones en la ventana; respeta `activity` y la idempotencia; envía solo a los elegibles.

---

## Bloque G — Producción

### Rama 14 — `notification-service-dockerfile-prod`

- `Dockerfile` multi-stage `node:20-alpine`, build a `dist/` (CommonJS), usuario no-root. `CMD ["node", "dist/server.js"]`. `.dockerignore`.
- Mismo patrón que `wallet-service` y `user-service`: las migraciones (`prisma migrate deploy`) **no** se ejecutan al arrancar el contenedor, se aplican en un paso externo previo al despliegue. (Pendiente unificar a migración-al-arrancar en los tres servicios en el futuro.)

**Criterio Done:** `docker build` OK, contenedor arranca y `/health` 200, usuario no-root.

---

## Criterio "Done" de la Fase 8

- Los **5 endpoints públicos** responden con JWT (devices + centro de notificaciones).
- Los **3 consumers** procesan sus eventos: `user.deleted` borra tokens + notificaciones; `transaction.created` setea actividad y envía alerta de gasto alto solo cuando procede; `insight.generated` envía el push del resumen.
- Cada push enviada queda **persistida** en `notifications` (centro de notificaciones) con su `status`.
- El **recordatorio diario** (21:00 local ±30 min) llega solo a usuarios elegibles, sin duplicados (idempotencia Redis) y sin molestar a quien ya registró gasto (`activity`).
- Tokens caducados (`410`) se purgan de `device_tokens`.
- Push llegan a un **iPhone de prueba en sandbox** APNs.
- CI verde en todos los PRs; `docker compose up notification-service` arranca contra postgres/redis/rabbitmq.

---

## Archivos críticos a crear

| Path                                                                                               | Acción                                                |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `services/notification-service/{package.json,tsconfig*.json,Dockerfile,Dockerfile.dev}`            | Crear                                                 |
| `services/notification-service/prisma/schema.prisma` + migración                                   | Crear                                                 |
| `services/notification-service/src/config/env.ts`                                                  | Crear                                                 |
| `services/notification-service/src/lib/{prisma,redis,rabbitmq,jwt,apns,userClient}.ts`             | Crear                                                 |
| `services/notification-service/src/middleware/{authenticate,errorHandler,rateLimiter}.ts`          | Crear                                                 |
| `services/notification-service/src/services/notificationSender.ts`                                 | Crear                                                 |
| `services/notification-service/src/routes` + `controllers` (devices, notifications)                | Crear                                                 |
| `services/notification-service/src/consumers/{userDeleted,transactionCreated,insightGenerated}.ts` | Crear                                                 |
| `services/notification-service/src/tasks/reminderCron.ts`                                          | Crear                                                 |
| `infra/docker-compose.yml`                                                                         | Añadir bloque 3004                                    |
| `lint-staged.config.mjs`                                                                           | Añadir regla                                          |
| `.github/workflows/ci.yml`                                                                         | Job `test-notification-service` (ya en matrix Fase 4) |
| `docs/api-contracts.md`, `ROADMAP.md`, `docs/user-flow-and-bdd.md`                                 | Alinear (Bloque 0)                                    |

---

## Patrones reutilizados de user/wallet-service

| Patrón                                              | Origen                 | Adaptación                                          |
| --------------------------------------------------- | ---------------------- | --------------------------------------------------- |
| Scaffold Express + Prisma + tsconfig build CommonJS | user/wallet            | Idéntico, puerto 3004, DB `walletos_notifications`. |
| `authenticate` JWT HS256                            | wallet                 | Mismo `JWT_SECRET`, claim `userId`.                 |
| Error handler + clases `AppError`                   | user/wallet            | Mismo shape JSON.                                   |
| Rate limiter sliding window Redis                   | user/wallet            | Mismo `lib/redis` + middleware.                     |
| Consumer RabbitMQ con cola dedicada + ack manual    | wallet/ai              | Una cola por evento, idempotente.                   |
| Cron con `node-cron`                                | wallet (recurring), ai | Recordatorio horario.                               |
| Cliente interno con `X-Internal-Secret`             | ai-service             | `fetch` a user-service.                             |
| Docker multi-stage + no-root                        | user/wallet            | `node:20-alpine`.                                   |
