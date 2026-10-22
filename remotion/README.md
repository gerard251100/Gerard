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
