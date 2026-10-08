"""Música y efectos de sonido sintetizados (sin samples externos)."""
import wave
import numpy as np

SR = 44100
BPM = 115
BEAT = 60 / BPM
rng = np.random.default_rng(7)


def t_arr(dur):
    return np.arange(int(dur * SR)) / SR


def lowpass(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / hi) ** 4))
    return np.fft.irfft(X, len(x))


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def add(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    buf[i:i + len(sig)] += sig * gain


# ---------- instrumentos ----------
def pluck(f, dur=0.45):
    t = t_arr(dur)
    s = sum(np.sin(2 * np.pi * k * f * t) / k * np.exp(-t * (4 + 2.2 * k)) for k in range(1, 7))
    return s * np.minimum(1, t / 0.004)


def bass(f, dur):
    t = t_arr(dur)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    return s * np.exp(-t * 2.2) * np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.03)


def kick():
    t = t_arr(0.35)
    ph = 2 * np.pi * np.cumsum(45 + 110 * np.exp(-t * 30)) / SR
    return np.sin(ph) * np.exp(-t * 9)


def clap():
    t = t_arr(0.2)
    return bandpass(rng.standard_normal(len(t)), 900, 3500) * np.exp(-t * 22)


def hat():
    t = t_arr(0.06)
    return bandpass(rng.standard_normal(len(t)), 7000, 16000) * np.exp(-t * 70)


def pad(freqs, dur):
    t = t_arr(dur)
    s = np.zeros_like(t)
    for f in freqs:
        for d in (-0.15, 0, 0.17):
            s += np.sin(2 * np.pi * (f + d) * t) + 0.25 * np.sin(4 * np.pi * (f + d) * t)
    env = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.4)
    return s * env / (len(freqs) * 3)


# ---------- efectos ----------
def whoosh(dur=0.45, lo=300, hi=5000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    noise = rng.standard_normal(n)
    for k in range(6):
        c = lo * (hi / lo) ** (k / 5)
        seg = bandpass(noise, c * 0.7, c * 1.4)
        w = np.exp(-((t / dur - (0.15 + 0.7 * k / 5)) ** 2) / 0.02)
        out += seg * w
    return out * np.sin(np.pi * t / dur) * 0.9


def pop(f0=700, f1=220, dur=0.12):
    t = t_arr(dur)
    ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 40)) / SR
    return np.sin(ph) * np.exp(-t * 28)


def click():
    t = t_arr(0.025)
    return (bandpass(rng.standard_normal(len(t)), 2500, 9000) * 0.6
            + 0.3 * np.sin(2 * np.pi * 1900 * t)) * np.exp(-t * 220)


def bell(f, dur=0.8):
    t = t_arr(dur)
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 5)


def ding():
    out = np.zeros(int(0.7 * SR))
    add(out, bell(midi(88), 0.6), 0, 0.6)
    add(out, bell(midi(93), 0.6), 0.09, 0.6)
    return out


def chime():
    out = np.zeros(int(1.4 * SR))
    for i, n in enumerate((72, 76, 79, 84, 88)):
        add(out, bell(midi(n), 1.0), i * 0.07, 0.45)
    return out


def coin():
    t1, t2 = t_arr(0.06), t_arr(0.3)
    sq = lambda f, t: np.sign(np.sin(2 * np.pi * f * t))
    return np.concatenate([sq(midi(83), t1) * 0.5, sq(midi(88), t2) * 0.5 * np.exp(-t2 * 9)]) * 0.5


def slam():
    t = t_arr(0.6)
    ph = 2 * np.pi * np.cumsum(32 + 90 * np.exp(-t * 18)) / SR
    return np.sin(ph) * np.exp(-t * 6) + lowpass(rng.standard_normal(len(t)), 1500) * np.exp(-t * 14) * 0.6


def sparkle(dur=0.9, seed=3):
    r = np.random.default_rng(seed)
    out = np.zeros(int((dur + 0.4) * SR))
    for i in range(14):
        add(out, bell(r.uniform(2200, 5200), 0.35), i * dur / 14, 0.18)
    return out


def sweep_down(dur=0.6):
    t = t_arr(dur)
    ph = 2 * np.pi * np.cumsum(900 * np.exp(-t * 4) + 80) / SR
    return np.sin(ph) * np.sin(np.pi * t / dur) * 0.5


def shhh(dur=1.5):
    t = t_arr(dur)
    n = bandpass(rng.standard_normal(len(t)), 2600, 9000)
    env = np.minimum(1, t / 0.12) * np.minimum(1, (dur - t) / 0.45) * (1 + 0.12 * np.sin(2 * np.pi * 5 * t))
    return n * env * 1.4


def confetti_burst():
    out = np.zeros(int(0.9 * SR))
    for i in range(22):
        add(out, click() * rng.uniform(0.3, 1), rng.uniform(0, 0.6), 1)
    add(out, pop(500, 120, 0.25), 0, 0.8)
    return out


# ---------- música ----------
PROG = [(60, 64, 67), (55, 59, 62), (57, 60, 64), (53, 57, 60)]   # C G Am F
SNEAKY = [(57, 60, 64), (53, 57, 60)]                               # Am F


def groove(buf, start, end, full=True):
    bar = 4 * BEAT
    b = 0
    t = start
    while t < end - 0.01:
        chord = PROG[b % 4]
        for beat in range(4):
            tb = t + beat * BEAT
            if tb >= end:
                break
            add(buf, kick(), tb, 0.55)
            if beat in (1, 3):
                add(buf, clap(), tb, 0.22)
            for h in (0, 0.5):
                if tb + h * BEAT < end:
                    add(buf, hat(), tb + h * BEAT, 0.12 if h else 0.07)
            add(buf, bass(midi(chord[0] - 24), BEAT * 0.9), tb, 0.30)
            if full:
                for i in range(2):
                    n = chord[(beat * 2 + i) % 3] + (12 if (beat * 2 + i) % 4 == 3 else 0)
                    ta = tb + i * BEAT / 2
                    if ta < end:
                        add(buf, pluck(midi(n + 12)), ta, 0.13)
        add(buf, pad([midi(n) for n in chord], min(bar, end - t) + 0.3), t, 0.10)
        b += 1
        t += bar


def build_audio(total, events, whisper=(24.4, 31.6), silent=(31.6, 33.7), voice=None):
    """events: lista de (t, nombre). voice: np.array mono a SR o None."""
    music = np.zeros(int((total + 1) * SR))
    # riser de entrada
    add(music, whoosh(0.7, 200, 3000), 0.0, 0.35)
    groove(music, 0.55, whisper[0])
    # sección susurro: pad misterioso + pizzicato suave
    w0, w1 = whisper
    sneaky = np.zeros_like(music)
    t = w0 + 0.3
    k = 0
    while t < w1 - 0.2:
        ch = SNEAKY[k % 2]
        add(sneaky, pad([midi(n - 12) for n in ch], min(4 * BEAT, w1 - t) + 0.3), t, 0.16)
        for beat in range(4):
            tb = t + beat * BEAT
            if tb < w1 - 0.2:
                add(sneaky, pluck(midi(ch[beat % 3] + (0 if beat % 2 else 12)), 0.25), tb, 0.06)
                add(sneaky, hat(), tb + BEAT / 2, 0.035)
        k += 1
        t += 4 * BEAT
    music += lowpass(sneaky, 1800)
    # final
    groove(music, silent[1], total - 1.3)
    add(music, pad([midi(n) for n in (60, 64, 67, 72)], 1.8), total - 1.3, 0.35)
    add(music, bass(midi(36), 1.4), total - 1.3, 0.4)
    add(music, kick(), total - 1.3, 0.6)

    # volumen de la música en el tiempo (y ducking si hay voz)
    tt = np.arange(len(music)) / SR
    gain = np.ones_like(music)
    if voice is not None:
        v = np.zeros_like(music)
        v[:min(len(voice), len(v))] = np.abs(voice[:len(v)])
        k = int(0.25 * SR)
        env = np.convolve(v, np.ones(k) / k, mode='same')
        env = env / (env.max() + 1e-9)
        gain *= 1 - 0.6 * np.clip(env * 4, 0, 1)
    music *= gain

    sfx_bank = {
        'whoosh': lambda: whoosh(), 'pop': lambda: pop(), 'popbig': lambda: pop(500, 150, 0.2),
        'popup': lambda: pop(400, 900, 0.1), 'click': click, 'ding': ding, 'chime': chime,
        'coin': coin, 'slam': slam, 'sparkle': lambda: sparkle(), 'sweep': sweep_down,
        'shhh': shhh, 'confetti': confetti_burst,
    }
    sfx_gain = {'whoosh': 0.35, 'pop': 0.35, 'popbig': 0.5, 'popup': 0.3, 'click': 0.25, 'ding': 0.4,
                'chime': 0.45, 'coin': 0.18, 'slam': 0.8, 'sparkle': 0.5, 'sweep': 0.35,
                'shhh': 0.32, 'confetti': 0.4}
    sfx = np.zeros_like(music)
    for t, name in events:
        add(sfx, sfx_bank[name](), t, sfx_gain[name])

    mix = music * 0.8 + sfx
    if voice is not None:
        vv = np.zeros_like(mix)
        vv[:min(len(voice), len(vv))] = voice[:len(vv)]
        mix += vv * 1.1
    mix = mix[: int(total * SR)]
    fade = int(0.4 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) * 0.89
    return mix


def write_wav(path, mono):
    st = np.repeat((np.clip(mono, -1, 1) * 32767).astype(np.int16)[:, None], 2, axis=1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(st.tobytes())
