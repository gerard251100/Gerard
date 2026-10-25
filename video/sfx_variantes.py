"""Generate alternative SFX tracks for gorras_editado.mp4 and remux them (video untouched).
usage: python3 sfx_variantes.py <video_sin_tocar.mp4> <out_dir>
"""
import subprocess, sys, wave
import numpy as np

SRC, OUTDIR = sys.argv[1:3]
SR = 48000
TOTAL = 17.766667
# same sync points as editar_video.py
PUNCHES = [(1.00, 0.14), (3.40, 0.16), (6.60, 0.13), (8.70, 0.20), (12.40, 0.15)]
BOOM_T = 8.70
CORNER_T = 0.12
LOGO_T = 15.766667 + 0.1 + 0.12          # closing logo lands

rng = np.random.default_rng(11)

def pink(n):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec /= np.sqrt(np.maximum(f, 20))
    x = np.fft.irfft(spec, n)
    return x / np.abs(x).max()

def ease(x):
    x = np.clip(x, 0, 1)
    return np.where(x < 0.5, 4 * x**3, 1 - (-2 * x + 2) ** 3 / 2)

def swept(noise, centers, width, win=2048, hop=512):
    """Band-pass noise whose center follows `centers` (Hz, one per hop)."""
    n = len(noise)
    out = np.zeros(n + win)
    w = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / SR)
    lf = np.log(np.maximum(f, 1))
    pad = np.concatenate([noise, np.zeros(win)])
    for k, st in enumerate(range(0, n, hop)):
        fc = centers[min(k, len(centers) - 1)]
        mask = np.exp(-0.5 * ((lf - np.log(fc)) / width) ** 2)
        out[st:st + win] += np.fft.irfft(np.fft.rfft(pad[st:st + win] * w) * mask) * w
    return out[:n]

def reverb(st, decay=1.2, wet=0.25, tone=4000):
    n = int(decay * SR)
    t = np.arange(n) / SR
    out = st.copy()
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / decay)
        ir = np.real(np.fft.irfft(np.fft.rfft(ir) * np.exp(-np.fft.rfftfreq(n, 1 / SR) / tone), n))
        ir /= np.sqrt((ir**2).sum())
        m = len(st) + n
        y = np.fft.irfft(np.fft.rfft(st[:, ch], m) * np.fft.rfft(ir, m), m)[:len(st)]
        out[:, ch] = st[:, ch] * (1 - wet) + y * wet * 0.6
    return out

def whoosh(dur, peak, f0, f1, width=0.5, pan_from=-0.6, pan_to=0.6, tail=1.6):
    n = int(dur * SR)
    hops = n // 512 + 1
    x = np.linspace(0, 1, hops)
    g = np.where(x < peak, ease(x / peak), 1 - ease((x - peak) / (1 - peak)) * 0.6)
    centers = f0 * (f1 / f0) ** g
    s = swept(pink(n), centers, width)
    t = np.linspace(0, 1, n)
    env = np.where(t < peak, (t / peak) ** 2.5, ((1 - t) / (1 - peak)) ** tail)
    s *= env
    s /= np.abs(s).max() + 1e-9
    p = pan_from + (pan_to - pan_from) * ease(t)          # moves across the stereo field
    return np.stack([s * np.cos((p + 1) * np.pi / 4), s * np.sin((p + 1) * np.pi / 4)], 1) * 1.41

def kick(dur, f_hi, f_lo, drop, decay, drive=1.5):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t * drop)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay)
    s = np.tanh(s * drive) / np.tanh(drive)
    s[:64] *= np.linspace(0, 1, 64)
    return s

def chime(f=1567.98, dur=1.4):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in [(1, 1, 4), (2.0, 0.45, 6), (3.01, 0.25, 9), (4.2, 0.12, 12)]:
        s += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    s[:96] *= np.linspace(0, 1, 96)
    return s / np.abs(s).max()

def soft_pop(dur=0.09, f_hi=700, f_lo=260):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t * 70)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)
    s[:120] *= np.linspace(0, 1, 120) ** 2                # no click on attack
    return s / np.abs(s).max()

def mono(s):
    return np.stack([s, s], 1)

class Mix:
    def __init__(self):
        self.buf = np.zeros((int((TOTAL + 2) * SR), 2))
    def add(self, st, t, gain):
        s = int(t * SR)
        if s < 0:
            st, s = st[-s:], 0
        e = min(len(self.buf), s + len(st))
        self.buf[s:e] += st[:e - s] * gain
    def render(self, path, rev, target_peak=0.85):
        x = reverb(self.buf, **rev)[:int(TOTAL * SR)]
        x = np.tanh(x * 1.1) / np.tanh(1.1)
        x *= target_peak / np.abs(x).max()
        fade = int(0.25 * SR)
        x[-fade:] *= np.linspace(1, 0, fade)[:, None]
        with wave.open(path, "wb") as wf:
            wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
            wf.writeframes((x * 32767).astype(np.int16).tobytes())

def variant_a():
    """Cinematográfico: whooshes graves y amplios, sub-drop profundo, campanita brillante en el logo."""
    m = Mix()
    for k, (tp, amt) in enumerate(PUNCHES):
        d, pk = 0.8, 0.7
        side = 1 if k % 2 else -1
        m.add(whoosh(d, pk, 120, 900, 0.6, -0.7 * side, 0.7 * side), tp - d * pk, 0.45 + amt)
    m.add(mono(kick(2.2, 90, 32, 6, 1.6, 1.2)), BOOM_T, 0.75)
    m.add(whoosh(1.0, 0.85, 100, 700, 0.7, 0, 0, tail=2.5), LOGO_T - 0.85, 0.35)
    m.add(mono(chime(1318.5, 1.8)), LOGO_T, 0.22)
    m.add(mono(kick(1.8, 70, 30, 6, 2.2, 1.1)), LOGO_T, 0.45)
    m.add(mono(chime(2093.0, 1.0)), CORNER_T, 0.07)
    return m, dict(decay=2.2, wet=0.35, tone=2500)

def variant_b():
    """Urbano / TikTok: swish cortos y secos, golpe tipo 808, pop suave en el logo."""
    m = Mix()
    for k, (tp, amt) in enumerate(PUNCHES):
        d, pk = 0.32, 0.75
        side = 1 if k % 2 else -1
        m.add(whoosh(d, pk, 500, 3500, 0.45, -0.4 * side, 0.4 * side, tail=2.2), tp - d * pk, 0.4 + amt)
    m.add(mono(kick(1.5, 160, 45, 22, 2.6, 2.0)), BOOM_T, 0.8)
    m.add(mono(soft_pop(0.08, 900, 400)), CORNER_T, 0.18)
    m.add(whoosh(0.45, 0.8, 400, 2500, 0.5, 0, 0), LOGO_T - 0.36, 0.3)
    m.add(mono(soft_pop(0.11, 650, 220)), LOGO_T, 0.6)
    m.add(mono(kick(1.2, 120, 42, 20, 3.0, 1.6)), LOGO_T, 0.45)
    return m, dict(decay=0.8, wet=0.15, tone=5000)

def variant_c():
    """Minimal: solo aire muy suave en los zooms, sin boom, campanita sutil al final."""
    m = Mix()
    for k, (tp, amt) in enumerate(PUNCHES):
        d, pk = 0.6, 0.65
        side = 1 if k % 2 else -1
        m.add(whoosh(d, pk, 250, 1600, 0.55, -0.5 * side, 0.5 * side, tail=2.0), tp - d * pk, 0.3 + amt)
    m.add(mono(kick(1.6, 70, 36, 8, 2.5, 1.0)), BOOM_T, 0.35)
    m.add(mono(chime(1567.98, 1.6)), LOGO_T, 0.3)
    return m, dict(decay=1.6, wet=0.3, tone=3500)

for name, fn in [("A_cinematico", variant_a), ("B_urbano", variant_b), ("C_minimal", variant_c)]:
    mix, rev = fn()
    wav = f"{OUTDIR}/sfx_{name}.wav"
    mix.render(wav, rev, target_peak=0.6 if name == "C_minimal" else 0.85)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-i", wav, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart",
                    f"{OUTDIR}/gorras_editado_{name}.mp4"], check=True)
    print("ok", name)
