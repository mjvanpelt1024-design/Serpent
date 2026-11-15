"""Draws the board's red apple as a round, softly shaded apple with a stem and a leaf and a hard drop
shadow, the same look as the golden apple and the molasses: textures/board/items/apple-{9,19,39}.png.
Same canvas sizes and anchors as the square ones it replaces. Run from the project root; --force not needed."""
import math
from PIL import Image, ImageDraw, ImageFilter

SS = 8
# size -> (canvas w, canvas h, body top row)
SIZES = {9: (9, 14, 2), 19: (19, 26, 4), 39: (39, 49, 7)}

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def apple(S):
    W, H, top = SIZES[S]
    w, h = W * SS, H * SS
    body = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = body.load()
    cx, cy = S * SS / 2, (top + S * 0.53) * SS
    rx, ry = S * SS * 0.5, S * SS * 0.47
    dip = (cx, (top + S * 0.02) * SS, S * SS * 0.11)
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            u, v = (x - cx) / rx, (y - cy) / ry
            # a roundish apple: a bit wider across the shoulders, narrower at the foot
            narrow = 1 - 0.1 * max(0, v)
            if abs(u / narrow) ** 2.4 + abs(v) ** 2.4 > 1: continue
            if math.hypot(x - dip[0], y - dip[1]) < dip[2]: continue
            mp[x, y] = 255
    dark, mid, lit = (150, 14, 20), (226, 36, 42), (255, 110, 100)
    for y in range(h):
        for x in range(w):
            if not mp[x, y]: continue
            u, v = (x - cx) / rx, (y - cy) / ry
            t = max(0, min(1, (u * 0.6 + v * 0.8 + 1) / 2))          # light from the top left
            c = lerp(lit, mid, min(1, t * 1.6)) if t < 0.625 else lerp(mid, dark, (t - 0.625) / 0.375)
            px[x, y] = c + (255,)
    d = ImageDraw.Draw(body)
    # shine
    sx, sy = cx - rx * 0.42, cy - ry * 0.42
    shine = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shine).ellipse([sx - rx * 0.2, sy - ry * 0.14, sx + rx * 0.2, sy + ry * 0.14], fill=(255, 235, 225, 190))
    shine = shine.filter(ImageFilter.GaussianBlur(SS * max(0.4, S / 30)))
    shine.putalpha(Image.eval(shine.getchannel("A"), lambda a: a).point(lambda a: a) )
    body = Image.composite(Image.alpha_composite(body, shine), body, mask)
    body.putalpha(mask)
    # stem and leaf
    d = ImageDraw.Draw(body)
    sw = max(1.2, S * 0.07) * SS
    x0, y0 = cx, dip[1] + dip[2] * 0.6
    x1, y1 = cx + S * SS * 0.04, (top - S * 0.2) * SS if S > 9 else top * SS - SS * 0.5
    d.line([(x0, y0), (x1, y1)], fill=(104, 58, 28, 255), width=int(sw))
    lw, lh = S * SS * 0.2, S * SS * 0.09
    lx, ly = x1 + lw * 0.8, y1 + lh * 0.2
    leaf = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(leaf).ellipse([lx - lw, ly - lh, lx + lw, ly + lh], fill=(64, 200, 70, 255))
    leaf = leaf.rotate(-18, center=(x1, y1))
    body = Image.alpha_composite(body, leaf)
    # the hard drop shadow, like every other item's
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    a = body.getchannel("A").point(lambda v: 97 if v > 128 else 0)
    off = max(1, round(S * 0.13)) * SS
    sh.paste((0, 0, 0, 255), (0, off), a)
    sh.putalpha(a.transform(a.size, Image.AFFINE, (1, 0, 0, 0, 1, -off)))
    out = Image.alpha_composite(sh, body)
    return out.resize((W, H), Image.BOX)

for S in SIZES:
    apple(S).save(f"textures/board/items/apple-{S}.png")
    print("apple", S)
