# 05. Home (pantalla principal)

**Estado:** ✅ hecho
**Rama iOS asociada:** `feature/ios-home`
**Referencias:** `design-system.md` · `mascot-animation-catalog.md` · `api-contracts.md` · `user-flow-and-bdd.md` (pantalla 5)

---

## Objetivo

Dar la foto instantánea del estado financiero (balance total + mascota reactiva) y dejar registrar un gasto/ingreso en el mínimo de toques, con acceso rápido a las wallets más relevantes y al historial reciente. Es la pantalla donde el usuario vive el 90% del tiempo.

## Entrada y navegación

- **Se llega desde:** Auth (si `GET /banks` no está vacío) → directo; Setup, al completarlo; o cualquier otra tab de la `RootTabBar`.
- **Lleva a:** modal de transacción (Rama 16, crear/editar), tab Cuentas (tap en "ver todas" o en una wallet), Ajustes (⚙️).
- **Condiciones:** primera pantalla tras login solo si `GET /banks` devuelve al menos un banco (si no, va a Setup).

## Wireframe

```
┌─────────────────────────┐
│ WalletOS            ⚙️  │  ← header, no scrollea
│                         │
│       [ Mascota ]       │  ← mascot/hero 200×200pt,
│      (idle del estado)  │    hábitat mostaza
│                         │
│   Balance total          │
│   ┌───────────────────┐ │
│   │    2.450,75 €     │ │  ← BalanceHeadline
│   │  ▼ -320€ este mes │ │  ← MonthDeltaPill
│   └───────────────────┘ │
│                         │
│ ╔═══════════════════════╗│ ← zona del pulgar
│ ║ ┌────────┐┌─────────┐ ║│   (tercio inferior)
│ ║ │ − Gasto││+ Ingreso│ ║│
│ ║ └────────┘└─────────┘ ║│
│ ╚═══════════════════════╝│
│                         │
│   Tus wallets       ›  │  ← "ver todas" → tab Cuentas
│   ─────────────────────│
│   🏦 Nómina     2.100€ │  ← WalletChip: icono/color propio
│   🏦 Ahorro     1.200€ │    + badge peque. del banco (🏦/🟠)
│   🟠 Corriente    320€ │    en esquina; SIN secciones/
│   ─────────────────────│    encabezados de banco.
│                         │    Fijo: 3 filas, el resto por
│                         │    "ver todas" → Cuentas.
│                         │
│   Últimas transacciones │
│   ─────────────────────│
│   🍔 Mercadona ⏱-42,30 │  ← ⏱ = pending (sin sincronizar
│      Hoy · Comida      │    aún); desaparece solo al
│   ─────────────────────│    confirmar con el backend
│   ─────────────────────│
│   🚗 Uber       -12,50 │
│      Ayer · Transporte  │
│   ─────────────────────│
│   💰 Nómina  +2.100,00 │
│      15 abr · Nómina    │
│   ─────────────────────│
│   🔄 Transferencia     │
│      Nómina → Ahorro   │
│      14 abr · 500,00€  │
│   ─────────────────────│
│   ...ver más            │
│                         │
│              ┌────┐     │
│              │ +  │     │  ← FAB (RootTabBar)
│              └────┘     │
│ ┌──────┬──────┬────┬───┐│
│ │ Home │Cuent.│Stats│Ins.││
│ └──────┴──────┴────┴───┘│
└─────────────────────────┘
```

- El bloque `╔═╗` marca la **zona del pulgar**: los dos botones grandes son las acciones primarias, altura de toque 56–64 pt.
- "Tus wallets" y "Últimas transacciones" scrollean juntas bajo el bloque fijo de balance + botones (que no scrollea).
- Cada `WalletChip` es una **wallet suelta**, no una sección de banco: el icono/color son los del wallet (definidos por el usuario), y el banco al que pertenece se indica solo con un badge pequeño en la esquina — la jerarquía banco→wallets completa vive únicamente en el tab **Cuentas** (`BankSection`).

## Datos y endpoints

- **`GET /api/dashboard`** — `total_balance`, `month_expense`, `month_expense_change_pct`, `recent_transactions`. Fuente de balance, variación y últimas transacciones.
- **`GET /api/banks`** — bancos no archivados con wallets y balances calculados; se **aplana** a una lista de wallets (cada una conserva la referencia a su banco para el badge e icono/color).
- **Cache/offline:** último `dashboard` y último `banks` cacheados en GRDB; al abrir sin red se muestra la copia cacheada con un aviso discreto de "sin conexión".
- **Cola de sync:** swipe→borrar en una transacción encola `DELETE /api/transactions/:id` (con toast "Deshacer" de 3 s que cancela el encolado antes de que se envíe).

## Componentes

- **Compartidos:** `RootTabBar`, `FloatingAddButton`, `ExpenseIncomeButtons`, `MascotView` / `MascotPanel`, `BalanceHeadline`, `MonthDeltaPill`, `TransactionRow`, `WalletChip`, `EmptyState`, `ErrorState`, `LoadingState`, `Toast`.
- **No se usa aquí:** `BankSection` (agrupación visual por banco) — exclusivo del tab Cuentas.

## Tokens usados

- Tipografía: `balance` (40–48 Bold) para el importe total; `headline` para "Tus wallets" / "Últimas transacciones"; `amount` (monoespaciado) en filas; `caption` en metadatos.
- Color: `income` / `expense` para signos e iconos de variación; `accent` en los botones primarios; `mascot-stage` (mostaza) tras la mascota en ambos temas.
- Espaciado: margen de pantalla `16`; separación entre bloques `24`; entre filas `12`.
- Radios: `lg (20)` en la tarjeta de balance y en `WalletChip`; `pill` en `ExpenseIncomeButtons` y el FAB.
- Sombra cálida en la tarjeta de balance y en el FAB (§6 del design system).

## Slots de mascota

Slot `mascot/hero` (200×200 pt, @3x en el clip). El estado (`empty/serene/happy/overflow`) se calcula del `total_balance` con los umbrales de `design-system.md` §2.

| Momento                                   | Clip                            | Gesto              |
| ----------------------------------------- | ------------------------------- | ------------------ |
| Entrar a Home (reposo)                    | idle del estado actual          | M-01/M-04 (idle)   |
| Guardar un ingreso                        | `mascot_happy_count` (M-02)     | 1 vez → idle       |
| Balance sube a `overflow` tras guardar    | `mascot_overflow_burst` (M-03)  | loop               |
| Balance cae a `empty` (gasto grande)      | `mascot_serene_lose` (M-07)     | 1 vez → idle empty |
| Meta/superávit notable (opcional, futuro) | `mascot_happy_celebrate` (M-09) | 1 vez → idle       |

Tras cualquier clip "1 vez", vuelve al idle del estado resultante (crossfade ~300 ms, §9). Con Reduce Motion, solo se ve el PNG del estado, sin disparo de gestos.

## Estados de la pantalla

- **Carga:** skeleton en la tarjeta de balance y en las filas de transacciones/wallets; mascota en el idle del último estado cacheado (si existe) o `serene` por defecto.
- **Vacío:** sin transacciones (banco/wallet recién creados en Setup). Mascota `serene` o `empty` según balance inicial. Copy: _"Aún no hay movimientos. Toca **+ Ingreso** o **− Gasto** para empezar."_ La lista de wallets sigue mostrando la creada en Setup.
- **Error:** fallo en `GET /dashboard` o `GET /banks`. Mascota `serene-shrug` (M-10). Copy: _"Algo ha fallado. Reintentar."_ con botón de reintento.
- **Offline:** se muestra el dashboard y las wallets cacheadas con un banner discreto _"Sin conexión — datos de hace {tiempo}"_; los botones Gasto/Ingreso siguen activos (encolan offline-first).

## Microinteracciones y haptics

- Tap en `− Gasto` / `+ Ingreso` / FAB → haptic `.light`, abre el modal con el modo preseleccionado (o el modo por defecto "Gasto" en el FAB).
- Tap en un `WalletChip` → navega a Transacciones del wallet (Rama 21), igual que desde Cuentas.
- Guardar transacción desde el modal → al volver a Home, haptic `.success` + gesto correspondiente de la mascota (tabla de arriba) + la transacción aparece arriba de "Últimas transacciones" con una entrada suave.
- Swipe izquierda en una transacción → haptic `.light` al iniciar el swipe; confirmar borrado muestra `Toast` "Deshacer" (3 s, sin diálogo de confirmación).
- Alerta de gasto alto (push/banner, si está activada en Ajustes) → haptic `.warning` cuando ocurre mientras la app está abierta.
- Cambio de estado de la mascota (p. ej. `serene → happy` tras un ingreso) → crossfade 300 ms entre clips.

## Accesibilidad

- Dynamic Type en balance, variación y filas de transacciones/wallets (roles tipográficos del design system, sin tamaños fijos).
- VoiceOver: la mascota expone su estado (_"Tu cartera: balance saludable"_ / _"Tu cartera: vacía"_); el balance se lee con moneda completa; cada `TransactionRow` se lee como "{comercio o nota}, {importe}, {fecha}, {categoría}" (+ ", pendiente de sincronizar" si lleva el icono ⏱); cada `WalletChip` como "{nombre wallet}, {banco}, {balance}".
- Reduce Motion: la mascota muestra el PNG estático del estado en vez del clip.
- Objetivos de toque: `− Gasto` / `+ Ingreso` y el FAB a 56–64 pt; filas de transacción y `WalletChip` ≥ 44 pt.

## Copys / tono

- Título: "WalletOS".
- Etiqueta de balance: "Balance total".
- Variación: "▼ −320 € este mes" (expense) / "▲ +180 € este mes" (income) — sin variación previa disponible (primer mes): se omite la píldora, no se muestra "±0 €".
- Botones: "− Gasto" / "+ Ingreso".
- Secciones: "Tus wallets" con enlace "ver todas"; "Últimas transacciones" con "ver más".
- Vacío: _"Aún no hay movimientos. Toca **+ Ingreso** o **− Gasto** para empezar."_
- Error: _"Algo ha fallado. Reintentar."_
- Offline: _"Sin conexión — datos de las {hora}"_ (hora de la última sincronización correcta, formato `HH:mm`; si es de otro día, _"datos del {día} a las {hora}"_).
- Mascota (voz en primera persona, solo en el idle/gestos destacados, no en cada micro-cambio): _"Esta semana he engordado un poco 😌"_ tras un ingreso relevante; _"Ando vacía, ¿registramos algo?"_ en estado `empty`.

## Casos borde y validaciones

- Balance total negativo → estado `empty` (el umbral cubre negativos); el importe se muestra en color `expense`.
- Usuario con una sola wallet → la lista muestra igualmente esa única fila (sin ocultar la sección).
- Más de 3 wallets → se muestran siempre **3** (fijo, no dinámico), recortadas por el criterio de orden activo (banco/favoritas/recientes); "ver todas" lleva a Cuentas con el listado completo agrupado por banco.
- Primer mes de uso (sin mes anterior con el que comparar) → se omite `MonthDeltaPill` en vez de mostrar una variación falsa (0% o vacía).
- `GET /dashboard` o `GET /banks` devuelven 429/5xx → `ErrorState` con reintento; no se limpia la cache existente.
- Transacción recién guardada offline (`pending`, aún no confirmada por el backend — ver `phase-10-ios-app.md` Rama 7, sync engine) → aparece igual en "Últimas transacciones" pero con un icono de reloj (⏱) junto al importe; el icono desaparece solo cuando el sync engine confirma la operación contra el backend. No bloquea la interacción (se puede editar/borrar igual, la edición se re-encola).

## Estado y próximos pasos

- Cerrado: 3 wallets visibles fijas en Home; el resto solo vía "ver todas" → Cuentas.
- Cerrado: banner offline muestra la hora de los datos mostrados (_"datos de las {hora}"_ / _"datos del {día} a las {hora}"_ si es de otro día), no un "hace X min" relativo.
- Cerrado: transacciones `pending` (offline, sin confirmar aún por el backend) llevan un icono de reloj (⏱) junto al importe, sin cambios de opacidad/color.
- Confirmar en Ajustes (Rama 25) el copy y la UI exacta del selector de orden de wallets (banco/favoritas/recientes), que Home consume aquí.
- Siguiente pantalla sugerida: **`06-add-edit-transaction.md`** (el modal que abren tanto el FAB como los dos botones de esta pantalla).
