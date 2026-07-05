# WalletOS — Flujo de usuario y base de datos

## Principios de UX

- Cada pantalla tiene un propósito claro. El usuario nunca se pregunta "¿y ahora qué?"
- Priorizar rapidez y simplicidad: poco pero directo al punto
- Pocas opciones pero con intención clara
- Añadir un gasto en 3 toques: cantidad → categoría → guardar

---

## Navegación

> **Actualizado 2026-07-05** tras el pivote de diseño "Ledger" (`docs/design-system.md`,
> 2026-07-04): la tab bar original de 4 tabs (Home/Cuentas/Stats/Insights) + FAB + Ajustes-tras-⚙️
> contradice la regla de simpleza §7.1 ("una acción primaria por pantalla") del nuevo sistema.
> Cuentas y Stats no desaparecen — cambian de contenedor (ver tabla). Insights mantiene tab propio
> por ser el rasgo diferencial de IA de la app.

- Tab bar con 4 tabs: **Patrimonio, Actividad, Insights, Ajustes**
- Un solo botón "＋ Añadir" en Patrimonio (no FAB flotante ni botones separados Gasto/Ingreso) →
  abre un modal (no navega a otra pantalla); el tipo (gasto/ingreso/transferencia) se elige dentro
- Tras login, la app decide el destino:
  - Si `GET /banks` devuelve lista vacía → **Setup**
  - Si devuelve al menos un banco → **Patrimonio**

| Tab/pantalla vieja                              | Dónde vive ahora                                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                                            | **Patrimonio** (mismo contenido)                                                                                                                                              |
| Cuentas (bancos/wallets, crear/editar/archivar) | Pantalla `AccountsView`, alcanzable con "ver todas" desde la lista de wallets de Patrimonio — ya no es tab (gestión, no contenido de uso diario)                              |
| Transacciones de un wallet                      | Tap en wallet dentro de `AccountsView` (mismo detalle, cuelga de esa jerarquía)                                                                                               |
| Stats                                           | Cabecera de **Actividad**: gasto del periodo + variación, donut y barras arriba; debajo la lista de todas las transacciones (generaliza "transacciones de un wallet" a todas) |
| Insights                                        | Tab propio, sin cambios                                                                                                                                                       |
| Ajustes (⚙️ desde Home)                         | Tab propio (patrón nativo iOS) en vez de icono oculto                                                                                                                         |

```
Auth → (Setup si GET /banks vacío) → Patrimonio
                                      │
                      ┌───────────┬───┼───────────┬──────────┐
                      │           │   │           │          │
                 Patrimonio  Actividad Insights  Ajustes   ＋ Añadir
                      │           │       │                  │
                 "ver todas"  (stats +  Detalle            Guardar
                      │        todas las  insight          → Patrimonio
                AccountsView  transacc.)
                      │
              Transacciones
                de un wallet
```

---

## Pantallas

### 1. Auth

Una sola pantalla con toggle Login/Registro. Email + contraseña, Apple Sign In o Google Sign In. Sin onboarding, sin tutorial. Entra y ya.

```
┌─────────────────────────┐
│                         │
│        🪙 WalletOS      │
│                         │
│   ┌─────────┬─────────┐ │
│   │  Login  │Registro │ │
│   └─────────┴─────────┘ │
│                         │
│   Email                 │
│   ┌───────────────────┐ │
│   │                   │ │
│   └───────────────────┘ │
│   Contraseña            │
│   ┌───────────────────┐ │
│   │                   │ │
│   └───────────────────┘ │
│                         │
│         ¿Olvidaste tu   │
│          contraseña? →  │
│                         │
│   ┌───────────────────┐ │
│   │     Entrar        │ │
│   └───────────────────┘ │
│                         │
│    ── o continuar con ──│
│                         │
│   ┌───────────────────┐ │
│   │  Sign in w/ Apple │ │
│   └───────────────────┘ │
│   ┌───────────────────┐ │
│   │ Sign in w/ Google │ │
│   └───────────────────┘ │
│                         │
└─────────────────────────┘
```

- El link "¿Olvidaste tu contraseña?" solo se muestra en modo Login.
- Apple y Google Sign In abren el flujo nativo del sistema y llaman a `POST /apple` / `POST /google` con el `identity_token` / `id_token`.

### 2. Forgot password

```
┌─────────────────────────┐
│ ← Recuperar contraseña  │
│                         │
│   Te enviaremos un      │
│   link para restablecer │
│   tu contraseña.        │
│                         │
│   Email                 │
│   ┌───────────────────┐ │
│   │                   │ │
│   └───────────────────┘ │
│                         │
│   ┌───────────────────┐ │
│   │    Enviar link    │ │
│   └───────────────────┘ │
│                         │
└─────────────────────────┘
```

- Llama a `POST /auth/forgot-password { email }`.
- Respuesta 204 independientemente de si el email existe (no revela).
- Pantalla de confirmación: _"Si el email existe, recibirás un link en unos minutos"_.

### 3. Reset password

Se abre desde el deep link `walletos://reset?token=...` del email enviado por Resend.

```
┌─────────────────────────┐
│ Nueva contraseña        │
│                         │
│   Contraseña            │
│   ┌───────────────────┐ │
│   │                   │ │
│   └───────────────────┘ │
│   Repetir contraseña    │
│   ┌───────────────────┐ │
│   │                   │ │
│   └───────────────────┘ │
│                         │
│   ┌───────────────────┐ │
│   │     Guardar       │ │
│   └───────────────────┘ │
│                         │
└─────────────────────────┘
```

- Llama a `POST /auth/reset-password { token, new_password }`.
- Al éxito: toast _"Contraseña actualizada"_ → vuelve a pantalla Auth.

### 4. Setup inicial (solo primera vez)

Tras registrarse. Wizard de 2 pasos: banco → primer wallet. Sin pantalla de bienvenida ni selector de moneda (EUR es fija en v1, nada que elegir); la timezone se autodetecta del dispositivo y se envía en silencio, sin pantalla propia. Ni banco ni wallet tienen selector de icono genérico (eso es exclusivo de categorías): el banco se busca por nombre en un catálogo con logos conocidos y, si no hay coincidencia, queda "personalizado" sin icono. El color sí es seleccionable en ambos pasos.

```
┌─────────────────────────┐     ┌─────────────────────────┐
│ PASO 1 DE 2             │     │ PASO 2 DE 2             │
│ Tu banco                │     │ Tu primer wallet        │
│                         │     │                         │
│ Nombre del banco        │     │ Balance actual          │
│ ┌───────────────────┐   │     │ 1.250,00 €              │
│ │ Santan            │   │     │                         │
│ └───────────────────┘   │     │ Nombre del wallet       │
│  🏛 Santander           │     │ ┌───────────────────┐   │
│  (sugerencias del       │     │ │ Ej: Nómina        │   │
│   catálogo al escribir) │     │ └───────────────────┘   │
│                         │     │                         │
│ Color                   │     │ Color                   │
│ 🔵 🟢 🟠 🔴 🟣 🔵 ...    │     │ 🔵 🟢 🟠 🔴 🟣 🔵 ...    │
│                         │     │                         │
│ ┌───────────────────┐   │     │ ┌───────────────────┐   │
│ │    Siguiente →     │   │     │ │    Empezar →      │   │
│ └───────────────────┘   │     │ └───────────────────┘   │
│                         │     │        Atrás            │
└─────────────────────────┘     └─────────────────────────┘
```

Al pulsar "Empezar" la app ejecuta en secuencia:

1. `PATCH /me { timezone }` — en silencio, best-effort (un fallo no bloquea el alta).
2. `POST /banks { name, icon?, color }` — `icon` solo si el nombre coincidió con el catálogo; devuelve el `bank_id`.
3. `POST /banks/:bank_id/wallets { name, initial_balance, color }` — sin `icon`, el backend aplica su valor por defecto.
4. Navega a Home.

### 5. Patrimonio (pantalla principal, antes "Home")

Donde vive el usuario el 90% del tiempo. Este documento es la referencia funcional de la pantalla (no hay specs por pantalla); la estética la marca `docs/design-system.md` ("Ledger").

```
┌─────────────────────────┐
│ Patrimonio              │
│                         │
│   24.560,80 €           │
│   ▲ +1,2 % este mes     │
│                         │
│   BBVA          12.480€ │
│   Santander      8.020€ │
│   Efectivo       4.060€ │
│   ...ver todas          │
│                         │
│   🍔 Mercadona  -42,30 │
│      Hoy · Comida      │
│   ─────────────────────│
│   💰 Nómina  +2.100,00 │
│      1 jul · Nómina     │
│   ─────────────────────│
│   🔄 Transferencia     │
│      Nómina → Ahorro   │
│      14 abr · 500,00€  │
│   ─────────────────────│
│   ...ver más            │
│                         │
│   ┌───────────────────┐ │
│   │     ＋ Añadir     │ │
│   └───────────────────┘ │
│┌──────────┬─────────┬──┬───────┐│
││Patrimonio│Actividad │Ins.│Ajustes││
│└──────────┴─────────┴──┴───────┘│
└─────────────────────────┘
```

**Acciones:**

- Tap en transacción → abre el modal de añadir transacción **en modo edición**, precargado con los datos. El mismo modal sirve para crear y editar.
- Long-press en transacción → menú contextual con "Borrar" (undo toast 3 segundos, sin diálogo de confirmación). Se usa long-press y no swipe porque la lista es un `VStack` con hairlines (estilo Ledger), no un `List`, y `.swipeActions` solo funciona dentro de `List`.
- Tap "＋ Añadir" (única acción visible de la pantalla, regla §7.1 de `design-system.md`) → abre el modal de transacción; el tipo (gasto/ingreso/transferencia) se elige dentro, sin botones separados.
- "ver todas" (wallets) → `AccountsView` (antes tab "Cuentas").
- "ver más" (transacciones) → cabecera de Actividad (antes tab "Stats"), con scroll infinito.
- Las transferencias se muestran como una sola fila con icono 🔄 y origen → destino.
- Carteras: lista **plana** (sin secciones por banco, regla §7.3), recortada a 3 filas relevantes. Orden por defecto "banco"; alternativas "favoritas"/"recientes" configurables en Ajustes — preferencia local, no backend.

### 6. Añadir / editar transacción (modal desde "+" o tap en transacción)

El mismo modal se usa para **crear** (sin datos precargados) y para **editar** (precargado). En modo edición el botón dice "Guardar cambios".

Tres modos: Gasto, Ingreso, Transferencia.

**Modo Gasto/Ingreso — Flujo de 3 toques:**

```
┌─────────────────────────┐
│ ✕                       │
│                         │
│  ● Gasto ○ Ingreso ○ ↔ │
│                         │
│        -42,30 €         │
│                         │
│   Nota (opcional)       │
│   ┌───────────────────┐ │
│   │ Mercadona         │ │
│   └───────────────────┘ │
│                         │
│   📁 Santander · Nómina│
│                     ▼  │
│                         │
│   Categorías:           │
│   ┌────┬────┬────┬────┐ │
│   │ 🍔 │ 🚗 │ 🎮 │ 📱 │ │
│   │Comi│Tran│Ocio│Subs│ │
│   ├────┼────┼────┼────┤ │
│   │ 🛍 │ 🏥 │ 🏠 │ 📚 │ │
│   │Comp│Salu│Casa│Educ│ │
│   ├────┼────┼────┼────┤ │
│   │ ··· │    │    │    │ │
│   │Otro│    │    │    │ │
│   └────┴────┴────┴────┘ │
│                         │
│   ┌───────────────────┐ │
│   │     Guardar       │ │
│   └───────────────────┘ │
│                         │
│  ┌─┬──┬──┐             │
│  │1│2 │3 │  Numpad     │
│  ├─┼──┼──┤             │
│  │4│5 │6 │             │
│  ├─┼──┼──┤             │
│  │7│8 │9 │             │
│  ├─┼──┼──┤             │
│  │,│0 │⌫ │             │
│  └─┴──┴──┘             │
└─────────────────────────┘
```

1. Se abre → numpad activo, escribe "42,30"
2. Tap en 🍔 Comida
3. Tap "Guardar" → animación ✓, vuelve al Home

**Modo Transferencia (↔):**

```
┌─────────────────────────┐
│ ✕                       │
│                         │
│  ○ Gasto ○ Ingreso ● ↔ │
│                         │
│        500,00 €         │
│                         │
│   Desde                 │
│   📁 Santander · Nómina│
│                     ▼  │
│   Hacia                 │
│   📁 Santander · Ahorro│
│                     ▼  │
│                         │
│   Nota (opcional)       │
│   ┌───────────────────┐ │
│   │                   │ │
│   └───────────────────┘ │
│                         │
│   ┌───────────────────┐ │
│   │   Transferir      │ │
│   └───────────────────┘ │
│                         │
│  ┌─┬──┬──┐             │
│  │1│2 │3 │  Numpad     │
│  ├─┼──┼──┤             │
│  │4│5 │6 │             │
│  ├─┼──┼──┤             │
│  │7│8 │9 │             │
│  ├─┼──┼──┤             │
│  │,│0 │⌫ │             │
│  └─┴──┴──┘             │
└─────────────────────────┘
```

- Sin categoría (no aplica a transferencias)
- Al guardar: crea 2 transacciones vinculadas (EXPENSE en origen, INCOME en destino)
- El balance total no cambia — solo se mueve dinero entre wallets
- Transferencias **no son editables**: se borran y recrean (la API devuelve **403** si se intenta PATCH; el DELETE elimina ambas patas atómicamente)

**Comportamientos automáticos del backend** (sin UI dedicada en v1, expuestos vía API):

- **Reglas recurrentes** (Spotify, alquiler, nómina): el user las crea por API (`POST /recurring`). Un cron diario a las 06:00 UTC busca reglas con `next_run <= today AND is_active = true`, materializa una transacción por cada una con `date = rule.next_run`, avanza `next_run` al siguiente disparo y publica `transaction.created`. La materialización es idempotente por commit y resiliente a caídas (si Rabbit falla tras commit, el cron no re-materializa porque `next_run` ya avanzó).
- **Carteras de inversión** (wallets `type=INVESTMENT`): el user registra `BUY`/`SELL`/`DIVIDEND` por API (`POST /wallets/:id/investment-transactions`). El endpoint `GET /wallets/:id/portfolio` calcula posiciones netas en el momento (`Σ BUY.shares − Σ SELL.shares`, `avg_cost` ponderado) y consulta TwelveData con cache TTL 30 min para servir el precio actual. El `total_value` se suma al `total_balance` que devuelve `GET /dashboard`.

**Campos opcionales (gasto/ingreso):**

- Toggle gasto/ingreso/transferencia → default: gasto
- Selector de wallet → default: wallet principal. Si solo hay uno, no se muestra
- Campo de nota → al escribir, activa auto-categorización IA (debounce 500ms)

Sin pantalla de confirmación. Guardar = animación de éxito y cierra el modal.

### 7. Cuentas (`AccountsView`, ya no es tab — se llega con "ver todas" desde Patrimonio)

Un solo scroll. Bancos como secciones, wallets dentro de cada banco.

```
┌─────────────────────────┐
│ ← Mis cuentas        +  │
│                         │
│ 🏦 Santander            │
│ ├─────────────────────┐ │
│ │ 💰 Ahorro    1.200€ │ │
│ ├─────────────────────┤ │
│ │ 💳 Nómina    2.100€ │ │
│ ├─────────────────────┤ │
│ │ 👥 Conjunta    450€ │ │
│ │    (con mamá)        │ │
│ └─────────────────────┘ │
│                         │
│ 🟠 N26                  │
│ ├─────────────────────┐ │
│ │ 👥 Conjunta    800€ │ │
│ │    (con papá)        │ │
│ ├─────────────────────┤ │
│ │ 💳 Corriente   320€ │ │
│ └─────────────────────┘ │
│                         │
│   Balance total: 4.870€ │
└─────────────────────────┘
```

**Acciones:**

- Tap en wallet → **Transacciones del wallet**
- Botón "+" superior → modal **Crear banco**
- Dentro de la sección de un banco, botón "+" discreto → modal **Crear wallet** (precarga el banco).
- Swipe/long-press en wallet → opciones: editar, archivar
- Swipe/long-press en banco → opciones: editar, archivar

### 8. Crear / editar banco (modal)

```
┌─────────────────────────┐
│ ✕       Nuevo banco     │
│                         │
│   Nombre                │
│   ┌───────────────────┐ │
│   │ Ej: Santander     │ │
│   └───────────────────┘ │
│                         │
│   Icono    Color        │
│   🏦 ▼     🔵 ▼         │
│                         │
│   ┌───────────────────┐ │
│   │     Guardar       │ │
│   └───────────────────┘ │
│                         │
└─────────────────────────┘
```

- Crear: `POST /banks`.
- Editar: `PATCH /banks/:id` (mismos campos; el título cambia a "Editar banco").

### 9. Crear / editar wallet (modal)

```
┌─────────────────────────┐
│ ✕       Nuevo wallet    │
│                         │
│   Banco                 │
│   🏦 Santander ▼        │
│                         │
│   Nombre                │
│   ┌───────────────────┐ │
│   │ Ej: Ahorro        │ │
│   └───────────────────┘ │
│                         │
│   Balance inicial       │
│   ┌───────────────────┐ │
│   │ 0,00 €            │ │
│   └───────────────────┘ │
│                         │
│   Icono    Color        │
│   💳 ▼     🔵 ▼         │
│                         │
│   ┌───────────────────┐ │
│   │     Guardar       │ │
│   └───────────────────┘ │
│                         │
└─────────────────────────┘
```

- Crear: `POST /banks/:bank_id/wallets`.
- Editar: `PATCH /wallets/:id`. En modo edición los campos **Banco** y **Balance inicial** están deshabilitados (la API no permite cambiarlos).

### 10. Transacciones del wallet

Accedida desde Cuentas → tap en un wallet.

```
┌─────────────────────────┐
│ ← Ahorro                │
│                         │
│   Santander · 1.200,00 €│
│                         │
│   Abril 2026            │
│   ─────────────────────│
│   🍔 Mercadona  -42,30 │
│      18 abr · Comida    │
│   ─────────────────────│
│   🔄 Transferencia     │
│      Nómina → Ahorro   │
│      14 abr · +500,00€ │
│   ─────────────────────│
│   💰 Nómina  +2.100,00 │
│      15 abr · Nómina    │
│   ─────────────────────│
│   ...                   │
│              ┌────┐     │
│              │ +  │     │
│              └────┘     │
└─────────────────────────┘
```

- Usa `GET /wallets/:id/transactions` con paginación cursor.
- Header muestra nombre del wallet, banco y balance actual.
- Swipe / tap igual que en Patrimonio.
- Tap "+" → modal de añadir transacción con el wallet precargado.

### 11. Estadísticas (cabecera del tab **Actividad**, ya no es tab propio)

Vive como cabecera de Actividad — el "número protagonista" de esa pantalla (regla §7.2); debajo
cuelga la lista plana de todas las transacciones (generaliza "transacciones de un wallet" a todas).

```
┌─────────────────────────┐
│ Actividad               │
│                         │
│   ◄ Abril 2026 ►        │
│                         │
│   Gasto total: 820,50 € │
│   vs marzo: +12%        │
│                         │
│      ┌──────────┐       │
│     ╱  🍔 35%   ╲      │
│    │  🚗 20%     │      │
│    │  🎮 15%     │      │
│     ╲  ··· 30%  ╱       │
│      └──────────┘       │
│                         │
│   Gasto diario          │
│   ▐  ▐▐ ▐   ▐▐▐  ▐    │
│   L  M  X  J  V  S  D  │
│                         │
│   Por categoría         │
│   🍔 Comida    -287,00  │
│   🚗 Transporte -164,10 │
│   🎮 Ocio      -123,15  │
│   ...                   │
│                         │
│   Todas las transacc.   │
│   ───────────────────  │
│   🍔 Mercadona  -42,30 │
│   ...                   │
└─────────────────────────┘
```

**Funcionalidad:**

- Selector de período (mes actual por defecto)
- Donut de gasto por categoría
- Barras de gasto diario
- Comparativa con mes anterior (%)
- Desglose por categoría (lista con montos)
- Filtro por banco o wallet específico
- Las transferencias no cuentan como gasto ni ingreso en estadísticas

### 12. Insights IA

```
┌─────────────────────────┐
│ Insights                │
│                         │
│ ┌───────────────────────┐│
│ │ 📊 Semana 14-20 abril ││
│ │ Has ahorrado el 82%   ││
│ │ de tus ingresos...    ││
│ │              📄 PDF   ││
│ └───────────────────────┘│
│ ┌───────────────────────┐│
│ │ 📊 Semana 7-13 abril  ││
│ │ Tu mayor gasto fue en ││
│ │ suscripciones...      ││
│ │              📄 PDF   ││
│ └───────────────────────┘│
│                         │
└─────────────────────────┘
```

Tab propio (sin cambios de contenedor): es contenido diferenciado, el rasgo de IA de la app.

- Tarjeta muestra `headline` (frase corta destacada del insight).
- Tap en un insight → pantalla **Detalle de insight**.
- Tap en 📄 PDF → descarga URL firmada de S3 (sin salir del listado).

### 13. Detalle de insight

```
┌─────────────────────────┐
│ ← Semana 14-20 abril    │
│                         │
│   Has ahorrado el 82%   │
│   de tus ingresos esta  │
│   semana, tu mejor      │
│   cifra en 2 meses      │
│                         │
│   Distribución          │
│      ┌──────────┐       │
│     ╱  🍔 42%   ╲      │
│    │  🚗 18%     │      │
│     ╲  ··· 40%  ╱       │
│      └──────────┘       │
│                         │
│   ℹ️ Hechos destacados  │
│   ─────────────────────│
│   • Gastaste 387,50€,   │
│     un 12% menos que    │
│     tu media de 4 sem.  │
│   • Restaurantes subió  │
│     un 64% (87€) vs 53€ │
│   • 73% del gasto en    │
│     restaurantes en     │
│     viernes y sábado    │
│   • 6 suscripciones     │
│     activas: 78€/mes    │
│                         │
│   Actual vs media 4 sem.│
│   ▓▓▓▓▓▓▓▓ Restaurantes │
│   ▓▓▓      Transporte   │
│   ▓▓▓▓▓▓   Ocio         │
│                         │
│   Gasto últimas 8 sem.  │
│      ╱╲                 │
│   ╲ ╱  ╲╱╲              │
│    ╲    ╱╲╲             │
│                         │
│   Top 5 transacciones   │
│   ─────────────────────│
│   Decathlon       145€  │
│   Mercadona        87€  │
│   Iberia           62€  │
│   Repsol           48€  │
│   Cinesa           21€  │
│                         │
│   💡 Sugerencias        │
│   ─────────────────────│
│   • Tu gasto en Ocio    │
│     lleva creciendo 6   │
│     semanas seguidas.   │
│     Fijar un tope       │
│     semanal podría      │
│     ayudar.             │
│                         │
│   ┌───────────────────┐ │
│   │  Descargar PDF    │ │
│   └───────────────────┘ │
│                         │
└─────────────────────────┘
```

- Llama a `GET /insights/{week_start}`.
- Renderiza tres bloques principales:
  - **Headline** grande en la cabecera.
  - **ℹ️ Hechos destacados**: lista de `facts[]` con icono ℹ️ — hechos objetivos verificables contra `summary_data`. La app puede confiar en que los números coinciden con los gráficos.
  - **💡 Sugerencias**: lista de `recommendations[]`. **Si el array viene vacío `[]`, la app no renderiza este bloque** (no fuerza recomendaciones cuando los datos no las soportan).
- Gráficos nativos con Swift Charts a partir de `charts`:
  - Donut por categoría (`charts.category_breakdown`).
  - Barras horizontales actual vs media 4 semanas (`charts.actual_vs_avg_by_category`).
  - Línea evolución últimas 8 semanas (`charts.weekly_total_last_8w`).
  - Tabla top 5 transacciones (`charts.top_transactions`).
- "Descargar PDF" → `GET /insights/{week_start}/export` → abre `url` firmada (TTL 1h). El PDF contiene los mismos bloques + gráficos renderizados con matplotlib.

**BDD scenarios — Detalle de insight:**

```
Scenario: insight con datos sólidos genera recomendaciones
  Given el usuario tiene 8 semanas de transacciones con patrones claros
  When se genera el insight semanal
  Then la respuesta incluye headline, facts[] con 3-5 hechos y recommendations[] con al menos 1 elemento
  And la app renderiza el bloque "💡 Sugerencias"

Scenario: insight sin base sólida omite recomendaciones
  Given el usuario tiene solo 1-2 semanas de transacciones o sin patrones detectables
  When se genera el insight semanal
  Then la respuesta incluye headline y facts[] pero recommendations[] = []
  And la app NO renderiza el bloque "💡 Sugerencias"

Scenario: los hechos numéricos son verificables
  Given un insight generado con summary_data conocido
  When la app muestra facts[] al usuario
  Then cada número mencionado en un fact coincide con el correspondiente en summary_data y en charts
  And no aparece ningún número que no esté en summary_data

Scenario: semana sin transacciones no genera insight
  Given el usuario no tuvo transacciones en la semana objetivo
  When se llama a POST /insights/generate
  Then la respuesta es 204 No Content sin invocar al LLM
  And no se crea entrada en weekly_insights
```

### 14. Ajustes

Tab propio (antes accesible desde el ⚙️ del Home — patrón menos nativo que un tab dedicado).

```
┌─────────────────────────┐
│ ← Ajustes               │
│                         │
│   PERFIL                │
│   ─────────────────────│
│   Nombre                │
│   ┌───────────────────┐ │
│   │ Saleem            │ │
│   └───────────────────┘ │
│                         │
│   Zona horaria          │
│   Europe/Madrid      ▼  │
│                         │
│   Moneda                │
│   EUR                ▼  │
│                         │
│   NOTIFICACIONES        │
│   ─────────────────────│
│   Recordatorio diario   │
│                  (on) ● │
│                         │
│   Alerta de gasto alto  │
│                  (off) ○│
│   Umbral: 100,00 €      │
│                         │
│   CUENTA                │
│   ─────────────────────│
│   ┌───────────────────┐ │
│   │     Cerrar sesión │ │
│   └───────────────────┘ │
│                         │
│   ┌───────────────────┐ │
│   │  Eliminar cuenta  │ │
│   └───────────────────┘ │
│                         │
└─────────────────────────┘
```

- Cambios en perfil/notificaciones: `PATCH /me` (debounced o al confirmar).
- **Cerrar sesión:** borra tokens del secure storage + `POST /logout`.
- **Eliminar cuenta:** diálogo de confirmación con typing "ELIMINAR" → `DELETE /me` → borra datos locales y vuelve a Auth.

### 15. Widget (pantalla de inicio)

Widget de tamaño pequeño y mediano implementado con `WidgetKit`.

```
┌──────────────────────┐
│ WalletOS             │
│                      │
│ 2.450,75 €           │
│ Balance total        │
│                      │
│ Hoy: -42,30 €        │
└──────────────────────┘
```

- Refresh periódico de datos vía `WidgetKit` (App Group compartido con la app).
- Tap en cualquier parte → deep link `walletos://add` que abre el modal de añadir transacción.
- Datos provienen del último `GET /dashboard` cacheado + base de datos local para el gasto del día.

---

## Resumen de acciones del usuario

1. Registrarse / iniciar sesión (email, Apple, Google)
2. Recuperar contraseña
3. Añadir gasto/ingreso (3 toques)
4. Transferir dinero entre wallets
5. Editar/borrar transacciones (tap → editar; long-press → borrar con undo toast 3s; editar reusa el modal de añadir)
6. Ver balance total y últimas transacciones
7. Ver balance por banco y wallet
8. Ver estadísticas de gasto (donut, barras, comparativa)
9. Leer insights semanales de IA + descargar PDF
10. Gestionar bancos (crear, editar, archivar)
11. Gestionar wallets dentro de bancos (crear, editar, archivar)
12. Configurar perfil y notificaciones
13. Cerrar sesión o eliminar cuenta

---

## Jerarquía de datos

```
Usuario
  └── Banco (ej: Santander, N26)
        └── Wallet (ej: Ahorro, Nómina, Conjunta)
              └── Transacción (gasto, ingreso o transferencia)
                    ├── Categoría (predefinida o custom) — para gastos/ingresos
                    └── transfer_id — para transferencias (vincula 2 transacciones)
```

- Un usuario tiene N bancos
- Un banco tiene N wallets
- Un wallet tiene N transacciones
- Una transacción de gasto/ingreso tiene 1 categoría
- Una transferencia genera 2 transacciones vinculadas por `transfer_id` (EXPENSE en origen, INCOME en destino)
- Balance de wallet = `initial_balance + SUM(INCOME) - SUM(EXPENSE)` (calculado, no almacenado)
- Balance de banco = suma de balances de sus wallets
- Balance total = suma de balances de todos los bancos
- Las transferencias no afectan el balance total (suma cero)

---

## Base de datos

### Arquitectura: 2 instancias PostgreSQL

```
postgres (instancia principal, ~200MB RAM)
  ├── walletOS_users          → User Service
  ├── walletOS_wallets        → Wallet Service
  └── walletOS_notifications  → Notification Service

postgres-ai (instancia AI, ~200MB RAM)
  └── walletOS_ai             → AI Service
```

**Justificación:**

- AI Service aislado del principal: si OpenAI, APScheduler o carga de insights impactan la DB, no afectan a User/Wallet/Notification
- Misma separación lógica: cada servicio solo se conecta a su database
- Trade-off: ~400MB RAM en vez de ~200MB (aceptable en el VPS de 8GB con 2 instancias ligeras)
- 2 backups independientes; fallo de `postgres-ai` no derriba los servicios principales

---

### walletOS_users — User Service

```sql
CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                VARCHAR(255) NOT NULL UNIQUE,
    password_hash        VARCHAR(255),
    name                 VARCHAR(100) NOT NULL,
    timezone             VARCHAR(50)  NOT NULL DEFAULT 'UTC',
    default_currency     CHAR(3)      NOT NULL DEFAULT 'EUR',
    apple_id             VARCHAR(255) UNIQUE,
    google_id            VARCHAR(255) UNIQUE,
    reminder_enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    high_spend_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
    high_spend_threshold DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- password_hash es NULL si el usuario solo usa Apple/Google Sign In
-- apple_id es NULL si el usuario no ha vinculado Apple
-- google_id es NULL si el usuario no ha vinculado Google
-- Al menos uno de password_hash, apple_id o google_id debe existir (validado en app, no en DB)
-- default_currency sigue ISO 4217 (EUR, USD, GBP...)
-- reminder_enabled: recordatorio diario "¿Has anotado tus gastos?"
-- high_spend_enabled/threshold: alerta push cuando un gasto supera el umbral

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- El token plano se envía por email (Resend); en DB solo vive su hash.
-- used_at != NULL invalida el token tras el primer uso.
CREATE INDEX idx_password_reset_tokens_user_id    ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

---

### walletOS_wallets — Wallet Service

```sql
CREATE TYPE transaction_type           AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE category_type              AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE wallet_type                AS ENUM ('CASH', 'INVESTMENT');
CREATE TYPE recurring_frequency        AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE investment_transaction_type AS ENUM ('BUY', 'SELL', 'DIVIDEND');

-- ─── Bancos ───

CREATE TABLE banks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL,
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(50)  NOT NULL DEFAULT '🏦',
    color       VARCHAR(7)   NOT NULL DEFAULT '#007AFF',
    is_archived BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- user_id no tiene FK porque los usuarios viven en otra database
CREATE INDEX idx_banks_user_id ON banks(user_id);

-- ─── Wallets ───

CREATE TABLE wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id         UUID          NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
    user_id         UUID          NOT NULL,
    name            VARCHAR(100)  NOT NULL,
    type            wallet_type   NOT NULL DEFAULT 'CASH',
    initial_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    icon            VARCHAR(50)   NOT NULL DEFAULT '💳',
    color           VARCHAR(7)    NOT NULL DEFAULT '#007AFF',
    is_archived     BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- type = 'CASH'        → wallet de efectivo con transacciones INCOME/EXPENSE; balance se calcula de `transactions`
-- type = 'INVESTMENT'  → cartera de inversión; `initial_balance` se ignora, balance se deriva de
--                        `investment_transactions × precio_actual` (ver Fase 6 Rama 15)
CREATE INDEX idx_wallets_bank_id ON wallets(bank_id);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- ─── Categorías ───

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID,
    name       VARCHAR(100)  NOT NULL,
    icon       VARCHAR(50)   NOT NULL,
    type       category_type NOT NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uniq_categories_user_name_type
        UNIQUE NULLS NOT DISTINCT (user_id, name, type)
);

-- user_id = NULL → categoría predefinida (seed)
-- user_id != NULL → categoría custom del usuario
-- UNIQUE NULLS NOT DISTINCT requiere PostgreSQL 15+ (tratamos NULL como duplicado)
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- ─── Transacciones ───

CREATE TABLE transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id   UUID             NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id     UUID             NOT NULL,
    category_id UUID             REFERENCES categories(id),
    type        transaction_type NOT NULL,
    amount      DECIMAL(12,2)    NOT NULL CHECK (amount > 0),
    note        VARCHAR(500),
    date        DATE             NOT NULL DEFAULT CURRENT_DATE,
    transfer_id UUID,
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- amount siempre positivo; el campo type indica si es gasto o ingreso
-- date es DATE (no timestamp): el día importa, no el segundo exacto
-- Para ordenar dentro del mismo día se usa created_at
-- category_id es NULL en transferencias (no tienen categoría)
-- transfer_id: NULL = transacción normal; NOT NULL = parte de una transferencia
--   Dos transacciones comparten el mismo transfer_id:
--   una EXPENSE (wallet origen) y una INCOME (wallet destino)
-- El PK `id` puede venir del cliente móvil (offline-first) o generarse en el servidor

CREATE INDEX idx_transactions_wallet_id   ON transactions(wallet_id);
CREATE INDEX idx_transactions_user_id     ON transactions(user_id);
CREATE INDEX idx_transactions_date        ON transactions(date);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_user_date   ON transactions(user_id, date);
CREATE INDEX idx_transactions_transfer_id ON transactions(transfer_id);

-- ─── Reglas recurrentes (suscripciones, nómina, alquiler…) ───

CREATE TABLE recurring_rules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID                NOT NULL,
    wallet_id    UUID                NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    category_id  UUID                REFERENCES categories(id),
    type         transaction_type    NOT NULL,
    amount       DECIMAL(12,2)       NOT NULL CHECK (amount > 0),
    note         VARCHAR(500),
    frequency    recurring_frequency NOT NULL,
    day_of_month INT,
    day_of_week  INT,
    starts_at    DATE                NOT NULL,
    ends_at      DATE,
    next_run     DATE                NOT NULL,
    is_active    BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- day_of_month (1-31): obligatorio si frequency = MONTHLY. Si excede los días del mes
--   destino se clamp al último día (31 en febrero → 28/29)
-- day_of_week (0=lunes … 6=domingo): obligatorio si frequency = WEEKLY
-- next_run: próxima fecha de materialización. Un cron diario (`0 6 * * *` UTC) procesa
--   las reglas con `next_run <= today AND is_active = true`: crea la transacción y
--   avanza next_run al siguiente disparo, todo en una `prisma.$transaction`.
CREATE INDEX idx_recurring_rules_user_id   ON recurring_rules(user_id);
CREATE INDEX idx_recurring_rules_next_run  ON recurring_rules(next_run);
CREATE INDEX idx_recurring_rules_is_active ON recurring_rules(is_active);

-- ─── Operaciones bursátiles (wallets INVESTMENT) ───

CREATE TABLE investment_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID                        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id         UUID                        NOT NULL,
    ticker          VARCHAR(20)                 NOT NULL,
    asset_name      VARCHAR(100)                NOT NULL,
    type            investment_transaction_type NOT NULL,
    shares          DECIMAL(18,8)               NOT NULL CHECK (shares > 0),
    price_per_share DECIMAL(12,4)               NOT NULL CHECK (price_per_share > 0),
    total_amount    DECIMAL(12,2)               NOT NULL,
    currency        CHAR(3)                     NOT NULL DEFAULT 'EUR',
    note            VARCHAR(500),
    date            DATE                        NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

-- shares con precisión 18/8 para fracciones de acción/ETF
-- price_per_share con precisión 12/4
-- total_amount = shares × price_per_share, calculado server-side al crear
-- type = BUY ajusta posición positivamente; SELL la reduce; DIVIDEND solo informa
--        ingreso (no afecta shares ni avg_cost). Solo válido en wallets de type=INVESTMENT.
CREATE INDEX idx_investment_transactions_wallet_id ON investment_transactions(wallet_id);
CREATE INDEX idx_investment_transactions_user_id   ON investment_transactions(user_id);
CREATE INDEX idx_investment_transactions_ticker    ON investment_transactions(ticker);
CREATE INDEX idx_investment_transactions_date_desc ON investment_transactions(date DESC);

-- ─── Cache de cotizaciones (TwelveData) ───

CREATE TABLE price_cache (
    ticker       VARCHAR(20)   PRIMARY KEY,
    price        DECIMAL(12,4) NOT NULL,
    currency     CHAR(3)       NOT NULL,
    market_open  BOOLEAN       NOT NULL,
    last_updated TIMESTAMPTZ   NOT NULL
);

-- Cache compartida por ticker (no por user). TTL gestionado en aplicación:
-- 30 min si market_open = TRUE, 24 h si FALSE. Dimensionado para encajar 50 ETFs
-- únicos en el free tier de TwelveData (800 credits/día × 30 min × 16 ciclos = 800).
```

**Seed de categorías predefinidas:**

```sql
-- Gastos
INSERT INTO categories (id, user_id, name, icon, type) VALUES
    (gen_random_uuid(), NULL, 'Comida',         '🍔', 'EXPENSE'),
    (gen_random_uuid(), NULL, 'Transporte',     '🚗', 'EXPENSE'),
    (gen_random_uuid(), NULL, 'Ocio',           '🎮', 'EXPENSE'),
    (gen_random_uuid(), NULL, 'Suscripciones',  '📱', 'EXPENSE'),
    (gen_random_uuid(), NULL, 'Compras',        '🛍', 'EXPENSE'),
    (gen_random_uuid(), NULL, 'Salud',          '🏥', 'EXPENSE'),
    (gen_random_uuid(), NULL, 'Casa',           '🏠', 'EXPENSE'),
    (gen_random_uuid(), NULL, 'Educación',      '📚', 'EXPENSE'),
    (gen_random_uuid(), NULL, 'Otros',          '···', 'EXPENSE');

-- Ingresos
INSERT INTO categories (id, user_id, name, icon, type) VALUES
    (gen_random_uuid(), NULL, 'Nómina',       '💰', 'INCOME'),
    (gen_random_uuid(), NULL, 'Freelance',    '💻', 'INCOME'),
    (gen_random_uuid(), NULL, 'Inversiones',  '📈', 'INCOME'),
    (gen_random_uuid(), NULL, 'Regalos',      '🎁', 'INCOME'),
    (gen_random_uuid(), NULL, 'Otros',        '···', 'INCOME');
```

**Queries de balance:**

```sql
-- Balance de un wallet
SELECT w.initial_balance + COALESCE(
    SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END), 0
) AS balance
FROM wallets w
LEFT JOIN transactions t ON t.wallet_id = w.id
WHERE w.id = $1
GROUP BY w.id;

-- Balance total del usuario (todos los wallets)
SELECT SUM(sub.balance) AS total_balance
FROM (
    SELECT w.initial_balance + COALESCE(
        SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END), 0
    ) AS balance
    FROM wallets w
    LEFT JOIN transactions t ON t.wallet_id = w.id
    WHERE w.user_id = $1 AND w.is_archived = FALSE
    GROUP BY w.id
) sub;
```

**Lógica de transferencia (a nivel de aplicación):**

```sql
-- Al crear una transferencia de 500€ de wallet_A a wallet_B:
BEGIN;

-- Generar un UUID compartido para vincular ambas transacciones
-- transfer_id = gen_random_uuid()

INSERT INTO transactions (wallet_id, user_id, category_id, type, amount, note, date, transfer_id)
VALUES ($wallet_a, $user_id, NULL, 'EXPENSE', 500.00, $note, $date, $transfer_id);

INSERT INTO transactions (wallet_id, user_id, category_id, type, amount, note, date, transfer_id)
VALUES ($wallet_b, $user_id, NULL, 'INCOME', 500.00, $note, $date, $transfer_id);

COMMIT;

-- Para mostrar transferencias en el Home:
-- Agrupar por transfer_id != NULL, mostrar como una sola fila con icono 🔄
-- Para estadísticas: excluir transacciones con transfer_id != NULL
```

**Lógica de materialización de regla recurrente (cron diario):**

```sql
-- node-cron `0 6 * * *` UTC. Una vez al día. Por cada regla due:
BEGIN;

INSERT INTO transactions (wallet_id, user_id, category_id, type, amount, note, date)
SELECT wallet_id, user_id, category_id, type, amount, note, next_run
FROM recurring_rules
WHERE id = $rule_id;

UPDATE recurring_rules
SET next_run = $computed_next_run, updated_at = NOW()
WHERE id = $rule_id;

COMMIT;

-- $computed_next_run = computeNextAfter(next_run, frequency, day_of_month, day_of_week)
--   DAILY:   next_run + 1 día
--   WEEKLY:  primer día con getUTCDay() = day_of_week tras next_run
--   MONTHLY: día day_of_month del mes siguiente; clamp a último día si excede
--
-- Tras commit: publica `transaction.created` por cada materialización. Si Rabbit
-- falla, la tx ya está en DB y next_run ya avanzó → no se duplica al día siguiente.
```

**Lógica de cálculo de posición de cartera (`GET /wallets/:id/portfolio`):**

```sql
-- Agrupa investment_transactions por ticker en una sola query
SELECT
    ticker,
    asset_name,
    SUM(CASE WHEN type = 'BUY'  THEN shares ELSE 0 END) -
    SUM(CASE WHEN type = 'SELL' THEN shares ELSE 0 END)        AS shares,
    SUM(CASE WHEN type = 'BUY'  THEN total_amount ELSE 0 END)  AS buy_total,
    SUM(CASE WHEN type = 'BUY'  THEN shares ELSE 0 END)        AS buy_shares
FROM investment_transactions
WHERE wallet_id = $1
GROUP BY ticker, asset_name
HAVING SUM(CASE WHEN type = 'BUY' THEN shares ELSE 0 END) -
       SUM(CASE WHEN type = 'SELL' THEN shares ELSE 0 END) > 0;

-- Para cada posición devuelta (solo shares > 0):
--   avg_cost_per_share = buy_total / buy_shares
--   cost = avg_cost × shares
--   current_price = getOrRefreshPrice(ticker)  → consulta price_cache (TTL 30 min/24h)
--   value = current_price × shares
--   gain  = value - cost
--   gain_pct = gain / cost × 100
-- DIVIDEND no afecta shares ni avg_cost — solo informa ingreso pasado.
```

---

### walletOS_ai — AI Service

```sql
CREATE TABLE weekly_insights (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL,
    week_start      DATE         NOT NULL,
    headline        TEXT         NOT NULL,
    facts           JSONB        NOT NULL DEFAULT '[]',
    recommendations JSONB        NOT NULL DEFAULT '[]',
    summary_data    JSONB        NOT NULL,
    summary_text    TEXT         NOT NULL,
    s3_key          VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, week_start)
);

-- week_start es siempre un lunes (validado en app)
-- headline: frase corta de 80-120 chars con el hecho más relevante
-- facts: array de strings (3-5 hechos objetivos), los números deben coincidir con summary_data
-- recommendations: array de strings (0-3 sugerencias), puede ser '[]' si los datos no soportan recomendaciones
-- summary_data: snapshot completo de las métricas pre-calculadas en app/analytics/
--   - Permite regenerar PDF si cambia el diseño sin volver a llamar al LLM
--   - La app dibuja gráficos nativos con Swift Charts desde este JSON sin abrir el PDF
--   - Invariante: cada número mencionado en facts/recommendations debe poder derivarse de summary_data
-- summary_text: concatenación legible (headline + facts en prosa) para retro-compatibilidad
-- s3_key es NULL hasta que se genera y sube el PDF
-- Constraint UNIQUE garantiza 1 insight por usuario por semana

CREATE INDEX idx_weekly_insights_user_id ON weekly_insights(user_id);
```

---

### walletOS_notifications — Notification Service

```sql
CREATE TABLE device_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL,
    token      VARCHAR(500) NOT NULL UNIQUE,
    platform   VARCHAR(10)  NOT NULL DEFAULT 'ios',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Un usuario puede tener múltiples tokens (múltiples dispositivos)
-- token es UNIQUE para evitar registros duplicados del mismo dispositivo
-- platform siempre 'ios' en v1 (app nativa iOS → APNs; sin FCM/Android)

CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL,
    type       VARCHAR(40)  NOT NULL,   -- high_spend | weekly_insight | reminder
    title      VARCHAR(120) NOT NULL,
    body       TEXT         NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'sent',  -- sent | failed (resultado APNs)
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Historial del centro de notificaciones de la app (se persiste toda push)
-- read_at NULL = no leída; alimenta el unread_count del centro

CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
```

---

### ERD — Relaciones entre entidades

```
walletOS_users                    walletOS_wallets
┌──────────────┐                  ┌──────────────┐
│    users     │                  │    banks     │
│──────────────│    user_id       │──────────────│
│ id (PK)      │◄ ─ ─ ─ ─ ─ ─ ─ ─│ user_id      │
│ email        │                  │ id (PK)      │
│ password_hash│                  │ name         │
│ name         │                  │ icon, color  │
│ timezone     │                  │ is_archived  │
│ currency     │                  └──────┬───────┘
│ apple_id     │                         │ 1:N
│ google_id    │                  ┌──────┴───────┐
└──────┬───────┘                  │   wallets    │
       │ 1:N                      │──────────────│
┌──────┴──────────┐               │ id (PK)      │
│ refresh_tokens  │               │ bank_id (FK) │
│─────────────────│               │ user_id      │
│ id (PK)         │               │ name         │
│ user_id (FK)    │               │ type CASH/   │
│ token_hash      │               │   INVESTMENT │
│ expires_at      │               │ initial_bal  │
└─────────────────┘               │ is_archived  │
┌─────────────────────┐           └──────┬───────┘
│password_reset_tokens│                  │ 1:N
│─────────────────────│       ┌──────────┼───────────────┐
│ id (PK)             │       │          │               │
│ user_id (FK)        │ ┌─────┴──────┐ ┌─┴───────────┐ ┌─┴────────────────┐
│ token_hash          │ │transactions│ │recurring_   │ │investment_       │
│ expires_at, used_at │ │────────────│ │rules        │ │transactions      │
└─────────────────────┘ │ id (PK)    │ │─────────────│ │──────────────────│
                        │ wallet_id  │ │ id (PK)     │ │ id (PK)          │
                        │ user_id    │ │ wallet_id   │ │ wallet_id (FK)   │
                        │ category_id│ │ category_id │ │ user_id          │
walletOS_ai             │ type       │ │ user_id     │ │ ticker           │
┌──────────────┐        │ amount     │ │ type        │ │ asset_name       │
│weekly_insights│       │ note       │ │ amount      │ │ type BUY/SELL/   │
│──────────────│        │ date       │ │ frequency   │ │   DIVIDEND       │
│ id (PK)      │        │ transfer_id│ │ day_of_month│ │ shares           │
│ user_id      │        └──────┬─────┘ │ day_of_week │ │ price_per_share  │
│ week_start   │               │ N:1   │ next_run    │ │ total_amount     │
│ summary_text │               │       │ is_active   │ │ currency, date   │
│ s3_key       │        ┌──────┴───────┐└─────────────┘└──────────────────┘
│ UNIQUE(user, │        │  categories  │                ┌──────────────────┐
│   week_start)│        │──────────────│                │  price_cache     │
└──────────────┘        │ id (PK)      │                │──────────────────│
                        │ user_id      │                │ ticker (PK)      │
walletOS_notifications  │ name         │                │ price            │
┌──────────────┐        │ icon         │                │ currency         │
│ device_tokens│        │ type         │                │ market_open      │
│──────────────│        │ UNIQUE(user, │                │ last_updated     │
│ id (PK)      │        │  name, type) │                └──────────────────┘
│ user_id      │        └──────────────┘                (compartido entre
│ token        │                                         todos los users)
│ platform     │
└──────────────┘
```

**Nota:** Las relaciones `user_id` entre databases son lógicas (no FK), porque cada servicio tiene su propia database. La integridad referencial entre servicios se mantiene a nivel de aplicación, y la limpieza al borrar cuenta se propaga por el evento `user.deleted`.
