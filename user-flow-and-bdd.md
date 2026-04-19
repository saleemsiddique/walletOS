# WalletOS — Flujo de usuario y base de datos

## Principios de UX

- Cada pantalla tiene un propósito claro. El usuario nunca se pregunta "¿y ahora qué?"
- Priorizar rapidez y simplicidad: poco pero directo al punto
- Pocas opciones pero con intención clara
- Añadir un gasto en 3 toques: cantidad → categoría → guardar

---

## Navegación

- Tab bar con 4 tabs: **Home, Cuentas, Stats, Insights**
- Botón "+" flotante sobre el tab bar → siempre accesible desde cualquier pantalla
- El "+" abre un modal (no navega a otra pantalla)
- Tras login, la app decide el destino:
  - Si `GET /banks` devuelve lista vacía → **Setup**
  - Si devuelve al menos un banco → **Home**

```
Auth → (Setup si GET /banks vacío) → Home
                                      │
                      ┌────────┬──────┼───────┬──────────┐
                      │        │      │       │          │
                  Cuentas   Stats  Insights Ajustes   [+] Modal
                      │                │       (⚙️)      │
               Transacciones       Detalle            Guardar
               de un wallet        insight            → Home
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

Tras registrarse. El usuario crea su primer banco y primer wallet.

```
┌─────────────────────────┐
│                         │
│   Tu primer wallet      │
│                         │
│   Banco                 │
│   ┌───────────────────┐ │
│   │ Ej: Santander     │ │
│   └───────────────────┘ │
│                         │
│   Nombre del wallet     │
│   ┌───────────────────┐ │
│   │ Ej: Nómina        │ │
│   └───────────────────┘ │
│                         │
│   Balance actual        │
│   ┌───────────────────┐ │
│   │ 1.250,00 €        │ │
│   └───────────────────┘ │
│                         │
│   Icono    Color        │
│   🏦 ▼     🔵 ▼         │
│                         │
│   Moneda                │
│   EUR ▼                 │
│                         │
│   ┌───────────────────┐ │
│   │    Empezar →      │ │
│   └───────────────────┘ │
└─────────────────────────┘
```

Al pulsar "Empezar" la app ejecuta en secuencia:

1. `PATCH /me { default_currency }` — solo si la moneda difiere de la actual del usuario.
2. `POST /banks { name, icon, color }` — devuelve el `bank_id`.
3. `POST /banks/:bank_id/wallets { name, initial_balance, icon, color }`.
4. Navega a Home.

### 5. Home (pantalla principal)

Donde vive el usuario el 90% del tiempo.

```
┌─────────────────────────┐
│ WalletOS        ⚙️      │
│                         │
│   Balance total         │
│   ┌───────────────────┐ │
│   │    2.450,75 €     │ │
│   │  ▼ -320€ este mes │ │
│   └───────────────────┘ │
│                         │
│   Últimas transacciones │
│   ─────────────────────│
│   🍔 Mercadona  -42,30 │
│      Hoy · Comida      │
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
│              │ +  │     │
│              └────┘     │
│ ┌──────┬──────┬────┬───┐│
│ │ Home │Cuent.│Stats│Ins.││
│ └──────┴──────┴────┴───┘│
└─────────────────────────┘
```

**Acciones:**

- Tap en transacción → abre el modal de añadir transacción **en modo edición**, precargado con los datos. El mismo modal sirve para crear y editar.
- Swipe izquierda en transacción → borrar (undo toast 3 segundos, sin diálogo de confirmación)
- Tap "+" → abre modal de añadir transacción
- Tap en ⚙️ → Ajustes
- "ver más" → scroll infinito
- Las transferencias se muestran como una sola fila con icono 🔄 y origen → destino

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
- Transferencias **no son editables**: se borran y recrean (la API devuelve 400 si se intenta PATCH)

**Campos opcionales (gasto/ingreso):**

- Toggle gasto/ingreso/transferencia → default: gasto
- Selector de wallet → default: wallet principal. Si solo hay uno, no se muestra
- Campo de nota → al escribir, activa auto-categorización IA (debounce 500ms)

Sin pantalla de confirmación. Guardar = animación de éxito y cierra el modal.

### 7. Cuentas (lista agrupada por banco)

Un solo scroll. Bancos como secciones, wallets dentro de cada banco.

```
┌─────────────────────────┐
│ Mis cuentas         + ← │
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
│              ┌────┐     │
│              │ +  │     │
│              └────┘     │
│ ┌──────┬──────┬────┬───┐│
│ │ Home │Cuent.│Stats│Ins.││
│ └──────┴──────┴────┴───┘│
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
- Swipe / tap igual que en Home.
- Tap "+" → modal de añadir transacción con el wallet precargado.

### 11. Estadísticas

```
┌─────────────────────────┐
│ Estadísticas            │
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
│              ┌────┐     │
│              │ +  │     │
│              └────┘     │
│ ┌──────┬──────┬────┬───┐│
│ │ Home │Cuent.│Stats│Ins.││
│ └──────┴──────┴────┴───┘│
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
│ │ Gastaste 210€, un 15% ││
│ │ menos que la semana...││
│ │              📄 PDF   ││
│ └───────────────────────┘│
│ ┌───────────────────────┐│
│ │ 📊 Semana 7-13 abril  ││
│ │ Tu mayor gasto fue en ││
│ │ suscripciones...      ││
│ │              📄 PDF   ││
│ └───────────────────────┘│
│                         │
│              ┌────┐     │
│              │ +  │     │
│              └────┘     │
│ ┌──────┬──────┬────┬───┐│
│ │ Home │Cuent.│Stats│Ins.││
│ └──────┴──────┴────┴───┘│
└─────────────────────────┘
```

- Tap en un insight → pantalla **Detalle de insight**.
- Tap en 📄 PDF → descarga URL firmada de S3 (sin salir del listado).

### 13. Detalle de insight

```
┌─────────────────────────┐
│ ← Semana 14-20 abril    │
│                         │
│   Resumen               │
│   ─────────────────────│
│   Esta semana gastaste  │
│   210€, un 15% menos    │
│   que la semana         │
│   anterior. Tu mayor    │
│   gasto fue en Comida   │
│   (42% del total).      │
│                         │
│   Distribución          │
│      ┌──────────┐       │
│     ╱  🍔 42%   ╲      │
│    │  🚗 18%     │      │
│     ╲  ··· 40%  ╱       │
│      └──────────┘       │
│                         │
│   Total: 210,50 €       │
│   Transacciones: 23     │
│                         │
│   ┌───────────────────┐ │
│   │  Descargar PDF    │ │
│   └───────────────────┘ │
│                         │
└─────────────────────────┘
```

- Llama a `GET /insights/{week_start}` para cuerpo.
- "Descargar PDF" → `GET /insights/{week_start}/export` → abre `url` firmada (TTL 1h).

### 14. Ajustes

Accesible desde el ⚙️ del Home.

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
- **Cerrar sesión:** borra tokens del Keychain + `POST /logout`.
- **Eliminar cuenta:** diálogo de confirmación con typing "ELIMINAR" → `DELETE /me` → borra datos locales y vuelve a Auth.

### 15. Widget iOS (pantalla de inicio)

Widget de tamaño pequeño y mediano.

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

- Refresh automático cada hora (WidgetKit timeline).
- Tap en cualquier parte → deep link `walletos://add` que abre el modal de añadir transacción.
- Datos provienen del último `GET /dashboard` cacheado + CoreData para el gasto del día.

---

## Resumen de acciones del usuario

1. Registrarse / iniciar sesión (email, Apple, Google)
2. Recuperar contraseña
3. Añadir gasto/ingreso (3 toques)
4. Transferir dinero entre wallets
5. Editar/borrar transacciones (swipe + undo toast 3s; editar reusa el modal de añadir)
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

### Arquitectura: 1 instancia PostgreSQL, 4 databases lógicas

```
PostgreSQL (1 proceso)
  ├── walletOS_users          → User Service
  ├── walletOS_wallets        → Wallet Service
  ├── walletOS_ai             → AI Service
  └── walletOS_notifications  → Notification Service
```

**Justificación:**

- 1 solo proceso PostgreSQL (~200MB RAM) en vez de 4 (~800MB)
- Misma separación lógica: cada servicio solo se conecta a su database
- 1 backup, 1 instancia que mantener
- En producción real se haría así antes de escalar a instancias separadas
- Trade-off: si PostgreSQL cae, caen todos los servicios (aceptable para proyecto personal)

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
    high_spend_threshold DECIMAL(12,2) NOT NULL DEFAULT 100.00,
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
CREATE TYPE transaction_type AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE category_type   AS ENUM ('INCOME', 'EXPENSE');

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
    initial_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    icon            VARCHAR(50)   NOT NULL DEFAULT '💳',
    color           VARCHAR(7)    NOT NULL DEFAULT '#007AFF',
    is_archived     BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

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
-- El PK `id` puede venir del cliente iOS (offline-first) o generarse en el servidor

CREATE INDEX idx_transactions_wallet_id   ON transactions(wallet_id);
CREATE INDEX idx_transactions_user_id     ON transactions(user_id);
CREATE INDEX idx_transactions_date        ON transactions(date);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_user_date   ON transactions(user_id, date);
CREATE INDEX idx_transactions_transfer_id ON transactions(transfer_id);
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

---

### walletOS_ai — AI Service

```sql
CREATE TABLE weekly_insights (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL,
    week_start   DATE         NOT NULL,
    summary_text TEXT         NOT NULL,
    s3_key       VARCHAR(500),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, week_start)
);

-- week_start es siempre un lunes (validado en app)
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

CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
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
└──────┬───────┘                  │   wallets   │
       │ 1:N                      │──────────────│
┌──────┴──────────┐               │ id (PK)      │
│ refresh_tokens  │               │ bank_id (FK) │
│─────────────────│               │ user_id      │
│ id (PK)         │               │ name         │
│ user_id (FK)    │               │ initial_bal  │
│ token_hash      │               │ is_archived  │
│ expires_at      │               └──────┬───────┘
└─────────────────┘                      │ 1:N
┌─────────────────────┐           ┌──────┴───────┐
│ password_reset_tokens│           │ transactions │
│─────────────────────│           │──────────────│
│ id (PK)             │           │ id (PK)      │
│ user_id (FK)        │           │ wallet_id(FK)│
│ token_hash          │           │ user_id      │
│ expires_at, used_at │           │ category_id  │
└─────────────────────┘           │ type         │
                                  │ amount       │
                                  │ note         │
walletOS_ai                       │ date         │
┌──────────────┐                  │ transfer_id  │
│weekly_insights                  └──────┬───────┘
│──────────────│                         │ N:1
│ id (PK)      │                  ┌──────┴───────┐
│ user_id      │                  │  categories  │
│ week_start   │                  │──────────────│
│ summary_text │                  │ id (PK)      │
│ s3_key       │                  │ user_id      │
│ UNIQUE(user, │                  │ name         │
│   week_start)│                  │ icon         │
└──────────────┘                  │ type         │
                                  │ UNIQUE(user, │
walletOS_notifications            │  name, type) │
┌──────────────┐                  └──────────────┘
│ device_tokens│
│──────────────│
│ id (PK)      │
│ user_id      │
│ token        │
│ platform     │
└──────────────┘
```

**Nota:** Las relaciones `user_id` entre databases son lógicas (no FK), porque cada servicio tiene su propia database. La integridad referencial entre servicios se mantiene a nivel de aplicación, y la limpieza al borrar cuenta se propaga por el evento `user.deleted`.
