# notification-service

Servicio de notificaciones de WalletOS (Node.js + Express + Prisma). Puerto `3004`,
DB `walletos_notifications`. Consume eventos de `walletOS.events`, mantiene el centro
de notificaciones y envía push a iOS vía **APNs**. Plan en
[`docs/phase-8-notification-service.md`](../../docs/phase-8-notification-service.md).

## Arranque local

```bash
npm install
cp .env.example .env     # rellenar secretos
npm run dev              # tsx watch, puerto 3004
curl localhost:3004/health   # { "status": "ok" }
```

## Calidad

```bash
npm run lint
npm run typecheck
npm test
```

## Vía Docker

```bash
docker compose -f ../../infra/docker-compose.yml up notification-service
```
