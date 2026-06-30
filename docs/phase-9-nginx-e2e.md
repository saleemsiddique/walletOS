# WalletOS — Fase 9: Nginx local y flujo E2E

Gateway Nginx que centraliza el acceso a los cuatro microservicios bajo un único punto de entrada (`http://localhost/api/...`), replicando exactamente cómo la app iOS verá el backend. La fase también define y ejecuta el flujo de verificación end-to-end completo con todos los servicios arriba al mismo tiempo.

## Estado de ejecución

✅ **Verificación E2E completada (2026-06-30) con el stack completo en Docker. Los 8 escenarios pasan** (con claves reales de OpenAI y AWS). La verificación destapó y corrigió **4 bugs reales** que la implementación daba por hechos — ver "Bugs encontrados y corregidos".

| Rama                        | Estado | Commit    |
| --------------------------- | ------ | --------- |
| 1 infra-nginx-gateway       | ✅     | `02afbac` |
| 2 docs-bruno-collection     | ✅     | `44a65e1` |
| E2E verification (portátil) | ✅     | 8/8       |

### Bugs encontrados y corregidos durante la verificación

1. **Gateway nginx — rutas de colección sin barra final.** Los `location /api/banks/`, `/api/transactions/`, etc. (con barra) devolvían `301` ante `POST /api/banks` o `GET /api/transactions` (sin barra), que es como el API define las colecciones. Corregido a prefijos **sin** barra final (`location /api/banks`), que matchean tanto la colección como los sub-recursos. `infra/nginx/nginx.conf`.
2. **Contrato del evento `user.deleted`.** User Service publicaba el payload plano `{ user_id }`, pero el contrato canónico y los 3 consumers esperan `{ event, timestamp, data: { user_id } }`. El borrado en cascada (Wallet/AI/Notification) estaba **completamente roto**. Corregido el publisher + su test. `services/user-service/src/services/user.service.ts`.
3. **`Dockerfile.dev` de los 3 servicios Node sin `prisma generate` ni migración.** Crasheaban al boot (`@prisma/client did not initialize`). Añadido `RUN npx prisma generate` y `CMD … npx prisma migrate deploy && npm run dev`.
4. **`Dockerfile.dev` de ai-service no aplicaba migraciones Alembic** (arrancaba uvicorn sin `prestart.sh`); faltaba la tabla `weekly_insights`. `CMD` ahora ejecuta `alembic upgrade head` antes de uvicorn.

> Nota: los `.env` de los 4 servicios se alinearon para Docker (hosts = nombres de servicio, `JWT_SECRET`/`INTERNAL_SECRET`/RabbitMQ unificados). Los `.env` están gitignoreados; no se commitean.

> Gotcha operativo: `docker compose restart <servicio>` **no** relee el `env_file` (reusa el contenedor con el entorno ya horneado). Tras editar un `.env` hay que `docker compose up -d --force-recreate <servicio>`.

**Flujo de ramas:**

```
develop
 ├── feature/infra-nginx-gateway   ✅ mergeado
 ├── feature/docs-bruno-collection ✅ mergeado
main ← develop  (al cerrar la fase, tras verificación E2E)
```

---

## Contexto

Las Fases 5–8 están completas y mergeadas a `main`. Cada servicio se ha probado de forma aislada (tests unitarios e integración por fase), pero nunca todos juntos detrás de un gateway. Esta fase valida:

1. **Routing correcto** — cada path llega al servicio correcto, sin errores de prefijo.
2. **Coordinación entre servicios** — crear una transacción dispara el consumer de notification-service; eliminar un usuario propaga en cascada.
3. **Bloqueo de endpoints internos** — `/api/internal/*` no es accesible desde fuera de la red Docker.
4. **Base para la Fase 10** — la app iOS apuntará a `http://localhost/api/...`; este gateway es la interfaz que consumirá.

No hay nuevos microservicios. Solo infraestructura de enrutamiento y colección de verificación.

**Dependencias:**

- `infra/docker-compose.yml` con los 4 servicios operativos.
- Red `walletos-net` compartida (ya definida).
- Fases 5–8 en `main`.

---

## Decisiones cerradas

| Decisión                 | Elección                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Protocolo local          | **HTTP puerto 80** — sin SSL. Certbot + HTTPS en Fase 11 con el VPS real.             |
| Prefijo base del cliente | `/api/` — nginx lo elimina antes de hacer proxy a cada servicio.                      |
| Endpoints internos       | `location /api/internal/` → `return 403`. Nunca llega al servicio.                    |
| Estrategia de upstream   | Bloque `upstream` por servicio; `rewrite ^/api/(.*) /$1 break` elimina el prefijo.    |
| CORS en dev              | `Access-Control-Allow-Origin: *` a nivel de servidor (herencia a todos los location). |
| Herramienta E2E          | **Bruno** — colección como archivos `.bru` en `docs/api-collection/`, committeable.   |
| Health check del gateway | `location /health` responde 200 directamente desde nginx (no hace proxy).             |
| Imagen nginx             | `nginx:1.27-alpine`.                                                                  |

---

## Bloque A — `infra/nginx/nginx.conf`

### Rama 1 — `infra-nginx-gateway` ✅ `02afbac`

- [x] Crear `infra/nginx/nginx.conf` con bloques `upstream`, CORS, bloqueo `/api/internal/` y locations por servicio (ver configuración más abajo).
- [x] Añadir servicio `nginx` al `infra/docker-compose.yml` con imagen `nginx:1.27-alpine`, puerto `80:80`, volumen conf `:ro` y `depends_on` con `condition: service_healthy` para los 4 servicios.
- [x] Verificar que `docker compose up nginx` arranca sin errores en los logs.
- [x] `curl http://localhost/health` → `200 {"status":"ok","gateway":"nginx"}`.
- [x] `curl http://localhost/api/internal/users` → `403`.

**Criterio Done:** nginx arranca, health responde y los endpoints internos están bloqueados.

### Tabla de routing completa

| Location nginx                  | Servicio upstream      | Puerto |
| ------------------------------- | ---------------------- | ------ |
| `/api/internal/`                | — (retorna `403`)      | —      |
| `/api/register`                 | `user_service`         | 3001   |
| `/api/login`                    | `user_service`         | 3001   |
| `/api/apple`                    | `user_service`         | 3001   |
| `/api/google`                   | `user_service`         | 3001   |
| `/api/refresh`                  | `user_service`         | 3001   |
| `/api/logout`                   | `user_service`         | 3001   |
| `/api/auth/`                    | `user_service`         | 3001   |
| `/api/me`                       | `user_service`         | 3001   |
| `/api/banks/`                   | `wallet_service`       | 3002   |
| `/api/wallets/`                 | `wallet_service`       | 3002   |
| `/api/transactions/`            | `wallet_service`       | 3002   |
| `/api/transfers/`               | `wallet_service`       | 3002   |
| `/api/categories/`              | `wallet_service`       | 3002   |
| `/api/recurring/`               | `wallet_service`       | 3002   |
| `/api/stats/`                   | `wallet_service`       | 3002   |
| `/api/dashboard`                | `wallet_service`       | 3002   |
| `/api/investment-transactions/` | `wallet_service`       | 3002   |
| `/api/insights/`                | `ai_service`           | 3003   |
| `/api/categorize`               | `ai_service`           | 3003   |
| `/api/devices/`                 | `notification_service` | 3004   |
| `/api/notifications/`           | `notification_service` | 3004   |
| `/health`                       | nginx (respuesta fija) | —      |

### Configuración

```nginx
upstream user_service         { server user-service:3001; }
upstream wallet_service       { server wallet-service:3002; }
upstream ai_service           { server ai-service:3003; }
upstream notification_service { server notification-service:3004; }

server {
    listen 80;

    # CORS para dev — heredado por todos los location al no redefinirse en ninguno
    add_header Access-Control-Allow-Origin  "*"                              always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type"    always;
    add_header Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS" always;

    if ($request_method = OPTIONS) {
        return 204;
    }

    # Proxy headers comunes — se aplican en cada location via herencia
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Health check del gateway — responde desde nginx directamente
    location = /health {
        add_header Content-Type application/json;
        return 200 '{"status":"ok","gateway":"nginx"}';
    }

    # Bloquear endpoints internos
    location /api/internal/ {
        return 403;
    }

    # ── User Service ─────────────────────────────────────────────────────────
    location ~ ^/api/(register|login|apple|google|refresh|logout)$ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://user_service;
    }

    location /api/auth/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://user_service;
    }

    location /api/me {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://user_service;
    }

    # ── Wallet Service ────────────────────────────────────────────────────────
    location /api/banks/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    location /api/wallets/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    location /api/transactions/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    location /api/transfers/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    location /api/categories/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    location /api/recurring/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    location /api/stats/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    location /api/dashboard {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    location /api/investment-transactions/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://wallet_service;
    }

    # ── AI Service ────────────────────────────────────────────────────────────
    location /api/insights/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://ai_service;
    }

    location /api/categorize {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://ai_service;
    }

    # ── Notification Service ──────────────────────────────────────────────────
    location /api/devices/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://notification_service;
    }

    location /api/notifications/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://notification_service;
    }
}
```

**Criterio Done:** `curl http://localhost/health` → `200 {"status":"ok","gateway":"nginx"}`.

---

## Bloque B — `infra/docker-compose.yml`

_(Forma parte de la Rama 1 — `infra-nginx-gateway`)_

Añadir el servicio `nginx` al `docker-compose.yml` existente, antes del bloque `networks`:

```yaml
nginx:
  image: nginx:1.27-alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
  depends_on:
    user-service:
      condition: service_healthy
    wallet-service:
      condition: service_healthy
    ai-service:
      condition: service_healthy
    notification-service:
      condition: service_healthy
  networks:
    - walletos-net
```

- Sin restart policy en dev: si el conf tiene un error de sintaxis, el contenedor falla y el mensaje de error es inmediato.
- El volumen monta el conf como solo lectura (`ro`) para evitar modificaciones accidentales desde dentro del contenedor.
- `depends_on` con `condition: service_healthy` garantiza que nginx no intenta arrancar hasta que los 4 servicios responden `/health`.

**Criterio Done:** `docker compose up nginx` arranca sin errores; los logs no muestran `[emerg]`.

---

## Bloque C — Colección Bruno E2E

### Rama 2 — `docs-bruno-collection` ✅ `44a65e1`

- [x] Crear `docs/api-collection/bruno.json`.
- [x] Crear `docs/api-collection/environments/local.bru` con `baseUrl`, `access_token`, `refresh_token`, `bank_id`, `wallet_id`, `transaction_id`.
- [x] Crear carpetas `01-auth` a `10-notifications` con un `.bru` por endpoint (ver estructura más abajo).
- [ ] Verificar que la colección abre en Bruno sin errores y el entorno `local` está disponible.
- [x] Ejecutar los 8 escenarios E2E del Bloque D. Verificados vía `curl` contra `http://localhost/api` con el stack completo en Docker: **8/8 pasan**.

**Criterio Done:** colección abre en Bruno, los 8 escenarios E2E pasan sin errores.

### Estructura de archivos

```
docs/api-collection/
├── bruno.json
├── environments/
│   └── local.bru
├── 01-auth/
│   ├── register.bru
│   ├── login.bru
│   ├── refresh.bru
│   ├── logout.bru
│   ├── forgot-password.bru
│   └── reset-password.bru
├── 02-me/
│   ├── get-me.bru
│   ├── patch-me.bru
│   └── delete-me.bru
├── 03-banks/
│   ├── create-bank.bru
│   ├── list-banks.bru
│   ├── update-bank.bru
│   └── delete-bank.bru
├── 04-wallets/
│   ├── create-wallet.bru
│   ├── list-wallets.bru
│   ├── update-wallet.bru
│   └── delete-wallet.bru
├── 05-transactions/
│   ├── create-transaction.bru
│   ├── list-transactions.bru
│   ├── get-transaction.bru
│   ├── update-transaction.bru
│   ├── delete-transaction.bru
│   └── transfer.bru
├── 06-categories/
│   ├── list-categories.bru
│   ├── create-category.bru
│   ├── update-category.bru
│   └── delete-category.bru
├── 07-recurring/
│   ├── create-recurring.bru
│   ├── list-recurring.bru
│   ├── update-recurring.bru
│   └── delete-recurring.bru
├── 08-stats/
│   ├── stats.bru
│   ├── stats-daily.bru
│   └── dashboard.bru
├── 09-ai/
│   ├── categorize.bru
│   ├── generate-insight.bru
│   ├── list-insights.bru
│   ├── get-insight.bru
│   └── export-insight.bru
└── 10-notifications/
    ├── register-device.bru
    ├── delete-device.bru
    ├── list-notifications.bru
    ├── mark-read.bru
    └── read-all.bru
```

### Entorno local (`environments/local.bru`)

Variables disponibles en todas las solicitudes:

| Variable         | Valor inicial          | Se rellena al ejecutar        |
| ---------------- | ---------------------- | ----------------------------- |
| `baseUrl`        | `http://localhost/api` | —                             |
| `access_token`   | (vacío)                | Tras `login.bru`              |
| `refresh_token`  | (vacío)                | Tras `login.bru`              |
| `user_id`        | (vacío)                | Tras `get-me.bru`             |
| `bank_id`        | (vacío)                | Tras `create-bank.bru`        |
| `wallet_id`      | (vacío)                | Tras `create-wallet.bru`      |
| `transaction_id` | (vacío)                | Tras `create-transaction.bru` |

Todas las solicitudes autenticadas usan `Authorization: Bearer {{access_token}}`.

### `bruno.json`

```json
{
  "version": "1",
  "name": "WalletOS API",
  "type": "collection"
}
```

**Criterio Done:** La colección abre en Bruno sin errores; el entorno `local` aparece disponible.

---

## Bloque D — Escenarios E2E

_(Verificación manual dentro de la Rama 2 — `docs-bruno-collection`)_

Ejecutar en orden con todos los servicios arriba (`docker compose up`). El token se obtiene en el escenario 1 y se reutiliza en el resto.

- [x] Escenario 1 — Auth completo (register 201 → login 200 → refresh rotado → me 200; JWT cross-service OK)
- [x] Escenario 2 — Wallet flow (bank → wallet → transaction → list → dashboard balance actualizado)
- [x] Escenario 3 — Auto-categorización (`POST /categorize` → 200; "Mercadona" → "Comida", confidence 0.9, con OpenAI real)
- [x] Escenario 4 — Generación de insight (generate 201 con headline + 6 facts; GET insight 200; lista 200; export devuelve URL pre-signed S3 y el **PDF descarga** — 3 páginas, ~54 KB)
- [x] Escenario 5 — Password reset (forgot 204, reset 204, login nueva 200, login antigua 401; envío real por Resend sin error. Lectura del email en bandeja queda manual)
- [x] Escenario 6 — Cascade delete (DELETE /me 204 → login 401; vía evento `user.deleted` corregido, wallets/transactions/banks del user = 0)
- [x] Escenario 7 — Bloqueo de endpoints internos (`/api/internal/{users,transactions,categories}` → 403 desde nginx)
- [x] Escenario 8 — Health checks (`/health` → 200 `{"status":"ok","gateway":"nginx"}`)

### Escenario 1 — Auth completo

| Paso | Request                                          | Verificación                 |
| ---- | ------------------------------------------------ | ---------------------------- |
| 1    | `POST /api/register` `{ email, password, name }` | 201; `access_token` presente |
| 2    | `POST /api/login` `{ email, password }`          | 200; nuevos tokens           |
| 3    | `POST /api/refresh` `{ refresh_token }`          | 200; `refresh_token` rotado  |
| 4    | `GET /api/me`                                    | 200; datos del usuario       |

### Escenario 2 — Wallet flow

| Paso | Request                                                                               | Verificación             |
| ---- | ------------------------------------------------------------------------------------- | ------------------------ |
| 1    | `POST /api/banks` `{ name }`                                                          | 201                      |
| 2    | `POST /api/banks/:id/wallets` `{ name, type: "CASH" }`                                | 201                      |
| 3    | `POST /api/wallets/:id/transactions` `{ amount, type: "EXPENSE", date, category_id }` | 201                      |
| 4    | `GET /api/transactions`                                                               | 200; transacción aparece |
| 5    | `GET /api/dashboard`                                                                  | 200; balance actualizado |

### Escenario 3 — Auto-categorización

| Paso | Request                                                         | Verificación                                       |
| ---- | --------------------------------------------------------------- | -------------------------------------------------- |
| 1    | `POST /api/categorize` `{ note: "Mercadona", type: "EXPENSE" }` | 200; `category_id` no nulo con `confidence >= 0.5` |

### Escenario 4 — Generación de insight

| Paso | Request                                | Verificación                                          |
| ---- | -------------------------------------- | ----------------------------------------------------- |
| 1    | `POST /api/insights/generate`          | 201 (con datos) o 204 (sin transacciones)             |
| 2    | `GET /api/insights/:week_start`        | 200; `headline`, `facts`, `recommendations` presentes |
| 3    | `GET /api/insights/:week_start/export` | 200; URL S3 pre-signed; PDF descargable               |

### Escenario 5 — Password reset

| Paso | Request                                                   | Verificación                 |
| ---- | --------------------------------------------------------- | ---------------------------- |
| 1    | `POST /api/auth/forgot-password` `{ email }`              | 204 siempre                  |
| 2    | Revisar bandeja en Resend dashboard                       | Email recibido con deep link |
| 3    | `POST /api/auth/reset-password` `{ token, new_password }` | 204                          |
| 4    | `POST /api/login` con nueva contraseña                    | 200; tokens válidos          |
| 5    | `POST /api/login` con contraseña anterior                 | 401                          |

### Escenario 6 — Cascade delete

| Paso | Request                                                                               | Verificación      |
| ---- | ------------------------------------------------------------------------------------- | ----------------- |
| 1    | Registrar usuario nuevo, crear banco + wallet + transacción                           | Datos confirmados |
| 2    | `DELETE /api/me`                                                                      | 204               |
| 3    | `POST /api/login` con las credenciales del usuario eliminado                          | 401               |
| 4    | Verificar en DB que `wallets`, `transactions` y `weekly_insights` del user no existen | Sin filas         |

### Escenario 7 — Bloqueo de endpoints internos

| Paso | Request                          | Verificación                            |
| ---- | -------------------------------- | --------------------------------------- |
| 1    | `GET /api/internal/users`        | 403 (desde nginx, no llega al servicio) |
| 2    | `GET /api/internal/transactions` | 403                                     |
| 3    | `GET /api/internal/categories`   | 403                                     |

### Escenario 8 — Health checks

| Paso | Request       | Verificación                            |
| ---- | ------------- | --------------------------------------- |
| 1    | `GET /health` | 200 `{"status":"ok","gateway":"nginx"}` |

---

## Criterio "Done" de la Fase 9

- `docker compose up` levanta los 4 servicios + nginx sin errores de arranque.
- `GET http://localhost/health` → `200 {"status":"ok","gateway":"nginx"}`.
- Los 8 escenarios E2E completan sin errores (respuestas HTTP correctas, datos esperados presentes).
- `GET /api/internal/users` retorna `403` desde nginx.
- La colección Bruno está committada en `docs/api-collection/` y abre correctamente en Bruno.

---

## Archivos críticos

| Path                                         | Estado                    |
| -------------------------------------------- | ------------------------- |
| `infra/nginx/nginx.conf`                     | ✅ Creado (`02afbac`)     |
| `infra/docker-compose.yml`                   | ✅ Bloque `nginx` añadido |
| `docs/api-collection/bruno.json`             | ✅ Creado (`44a65e1`)     |
| `docs/api-collection/environments/local.bru` | ✅ Creado                 |
| `docs/api-collection/**/*.bru`               | ✅ 44 solicitudes creadas |

## Commits realizados

```
02afbac feat(infra): nginx gateway — enrutamiento a los 4 servicios y bloque en docker-compose
44a65e1 docs(phase-9): colección bruno e2e — 01-auth a 10-notifications con entorno local
```
