# 01. Auth (login / registro)

**Estado:** ✅ hecho (spec) — pendiente de reimplementar en iOS (la Rama 9 / PR #158 se entregó sin esta spec y se rehace contra ella)
**Rama iOS asociada:** `feature/ios-auth-screen` (rediseño: rama nueva sobre `develop`)
**Referencias:** `design-system.md` · `mascot-animation-catalog.md` · `api-contracts.md` · `user-flow-and-bdd.md` (pantalla 1)

---

## Objetivo

Primera pantalla de la app: presentar al personaje (la cartera es la marca) y dejar entrar o crear cuenta en el mínimo de fricción. La mascota no es decoración en una caja: **la pantalla empieza dentro de su hábitat** y el formulario emerge de él.

## Concepto visual — "te recibe en su casa"

La mitad superior de la pantalla es el **hábitat mostaza a sangre completa** (edge-to-edge, incluida la safe area superior y el notch). El PNG/clip del personaje se funde con esa banda **sin marco, sin tarjeta y sin costura**, porque el fondo de la banda usa exactamente el color de fondo de los PNG generados (`#F0B300`, ver "Decisión de color" abajo). La banda termina en una **curva cóncava generosa** (radio 32 solo en las esquinas inferiores) sobre el fondo crema, como un telón que se abre hacia el formulario.

El personaje **reacciona al modo**:

- **Entrar** → `serene` (saluda al aparecer, luego respira en idle).
- **Crear cuenta** → `happy` (crossfade 300 ms al cambiar el toggle: una cuenta nueva le hace ilusión).

## Entrada y navegación

- **Se llega desde:** arranque de la app con `AuthState == signedOut`; también tras logout y tras completar reset de contraseña.
- **Lleva a:** decisión Setup vs Home (Rama 14) tras autenticar; Forgot password (Rama 12) desde el link; Apple/Google (Ramas 10–11) desde sus botones.
- **Condiciones:** ninguna (es la raíz no autenticada).

## Wireframe

```
┌─────────────────────────────┐
│█████████████████████████████│  ← banda mostaza #F0B300 a sangre
│████ (safe area incluida) ███│    (también bajo el notch)
│████                     ████│
│████      ╭───────╮      ████│
│████      │Mascota│      ████│  ← 180 pt, SIN marco: el PNG se
│████      ╰───────╯      ████│    funde con la banda (mismo color)
│████     WalletOS        ████│  ← wordmark `title` en tinta
│████  Hola, soy tu cartera███│  ← `body` tinta al 70 %
│╰──────── curva 32 ─────────╯│
│                             │  ← crema `bg`
│   ╭──────────┬───────────╮  │
│   │ ●Entrar  │Crear cuenta│ │  ← toggle pill propio (NO el
│   ╰──────────┴───────────╯  │    segmented del sistema)
│                             │
│   ✉  Email                  │  ← campos `surface`, radio md,
│   ────────────────────────  │    icono SF a la izquierda
│   🔒 Contraseña          👁 │  ← ojo para mostrar/ocultar
│   ────────────────────────  │
│         ¿Olvidaste tu contraseña? │ ← solo Login, alineado derecha
│ ╔═════════════════════════╗ │
│ ║       [ Entrar ]        ║ │  ← zona del pulgar, PrimaryButton
│ ╚═════════════════════════╝ │    pill 56 pt, sombra cálida
│      ───────  o  ───────    │
│   ╭─────────╮ ╭──────────╮  │
│   │  Apple │ │ G Google │  │  ← 2 pills compactas lado a lado,
│   ╰─────────╯ ╰──────────╯  │    outline sobre crema
└─────────────────────────────┘
```

Modo **Crear cuenta**: se inserta el campo "Nombre" encima de Email (con transición suave), aparece el hint _"Mínimo 8 caracteres"_ bajo Contraseña, el CTA pasa a "Crear cuenta" y el link de forgot desaparece. La mascota pasa a `happy`.

**Teclado abierto**: la banda mostaza **colapsa a una franja compacta** (~96 pt: mascota `mascot/inline` 56–64 pt a la izquierda + wordmark a su derecha), animada con spring suave (§9), para que formulario y CTA queden siempre visibles. Al cerrar el teclado, la banda se re-expande.

## Decisión de color (ajuste al design system)

- Los 4 PNG base traen fondo **`#F0B300`** (muestreado en las esquinas de los cuatro: `#EDB100…#F5B700`, medoide `#F0B300`). El token `mascot-stage` actual (`#F2A81D`) **no coincide** y produce una costura visible alrededor del PNG.
- **Cambio:** `mascot-stage` pasa a `#F0B300` (ambos temas), anotado en `design-system.md` §4. `accent` **no cambia** (`#F2A81D` sigue siendo el color de acción).
- Texto sobre la banda: `text-on-brand` (tinta `#3B2416`) — contraste sobre `#F0B300` ≈ 7,1:1 (AA/AAA).

## Datos y endpoints

- **`POST /api/register`** — `{ email, password, name }` → `AuthResponse` (`user`, `access_token`, `refresh_token`).
- **`POST /api/login`** — `{ email, password }` → mismo shape.
- **Cache/offline:** nada que cachear; sin red se deshabilita el envío y se muestra el estado offline.
- **Cola de sync:** no aplica (la auth nunca se encola).

## Componentes

- **Compartidos existentes:** `PrimaryButton`, `MascotView` (el personaje va **directo sobre la banda**, sin `MascotPanel`: el panel con clip y radio es para slots enmarcados en otras pantallas).
- **Nuevos (añadir al registro de `README.md`):**
  - `MascotStage` — banda mostaza a sangre con curva inferior 32 y slot de mascota integrado; reutilizable en Setup (pantalla 04, mismo concepto de bienvenida).
  - `SegmentedPillToggle` — toggle de 2 opciones estilo pill: contenedor `surface-alt`, thumb deslizante `surface` con sombra cálida, animación spring; reutilizable donde haya 2 modos (p. ej. Gasto/Ingreso si se quisiera).
  - `IconTextField` — campo con SF Symbol a la izquierda (`envelope`, `lock`, `person`), relleno `surface`, radio `md`, borde `separator` 1 pt (→ `accent` con focus); variante segura con ojo (`eye` / `eye.slash`).
  - `SocialSignInButton` — pill outline (borde `separator`, texto `text-primary`) con SF Symbol (`apple.logo` / `g.circle`); compacta, dos por fila.

## Tokens usados

- Color: banda `mascot-stage` (**#F0B300**); fondo `bg`; campos `surface` con borde `separator`/`accent`; CTA `accent` + `text-on-brand`; error `expense`; textos `text-primary`/`text-secondary`; sobre la banda, `text-on-brand`.
- Tipografía: `title` (wordmark), `body` (saludo, campos, botones sociales), `headline` (CTA), `caption` (hint contraseña, "o").
- Espaciado: margen 16; bloques 24; entre campos 12. Radios: banda 32 (solo abajo), campos `md 12`, toggle/CTA/sociales `pill`.
- Sombra cálida (§6) en CTA y en el thumb del toggle. Nada de sombra en la banda (es fondo, no tarjeta).

## Slots de mascota

Slot propio de esta pantalla: **integrado en `MascotStage`**, 180 pt expandido / 56–64 pt (`mascot/inline`) colapsado con teclado. Sin fondo propio ni recorte: la banda ES el hábitat.

| Momento                            | Clip                                                    | Loop         |
| ---------------------------------- | ------------------------------------------------------- | ------------ |
| Aparecer la pantalla (modo Entrar) | `mascot_serene_wave` (M-05)                             | 1 vez → idle |
| Reposo en modo Entrar              | `mascot_serene_idle` (M-01)                             | Sí           |
| Cambiar a Crear cuenta             | crossfade a `mascot_happy_idle` (M-13, **nuevo**)       | Sí           |
| Enviando credenciales (loading)    | `mascot_serene_thinking` (M-12)                         | Sí           |
| Error de red / servidor            | `mascot_serene_shrug` (M-10)                            | Sí           |
| Éxito                              | haptic `.success` y transición de raíz; sin clip propio |              |

Credenciales incorrectas (401) **no** cambian a la mascota (equivocarse de contraseña no es un drama financiero): mantiene su idle y el error se comunica en el formulario. Con Reduce Motion, PNG estático del estado (`serene`/`happy`), sin gestos.

## Estados de la pantalla

- **Idle:** formulario editable, CTA deshabilitado (50 % opacidad) hasta que la validación local pasa.
- **Cargando:** CTA con spinner y deshabilitado; campos bloqueados; mascota M-12.
- **Error de credenciales (401):** mensaje bajo los campos en `expense` + shake horizontal suave del bloque de campos + haptic `.warning`.
- **Error de validación del backend (400/409):** mismo tratamiento; en registro, 409 → _"Ese email ya está registrado."_ con acción inline "Entrar" que cambia el toggle a Login conservando el email.
- **Offline:** CTA deshabilitado + aviso bajo el CTA _"Sin conexión."_; mascota M-10.
- **Rate limited (429):** _"Demasiados intentos. Espera un momento."_

## Microinteracciones y haptics

- Cambio de toggle → haptic `.light`, thumb con spring, crossfade de mascota (300 ms) y aparición/desaparición animada del campo Nombre y del link de forgot.
- Focus en campo → borde pasa de `separator` a `accent` (150 ms `fast`).
- Ojo de contraseña → alterna SecureField/TextField sin perder el valor ni el foco.
- Enviar → haptic `.light`; éxito → `.success`; error → `.warning` + shake (desactivado con Reduce Motion).
- Teclado: colapso/expansión de la banda con spring suave; con Reduce Motion, cambio sin animación.
- Return del teclado encadena foco: Nombre → Email → Contraseña → enviar (si válido).

## Accesibilidad

- Dynamic Type en todos los textos (roles del design system).
- VoiceOver: mascota _"Tu cartera te saluda"_ (elemento decorativo-informativo, no botón); toggle como tabs ("Entrar, pestaña 1 de 2"); error anunciado al aparecer (`accessibilityLiveRegion`/announcement); ojo de contraseña "Mostrar contraseña"/"Ocultar contraseña".
- Reduce Motion: sin clips, sin shake, sin spring de colapso.
- Toques: CTA 56 pt; sociales 48–56 pt; toggle ≥ 44 pt; ojo ≥ 44 pt.
- Contraste: todos los pares AA (banda con tinta 7,1:1; error `expense` sobre `bg` verificado en Rama 2).

## Copys / tono

- Saludo (única línea con voz del personaje): _"Hola, soy tu cartera."_ — en registro cambia a _"¡Una cartera nueva!"_.
- Toggle: "Entrar" / "Crear cuenta". CTA: "Entrar" / "Crear cuenta".
- Campos: "Nombre", "Email", "Contraseña". Hint registro: _"Mínimo 8 caracteres."_
- Link: _"¿Olvidaste tu contraseña?"_. Separador social: "o".
- Sociales: "Apple" / "Google" (pills compactas; el contexto ya dice "continuar con").
- Errores (lenguaje neutro y directo, §11): 401 _"Email o contraseña incorrectos."_ · 409 _"Ese email ya está registrado."_ · validación _"Revisa los datos introducidos."_ · 429 _"Demasiados intentos. Espera un momento."_ · offline _"Sin conexión."_ · genérico _"Algo ha ido mal. Inténtalo de nuevo."_

## Casos borde y validaciones

- Validación local: email con forma válida; contraseña ≥ 8; nombre no vacío (solo registro). CTA deshabilitado hasta cumplirlas; sin mensajes de error por campo antes del primer envío (no regañar mientras se escribe).
- Cambiar de modo resetea el estado de error, conserva email/contraseña escritos.
- Apple/Google: **placeholders deshabilitados** hasta Ramas 10–11 (visibles para asentar el layout, opacidad 50 %).
- Autofill de iOS: `textContentType` correcto (`.username`/`.password` en login, `.name`/`.newPassword` en registro) — nota: `.newPassword` activa la sugerencia de contraseña segura del sistema; es el comportamiento deseado en dispositivo.
- Teclado email sin autocapitalización ni autocorrección.

## Estado y próximos pasos

- Cerrado: hero mostaza a sangre sin marco; color de banda = fondo real de los PNG (`#F0B300`); mascota reactiva al modo (serene/happy); banda colapsable con teclado; toggle pill propio en vez del segmented del sistema.
- Clips a producir para esta pantalla (por prioridad): **M-05** `mascot_serene_wave`, **M-01** `mascot_serene_idle`, **M-13** `mascot_happy_idle` (nuevo, lo comparte Home), **M-12** `mascot_serene_thinking`, **M-10** `mascot_serene_shrug`. Sin clips, la pantalla funciona con los PNG (`serene`/`happy`).
- Implementación: rehacer `AuthView` (la lógica de `AuthViewModel`, repos y tests de la Rama 9 se conservan; cambia solo Presentation) + ajustar el colorset `mascotStage` a `#F0B300`.
- Al implementarla, validar la curva y el colapso con teclado en simulador y ajustar aquí lo que cambie.
- Siguiente pantalla sugerida: **`04-setup.md`** (reutiliza `MascotStage` y el mismo concepto de bienvenida).
