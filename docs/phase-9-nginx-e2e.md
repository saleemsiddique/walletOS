# WalletOS — Fase 9: Nginx local y flujo E2E

Gateway Nginx que centraliza el acceso a los cuatro microservicios bajo un único punto de entrada (`http://localhost/api/...`), replicando exactamente cómo la app iOS verá el backend. La fase también define y ejecuta el flujo de verificación end-to-end completo con todos los servicios arriba al mismo tiempo.

## Estado de ejecución

⏳ **Fase pendiente de iniciar.**

| Item                          | Estado |
| ----------------------------- | ------ |
| `infra/nginx/nginx.conf`      | ⏳     |
| Bloque nginx en docker-compose| ⏳     |
| Colección Bruno E2E           | ⏳     |
| Escenarios E2E verificados    | ⏳     |

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

| Decisión                   | Elección                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Protocolo local            | **HTTP puerto 80** — sin SSL. Certbot + HTTPS en Fase 11 con el VPS real.            |
| Prefijo base del cliente   | `/api/` — nginx lo elimina antes de hacer proxy a cada servicio.                     |
| Endpoints internos         | `location /api/internal/` → `return 403`. Nunca llega al servicio.                   |
| Estrategia de upstream     | Bloque `upstream` por servicio; `rewrite ^/api/(.*) /$1 break` elimina el prefijo.   |
| CORS en dev                | `Access-Control-Allow-Origin: *` a nivel de servidor (herencia a todos los location). |
| Herramienta E2E            | **Bruno** — colección como archivos `.bru` en `docs/api-collection/`, committeable.  |
| Health check del gateway   | `location /health` responde 200 directamente desde nginx (no hace proxy).            |
| Imagen nginx               | `nginx:1.27-alpine`.                                                                  |

---

## Bloque A — `infra/nginx/nginx.conf`

### Tabla de routing completa

| Location nginx                 | Servicio upstream      | Puerto |
| ------------------------------ | ---------------------- | ------ |
| `/api/internal/`               | — (retorna `403`)      | —      |
| `/api/register`                | `user_service`         | 3001   |
| `/api/login`                   | `user_service`         | 3001   |
| `/api/apple`                   | `user_service`         | 3001   |
| `/api/google`                  | `user_service`         | 3001   |
| `/api/refresh`                 | `user_service`         | 3001   |
| `/api/logout`                  | `user_service`         | 3001   |
| `/api/auth/`                   | `user_service`         | 3001   |
| `/api/me`                      | `user_service`         | 3001   |
| `/api/banks/`                  | `wallet_service`       | 3002   |
| `/api/wallets/`                | `wallet_service`       | 3002   |
| `/api/transactions/`           | `wallet_service`       | 3002   |
| `/api/transfers/`              | `wallet_service`       | 3002   |
| `/api/categories/`             | `wallet_service`       | 3002   |
| `/api/recurring/`              | `wallet_service`       | 3002   |
| `/api/stats/`                  | `wallet_service`       | 3002   |
| `/api/dashboard`               | `wallet_service`       | 3002   |
| `/api/investment-transactions/`| `wallet_service`       | 3002   |
| `/api/insights/`               | `ai_service`           | 3003   |
| `/api/categorize`              | `ai_service`           | 3003   |
| `/api/devices/`                | `notification_service` | 3004   |
| `/api/notifications/`          | `notification_service` | 3004   |
| `/health`                      | nginx (respuesta fija) | —      |

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

| Variable         | Valor inicial          | Se rellena al ejecutar |
| ---------------- | ---------------------- | ---------------------- |
| `baseUrl`        | `http://localhost/api` | —                      |
| `access_token`   | (vacío)                | Tras `login.bru`       |
| `refresh_token`  | (vacío)                | Tras `login.bru`       |
| `user_id`        | (vacío)                | Tras `get-me.bru`      |
| `bank_id`        | (vacío)                | Tras `create-bank.bru` |
| `wallet_id`      | (vacío)                | Tras `create-wallet.bru` |
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

Ejecutar en orden con todos los servicios arriba (`docker compose up`). El token se obtiene en el escenario 1 y se reutiliza en el resto.

### Escenario 1 — Auth completo

| Paso | Request | Verificación |
| ---- | ------- | ------------ |
| 1 | `POST /api/register` `{ email, password, name }` | 201; `access_token` presente |
| 2 | `POST /api/login` `{ email, password }` | 200; nuevos tokens |
| 3 | `POST /api/refresh` `{ refresh_token }` | 200; `refresh_token` rotado |
| 4 | `GET /api/me` | 200; datos del usuario |

### Escenario 2 — Wallet flow

| Paso | Request | Verificación |
| ---- | ------- | ------------ |
| 1 | `POST /api/banks` `{ name }` | 201 |
| 2 | `POST /api/banks/:id/wallets` `{ name, type: "CASH" }` | 201 |
| 3 | `POST /api/wallets/:id/transactions` `{ amount, type: "EXPENSE", date, category_id }` | 201 |
| 4 | `GET /api/transactions` | 200; transacción aparece |
| 5 | `GET /api/dashboard` | 200; balance actualizado |

### Escenario 3 — Auto-categorización

| Paso | Request | Verificación |
| ---- | ------- | ------------ |
| 1 | `POST /api/categorize` `{ note: "Mercadona", type: "EXPENSE" }` | 200; `category_id` no nulo con `confidence >= 0.5` |

### Escenario 4 — Generación de insight

| Paso | Request | Verificación |
| ---- | ------- | ------------ |
| 1 | `POST /api/insights/generate` | 201 (con datos) o 204 (sin transacciones) |
| 2 | `GET /api/insights/:week_start` | 200; `headline`, `facts`, `recommendations` presentes |
| 3 | `GET /api/insights/:week_start/export` | 200; URL S3 pre-signed; PDF descargable |

### Escenario 5 — Password reset

| Paso | Request | Verificación |
| ---- | ------- | ------------ |
| 1 | `POST /api/auth/forgot-password` `{ email }` | 204 siempre |
| 2 | Revisar bandeja en Resend dashboard | Email recibido con deep link |
| 3 | `POST /api/auth/reset-password` `{ token, new_password }` | 204 |
| 4 | `POST /api/login` con nueva contraseña | 200; tokens válidos |
| 5 | `POST /api/login` con contraseña anterior | 401 |

### Escenario 6 — Cascade delete

| Paso | Request | Verificación |
| ---- | ------- | ------------ |
| 1 | Registrar usuario nuevo, crear banco + wallet + transacción | Datos confirmados |
| 2 | `DELETE /api/me` | 204 |
| 3 | `POST /api/login` con las credenciales del usuario eliminado | 401 |
| 4 | Verificar en DB que `wallets`, `transactions` y `weekly_insights` del user no existen | Sin filas |

### Escenario 7 — Bloqueo de endpoints internos

| Paso | Request | Verificación |
| ---- | ------- | ------------ |
| 1 | `GET /api/internal/users` | 403 (desde nginx, no llega al servicio) |
| 2 | `GET /api/internal/transactions` | 403 |
| 3 | `GET /api/internal/categories` | 403 |

### Escenario 8 — Health checks

| Paso | Request | Verificación |
| ---- | ------- | ------------ |
| 1 | `GET /health` | 200 `{"status":"ok","gateway":"nginx"}` |

---

## Criterio "Done" de la Fase 9

- `docker compose up` levanta los 4 servicios + nginx sin errores de arranque.
- `GET http://localhost/health` → `200 {"status":"ok","gateway":"nginx"}`.
- Los 8 escenarios E2E completan sin errores (respuestas HTTP correctas, datos esperados presentes).
- `GET /api/internal/users` retorna `403` desde nginx.
- La colección Bruno está committada en `docs/api-collection/` y abre correctamente en Bruno.

---

## Archivos críticos

| Path                                      | Acción                              |
| ----------------------------------------- | ----------------------------------- |
| `infra/nginx/nginx.conf`                  | Crear (contenido en Bloque A)       |
| `infra/docker-compose.yml`                | Añadir bloque `nginx` (Bloque B)    |
| `docs/api-collection/bruno.json`          | Crear                               |
| `docs/api-collection/environments/local.bru` | Crear                            |
| `docs/api-collection/**/*.bru`            | Crear (una solicitud por archivo)   |

## Commits esperados

```
feat(infra): nginx gateway — enrutamiento a los 4 servicios + bloque en docker-compose
docs(phase-9): colección bruno e2e — 01-auth a 10-notifications
```
