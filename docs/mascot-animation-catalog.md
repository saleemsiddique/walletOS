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

| id   | Archivo                  | Estado       | Qué hace                                      | Disparo                         | Pantallas                | Dur.  | Loop         | Prioridad |
| ---- | ------------------------ | ------------ | --------------------------------------------- | ------------------------------- | ------------------------ | ----- | ------------ | --------- |
| M-01 | `mascot_idle_serene`     | serene       | Respira, parpadea, manos juntas               | Reposo / balance neutro         | Home, Splash             | 3 s   | Sí           | Alta      |
| M-02 | `mascot_happy_count`     | happy        | Saca billetes y los cuenta sonriendo          | Balance sano / ingreso guardado | Home, guardar ingreso    | 3 s   | 1 vez → idle | Alta      |
| M-03 | `mascot_overflow_burst`  | overflow     | Rebosa billetes, tiembla, "va a explotar"     | Balance muy alto                | Home                     | 2,5 s | Sí           | Media     |
| M-04 | `mascot_empty_cry`       | empty        | Se seca una lágrima, hombros caídos           | Balance bajo / vacío            | Home, estados vacíos     | 3 s   | Sí (lento)   | Alta      |
| M-05 | `mascot_serene_wave`     | serene       | Saluda con la mano                            | Onboarding / primer login       | Setup, Auth              | 2 s   | 1 vez        | Alta      |
| M-06 | `mascot_serene_nod`      | serene       | Guiño/asiente al registrar gasto              | Guardar gasto                   | Modal añadir             | 1,5 s | 1 vez        | Media     |
| M-07 | `mascot_serene_lose`     | serene→empty | Suelta billetes, susto leve (termómetro baja) | Alerta de gasto alto            | Banner / push            | 2 s   | 1 vez        | Media     |
| M-08 | `mascot_happy_narrate`   | happy        | Presenta/señala como narrador                 | Detalle de insight              | Insights                 | 3 s   | Sí           | Media     |
| M-09 | `mascot_happy_celebrate` | happy        | Salta con confeti                             | Meta / superávit / celebración  | Home, éxito              | 2,5 s | 1 vez        | Baja      |
| M-10 | `mascot_serene_shrug`    | serene       | Encoge hombros, mira alrededor                | Error / sin conexión            | Estados error/offline    | 2 s   | Sí           | Baja      |
| M-11 | `mascot_empty_farewell`  | empty        | Se despide con la mano                        | Logout / eliminar cuenta        | Ajustes                  | 2 s   | 1 vez        | Baja      |
| M-12 | `mascot_serene_thinking` | serene       | Se rasca, pensativo                           | Cargando / generando insight    | Loading, generar insight | 2 s   | Sí           | Baja      |

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

## Tamaños de slot

Ver `docs/design-system.md` §3 ("Tamaños de slot"): `mascot/hero` (Home, Setup), `mascot/panel` (Insights, vacíos con contexto), `mascot/inline` (Ajustes, banners), `mascot/widget` (widget). Los clips se exportan a @3x del valor en puntos. Provisionales hasta cerrar cada wireframe.

## Pendiente

- Revisar por pantalla si surgen clips nuevos (se añaden aquí con id `M-NN`).
- Ajustar el tamaño de slot de una pantalla concreta si su wireframe lo requiere (anotar el cambio en `design-system.md` §3).
