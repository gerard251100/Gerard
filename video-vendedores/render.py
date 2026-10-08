#!/usr/bin/env python3
"""Video vertical 9:16 de Distinto: cómo registrarse como vendedor.

Uso:
    python3 render.py                       # video con música + efectos
    python3 render.py --voice voz.wav       # agrega tu locución (boca sincronizada a la voz)
"""
import argparse
import functools
import math
import os
import subprocess
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

import audio

W, H, FPS, DUR = 1080, 1920, 30, 37.0
HERE = os.path.dirname(os.path.abspath(__file__))
INTER = '/usr/share/fonts/opentype/inter/'
F_BLACK = INTER + 'InterDisplay-Black.otf'
F_XB = INTER + 'InterDisplay-ExtraBold.otf'
F_BOLD = INTER + 'InterDisplay-Bold.otf'
F_SEMI = INTER + 'InterDisplay-SemiBold.otf'
F_IT = INTER + 'InterDisplay-BoldItalic.otf'
F_EMOJI = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'

VIOLET = (108, 59, 255)
YELLOW = (255, 214, 10)
WHITE = (255, 255, 255)
WA_GREEN = (37, 211, 102)
DARK = (24, 16, 48)

# Guion (inicio, fin, texto). Los tiempos mandan sobre la animación de la boca.
LINES = [
    (0.5, 2.6, '¡Bienvenidos a Distinto!'),
    (3.2, 6.4, 'Registrarte y ganar dinero es súper fácil.'),
    (7.0, 8.8, 'Rellenás tus datos...'),
    (9.2, 13.9, '...y uno de nuestros administradores se pone en contacto contigo por WhatsApp.'),
    (15.2, 18.4, 'Luego te aceptamos... ¡y ya está!'),
    (19.0, 23.6, 'Podés generar ingresos sin ningún tipo de inversión.'),
    (25.0, 31.0, '(susurrando) Ah... y no te olvides que hay premios para los mejores vendedores...'),
    (31.8, 33.2, '(susurrando) ¡Pero shhh!'),
]

SFX = [
    (0.55, 'popbig'), (0.5, 'whoosh'), (1.2, 'sparkle'),
    (3.0, 'whoosh'), (3.15, 'pop'), (3.35, 'pop'), (3.6, 'popup'), (3.75, 'popup'), (5.3, 'popbig'), (5.35, 'sparkle'),
    (6.8, 'whoosh'), (9.75, 'click'), (9.8, 'chime'),
    (10.4, 'whoosh'), (11.0, 'ding'), (11.7, 'ding'), (12.4, 'ding'), (13.3, 'popup'),
    (15.0, 'whoosh'), (15.5, 'chime'), (16.0, 'confetti'), (17.4, 'popbig'),
    (19.0, 'whoosh'), (21.9, 'slam'),
    (24.3, 'sweep'), (24.9, 'popup'), (27.3, 'sparkle'), (27.35, 'chime'),
    (31.75, 'shhh'), (31.7, 'popbig'),
    (33.7, 'whoosh'), (35.2, 'popbig'), (35.6, 'click'),
]
for i in range(8):
    SFX.append((0.8 + i * 0.06, 'pop'))          # letras de DISTINTO
    SFX.append((34.0 + i * 0.06, 'pop'))
for t0, n in ((7.5, 11), (8.2, 18), (8.9, 7)):   # tipeo del formulario
    for i in range(n):
        SFX.append((t0 + i * 0.6 / n, 'click'))
for i in range(12):
    SFX.append((19.7 + i * 0.36, 'coin'))


# ---------------------------------------------------------------- utilidades
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, a, b):
    return clamp((t - a) / (b - a))


def ease_out(x):
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_back(x, s=1.9):
    x -= 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def ease_elastic(x):
    if x <= 0 or x >= 1:
        return clamp(x)
    return 2 ** (-10 * x) * math.sin((x * 10 - 0.75) * 2 * math.pi / 3) + 1


def lerp(a, b, x):
    return a + (b - a) * x


def lerpc(c1, c2, x):
    return tuple(int(lerp(a, b, x)) for a, b in zip(c1, c2))


def window(t, a, b, fin=0.25, fout=0.25):
    """1 dentro de [a,b] con rampas de entrada/salida."""
    return clamp(min((t - a) / fin if fin else 1, (b - t) / fout if fout else 1))


@functools.lru_cache(None)
def font(path, size):
    return ImageFont.truetype(path, size)


def is_emoji(ch):
    return ord(ch) >= 0x2600 and ch not in '…'


@functools.lru_cache(None)
def emoji(ch):
    f = font(F_EMOJI, 109)
    im = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((80, 80), ch, font=f, embedded_color=True, anchor='mm')
    return im.crop(im.getbbox())


def shadowed(im, off=(0, 8), blur=6, color=(20, 8, 50), opacity=0.45):
    pad = blur * 2 + max(abs(off[0]), abs(off[1]))
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    a = im.getchannel('A').point(lambda v: int(v * opacity))
    sh = Image.new('RGBA', im.size, color + (0,))
    sh.putalpha(a)
    out.alpha_composite(sh, (pad + off[0], pad + off[1]))
    out = out.filter(ImageFilter.GaussianBlur(blur))
    out.alpha_composite(im, (pad, pad))
    return out


@functools.lru_cache(None)
def text(s, size, fill=WHITE, path=F_BLACK, shadow=True, stroke=0, stroke_fill=DARK):
    """Texto con emojis embebidos y sombra suave. Devuelve RGBA recortado."""
    f = font(path, size)
    runs, cur = [], ''
    for ch in s:
        if ch == '️':
            continue
        if is_emoji(ch):
            if cur:
                runs.append(('t', cur))
                cur = ''
            runs.append(('e', ch))
        else:
            cur += ch
    if cur:
        runs.append(('t', cur))
    esz = int(size * 1.05)
    width = sum(f.getlength(r) + 2 * stroke if k == 't' else esz + size * 0.12 for k, r in runs)
    hgt = int(size * 1.45) + 2 * stroke
    im = Image.new('RGBA', (int(width) + 20, hgt + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x, base = 10 + stroke, 10 + stroke + int(size * 1.08)
    for k, r in runs:
        if k == 't':
            d.text((x, base), r, font=f, fill=fill, anchor='ls', stroke_width=stroke, stroke_fill=stroke_fill)
            x += f.getlength(r)
        else:
            e = emoji(r).resize((esz, esz), Image.LANCZOS)
            im.alpha_composite(e, (int(x + size * 0.06), int(base - size * 0.92)))
            x += esz + size * 0.12
    im = im.crop(im.getbbox())
    return shadowed(im) if shadow else im


def comp(cv, im, x, y):
    x, y = int(round(x)), int(round(y))
    if x >= cv.width or y >= cv.height or x + im.width <= 0 or y + im.height <= 0:
        return
    sx, sy = max(0, -x), max(0, -y)
    ex, ey = min(im.width, cv.width - x), min(im.height, cv.height - y)
    cv.alpha_composite(im, (x + sx, y + sy), (sx, sy, ex, ey))


def place(cv, sp, cx, cy, s=1.0, rot=0.0, alpha=1.0, sx=1.0, sy=1.0):
    if s * sx <= 0.01 or s * sy <= 0.01 or alpha <= 0.01:
        return
    nw, nh = max(1, int(sp.width * s * sx)), max(1, int(sp.height * s * sy))
    im = sp if (nw, nh) == sp.size else sp.resize((nw, nh), Image.BILINEAR)
    if abs(rot) > 0.05:
        im = im.rotate(rot, Image.BICUBIC, expand=True)
    if alpha < 0.999:
        im = im.copy()
        im.putalpha(im.getchannel('A').point(lambda v: int(v * alpha)))
    comp(cv, im, cx - im.width / 2, cy - im.height / 2)


def pill(w, h, fill, outline=None, width=0, radius=None):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), radius or h // 2, fill=fill,
                                         outline=outline, width=width)
    return im


def label_on(bg, txt):
    out = bg.copy()
    out.alpha_composite(txt, ((bg.width - txt.width) // 2, (bg.height - txt.height) // 2))
    return out


# ---------------------------------------------------------------- recursos
FRONT = np.asarray(Image.open(os.path.join(HERE, 'assets/front.png')).convert('RGBA')).astype(np.float32)
FRONT_IMG = Image.fromarray(FRONT.astype(np.uint8), 'RGBA')
SIDE_IMG = Image.open(os.path.join(HERE, 'assets/side.png')).convert('RGBA')
BACK_IMG = Image.open(os.path.join(HERE, 'assets/back.png')).convert('RGBA')
MX, MY = 268, 346          # centro de la línea de la boca en front.png

AVATAR = FRONT_IMG.crop((78, 60, 458, 440)).resize((96, 96), Image.LANCZOS)
_m = Image.new('L', (96, 96), 0)
ImageDraw.Draw(_m).ellipse((0, 0, 95, 95), fill=255)
AVATAR.putalpha(Image.fromarray(np.minimum(np.asarray(AVATAR.getchannel('A')), np.asarray(_m))))
_bgav = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
ImageDraw.Draw(_bgav).ellipse((0, 0, 95, 95), fill=(255, 230, 200))
_bgav.alpha_composite(AVATAR)
AVATAR = _bgav

YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def soft_circle(r, color, a):
    s = r * 2
    yy, xx = np.mgrid[0:s, 0:s]
    d = np.sqrt((xx - r) ** 2 + (yy - r) ** 2) / r
    alpha = np.clip(1 - d, 0, 1) ** 1.6 * 255 * a
    im = np.zeros((s, s, 4), np.uint8)
    im[..., :3] = color
    im[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(im, 'RGBA')


BOKEH = soft_circle(90, (255, 255, 255), 0.35)
GLOW_GOLD = soft_circle(260, (255, 200, 60), 0.75)
GLOW_WHITE = soft_circle(300, (255, 255, 255), 0.35)

_vd = np.sqrt(((XX - W / 2) / (W * 0.62)) ** 2 + ((YY - H * 0.55) / (H * 0.55)) ** 2)
VIGNETTE = np.clip((_vd - 0.45) * 1.6, 0, 1)[..., None]

# -------- paletas de fondo (arriba, abajo) por tramo
PALETTES = [
    (0.0, ((118, 64, 255), (255, 84, 160))),
    (6.6, ((118, 64, 255), (255, 84, 160))),
    (7.0, ((22, 120, 255), (118, 64, 255))),
    (18.8, ((22, 120, 255), (118, 64, 255))),
    (19.2, ((0, 176, 120), (0, 96, 170))),
    (24.2, ((0, 176, 120), (0, 96, 170))),
    (24.8, ((14, 8, 36), (52, 20, 88))),
    (33.5, ((14, 8, 36), (52, 20, 88))),
    (33.9, ((118, 64, 255), (255, 84, 160))),
]


def palette(t):
    for (t0, p0), (t1, p1) in zip(PALETTES, PALETTES[1:]):
        if t0 <= t <= t1:
            x = ease_in_out(prog(t, t0, t1))
            return lerpc(p0[0], p1[0], x), lerpc(p0[1], p1[1], x)
    return PALETTES[-1][1]


def background(t):
    top, bot = palette(t)
    g = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    col = np.array(top, np.float32) * (1 - g) + np.array(bot, np.float32) * g      # H x 3
    img = np.broadcast_to(col[:, None, :], (H, W, 3)).copy()
    # rayos giratorios
    ray_a = 0.0
    if t < 24.6:
        ray_a = 0.09 * (1 - prog(t, 24.0, 24.6))
    elif t > 33.7:
        ray_a = 0.09 * prog(t, 33.7, 34.2)
    if ray_a > 0:
        cx, cy = (540, 900) if t < 6.8 or t > 33.7 else ((650, 860) if t < 19 else (540, 1000))
        ang = np.arctan2(YY - cy, XX - cx)
        rays = (np.sin(ang * 14 + t * 0.5) > 0.25).astype(np.float32)
        img += rays[..., None] * 255 * ray_a
    if 24.4 < t < 33.9:   # viñeta oscura del susurro
        v = window(t, 24.4, 33.9, 0.5, 0.3)
        img *= 1 - VIGNETTE * 0.75 * v
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')


def bokeh(cv, t, dark=False):
    r = np.random.default_rng(11)
    for i in range(16):
        x0, sp, sc, ph = r.uniform(0, W), r.uniform(40, 110), r.uniform(0.3, 1.1), r.uniform(0, 6.28)
        y = (r.uniform(0, H + 300) - t * sp) % (H + 300) - 150
        x = x0 + 40 * math.sin(t * 0.6 + ph)
        place(cv, BOKEH, x, y, sc, alpha=0.5 if dark else 0.8)


# ---------------------------------------------------------------- boca / perro
def speaking(t):
    for a, b, _ in LINES:
        if a <= t <= b:
            return a, b
    return None


VOICE_ENV = None


def mouth_open(t):
    if VOICE_ENV is not None:
        i = int(t * FPS)
        return float(VOICE_ENV[i]) if i < len(VOICE_ENV) else 0.0
    seg = speaking(t)
    if not seg:
        return 0.0
    a, b = seg
    env = window(t, a, b, 0.08, 0.12)
    v = 0.55 + 0.45 * math.sin(2 * math.pi * 4.6 * t) + 0.25 * math.sin(2 * math.pi * 7.3 * t + 1.3)
    v *= 0.75 + 0.25 * math.sin(2 * math.pi * 1.1 * t)
    return clamp(v) * env


def front_dog(open_):
    if open_ < 0.04:
        return FRONT_IMG
    arr = FRONT.copy()
    x0, x1, y0, y1 = MX - 60, MX + 61, MY - 6, MY + 110
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    dx = np.abs(xs - MX) / 40.0
    wx = np.sqrt(np.clip(1 - dx ** 2, 0, 1))
    dline = open_ * 22 * wx                                       # alto de la apertura
    prof = np.where(ys < MY, 0.0, np.where(ys < MY + 60, 1.0, np.clip((MY + 108 - ys) / 48, 0, 1)))
    d = dline * prof
    sy = np.clip(ys - d, 0, FRONT.shape[0] - 2)
    lo = np.floor(sy).astype(int)
    fr = (sy - lo)[..., None]
    xi = xs.astype(int)
    samp = FRONT[lo, xi] * (1 - fr) + FRONT[lo + 1, xi] * fr
    # interior de la boca: oscuro arriba, lengua rosada abajo, bordes suaves
    inside = np.clip(np.minimum(ys - MY + 0.5, MY + dline - ys) / 2.0, 0, 1) * (dline > 1.5)
    depth = np.clip((ys - MY) / np.maximum(dline, 1), 0, 1)
    tongue = np.clip((depth - 0.55) / 0.45, 0, 1) * np.clip(1 - dx * 1.2, 0, 1)
    dark = np.array([30, 9, 12], np.float32)
    mid = np.array([74, 22, 30], np.float32)
    tong = np.array([168, 72, 84], np.float32)
    col = dark * (1 - depth[..., None]) + mid * depth[..., None]
    col = col * (1 - tongue[..., None]) + tong * tongue[..., None]
    mouth_col = np.concatenate([col, np.full(col.shape[:2] + (1,), 255, np.float32)], -1)
    m = inside[..., None]
    arr[y0:y1, x0:x1] = samp * (1 - m) + mouth_col * m
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


DOG_KF = [  # t, cx, bottom, scale
    (0.0, 540, 2900, 1.30), (0.75, 540, 1880, 1.30), (6.6, 540, 1880, 1.30),
    (7.2, 250, 1960, 0.80), (18.8, 250, 1960, 0.80), (19.4, 540, 1900, 1.10),
    (24.2, 540, 1900, 1.10), (24.7, 540, 3100, 1.10), (33.8, 540, 3100, 0.95),
    (34.35, 540, 1900, 0.95), (DUR, 540, 1900, 0.95),
]


def dog_state(t):
    for (t0, *a), (t1, *b) in zip(DOG_KF, DOG_KF[1:]):
        if t0 <= t <= t1:
            x = prog(t, t0, t1)
            x = ease_back(x, 1.2) if b[1] < a[1] else ease_in_out(x)
            return [lerp(p, q, x) for p, q in zip(a, b)]
    return DOG_KF[-1][1:]


def shadow_ellipse(cv, cx, y, w, a=0.28):
    im = Image.new('RGBA', (int(w) + 40, int(w * 0.22) + 40), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((20, 20, 20 + w, 20 + w * 0.22), fill=(10, 0, 30, int(255 * a)))
    im = im.filter(ImageFilter.GaussianBlur(12))
    comp(cv, im, cx - im.width / 2, y - im.height / 2)


def draw_front_dog(cv, t, bump=0.0):
    cx, bottom, s = dog_state(t)
    if bottom > H + 1100 * s:
        return
    o = mouth_open(t)
    breath = 1 + 0.012 * math.sin(2 * math.pi * 0.9 * t)
    talk_bob = 6 * o * s
    tilt = 2.2 * math.sin(2 * math.pi * 0.45 * t) + (3 * math.sin(2 * math.pi * 2.2 * t) * o)
    im = front_dog(o)
    sy = breath * (1 + 0.06 * bump)
    sx = (1 / breath) * (1 - 0.04 * bump)
    hh = im.height * s * sy
    shadow_ellipse(cv, cx, min(bottom - 12, H - 20), im.width * s * 0.75)
    place(cv, im, cx, bottom - hh / 2 - talk_bob, s, tilt, 1.0, sx, sy)


# ---------------------------------------------------------------- elementos
def letters_pop(cv, t, word, t0, cy, size, color=YELLOW, stagger=0.06, cx=540):
    sps = [text(ch, size, color, F_BLACK) for ch in word]
    gap = -size * 0.17
    total = sum(s.width for s in sps) + gap * (len(sps) - 1)
    x = cx - total / 2
    for i, sp in enumerate(sps):
        p = prog(t, t0 + i * stagger, t0 + i * stagger + 0.45)
        if p > 0:
            k = ease_back(p, 2.4)
            wob = 8 * math.sin(2 * math.pi * 1.2 * t + i * 0.7) * prog(t, t0 + 0.8, t0 + 1.3)
            place(cv, sp, x + sp.width / 2, cy - (1 - k) * 260 + wob, max(0.01, k), 0, clamp(p * 3))
        x += sp.width + gap


def slide_text(cv, sp, t, t0, cx, cy, frm='up', t_out=None, dist=420):
    p = ease_back(prog(t, t0, t0 + 0.45), 1.6)
    a = clamp(prog(t, t0, t0 + 0.2))
    if t_out is not None:
        q = ease_in_out(prog(t, t_out, t_out + 0.3))
        a *= 1 - q
        cy -= q * 160
    dx = {'left': -dist, 'right': dist}.get(frm, 0) * (1 - p)
    dy = {'up': -dist, 'down': dist}.get(frm, 0) * (1 - p)
    place(cv, sp, cx + dx, cy + dy, 1, 0, a)


def float_emoji(cv, t, ch, x, y, size, t0, t_out, seed=0):
    p = prog(t, t0, t0 + 0.4)
    if p <= 0 or t > t_out + 0.3:
        return
    k = ease_back(p, 2.5) * (1 - ease_in_out(prog(t, t_out, t_out + 0.3)))
    bob = 14 * math.sin(2 * math.pi * 0.8 * t + seed)
    rot = 10 * math.sin(2 * math.pi * 0.5 * t + seed)
    place(cv, emoji(ch), x, y + bob, size / 136 * k, rot)


def wipe(cv, t, t0, color=YELLOW):
    p = prog(t, t0 - 0.2, t0 + 0.25)
    if p <= 0 or p >= 1:
        return
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    x = lerp(-1400, W + 400, ease_in_out(p))
    for off, c in ((0, color), (230, WHITE)):
        d.polygon([(x - off, -50), (x + 520 - off, -50), (x + 520 - 700 - off, H + 50), (x - 700 - off, H + 50)],
                  fill=c + (235,))
    cv.alpha_composite(ov)


CONF_COLORS = [YELLOW, (255, 84, 160), WA_GREEN, (22, 160, 255), WHITE, (255, 120, 40)]


def confetti(cv, t, t0, seed, origin=None, n=110, dur=3.2):
    lt = t - t0
    if lt < 0 or lt > dur:
        return
    r = np.random.default_rng(seed)
    d = ImageDraw.Draw(cv)
    fade = 1 - prog(lt, dur - 0.6, dur)
    for i in range(n):
        if origin:
            ang = r.uniform(-math.pi, 0)
            spd = r.uniform(500, 1500)
            vx, vy = math.cos(ang) * spd, math.sin(ang) * spd - 200
            x0, y0 = origin
        else:
            vx, vy = r.uniform(-80, 80), r.uniform(200, 520)
            x0, y0 = r.uniform(0, W), r.uniform(-500, -20)
        drag = math.exp(-lt * 1.3)
        x = x0 + vx * (1 - drag) / 1.3 + 30 * math.sin(lt * 4 + i)
        y = y0 + vy * (1 - drag) / 1.3 + 0.5 * 900 * lt ** 2 * (0.5 if origin else 0.08)
        rot = r.uniform(0, 6.28) + lt * r.uniform(-9, 9)
        w, h = r.uniform(12, 22), r.uniform(6, 12) * abs(math.cos(lt * 6 + i))
        c = CONF_COLORS[i % len(CONF_COLORS)]
        pts = [(x + math.cos(rot) * px - math.sin(rot) * py, y + math.sin(rot) * px + math.cos(rot) * py)
               for px, py in ((-w, -h), (w, -h), (w, h), (-w, h))]
        d.polygon(pts, fill=c + (int(255 * fade),))


# ---------------------------------------------------------------- teléfono
PW, PH = 640, 1110
SCR = (22, 22, PW - 22, PH - 22)


def screen_form(t):
    sw, sh = SCR[2] - SCR[0], SCR[3] - SCR[1]
    im = Image.new('RGBA', (sw, sh), (247, 246, 252, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, sw, 230), fill=VIOLET)
    im.alpha_composite(text('DISTINTO', 56, WHITE, F_BLACK, False), (40, 90))
    im.alpha_composite(text('Registro de vendedores', 30, (225, 215, 255), F_SEMI, False), (42, 165))
    fields = [('Nombre y apellido', 'Sofía López', 7.5, 0.6), ('WhatsApp', '+54 9 11 5555-1234', 8.2, 0.6),
              ('Ciudad', 'Córdoba', 8.9, 0.5)]
    y = 290
    for lab, val, t0, du in fields:
        im.alpha_composite(text(lab, 28, (110, 100, 140), F_SEMI, False), (40, y))
        active = t0 - 0.1 <= t <= t0 + du + 0.25
        d.rounded_rectangle((36, y + 46, sw - 36, y + 132), 22, fill=WHITE,
                            outline=VIOLET if active else (215, 210, 232), width=4)
        n = int(len(val) * prog(t, t0, t0 + du))
        if n:
            im.alpha_composite(text(val[:n], 36, (30, 26, 50), F_BOLD, False), (62, y + 66))
        if active and int(t * 4) % 2 == 0:
            cxp = 62 + (text(val[:n], 36, (30, 26, 50), F_BOLD, False).width if n else 0) + 4
            d.rectangle((cxp, y + 66, cxp + 4, y + 112), fill=VIOLET)
        y += 170
    # checkbox
    d.rounded_rectangle((40, y + 10, 84, y + 54), 10, fill=VIOLET if t > 9.4 else WHITE, outline=VIOLET, width=4)
    if t > 9.4:
        d.line([(50, y + 32), (60, y + 44), (76, y + 20)], fill=WHITE, width=6)
    im.alpha_composite(text('Acepto términos y condiciones', 26, (90, 84, 120), F_SEMI, False), (100, y + 18))
    # botón
    by = y + 100
    press = window(t, 9.7, 9.9, 0.05, 0.1)
    done = t > 9.85
    bw = int((sw - 72) * (1 - 0.05 * press))
    btn = pill(bw, 110, WA_GREEN if done else VIOLET)
    btn = label_on(btn, text('¡ENVIADO!' if done else 'QUIERO VENDER', 38, WHITE, F_BLACK, False))
    im.alpha_composite(btn, ((sw - bw) // 2, by))
    if 9.75 < t < 10.4:  # ripple
        p = prog(t, 9.75, 10.3)
        rr = 40 + 300 * p
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(ov).ellipse((sw / 2 - rr, by + 55 - rr, sw / 2 + rr, by + 55 + rr),
                                   outline=WHITE + (int(200 * (1 - p)),), width=10)
        im.alpha_composite(ov)
    # dedo
    if 9.2 < t < 10.4:
        p = ease_out(prog(t, 9.2, 9.65))
        fx, fy = lerp(sw + 60, sw * 0.62, p), lerp(by + 260, by + 80, p) + 12 * press
        place(im, emoji('👆'), fx, fy, 0.9)
    return im


def bubble(txt, incoming, maxw=430):
    sp = text(txt, 33, (17, 27, 33), F_SEMI, False)
    w, h = min(maxw, sp.width + 44), sp.height + 62
    im = Image.new('RGBA', (w + 8, h + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((4, 6, w + 4, h + 6), 26, fill=(0, 0, 0, 30))
    d.rounded_rectangle((0, 0, w, h), 26, fill=WHITE if incoming else (217, 253, 211))
    im.alpha_composite(sp, (22, 20))
    stamp = text('10:24' + ('' if incoming else '  ✔'), 20, (130, 140, 140), F_SEMI, False)
    im.alpha_composite(stamp, (w - stamp.width - 16, h - stamp.height - 10))
    return im


CHAT = [(11.0, True, '¡Hola Sofía! 👋'), (11.7, True, 'Soy Max, de Distinto'),
        (12.4, True, 'Vimos tu registro 🙌'), (13.3, False, '¡Sí, dale! 😄')]


def screen_chat(t):
    sw, sh = SCR[2] - SCR[0], SCR[3] - SCR[1]
    im = Image.new('RGBA', (sw, sh), (236, 229, 221, 255))
    d = ImageDraw.Draw(im)
    for yy in range(240, sh, 90):
        for xx in range(30 + (yy // 90 % 2) * 45, sw, 90):
            d.ellipse((xx, yy, xx + 8, yy + 8), fill=(225, 216, 205))
    d.rectangle((0, 0, sw, 200), fill=(7, 94, 84))
    im.alpha_composite(AVATAR, (30, 82))
    im.alpha_composite(text('Admin Distinto', 36, WHITE, F_BOLD, False), (145, 92))
    im.alpha_composite(text('en línea', 26, (190, 230, 220), F_SEMI, False), (146, 140))
    y = 240
    for i, (t0, inc, msg) in enumerate(CHAT):
        if inc and t0 - 0.45 < t < t0:     # "escribiendo..."
            ty = pill(130, 70, WHITE)
            dd = ImageDraw.Draw(ty)
            for k in range(3):
                jy = 8 * math.sin(2 * math.pi * 3 * t - k * 0.8)
                dd.ellipse((28 + k * 28, 30 + jy, 44 + k * 28, 46 + jy), fill=(140, 150, 150))
            im.alpha_composite(ty, (24, y))
        if t < t0:
            break
        b = bubble(msg, inc)
        k = ease_back(prog(t, t0, t0 + 0.3), 2.2)
        bx = 24 if inc else sw - 24 - b.width
        ox = bx if inc else bx + b.width
        bb = b.resize((max(1, int(b.width * k)), max(1, int(b.height * k))), Image.BILINEAR)
        comp(im, bb, ox if inc else ox - bb.width, y + (b.height - bb.height) / 2)
        y += b.height + 18
    # barra de escritura
    d.rounded_rectangle((20, sh - 110, sw - 120, sh - 30), 40, fill=WHITE)
    im.alpha_composite(text('Mensaje', 30, (150, 150, 150), F_SEMI, False), (60, sh - 88))
    d.ellipse((sw - 100, sh - 110, sw - 20, sh - 30), fill=(0, 168, 132))
    return im


def screen_ok(t):
    sw, sh = SCR[2] - SCR[0], SCR[3] - SCR[1]
    im = Image.new('RGBA', (sw, sh), (250, 250, 255, 255))
    d = ImageDraw.Draw(im)
    cx, cy = sw / 2, 400
    p = ease_elastic(prog(t, 15.3, 16.1))
    r = 150 * p
    if r > 1:
        d.ellipse((cx - r * 1.35, cy - r * 1.35, cx + r * 1.35, cy + r * 1.35), fill=(220, 250, 230))
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WA_GREEN)
    q = prog(t, 15.6, 16.0)
    pts = [(cx - 70, cy + 5), (cx - 20, cy + 55), (cx + 75, cy - 50)]
    if q > 0:
        seg1 = min(1, q * 2)
        path = [pts[0], (lerp(pts[0][0], pts[1][0], seg1), lerp(pts[0][1], pts[1][1], seg1))]
        if q > 0.5:
            s2 = (q - 0.5) * 2
            path.append((lerp(pts[1][0], pts[2][0], s2), lerp(pts[1][1], pts[2][1], s2)))
        d.line(path, fill=WHITE, width=30, joint='curve')
        for pt in (path[0], path[-1]):
            d.ellipse((pt[0] - 15, pt[1] - 15, pt[0] + 15, pt[1] + 15), fill=WHITE)
    a = prog(t, 16.0, 16.4)
    if a > 0:
        place(im, text('¡Aprobado!', 70, (24, 20, 40), F_BLACK, False), cx, 660 + 40 * (1 - ease_out(a)), 1, 0, a)
        place(im, text('Ya sos parte del equipo', 34, (100, 95, 125), F_SEMI, False), cx, 750, 1, 0, prog(t, 16.2, 16.6))
        place(im, text('de vendedores Distinto 🎉', 34, (100, 95, 125), F_SEMI, False), cx, 800, 1, 0, prog(t, 16.3, 16.7))
    b = prog(t, 16.6, 17.0)
    if b > 0:
        bd = label_on(pill(440, 90, (240, 234, 255)), text('⭐ Vendedor verificado', 32, VIOLET, F_BOLD, False))
        place(im, bd, cx, 920, ease_back(b), 0, b)
    return im


def phone(t):
    if t < 10.5:
        scr = screen_form(t)
    elif t < 15.1:
        scr = screen_chat(t)
    else:
        scr = screen_ok(t)
    im = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, PW - 1, PH - 1), 86, fill=(22, 20, 32))
    d.rounded_rectangle((6, 6, PW - 7, PH - 7), 80, outline=(70, 66, 90), width=3)
    mask = Image.new('L', scr.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, scr.width - 1, scr.height - 1), 64, fill=255)
    scr.putalpha(mask)
    im.alpha_composite(scr, (SCR[0], SCR[1]))
    d.rounded_rectangle((PW / 2 - 80, 40, PW / 2 + 80, 82), 21, fill=(22, 20, 32))
    return shadowed(im, (0, 30), 26, (10, 0, 40), 0.5)


def draw_phone(cv, t):
    if not (6.85 < t < 19.6):
        return
    cx, cy, s, rot = 650, 880, 0.92, 0
    p = prog(t, 6.9, 7.5)
    cy += (1 - ease_back(p, 1.3)) * 1600
    rot += (1 - ease_out(p)) * 12
    q = ease_in_out(prog(t, 19.0, 19.5))
    cx += q * 1000
    rot -= q * 25
    flip = 1.0
    for tf in (10.5, 15.1):
        if tf - 0.18 < t < tf + 0.18:
            flip = abs(t - tf) / 0.18
    rot += 3 * math.sin(2 * math.pi * 0.35 * t) * (1 - q)
    place(cv, phone(t), cx, cy, s, rot, 1, max(0.02, ease_out(flip)), 1)


def step_header(cv, t, n, line1, line2, t0, t1):
    a = window(t, t0, t1, 0.3, 0.25)
    if a <= 0:
        return
    k = ease_back(prog(t, t0, t0 + 0.45), 2)
    pl = label_on(pill(230, 74, WHITE), text(f'PASO {n}', 38, VIOLET, F_BLACK, False))
    place(cv, shadowed(pl), 540, 120, max(0.01, k), -3, a)
    place(cv, text(line1, 66, WHITE), 540 - (1 - ease_out(prog(t, t0 + 0.1, t0 + 0.5))) * 700, 215, 1, 0, a)
    if line2:
        place(cv, line2 if isinstance(line2, Image.Image) else text(line2, 66, YELLOW),
              540 + (1 - ease_out(prog(t, t0 + 0.2, t0 + 0.6))) * 700, 292, 1, 0, a)


def money_rain(cv, t):
    if not (19.4 < t < 24.6):
        return
    r = np.random.default_rng(5)
    a = 1 - prog(t, 24.1, 24.5)
    for i in range(22):
        ch = ['💵', '💰', '🪙', '💸'][i % 4]
        st = 19.5 + r.uniform(0, 3.8)
        sp = r.uniform(520, 860)
        x = r.uniform(40, W - 40)
        y = -120 + (t - st) * sp
        if t < st or y > H + 120:
            continue
        place(cv, emoji(ch), x + 40 * math.sin(t * 2 + i), y, r.uniform(0.55, 1.0),
              30 * math.sin(t * 3 + i), a * 0.95)


def earnings_card(cv, t):
    a = window(t, 19.6, 24.3, 0.3, 0.25)
    if a <= 0:
        return
    k = ease_back(prog(t, 19.6, 20.05), 1.8)
    card = pill(660, 170, (255, 255, 255, 240), radius=40)
    card.alpha_composite(emoji('📈').resize((96, 96), Image.LANCZOS), (34, 37))
    card.alpha_composite(text('Tus ganancias', 30, (110, 100, 140), F_SEMI, False), (150, 30))
    v = int(158900 * ease_out(prog(t, 20.0, 22.2)))
    val = f'$ {v:,}'.replace(',', '.')
    card.alpha_composite(text(val, 64, (0, 150, 95), F_BLACK, False), (148, 70))
    place(cv, shadowed(card), 540, 560, max(0.01, k), 0, a)


def stamp(cv, t):
    a = window(t, 21.9, 24.3, 0.05, 0.25)
    if a <= 0:
        return
    p = prog(t, 21.9, 22.08)
    s = lerp(2.4, 1.0, p ** 2)
    st = pill(700, 150, (255, 50, 90), WHITE, 8, 30)
    st = label_on(st, text('INVERSIÓN: $0', 78, WHITE, F_BLACK, False))
    place(cv, shadowed(st, (0, 14), 10), 540, 790, s, -7, a)


def end_card(cv, t):
    if t < 33.85:
        return
    letters_pop(cv, t, 'DISTINTO', 34.0, 420, 170)
    for txt, ty, t0 in (('Registrate como vendedor', 590, 34.5), ('¡y empezá a ganar hoy! 🚀', 670, 34.7)):
        p = ease_back(prog(t, t0, t0 + 0.4))
        place(cv, text(txt, 56, WHITE), 540, ty + 60 * (1 - p), 1, 0, clamp(p))
    p = prog(t, 35.1, 35.5)
    if p > 0:
        pulse = 1 + 0.05 * math.sin(2 * math.pi * 1.6 * (t - 35.1)) * prog(t, 35.6, 35.8)
        press = window(t, 35.55, 35.75, 0.05, 0.1)
        btn = label_on(pill(640, 140, WHITE), text('REGISTRARME', 60, VIOLET, F_BLACK, False))
        place(cv, shadowed(btn, (0, 12), 12), 540, 850, ease_back(p, 2.2) * pulse * (1 - 0.06 * press))
        if t > 35.2:
            fp = ease_out(prog(t, 35.2, 35.55))
            place(cv, emoji('👆'), lerp(980, 800, fp), lerp(1150, 950, fp) + 15 * press, 1.0)
    confetti(cv, t, 34.0, 21, None, 90, 3.2)


def whisper_scene(cv, t):
    if not (24.4 < t < 33.9):
        return
    # perro de perfil, se acerca a contar el secreto
    p = ease_out(prog(t, 24.55, 25.2))
    out = ease_in_out(prog(t, 31.3, 31.8))
    cx = lerp(-420, 300, p) - out * 800
    s = 1.3
    bob = 10 * math.sin(2 * math.pi * 1.8 * t) * (1 if speaking(t) else 0.3)
    lean = -4 + 2 * math.sin(2 * math.pi * 0.4 * t)
    hh = SIDE_IMG.height * s
    shadow_ellipse(cv, cx, H - 25, SIDE_IMG.width * s * 0.8, 0.4)
    place(cv, SIDE_IMG, cx, 1950 - hh / 2 + bob, s, lean)
    # "psst..."
    a = window(t, 24.9, 26.1, 0.15, 0.25)
    if a > 0:
        b = label_on(pill(260, 100, WHITE), text('psst...', 46, VIOLET, F_IT, False))
        place(cv, shadowed(b), 760, 1060, ease_back(prog(t, 24.9, 25.25), 2.5), 6, a)
    # texto susurrado (máquina de escribir)
    soft = (232, 222, 255)
    rows = [('ah... y no te olvides', 25.0, 26.4, 270, 64, soft, F_IT),
            ('que hay', 26.5, 26.9, 370, 64, soft, F_IT)]
    fade = 1 - prog(t, 31.3, 31.7)
    for s_, t0, t1, y, sz, col, fnt in rows:
        n = int(len(s_) * prog(t, t0, t1))
        if n:
            place(cv, text(s_[:n], sz, col, fnt), 540, y, 1, 0, fade)
    if t > 27.2:
        p = prog(t, 27.2, 27.65)
        shimmer = 0.75 + 0.25 * math.sin(2 * math.pi * 1.4 * t)
        place(cv, GLOW_GOLD, 540, 510, 1.0 * ease_out(p), 0, 0.55 * shimmer * fade)
        place(cv, text('PREMIOS', 150, (255, 205, 60), F_BLACK, True, 0), 540, 510, ease_elastic(p), 0, fade)
    rows2 = [('para los mejores', 28.2, 29.2, 650), ('vendedores...', 29.3, 30.3, 740)]
    for s_, t0, t1, y in rows2:
        n = int(len(s_) * prog(t, t0, t1))
        if n:
            place(cv, text(s_[:n], 64, soft, F_IT), 540, y, 1, 0, fade)
    # trofeo con brillo
    if t > 27.3:
        p = prog(t, 27.3, 27.9)
        place(cv, GLOW_GOLD, 830, 1260, 0.8 * ease_out(p), 0, 0.7 * fade)
        place(cv, emoji('🏆'), 830, 1260 + 12 * math.sin(2 * math.pi * 0.7 * t), 2.1 * ease_elastic(p),
              6 * math.sin(2 * math.pi * 0.5 * t), fade)
        r = np.random.default_rng(9)
        for i in range(7):
            ang = t * 0.9 + i * 6.28 / 7
            rad = 210 + 20 * math.sin(t * 3 + i)
            tw = 0.5 + 0.5 * math.sin(t * 6 + r.uniform(0, 6))
            place(cv, emoji('✨'), 830 + rad * math.cos(ang), 1260 + rad * 0.8 * math.sin(ang),
                  0.35 + 0.2 * tw, 0, fade * ease_out(p) * (0.4 + 0.6 * tw))
        for i, (ch, x, y) in enumerate((('🥇', 980, 990), ('🎁', 660, 1500))):
            float_emoji(cv, t, ch, x, y, 110, 27.6 + i * 0.2, 31.3, i)
    # SHHH
    if 31.6 < t < 33.9:
        a = window(t, 31.6, 33.75, 0.1, 0.2)
        p = ease_elastic(prog(t, 31.6, 32.3))
        place(cv, GLOW_WHITE, 540, 760, 1.2, 0, 0.6 * a)
        place(cv, emoji('🤫'), 540, 740, 3.2 * p, 5 * math.sin(2 * math.pi * 1.5 * t), a)
        jit = 6 * math.sin(t * 70) * window(t, 31.8, 33.0, 0.1, 0.3)
        place(cv, text('SHHH...', 190, WHITE, F_BLACK), 540 + jit, 1110, ease_back(prog(t, 31.75, 32.15), 2.2), jit * 0.4, a)
        # perrito que se va de espaldas, disimulando
        q = prog(t, 31.9, 33.7)
        if q > 0:
            sc = lerp(0.62, 0.42, q)
            wad = 5 * math.sin(2 * math.pi * 3 * t)
            hh = BACK_IMG.height * sc
            yb = lerp(2150, 1830, ease_out(prog(t, 31.9, 32.4)))
            place(cv, BACK_IMG, 540 + 30 * math.sin(2 * math.pi * 1.5 * t), yb - hh / 2 - abs(wad) * 2, sc, wad, a)


# ---------------------------------------------------------------- frame
def render(i):
    t = i / FPS
    cv = background(t)
    dark = 24.6 < t < 33.8
    bokeh(cv, t, dark)
    # escena A: bienvenida
    if t < 3.3:
        a = 1 - prog(t, 2.95, 3.2)
        slide_text(cv, text('¡BIENVENIDOS A', 76), t, 0.35, 540, 300, 'up', 2.95)
        if a > 0:
            lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            letters_pop(lay, t, 'DISTINTO', 0.8, 470, 168)
            for k, (ch, x, y) in enumerate((('✨', 120, 610), ('✨', 960, 330), ('🎉', 940, 640))):
                float_emoji(lay, t, ch, x, y, 100, 1.2 + k * 0.12, 2.9, k)
            if a < 1:
                lay.putalpha(lay.getchannel('A').point(lambda v: int(v * a)))
            cv.alpha_composite(lay)
    # escena B: es súper fácil
    if 3.0 < t < 7.0:
        slide_text(cv, text('REGISTRARTE Y', 88), t, 3.1, 540, 250, 'left', 6.6)
        slide_text(cv, text('GANAR DINERO', 112, YELLOW), t, 3.3, 540, 370, 'right', 6.6)
        float_emoji(cv, t, '💸', 140, 640, 130, 3.6, 6.6, 1)
        float_emoji(cv, t, '🤑', 940, 600, 130, 3.75, 6.6, 2)
        a = window(t, 5.3, 6.9, 0.05, 0.25)
        if a > 0:
            p = ease_back(prog(t, 5.3, 5.65), 2.6)
            pulse = 1 + 0.04 * math.sin(2 * math.pi * 2 * (t - 5.3))
            st = label_on(pill(740, 140, YELLOW), text('¡ES SÚPER FÁCIL!', 70, DARK, F_BLACK, False))
            place(cv, shadowed(st, (0, 12), 10), 540, 540, p * pulse, -5, a)
    # escenas C-E: pasos con el teléfono
    step_header(cv, t, 1, 'Rellenás tus datos ✍', None, 6.9, 10.5)
    step_header(cv, t, 2, 'Te contactamos por', text('WhatsApp 💬', 66, WA_GREEN, F_BLACK, True, 4, WHITE), 10.5, 15.1)
    step_header(cv, t, 3, '¡Te aceptamos', 'y ya está! ✅', 15.1, 19.0)
    if 17.4 < t < 19.1:
        p = ease_back(prog(t, 17.4, 17.75), 2.6)
        st = label_on(pill(380, 110, YELLOW), text('¡LISTO!', 64, DARK, F_BLACK, False))
        place(cv, shadowed(st), 870, 1330, p, 8, window(t, 17.4, 19.0, 0.05, 0.2))
    # escena F: ingresos sin inversión
    money_rain(cv, t)
    if 19.0 < t < 24.6:
        slide_text(cv, text('PODÉS GENERAR', 74), t, 19.25, 540, 210, 'left', 24.2)
        slide_text(cv, text('INGRESOS 💰', 122, YELLOW), t, 19.45, 540, 330, 'right', 24.2)
        earnings_card(cv, t)
    # perro principal
    bump = 0.0
    for tb in (0.75, 5.3, 16.0, 21.95, 34.35):
        if tb < t < tb + 0.4:
            bump = math.sin((t - tb) / 0.4 * math.pi) * (1 - (t - tb) / 0.4)
    draw_phone(cv, t)
    draw_front_dog(cv, t, bump)
    stamp(cv, t)
    confetti(cv, t, 16.0, 4, (650, 700), 130, 3.0)
    whisper_scene(cv, t)
    end_card(cv, t)
    for tw in (3.0, 6.8, 19.0, 33.7):
        wipe(cv, t, tw, YELLOW if tw != 33.7 else (255, 84, 160))
    # temblor de cámara en el sello
    shake = window(t, 21.95, 22.35, 0.01, 0.3)
    out = cv.convert('RGB')
    if shake > 0:
        dx, dy = int(14 * shake * math.sin(t * 90)), int(10 * shake * math.cos(t * 77))
        bg = Image.new('RGB', (W, H), palette(t)[0])
        bg.paste(out, (dx, dy))
        out = bg
    return out.tobytes()


def load_voice(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(audio.SR), '-f', 's16le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float64) / 32768


def main():
    global VOICE_ENV
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', help='locución grabada (wav/mp3/m4a) siguiendo guion.md')
    ap.add_argument('--out', default=os.path.join(HERE, 'distinto_vendedores_9x16.mp4'))
    ap.add_argument('--frames', type=int, default=None, help='renderizar solo N frames (prueba)')
    ap.add_argument('--still', type=float, nargs='*', help='exportar PNG de estos segundos y salir')
    args = ap.parse_args()

    voice = None
    if args.voice:
        voice = load_voice(args.voice)
        hop = audio.SR // FPS
        n = len(voice) // hop
        rms = np.sqrt(np.mean(voice[: n * hop].reshape(n, hop) ** 2, axis=1))
        env = np.clip((rms / (np.percentile(rms, 95) + 1e-9) - 0.08) * 1.3, 0, 1)
        VOICE_ENV = np.convolve(env, [0.25, 0.5, 0.25], mode='same')

    if args.still:
        for s in args.still:
            Image.frombytes('RGB', (W, H), render(int(s * FPS))).save(os.path.join(HERE, f'still_{s:05.2f}.png'))
        return

    wav = os.path.join(HERE, 'audio_mix.wav')
    audio.write_wav(wav, audio.build_audio(DUR, sorted(SFX), voice=voice))
    n = args.frames or int(DUR * FPS)
    ff = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                           '-r', str(FPS), '-i', '-', '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
                           '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest',
                           '-movflags', '+faststart', args.out], stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for k, fr in enumerate(pool.imap(render, range(n), chunksize=4)):
            ff.stdin.write(fr)
            if k % 150 == 0:
                print(f'frame {k}/{n}', flush=True)
    ff.stdin.close()
    ff.wait()
    os.remove(wav)
    print('listo:', args.out)


if __name__ == '__main__':
    main()
