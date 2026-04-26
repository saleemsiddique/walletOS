# WalletOS — instrucciones de proyecto

## Commits

Agrupar los cambios en commits atómicos por unidad lógica de trabajo, no en un único commit por rama ni en un commit por archivo. Cada commit debe representar un cambio coherente y autónomo que tenga sentido por sí solo.

Ejemplos del patrón correcto para una rama de utilidades del user-service:

```
feat(user-service): auth lib — jwt, opaque token, bcrypt
feat(user-service): error handler — AppError classes and global middleware
feat(user-service): authenticate middleware
feat(user-service): rate limiting middleware with Redis sliding window
feat(user-service): internal auth middleware
feat(user-service): zod validators — auth and me
```

Reglas:

- Seguir Conventional Commits: `type(scope): subject`
- Scope = nombre del servicio (`user-service`, `wallet-service`, etc.) o área (`ci`, `root`)
- Subject completamente en minúsculas (requerido por commitlint)
- Un commit por middleware, un commit por grupo de libs relacionadas, un commit por grupo de validators
- No agrupar cosas no relacionadas; no separar en exceso archivos que son parte de la misma unidad
