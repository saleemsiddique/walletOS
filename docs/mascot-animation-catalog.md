# WalletOS — Catálogo de animaciones del personaje

Lista maestra de clips de la mascota (la cartera). Es la **lista de producción**: cada fila es un vídeo a generar en Midjourney. Las pantallas los consumen por `id` a través de `MascotView` (ver `docs/design-system.md` §3).

> **Estado:** catálogo semilla (2026-07-01). **Motor `MascotView` implementado (Rama 3, PR #149):** resuelve el clip por estado/gesto con cascada a idle y a PNG, loop/one-shot, Reduce Motion y VoiceOver. Los **4 PNG base reales** ya están integrados en `Assets.xcassets` (`mascot_empty/serene/happy/overflow`). **Los vídeos `.mp4` aún NO existen** — se generan pantalla a pantalla: al cerrar cada pantalla se indica qué clip falta (estado + gesto) y se coloca en `ios/WalletOS/Resources/Mascot/` sin tocar código. Se ampliará al detallar cada pantalla en `docs/screens/`.

## Convenciones

- **Archivo:** `mascot_<estado>_<gesto>.mp4` en `ios/WalletOS/Resources/Mascot/`.
- **Estado base:** `empty` (#2) · `serene` (#1) · `happy` (#3) · `overflow` (#4).
- **Fondo:** siempre mostaza (hábitat del personaje), en claro y oscuro.
- **Formato:** MP4 H.264/HEVC, 30 fps, @3x, sin audio. Loop = primer y último frame idénticos.
- **Placeholder:** hasta tener el clip, se usa el PNG del estado. Con Reduce Motion, frame estático.

## Clips núcleo (v1)

| id   | Archivo                  | Estado       | Qué hace                                      | Disparo                               | Pantallas                   | Dur.  | Loop         | Prioridad |
| ---- | ------------------------ | ------------ | --------------------------------------------- | ------------------------------------- | --------------------------- | ----- | ------------ | --------- |
| M-01 | `mascot_serene_idle`     | serene       | Respira, parpadea, manos juntas               | Reposo / balance neutro               | Home, Splash, Auth          | 3 s   | Sí           | Alta      |
| M-02 | `mascot_happy_count`     | happy        | Saca billetes y los cuenta sonriendo          | Balance sano / ingreso guardado       | Home, guardar ingreso       | 3 s   | 1 vez → idle | Alta      |
| M-03 | `mascot_overflow_burst`  | overflow     | Rebosa billetes, tiembla, "va a explotar"     | Balance muy alto                      | Home                        | 2,5 s | Sí           | Media     |
| M-04 | `mascot_empty_cry`       | empty        | Se seca una lágrima, hombros caídos           | Balance bajo / vacío                  | Home, estados vacíos        | 3 s   | Sí (lento)   | Alta      |
| M-05 | `mascot_serene_wave`     | serene       | Saluda con la mano                            | Onboarding / primer login             | Setup, Auth                 | 2 s   | 1 vez        | Alta      |
| M-06 | `mascot_serene_nod`      | serene       | Guiño/asiente al registrar gasto              | Guardar gasto                         | Modal añadir                | 1,5 s | 1 vez        | Media     |
| M-07 | `mascot_serene_lose`     | serene→empty | Suelta billetes, susto leve (termómetro baja) | Alerta de gasto alto                  | Banner / push               | 2 s   | 1 vez        | Media     |
| M-08 | `mascot_happy_narrate`   | happy        | Presenta/señala como narrador                 | Detalle de insight                    | Insights                    | 3 s   | Sí           | Media     |
| M-09 | `mascot_happy_celebrate` | happy        | Salta con confeti                             | Meta / superávit / celebración        | Home, éxito                 | 2,5 s | 1 vez        | Baja      |
| M-10 | `mascot_serene_shrug`    | serene       | Encoge hombros, mira alrededor                | Error / sin conexión                  | Estados error/offline, Auth | 2 s   | Sí           | Baja      |
| M-11 | `mascot_empty_farewell`  | empty        | Se despide con la mano                        | Logout / eliminar cuenta              | Ajustes                     | 2 s   | 1 vez        | Baja      |
| M-12 | `mascot_serene_thinking` | serene       | Se rasca, pensativo                           | Cargando / generando insight          | Loading, Auth (enviando)    | 2 s   | Sí           | Media     |
| M-13 | `mascot_happy_idle`      | happy        | Respira feliz, billetes ondean suave          | Reposo en estado sano / modo registro | Home, Auth (registro)       | 3 s   | Sí           | Alta      |

## Briefs para Midjourney

Cada clip parte del PNG del estado correspondiente. Pauta general: **cámara fija**, **fondo mostaza**, **conservar contorno grueso y grano pintado**, movimiento sutil y legible. Para clips en loop, primer y último frame idénticos.

- **M-01 idle-serene:** la cartera respira (escala ~2 %), parpadea cada ~2 s, mantiene las manos juntas. Sensación de calma.
- **M-02 happy-count:** saca un fajo de billetes, los abanica y cuenta con una sonrisa; termina volviendo a reposo feliz.
- **M-03 overflow-burst:** repleta de billetes que asoman por arriba; vibración/temblor leve como si fuera a explotar; algún billete se asoma más.
- **M-04 empty-cry:** ojos llorosos, una lágrima cae y se la seca; hombros caídos; respiración lenta y triste.
- **M-05 serene-wave:** levanta un "brazo" y saluda dos veces con energía amable; sonrisa.
- **M-06 serene-nod:** asiente una vez y guiña un ojo, gesto de "hecho".
- **M-07 serene-lose:** expresión de susto leve; suelta un par de billetes que caen fuera de plano; transición hacia decaído.
- **M-08 happy-narrate:** gesto de presentador: extiende un "brazo" señalando hacia un lado, como mostrando datos.
- **M-09 happy-celebrate:** pequeño salto con los brazos arriba y confeti cayendo; máxima alegría.
- **M-10 serene-shrug:** encoge los "hombros" y mira a los lados con cara de "no sé / algo falla".
- **M-11 empty-farewell:** mirada triste, saluda despacio con la mano en señal de despedida.
- **M-12 serene-thinking:** se rasca la "sien", mira hacia arriba pensativo; loop sutil.
- **M-13 happy-idle:** respiración suave feliz; los billetes que asoman por arriba ondean ligeramente; parpadeo ocasional manteniendo la sonrisa.

## Producción — tanda 1 (pantalla 01-auth)

Los 5 clips que consume `01-auth.md`, por orden de prioridad. Flujo en Midjourney: **image-to-video** usando el PNG base del estado como frame inicial, `--motion low` siempre (movimiento sutil, cámara clavada). Los prompts van en inglés (los entiende mejor el modelo de vídeo). Regla de oro en todos: cámara estática, fondo mostaza `#F0B300` intacto, conservar contorno grueso y textura granulada, sin texto ni marcas de agua.

> **Truco para los loops:** Midjourney no garantiza primer y último frame idénticos. Para los idle (M-01, M-13, M-12, M-10) el loop perfecto se consigue en postproducción con ping-pong: `ffmpeg -i in.mp4 -filter_complex "[0:v]reverse[r];[0:v][r]concat=n=2:v=1" out.mp4` (ida + vuelta = loop sin salto). Para M-05 (1 vez) no hace falta: la app vuelve sola al idle al terminar.

| id   | Imagen base         | Prompt Midjourney (image-to-video)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-05 | `mascot_serene.png` | The cute anthropomorphic leather wallet character lifts one arm and waves hello twice with warm friendly energy, smiling gently, then returns the hand to its folded resting pose. Static camera, character centered, plain solid mustard yellow background stays unchanged, flat 2D cartoon illustration with thick dark brown outlines and grainy painted texture, subtle squash-and-stretch, no zoom, no camera movement, no text. `--motion low`                       |
| M-01 | `mascot_serene.png` | Gentle idle breathing animation: the cute leather wallet character's body softly inflates and deflates about two percent, it blinks slowly every two seconds, hands stay folded together, calm cozy mood. Static camera, plain solid mustard yellow background stays unchanged, flat 2D cartoon illustration with thick dark brown outlines and grainy painted texture, very subtle motion, no zoom, no camera movement, no text. `--motion low`                           |
| M-13 | `mascot_happy.png`  | Joyful idle breathing animation: the happy leather wallet character breathes softly with its big smile and closed happy eyes, the paper banknotes sticking out of its top sway very gently, cheeks stay blushed, a tiny cheerful bounce. Static camera, plain solid mustard yellow background stays unchanged, flat 2D cartoon illustration with thick dark brown outlines and grainy painted texture, subtle motion, no zoom, no camera movement, no text. `--motion low` |
| M-12 | `mascot_serene.png` | The cute leather wallet character raises one hand and scratches the side of its head, looking up thoughtfully with curious eyes, thinking pose, then lowers the hand slowly. Static camera, plain solid mustard yellow background stays unchanged, flat 2D cartoon illustration with thick dark brown outlines and grainy painted texture, subtle motion, no zoom, no camera movement, no text. `--motion low`                                                             |
| M-10 | `mascot_serene.png` | The cute leather wallet character shrugs its shoulders raising both small arms with open palms, tilts slightly and looks left and right with a puzzled "I don't know" expression, then returns to rest. Static camera, plain solid mustard yellow background stays unchanged, flat 2D cartoon illustration with thick dark brown outlines and grainy painted texture, subtle motion, no zoom, no camera movement, no text. `--motion low`                                  |

**Postproducción de cada clip** (una vez elegida la variante buena):

1. Recortar a la duración del catálogo (2–3 s) y, si es idle, aplicar el ping-pong de arriba.
2. Exportar MP4 H.264, 30 fps, sin audio, cuadrado (el slot de auth es 180 pt → **540×540 px @3x**; sirve también para el hero de Home a 200 pt/600 px si se exporta a 600×600).
3. Nombrar exactamente `mascot_<estado>_<gesto>.mp4` (p. ej. `mascot_serene_wave.mp4`) y soltarlo en `ios/WalletOS/Resources/Mascot/` — la app lo detecta sin tocar código.

## Tamaños de slot

Ver `docs/design-system.md` §3 ("Tamaños de slot"): `mascot/hero` (Home, Setup), `mascot/panel` (Insights, vacíos con contexto), `mascot/inline` (Ajustes, banners), `mascot/widget` (widget). Los clips se exportan a @3x del valor en puntos. Provisionales hasta cerrar cada wireframe.

## Pendiente

- Revisar por pantalla si surgen clips nuevos (se añaden aquí con id `M-NN`).
- Ajustar el tamaño de slot de una pantalla concreta si su wireframe lo requiere (anotar el cambio en `design-system.md` §3).
