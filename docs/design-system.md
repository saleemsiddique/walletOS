# WalletOS — Design System · "Ledger"

Identidad visual y de interacción de la app iOS. Fuente única para color, tipografía, forma, movimiento y tono. Todas las pantallas (`docs/screens/`) se construyen contra estos tokens.

> **Estado:** dirección estipulada el 2026-07-04 (sustituye a la identidad mascota/mostaza, retirada en el PR #160). Decisiones cerradas con el usuario: acento único **fósforo**, oscuro con **negro OLED puro**, importes con **verde/rojo clásicos**. Pendiente: re-tokenizar `Core/Theme/*` y re-especificar pantallas contra esta dirección.

---

## 1. Concepto — un libro contable en tu bolsillo

WalletOS gestiona tus finanzas y tu **patrimonio total** repartido en varios bancos. La estética toma el ADN de una **terminal** — monocromo, números monoespaciados, cero decoración, una sola cosa que hacer en cada momento — y lo ejecuta con los materiales **nativos de iOS moderno**: SF Pro y SF Mono, hairlines, materiales del sistema, Dynamic Type. Extrema simpleza que se siente premium, no retro.

Principios de marca:

- **Simplicidad radical:** cada pantalla resuelve una cosa; añadir un gasto en 3 toques.
- **El número es el protagonista:** cada pantalla se resume en una cifra grande; el resto es contexto.
- **Silencio visual:** sin ilustración, sin mascotas, sin gradientes, sin sombras decorativas.
- **Una mano:** la acción primaria vive en la zona del pulgar.

## 2. Color

**6 tokens. Nada más.** Monocromo por defecto; el color solo con significado (interacción y signo del dinero). Nunca decorativo: ni colores por categoría, ni fondos tintados, ni gradientes.

| Token      | Light     | Dark (OLED) | Uso                                                          |
| ---------- | --------- | ----------- | ------------------------------------------------------------ |
| `bg`       | `#F7F7F5` | `#000000`   | Fondo de pantalla (papel neutro / negro puro, píxel apagado) |
| `surface`  | `#FFFFFF` | `#0D0D0C`   | Solo sheets y elementos elevados                             |
| `ink`      | `#141413` | `#F2F2EF`   | Texto principal                                              |
| `ink-soft` | `#6E6E69` | `#8A8A85`   | Texto secundario, metadatos, iconos en reposo                |
| `hairline` | `#E2E2DC` | `#232322`   | Separadores de 0,5 pt (la única "caja" permitida)            |
| `accent`   | `#17804A` | `#30D158`   | **Fósforo** — único acento: interacción + ingresos           |

Semántica de importes (decisión cerrada: verde/rojo clásicos):

| Token     | Light     | Dark      | Uso                                 |
| --------- | --------- | --------- | ----------------------------------- |
| `income`  | `#17804A` | `#30D158` | Ingresos (`+`); es el propio acento |
| `expense` | `#C6362D` | `#FF453A` | Gastos (`−`) y errores/destructivo  |

Reglas:

- Contraste **AA mínimo** en todos los pares texto/fondo (el light de `accent`/`income` es `#17804A` y no `#1E9E5A` precisamente por esto; verificar en test como en la Rama 2).
- `accent` como tint global de la app (links, botones de texto, toggles, selección).
- El rojo `expense` es también el color de acciones destructivas — no introducir otro.

## 3. Tipografía — dos voces, ambas del sistema

| Voz                       | Fuente                      | Uso                                                           |
| ------------------------- | --------------------------- | ------------------------------------------------------------- |
| **Datos** (alma terminal) | **SF Mono** (`.monospaced`) | TODO número: patrimonio, importes, porcentajes, fechas cortas |
| **Interfaz**              | SF Pro (sistema)            | Títulos, texto, botones, formularios                          |

Escala (anclada a text styles del sistema → Dynamic Type):

| Rol       | Base                         | Uso                                        |
| --------- | ---------------------------- | ------------------------------------------ |
| `hero`    | 34–40 SF Mono semibold       | La cifra protagonista de cada pantalla     |
| `title`   | 28 SF Pro bold (large title) | Título de pantalla (patrón nativo iOS)     |
| `body`    | 17 SF Pro regular            | Texto general, filas                       |
| `amount`  | 15–17 SF Mono medium         | Importes en filas                          |
| `caption` | 11–13 SF Pro, tracking +6 %  | Etiquetas en MAYÚSCULAS, metadatos, fechas |

- Signo siempre explícito en importes: `−42,30` / `+2.100,00` (menos tipográfico U+2212, no guion).
- Moneda EUR, `Locale es_ES` (se mantiene el formateador existente).

## 4. Forma y elevación

- **Espacio en vez de cajas:** jerarquía por espacio en blanco y hairlines de 0,5 pt (como Ajustes/Notas). Sin tarjetas por defecto y **sin sombras**.
- **Radios:** 12 continuo para lo poco que tenga contenedor (botón primario, sheets, campos). Un solo radio, no una escala.
- **Espaciado:** base 4 (`4, 8, 12, 16, 24, 32`); margen de pantalla 20; las listas respiran (filas ≥ 44 pt).
- **Materiales del sistema:** sheets con detents, `ultraThinMaterial` en barras, large title que colapsa al hacer scroll.

## 5. Iconografía

- **Cero emoji en la UI** (se mantiene del sistema anterior): todo icono es SF Symbol, traducido desde el `icon` emoji del backend con `IconCatalog` (bidireccional, fallbacks `ellipsis.circle`/`questionmark.circle`). El contrato del backend no cambia.
- SF Symbols en peso **`.light`/`.regular`**, monocromos (`ink-soft` en reposo, `ink` activo). Sin rellenos `.fill` salvo estados seleccionados, sin colores por categoría.

## 6. Movimiento

- Lo que dé el sistema, y poco más: transiciones nativas de navegación y sheets.
- **Números que ruedan:** `contentTransition(.numericText())` al cambiar cualquier cifra — el detalle premium de la casa.
- Duraciones cortas (150–250 ms), `easeInOut`; sin springs exagerados ni parallax.
- Reduce Motion: sin transiciones numéricas ni animaciones de entrada.

## 7. Reglas de simpleza (contrato de cada pantalla)

1. **Una acción primaria por pantalla** — un solo botón visible; lo secundario vive en gestos nativos: swipe en filas, long-press → menú contextual, tirar para cerrar sheets.
2. **El número protagonista arriba** — la pantalla se entiende con un vistazo a la cifra.
3. **Listas planas con hairlines**, sin secciones decoradas.
4. **Color solo con significado** — fósforo interactivo/ingresos, rojo gastos/destructivo; el resto tinta.
5. **Estados vacíos de una línea** — texto + acción ("Sin movimientos. Añade el primero."); sin ilustraciones.

## 8. Detalles premium (coste cero, todos del sistema)

- Negro OLED puro en oscuro (píxel apagado).
- `contentTransition(.numericText())` en el patrimonio y los totales.
- Haptic único y ligero al guardar; silencio en el resto.
- Privacidad de un toque: tap en el patrimonio → `••••••` (redacted), persistente por sesión.
- `tabular-nums`/SF Mono alinean columnas de importes en cualquier lista.

## 9. Tono de voz

- Español, frases cortas, directo al grano. Sin exclamaciones, sin regañar, sin jerga.
- Los botones dicen exactamente lo que hacen: "Añadir", "Guardar", "Entrar".
- Errores: qué pasó y qué hacer, en una línea.

## 10. Accesibilidad (se mantiene como requisito)

- Contraste AA en todos los pares (test automatizado como el de la Rama 2).
- Dynamic Type en todos los textos; VoiceOver con importes leídos con moneda; Reduce Motion respetado; toques ≥ 44 pt.

## 11. Referencias

- Plan de fase iOS: `docs/phase-10-ios-app.md` · Contratos: `docs/api-contracts.md` · Flujo/BDD: `docs/user-flow-and-bdd.md` · Specs de pantalla: `docs/screens/`.
- Mockups de la dirección aprobada: artifact "ledger" (sesión de diseño 2026-07-04).
