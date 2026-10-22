# Videos y motion graphics (Remotion)

Los videos se hacen con código React en esta carpeta.

## Comandos

```bash
npm install            # una sola vez
npm run video:studio   # editor visual en el navegador, con vista previa en vivo
npm run video:render   # exporta out/intro.mp4
```

## Archivos

- `index.jsx`: punto de entrada (no hace falta tocarlo).
- `Root.jsx`: lista de videos (composiciones): tamaño, fps y duración.
- `Intro.jsx`: video de ejemplo con transiciones, formas animadas y fuente de Google.

## Paquetes instalados

| Paquete | Para qué sirve |
|---|---|
| `@remotion/transitions` | Transiciones entre escenas (fade, slide, wipe, flip...) |
| `@remotion/shapes` | Formas SVG: círculo, estrella, triángulo, polígonos |
| `@remotion/paths` | Animar trazos SVG (efecto "dibujado"), morphing |
| `@remotion/noise` | Movimiento orgánico/aleatorio |
| `@remotion/motion-blur` | Desenfoque de movimiento |
| `@remotion/animation-utils` | Ayudas para animar transformaciones CSS |
| `@remotion/layout-utils` | Medir y ajustar texto al espacio disponible |
| `@remotion/google-fonts`, `@remotion/fonts` | Fuentes de Google o propias |
| `@remotion/media`, `@remotion/media-utils` | Insertar y recortar video/audio, visualizar audio |
| `@remotion/captions` | Subtítulos animados |
| `@remotion/lottie`, `@remotion/gif` | Animaciones Lottie (After Effects) y GIFs |
| `@remotion/player` | Reproducir los videos dentro de una página web |
| `@remotion/zod-types` + `zod` | Parámetros editables desde el Studio |

Todos los paquetes `remotion` y `@remotion/*` deben tener **la misma versión exacta**.
Para actualizar: `npx remotion upgrade`. Para verificar: `npx remotion versions`.

## Skills para Claude

En `.claude/skills/` están las skills oficiales de Remotion (`remotion-best-practices`,
`remotion-create`, `remotion-captions`, `remotion-multimedia`, `remotion-render`, etc.).
Claude Code las carga automáticamente al abrir este proyecto, así que basta con pedirle
"haz un video de..." y seguirá las buenas prácticas de Remotion.

## Video de galería de perfumes (`PerfumeGallery`)

Video vertical 4K (2160x3840) sobre fondo verde chroma puro (#00FF00). Muestra los 3 perfumes (sin fondo, a la misma altura)
que se deslizan a la derecha: 2 s de movimiento lento, barrido rápido de 0.3 s con desenfoque de
movimiento, y así sucesivamente. Dura 6.9 s y hace loop perfecto. El código está en `PerfumeGallery.jsx`.

### Poner las fotos reales

1. Copia las fotos originales (fondo blanco) en `remotion/public/perfumes/originales/` con estos nombres:
   - `rasasi-hawas-chrome.jpg`
   - `armaf-dunescape.jpg`
   - `armaf-odyssey-mandarinsky.jpg`
2. Ejecuta `npm run video:recortar`. Quita el fondo blanco, recorta justo al frasco y guarda los PNG en `remotion/public/perfumes/`.
3. Ejecuta `npm run video:perfumes`, que exporta `out/perfume-gallery.mp4`, o revísalo antes con `npm run video:studio`.

Si falta alguna foto, el video usa un dibujo provisional del frasco.

Para recortar el fondo verde con mejor calidad en el editor, exporta en ProRes:
`npx remotion render PerfumeGallery out/perfume-gallery.mov --codec=prores --prores-profile=4444`
