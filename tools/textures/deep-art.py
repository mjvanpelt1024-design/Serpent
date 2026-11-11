#!/usr/bin/env python3
"""
The tunnels under the islands (nightmare mode, src/ui/map-deep.js) and the roots screen
(src/campaign/camp-roots.js): the little pictures that dress each island's underground in its
own stuff, at the map's own size (one picture pixel = one map pixel). Written to
textures/map/deep/, with their lines in textures/index.json ("deep:<name>").

  crown   the Cinder Gullet: lava pools, obsidian, a red gem
  spire   the Hexed Spine: amethyst and ice crystals, a blue gem
  hollow  the Root Gizzard: tangled roots, amber, orange toadstools
  reef    the Drowned Belly: coral, a fan, shells, pearls, kelp, a pool
  keep    the Iron Tail: iron ore, mine timbers, lanterns, glowing mushrooms, a pool
  all     stalactites (color-swapped to each island's rock), the ladder up, the knot of roots,
          the way down through the Maw's body, bones

    python tools/textures/deep-art.py           # writes only the pictures that don't exist yet
    python tools/textures/deep-art.py --force   # redraws them all (loses any repainting!)

Meant to be repainted by hand: once a file exists this tool leaves it alone.
"""
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, "textures")
OUT = os.path.join(TEX, "map", "deep")
FORCE = "--force" in sys.argv


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def grid(rows, pal):
    """ASCII rows -> picture. '.' is see-through; every other letter is a color from pal."""
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." and ch != " ":
                px[x, y] = hexc(pal[ch]) if isinstance(pal[ch], str) else pal[ch]
    return im


def sheet(frames):
    """Frames side by side"""
    w, h = frames[0].width, frames[0].height
    im = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im.alpha_composite(f, (i * w, 0))
    return im


PICS = {}      # name -> (image, index entry extras)


def add(name, im, **extra):
    PICS[name] = (im, extra)


# ---------- crown: the Cinder Gullet ----------
add("lava-pool", sheet([
    grid(["..kkkkkkk..",
          ".kroyyyork.",
          "kroyywyyork",
          ".kkrrrrrkk."], {"k": "#1a0c0c", "r": "#a8341a", "o": "#ff6a1a", "y": "#ffb030", "w": "#fff0a0"}),
    grid(["..kkkkkkk..",
          ".kroyyyyok.",
          "kroywyyyork",
          ".kkrrrrrkk."], {"k": "#1a0c0c", "r": "#a8341a", "o": "#ff6a1a", "y": "#ffb030", "w": "#fff0a0"})]),
    frames=2, anchor=[5, 3])
add("obsidian", grid(["..k.",
                      ".kpk",
                      ".kbk",
                      "kpbk",
                      "kbbk",
                      "kkkk"], {"k": "#0a0610", "b": "#1e1428", "p": "#7a4ab0"}), anchor=[2, 5])
add("gem-red", sheet([
    grid([".r.", "rwr", ".d."], {"r": "#e83a3a", "w": "#ffc0c0", "d": "#8a1a1a"}),
    grid([".w.", "wwr", ".d."], {"r": "#e83a3a", "w": "#ffffff", "d": "#8a1a1a"})]), frames=2, anchor=[1, 2])

# ---------- spire: the Hexed Spine ----------
add("crystal-violet", grid(["...w...",
                            "...lA..",
                            ".w.lA..",
                            ".lAlAw.",
                            ".lAlAlA",
                            "llAlAlA",
                            "lAAlAlA",
                            "kkkkkkk"], {"w": "#f0d8ff", "l": "#c890ff", "A": "#7a3ac8", "k": "#2a1a40"}), anchor=[3, 7])
add("crystal-ice", grid(["..w..",
                         "..lA.",
                         "w.lA.",
                         "lAlAw",
                         "lAlAl",
                         "lAlAl",
                         "kkkkk"], {"w": "#ffffff", "l": "#b8f4ff", "A": "#3aa8d8", "k": "#1a2a40"}), anchor=[2, 6])
add("gem-blue", sheet([
    grid([".b.", "bwb", ".d."], {"b": "#5ab0ff", "w": "#d8f0ff", "d": "#1a4a9a"}),
    grid([".w.", "wwb", ".d."], {"b": "#5ab0ff", "w": "#ffffff", "d": "#1a4a9a"})]), frames=2, anchor=[1, 2])
add("rune-mark", sheet([
    grid(["c.c", ".c.", "c.c"], {"c": "#7fe3ff"}),
    grid(["c.c", ".w.", "c.c"], {"c": "#b36bff", "w": "#ffffff"})]), frames=2, anchor=[1, 1])

# ---------- hollow: the Root Gizzard ----------
add("roots-tangle", grid(["d..l...d...",
                          ".dl.l.dl..d",
                          "..dDlDl.dl.",
                          ".dl.dDDl.d.",
                          "d...l..dl.l"], {"d": "#3a2410", "D": "#5a3a1a", "l": "#8a5a2a"}), anchor=[5, 0])
add("amber", sheet([
    grid([".o.", "oyo", "oyo", ".d."], {"o": "#e89a1a", "y": "#ffd870", "d": "#9a5a10"}),
    grid([".o.", "owo", "oyo", ".d."], {"o": "#e89a1a", "y": "#ffd870", "w": "#fff8d0", "d": "#9a5a10"})]), frames=2, anchor=[1, 3])
add("toadstool", grid(["oOo", "wsw", ".s."], {"o": "#d8601a", "O": "#ff9a3a", "w": "#fff0d0", "s": "#e8d8b0"}), anchor=[1, 2])

# ---------- reef: the Drowned Belly ----------
add("coral-pink", grid(["l.l..l.",
                        "p.p.lp.",
                        ".pp.p..",
                        "..ppp.l",
                        "l..pp.p",
                        "p..p.pp",
                        ".dppp.."], {"l": "#ffc8d8", "p": "#ff7a9a", "d": "#a83a5a"}), anchor=[3, 6])
add("coral-fan", grid(["o.o.o.",
                       "oooooo",
                       ".oOoO.",
                       "..oo..",
                       "..dd.."], {"o": "#ff8a3a", "O": "#ffb070", "d": "#a84a1a"}), anchor=[2, 4])
add("shell", grid(["lpl", "ppd"], {"l": "#fff0e0", "p": "#f0b8a0", "d": "#a87060"}), anchor=[1, 1])
add("pearl", sheet([
    grid(["wl", "ld"], {"w": "#ffffff", "l": "#e8e0f0", "d": "#a8a0b8"}),
    grid(["ll", "wd"], {"w": "#ffffff", "l": "#e8e0f0", "d": "#a8a0b8"})]), frames=2, anchor=[1, 1])
add("kelp", sheet([
    grid([".g.", "g..", ".g.", "..G", ".G.", "G..", ".G.", ".G."], {"g": "#5ac87a", "G": "#2a8a4a"}),
    grid(["g..", ".g.", "..g", ".G.", "G..", ".G.", "..G", ".G."], {"g": "#5ac87a", "G": "#2a8a4a"})]), frames=2, anchor=[1, 7])

# ---------- keep: the Iron Tail ----------
add("ore", grid(["..kkk.",
                 ".kgrgk",
                 "kgswgk",
                 "kkkkkk"], {"k": "#3a3a40", "g": "#5a5a64", "r": "#b0603a", "s": "#d0d0d8", "w": "#ffffff"}), anchor=[3, 3])
add("beam", grid(["dLLLLLLLLLd",
                  "dlllllllllld"[:11],
                  ".pd.....dp.",
                  ".pd.....dp.",
                  ".pd.....dp.",
                  ".pd.....dp.",
                  ".pd.....dp.",
                  ".pd.....dp.",
                  ".pd.....dp.",
                  "kkk.....kkk"], {"L": "#a8784a", "l": "#7a5432", "d": "#4a301a", "p": "#8a6038", "k": "#2a2a30"}), anchor=[5, 9])
add("lantern", sheet([
    grid([".k.", "kkk", "kyk", "kwk", "kkk"], {"k": "#2a2a30", "y": "#ffc040", "w": "#fff0a0"}),
    grid([".k.", "kkk", "kwk", "kyk", "kkk"], {"k": "#2a2a30", "y": "#ffb030", "w": "#ffe080"})]), frames=2, anchor=[1, 0])
add("glowcap", sheet([
    grid(["cCc", ".s."], {"c": "#3ad8c8", "C": "#a0fff0", "s": "#d8e8e0"}),
    grid(["CcC", ".s."], {"c": "#3ad8c8", "C": "#a0fff0", "s": "#d8e8e0"})]), frames=2, anchor=[1, 1])
add("pool", sheet([
    grid(["..bbbbbbb..",
          ".bLwbbbLbb.",
          "kbbbbLbbbbk"], {"b": "#2a6aa8", "L": "#5aa8e8", "w": "#d8f0ff", "k": "#1a2a3a"}),
    grid(["..bbbbbbb..",
          ".bbbLwbbbL.",
          "kbLbbbbbbbk"], {"b": "#2a6aa8", "L": "#5aa8e8", "w": "#d8f0ff", "k": "#1a2a3a"})]), frames=2, anchor=[5, 2])

# ---------- every tunnel ----------
# a stalactite, in the island's own rock: its three shades are swapped in (rock, rockLit, rockDark)
add("stalactite", grid(["LMD",
                        "LMD",
                        "LMD",
                        ".MD",
                        ".M.",
                        ".D."], {"L": "#00ff00", "M": "#ff00ff", "D": "#0000ff"}),
    keys={"#ff00ff": "rock", "#00ff00": "rockLit", "#0000ff": "rockDark"}, anchor=[1, 0])
add("stalagmite", grid([".D.",
                        ".M.",
                        "LMD",
                        "LMD"], {"L": "#00ff00", "M": "#ff00ff", "D": "#0000ff"}),
    keys={"#ff00ff": "rock", "#00ff00": "rockLit", "#0000ff": "rockDark"}, anchor=[1, 3])
add("ladder", grid(["w.w", "wWw", "w.w", "w.w", "wWw", "w.w", "w.w", "wWw", "w.w", "w.w", "wWw", "w.w"],
                   {"w": "#8a6038", "W": "#c8985a"}), anchor=[1, 0])
add("root-knot", grid(["..d.l.d.l..",
                       ".dLl.lLd.l.",
                       "d.lLLLLl..d",
                       ".lLLgLLLl..",
                       "d.lLLLLld.l",
                       ".d.lLl.d.d.",
                       "..d..l..d.."], {"d": "#3a2410", "l": "#6a4a24", "L": "#8a6236", "g": "#e8c86a"}), anchor=[5, 6])
add("maw-door", grid(["...kkkkkkk...",
                      "..kpPPPPPpk..",
                      ".kpPrrrrrPpk.",
                      "kpPrkkkkkrPpk",
                      "kpPrkkkkkrPpk",
                      "kpPrkkkkkrPpk",
                      "kpPwkkkkkwPpk",
                      "kkkkkkkkkkkkk"], {"k": "#0a0406", "p": "#5a1430", "P": "#8a2046", "r": "#c04a6a", "w": "#efe8d4"}), anchor=[6, 7])
add("bones", grid(["w.w..", ".ww.w", "w..ww"], {"w": "#e8e0c8"}), anchor=[2, 2])


def main():
    os.makedirs(OUT, exist_ok=True)
    idx_path = os.path.join(TEX, "index.json")
    text = open(idx_path, encoding="utf-8").read()
    data = json.loads(text)
    wrote, lines = 0, []
    for name, (im, extra) in PICS.items():
        path = os.path.join(OUT, name + ".png")
        if FORCE or not os.path.exists(path):
            im.save(path)
            wrote += 1
        tid = "deep:" + name
        entry = {"file": f"map/deep/{name}.png"}
        if extra.get("frames"):
            entry["frames"] = extra["frames"]
        if extra.get("keys"):
            entry["keys"] = extra["keys"]
        if extra.get("anchor"):
            entry["anchor"] = extra["anchor"]
        if tid not in data["textures"] if "textures" in data else tid not in data:
            lines.append((tid, entry))
    # add the missing lines at the end of the list, in the file's own one-line style
    if lines:
        key = "textures" if "textures" in data else None
        add_text = "".join(f',\n    "{tid}": {json.dumps(e).replace(chr(34) + ": ", chr(34) + ": ").replace(", ", ", ")}' for tid, e in lines)
        m = re.search(r'("[^"\n]+": [^\n]+)\n  \}\n\}\s*$', text)
        if not m:
            sys.exit("index.json: can't find the end of the list")
        text = text[:m.end(1)] + add_text + text[m.end(1):]
        json.loads(text)
        with open(idx_path, "w", encoding="utf-8", newline="") as f:
            f.write(text)
    print(f"{wrote} picture(s) written, {len(lines)} line(s) added to textures/index.json")


if __name__ == "__main__":
    main()
