#!/usr/bin/env python3
"""
Checks the content folder for the mistakes that are easy to make by hand:

  - a file that exists but isn't listed in its folder's _index.dat (it won't load)
  - a name in _index.dat with no file behind it (the game won't start)
  - a line that isn't "key = value", a comment, a [section] or blank
  - an upgrade without values, or a skin without colors
  - an island in world-order.dat without its folder files
  - an island tree without its five slots, or an unknown upgrade effect
  - a [spawns.<type>] for something the game can't spawn
  - an island without its story page and Nightmare page
  - a key or section named __proto__, constructor or prototype (the game skips those)

    python tools/check-content.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
problems, notes = [], []

# Things an island can spawn: the built-in items, plus the hazards and power-ups in
# src/game/flow/entities.js (ENTITY_TYPES). Keep this list in step with that file.
KNOWN_SPAWNS = {"xp", "apple", "rock", "popsicle", "flea", "fire", "molasses",
                "bramble", "wasp", "lightning", "ice", "bomb", "ghost", "spikes", "gust", "sinkhole",
                "golden", "shears", "armor", "shield", "hourglass", "star", "phantom", "lodestone", "frenzy"}
KNOWN_EFFECTS = {"applePoints", "passivePoints", "orbChance"}
RESERVED = {"__proto__", "constructor", "prototype"}


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, "/")


def listed(index_path):
    names = []
    with open(index_path, encoding="utf-8") as f:
        for line in f:
            s = line.split("|")[0].strip()
            if s and not s.startswith("#"):
                names.append(s)
    return names


def check_values(path):
    keys = {}
    section = ""
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")
    for n, line in enumerate(lines, 1):
        s = line.strip()
        if s == "---":
            break
        if not s or s.startswith("#") or s.startswith("//"):
            continue
        if re.fullmatch(r"\[[\w.\- ]*\]", s):
            section = s[1:-1]
            if any(part.strip() in RESERVED for part in section.split(".")):
                problems.append(f"{rel(path)}:{n}  '[{section}]' isn't allowed as a section name")
            continue
        if "=" not in s or s.index("=") == 0:
            problems.append(f"{rel(path)}:{n}  expected 'key = value', found: {s}")
            continue
        if s.split("=", 1)[0].strip() in RESERVED:
            problems.append(f"{rel(path)}:{n}  '{s.split('=', 1)[0].strip()}' isn't allowed as a key")
        key = section + "." + s.split("=", 1)[0].strip() if section else s.split("=", 1)[0].strip()
        if key in keys:
            notes.append(f"{rel(path)}:{n}  '{key}' is set twice (line {keys[key]} and {n}); the last one wins")
        keys[key] = n
    return keys


def check_folder(folder, ext, required=()):
    index = os.path.join(folder, "_index.dat")
    if not os.path.exists(index):
        problems.append(f"{rel(folder)}/  has no _index.dat")
        return
    names = listed(index)
    present = {os.path.splitext(f)[0] for f in os.listdir(folder) if f.endswith("." + ext)}
    for name in names:
        path = os.path.join(folder, f"{name}.{ext}")
        if not os.path.exists(path):
            problems.append(f"{rel(index)}  lists '{name}', but {rel(path)} doesn't exist")
            continue
        keys = check_values(path)
        for group in required:
            if not any(k in keys for k in group):
                problems.append(f"{rel(path)}  needs one of: {', '.join(group)}")
    for name in sorted(present - set(names)):
        notes.append(f"{rel(folder)}/{name}.{ext}  isn't listed in _index.dat, so it won't load")


def value_of(path, key):
    """The value of a top-level key in a value file, or None"""
    with open(path, encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if s.startswith("["):
                return None
            m = re.match(r"%s\s*=\s*(.*?)(\s+#\s.*)?$" % re.escape(key), s)
            if m:
                return m.group(1).strip()
    return None


def check_island(island, stories):
    base = os.path.join(CONTENT, "worlds", "builtin", island)
    for f in ("world.txt", "levels.dat"):
        if not os.path.exists(os.path.join(base, f)):
            problems.append(f"{rel(base)}/{f}  is missing")
    world = os.path.join(base, "world.txt")
    if os.path.exists(world):
        keys = check_values(world)
        for k in keys:
            m = re.match(r"(nightmare\.)?spawns\.([\w-]+)\.", k)
            if m and m.group(2) not in KNOWN_SPAWNS:
                problems.append(f"{rel(world)}:{keys[k]}  nothing called '{m.group(2)}' can spawn (see KNOWN_SPAWNS)")
        for k in ("map.x", "map.y", "map.width"):
            if k not in keys:
                problems.append(f"{rel(world)}  needs '{k}' so the island has a place on the map")
    ups = os.path.join(base, "upgrades")
    check_folder(ups, "upg", [("values", "start", "ratio")])
    if os.path.exists(os.path.join(ups, "_index.dat")):
        slots = []
        for name in listed(os.path.join(ups, "_index.dat")):
            p = os.path.join(ups, name + ".upg")
            if not os.path.exists(p):
                continue
            slots.append(value_of(p, "slot"))
            eff = value_of(p, "effect")
            if eff and eff not in KNOWN_EFFECTS:
                problems.append(f"{rel(p)}  effect '{eff}' isn't one of: {', '.join(sorted(KNOWN_EFFECTS))}")
        for slot in ("trunk", "left", "right", "crown", "nightmare"):
            if slot not in slots:
                problems.append(f"{rel(ups)}  has no '{slot}' upgrade (every island tree needs trunk, left, right, crown and nightmare)")
    for page in (island, "nm-" + island):
        if page not in stories:
            problems.append(f"content/story/_index.dat  doesn't list '{page}', the story page for {island}")


def check_game_levels():
    """content/levels/index.dat: each "name | file" line, and each file's header and board"""
    folder = os.path.join(CONTENT, "levels")
    index = os.path.join(folder, "index.dat")
    if not os.path.exists(index):
        problems.append("content/levels/index.dat  is missing")
        return
    with open(index, encoding="utf-8") as f:
        rows = [l.split("|") for l in f if l.strip() and not l.strip().startswith("#")]
    names = [r[0].strip() for r in rows if len(r) == 2]
    for n in sorted({x for x in names if names.count(x) > 1}):
        problems.append(f"content/levels/index.dat  lists '{n}' twice")
    for r in rows:
        if len(r) != 2:
            problems.append(f"content/levels/index.dat  line '{'|'.join(r).strip()}' isn't 'name | file'")
            continue
        path = os.path.join(folder, r[1].strip())
        if not os.path.exists(path):
            problems.append(f"content/levels/index.dat  lists '{r[1].strip()}', which doesn't exist")
            continue
        with open(path, encoding="utf-8") as f:
            text = f.read()
        head, _, body = text.partition("\n---\n")
        size = value_of(path, "size")
        if size is None:
            size = 20   # a sandbox level (Play > Sandbox) has no size line: it is always 20 x 20
        if not str(size).isdigit():
            problems.append(f"{rel(path)}  'size' should be the squares across, a whole number")
            continue
        size = int(size)
        board = [l.split("  #")[0].rstrip() for l in body.replace("\r", "").split("\n") if l.strip()]
        if len(board) != size or any(len(l) != size for l in board):
            problems.append(f"{rel(path)}  its board should be {size} rows of {size} squares (it has {len(board)} rows)")
        bad = sorted({c for l in board for c in l} - set(".#PSAaXxRrOoFfHhMm@*%&!^~123"))
        if bad:
            problems.append(f"{rel(path)}  unknown board characters: {' '.join(bad)}")
        if sum(l.count("S") for l in board) != 1:
            problems.append(f"{rel(path)}  needs exactly one S (the snake's start)")


def main():
    check_game_levels()
    order = listed(os.path.join(CONTENT, "worlds", "world-order.dat"))
    stories = set(listed(os.path.join(CONTENT, "story", "_index.dat")))
    for island in order:
        check_island(island, stories)
    check_folder(os.path.join(CONTENT, "great-tree", "upgrades"), "upg", [("values", "start", "ratio")])
    check_folder(os.path.join(CONTENT, "items"), "item")
    check_folder(os.path.join(CONTENT, "skins"), "skin", [("palette", "gradient")])
    check_folder(os.path.join(CONTENT, "themes"), "theme", [("base",)])
    check_folder(os.path.join(CONTENT, "flair"), "flair", [("slot",)])
    check_folder(os.path.join(CONTENT, "avatars"), "avatar", [("picture",)])
    check_folder(os.path.join(CONTENT, "story"), "story", [("title",)])
    check_folder(os.path.join(CONTENT, "worlds", "community"), "level")
    for f in ("economy.txt", os.path.join("rules", "rules.txt")):
        check_values(os.path.join(CONTENT, f))

    for n in notes:
        print("note   ", n)
    for p in problems:
        print("PROBLEM", p)
    print(f"\n{len(problems)} problem(s), {len(notes)} note(s).")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
