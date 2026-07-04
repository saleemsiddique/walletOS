# WalletOS — Especificaciones de pantalla (maestro)

Índice y sincronización del diseño **pantalla por pantalla** de la app iOS. Cada pantalla tendrá su archivo con el máximo detalle; este maestro da la foto global, el mapa de navegación, los componentes compartidos y **dónde continuar**.

> **⚠️ Pivote estético 2026-07-04:** la identidad mascota/mostaza se descartó y **la nueva estética (minimalista) está pendiente de estipular** — ver `docs/design-system.md`. Las specs escritas bajo la identidad antigua (`01-auth.md`, `05-home.md`) se eliminaron; las pantallas se re-especifican una a una cuando la nueva dirección esté cerrada. Las features y el flujo funcional no cambian.

---

## Cómo retomar (desde cualquier dispositivo)

1. `git checkout develop && git pull`.
2. Leer, en este orden: `docs/phase-10-ios-app.md` (plan de ramas y estado), `docs/design-system.md` (dirección estética — en redefinición), este archivo (mapa de pantallas y componentes).
3. Mirar la sección **"Dónde continuar"** (al final de este archivo) para el estado exacto.
4. Para diseñar una pantalla nueva, copiar `docs/screens/_TEMPLATE.md` a `docs/screens/NN-nombre.md` y rellenarla. Al terminarla, marcar su estado en la tabla de abajo y actualizar "Dónde continuar".

Documentos hermanos: `docs/design-system.md` (identidad), `docs/phase-10-ios-app.md` (plan de ramas), `docs/user-flow-and-bdd.md` (flujo/BDD general).

---

## Decisiones de producto vigentes

| Tema             | Decisión                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma       | Swift + SwiftUI, iOS 16+, `com.walletOS.app`                                                                                                                                                   |
| **Estética**     | **Minimalista — pendiente de estipular** (paleta, tipografía, forma, movimiento). Sin mascota ni ilustración de marca                                                                          |
| Divisa / idioma  | EUR único, español único (v1)                                                                                                                                                                  |
| **Iconografía**  | **Cero emoji en la UI**, solo SF Symbols. El backend sigue guardando `icon` como emoji (Fases 5–6, sin tocar); el cliente traduce con `IconCatalog` (bidireccional, ver `design-system.md` §2) |
| UX de referencia | Añadir un gasto en 3 toques; acciones primarias en la zona del pulgar (one-hand)                                                                                                               |

Las decisiones de layout tomadas bajo la estética antigua (lista plana de wallets en Home, dos botones grandes Gasto/Ingreso, etc.) se **revisan** al estipular la nueva dirección: pueden sobrevivir, pero ya no son vinculantes.

---

## Estado de las pantallas

Estados: ⬜ pendiente · 🟡 en progreso · ✅ hecho. Todas pendientes de re-especificar bajo la nueva estética.

| #   | Pantalla                    | Archivo                      | Estado |
| --- | --------------------------- | ---------------------------- | ------ |
| 01  | Auth (login/registro)       | `01-auth.md`                 | ⬜     |
| 02  | Forgot password             | `02-forgot-password.md`      | ⬜     |
| 03  | Reset password              | `03-reset-password.md`       | ⬜     |
| 04  | Setup inicial               | `04-setup.md`                | ⬜     |
| 05  | Home                        | `05-home.md`                 | ⬜     |
| 06  | Añadir / editar transacción | `06-add-edit-transaction.md` | ⬜     |
| 07  | Cuentas                     | `07-accounts.md`             | ⬜     |
| 08  | Crear / editar banco        | `08-bank-modal.md`           | ⬜     |
| 09  | Crear / editar wallet       | `09-wallet-modal.md`         | ⬜     |
| 10  | Transacciones del wallet    | `10-wallet-transactions.md`  | ⬜     |
| 11  | Estadísticas                | `11-stats.md`                | ⬜     |
| 12  | Insights (lista)            | `12-insights-list.md`        | ⬜     |
| 13  | Detalle de insight          | `13-insight-detail.md`       | ⬜     |
| 14  | Ajustes                     | `14-settings.md`             | ⬜     |
| 15  | Widget                      | `15-widget.md`               | ⬜     |

---

## Mapa de navegación (funcional, no cambia con el pivote)

```
Auth ──▶ (Setup si GET /banks vacío) ──▶ Home
 │                                         │
 │  Forgot ─▶ (email) ─▶ deep link ─▶ Reset ─▶ Auth
 │
 └── Navegación principal: Home · Cuentas · Stats · Insights · Ajustes
     + acceso rápido a "añadir transacción" desde cualquier punto
```

La forma concreta de la navegación (tab bar, FAB, gestos…) se decide con la nueva estética.

---

## Registro de componentes compartidos

Definir una vez (design system) y reutilizar. Al crear un componente nuevo en una pantalla, añadirlo aquí. Con el pivote, el registro se reconstruye: solo sobreviven los componentes sin carga estética de la identidad antigua.

| Componente      | Descripción                                                               | Pantallas      |
| --------------- | ------------------------------------------------------------------------- | -------------- |
| `PrimaryButton` | Botón primario (estilo provisional; se re-tokeniza con la nueva estética) | Auth, Setup, … |
| `IconCatalog`   | Traducción emoji↔SF Symbol (no es UI, pero es contrato de iconografía)    | Global         |

---

## Dónde continuar

**Siguiente paso (bloqueante): sesión de diseño para estipular la nueva estética minimalista** — paleta claro/oscuro, tipografía y escala, forma (radios, densidad, elevación), movimiento y tono. Con eso cerrado:

1. Reescribir `design-system.md` y re-tokenizar `Core/Theme/*`.
2. Re-especificar las pantallas empezando por `01-auth.md` (ya implementada funcionalmente en `develop`, pendiente de re-skin) y `05-home.md`.
3. Revisar las menciones estéticas del plan de ramas (`phase-10-ios-app.md`, Ramas 14+).

**Estado de la implementación (2026-07-04):** Ramas 1–9 en `develop` (scaffold, tokens placeholder, networking, keychain, GRDB, sync engine, feature flags, auth funcional). La mascota (Rama 3) se retiró del código y los assets en el pivote. Faltan: 10–13 (Apple/Google/forgot/reset), 14 (setup), 15 (Home) — su UI espera a la nueva estética; las capas Domain/Data pueden avanzar sin ella.
