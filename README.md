# WalletOS

WalletOS es una aplicación de finanzas personales offline-first para iOS. Permite gestionar bancos, carteras y transacciones, generar insights semanales con IA y exportarlos en PDF, todo desde una app nativa en SwiftUI respaldada por una arquitectura de microservicios.

## Documentación de diseño

- [docs/PLAN.md](docs/PLAN.md) — Arquitectura, servicios y decisiones técnicas
- [docs/api-contracts.md](docs/api-contracts.md) — Contratos de la API REST por servicio
- [docs/user-flow-and-bdd.md](docs/user-flow-and-bdd.md) — Flujos de usuario y escenarios BDD
- [docs/phase-10-ios-app.md](docs/phase-10-ios-app.md) — Plan de la app iOS (Fase 10): ramas, estructura feature-first y estado
- [docs/design-system.md](docs/design-system.md) — Design system de la app (color, tipografía, mascota, iconografía)
- [ios/README.md](ios/README.md) — Cómo generar, compilar y correr la app iOS

## Stack

| Capa                         | Tecnología                                         |
| ---------------------------- | -------------------------------------------------- |
| iOS                          | Swift + SwiftUI (iOS 16+), GRDB (SQLite), XcodeGen |
| User / Wallet / Notification | Node.js 20, TypeScript, Prisma, Express            |
| AI                           | Python 3.12, FastAPI, SQLAlchemy, Alembic          |
| Base de datos                | PostgreSQL 16                                      |
| Mensajería                   | RabbitMQ                                           |
| Caché                        | Redis                                              |
| Storage                      | AWS S3                                             |
| Email                        | Resend                                             |
| Infra                        | Hetzner VPS, Cloudflare, Nginx, Docker             |

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

[![CI](https://github.com/saleemsiddique/walletOS/actions/workflows/ci.yml/badge.svg)](https://github.com/saleemsiddique/walletOS/actions/workflows/ci.yml)

## Licencia

Source available. Copyright (c) 2026 Saleem Siddique. All Rights Reserved. Ver [LICENSE](LICENSE).
