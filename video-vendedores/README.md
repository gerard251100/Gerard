# Video vendedores Distinto (9:16)

- `distinto_vendedores_9x16.mp4` — video final 1080×1920, 30 fps, 37 s, música y efectos.
- `guion.md` — texto y tiempos para grabar la locución.
- `render.py` / `audio.py` — generan el video (Python + Pillow + numpy + ffmpeg).
- `assets/` — el perrito recortado (frente, perfil, espalda).

```bash
python3 render.py                    # regenera el video
python3 render.py --voice voz.wav    # con locución + boca sincronizada
python3 render.py --still 5 20       # exporta fotogramas de prueba
```
