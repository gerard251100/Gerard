import subprocess, sys, wave
import numpy as np
from PIL import Image, ImageFilter

SRC, LOGO, OUT, WORK = sys.argv[1:5]
W, H, FPS = 1080, 1920, 30
SR = 48000
CLIP_DUR = 15.766667
END_DUR = 2.0
TOTAL = CLIP_DUR + END_DUR
NF_CLIP = int(round(CLIP_DUR * FPS))
NF = int(round(TOTAL * FPS))

# ---------- easing ----------
def ease_io(x):  # cubic in-out
    x = min(max(x, 0.0), 1.0)
    return 4 * x**3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2

def ease_out_back(x, s=1.4):
    x = min(max(x, 0.0), 1.0)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2

# ---------- camera plan ----------
# (t0, t1, z0, z1, (cx0,cy0), (cx1,cy1)) - slow moves, eased
moves = [
    (0.00, 1.00, 1.22, 1.00, (540, 1000), (540, 960)),   # reveal: front / B logo
    (1.00, 3.30, 1.00, 1.16, (540, 960), (560, 880)),    # Ken Burns on crosses
    (3.30, 6.30, 1.02, 1.20, (540, 960), (540, 1020)),   # back / metal clip detail
    (6.30, 8.50, 1.18, 1.00, (540, 1000), (540, 960)),   # zoom out, side reveal
    (8.50, 12.10, 1.00, 1.18, (540, 960), (540, 1060)),  # inside: satin + tape
    (12.10, 13.40, 1.10, 1.06, (540, 1000), (540, 1000)),
    (13.40, CLIP_DUR, 1.22, 1.00, (540, 1100), (540, 980)),  # final reveal
]
# zoom punches (time of peak, amount)
punches = [(1.00, 0.14), (3.40, 0.16), (6.60, 0.13), (8.70, 0.20), (12.40, 0.15)]
BOOM_T = 8.70

def base_cam(t):
    for t0, t1, z0, z1, c0, c1 in moves:
        if t0 <= t <= t1 or t1 == moves[-1][1] and t >= t0:
            e = ease_io((t - t0) / (t1 - t0))
            return z0 + (z1 - z0) * e, (c0[0] + (c1[0] - c0[0]) * e, c0[1] + (c1[1] - c0[1]) * e)
    return 1.0, (540, 960)

def punch(t):
    z = 0.0
    for tp, a in punches:
        d = t - tp
        if -0.12 <= d < 0:          # fast ease-in up
            z += a * ease_io((d + 0.12) / 0.12)
        elif 0 <= d < 0.35:         # ease-out back down
            z += a * (1 - ease_io(d / 0.35))
    return z

def crop_box(z, c):
    cw, ch = W / z, H / z
    x0 = min(max(c[0] - cw / 2, 0), W - cw)
    y0 = min(max(c[1] - ch / 2, 0), H - ch)
    return (x0, y0, x0 + cw, y0 + ch)

# ---------- logo: black bg -> alpha ----------
lg = np.asarray(Image.open(LOGO).convert("RGB")).astype(np.float32) / 255
a = lg.max(axis=2)
a = np.clip((a - 0.06) / 0.94, 0, 1)            # kill JPEG noise in the black
rgb = np.clip(lg / np.maximum(a[..., None], 1e-4), 0, 1)
rgba = np.dstack([rgb, a])
ys, xs = np.where(a > 0.02)
rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
logo = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")
logo.save(f"{WORK}/logo_transparent.png")

def scaled_logo(width, opacity):
    h = int(round(logo.height * width / logo.width))
    im = logo.resize((int(width), h), Image.LANCZOS)
    if opacity < 1:
        al = np.asarray(im.getchannel("A")).astype(np.float32) * opacity
        im.putalpha(Image.fromarray(al.astype(np.uint8)))
    return im

corner = scaled_logo(230, 0.8)
CORNER_POS = (W - corner.width - 48, 90)

# ---------- render video ----------
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-f", "rawvideo", "-pix_fmt", "rgb24",
                        "-r", str(FPS), "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow",
                        "-crf", "17", "-pix_fmt", "yuv420p", f"{WORK}/video.mp4"], stdin=subprocess.PIPE)
fsize = W * H * 3
last = None
for i in range(NF_CLIP):
    buf = dec.stdout.read(fsize)
    if len(buf) < fsize:
        break
    t = i / FPS
    fr = Image.frombuffer("RGB", (W, H), buf)
    last = fr
    z, c = base_cam(t)
    z *= 1 + punch(t)
    out = fr.resize((W, H), Image.BICUBIC, box=crop_box(z, c))
    # corner logo fades in over first 0.4 s
    k = ease_io(t / 0.4)
    if k > 0:
        cl = corner if k >= 1 else scaled_logo(230, 0.8 * k)
        out.paste(cl, CORNER_POS, cl)
    enc.stdin.write(out.tobytes())
    last_out = out
dec.stdout.close(); dec.wait()

# closing card: blurred dark last frame + centered logo zoom-in
bg = last_out.filter(ImageFilter.GaussianBlur(28))
bg = Image.fromarray((np.asarray(bg).astype(np.float32) * 0.32).astype(np.uint8))
n_end = NF - NF_CLIP
for j in range(n_end):
    t = j / FPS
    x = ease_io(t / 0.3)                      # cross-dissolve into the blurred card
    frame = Image.blend(last_out, bg, x)
    # slow push on the background
    zb = 1 + 0.04 * ease_io(t / END_DUR)
    frame = frame.resize((W, H), Image.BICUBIC, box=crop_box(zb, (540, 960)))
    lt = (t - 0.1) / 0.55
    if lt > 0:
        s = 0.55 + 0.45 * ease_out_back(lt)
        s *= 1 + 0.03 * ease_io((t - 0.65) / (END_DUR - 0.65))
        cl = scaled_logo(760 * s, min(1, lt * 1.6))
        frame.paste(cl, ((W - cl.width) // 2, (H - cl.height) // 2 - 40), cl)
    if t > END_DUR - 0.25:                     # short fade to black
        f = ease_io((t - (END_DUR - 0.25)) / 0.25)
        frame = Image.fromarray((np.asarray(frame).astype(np.float32) * (1 - f)).astype(np.uint8))
    enc.stdin.write(frame.tobytes())
enc.stdin.close(); enc.wait()
LOGO_POP_T = CLIP_DUR + 0.1

# ---------- sound design (numpy) ----------
rng = np.random.default_rng(7)
N = int(TOTAL * SR) + SR
mix = np.zeros((N, 2), np.float32)

def add(sig, t, gain=1.0, pan=0.0):
    s = int(t * SR)
    if s < 0:
        sig = sig[-s:]; s = 0
    e = min(N, s + len(sig))
    sig = sig[:e - s]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[s:e, 0] += sig * gain * l * 1.414
    mix[s:e, 1] += sig * gain * r * 1.414

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y

def whoosh(dur=0.55, peak=0.62, f_lo=250, f_hi=3200):
    n = int(dur * SR)
    noise = rng.standard_normal(n + 2048).astype(np.float32)
    out = np.zeros(n + 2048, np.float32)
    hop, win = 256, np.hanning(1024).astype(np.float32)
    freqs = np.fft.rfftfreq(1024, 1 / SR)
    for st in range(0, n, hop):
        x = st / n
        # sweep up to the peak, then back down
        g = x / peak if x < peak else 1 - (x - peak) / (1 - peak)
        fc = f_lo * (f_hi / f_lo) ** (np.sin(g * np.pi / 2))
        mask = np.exp(-0.5 * (np.log(np.maximum(freqs, 1) / fc) / 0.55) ** 2)
        seg = np.fft.irfft(np.fft.rfft(noise[st:st + 1024] * win) * mask)
        out[st:st + 1024] += seg.astype(np.float32) * win
    out = out[:n]
    t = np.linspace(0, 1, n)
    env = np.where(t < peak, (t / peak) ** 2.2, ((1 - t) / (1 - peak)) ** 1.6)
    out *= env
    return out / (np.abs(out).max() + 1e-9)

def pop(dur=0.12):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 180 + 900 * np.exp(-t * 60)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 38)
    click = rng.standard_normal(n) * np.exp(-t * 900) * 0.25
    s = s + click
    s[:48] *= np.linspace(0, 1, 48)
    return (s / np.abs(s).max()).astype(np.float32)

def boom(dur=1.4):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 42 + 85 * np.exp(-t * 14)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 3.2)
    body = np.tanh(body * 1.6) / np.tanh(1.6)
    thump = lowpass(rng.standard_normal(n).astype(np.float32), 900) * np.exp(-t * 30) * 3
    s = body + thump
    s[:96] *= np.linspace(0, 1, 96)
    return (s / np.abs(s).max()).astype(np.float32)

W_DUR, W_PEAK = 0.55, 0.62
for k, (tp, amt) in enumerate(punches):
    w = whoosh(W_DUR, W_PEAK)
    add(w, tp - W_DUR * W_PEAK, gain=0.38 + amt, pan=(-0.35 if k % 2 else 0.35))
add(boom(), BOOM_T - 0.01, gain=0.55)
add(pop(), 0.12, gain=0.28)                      # corner logo appears
add(whoosh(0.5, 0.7, 200, 2000), LOGO_POP_T - 0.35, gain=0.25)
add(pop(), LOGO_POP_T + 0.12, gain=0.55)         # closing logo lands
add(boom(1.6) * 0.5, LOGO_POP_T + 0.12, gain=0.35)

mix = mix[:int(TOTAL * SR)]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)          # gentle soft clip
mix *= 0.89 / np.abs(mix).max()                  # ~-1 dBFS peak
pcm = (mix * 32767).astype(np.int16)
with wave.open(f"{WORK}/sfx.wav", "wb") as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{WORK}/video.mp4", "-i", f"{WORK}/sfx.wav",
                "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                "-shortest", "-movflags", "+faststart", OUT], check=True)
print("done")
