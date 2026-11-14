#!/usr/bin/env python3
"""
Draws build 56's pictures:
  * the eighteen new enemies (textures/foes/), eight hazards (textures/hazards/), six power-ups (textures/powerups/)
  * the boss objectives' pieces and the haul goal's (textures/board/): pylon, beacon, snare, pool, pouch, drop-off
  * the flea and the popsicle, redrawn at all three board sizes (textures/board/items/)
and adds their lines to textures/index.json.

    python tools/textures/content-pass-art.py            # writes only the pictures that don't exist yet
    python tools/textures/content-pass-art.py --force    # redraws them all (loses any repainting!)

Every small picture is a 10 x 10 map of letters below; the dark outline is drawn round it by the tool, which
makes the 12 x 12 pictures every foe and icon in the game is. Meant to be repainted by hand: once a file
exists this tool leaves it alone (--force draws them again; the flea and popsicle are always redrawn with it).
"""
import json
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, "textures")
FORCE = "--force" in sys.argv
OUTLINE = (26, 20, 16, 255)


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def draw(rows, pal, outline=True):
    assert len(rows) == 10 and all(len(r) == 10 for r in rows), rows
    im = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                im.putpixel((x + 1, y + 1), hexrgb(pal[ch]))
    if not outline:
        return im
    src = im.copy()
    for y in range(12):
        for x in range(12):
            if src.getpixel((x, y))[3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < 12 and 0 <= ny < 12 and src.getpixel((nx, ny))[3]:
                    im.putpixel((x, y), OUTLINE)
                    break
    return im


written, kept, index_add = [], [], {}


def save(tex_id, rel, rows, pal, outline=True):
    path = os.path.join(TEX, rel)
    index_add[tex_id] = rel
    if os.path.exists(path) and not FORCE:
        kept.append(rel)
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    draw(rows, pal, outline).save(path)
    written.append(rel)


def grid(s):
    return [r for r in s.strip("\n").split("\n")]


def foe(name, rows, pal, folder="foes", outline=True):
    save("foe:" + name, f"{folder}/{name}.png", grid(rows), pal, outline)


# ---------------------------------------------------------------- enemies ----
HOUND = """
..........
......dd..
b....dbbb.
bb..bbbbbe
.bbbbbbbbn
.bbbbbbbb.
.bbbbbbbb.
.bb.bb.bb.
.bd.bd.bd.
..........
"""
foe("hound", HOUND, {"b": "#c9a066", "d": "#8a6234", "e": "#1a1410", "n": "#2a1a10"})
foe("emberhound", HOUND.replace("..........", "....y.y...", 1), {"b": "#ff8a3a", "d": "#a8301a", "e": "#fff0a0", "n": "#2a1a10", "y": "#ffd23f"})
foe("crow", """
..........
...kkk....
..kkkkk...
..kwkkkkk.
yyykgkkkkk
..kkkgkkk.
...kkkkkk.
....kkkk..
.....o.o..
..........
""", {"k": "#2e2e3a", "g": "#5a5a6c", "w": "#ffffff", "y": "#ffb020", "o": "#c8761a"})
foe("warden", """
....r.....
...GGGG..s
..GGGGGG.s
..GdddGG.s
..GGGGGG.s
.GgGGGGgG.
.ggbbbbgg.
..gg..gg..
..bb..bb..
.bbb..bbb.
""", {"G": "#d0d6e0", "g": "#8a92a4", "d": "#2e323e", "b": "#7a5a34", "r": "#e0262e", "s": "#c8a45a"})
foe("reflection", """
....pp....
...pwwp...
..pwwwwp..
.pwwewewp.
.pwwwwwwp.
..pwwmwp..
...pwwp...
....pp....
...p..p...
..p....p..
""", {"p": "#b9a8ff", "w": "#efeaff", "e": "#2a1a4a", "m": "#8a6ad8"})
foe("gargoyle", """
.g......g.
.gg....gg.
.gggggggg.
..grggrg..
..gggggg..
.gghgghgg.
gg.gggg.gg
g..gggg..g
...g..g...
..gg..gg..
""", {"g": "#9aa0ac", "h": "#6a707c", "r": "#ff5a4a"})
foe("orb", """
..........
...cccc...
..cwwccc..
.cwwcccbc.
.cwccccbc.
.cccccbbc.
.ccccbbbc.
..cbbbbc..
...cccc...
..c....c..
""", {"c": "#7fe3ff", "w": "#ffffff", "b": "#3a82e0"})
foe("galesprite", """
..........
...wwww...
.wwwwwwww.
wwweewewww
wwwwwwwwww
wwwwmmwwww
.bwwwwwwb.
..bbwwbb..
.b.bbbb.b.
b...bb...b
""", {"w": "#f2faff", "b": "#9ad8ff", "e": "#3a5a8a", "m": "#5a7aaa"})
foe("gnasher", """
..tttttt..
.tttttttt.
.ttetteTt.
.tttttttt.
.tmmmmmmt.
.tmwmwmwt.
.tmmmmmmt.
.dddddddd.
dddddddddd
ddddd.dddd
""", {"t": "#b8864a", "T": "#b8864a", "e": "#1a1410", "m": "#8a1a1a", "w": "#fff4d8", "d": "#6b4a2a"})
foe("locust", """
..........
.w.....w..
ww.gggg.w.
.wggggggw.
..gpggpg..
.ggggggggg
..gdgdgg..
.l.l..l.l.
l.l....l.l
..........
""", {"g": "#9acd32", "d": "#5a8a1a", "p": "#1a1410", "w": "#d8f0c0", "l": "#4a6a1a"})
foe("boar", """
..b....b..
.bbb..bbb.
.bbbbbbbb.
bbbebbebbb
bbbbbbbbbb
.bbpppppb.
.bbpnppnb.
.bwppppwb.
..wb..bw..
..........
""", {"b": "#8a6a56", "e": "#1a1410", "p": "#e0a8a0", "n": "#6a3a3a", "w": "#fff4e0"})
foe("angler", """
....yy....
...y..y...
...y......
.bbbbbbb..
bbwbbbbbb.
bkbbbbbbbf
bwbwbwbbbf
.bbbbbbbb.
..bbbbbb..
..........
""", {"b": "#4a6ab8", "w": "#ffffff", "k": "#1a1410", "y": "#ffe86a", "f": "#2a3a78"})
foe("squid", """
...pppp...
..pppppp..
.pppwppwp.
.pppppppp.
..pppppp..
.p.p..pkp.
.p.p..kkk.
..p.pp.kky
.pp.p..p..
..........
""", {"p": "#c860a8", "w": "#ffffff", "k": "#2a2a30", "y": "#ffd23f"})
foe("flyingfish", """
..........
.....ww...
....wbbw..
.bbbbbbbbb
bbbbbbbbbe
bbbwwbbbb.
.bbbbbbbb.
..bb..bb..
..........
..........
""", {"b": "#4ab8e8", "w": "#e8fbff", "e": "#1a1410"})
foe("shark", """
.....g....
....gg....
...gggg...
.ggggggggg
ggwggggggg
gggggggggg
.wwwwwwwww
..wkwkwk..
..........
..........
""", {"g": "#7a8a9c", "w": "#e8eef4", "k": "#8a1a1a"})
foe("golem", """
..rrrrrr..
.rrrrrrrr.
.rkkrrkkr.
.rrrrrrrr.
rrrlrrlrrr
rrlrrrrlrr
.rrrllrrr.
.rrr..rrr.
.rrr..rrr.
.rrr..rrr.
""", {"r": "#6a463c", "k": "#ffd23f", "l": "#ff8a2a"})
foe("cinderknight", """
....rr....
...rrrr...
..rrrrrrr.
.rrrwrrrrr
rrrrrrrrr.
rrrrrrrrr.
.rrrrrrr..
..rrrrr...
.yrrrrrr..
yyrrrrrrr.
""", {"r": "#e8503a", "w": "#fff0a0", "y": "#ffd23f"})
foe("blastimp", """
.r......r.
.rr....rr.
..rrrrrr..
.rrwrrwrr.
.rrrrrrrr.
..rmmmmr..
.rrrrrrrr.
r.rrrrrr.k
..k...ky.k
.........k
""", {"r": "#e03a2a", "w": "#fff0a0", "m": "#5a0a0a", "k": "#2a2a30", "y": "#ffd23f"})

# ---------------------------------------------------------------- hazards ----
PAL_STONE = {"g": "#8a8f9a", "G": "#b8bec8", "k": "#2e3038", "y": "#ffd23f", "d": "#5a5f6a"}
foe("turret", """
..........
.gggggg...
.gGGGGgg..
.gGkkkkkky
.gGkkkkkkk
.gGGGGgg..
.gggggg...
.dddddd...
..........
..........
""", PAL_STONE, "hazards")
foe("cannon", """
..........
..bbbb....
.bbbbbb...
.bbGGbbkkk
.bbGGbbkkk
.bbbbbb...
..bbbb....
..........
..........
..........
""", {"b": "#3e4250", "G": "#8a90a0", "k": "#22242c"}, "hazards")
foe("geyser", """
...c..c...
..........
.....c....
..gggggg..
.ggkkkkgg.
ggkkccckgg
ggkkkkkkgg
.gggggggg.
..........
..........
""", {"g": "#8a7a6a", "k": "#2a2420", "c": "#bfe8ff"}, "hazards")
foe("conveyor", """
gggggggggg
gddddddddg
gdydddyddg
gddydddydg
gdddydddyg
gddydddydg
gdydddyddg
gddddddddg
gggggggggg
kkkkkkkkkk
""", {"g": "#a0a6b0", "d": "#4a4e58", "y": "#ffe08a", "k": "#2a2c34"}, "hazards", outline=False)
foe("blade", """
...w..w...
..gGGGGg..
.gGGkkGGg.
wGGkyykGGw
wGGkyykGGw
.gGGkkGGg.
..gGGGGg..
...w..w...
..........
..........
""", {"g": "#8a929e", "G": "#d0d8e2", "k": "#3a3e48", "y": "#ffd23f", "w": "#f4f8ff"}, "hazards")
foe("mine", """
..........
...k..k...
..kkkkkk..
.kkkrrkkk.
.kkkrrkkk.
..kkkkkk..
...k..k...
..........
..........
..........
""", {"k": "#4a4e5a", "r": "#ff3a3a"}, "hazards")
foe("tar", """
.kkkkkkkk.
kkkkkkkkkk
kkpkkkkkkk
kkkkkkpkkk
kkkkkkkkkk
kpkkkkkkkk
kkkkkkkpkk
kkkkkkkkkk
.kkkkkkkk.
..........
""", {"k": "#2a2430", "p": "#6a5a8a"}, "hazards", outline=False)
foe("crumble", """
gggggggggg
gGGGGGGGGg
gGdGGGGGGg
gGGdGGdGGg
gGGGdGGdGg
gGGdGGGdGg
gGdGGGGGGg
gGGGGGGGGg
gggggggggg
dddddddddd
""", {"g": "#8a7a62", "G": "#b8a888", "d": "#4a3a26"}, "hazards", outline=False)

# -------------------------------------------------------------- power-ups ----
foe("sprout", """
..g..g....
.ggggggg..
..gggwgg..
...gb.....
...bb.....
.nnnnnnn..
.nrrrrrn..
..nrrrn...
..nnnnn...
..........
""", {"g": "#5ac83a", "w": "#c8f8a0", "b": "#3a8a2a", "n": "#c8761a", "r": "#8a5a2a"}, "powerups")
foe("shrink", """
...kk.....
...cc.....
..gccg....
..gppg....
.gpppog...
.gpppppg..
.gppwppg..
.gpppppg..
..gggggg..
..........
""", {"k": "#8a5a2a", "c": "#c8a070", "g": "#d8e4ff", "p": "#a060e0", "o": "#ffffff", "w": "#e0c0ff"}, "powerups")
foe("boots", """
..bbbb....
..bbbb....
..bBBb....
..bbbb....
..bbbbbbb.
.bbbbbbbbb
.bsssssssb
..........
..........
..........
""", {"b": "#b8743a", "B": "#e0a060", "s": "#6a4a2a"}, "powerups")
foe("lantern", """
...yy.....
..yyyy....
..hhhh....
.hyyyyh...
.hywwyh...
.hywwyh...
.hyyyyh...
.hhhhhh...
..hhhh....
..........
""", {"y": "#ffd860", "w": "#fff8c8", "h": "#6a5a4a"}, "powerups")
foe("bell", """
....yy....
...yyyy...
..yyYYyy..
..yyYyyy..
.yyyYyyyy.
.yyyyyyyy.
yyyyyyyyyy
yoooooooyy
...oo.....
..........
""", {"y": "#ffc82a", "Y": "#fff0a0", "o": "#c8861a"}, "powerups")
foe("anchor", """
....gg....
...g..g...
....gg....
.gggggggg.
....gg....
....gg....
g...gg...g
gg..gg..gg
.gggggggg.
..gggggg..
""", {"g": "#a8bcd4"}, "powerups")


# the popsicle's small icon (menus, the item guide), to match the new cone
save("popsicle", "icons/popsicle.png", grid("""
.....w....
....wbb...
....wbb...
...wbbbb..
...wbbbb..
..wbbbBbb.
..wbBBBBb.
..wBBBBBB.
.....s....
.....s....
"""), {"w": "#e8f6ff", "b": "#5aa8f0", "B": "#2f6ad8", "s": "#d8a860"})

# ---------------------------------------------------- board pieces (12 x 12) ----
def board(name, rows, pal, outline=True):
    save("board:" + name, f"board/{name}.png", grid(rows), pal, outline)


board("pylon", """
....cc....
...cCCc...
...cCCc...
..cCCCCc..
..cCCCCc..
..cCCCCc..
...cCCc...
..bbbbbb..
.bbbbbbbb.
..........
""", {"c": "#6a5a9a", "C": "#9a8ac8", "b": "#5a5f6a"})
board("pylon-on", """
....ww....
...wWWw...
...wWWw...
..wWWWWw..
..wWWWWw..
..wWWWWw..
...wWWw...
..bbbbbb..
.bbbbbbbb.
..........
""", {"w": "#e8d8ff", "W": "#b98cff", "b": "#5a5f6a"})
board("beacon", """
..........
...hhhh...
..hhhhhh..
..hkkkkh..
..hkkkkh..
...hhhh...
....hh....
...hhhh...
..hhhhhh..
..........
""", {"h": "#7a7f8a", "k": "#2e3038"})
board("beacon-on", """
....y.....
...yYy....
..yYYYy...
..hYYYh...
..hyYyh...
...hhhh...
....hh....
...hhhh...
..hhhhhh..
..........
""", {"h": "#8a8f9a", "y": "#ff9a3a", "Y": "#ffe08a"})
board("snare", """
..........
.w.w.w.w..
..wwwwww..
.wwkwwkww.
.wwwwwwww.
.wwkwwkww.
..wwwwww..
.w.w.w.w..
..........
..........
""", {"w": "#d8d0b8", "k": "#6a5a3a"}, False)
board("pool", """
..........
..bbbbbb..
.bBBbbbbb.
bBwBbbbbbb
bbBbbbbbbb
bbbbbbbbBb
bbbbbbBwBb
.bbbbbbBb.
..bbbbbb..
..........
""", {"b": "#3a82e0", "B": "#7fc0ff", "w": "#e8f6ff"}, False)
board("pouch", """
...hh.....
..hhhh....
...ss.....
..ssss....
.sssssss..
.sssGsss..
.ssGGGss..
.sssGsss..
..ssssss..
..........
""", {"s": "#b8864a", "h": "#8a5a2a", "G": "#ffd23f"})
board("dropoff", """
..........
..rrrrr...
..rRRRr...
..rRRRr...
..rrrrr...
..bbbbb...
.bbbbbbb..
.bywywyb..
.bbbbbbb..
..........
""", {"r": "#c0261e", "R": "#ff6a5a", "b": "#8a5a2a", "y": "#ffd23f", "w": "#fff0a0"})


# ----------------------------------------------- the flea and the popsicle ----
def new_img(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def outline_img(im):
    src = im.copy()
    px = src.load()
    out = im.copy()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < im.width and 0 <= ny < im.height and px[nx, ny][3]:
                    out.putpixel((x, y), OUTLINE)
                    break
    return out


def put_item(tex_id, rel, im):
    path = os.path.join(TEX, rel)
    index_add[tex_id] = {"file": rel, "anchor": [0, 0]}
    if os.path.exists(path) and not FORCE:
        kept.append(rel)
        return
    im.save(path)
    written.append(rel)


FLEA = grid("""
...............
...............
.........a.a...
..........aa...
....bbbbbhhhh..
..bbbbbbbbhhWh.
.bbbBbbBbbbhhh.
.bBbbBbbBbbbhh.
.bbbbbbbbbbbb..
..bbbbbbbbbb...
...bbbbbbbb....
..l..l..l.l....
.l..l...l..l...
l..l.....l..l..
...............
""")


def flea_img(size):
    """A flea: a narrow brown body, a small head with a pale eye, feelers, and legs that jump."""
    pal = {"h": "#8a5a34", "b": "#5a3418", "B": "#8a5a34", "a": "#d8a86a", "l": "#d8a86a", "w": "#fff4d8", "W": "#fff4d8"}
    base = new_img(15, 15)
    rows = FLEA[:15]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row[:15]):
            if ch != ".":
                base.putpixel((x, y), hexrgb(pal[ch]))
    base = outline_img(base)   # 15 + outline: draw into a 17 box
    if size == 19:
        im = new_img(19, 19)
        im.alpha_composite(base.crop((0, 0, 15, 15)), (2, 3))
        return im
    if size == 39:
        big = base.crop((0, 0, 15, 15)).resize((30, 30), Image.NEAREST)
        im = new_img(39, 39)
        im.alpha_composite(outline_img(big.copy()) if False else big, (4, 6))
        return im
    # 9: a few pixels
    im = new_img(9, 9)
    p = {"h": "#8a5a34", "b": "#5a3418", "a": "#d8a86a"}
    pts = {"o": [(1, 3), (2, 2), (3, 2), (5, 2), (6, 1), (7, 2), (8, 3), (8, 5), (7, 6), (1, 5), (2, 6), (4, 7), (6, 7)],
           "b": [(2, 3), (3, 3), (2, 4), (3, 4), (4, 4), (5, 4), (2, 5), (3, 5), (4, 5), (5, 5), (6, 5)],
           "h": [(4, 3), (5, 3), (6, 3), (7, 3), (6, 4), (7, 4), (7, 5), (6, 2), (7, 2)],
           "a": [(3, 6), (5, 6), (7, 6), (1, 4), (6, 1)]}
    for k, lst in pts.items():
        for (x, y) in lst:
            im.putpixel((x, y), OUTLINE if k == "o" else hexrgb(p[k]))
    return im


def pop_img(w, h_cone, h_stick, scale=1):
    """A popsicle: a cone-shaped ice pop (a point on top, widest at the bottom, rounded there), banded in three
    blues with a bright stripe down the left, on a wooden stick that pokes into the square below."""
    H = h_cone + h_stick
    im = new_img(w, H)
    px = im.load()
    cx = (w - 1) / 2
    for y in range(h_cone):
        t = y / max(1, h_cone - 1)                 # 0 at the point, 1 at the base
        half = 1.0 + (w / 2 - 1.0) * (t ** 0.85)
        # round off the base
        if y >= h_cone - max(2, h_cone // 6):
            k = y - (h_cone - max(2, h_cone // 6))
            half -= (k + 1) * (0.9 if scale == 1 else 1.4)
        for x in range(w):
            if abs(x - cx) <= half - 0.01:
                band = 0 if t < 0.34 else 1 if t < 0.68 else 2
                col = ["#bfe4ff", "#5aa8f0", "#2f6ad8"][band]
                if x - cx < -half + (1.6 if scale == 1 else 3.2) and t > 0.1:
                    col = ["#f2faff", "#a8d8ff", "#6aa0ec"][band]          # the shine down the left
                if x - cx > half - (1.4 if scale == 1 else 2.6):
                    col = ["#8ac4f4", "#3a78d0", "#1f44a8"][band]          # the shaded side
                px[x, y] = hexrgb(col)
    sw = 3 if scale == 1 else 7
    for y in range(h_cone - 1, H):
        for x in range(int(cx - sw / 2 + 0.5), int(cx + sw / 2 + 0.5)):
            if 0 <= x < w:
                px[x, y] = hexrgb("#e0b878" if x < cx else "#c89858")
    # drips of melt at the base
    return im


def popsicle(size):
    if size == 19:
        return outline_img(pop_img(17, 17, 8)), (17 + 2, 26)
    if size == 39:
        return outline_img(pop_img(37, 38, 13, 2)), (37 + 2, 51)
    return outline_img(pop_img(7, 7, 5)), (9, 14)


for size in (9, 19, 39):
    f = flea_img(size)
    put_item(f"item:flea:{size}", f"board/items/flea-{size}.png", f)
    p, (pw, ph) = popsicle(size)
    canvas = new_img(size, max(ph, p.height))
    canvas.alpha_composite(p, ((size - p.width) // 2, 0))
    put_item(f"item:popsicle:{size}", f"board/items/popsicle-{size}.png", canvas.crop((0, 0, size, canvas.height)))

# ------------------------------------------------------------------ index ----
def update_index():
    path = os.path.join(TEX, "index.json")
    raw = open(path, encoding="utf-8", newline="").read()
    lines = raw.split("\n")

    def fmt(k, v):
        return '    "' + k + '": ' + (json.dumps(v) if isinstance(v, dict) else '"' + v + '"')

    pos = {}
    for i, ln in enumerate(lines):
        t = ln.strip()
        if t.startswith('"') and '":' in t:
            pos[t[1:t.index('":')]] = i
    add, changed = [], 0
    for k, v in index_add.items():
        if k in pos:
            i = pos[k]
            new_line = fmt(k, v) + ("," if lines[i].rstrip().endswith(",") else "")
            if lines[i] != new_line:
                lines[i] = new_line
                changed += 1
        else:
            add.append(fmt(k, v))
    if add:
        last = max(i for i, ln in enumerate(lines) if ln.strip().startswith('"foe:'))
        lines[last + 1:last + 1] = [a + "," for a in add]
        changed += len(add)
    out = "\n".join(lines)
    json.loads(out)          # must still parse
    if changed:
        open(path, "w", encoding="utf-8", newline="").write(out)
    return changed


n = update_index()
print(f"wrote {len(written)}, kept {len(kept)}, index lines {n}")
