# WalletOS — Design System

Identidad visual y de interacción de la app iOS. Es la fuente única para color, tipografía, componentes, movimiento, tono de voz y el uso del personaje. Todas las pantallas (`docs/screens/`) se construyen contra estos tokens.

> **Estado:** base creada (2026-07-01). Pendiente de detalle fino tras diseñar las pantallas. Ver `docs/screens/README.md` para el estado global y "dónde continuar".

---

## 1. Marca y personalidad

WalletOS es una app de finanzas personales **cálida, clara y con carácter**. La personalidad la lleva el personaje: una **cartera de cuero antropomórfica** que reacciona a tu situación financiera. Nada de dark premium frío ni de dashboards intimidantes: la meta es que gestionar el dinero se sienta **fácil, cercano y hasta divertido**, sin perder rigor en los números.

Principios de marca:

- **Simplicidad radical:** cada pantalla resuelve una cosa. Añadir un gasto en 3 toques.
- **El personaje es la voz:** la cartera traduce el estado financiero a emoción legible de un vistazo.
- **Cálido, no infantil:** color y redondez amables, pero tipografía y datos impecables.
- **Una mano:** las acciones principales viven en la zona del pulgar (tercio inferior).

---

## 2. El personaje — la cartera

Mascota central. Un mismo personaje con **4 estados que forman un termómetro de dinero** (de vacío a rebosante):

| Estado    | Nombre interno | Expresión                               | Significado                     |
| --------- | -------------- | --------------------------------------- | ------------------------------- |
| Vacío     | `empty`        | Llorando, hombros caídos                | Balance muy bajo / sin dinero   |
| Neutral   | `serene`       | Sereno, manos juntas                    | Estado normal / reposo          |
| Sano      | `happy`        | Feliz, con billetes, sonrojado          | Buen balance / ahorro / ingreso |
| Rebosante | `overflow`     | Reventando de billetes, "va a explotar" | Abundancia / saldo muy alto     |

El eje es **cuánto dinero hay**, no estrés: `empty → serene → happy → overflow`. El Home escala el personaje por el balance/salud del mes; otras pantallas usan el estado que corresponda a su contexto.

**Rol en la app:** medidor emocional del Home, guía en onboarding, narrador de los insights semanales, reacción al guardar transacciones, cara de los estados vacíos/error, y protagonista del widget. Detalle de dónde aparece cada clip en `docs/mascot-animation-catalog.md`.

**Voz del personaje (tono):** cercano y en primera persona de la cartera cuando aporta — p. ej. _"Esta semana he engordado un poco 😌"_, _"Ando vacía, ¿registramos algo?"_. Nunca culpabiliza; informa y anima.

---

## 3. Animación del personaje (vídeo)

Las animaciones se producen como **clips de vídeo** (Midjourney, image-to-video, a partir de los 4 PNG base).

- **Hábitat mostaza:** el personaje vive siempre en un "escenario" de fondo **mostaza** (su color de marca), tanto en modo claro como oscuro. Así los clips de Midjourney (que traen fondo mostaza) encajan sin recorte ni chroma, y no hay que regenerarlos por tema.
- **Disparo por evento/estado**, no scrubbing: el clip se reproduce al ocurrir algo (guardar, cambiar de mes, entrar a una pantalla). Si en el futuro se quiere reacción en tiempo real al gesto del dedo, esa pieza puntual iría en Rive (fuera de v1).
- **Formato:** MP4 (H.264/HEVC), 30 fps, 2–4 s, @3x del tamaño del slot. Loop limpio (primer y último frame idénticos en los clips que hacen loop). Sin audio.
- **Naming:** `mascot_<estado>_<gesto>.mp4` (ej. `mascot_idle_serene.mp4`, `mascot_happy_count.mp4`).
- **Ubicación de assets:** `ios/WalletOS/Resources/Mascot/`.
- **Placeholder:** mientras no exista el clip, se muestra el **PNG del estado**. La app funciona con o sin vídeos.
- **Reduce Motion:** si el usuario activa "Reducir movimiento", se muestra el **frame estático** del estado en lugar del vídeo.

### Motor `MascotView` (rama `feature/ios-mascot`)

Componente que aísla la reproducción para que las pantallas solo declaren el slot:

```swift
enum MascotState { case empty, serene, happy, overflow }
enum MascotGesture { case idle, wave, count, celebrate, cry, loseMoney, narrate, thinking }

// Reproduce mascot_<state>_<gesture>.mp4; si no existe, cae a idle del estado; si no, al PNG.
MascotView(state: .happy, gesture: .count)
```

Las pantallas dejan el hueco (`MascotView(...)`) y los vídeos se colocan luego en `Resources/Mascot/` con el nombre del catálogo, sin tocar la pantalla.

---

## 4. Color

Paleta derivada del propio personaje: cuero, mostaza y crema. Se definen **tokens semánticos** con valor para modo claro y oscuro. El modo oscuro es **monocromático sepia** (gama cálida derivada del cuero), no gris frío.

### Colores base de marca

| Token           | Hex       | Uso                                                  |
| --------------- | --------- | ---------------------------------------------------- |
| `brand/amber`   | `#F2A81D` | Color primario, hábitat del personaje, acentos clave |
| `brand/leather` | `#9C6B43` | Cuero secundario, cuerpo del personaje               |
| `brand/ink`     | `#3B2416` | Contornos, texto principal (light)                   |
| `brand/cream`   | `#FBF1DD` | Fondo claro                                          |

### Tokens semánticos

| Token            | Light     | Dark (sepia) | Uso                                          |
| ---------------- | --------- | ------------ | -------------------------------------------- |
| `bg`             | `#FBF1DD` | `#1A120B`    | Fondo de pantalla                            |
| `surface`        | `#FFFFFF` | `#241811`    | Tarjetas, modales                            |
| `surface-alt`    | `#F5EAD6` | `#2E2016`    | Superficies secundarias                      |
| `text-primary`   | `#3B2416` | `#F3E7D3`    | Texto principal                              |
| `text-secondary` | `#7A6552` | `#B79E82`    | Texto secundario                             |
| `text-on-brand`  | `#FFFFFF` | `#1A120B`    | Texto sobre mostaza                          |
| `accent`         | `#F2A81D` | `#E0A63A`    | Acento / marca                               |
| `income`         | `#6FA85C` | `#7FB56A`    | Ingresos / positivo                          |
| `expense`        | `#E5544B` | `#E0655C`    | Gastos / negativo / alertas                  |
| `separator`      | `#E7D9BF` | `#3A2A1C`    | Líneas divisorias                            |
| `mascot-stage`   | `#F2A81D` | `#F2A81D`    | Fondo del personaje (mostaza en ambos temas) |

> **Contraste:** todos los pares texto/fondo cumplen WCAG AA. `text-on-brand` sobre `accent` se valida por tamaño (texto grande).

---

## 5. Tipografía

**SF Pro Rounded** (nativa iOS, sin licenciar) — redondeada y amable como el personaje, con números impecables. Los importes usan **dígitos monoespaciados** (`.monospacedDigit()`) para alinear.

| Rol        | Tamaño | Peso     | Uso                    |
| ---------- | ------ | -------- | ---------------------- |
| `balance`  | 40–48  | Bold     | Balance total del Home |
| `title`    | 28     | Bold     | Títulos de pantalla    |
| `headline` | 20     | Semibold | Secciones              |
| `body`     | 17     | Regular  | Texto general          |
| `amount`   | 17     | Semibold | Importes en filas      |
| `caption`  | 13     | Regular  | Metadatos, fechas      |

- **Dynamic Type:** todas las escalas se anclan a los text styles del sistema para soportar tamaños accesibles.
- **Moneda:** formato EUR con `FormatStyle`/`Locale` `es_ES` (`1.234,56 €`).

---

## 6. Layout, forma y elevación

- **Espaciado (base 4):** `4, 8, 12, 16, 20, 24, 32`. Margen de pantalla estándar: `16`.
- **Radios:** `sm 8`, `md 12`, `lg 20` (tarjetas), `pill 999` (botones/píldoras). Redondez generosa acorde al personaje.
- **Sombras:** cálidas y suaves (color `brand/ink` a baja opacidad, blur amplio, offset pequeño). Nada de sombras duras.
- **Zona del pulgar (one-hand):** las acciones primarias (botones Gasto/Ingreso, FAB, CTA de modales) viven en el **tercio inferior** y alcanzables con una mano. Altura mínima de toque **56–64 pt**.

---

## 7. Iconografía

- **SF Symbols** como set base (consistencia iOS, Dynamic Type, multicolor cuando aporte).
- Iconos de **categorías y bancos**: emoji/icono + color definidos por el usuario (el backend guarda `icon` y `color`). Respetar el `color` del recurso.
- El **personaje** es la única ilustración de marca; no mezclar otros estilos ilustrados.

---

## 8. Componentes base

Definidos una vez y reutilizados (registro vivo en `docs/screens/README.md`):

- **Acciones:** `PrimaryButton`, `ExpenseIncomeButtons` (dos botones grandes coral/verde, one-hand), `FloatingAddButton` (FAB del tab bar).
- **Navegación:** `RootTabBar` (Home, Cuentas, Stats, Insights + FAB central).
- **Datos:** `BalanceHeadline`, `MonthDeltaPill` (variación con flecha, verde/coral), `TransactionRow`, `WalletChip`, `BankSection`.
- **Entrada:** `AmountKeypad`, `CategoryGrid` (4 col.), `IconPicker`, `ColorPicker`, `WalletPicker`.
- **Personaje:** `MascotView`, `MascotPanel` (mascota + hábitat mostaza).
- **Estados:** `EmptyState`, `ErrorState`, `LoadingState`, `Toast` (con "Deshacer").

---

## 9. Movimiento

- **Duraciones:** `fast 150ms`, `base 250ms`, `slow 400ms`.
- **Curvas:** spring suave para elementos "vivos" (botones, mascota, aparición de tarjetas); ease-in-out para transiciones de pantalla.
- **Transición de estado de la mascota:** crossfade ~300ms entre clips.
- **Guardar transacción:** check ✓ + reacción corta de la mascota; el modal se cierra sin pantalla de confirmación.
- Respeta **Reduce Motion** (frames estáticos, sin springs exagerados).

---

## 10. Haptics

- `.success` — guardar ingreso, cumplir meta.
- `.light` (impact) — toques de acción, swipe, cambio de segmento.
- `.warning` — alerta de gasto alto.
- Sin haptics en scroll ni en acciones pasivas.

---

## 11. Tono de voz (copys)

- **Español**, cercano, claro, sin jerga financiera innecesaria.
- Frases cortas y accionables. El "qué hago ahora" siempre evidente.
- El personaje habla en primera persona solo cuando aporta calidez (Home, insights, estados vacíos); en formularios y errores, lenguaje neutro y directo.
- Ejemplos: vacío → _"Aún no hay movimientos. Toca **+ Ingreso** o **− Gasto** para empezar."_ · gasto alto → _"Gasto alto detectado: {importe} en {categoría}."_

---

## 12. Accesibilidad

- Contraste **AA** en todos los tokens.
- **Dynamic Type** en todos los textos.
- **VoiceOver:** el personaje expone su estado como etiqueta (_"Tu cartera: balance saludable"_); los importes se leen con moneda.
- **Reduce Motion:** vídeos → frame estático.
- Objetivos de toque ≥ 44 pt (primarios 56–64 pt).

---

## 13. Referencias

- Estados/expresiones del personaje: los 4 PNG base (fuente de la mascota).
- Plan de fase iOS: `docs/phase-10-ios-app.md`.
- Contratos de datos: `docs/api-contracts.md`.
- Flujos y BDD: `docs/user-flow-and-bdd.md`.
- Catálogo de clips: `docs/mascot-animation-catalog.md`.
- Specs de pantalla: `docs/screens/`.
