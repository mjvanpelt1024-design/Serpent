"""
A small pixel-art kit for the room pictures (used by shop-rooms-art.py): colors, a Pic with exact-pixel
drawing, and sprites that get a dark outline and a soft offset shadow when they're placed.
Not run by itself.
"""
from PIL import Image, ImageDraw

OUT = (26, 18, 12, 255)
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def rgb(h, a=255):
    if isinstance(h, tuple):
        return h if len(h) == 4 else h + (a,)
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def mix(a, b, t):
    a, b = rgb(a), rgb(b)
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def lite(c, f=0.25):
    return mix(c, (255, 250, 230), f)


def dark(c, f=0.3):
    return mix(c, (20, 12, 20), f)


class Pic:
    def __init__(self, w, h, fill=(0, 0, 0, 0)):
        self.im = Image.new("RGBA", (w, h), fill)
        self.w, self.h = w, h
        self.d = ImageDraw.Draw(self.im)

    def r(self, x, y, w, h, c):
        if w > 0 and h > 0:
            self.d.rectangle([x, y, x + w - 1, y + h - 1], fill=rgb(c))
        return self

    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.im.putpixel((x, y), rgb(c))
        return self

    def hl(self, x, y, w, c):
        return self.r(x, y, w, 1, c)

    def vl(self, x, y, h, c):
        return self.r(x, y, 1, h, c)

    def line(self, x0, y0, x1, y1, c):
        self.d.line([x0, y0, x1, y1], fill=rgb(c))
        return self

    def disc(self, cx, cy, r, c):
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6:
                    self.p(x, y, c)
        return self

    def oval(self, cx, cy, rx, ry, c):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / (rx + 0.4)) ** 2 + ((y - cy) / (ry + 0.4)) ** 2 <= 1:
                    self.p(x, y, c)
        return self

    def blend(self, x, y, c, a):
        if not (0 <= x < self.w and 0 <= y < self.h) or a <= 0:
            return
        c = rgb(c)
        o = self.im.getpixel((x, y))
        t = min(1.0, a / 255.0)
        if o[3] == 0:
            self.im.putpixel((x, y), (c[0], c[1], c[2], int(255 * t)))
            return
        na = o[3] + (255 - o[3]) * t
        k = (255 - o[3]) * t / max(1.0, na) if o[3] < 255 else t
        k = t if o[3] == 255 else k
        self.im.putpixel((x, y), (int(o[0] * (1 - k) + c[0] * k), int(o[1] * (1 - k) + c[1] * k), int(o[2] * (1 - k) + c[2] * k), int(na)))

    def wash(self, x, y, w, h, c, a):
        for j in range(h):
            for i in range(w):
                self.blend(x + i, y + j, c, a)
        return self

    def shade(self, x, y, w, h, c, a0, a1, vertical=True):
        """a gradient of c from alpha a0 to a1 (0-255 scale of coverage), as ordered dither so it stays pixel art"""
        base = rgb(c)
        n = h if vertical else w
        for j in range(h):
            for i in range(w):
                f = (j if vertical else i) / max(1, n - 1)
                cov = (a0 + (a1 - a0) * f) / 255.0
                if cov > BAYER[j % 4][i % 4] / 16.0 + 0.02:
                    self.blend(x + i, y + j, base, 255)
        return self

    def glow(self, cx, cy, r, c, a=60):
        """a soft round glow: concentric washes, dithered at the rim"""
        base = rgb(c)
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d <= r:
                    f = (1 - d / r) ** 1.6
                    cov = f
                    if cov > BAYER[y % 4][x % 4] / 16.0 * 0.9:
                        self.blend(x, y, base, a * (0.4 + 0.6 * f))
        return self


def outlined(im):
    w, h = im.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.alpha_composite(im, (1, 1))
    src = out.copy()
    px = src.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w + 2 and 0 <= ny < h + 2 and px[nx, ny][3] > 100:
                    out.putpixel((x, y), OUT)
                    break
    return out


def place(base, spr, x, y, shadow=True, outline=True):
    """put a sprite on base so that (x, y) is where its own top left lands; it gets an outline and a drop shadow"""
    s = spr.im
    if outline:
        s = outlined(s)
        x -= 1
        y -= 1
    layers = []
    if shadow:
        sh = Image.new("RGBA", s.size, (0, 0, 0, 0))
        sh.putalpha(s.getchannel("A").point(lambda v: 70 if v > 0 else 0))
        layers.append((sh, x + 1, y + 1))
    layers.append((s, x, y))
    for im, ix, iy in layers:
        sx, sy = max(0, -ix), max(0, -iy)
        if sx or sy:
            im = im.crop((sx, sy, im.size[0], im.size[1]))
        # alpha_composite clips what hangs over the right and bottom edges
        base.im.alpha_composite(im, (ix + sx, iy + sy)) if ix + sx < base.w and iy + sy < base.h else None
    return base


# ---------------------------------------------------------------- sprites ----

def banner(w, h, c1, c2, emblem="#ffd23f"):
    s = Pic(w + 2, h + 3)
    s.hl(0, 0, w + 2, "#5a3a1e")
    s.p(0, 0, "#d8b060"); s.p(w + 1, 0, "#d8b060")
    s.r(1, 1, w, h - 1, c1)
    s.hl(1, 1, w, lite(c1, 0.3)); s.vl(1, 1, h - 1, lite(c1, 0.2)); s.vl(w, 1, h - 1, dark(c1, 0.25))
    s.hl(2, 3, w - 2, c2); s.hl(2, h - 3, w - 2, c2)
    for j in range(3):
        s.hl(1 + j, h + j, max(1, w - 2 * j), c1)
        s.p(1 + j, h + j, dark(c1, 0.2))
    cx = (w + 2) // 2
    s.r(cx - 1, 6, 3, 1, emblem); s.r(cx - 2, 7, 5, 2, emblem); s.r(cx - 1, 9, 3, 1, emblem)
    s.p(cx, 7, lite(emblem, 0.5))
    return s


def frame(w, h, sky="#7ab8e0", ground="#5a9a3a", sun="#ffe08a", wood="#8a5a30"):
    s = Pic(w, h)
    s.r(0, 0, w, h, wood)
    s.hl(0, 0, w, lite(wood, 0.3)); s.vl(0, 0, h, lite(wood, 0.15))
    s.hl(0, h - 1, w, dark(wood, 0.3)); s.vl(w - 1, 0, h, dark(wood, 0.3))
    s.r(2, 2, w - 4, h - 4, sky)
    s.r(2, h // 2 + 1, w - 4, h - h // 2 - 3, ground)
    for i in range(2, w - 4, 3):
        s.p(i + 1, h // 2, ground)
    s.disc(w - 5, 5, 1, sun)
    s.hl(2, 2, w - 4, lite(sky, 0.25))
    return s


def barrel(w=14, h=16, wood="#8a5a30", hoop="#4a4a52"):
    s = Pic(w, h)
    for y in range(h):
        wide = 3 <= y <= h - 4
        s.r(0 if wide else 1, y, w if wide else w - 2, 1, wood)
    for x in range(3, w - 2, 3):
        s.vl(x, 1, h - 2, dark(wood, 0.2))
    s.vl(1, 1, h - 2, lite(wood, 0.3)); s.vl(w - 2, 1, h - 2, dark(wood, 0.3))
    for y in (2, h - 4):
        s.hl(0, y, w, hoop); s.hl(0, y + 1, w, dark(hoop, 0.3))
    s.hl(1, 0, w - 2, lite(wood, 0.2))
    return s


def crate(w=14, h=12, wood="#a8743c"):
    s = Pic(w, h)
    s.r(0, 0, w, h, wood)
    s.hl(0, 0, w, lite(wood, 0.3)); s.hl(0, h - 1, w, dark(wood, 0.3))
    s.vl(0, 0, h, lite(wood, 0.15)); s.vl(w - 1, 0, h, dark(wood, 0.3))
    s.line(1, 1, w - 2, h - 2, dark(wood, 0.25)); s.line(w - 2, 1, 1, h - 2, dark(wood, 0.25))
    return s


def sack(w=10, h=11, c="#c8a878", tie="#7a5230"):
    s = Pic(w, h)
    s.oval(w // 2, h // 2 + 1, w // 2 - 1, h // 2 - 1, c)
    s.r(w // 2 - 2, 0, 4, 3, c)
    s.hl(w // 2 - 2, 2, 4, tie)
    s.vl(2, 4, h - 6, lite(c, 0.3)); s.vl(w - 3, 4, h - 6, dark(c, 0.25))
    return s


def plant(pot="#a85a3a", leaf="#4a9a3a", h=16, w=12):
    s = Pic(w, h)
    cx = w // 2
    for a, (dx, dy) in enumerate([(-4, 4), (-2, 1), (0, 0), (2, 1), (4, 4), (-3, 7), (3, 7)]):
        s.r(cx + dx - 1, dy, 2, 5, leaf if a % 2 else lite(leaf, 0.2))
        s.p(cx + dx - 1, dy, lite(leaf, 0.45))
    s.r(cx - 1, 6, 3, h - 11, dark(leaf, 0.35))
    s.r(cx - 4, h - 6, 9, 6, pot)
    s.hl(cx - 4, h - 6, 9, lite(pot, 0.35)); s.hl(cx - 3, h - 1, 7, dark(pot, 0.3))
    s.vl(cx + 3, h - 5, 4, dark(pot, 0.25))
    return s


def window(w, h, sky="#8ac8f0", frame_c="#6a4424", night=False, round_=False):
    s = Pic(w, h)
    s.r(0, 0, w, h, frame_c)
    s.r(2, 2, w - 4, h - 4, sky)
    if night:
        for (x, y) in ((4, 4), (w - 7, 6), (w // 2 + 1, h - 8), (6, h - 10)):
            s.p(x, y, "#ffffff")
        s.disc(w - 8, 7, 2, "#fff2b8")
    else:
        s.hl(3, 4, 5, "#ffffff"); s.hl(4, 3, 3, "#ffffff")
        s.r(2, h - 7, w - 4, 5, "#5a9a3a"); s.hl(2, h - 7, w - 4, "#7ac04a")
    s.vl(w // 2, 2, h - 4, frame_c); s.hl(2, h // 2, w - 4, frame_c)
    s.hl(0, 0, w, lite(frame_c, 0.3)); s.hl(0, h - 1, w, dark(frame_c, 0.3))
    s.hl(0, h - 2, w, lite(frame_c, 0.15))
    if round_:
        r = Pic(w, h)
        cx, cy, rx, ry = w // 2, h // 2, w // 2 - 1, h // 2 - 1
        r.oval(cx, cy, rx, ry, frame_c)
        r.oval(cx, cy, rx - 2, ry - 2, sky)
        r.vl(cx, 2, h - 4, frame_c); r.hl(2, cy, w - 4, frame_c)
        r.hl(cx - rx + 2, cy - ry + 3, 3, lite(sky, 0.5))
        return r
    return s


def sconce(c="#ffd27a"):
    s = Pic(7, 11)
    s.r(2, 6, 3, 5, "#4a3a2a"); s.r(1, 9, 5, 2, "#6a5238")
    s.r(0, 5, 7, 2, "#8a8a92"); s.hl(0, 5, 7, "#b8b8c0")
    s.r(2, 0, 3, 5, c); s.p(3, 0, "#fff6d0"); s.p(3, 1, "#fff6d0")
    return s


def rug(w, h, c1, c2, c3="#ffd23f"):
    s = Pic(w, h)
    s.r(0, 0, w, h, c1)
    s.r(1, 1, w - 2, h - 2, c2)
    s.r(2, 2, w - 4, h - 4, c1)
    for x in range(4, w - 4, 4):
        s.p(x, h // 2, c3); s.p(x + 1, h // 2, c3)
    s.hl(0, 0, w, lite(c1, 0.3))
    return s


def crossed_swords(c="#c8d0d8", hilt="#d8b050"):
    s = Pic(15, 15)
    s.line(1, 1, 12, 12, c); s.line(13, 1, 2, 12, c)
    s.line(2, 1, 13, 12, lite(c, 0.4))
    s.r(10, 10, 4, 2, hilt); s.r(1, 10, 4, 2, hilt)
    s.r(12, 12, 3, 3, "#5a3a1e"); s.r(0, 12, 3, 3, "#5a3a1e")
    return s


def shield(c1="#a82a2a", c2="#ffd23f", w=11, h=13):
    s = Pic(w, h)
    for y in range(h):
        inset = 0 if y < h - 5 else (y - (h - 6))
        s.hl(inset, y, w - inset * 2, c1)
    s.vl(w // 2, 0, h - 2, c2); s.hl(1, 4, w - 2, c2)
    s.hl(0, 0, w, lite(c1, 0.4)); s.vl(0, 0, h - 5, lite(c1, 0.25))
    return s


def hay(w=22, h=12, c="#d8b858"):
    s = Pic(w, h)
    s.r(0, 1, w, h - 1, c); s.hl(1, 0, w - 2, c)
    for x in range(1, w - 1, 3):
        s.vl(x, 2, h - 4, dark(c, 0.18))
    s.hl(0, h // 2, w, dark(c, 0.12))
    s.vl(w // 3, 0, h, "#7a5a30"); s.vl(2 * w // 3, 0, h, "#7a5a30")
    s.hl(0, 1, w, lite(c, 0.3))
    s.hl(0, h - 1, w, dark(c, 0.3))
    return s


def coin_stack(n, c1, c2):
    s = Pic(8, n * 2 + 1)
    for i in range(n):
        y = s.h - 2 - i * 2
        s.r(0, y, 8, 2, c1); s.hl(0, y, 8, lite(c1, 0.4)); s.hl(0, y + 1, 8, c2)
    return s


def chandelier(w=24, c="#d8b050", flame="#ffe08a"):
    s = Pic(w, 15)
    cx = w // 2
    s.vl(cx, 0, 6, "#6a5a48")
    s.hl(1, 6, w - 2, c); s.hl(2, 7, w - 4, dark(c, 0.3)); s.hl(5, 8, w - 10, dark(c, 0.45))
    for x in (1, cx - 1, w - 3):
        s.r(x, 3, 2, 3, "#f4ecd0"); s.p(x, 2, flame); s.p(x, 1, "#fff6d0")
    for x in (4, cx, w - 5):
        s.vl(x, 9, 2, "#8a7a68"); s.p(x, 11, lite(c, 0.4)); s.p(x, 12, flame)
    return s


def hang_lamp(c="#d8b050", glass="#ffd27a"):
    """a brass lamp on a chain: a cap, a glowing glass, a base"""
    s = Pic(9, 17)
    s.vl(4, 0, 7, "#6a5a48")
    s.hl(2, 7, 5, c); s.hl(1, 8, 7, c); s.hl(1, 8, 7, lite(c, 0.3))
    s.r(1, 9, 7, 5, glass); s.vl(1, 9, 5, lite(glass, 0.4)); s.vl(7, 9, 5, dark(glass, 0.25))
    s.p(3, 10, "#fff6d0"); s.p(3, 11, "#fff6d0"); s.hl(3, 12, 3, lite(glass, 0.5))
    s.vl(4, 9, 5, mix(glass, "#c8621a", 0.2)) if False else None
    s.hl(1, 14, 7, c); s.hl(2, 15, 5, dark(c, 0.3)); s.p(4, 16, c)
    return s


def coin_sack(w=11, h=12, c="#c8a878", tie="#7a5230"):
    s = sack(w, h, c, tie)
    s.r(w // 2 - 1, h // 2 + 1, 3, 3, "#ffd23f"); s.p(w // 2, h // 2 + 2, "#c8921a")
    return s


def rope_post(h=18, c="#7a5230"):
    s = Pic(6, h)
    s.r(1, 0, 4, h, c); s.hl(0, 0, 6, lite(c, 0.4)); s.hl(1, 1, 4, lite(c, 0.2))
    s.vl(4, 2, h - 2, dark(c, 0.3)); s.vl(1, 2, h - 2, lite(c, 0.2))
    return s


def fish_net(w, h, c="#d8c898"):
    """a diamond mesh hung from a rope; drawn without an outline"""
    s = Pic(w, h)
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            s.line(x, y, x + 4, y + 4, mix(c, "#000000", 0.15))
            s.line(x + 4, y, x, y + 4, mix(c, "#000000", 0.15))
    s.hl(0, 0, w, "#7a5230")
    s.hl(0, 1, w, "#a8783c")
    return s
