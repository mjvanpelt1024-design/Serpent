#!/usr/bin/env python3
"""
Draws the pictures for build 56's new things (tools/add-items-56.py): six weapons, eight armor pieces, six spells,
four snacks, six familiars and six runes, as 12 x 12 PNGs in textures/items/, and adds their lines to
textures/index.json. Each picture is a 10 x 10 map of letters below with the dark outline drawn round it by the tool;
the runes are carved on the Rune of Plenty's eight stones, like build 52's.

    python tools/textures/items56-art.py           # writes only the pictures that don't exist yet
    python tools/textures/items56-art.py --force   # redraws them all (loses any repainting!)
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, "textures")
FORCE = "--force" in sys.argv
OUTLINE = (26, 20, 16, 255)
NL = chr(10)
CR = chr(13)


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def draw(rows, pal):
    assert len(rows) == 10 and all(len(r) == 10 for r in rows), rows
    im = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                im.putpixel((x + 1, y + 1), hexrgb(pal[ch]))
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


def save_im(tex_id, rel, im):
    path = os.path.join(TEX, rel)
    index_add[tex_id] = rel
    if os.path.exists(path) and not FORCE:
        kept.append(rel)
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)
    written.append(rel)
    return True


def item(folder, name, rows, pal):
    save_im("ci:" + name, f"items/{folder}/{name}.png", draw([r for r in rows.strip(NL).split(NL)], pal))


BLADE = {"w": "#f4f4f8", "s": "#c8ced6", "d": "#8a92a4", "g": "#d9b44a", "b": "#7a4a22"}
# ----------------------------------------------------------------------------- weapons
item("gear", "cutlass", """
.......ww.
......wss.
.....wssd.
....wssd..
...wssd...
.g.wsd....
.ggd......
.bg.......
bb........
..........
""", BLADE)
item("gear", "gatehalberd", """
....w.....
...www.s..
....wssss.
..w.bsssd.
....b.sd..
....b.....
....b.....
....b.....
....g.....
....g.....
""", BLADE)
item("gear", "tidetrident", """
.w..w..w..
.w..w..w..
.w..w..w..
.ww.w.ww..
..wwwww...
....w.....
....b.....
....b.....
....b.....
....b.....
""", {"w": "#9fe8ff", "b": "#7a4a22"})
item("gear", "scythe", """
..wwww....
.wsssww...
wss..sww..
ws....sw..
......b.w.
......b...
.....b....
.....b....
....b.....
....b.....
""", {"w": "#d8f0c0", "s": "#7acd5a", "b": "#7a4a22"})
item("gear", "arcrapier", """
.........w
........w.
.......w..
......w...
.....w....
..g.w.....
...gg.....
..b.g.....
.b........
b.........
""", {"w": "#bfe8ff", "g": "#d9b44a", "b": "#7a4a22"})
item("gear", "cleaver", """
...rrrrr..
..rrYYYrr.
.rrYYYYYr.
.rrrYYYrr.
..rrrrrd..
...bd.....
..bb......
.bb.......
bb........
..........
""", {"r": "#8a2a1a", "Y": "#ff9a2a", "d": "#5a1a0a", "b": "#5a4a3a"})

# ----------------------------------------------------------------------------- armor
TIDE = {"f": "#5ac8e8", "h": "#3aa8a0", "H": "#7fd8c8", "d": "#1f6a68"}
item("gear", "shellhelm", """
....ff....
...hhhh...
..hhHHhh..
.hhHhhhhh.
.hhhhhhhh.
.hdddddhh.
.hd....dh.
.hd....dh.
..........
..........
""", TIDE)
BODY = """
hh......hh
hhhhhhhhhh
.hhHHHHhh.
.hhHhhHhh.
.hhhhhhhh.
.hdddddhh.
.hhhhhhhh.
.hhhhhhhh.
..hh..hh..
..........
"""
item("gear", "tidecoat", BODY, TIDE)
OBS = {"x": "#3a3a46", "h": "#46465a", "H": "#7a7a96", "d": "#1a1a22", "r": "#ff7a2a"}
item("gear", "obsidianhelm", """
.x......x.
.xx....xx.
..hhhhhh..
.hhHHhhhh.
.hhhhhhhh.
.hdddddhh.
.hd.rr.dh.
.hd....dh.
..........
..........
""", OBS)
item("gear", "obsidianplate", BODY.replace(".hhHHHHhh.", ".hrHHHHrh."), OBS)
RUNE = {"h": "#7a4ad0", "H": "#b98cff", "d": "#3a1a6a", "g": "#ffe08a"}
item("gear", "runehood", """
....hh....
...hhhh...
..hhHHhh..
.hhHhhhhh.
.hhdddhhh.
.hhd..dhh.
.hhd.g.dh.
.hh....hh.
..........
..........
""", RUNE)
item("gear", "runerobe", BODY.replace(".hhhhhhhh.\n.hdddddhh.", ".hhghgghh.\n.hdddddhh.").replace("..hh..hh..", ".hhh..hhh."), RUNE)
GLEAN = {"h": "#d8b868", "H": "#f0dc98", "r": "#c0261e", "d": "#8a6a34"}
item("gear", "gleanerhat", """
..........
....hh....
...hhhh...
..hhrrhh..
.hhhhhhhh.
hhHhHhHhHh
hhhhhhhhhh
..........
..........
..........
""", GLEAN)
item("gear", "gleanersack", BODY.replace(".hdddddhh.", ".hdHHHdhh."), GLEAN)

# ----------------------------------------------------------------------------- spells
item("spells", "tidalsurge", """
..........
.....www..
....wBBBw.
..wwBBbBBw
.wBBBbbBBw
wBBbbbbbBB
wbbbbbbbbb
.bbbbbbbbw
..wwwwww..
..........
""", {"w": "#e8f8ff", "B": "#7fc0ff", "b": "#3a82e0"})
item("spells", "emberrain", """
.y....y...
yoy..yoy..
.o....o...
...y......
..yoy..y..
...o..yoy.
.......o..
..........
..........
..........
""", {"y": "#ffd23f", "o": "#ff6a1a"})
item("spells", "shadowstep", """
..........
.pp.......
pppp......
pppp..pp..
.pp..pppp.
.pp..pppp.
......pp..
.k...pp...
..k.......
..........
""", {"p": "#9a6ad0", "k": "#5a3a8a"})
item("spells", "stormaegis", """
.sssssss..
.sBBBBBs..
.sByBBBs..
.sBByyBs..
.sByyBBs..
..sBByBs..
..sBBBs...
...sBs....
....s.....
..........
""", {"s": "#8a92a4", "B": "#4a5a8a", "y": "#ffe86a"})
item("spells", "harvestcall", """
....g.....
...gg.....
.rrrrrr.c.
rrRrrrrr..
rrrrrrrrc.
rrrrrrrr..
.rrrrrr.c.
..rr.rr...
..........
..........
""", {"g": "#3aa83a", "r": "#e0262e", "R": "#ff8a8a", "c": "#7fe3ff"})
item("spells", "hexbolt", """
.....g....
....gg....
...ggG....
..ggGg....
.ggGGggg..
..gggGg...
.....gG...
.....g....
....g.....
...g......
""", {"g": "#5ac83a", "G": "#d8ffb0"})

# ----------------------------------------------------------------------------- snacks
item("snacks", "harvestpie", """
..........
..cccccc..
.cYccYccc.
cccYcccYcc
cddddddddc
.dkdkdkdd.
..dddddd..
..........
..........
..........
""", {"c": "#d8a860", "Y": "#f0d090", "d": "#a8641e", "k": "#6a3a10"})
item("snacks", "smokedfish", """
..........
..bbbb..f.
.bbbbbbbff
bbwbbbbbf.
.bbbbbbbff
..bbbb..f.
..........
..........
..........
..........
""", {"b": "#b8743a", "w": "#fff4d8", "f": "#8a5a2a"})
item("snacks", "beebalm", """
..........
..gggggg..
..hhhhhh..
.hyyyyyyh.
.hyYyyYyh.
.hyyyyyyh.
.hhhhhhhh.
..........
..........
..........
""", {"g": "#c8d0d8", "h": "#8a5a2a", "y": "#ffc82a", "Y": "#fff0a0"})
item("snacks", "crunchbar", """
..........
.rrrrrrrr.
rbbbbbbbbr
rbYYbbYYbr
rbbbbbbbbr
.rrrrrrrr.
..........
..........
..........
..........
""", {"r": "#c0261e", "b": "#8a5a2a", "Y": "#ffd23f"})

# ----------------------------------------------------------------------------- familiars
item("familiars", "ferret", """
..........
.......cc.
......cmmc
.ccccccccn
cccccccccc
.cccccccc.
.c.c..c.c.
.c.c..c.c.
..........
..........
""", {"c": "#e8d4a8", "m": "#5a3a2a", "n": "#e0a0a0"})
item("familiars", "raven", """
..........
....kkk...
...kkkkk..
..kkwkkyy.
..kkkkkk..
...kkkkk..
....kkk...
....o.o...
..........
..........
""", {"k": "#2e2e3a", "w": "#ffffff", "y": "#ffb020", "o": "#c8761a"})
item("familiars", "digger", """
..........
..bbbbbb..
.bbbbbbbb.
.bbebbebb.
.bbbppbbb.
.bbbppbbb.
.bbbbbbbb.
.cc.bb.cc.
..........
..........
""", {"b": "#6a5a4a", "e": "#1a1410", "p": "#e0a0a0", "c": "#f0e0c0"})
item("familiars", "axolotl", """
..........
p.p....p.p
pp.pppp.pp
.pppppppp.
.pwpppwpp.
.pppmpppp.
..pppppp..
.pp.pp.pp.
..........
..........
""", {"p": "#f0a8c8", "w": "#1a1410", "m": "#c0607a"})
item("familiars", "bat", """
..........
k..k..k..k
kk.kkkk.kk
kkkkkkkkkk
.kkkwkwkk.
..kkkkkk..
...k..k...
..........
..........
..........
""", {"k": "#4a3a6a", "w": "#ffe86a"})
item("familiars", "pup", """
..........
..dd..dd..
.dddddddd.
.dbbbbbbd.
.dbebbebd.
.bbbnnbbb.
..bbbbbb..
..bb..bb..
..........
..........
""", {"d": "#8a5a2a", "b": "#d8a868", "e": "#1a1410", "n": "#3a2a2a"})

# ----------------------------------------------------------------------------- runes: carved on Plenty's stones
GLYPHS = {
    "mending": ["..#..", "..#..", "#####", "..#..", "..#..", ".#.#.", "..#.."],
    "anvil": ["#####", ".###.", "..#..", "..#..", ".###.", "#####", "....."],
    "thorn": ["#...#", ".#.#.", "..#..", ".###.", "..#..", ".#.#.", "#...#"],
    "tide": ["#..#.", ".#..#", "#..#.", ".#..#", "#..#.", ".#..#", "....."],
    "scholar": [".###.", "#...#", "#.#.#", "#...#", ".###.", "..#..", "....."],
    "hunt": ["..#..", "..#..", ".###.", "#.#.#", "..#..", "..#..", "..#.."],
}
CONDITIONS = ["broken", "refurbished", "cracked", "repaired", "fine", "polished", "pristine", "legendary"]
STONE = {(0x9a, 0xa3, 0xad), (0x5b, 0x64, 0x70), (0xd8, 0xdd, 0xe6), (0xff, 0xff, 0xff)}
items = json.load(open(os.path.join(ROOT, "content", "campaign", "items.json"), encoding="utf-8"))["items"]
color = {i["id"]: i["color"] for i in items if i["family"] == "rune"}
for rid, glyph in GLYPHS.items():
    col = hexrgb(color[rid])
    for cond in CONDITIONS:
        im = Image.open(os.path.join(TEX, "items", "runes", cond, "plenty.png")).convert("RGBA")
        for y in range(12):
            for x in range(12):
                r, g, b, a = im.getpixel((x, y))
                if a and g > r + 40 and g > b + 40:
                    im.putpixel((x, y), hexrgb("#9aa3ad"))
        for gy, row in enumerate(glyph):
            for gx, ch in enumerate(row):
                if ch == "#":
                    x, y = 3 + gx, 2 + gy
                    r, g, b, a = im.getpixel((x, y))
                    if a and (r, g, b) in STONE:
                        im.putpixel((x, y), col)
        save_im(f"ci:{rid}:{cond}", f"items/runes/{cond}/{rid}.png", im)
    index_add[f"ci:{rid}"] = f"items/runes/fine/{rid}.png"

# ----------------------------------------------------------------------------- index
path = os.path.join(TEX, "index.json")
raw = open(path, encoding="utf-8", newline="").read()
crlf = CR + NL in raw
lines = raw.replace(CR + NL, NL).split(NL)
have = {l.strip().split('"')[1] for l in lines if l.strip().startswith('"') and '":' in l}
new = [k for k in index_add if k not in have]
if new:
    last = max(i for i, l in enumerate(lines) if l.strip().startswith('"ci:'))
    lines[last + 1:last + 1] = ['    "' + k + '": "' + index_add[k] + '",' for k in new]
    out = NL.join(lines)
    json.loads(out)
    open(path, "w", encoding="utf-8", newline="").write(out.replace(NL, CR + NL) if crlf else out)
print("wrote %d, kept %d; index lines added: %d" % (len(written), len(kept), len(new)))
