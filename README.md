# WalletOS

WalletOS es una aplicación de finanzas personales offline-first para iOS. Permite gestionar bancos, carteras y transacciones, generar insights semanales con IA y exportarlos en PDF, todo desde una app nativa en SwiftUI respaldada por una arquitectura de microservicios.

## Documentación de diseño

- [PLAN.md](PLAN.md) — Arquitectura, servicios y decisiones técnicas
- [api-contracts.md](api-contracts.md) — Contratos de la API REST por servicio
- [user-flow-and-bdd.md](user-flow-and-bdd.md) — Flujos de usuario y escenarios BDD

## Stack

| Capa                         | Tecnología                                |
| ---------------------------- | ----------------------------------------- |
| iOS                          | Swift 5.9+, SwiftUI, CoreData             |
| User / Wallet / Notification | Node.js 20, TypeScript, Prisma, Express   |
| AI                           | Python 3.12, FastAPI, SQLAlchemy, Alembic |
| Base de datos                | PostgreSQL 16                             |
| Mensajería                   | RabbitMQ                                  |
| Caché                        | Redis                                     |
| Storage                      | AWS S3                                    |
| Email                        | Resend                                    |
| Infra                        | Hetzner VPS, Cloudflare, Nginx, Docker    |

## Convención de ramas

| Tipo    | Patrón                   | Ejemplo                      |
| ------- | ------------------------ | ---------------------------- |
| Feature | `feature/<scope>-<desc>` | `feature/user-service-login` |
| Fix     | `fix/<scope>-<desc>`     | `fix/wallet-service-balance` |
| Chore   | `chore/<desc>`           | `chore/update-dependencies`  |

## Desarrollo local

```bash
# Levantar infra (Postgres, Redis, RabbitMQ)
cd infra && docker compose up -d
```

Ver `infra/README.md` para instrucciones completas.

## CI Status

<!-- badge placeholder — se añade en Fase 4 -->

## Licencia

Source available. Copyright (c) 2026 Saleem Siddique. All Rights Reserved. Ver [LICENSE](LICENSE).
