#!/usr/bin/env python3
"""
Checks the campaign's data (content/campaign/) for mistakes before the game
ever sees it: missing fields, unknown layouts or goals, spawn names the engine
doesn't know, price tables of the wrong length, and so on.

    python tools/check-campaign.py

Exit code 0 = all good. Then sign the data with tools/sign-content.py.

To teach it a new rule: add to the tables at the top (LAYOUTS, GOALS, SPAWNS,
...) or add a check() line in the matching section below.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMP = os.path.join(ROOT, "content", "campaign")

LEVELS_PER_ISLAND = 15
BOSS_AT = {5: 1, 10: 2, 15: 3}                      # level -> boss fight number
KIND_AT = {n: "static" for n in (1, 2, 3, 4, 11)} | {n: "enemy" for n in (6, 7, 8, 9)} | {n: "dynamic" for n in (12, 13, 14)} | {n: "boss" for n in BOSS_AT}
LAYOUTS = {"open", "pillars", "rooms", "cross", "lanes", "ring", "comb", "diamond", "checker", "spiral", "arena", "tunnel", "maze", "field", "pulse"}
STATIC_LAYOUTS = LAYOUTS - {"tunnel", "maze", "field", "pulse"}
EDGES = {"wrap", "wall", "mirror", "endless", "maze"}
GOALS = {"apples", "score", "length", "survive", "distance", "keys", "buttons", "relic", "shards", "thief", "boss", "beacons", "hold", "haul"}
# a level's bonus challenge: type -> does it need a number to reach
BONUSES = {"streak": True, "fast": True, "rocks": True, "length": True, "points": True, "untouched": False, "kills": True, "spells": True, "loot": True}
BONUS_REWARDS = {"gems": (1, 10), "coins": (1, 5000), "points": (1, 100000)}
RELICS = {"crown", "grimoire", "ladle", "pearl", "eye"}
SPAWNS = {"popsicle", "flea", "fire", "molasses", "rock", "apple", "xp",
          "bramble", "wasp", "lightning", "ice", "bomb", "ghost", "spikes", "gust", "sinkhole",
          "golden", "shears", "armor", "shield", "hourglass", "star", "phantom", "lodestone", "frenzy",
          # build 56: the new hazards, the old ones the islands add, and the new power-ups (the new enemies come from foes.json)
          "lava", "trap", "ember", "acid", "frost", "turret", "cannon", "geyser", "conveyor", "blade", "mine", "tar", "crumble",
          "sprout", "shrink", "boots", "lantern", "bell", "anchor"}
EDGE_KINDS = {"open", "wrap", "wall", "mirror", "stair", "link", "bounce", "briar", "toll", "tide", "lock"}
SIDES = {"top", "right", "bottom", "left"}
PLACED = {"rock", "bramble", "ice", "spikes", "lava", "trap", "turret", "cannon", "geyser", "conveyor", "blade", "mine", "tar", "crumble"}          # these use count, not max + delay
ENDLESS_SPAWNS = {"rock", "flea", "popsicle"}         # the tunnel only rolls these, by rate
FAMILIES = {"gear", "spell", "food", "pet", "rune"}     # sold by merchants, five or more items each (the shelf shows three at a time)
# build 52: damage types (src/game/damage/damage.js, docs/DAMAGE.md). Each tag has a broad word and a narrow word.
DAMAGE_WORDS = {"piercing": ("piercing", "barb"), "slashing": ("slashing", "edge"), "fire": ("fire", "ember"),
                "ice": ("ice", "rime"), "electricity": ("electricity", "spark"), "venom": ("venom", "toxin")}
TAGS = set(DAMAGE_WORDS)
NARROW = {n for _, n in DAMAGE_WORDS.values()}
DAMAGE_STATS = {f"{w}.{k}" for pair in DAMAGE_WORDS.values() for w in pair for k in ("resistance", "weakness", "immunity")}
SPELL_STATS = {f"{w}.spells" for pair in DAMAGE_WORDS.values() for w in pair} | {"spellPower", "spellCharges"}
WEAPON_TRAITS = {"burn", "chill", "shock", "toxin", "pierce", "cleave"}
PIECES = {"weapon", "helmet", "body"}
ENEMY_KINDS = {"chaser", "crawler", "charger", "drifter", "blinker", "lurker",
               "ambusher", "shadow", "mirror", "sentry", "watcher", "orbiter", "leaper", "burrower", "sleeper", "pilferer", "pincer", "bomber", "gale", "tailbiter"}
BOSS_TRAITS = {"charger", "blink", "summon", "trail", "enrage", "regen", "rally", "devour", "tide"}
CHAMPION_ABILITIES = BOSS_TRAITS | {"stormcall", "frostbreath", "venomspit", "quake", "swarm", "phase", "harden"}
# what a rune can do: src/campaign/camp-runes.js has the effect and the words for each
RUNE_STATS = {"applePoints", "points", "apples", "hazards", "speed", "money", "hearts", "armor", "damage", "bossDrain", "bite",
              "echo", "echoCut", "loot", "freeCasts", "castCooldown", "gemChance", "growth", "graceSecs"} | DAMAGE_STATS | SPELL_STATS
SPECIAL_FAMILIES = {"vessel"}                         # never sold: found on the board or won
CAUSES = {"boss", "bomb", "spikes", "hunter", "lightning", "ghost", "poison", "wasp", "bramble", "flea", "fire", "echo",
          "bee", "yellowjacket", "imp", "mole", "crab", "wisp", "ember", "acid", "frost", "lava", "trap", "rivalbonk",
          "popsicle", "ice", "shears", "knightling", "scorpion", "sparkbeetle", "inkwraith", "mantis", "viper", "frostsprite", "urchin", "firebat",
          "briar", "turret", "cannon", "geyser", "blade", "mine",
          "hound", "crow", "warden", "reflection", "gargoyle", "orb", "galesprite", "gnasher", "locust", "boar", "angler", "squid", "flyingfish", "shark", "golem", "cinderknight", "blastimp", "emberhound"}
NPC_KINDS = ("merchant", "challenger", "banker")
HATS = {"helm", "hennin", "tophat", "wizard", "hood", "fez", "chef", "beret", "straw", "shell", "tricorn", "horns", "crown", ""}
EXTRAS = {"beard", "monocle", "mustache", "eyepatch", "none", ""}
STATS = {"levelsWon", "uniqueWins", "bossFights", "bossesSlain", "islandsOpen", "applesEaten", "flawless", "itemsBought",
         "itemsBroken", "spellsCast", "challengesDone", "keysFound", "platesPressed", "relicsFound", "thievesCaught",
         "distance", "trades", "upgradesBought", "deaths", "gemsEarned"}
UPGRADE_IDS = {"applevalue", "orchard", "scoremult", "hearts", "bounty", "golden", "plating", "calm", "hazardward", "enemyward",
               "shorten", "recharge", "sturdy", "potent", "hearty", "lucky", "haggle", "restock", "wear", "exhaust", "bite",
               "petbond", "treasure", "salvage", "secondwind", "passive", "gemfinder", "runecraft", "mastery", "armorcap"}

try:
    with open(os.path.join(CAMP, "foes.json"), encoding="utf-8") as _f:
        FOE_IDS = {e["id"] for e in json.load(_f).get("enemies", [])}
except (OSError, ValueError):
    FOE_IDS = set()
SPAWNS |= FOE_IDS                                   # build 56: a level can name any enemy in foes.json

problems = []


def check(ok, where, msg):
    if not ok:
        problems.append(f"{where}: {msg}")
    return ok


def num(v, lo, hi):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and lo <= v <= hi


def load(rel):
    path = os.path.join(CAMP, rel)
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        check(False, rel, "missing file")
    except json.JSONDecodeError as e:
        check(False, rel, f"isn't valid JSON (line {e.lineno}: {e.msg})")
    return {}


def check_island(isl, rel, families_used, currencies):
    for key in ("id", "n", "name", "theme", "blurb", "colors", "currency", "npcs", "boss", "merchantFamily", "levels"):
        check(key in isl, rel, f"missing \"{key}\"")
    cur = isl.get("currency", {})
    for key in ("id", "name", "plural", "short", "color"):
        check(key in cur, rel, f"currency is missing \"{key}\"")
    check(cur.get("id") not in currencies, rel, f"currency id \"{cur.get('id')}\" is used by another island")
    check(isinstance(cur.get("tale"), str) and len(cur.get("tale", "")) >= 10, rel, "currency needs a tale (a line about the coin, shown when you flip it)")
    currencies.add(cur.get("id"))
    fam = isl.get("merchantFamily")
    check(fam in FAMILIES, rel, f"merchantFamily \"{fam}\" isn't one of {sorted(FAMILIES)}")
    check(fam not in families_used, rel, f"merchantFamily \"{fam}\" is sold on another island too")
    families_used.add(fam)
    for kind in NPC_KINDS:
        npc = isl.get("npcs", {}).get(kind)
        if not check(isinstance(npc, dict), rel, f"npcs.{kind} is missing"):
            continue
        for key in ("name", "shop", "line", "look"):
            check(key in npc, rel, f"npcs.{kind} is missing \"{key}\"")
        look = npc.get("look", {})
        check(look.get("hat", "") in HATS, rel, f"npcs.{kind}.look.hat \"{look.get('hat')}\" isn't a hat the portrait painter knows")
        check(look.get("extra", "") in EXTRAS, rel, f"npcs.{kind}.look.extra \"{look.get('extra')}\" isn't known")
    b = isl.get("boss", {})
    check(num(b.get("hearts"), 1, 20), rel, "boss.hearts must be 1-20")
    check(num(b.get("armor"), 0, 20) and b.get("armor", 0) <= b.get("hearts", 0), rel, "boss.armor must be 0..hearts")
    check(num(b.get("length"), 3, 30), rel, "boss.length must be 3-30")
    check(num(b.get("speed"), 0.2, 1.5), rel, "boss.speed must be 0.2-1.5 (relative to the snake)")
    check(num(b.get("stamina"), 5, 300), rel, "boss.stamina must be 5-300 seconds")
    check(isinstance(b.get("drain"), list) and len(b.get("drain", [])) == 3 and all(num(x, 0.1, 10) for x in b.get("drain", [])), rel, "boss.drain must be three numbers (one per fight)")
    check(num(b.get("exhaustMs"), 500, 20000), rel, "boss.exhaustMs must be 500-20000")
    check(isinstance(b.get("resist", []), list) and all(r in ("fireball", "frost", "forcefield") for r in b.get("resist", [])), rel,
          "boss.resist lists the spells it shrugs off: fireball, frost or forcefield")

    levels = isl.get("levels", [])
    check(len(levels) == LEVELS_PER_ISLAND, rel, f"has {len(levels)} levels, needs {LEVELS_PER_ISLAND}")
    seen = set()
    for lv in levels:
        n = lv.get("n")
        where = f"{rel} level {n}"
        check(num(n, 1, LEVELS_PER_ISLAND) and n not in seen, where, "n must be 1-15 and unique")
        seen.add(n)
        for key in ("name", "kind", "layout", "edge", "speed", "goal", "text"):
            check(key in lv, where, f"missing \"{key}\"")
        check(lv.get("kind") == KIND_AT.get(n), where, f"kind should be \"{KIND_AT.get(n)}\" for level {n}")
        layout = lv.get("layout")
        check(layout in LAYOUTS, where, f"layout \"{layout}\" isn't one of {sorted(LAYOUTS)}")
        if lv.get("kind") in ("static", "enemy"):
            check(layout in STATIC_LAYOUTS, where, f"static levels can't use the moving layout \"{layout}\"")
        if lv.get("kind") == "dynamic":
            check(layout not in STATIC_LAYOUTS, where, f"dynamic levels need a moving layout, not \"{layout}\"")
        check(lv.get("edge") in EDGES, where, f"edge \"{lv.get('edge')}\" isn't one of {sorted(EDGES)}")
        check(num(lv.get("speed"), 3, 16), where, "speed must be 3-16 squares a second")
        g = lv.get("goal", {})
        gt = g.get("type")
        check(gt in GOALS, where, f"goal type \"{gt}\" isn't one of {sorted(GOALS)}")
        if n in BOSS_AT:
            check(gt == "boss" and g.get("fight") == BOSS_AT[n], where, f"level {n} must be boss fight {BOSS_AT[n]}")
        elif gt == "boss":
            check(False, where, "only levels 5, 10 and 15 are boss fights")
        if gt not in ("boss", "relic"):
            check(num(g.get("need"), 1, 1e7), where, "goal.need must be a positive number")
        if gt == "relic":
            check(g.get("item") in RELICS, where, f"relic item \"{g.get('item')}\" has no picture (one of {sorted(RELICS)})")
        if gt == "distance":
            check(layout == "tunnel", where, "distance goals only work in the tunnel")
        if gt == "buttons":
            check(num(g.get("need"), 1, 8), where, "buttons need 1-8 plates")
        if gt == "beacons":
            check(num(g.get("need"), 1, 6) and num(g.get("lit", 12), 4, 60), where, "beacons need 1-6 lamps and a lit time (4-60 s)")
        if gt == "hold":
            check(num(g.get("need"), 5, 300), where, "hold needs 5-300 seconds")
        if gt == "haul":
            check(num(g.get("need"), 1, 8), where, "haul needs 1-8 deliveries")
        edges = lv.get("edges")
        if edges is not None:
            check(isinstance(edges, dict) and set(edges) <= SIDES, where, f"edges names sides: {sorted(SIDES)}")
            for side, e in (edges or {}).items():
                kind = e if isinstance(e, str) else (e or {}).get("kind")
                check(kind in EDGE_KINDS, where, f"edges.{side}: \"{kind}\" isn't one of {sorted(EDGE_KINDS)}")
                if isinstance(e, dict) and kind == "link":
                    check(e.get("to") in SIDES, where, f"edges.{side}: a link needs `to` (a side)")
                if isinstance(e, dict) and kind == "lock":
                    check(isinstance(e.get("after"), dict), where, f"edges.{side}: a lock needs `after` (apples, score, secs or pieces)")
            check(layout not in ("maze", "field", "tunnel"), where, "a maze, a field or a road has no sides of its own")
        bonus = lv.get("bonus")
        if check(isinstance(bonus, dict), where, "missing its bonus challenge (\"bonus\")"):
            bt = bonus.get("type")
            check(bt in BONUSES, where, f"bonus type \"{bt}\" isn't one of {sorted(BONUSES)}")
            if BONUSES.get(bt):
                check(num(bonus.get("need"), 1, 1e7), where, "bonus.need must be a positive number")
            if bt == "streak":
                check(num(bonus.get("secs"), 3, 120), where, "a streak bonus needs secs (3-120)")
            if bt == "rocks":
                check("rock" in lv.get("spawns", {}), where, "a rocks bonus needs rocks on the board")
            rw = bonus.get("reward", {})
            check(isinstance(rw, dict) and len(rw) == 1 and all(k in BONUS_REWARDS and num(v, *BONUS_REWARDS[k]) for k, v in rw.items()), where,
                  f"bonus.reward must be one of {sorted(BONUS_REWARDS)} with a sensible amount")
        if layout == "tunnel":
            for k in lv.get("spawns", {}):
                check(k in ENDLESS_SPAWNS, where, f"the tunnel can't spawn \"{k}\" (only {sorted(ENDLESS_SPAWNS)})")
        for k, s in lv.get("spawns", {}).items():
            sw = f"{where} spawns.{k}"
            check(k in SPAWNS, sw, "isn't something the engine can spawn")
            if layout == "tunnel":
                check(num(s.get("rate"), 0, 1), sw, "tunnel spawns need a rate from 0 to 1")
            elif k in PLACED:
                check(num(s.get("count"), 0, 60), sw, "needs a count (0-60)")
            else:
                check(num(s.get("max"), 1, 12), sw, "needs a max (1-12)")
                d = s.get("delay")
                check(isinstance(d, list) and len(d) == 2 and num(d[0], 300, 120000) and num(d[1], d[0], 120000), sw, "needs a delay [min, max] in ms")
            for p in ("s", "l"):
                if p in s:
                    check(num(s[p], 0, 100), sw, f"{p} is a percent (0-100)")


def check_items(items):
    rel = "items.json"
    rar = items.get("rarities", [])
    check(len(rar) == 4, rel, "needs exactly four rarities")
    fams = items.get("families", {})
    check(set(fams) == FAMILIES | SPECIAL_FAMILIES, rel, f"families must be {sorted(FAMILIES | SPECIAL_FAMILIES)}")
    slots = {s.get("id") for s in items.get("slots", [])}
    for f, d in fams.items():
        check(d.get("slot") in slots, rel, f"families.{f}.slot \"{d.get('slot')}\" isn't one of the slots")
    for f, d in fams.items():
        p = d.get("price", [])
        check(len(p) == 4 and all(num(x, 1, 1e7) for x in p) and p == sorted(p), rel, f"families.{f}.price must be four rising prices")
        if "grades" in d:
            check(len(d["grades"]) == 4 and all(isinstance(g, str) and g for g in d["grades"]), rel, f"families.{f}.grades must be four names")
    ids = set()
    per = {f: 0 for f in FAMILIES}
    for it in items.get("items", []):
        where = f"{rel} item {it.get('id')}"
        check(it.get("id") not in ids, where, "duplicate id")
        ids.add(it.get("id"))
        f = it.get("family")
        check(f in FAMILIES | SPECIAL_FAMILIES, where, f"family \"{f}\" unknown")
        per[f] = per.get(f, 0) + 1
        for key in ("name", "does", "strong", "weak") + (() if f == "rune" else ("legend",)):
            check(it.get(key), where, f"missing \"{key}\" (every item needs a strength and a weakness)")
        if f == "gear" and it.get("piece") in (None, "weapon"):
            check(len(it.get("uses", [])) == 4, where, "gear needs uses for four rarities")
        check_arsenal_item(it, where, items)
        if f in ("spell", "food"):
            check(len(it.get("charges", [])) == 4, where, "needs charges for four rarities")
        if f in ("spell", "food", "pet"):
            check(len(it.get("power", [])) == 4, where, "needs power for four rarities")
        if f == "rune":
            # a good side and a bad side, each one or more stats with a value per condition
            check(isinstance(it.get("color"), str) and it["color"].startswith("#"), where, "a rune needs a color")
            for side in ("good", "bad"):
                stats = it.get(side, [])
                check(isinstance(stats, list) and len(stats) >= 1, where, f"a rune needs at least one {side} stat")
                for st in stats if isinstance(stats, list) else []:
                    check(st.get("stat") in RUNE_STATS, where, f"{side} stat \"{st.get('stat')}\" isn't one the game knows")
                    v = st.get("v", [])
                    check(len(v) == 4 and all(num(x, -100, 1000) and x != 0 for x in v), where, f"{side} stat {st.get('stat')} needs four non-zero values, one per condition")
        if f == "vessel":
            h, a = it.get("hearts", []), it.get("armor", [])
            check(len(h) == 4 and len(a) == 4 and all(num(x, 0, 12) for x in h + a), where, "a vessel needs hearts and armor for four rarities (0-12)")
            check(all(x + y > 0 for x, y in zip(h, a)), where, "every rarity of a vessel must hold something")
            check(all(x * 2 <= 99 and y * 4 <= 99 for x, y in zip(h, a)), where, "a vessel holds at most 49 hearts or 24 plates (the save counts its pieces up to 99)")
    for f, count in per.items():
        if f in SPECIAL_FAMILIES:
            check(count >= 1, rel, f"family {f} needs at least one item")
            continue
        check(count >= 5, rel, f"family {f} has {count} items; the merchant needs at least 5")
    # build 52: armor sets, two pieces each (a helmet and a body piece)
    for st in items.get("armorSets", []):
        where = f"{rel} armor set {st.get('id')}"
        pieces = [i for i in items.get("items", []) if i.get("set") == st.get("id")]
        check(sorted(i.get("piece") for i in pieces) == ["body", "helmet"], where, "needs exactly one helmet and one body piece")
        check(st.get("tier") in {t.get("tier") for t in items.get("armorTiers", [])}, where, "tier isn't one of armorTiers")
        for line in st.get("bonus", []) + st.get("bad", []):
            check(line.get("stat") in TRINKET_STATS and num(line.get("v"), -1000, 1000), where, f"stat line {line} unknown")
    check(len(items.get("statsByRarity", [])) == 4, rel, "statsByRarity needs four numbers, one per rarity")
    for l in items.get("loot", []):
        check(num(l.get("value"), 1, 1e6) and num(l.get("island"), 1, 5), f"{rel} loot {l.get('id')}", "needs a value and an island (1-5)")
        check(l.get("grade") in ("common", "uncommon", "rare"), f"{rel} loot {l.get('id')}", "grade must be common, uncommon or rare")


# build 51: the workshops (content/campaign/crafting.json)
TRINKET_STATS = RUNE_STATS | {"thiefGuard", "stingGuard", "coldWard", "heatWard"}


def check_hit(hit, where):
    if hit is None:
        return
    check(isinstance(hit, dict) and isinstance(hit.get("tags"), list) and hit["tags"] and all(t in TAGS for t in hit["tags"]), where, f"hit tags {hit} must be a list of damage tags")
    fam = hit.get("family") if isinstance(hit, dict) else None
    if fam is not None:
        check(fam in NARROW and any(DAMAGE_WORDS[t][1] == fam for t in hit.get("tags", []) if t in DAMAGE_WORDS), where, f"hit family \"{fam}\" must be the narrow word of one of its tags")


def check_rules_tags(rules, where):
    seen = {}
    for k in ("immune", "resist", "weak"):
        for t in rules.get(k, []) or []:
            check(t in TAGS, where, f"{k} has unknown tag \"{t}\"")
            check(t not in seen, where, f"{t} is listed under {seen.get(t)} and {k}")
            seen[t] = k


def check_arsenal_item(it, where, items):
    """Build 52's fields on an item: piece, acts, hit, damage, traits, stats, set, grants, snips."""
    by_id = {i.get("id"): i for i in items.get("items", [])}
    f = it.get("family")
    if "piece" in it:
        check(f == "gear" and it["piece"] in PIECES, where, "piece must be weapon, helmet or body, on gear")
    if "acts" in it:
        a = by_id.get(it["acts"])
        check(a is not None and a.get("family") == f and "acts" not in a, where, f"acts \"{it['acts']}\" must be an old item of the same family")
    check_hit(it.get("hit"), where)
    if it.get("piece") == "weapon":
        check(it.get("acts", it.get("id")) == "sword", where, "a weapon acts as the sword")
        check(len(it.get("damage", [])) == 4 and all(num(x, 0, 10) for x in it.get("damage", [])), where, "a weapon needs a damage level for four rarities")
    for t in it.get("traits", []):
        check(t in WEAPON_TRAITS, where, f"trait \"{t}\" unknown")
    stats = it.get("stats")
    if stats is not None:
        check(isinstance(stats, list) and 1 <= len(stats) <= 4, where, "stats: one to four lines (rarity sets how many count)")
        for line in stats:
            check(line.get("stat") in TRINKET_STATS and num(line.get("v"), -1000, 1000) and line.get("v") != 0, where, f"stat line {line} unknown")
    if it.get("piece") in ("helmet", "body"):
        check(it.get("set") in {s.get("id") for s in items.get("armorSets", [])}, where, f"set \"{it.get('set')}\" isn't in armorSets")
        check(isinstance(stats, list) and len(stats) == 4, where, "an armor piece needs four stat lines (one per rarity)")
    for g in it.get("grants", []):
        check(g.get("stat") in DAMAGE_STATS and num(g.get("amount"), 0.01, 1000), where, f"grants {g} needs a damage stat and an amount")
def check_crafting(cr, items):
    rel = "crafting.json"
    if not cr or not items:
        return
    loot = {l["id"]: l.get("grade") for l in items.get("loot", [])}
    food = {i["id"] for i in items.get("items", []) if i.get("family") == "food"}
    seen = set()
    # build 53: a trinket is named by its stats: its major stat's first name, its minor stat's second name
    names = set()
    tw = cr.get("trinketWords", {})
    for k, w in tw.items():
        check(k in TRINKET_STATS, f"{rel} trinketWords", f"\"{k}\" isn't a stat the game knows")
        check(isinstance(w, list) and len(w) == 2 and all(isinstance(x, str) and x for x in w), f"{rel} trinketWords", f"\"{k}\" needs [first name, second name]")
    arm = cr.get("armory") or {}
    check(set(arm.get("trinketScale", {})) == {"common", "uncommon", "rare", "legendary"}, f"{rel} armory", "trinketScale needs a number for each rarity")
    rw = arm.get("trinketRarity", [])
    check(len(rw) == 4 and all(isinstance(r, list) and len(r) == 4 and sum(r) > 0 for r in rw), f"{rel} armory", "trinketRarity needs four chances for each of the four tiers")
    for t in cr.get("trinkets", []):
        where = f"{rel} trinket {t.get('id')}"
        check(t.get("id") not in seen, where, "id used twice"); seen.add(t.get("id"))
        # two lines, a major one and a minor one
        mj, mn = t.get("major") or {}, t.get("minor") or {}
        check(mj.get("stat") in TRINKET_STATS and mn.get("stat") in TRINKET_STATS, where, f"needs a major and a minor line with stats the game knows ({mj.get('stat')}, {mn.get('stat')})")
        check(mj.get("stat") != mn.get("stat"), where, "its major and minor lines must be different stats")
        check(num(mj.get("v"), -1000, 1000) and num(mn.get("v"), -1000, 1000), where, "major and minor need numbers")
        check(mj.get("stat") in tw and mn.get("stat") in tw, where, f"both its stats need a first and a second name in trinketWords ({mj.get('stat')}, {mn.get('stat')})")
        check("name" not in t, where, "a trinket's name comes from its stats (trinketWords): drop \"name\"")
        if mj.get("stat") in tw and mn.get("stat") in tw:
            nm = f"{tw[mj['stat']][0]} {tw[mn['stat']][1]}"
            check(nm not in names, where, f"its name \"{nm}\" is another trinket's too: change a stat or a word")
            names.add(nm)
        for line in (mj, mn):
            if str(line.get("stat", "")).endswith(".immunity"):
                check(line.get("v") == 1, where, "an immunity is on or off: give it v 1")
        m = t.get("needs", [])
        check(all(x in loot for x in m), where, "needs a material that isn't in items.json loot")
        g = [loot.get(x) for x in m]
        check(3 <= len(m) <= 5 and len(set(m)) == len(m), where, "needs three to five different materials")
        check(g.count("rare") == 1 and g.count("uncommon") == 1, where, "needs exactly one rare and one uncommon material")
        check(t.get("tier") in (1, 2, 3, 4), where, "tier must be 1-4")
    for p in cr.get("parts", []):
        where = f"{rel} part {p.get('id')}"
        check(p.get("id") not in seen, where, "id used twice"); seen.add(p.get("id"))
        m = p.get("needs", [])
        g = [loot.get(x) for x in m]
        check(all(x in loot for x in m) and len(set(m)) == 5, where, "needs five different materials from items.json loot")
        check(g.count("rare") == 2 and 1 <= g.count("uncommon") <= 2, where, "needs two rare and one or two uncommon materials")
        check(p.get("fits") in ("armor", "weapon"), where, "fits must be armor or weapon")
        check(num(p.get("hours"), 2, 8), where, "takes 2 to 8 hours")
    ing = {i["id"] for i in cr.get("ingredients", [])}
    for r in cr.get("recipes", []):
        where = f"{rel} recipe {r.get('id')}"
        check(r.get("makes") in food, where, "makes a snack that isn't in items.json")
        check(all(x in ing for x in r.get("needs", [])), where, "needs an ingredient that isn't listed")
        check(r.get("source") in ("shop", "find", "quest"), where, "source must be shop, find or quest")


# build 52: content/campaign/foes.json
def check_foes(fo, island_ids):
    rel = "foes.json"
    if not fo:
        check(False, rel, "missing")
        return
    for cause, h in fo.get("hits", {}).items():
        if cause.startswith("_"):
            continue
        check(cause in CAUSES, f"{rel} hits.{cause}", "isn't a cause the game deals")
        check_hit(h, f"{rel} hits.{cause}")
    for foe, r in fo.get("rules", {}).items():
        if not foe.startswith("_"):
            check_rules_tags(r, f"{rel} rules.{foe}")
    ids = set()
    for e in fo.get("enemies", []):
        where = f"{rel} enemy {e.get('id')}"
        check(e.get("id") and e["id"] not in ids, where, "needs a unique id")
        ids.add(e.get("id"))
        check(e.get("kind") in ENEMY_KINDS, where, f"kind must be one of {sorted(ENEMY_KINDS)}")
        check(e.get("name") and e.get("label") and e.get("fact"), where, "needs a name, a label and a fact")
        check(num(e.get("bite"), 0, 3) and num(e.get("steal", 0), 0, 1000), where, "bite (hearts) and steal (points) out of range")
        check(all(i in island_ids for i in e.get("islands", [])) and e.get("islands"), where, "islands must be island ids")
        check(e.get("explicit") or num(e.get("from", 6), 1, 15), where, "from must be a level 1-15 (or the enemy is \"explicit\": only the levels that list it have it)")
        check_hit(e.get("hit"), where)
        check_rules_tags(e, where)
        if e.get("drops"):
            check(e["drops"] in {"ember", "frost", "acid", "lava"}, where, "drops must be ember, frost, acid or lava")
        check(e.get("id") in CAUSES, where, "add its id to CAUSES at the top of this file")
    for p in fo.get("powerups", []):
        where = f"{rel} power-up {p.get('id')}"
        check(p.get("id") and p["id"] not in ids, where, "needs a unique id")
        ids.add(p.get("id"))
        check(num(p.get("secs"), 1, 60), where, "secs 1-60")
        check(p.get("grants") and all(g.get("stat") in DAMAGE_STATS and num(g.get("amount"), 0.01, 100) for g in p.get("grants", [])), where, "grants must be damage stats with an amount")
        check(p.get("said") and p.get("label"), where, "needs a label and what it says")
    traits = fo.get("traits", {})
    for isl, b in fo.get("bosses", {}).items():
        if isl.startswith("_"):
            continue
        where = f"{rel} bosses.{isl}"
        check(isl in island_ids, where, "isn't an island")
        check_rules_tags(b.get("rules", {}), where)
        for t in b.get("traits", []):
            check(t.get("id") in BOSS_TRAITS, where, f"trait \"{t.get('id')}\" isn't a boss trait (champions' abilities are theirs alone)")
            check(t.get("id") in traits, where, f"trait \"{t.get('id')}\" has no words in traits")
    check(set(k for k in fo.get("bosses", {}) if not k.startswith("_")) == set(island_ids), rel, "every island's boss needs its traits")
    seen = set()
    for c in fo.get("champions", []):
        where = f"{rel} champion {c.get('id')}"
        check(c.get("id") and c["id"] not in seen, where, "needs a unique id")
        seen.add(c.get("id"))
        check(c.get("island") in island_ids, where, "island must be an island id")
        check(num(c.get("hearts"), 1, 12) and num(c.get("length"), 3, 20) and num(c.get("speed"), 0.2, 2) and num(c.get("stamina"), 5, 200), where, "hearts, length, speed and stamina out of range")
        check(isinstance(c.get("drain"), list) and len(c["drain"]) >= 1, where, "needs a drain")
        abil = [a.get("id") for a in c.get("abilities", [])]
        check(all(a in CHAMPION_ABILITIES and a in traits for a in abil), where, f"abilities {abil} unknown")
        check(any(traits.get(a, {}).get("champion") for a in abil), where, "needs at least one champion-only ability")
        check_rules_tags(c.get("rules", {}), where)
    check({c.get("island") for c in fo.get("champions", [])} == set(island_ids), rel, "every island needs a champion")


def check_upgrades(ups, island_ids):
    rel = "upgrades.json"
    trees = ups.get("trees", {})
    check(set(trees) == set(island_ids), rel, "needs exactly one tree per island")
    seen = set()
    for isl, tree in trees.items():
        for u in tree.get("upgrades", []):
            where = f"{rel} {isl}.{u.get('id')}"
            check(u.get("id") in UPGRADE_IDS, where, "the game has no effect for this upgrade id")
            check(u.get("id") not in seen, where, "duplicate id")
            seen.add(u.get("id"))
            v, p = u.get("values", []), u.get("prices", [])
            check(len(v) == len(p) + 1, where, "values needs exactly one more entry than prices (values[0] is unbought)")
            check(p == sorted(p) and all(num(x, 1, 1e7) for x in p), where, "prices must rise")
            check("{v}" in u.get("text", ""), where, "text needs a {v} for the value")


def check_rules(rules):
    rel = "rules.json"
    r = rules.get("rewards", {})
    check(num(r.get("winBase"), 1, 1e6) and num(r.get("replayShare"), 0, 1), rel, "rewards need winBase and replayShare (0-1)")
    check(num(r.get("pointsPerCoin"), 1, 1e6), rel, "rewards.pointsPerCoin must be 1 or more (points per coin, paid win or lose)")
    check(num(r.get("canisterShare"), 0, 1), rel, "rewards.canisterShare must be 0-1 (how many loot drops are heart canisters)")
    sn = rules.get("snake", {})
    check(num(sn.get("hearts"), 0, 20) and num(sn.get("armorCap"), 0, 20) and num(sn.get("armorPieces"), 1, 8), rel, "snake needs hearts (0-20), armorCap (0-20) and armorPieces (1-8)")
    dmg = rules.get("damage", {})
    for k in ("crush", "pierce"):
        for cause in dmg.get(k, []):
            check(cause in CAUSES, rel, f"damage.{k}: the game has no hit called \"{cause}\"")
    check(not set(dmg.get("crush", [])) & set(dmg.get("pierce", [])), rel, "a hit can't both crush and pierce armor")
    m = rules.get("merchant", {})
    check(num(m.get("stockSize"), 1, 5), rel, "merchant.stockSize must be 1-5 (a family has 5 items)")
    check(num(m.get("restockMinutes"), 10, 10080), rel, "merchant.restockMinutes must be 10-10080")
    c = rules.get("challenge", {})
    check(num(c.get("days"), 1, 60), rel, "challenge.days must be 1-60")
    check(num(c.get("levels"), 1, 5), rel, "challenge.levels must be 1-5")
    check(num(c.get("levelsMax", c.get("levels")), c.get("levels", 1), 5), rel, "challenge.levelsMax must be from challenge.levels to 5")
    check(all(isinstance(p, str) and p.strip() for p in c.get("plots", [])), rel, "challenge.plots must be lines of text")
    check(sum(p.get("weight", 0) for p in c.get("pool", [])) > 0, rel, "the challenge pool needs weights")
    for p in c.get("pool", []):
        check(p.get("kind") in ("gems", "item", "canister", "skin", "theme", "spellpts", "recipe"), rel, f"challenge pool kind \"{p.get('kind')}\" unknown")
    b = rules.get("bank", {})
    check(num(b.get("rateToPrev"), 1, 1000) and num(b.get("feePrev"), 0, 1e6) and num(b.get("snaycoinPerGem"), 1, 1e9), rel, "bank needs rateToPrev, feePrev and snaycoinPerGem")
    for a in rules.get("achievements", []):
        check(a.get("stat") in STATS, f"{rel} achievement {a.get('id')}", f"stat \"{a.get('stat')}\" isn't tracked")
        check(num(a.get("need"), 1, 1e9) and num(a.get("gems"), 0, 1e5), f"{rel} achievement {a.get('id')}", "needs need and gems")


def main():
    index = os.path.join(CAMP, "islands", "_index.dat")
    with open(index, encoding="utf-8") as f:
        ids = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
    check(len(ids) == 5, "islands/_index.dat", f"lists {len(ids)} islands; the campaign is built for 5")
    fams, curs = set(), set()
    for i, isl_id in enumerate(ids):
        rel = f"islands/{isl_id}.json"
        isl = load(rel)
        if isl:
            check(isl.get("id") == isl_id, rel, "id doesn't match the file name")
            check(isl.get("n") == i + 1, rel, f"n should be {i + 1} (its place in _index.dat)")
            check_island(isl, rel, fams, curs)
    check_items(load("items.json"))
    check_crafting(load("crafting.json"), load("items.json"))
    check_upgrades(load("upgrades.json"), ids)
    check_rules(load("rules.json"))
    check_foes(load("foes.json"), ids)
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  " + p)
        return 1
    print("campaign data OK: 5 islands, 75 levels")
    return 0


if __name__ == "__main__":
    sys.exit(main())
