#!/usr/bin/env python3
"""
Draws the pictures for build 55's new things (four weapons, three armor sets, four spells, three snacks
and three familiars) as 12 x 12 PNGs in textures/items/, and adds their lines to textures/index.json.
Each picture is a 10 x 10 map of letters below; the dark outline is drawn around it by the tool.

    python tools/textures/more-items-art.py           # writes only the pictures that don't exist yet
    python tools/textures/more-items-art.py --force   # redraws them all (loses any repainting!)

Meant to be repainted by hand: once a file exists this tool leaves it alone.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, "textures")
FORCE = "--force" in sys.argv
OUTLINE = (26, 20, 16, 255)


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


def save(tex_id, rel, rows, pal):
    path = os.path.join(TEX, rel)
    index_add[tex_id] = rel
    if os.path.exists(path) and not FORCE:
        kept.append(rel)
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    draw(rows, pal).save(path)
    written.append(rel)


def grid(s):
    return [r for r in s.strip("\n").split("\n")]


# ----- weapons: blade from the hilt (bottom left) to the tip (top right) -----
save("ci:scimitar", "items/gear/scimitar.png", grid("""
.......ww.
......wss.
.....wssd.
.....wsd..
....wsd...
...wsd....
.g.wd.....
.ggd......
.bg.......
bb........
"""), {"w": "#f6ecc4", "s": "#e0c27a", "d": "#a8803c", "g": "#ffd23f", "b": "#7a4a22"})

save("ci:cinderwhip", "items/gear/cinderwhip.png", grid("""
.....oo...
....oyyo..
....oyo...
.....oo...
......or..
.....or...
....or....
..rrr.....
.bb.......
bb........
"""), {"o": "#ff8a2a", "y": "#ffe36a", "r": "#d9392a", "b": "#7a4a22"})

save("ci:glacierpick", "items/gear/glacierpick.png", grid("""
..iiii....
.iwwiii...
iw..iiii..
i....bii..
....bb.i..
...bb.....
..bb......
.bb.......
bb........
b.........
"""), {"i": "#7fe3ff", "w": "#f0fbff", "b": "#8a5a2e"})

save("ci:hornetlance", "items/gear/hornetlance.png", grid("""
........yy
.......yky
......ygy.
.....ygy..
....bgy...
...bb.....
..bb.g....
.bb.......
bb........
b.........
"""), {"y": "#ffd23f", "k": "#2a2418", "g": "#7fdc45", "b": "#6a4a2a"})

# ----- armor: a helmet and a body piece for each of three sets -----
CAP = """
..........
...mmmm...
..mmmmmm..
.mmllmmmm.
.mmmmmmmm.
.mmmmmmmm.
.mm....mm.
.m......m.
..........
..........
"""
VEST = """
.mm....mm.
mmmm..mmmm
mmllmmmmmm
.mmmmmmmm.
.mmmmmmmm.
.mmmmmmmm.
.mmmmmmmm.
.mddddddm.
..........
..........
"""
save("ci:mosscap", "items/gear/mosscap.png", grid("""
..........
...gggg...
..gGgGgg..
.gGgmmGgg.
.mmmmmmmm.
.mmmmmmmm.
.mm....mm.
.m......m.
..........
..........
"""), {"g": "#4f9a3a", "G": "#7bcf5a", "m": "#7a5a34"})
save("ci:mosscloak", "items/gear/mosscloak.png", grid("""
.mm....mm.
mgmm..mmgm
mGgmmmmgGm
.mmGmmmgm.
.mgmmmmmm.
.mmmmGmgm.
.mgmmmmmm.
.mmddddmm.
..........
..........
"""), {"g": "#4f9a3a", "G": "#7bcf5a", "m": "#7a5a34", "d": "#5e4228"})

save("ci:glasshood", "items/gear/glasshood.png", grid("""
..........
...wwww...
..wiiiiw..
.wiiwiiiw.
.wiiiiiiw.
.wiiiiiiw.
.wi....iw.
.w......w.
..........
..........
"""), {"w": "#f0fbff", "i": "#9ad8f0"})
save("ci:glassvest", "items/gear/glassvest.png", grid("""
.ww....ww.
wiiw..wiiw
wiwiiiiwiw
.wiiiiiiw.
.wiwiiwiw.
.wiiiiiiw.
.wiiwiiiw.
.wwwwwwww.
..........
..........
"""), {"w": "#f0fbff", "i": "#9ad8f0"})

save("ci:pilgrimhat", "items/gear/pilgrimhat.png", grid("""
.....y....
...bbyb...
..bbyybb..
.bbbbybbb.
.bbbbbbbb.
.bbbbbbbb.
.bb....bb.
.b......b.
..........
..........
"""), {"b": "#8a6a46", "y": "#ffd23f"})
save("ci:pilgrimcoat", "items/gear/pilgrimcoat.png", grid("""
.bb....bb.
bbbb..bbbb
bbbbybbbbb
.bbbyybbb.
.bbbbybbb.
.bbbyybbb.
.bbbybbbb.
.bbbbbbbb.
..........
..........
"""), {"b": "#8a6a46", "y": "#ffd23f"})

# ----- spells -----
save("ci:frostward", "items/spells/frostward.png", grid("""
....ww....
..iiiiii..
.iw....wi.
.i......i.
w........w
w........w
.i......i.
.iw....wi.
..iiiiii..
....ww....
"""), {"i": "#7fe3ff", "w": "#f0fbff"})
save("ci:thornring", "items/spells/thornring.png", grid("""
...g..g...
..gggggg..
.gg....gg.
g........g
gg......gg
g........g
.gg....gg.
..gggggg..
.g..gg..g.
..........
"""), {"g": "#3ddc84"})
save("ci:razorgust", "items/spells/razorgust.png", grid("""
..wwwww...
.wsssssw..
wss...sw..
ws....ww..
.w..wwww..
....wsssw.
...wss..sw
....wsssw.
.....www..
..........
"""), {"w": "#ffffff", "s": "#b8c8dc"})
save("ci:skipstep", "items/spells/skipstep.png", grid("""
..........
.tt.......
ttt..t....
ttt.ttt...
.t..ttt...
.....tt.t.
..t.....tt
.ttt....tt
.ttt....t.
..t.......
"""), {"t": "#46e0c0"})

# ----- snacks -----
save("ci:honeycake", "items/snacks/honeycake.png", grid("""
..........
...yyyy...
..yyhhyy..
.yhhhhhhy.
.yhYhhhYy.
.ccccccc..
.cwwwwwwc.
.cccccccc.
.cddddddc.
..........
"""), {"y": "#ffd23f", "h": "#e89a1f", "Y": "#fff0a0", "c": "#d8a05a", "w": "#fff6e0", "d": "#a8703a"})
save("ci:chili", "items/snacks/chili.png", grid("""
.....gg...
....gg....
...rrr....
..rrRrr...
.rrRrrrr..
.rrrrrrr..
.rrrrrr...
..rrrr....
...rr.....
..........
"""), {"g": "#3ddc84", "r": "#f2f2ff", "R": "#ffffff"})
save("ci:minttea", "items/snacks/minttea.png", grid("""
..g..g....
.ggggg....
..wwww....
.cccccccc.
.cttttttc.
.cttttttcc
.cttttttc.
..cttttc..
...cccc...
..........
"""), {"g": "#3ddc84", "w": "#ffffff", "c": "#e8e0d0", "t": "#7fd8a0"})

# ----- familiars -----
save("ci:hermit", "items/familiars/hermit.png", grid("""
..........
...sss....
..sSsssr..
.sSsssssrr
.ssssssss.
.sssssss..
..rr.rr...
.rr...rr..
..........
..........
"""), {"s": "#e0c890", "S": "#fff0d0", "r": "#e8503a"})
save("ci:gecko", "items/familiars/gecko.png", grid("""
..........
.gg.......
gggg..gg..
gggggggg.g
.ggGGggggg
.gggggggg.
.g.g..g.g.
.g.g..g.g.
..........
..........
"""), {"g": "#4fc84a", "G": "#9af07a"})
save("ci:moth", "items/familiars/moth.png", grid("""
..........
.ww....ww.
wwwv..vwww
wwwwvvwwww
wwwwvvwwww
.wwwvvwww.
..wwvvww..
...vvvv...
....vv....
..........
"""), {"w": "#f4e6b8", "v": "#7a5a34"})

idx_path = os.path.join(TEX, "index.json")
with open(idx_path, encoding="utf-8", newline="") as f:
    raw = f.read()
lines = raw.split(chr(10))
new = [k for k in index_add if '"' + k + '"' not in raw]
if new:
    last = max(i for i, l in enumerate(lines) if l.strip().startswith('"ci:'))
    lines[last + 1:last + 1] = ['    "' + k + '": "' + index_add[k] + '",' for k in new]
    out = chr(10).join(lines)
    json.loads(out)   # must still parse
    with open(idx_path, "w", encoding="utf-8", newline="") as f:
        f.write(out)
print("wrote %d, kept %d; index lines added: %d" % (len(written), len(kept), len(new)))
