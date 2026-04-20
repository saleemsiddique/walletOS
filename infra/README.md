# infra

Infraestructura local de WalletOS: Postgres (×2), Redis y RabbitMQ vía Docker Compose.

## Arranque

```bash
cd infra

# 1. Copiar el archivo de variables de entorno y rellenar los passwords
cp .env.example .env

# 2. Levantar todos los servicios en segundo plano
docker compose up -d

# 3. Verificar que todos están healthy
docker compose ps
```

## Conexión a las bases de datos

```bash
# Postgres principal — 3 databases
psql postgresql://walletos:<POSTGRES_PASSWORD>@localhost:5432/walletos_users
psql postgresql://walletos:<POSTGRES_PASSWORD>@localhost:5432/walletos_wallets
psql postgresql://walletos:<POSTGRES_PASSWORD>@localhost:5432/walletos_notifications

# Postgres AI — 1 database
psql postgresql://walletos:<POSTGRES_AI_PASSWORD>@localhost:5433/walletos_ai
```

## RabbitMQ

UI de management: http://localhost:15672  
Usuario: `walletos` / Contraseña: `RABBITMQ_PASSWORD` del `.env`.

## Redis

```bash
redis-cli ping  # → PONG
```

## Seed de categorías

El seed de categorías por defecto se ejecuta desde `services/wallet-service/prisma/seed.ts`
durante el scaffold de Wallet Service (Fase 6). No hay nada que ejecutar aquí.

## Parar y limpiar

```bash
# Parar sin borrar volúmenes
docker compose down

# Parar y borrar volúmenes (borra todos los datos)
docker compose down -v
```
