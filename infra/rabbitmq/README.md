# RabbitMQ — WalletOS

## Topic exchange

Nombre: `walletOS.events`  
Tipo: `topic`

## Eventos

| Routing key           | Publicado por  | Consumido por                                    |
| --------------------- | -------------- | ------------------------------------------------ |
| `transaction.created` | wallet-service | notification-service                             |
| `insight.generated`   | ai-service     | notification-service                             |
| `user.deleted`        | user-service   | wallet-service, ai-service, notification-service |

## Convención

Cada servicio declara el exchange y sus propias queues de forma idempotente al arrancar
(`durable: true`, `assertExchange` + `assertQueue` + `bindQueue`).
No se precrean exchanges ni queues aquí.

## Acceso en dev

- UI de management: http://localhost:15672
- Usuario y contraseña: los definidos en `infra/.env` (`RABBITMQ_PASSWORD`).
