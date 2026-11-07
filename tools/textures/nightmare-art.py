#!/usr/bin/env python3
"""
Build 53: the first pictures for nightmare mode, in textures/, and their lines in textures/index.json.

  - each nightmare item (content/campaign/nightmare.json "items") is its "look" item's picture
    (every rune condition too), recolored into the deep's palette: textures/items/nightmare/
  - the Maw's sticker and poster face: textures/icons/stickers/maw.png ("sticker:maw")

    python tools/textures/nightmare-art.py           # writes only the pictures that don't exist yet
    python tools/textures/nightmare-art.py --force   # redraws them all (loses any repainting!)

Meant to be repainted by hand: once a file exists this tool leaves it alone.
"""
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, "textures")
FORCE = "--force" in sys.argv

# dark violet, through crimson, to bone: the deep's colors, dark to light
DEEP = [(26, 8, 30), (58, 16, 56), (96, 22, 70), (140, 30, 76), (192, 62, 92), (232, 138, 150), (246, 224, 220)]


def deep(rgb):
    r, g, b = rgb
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    if lum < 0.13:
        return rgb                      # the outline stays
    k = min(len(DEEP) - 1.001, lum * (len(DEEP) - 1) * 1.08)
    i = int(k)
    t = k - i
    a, b2 = DEEP[i], DEEP[min(i + 1, len(DEEP) - 1)]
    return tuple(round(a[j] + (b2[j] - a[j]) * t) for j in range(3))


def recolor(src, dst):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = deep((r, g, b)) + (a,)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst)


K = "#1a1410"
MAW = [
    "...kkkkkk...",
    "..kppppppk..",
    ".kpprrrrppk.",
    "kprwkrrkwrpk",
    "kpwwwrrwwwpk",
    "kpkkkkkkkkpk",
    "kpkddddddkpk",
    "kpkwkddkwkpk",
    "kprwwkkwwrpk",
    ".kprrrrrrpk.",
    "..kppppppk..",
    "...kkkkkk...",
]
MAW_PAL = {"p": "#5a1450", "r": "#c03e5c", "w": "#f6e0dc", "d": "#2a0a12", "k": K}


def draw(rows, pal, dst):
    im = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            h = pal[ch].lstrip("#")
            im.putpixel((x, y), tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst)


def main():
    index_path = os.path.join(TEX, "index.json")
    with open(index_path, encoding="utf-8") as f:
        text = f.read()
    textures = json.loads(text)["textures"]
    with open(os.path.join(ROOT, "content", "campaign", "nightmare.json"), encoding="utf-8") as f:
        nm = json.load(f)
    add, written = {}, 0
    for it in nm["items"]:
        look = it["look"]
        for key, val in textures.items():
            m = re.fullmatch(r"ci:" + re.escape(look) + r"(:[a-z]+)?", key)
            if not m:
                continue
            src_rel = val if isinstance(val, str) else val["file"]
            sub = os.path.basename(os.path.dirname(src_rel)) if it["family"] == "rune" else ""
            rel = "/".join(p for p in ["items", "nightmare", sub, it["id"] + ".png"] if p)
            dst = os.path.join(TEX, rel)
            if FORCE or not os.path.exists(dst):
                recolor(os.path.join(TEX, src_rel), dst)
                written += 1
            new_key = "ci:" + it["id"] + (m.group(1) or "")
            add[new_key] = rel if isinstance(val, str) else dict(val, file=rel)
    maw = os.path.join(TEX, "icons", "stickers", "maw.png")
    if FORCE or not os.path.exists(maw):
        draw(MAW, MAW_PAL, maw)
        written += 1
    add["sticker:maw"] = "icons/stickers/maw.png"
    # the new lines go in at the end, written the way textures.mjs writes them
    new = {k: v for k, v in add.items() if k not in textures}
    if new:
        def line(v):
            if isinstance(v, str):
                return json.dumps(v)
            return "{ " + ", ".join(f"{json.dumps(k)}: {json.dumps(x).replace(', ', ',').replace(',', ', ')}" for k, x in v.items()) + " }"
        body = ",\n".join(f"    {json.dumps(k)}: {line(v)}" for k, v in new.items())
        cut = text.rstrip().rfind("}", 0, len(text.rstrip()) - 1)       # the textures object's closing brace
        head = text[:cut].rstrip()
        text = head + ",\n" + body + "\n  }\n}\n"
        with open(index_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
    print(f"wrote {written} pictures; index.json: {len(new)} new lines")


if __name__ == "__main__":
    main()
