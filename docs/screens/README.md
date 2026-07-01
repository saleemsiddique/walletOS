# WalletOS — Especificaciones de pantalla (maestro)

Índice y sincronización del diseño **pantalla por pantalla** de la app iOS. Cada pantalla tiene su archivo con el máximo detalle; este maestro da la foto global, el mapa de navegación, los componentes compartidos y **dónde continuar**.

> **Última actualización:** 2026-07-01 — base creada. Pantallas aún sin detallar (se hacen una a una).

---

## Cómo retomar (desde cualquier dispositivo)

1. `git fetch && git checkout feature/docs-phase-10-plan && git pull`
2. Abrir este archivo (`docs/screens/README.md`) y mirar la sección **"Dónde continuar"** (al final).
3. Para diseñar una pantalla, copiar `docs/screens/_TEMPLATE.md` a `docs/screens/NN-nombre.md` y rellenarla.
4. Al terminar una pantalla: marcar su estado en la tabla de abajo y actualizar "Dónde continuar".

Documentos hermanos: `docs/design-system.md` (identidad), `docs/mascot-animation-catalog.md` (clips), `docs/phase-10-ios-app.md` (plan de ramas).

---

## Decisiones de producto bloqueadas

| Tema                   | Decisión                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma             | Swift + SwiftUI, iOS 16+, `com.walletOS.app`                                                                                      |
| Personaje              | Cartera mascota; 4 estados = termómetro de dinero (`empty→serene→happy→overflow`)                                                 |
| Animación              | Clips de vídeo (Midjourney), hábitat mostaza, disparo por evento, placeholder PNG; motor `MascotView` (rama `feature/ios-mascot`) |
| Color                  | Claro (cuero+mostaza+crema) + oscuro **sepia monocromático**                                                                      |
| Tipografía             | SF Pro Rounded; importes con dígitos monoespaciados                                                                               |
| **Home — carteras**    | **Agrupadas por banco** por defecto; opción en Ajustes de cambiar a "favoritas" (manual) o "recientes" (auto local)               |
| **Home — preferencia** | La organización elegida se guarda **local en el dispositivo** (no en backend)                                                     |
| **Home — acción**      | **Dos botones grandes** `− Gasto` (coral) / `+ Ingreso` (verde), en zona del pulgar (**one-hand-friendly**)                       |
| Divisa / idioma        | EUR único, español único (v1)                                                                                                     |

> "Carteras más usadas" no la da el backend (no hay métrica de uso). Se aproxima en cliente ("recientes" = actividad local) o se deja manual ("favoritas"). Default = por banco.

---

## Estado de las pantallas

Estados: ⬜ pendiente · 🟡 en progreso · ✅ hecho.

| #   | Pantalla                    | Archivo                      | Estado | Slots de mascota previstos |
| --- | --------------------------- | ---------------------------- | ------ | -------------------------- |
| 01  | Auth (login/registro)       | `01-auth.md`                 | ⬜     | M-05 wave                  |
| 02  | Forgot password             | `02-forgot-password.md`      | ⬜     | —                          |
| 03  | Reset password              | `03-reset-password.md`       | ⬜     | —                          |
| 04  | Setup inicial               | `04-setup.md`                | ⬜     | M-05 wave                  |
| 05  | Home                        | `05-home.md`                 | ⬜     | M-01/02/03/04 reactiva     |
| 06  | Añadir / editar transacción | `06-add-edit-transaction.md` | ⬜     | M-02 / M-06                |
| 07  | Cuentas                     | `07-accounts.md`             | ⬜     | estado vacío               |
| 08  | Crear / editar banco        | `08-bank-modal.md`           | ⬜     | —                          |
| 09  | Crear / editar wallet       | `09-wallet-modal.md`         | ⬜     | —                          |
| 10  | Transacciones del wallet    | `10-wallet-transactions.md`  | ⬜     | estado vacío               |
| 11  | Estadísticas                | `11-stats.md`                | ⬜     | estado vacío               |
| 12  | Insights (lista)            | `12-insights-list.md`        | ⬜     | estado vacío               |
| 13  | Detalle de insight          | `13-insight-detail.md`       | ⬜     | M-08 narrate               |
| 14  | Ajustes                     | `14-settings.md`             | ⬜     | M-11 farewell              |
| 15  | Widget                      | `15-widget.md`               | ⬜     | frame por estado           |

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

| Componente                                   | Descripción                                  | Pantallas                        |
| -------------------------------------------- | -------------------------------------------- | -------------------------------- |
| `RootTabBar`                                 | Tab bar 4 tabs + FAB central                 | Global                           |
| `FloatingAddButton`                          | FAB "+" → modal transacción                  | Global                           |
| `ExpenseIncomeButtons`                       | Dos botones grandes gasto/ingreso (one-hand) | Home                             |
| `MascotView` / `MascotPanel`                 | Personaje + hábitat mostaza                  | Home, Setup, Insights, vacíos    |
| `BalanceHeadline`                            | Importe grande (balance)                     | Home, Wallet txns                |
| `MonthDeltaPill`                             | Variación % con flecha verde/coral           | Home, Stats                      |
| `TransactionRow`                             | Fila de transacción (icono, nota, importe)   | Home, Cuentas, Wallet txns       |
| `WalletChip` / `BankSection`                 | Cartera compacta / sección por banco         | Home, Cuentas                    |
| `AmountKeypad`                               | Numpad de importe                            | Modal transacción                |
| `CategoryGrid`                               | Grid de categorías 4 col.                    | Modal transacción                |
| `IconPicker` / `ColorPicker`                 | Selección de icono/color                     | Banco/Wallet modals              |
| `WalletPicker`                               | Selector de wallet (origen/destino)          | Modal transacción, transferencia |
| `EmptyState` / `ErrorState` / `LoadingState` | Estados con personaje/copys                  | Global                           |
| `Toast`                                      | Aviso con "Deshacer" (3 s)                   | Home, Wallet txns                |

---

## Dónde continuar

**Próximo paso (mañana):** diseñar las pantallas una a una, empezando por **`05-home.md`** (pantalla piloto que valida el molde con la mascota reactiva y los dos botones), usando `_TEMPLATE.md`. Orden sugerido después: 06 (modal transacción) → 01 (auth) → 04 (setup) → 07 (cuentas) → resto.

**Pendientes de integración cuando cerremos el detalle:**

- Insertar en `docs/phase-10-ios-app.md` las dos ramas nuevas: `feature/ios-design-system` (tras scaffold) y `feature/ios-mascot` (motor del personaje), y renumerar los bloques.
- Anotar la **divergencia del Home** respecto a `docs/user-flow-and-bdd.md` (pantalla 5): la fuente detallada pasa a ser `05-home.md` (carteras por banco + dos botones + mascota reactiva).
- Confirmar tamaños @3x de cada slot de mascota una vez fijados los layouts.

**Hecho hasta ahora:** `design-system.md`, `mascot-animation-catalog.md`, este maestro y `_TEMPLATE.md`. Ninguna pantalla detallada aún.
