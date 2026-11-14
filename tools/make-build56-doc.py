#!/usr/bin/env python3
"""
Writes docs/BUILD-56.md: the document for build 56's content pass. The prose is here; every table
(levels, enemies, items, objectives) is read from the game's own data files, so the document can't drift from the game.

    python tools/make-build56-doc.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMP = os.path.join(ROOT, "content", "campaign")
LVL = os.path.join(ROOT, "content", "levels", "campaign")


def load(rel):
    return json.load(open(os.path.join(CAMP, rel), encoding="utf-8"))


order = [l.strip() for l in open(os.path.join(CAMP, "islands", "_index.dat"), encoding="utf-8") if l.strip() and not l.startswith("#")]
islands = [load(f"islands/{i}.json") for i in order]
foes = load("foes.json")
items = load("items.json")
OBJ = foes["objectives"]
ENEMY = {e["id"]: e for e in foes["enemies"]}

GOAL = {
    "apples": lambda g: f"eat {g['need']} apples", "score": lambda g: f"reach {g['need']:,} points", "length": lambda g: f"grow to {g['need']}",
    "survive": lambda g: f"survive {g['need']} s", "keys": lambda g: f"find {g['need']} keys, then the gate", "relic": lambda g: f"find the {g.get('item')} relic",
    "buttons": lambda g: f"press {g['need']} plates" + (" in order" if g.get("ordered") else ""), "shards": lambda g: f"gather {g['need']} pouches",
    "thief": lambda g: f"corner the thief {g['need']} times", "beacons": lambda g: f"light {g['need']} lamps at once",
    "hold": lambda g: f"hold the ring {g['need']} s", "haul": lambda g: f"deliver {g['need']} pouches",
    "boss": lambda g: ["", "wear it out", "break its armor", "finish it"][g["fight"]],
}
SIDE_SHORT = {"stair": "stairs", "link": "link", "bounce": "bumper", "briar": "briar", "toll": "toll", "tide": "tide", "lock": "lock", "open": "open", "wall": "wall", "mirror": "mirror", "wrap": "open"}
TILE_WORDS = {"4": "turret", "5": "turret", "6": "turret", "7": "turret", "8": "cannon", "G": "geyser", "E": "belt", "Z": "belt", "W": "belt", "N": "belt", "~": "tar", "x": "crumble", "*": "mine", "B": "blade",
              ">": "gate", "<": "gate", "^": "gate", "v": "gate", "a": "door", "b": "door", "c": "door", "d": "door"}


def sides(lv):
    base = "wall" if lv["edge"] == "wall" else "mirror" if lv["edge"] == "mirror" else "open"
    e = lv.get("edges")
    if lv["edge"] == "maze":
        return "(a maze)"
    if not e:
        return base if base != "wall" else "walls"
    out = []
    for s in ("top", "right", "bottom", "left"):
        v = e.get(s, base)
        k = v if isinstance(v, str) else v["kind"]
        out.append(f"{s[0].upper()}: {SIDE_SHORT.get(k, k)}")
    return ", ".join(out)


def board_things(isl, n):
    try:
        text = open(os.path.join(LVL, f"{isl}-{n}.level"), encoding="utf-8").read().replace("\r", "")
    except OSError:
        return ""
    rows = text.split("---\n", 1)[1].split("\n")
    seen = {}
    for r in rows:
        for ch in r:
            if ch in TILE_WORDS:
                seen[TILE_WORDS[ch]] = seen.get(TILE_WORDS[ch], 0) + 1
    return ", ".join(sorted(seen))


def first_sentence(t):
    out = ""
    for part in t.split(". "):
        out = (out + " " if out else "") + part.rstrip(".") + "."
        if len(out) >= 70:
            break
    return out


def spawn_list(lv):
    out = []
    for k, v in (lv.get("spawns") or {}).items():
        out.append(k + (f" x{v['count']}" if "count" in v else ""))
    return ", ".join(out)


def level_tables():
    parts = []
    for I in islands:
        parts.append(f"### {I['n']}. {I['name']} ({I['theme']})\n")
        parts.append("| # | Level | Goal | Sides | Board | On the board | The idea |")
        parts.append("|---|---|---|---|---|---|---|")
        for lv in I["levels"]:
            g = lv["goal"]
            n = lv["n"]
            what = spawn_list(lv)
            if n in (5, 10, 15):
                O = OBJ[I["id"]]
                what = f"boss shield: {O['name'].lower()}"
            parts.append(f"| {n} | {lv['name']} | {GOAL[g['type']](g)} | {sides(lv)} | {board_things(I['id'], n) or '-'}{', dark' if lv.get('dark') else ''} | {what or '-'} | {first_sentence(lv['text'])} |")
        parts.append("")
    return "\n".join(parts)


def enemy_table():
    rows = ["| Enemy | Brain | Where | Hits with | Takes | What to do |", "|---|---|---|---|---|---|"]
    for e in foes["enemies"]:
        if not e.get("explicit"):
            continue
        takes = []
        for k, lab in (("immune", "immune"), ("resist", "resists"), ("weak", "weak")):
            if e.get(k):
                takes.append(f"{lab} {', '.join(e[k])}")
        rows.append(f"| {e['label']} (`{e['id']}`) | {e['kind']} | {', '.join(e['islands'])} | {', '.join(e['hit']['tags'])} | {'; '.join(takes) or '-'} | {e['fact']} |")
    return "\n".join(rows)


def old_enemy_table():
    rows = ["| Enemy | Brain | Where |", "|---|---|---|"]
    for e in foes["enemies"]:
        if e.get("explicit"):
            continue
        rows.append(f"| {e['label']} (`{e['id']}`) | {e['kind']} | {', '.join(e['islands'])}, from level {e.get('from', 6)} |")
    return "\n".join(rows)


def objective_table():
    rows = ["| Island | Boss | Kind | Fight 1 (the lesson) | Fight 2 (shield) | Fight 3 (shield) |", "|---|---|---|---|---|---|"]
    for I in islands:
        O = OBJ[I["id"]]

        def f(x):
            bits = [f"need {x['n']}"]
            if "count" in x:
                bits.append(f"{x['count']} on the board")
            if "secs" in x:
                bits.append(f"{x['secs']} s to do it")
            if "lit" in x:
                bits.append(f"lamps burn {x['lit']} s")
            if x.get("ordered"):
                bits.append("in order")
            if "window" in x:
                bits.append(f"shield down {x['window'] / 1000:g} s")
            if "chunk" in x:
                bits.append(f"each knocks off {round(x['chunk'] * 100)}% of its wind")
            return ", ".join(bits)
        rows.append(f"| {I['name']} | {I['boss']['name']} | {O['kind']} ({O['name'].lower()}) | {f(O['fights'][0])} | {f(O['fights'][1])} | {f(O['fights'][2])} |")
    return "\n".join(rows)


def item_table(ids, cols):
    byid = {i["id"]: i for i in items["items"]}
    rows = ["| " + " | ".join(h for h, _ in cols) + " |", "|" + "---|" * len(cols)]
    for i in ids:
        it = byid[i]
        rows.append("| " + " | ".join(str(fn(it)) for _, fn in cols) + " |")
    return "\n".join(rows)


def stats_text(it):
    return "; ".join(f"{s['stat']} {s['v'] if not isinstance(s['v'], list) else '/'.join(str(x) for x in s['v'])}" for s in (it.get("stats") or []))


WEAPONS = ["cutlass", "gatehalberd", "tidetrident", "scythe", "arcrapier", "cleaver"]
ARMOR = ["shellhelm", "tidecoat", "obsidianhelm", "obsidianplate", "runehood", "runerobe", "gleanerhat", "gleanersack"]
SPELLS = ["tidalsurge", "emberrain", "shadowstep", "stormaegis", "harvestcall", "hexbolt"]
SNACKS = ["harvestpie", "smokedfish", "beebalm", "crunchbar"]
PETS = ["ferret", "raven", "digger", "axolotl", "bat", "pup"]
RUNES = ["mending", "anvil", "thorn", "tide", "scholar", "hunt"]

DOC = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "build56-doc.md"), encoding="utf-8").read()
subs = {
    "LEVEL_TABLES": level_tables(),
    "ENEMY_TABLE": enemy_table(),
    "OLD_ENEMY_TABLE": old_enemy_table(),
    "OBJECTIVE_TABLE": objective_table(),
    "WEAPON_TABLE": item_table(WEAPONS, [("Weapon", lambda i: f"{i['name']} (`{i['id']}`)"), ("Hits", lambda i: "+".join(i["hit"]["tags"])), ("Traits", lambda i: ", ".join(i.get("traits", []))), ("Damage by rarity", lambda i: "/".join(map(str, i["damage"]))), ("Uses", lambda i: "/".join(map(str, i["uses"]))), ("Good against", lambda i: i["strong"]), ("Weak against", lambda i: i["weak"])]),
    "ARMOR_TABLE": item_table(ARMOR, [("Piece", lambda i: f"{i['name']} (`{i['id']}`)"), ("Set", lambda i: i["set"]), ("Stat lines (best four)", stats_text)]),
    "SET_TABLE": "\n".join(["| Set | Tier | Both pieces give | But |", "|---|---|---|---|"] + [
        f"| {s['name']} | {s['tier']} | {', '.join(f'{b['stat']} {b['v']}' for b in s['bonus'])} | {', '.join(f'{b['stat']} {b['v']}' for b in s['bad']) or '-'} |"
        for s in items["armorSets"] if s["id"] in ("tide", "obsidian", "runeweave", "gleaner")]),
    "SPELL_TABLE": item_table(SPELLS, [("Spell", lambda i: f"{i['name']} (`{i['id']}`)"), ("Acts as", lambda i: i["acts"]), ("Charges by rarity", lambda i: "/".join(map(str, i["charges"]))), ("Power", lambda i: "/".join(map(str, i["power"])) + " " + i["unit"]), ("What it does", lambda i: i["does"])]),
    "SNACK_TABLE": item_table(SNACKS, [("Snack", lambda i: f"{i['name']} (`{i['id']}`)"), ("Acts as", lambda i: i["acts"]), ("Charges", lambda i: "/".join(map(str, i["charges"]))), ("Power", lambda i: "/".join(map(str, i["power"])) + " " + i["unit"]), ("What it does", lambda i: i["does"])]),
    "PET_TABLE": item_table(PETS, [("Familiar", lambda i: f"{i['name']} (`{i['id']}`)"), ("Acts as", lambda i: i["acts"]), ("Stat lines", stats_text), ("What it does", lambda i: i["does"])]),
    "RUNE_TABLE": item_table(RUNES, [("Rune", lambda i: f"{i['name']} (`{i['id']}`)"), ("Good (broken / cracked / fine / pristine)", lambda i: "; ".join(f"{g['stat']} {'/'.join(map(str, g['v']))}" for g in i["good"])), ("Bad", lambda i: "; ".join(f"{g['stat']} {'/'.join(map(str, g['v']))}" for g in i["bad"]))]),
}
out = DOC
for k, v in subs.items():
    out = out.replace("{{" + k + "}}", v)
open(os.path.join(ROOT, "docs", "BUILD-56.md"), "w", encoding="utf-8", newline="\n").write(out)
print("docs/BUILD-56.md written,", len(out.split(chr(10))), "lines")
