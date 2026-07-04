# WalletOS — Design System

Identidad visual y de interacción de la app iOS. Fuente única para color, tipografía, componentes, movimiento y tono de voz. Todas las pantallas (`docs/screens/`) se construyen contra estos tokens.

> **⚠️ EN REDEFINICIÓN (pivote 2026-07-04).** La identidad anterior (mascota cartera + mostaza/cuero/crema) **se ha descartado por completo**: la mascota se eliminó del código, de los assets y del planning. La nueva dirección es **minimalista** y está **pendiente de estipular** en una sesión de diseño (paleta, tipografía, forma, movimiento, tono). Hasta entonces:
>
> - Los tokens de código de la Rama 2 (`Core/Theme/*`, asset catalog) siguen compilando como **placeholder** — se re-tokenizarán al cerrar la nueva estética.
> - No diseñar ni construir pantallas nuevas contra la estética antigua.
> - Este documento se reescribirá entonces; las secciones de abajo son lo único ya decidido que sobrevive al pivote.

---

## 1. Dirección (a estipular)

Principios acordados de partida — el detalle se decide en la sesión de diseño:

- **Minimalismo:** interfaz limpia, contenido primero, sin ilustración de marca ni personaje.
- **Simplicidad radical:** cada pantalla resuelve una cosa; añadir un gasto en 3 toques (se mantiene como norte de UX).
- **Una mano:** las acciones primarias viven en la zona del pulgar (se mantiene).

Pendiente de decidir: paleta (claro/oscuro), tipografía y escala, forma (radios, densidad, elevación), movimiento, tono de copys, iconografía visual del branding.

## 2. Decisiones que sobreviven al pivote

- **Iconografía funcional — cero emoji en la UI, solo SF Symbols.** El backend sigue guardando `icon` como emoji (Fases 5–6, sin tocar); el cliente traduce con `IconCatalog` (`Core/IconCatalog.swift`, bidireccional, con fallback `ellipsis.circle` / `questionmark.circle`). Catálogo emoji↔symbol v1 en el propio archivo.
- **Moneda:** formato EUR con `FormatStyle`/`Locale es_ES`; importes con dígitos monoespaciados (`.monospacedDigit()`).
- **Accesibilidad como requisito:** contraste AA en todos los pares texto/fondo (test de la Rama 2), Dynamic Type en todos los textos, Reduce Motion respetado, objetivos de toque ≥ 44 pt (primarios 56–64 pt).
- **Idioma:** español único en v1 (String Catalog preparado para `en`).

## 3. Referencias

- Plan de fase iOS: `docs/phase-10-ios-app.md`.
- Contratos de datos: `docs/api-contracts.md`.
- Flujos y BDD: `docs/user-flow-and-bdd.md`.
- Specs de pantalla: `docs/screens/` (se rehacen bajo la nueva estética).
