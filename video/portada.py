import sys, numpy as np
from PIL import Image, ImageEnhance, ImageFilter
frame, logo_p, out = sys.argv[1:4]
W, H = 1080, 1920
im = Image.open(frame).convert("RGB")
# slight push-in on the cap so it fills the frame
z = 1.04; cw, ch = W / z, H / z; cx, cy = 530, 995
im = im.resize((W, H), Image.LANCZOS, box=(cx - cw/2, cy - ch/2, cx + cw/2, cy + ch/2))
im = ImageEnhance.Contrast(im).enhance(1.12)
im = ImageEnhance.Color(im).enhance(0.9)
a = np.asarray(im).astype(np.float32) / 255
y, x = np.mgrid[0:H, 0:W]
# vignette + dark gradient at top for the logo
d = np.sqrt(((x - W/2) / (W*0.75))**2 + ((y - H*0.55) / (H*0.65))**2)
vig = 1 - 0.55 * np.clip(d, 0, 1)**2
top = 1 - 0.65 * np.clip(1 - y / (H*0.38), 0, 1)**1.6
a *= (vig * top)[..., None]
im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
logo = Image.open(logo_p).convert("RGBA")
lw = 580; logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
# soft glow behind logo
glow = Image.new("RGBA", logo.size, (255, 255, 255, 0)); glow.putalpha(logo.getchannel("A").point(lambda v: v * 0.35))
pad = Image.new("RGBA", (W, H), (0, 0, 0, 0)); pos = ((W - lw) // 2, 165)
pad.paste(glow, pos, glow); pad = pad.filter(ImageFilter.GaussianBlur(18))
im = Image.alpha_composite(im.convert("RGBA"), pad)
im.alpha_composite(logo, pos)
im.convert("RGB").save(out, "JPEG", quality=95, subsampling=0)
