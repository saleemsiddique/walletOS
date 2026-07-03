# WalletOS — Especificaciones de pantalla (maestro)

Índice y sincronización del diseño **pantalla por pantalla** de la app iOS. Cada pantalla tiene su archivo con el máximo detalle; este maestro da la foto global, el mapa de navegación, los componentes compartidos y **dónde continuar**.

> **Última actualización:** 2026-07-02 — flecos de integración cerrados (ramas de fase 10, divergencia del Home, tamaños de slot). Pantallas aún sin detallar (se hacen una a una).

---

## Cómo retomar (desde cualquier dispositivo)

1. `git checkout develop && git pull`.
2. Leer, en este orden: `docs/phase-10-ios-app.md` (plan de ramas, empezar por la Rama 1), `docs/design-system.md` (identidad: color, tipografía, mascota, iconografía), `docs/mascot-animation-catalog.md` (clips de la mascota), este archivo (mapa de pantallas y componentes) y, si ya se llegó a Home, `docs/screens/05-home.md` (única pantalla detallada por ahora).
3. Mirar la sección **"Dónde continuar"** (al final de este archivo) para el estado exacto.
4. Para diseñar una pantalla nueva, copiar `docs/screens/_TEMPLATE.md` a `docs/screens/NN-nombre.md` y rellenarla. Al terminarla, marcar su estado en la tabla de abajo y actualizar "Dónde continuar".

Documentos hermanos: `docs/design-system.md` (identidad), `docs/mascot-animation-catalog.md` (clips), `docs/phase-10-ios-app.md` (plan de ramas), `docs/user-flow-and-bdd.md` (flujo/BDD general, algo desactualizado frente a `screens/` en Home).

---

## Decisiones de producto bloqueadas

| Tema                   | Decisión                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma             | Swift + SwiftUI, iOS 16+, `com.walletOS.app`                                                                                                                                                                                                                   |
| Personaje              | Cartera mascota; 4 estados = termómetro de dinero (`empty→serene→happy→overflow`)                                                                                                                                                                              |
| Animación              | Clips de vídeo (Midjourney), hábitat mostaza, disparo por evento, placeholder PNG; motor `MascotView` (rama `feature/ios-mascot`)                                                                                                                              |
| Color                  | Claro (cuero+mostaza+crema) + oscuro **sepia monocromático**                                                                                                                                                                                                   |
| Tipografía             | SF Pro Rounded; importes con dígitos monoespaciados                                                                                                                                                                                                            |
| **Home — carteras**    | **Lista plana de wallets** (sin secciones por banco, cada una con badge del banco), orden por defecto "banco"; opción en Ajustes de cambiar a "favoritas" (manual) o "recientes" (auto local). La agrupación visual por banco es exclusiva del tab **Cuentas** |
| **Home — preferencia** | La organización elegida se guarda **local en el dispositivo** (no en backend)                                                                                                                                                                                  |
| **Home — acción**      | **Dos botones grandes** `− Gasto` (coral) / `+ Ingreso` (verde), en zona del pulgar (**one-hand-friendly**)                                                                                                                                                    |
| Divisa / idioma        | EUR único, español único (v1)                                                                                                                                                                                                                                  |
| **Iconografía**        | **Cero emoji en la UI**, solo SF Symbols. El backend sigue guardando `icon` como emoji (Fases 5–6, sin tocar); el cliente traduce con `IconCatalog` (bidireccional, ver `design-system.md` §7)                                                                 |

> "Carteras más usadas" no la da el backend (no hay métrica de uso). Se aproxima en cliente ("recientes" = actividad local) o se deja manual ("favoritas"). Default = por banco.

---

## Estado de las pantallas

Estados: ⬜ pendiente · 🟡 en progreso · ✅ hecho.

| #   | Pantalla                    | Archivo                      | Estado | Slots de mascota previstos   |
| --- | --------------------------- | ---------------------------- | ------ | ---------------------------- |
| 01  | Auth (login/registro)       | `01-auth.md`                 | ⬜     | M-05 wave                    |
| 02  | Forgot password             | `02-forgot-password.md`      | ⬜     | —                            |
| 03  | Reset password              | `03-reset-password.md`       | ⬜     | —                            |
| 04  | Setup inicial               | `04-setup.md`                | ⬜     | M-05 wave                    |
| 05  | Home                        | `05-home.md`                 | ✅     | M-01/02/03/04/07/09 reactiva |
| 06  | Añadir / editar transacción | `06-add-edit-transaction.md` | ⬜     | M-02 / M-06                  |
| 07  | Cuentas                     | `07-accounts.md`             | ⬜     | estado vacío                 |
| 08  | Crear / editar banco        | `08-bank-modal.md`           | ⬜     | —                            |
| 09  | Crear / editar wallet       | `09-wallet-modal.md`         | ⬜     | —                            |
| 10  | Transacciones del wallet    | `10-wallet-transactions.md`  | ⬜     | estado vacío                 |
| 11  | Estadísticas                | `11-stats.md`                | ⬜     | estado vacío                 |
| 12  | Insights (lista)            | `12-insights-list.md`        | ⬜     | estado vacío                 |
| 13  | Detalle de insight          | `13-insight-detail.md`       | ⬜     | M-08 narrate                 |
| 14  | Ajustes                     | `14-settings.md`             | ⬜     | M-11 farewell                |
| 15  | Widget                      | `15-widget.md`               | ⬜     | frame por estado             |

---

## Mapa de navegación

```
Auth ──▶ (Setup si GET /banks vacío) ──▶ Home
 │                                         │
 │  Forgot ─▶ (email) ─▶ deep link ─▶ Reset ─▶ Auth
 │
 └── Tab bar: [ Home | Cuentas | (+) | Stats | Insights ]  + ⚙️ Ajustes desde Home
                  │        │              │         │
              Modal +   Banco/Wallet   Detalle   Detalle
              (gasto/   modals +       (nav)     insight
               ingreso) txns wallet
```

- El **FAB central (+)** abre el modal de transacción desde cualquier tab.
- El **Home** ofrece además los dos botones grandes Gasto/Ingreso (acceso directo one-hand).
- **Ajustes** se abre con ⚙️ desde el Home.

---

## Registro de componentes compartidos

Definir una vez (design system) y reutilizar. Al crear un componente nuevo en una pantalla, añadirlo aquí.

| Componente                                   | Descripción                                                                                                                     | Pantallas                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `RootTabBar`                                 | Tab bar 4 tabs + FAB central                                                                                                    | Global                           |
| `FloatingAddButton`                          | FAB "+" → modal transacción                                                                                                     | Global                           |
| `ExpenseIncomeButtons`                       | Dos botones grandes gasto/ingreso (one-hand)                                                                                    | Home                             |
| `MascotView` / `MascotPanel`                 | Personaje + hábitat mostaza                                                                                                     | Home, Setup, Insights, vacíos    |
| `BalanceHeadline`                            | Importe grande (balance)                                                                                                        | Home, Wallet txns                |
| `MonthDeltaPill`                             | Variación % con flecha verde/coral                                                                                              | Home, Stats                      |
| `TransactionRow`                             | Fila de transacción (icono, nota, importe)                                                                                      | Home, Cuentas, Wallet txns       |
| `WalletChip`                                 | Wallet compacta con badge del banco (fila plana en Home; también dentro de `BankSection` en Cuentas)                            | Home, Cuentas                    |
| `BankSection`                                | Sección agrupada por banco (encabezado + `WalletChip` de sus wallets)                                                           | Cuentas                          |
| `AmountKeypad`                               | Numpad de importe                                                                                                               | Modal transacción                |
| `CategoryGrid`                               | Grid de categorías 4 col. (icono = SF Symbol vía `IconCatalog`, nunca el emoji crudo del backend)                               | Modal transacción                |
| `IconPicker` / `ColorPicker`                 | Grid de SF Symbols (`IconCatalog`) + color; al guardar se envía al backend el emoji emparejado, nunca se muestra emoji en la UI | Banco/Wallet modals              |
| `WalletPicker`                               | Selector de wallet (origen/destino)                                                                                             | Modal transacción, transferencia |
| `EmptyState` / `ErrorState` / `LoadingState` | Estados con personaje/copys                                                                                                     | Global                           |
| `Toast`                                      | Aviso con "Deshacer" (3 s)                                                                                                      | Home, Wallet txns                |

---

## Dónde continuar

**Cambio de método (2026-07-02):** en vez de seguir escribiendo specs de pantallas en papel, el siguiente paso es **implementar de verdad** las Ramas 1–15 de `docs/phase-10-ios-app.md` (scaffold → design system → mascota → networking/keychain/DB/sync → auth/setup → **Home**) en Xcode. Con Home compilando y visible de verdad, se valida `05-home.md` contra la realidad, se ajusta lo que haga falta, y **esa pantalla real sirve de referencia** para diseñar `06-add-edit-transaction.md` y el resto — no al revés.

No diseñar más pantallas (`06+`) hasta tener ese Home real construido y revisado.

**Estado de la implementación (2026-07-03):** ya en Mac (Xcode 26.6). **Ramas 1–8 hechas y en `develop`** — scaffold (XcodeGen, feature-first), design system, motor de la mascota (con los 4 PNG base reales integrados), capa de red (interceptor + refresh), Keychain/TokenStore, base de datos local GRDB, motor de sincronización offline-first y configuración de entornos. **Bloque B (Core/infraestructura) completo.** Faltan para llegar a Home: 9–13 (auth), 14 (setup) y 15 (**Home**). Detalle y estado por rama en `docs/phase-10-ios-app.md` → "Estado de ejecución".

**Hecho hasta ahora:**

- `design-system.md`, `mascot-animation-catalog.md`, este maestro y `_TEMPLATE.md`.
- `docs/phase-10-ios-app.md`: ramas `feature/ios-design-system` (Rama 2) y `feature/ios-mascot` (Rama 3) insertadas tras el scaffold; Rama 15 (`feature/ios-home`) sincronizada con el diseño de `05-home.md`; bloques y numeración de ramas (29 en total) sincronizados.
- `docs/user-flow-and-bdd.md` (pantalla 5, Home): wireframe y acciones actualizados al layout vigente, con referencia a `05-home.md` como spec detallada.
- `design-system.md` §3: tamaños de slot de mascota definidos (`hero` 200×200, `panel` 140×140, `inline` 88×88, `widget` 56×56 pt) — provisionales, se ajustan por pantalla si el wireframe lo pide.
- `design-system.md` §2: umbrales de balance que disparan cada estado de la mascota (`<50€ empty`, `50–500€ serene`, `500–2.000€ happy`, `>2.000€ overflow`).
- **`05-home.md` ✅ hecho:** balance + mascota reactiva, dos botones Gasto/Ingreso, **lista plana de 3 wallets fijas** (sin agrupar por banco — eso es exclusivo de Cuentas) con "ver todas", últimas transacciones con icono ⏱ para las `pending` (offline sin confirmar), banner offline con la hora exacta de los datos mostrados. Decisión clave: en Home las wallets se muestran sueltas con badge del banco, no en secciones; la jerarquía banco→wallets completa vive en el tab Cuentas.
