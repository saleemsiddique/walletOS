# NN. Nombre de la pantalla

> Plantilla para las specs de pantalla. Copiar a `NN-nombre.md` y rellenar. Borrar estas notas.

**Estado:** ⬜ pendiente · 🟡 en progreso · ✅ hecho
**Rama iOS asociada:** `feature/ios-<...>`
**Referencias:** `design-system.md` · `api-contracts.md` · `user-flow-and-bdd.md` (pantalla N)

---

## Objetivo

Una o dos frases: qué resuelve esta pantalla para el usuario.

## Entrada y navegación

- **Se llega desde:** ...
- **Lleva a:** ...
- **Condiciones:** (p. ej. solo si `GET /banks` vacío)

## Wireframe

```
(ASCII del layout, con las zonas y componentes principales;
 marcar la zona del pulgar y LA acción primaria — solo una visible
 por pantalla, regla Ledger §7; lo secundario va a gestos nativos)
```

## Datos y endpoints

- **Endpoint(s):** método + path + campos que se usan.
- **Cache/offline:** qué se guarda en GRDB, comportamiento sin red.
- **Cola de sync:** operaciones que encola (si escribe).

## Componentes

- Lista de componentes. Marcar cuáles son **compartidos** (registro en `screens/README.md`) y cuáles nuevos.

## Tokens usados

- Color / tipografía / espaciado relevantes (referenciar tokens Ledger, `design-system.md` §2–§4).
- Recordar: SF Mono en todo número (`hero`/`amount`); hairlines 0,5 pt en vez de tarjetas; radio único 12; color solo con significado.

## Estados de la pantalla

- **Carga:** ...
- **Vacío:** ... (copy)
- **Error:** ...
- **Offline:** ...

## Microinteracciones y haptics

- Gestos, animaciones, feedback háptico por acción.

## Accesibilidad

- Dynamic Type, VoiceOver (etiquetas clave), Reduce Motion, tamaños de toque.

## Copys / tono

- Textos clave en español (títulos, botones, vacíos, errores).

## Casos borde y validaciones

- Validaciones de entrada, límites, errores del backend (404/409/429...), rate limits.

## Estado y próximos pasos

- Qué queda por decidir o afinar en esta pantalla. **Dónde continuar.**
