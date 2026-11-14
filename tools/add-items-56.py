#!/usr/bin/env python3
"""
Build 56's new things, added to content/campaign/items.json (and the rune tables). Safe to run twice: an id
that's already in the file is left alone, so a hand edit survives. After it: python tools/check-campaign.py,
python tools/sign-content.py, and python tools/textures/items56-art.py for the pictures.

    6 weapons   cutlass, halberd, trident, scythe, rapier, cleaver
    8 armor     four sets of a helmet and a body piece: Tidecaller, Obsidian, Runeweave, Gleaner's
    6 spells    tidal surge, ember rain, shadow step, storm aegis, harvest call, hex bolt
    4 snacks    harvest pie, smoked fish, bee balm, crunch bar
    6 familiars ferret, raven, mole, axolotl, bat, pup
    6 runes     mending, the anvil, thorns, the tide, the scholar, the hunt
Each borrows an old item's behavior with `acts`, like build 55's twenty.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "content", "campaign", "items.json")
d = json.load(open(P, encoding="utf-8"))
have = {i["id"] for i in d["items"]}
added = []


new_items = []


def add(item):
    if item["id"] in have:
        return
    new_items.append(item)
    have.add(item["id"])
    added.append(item["id"])


def S(stat, v):
    return {"stat": stat, "v": v}


# ----------------------------------------------------------------------------- weapons
def weapon(id, name, tags, family, traits, uses, damage, stats, does, strong, weak, legend="Three harder on every blow."):
    add({"id": id, "family": "gear", "piece": "weapon", "acts": "sword", "name": name, "uses": uses,
         "hit": {"tags": tags, "family": family}, "damage": damage, "traits": traits, "stats": stats,
         "does": does, "strong": strong, "weak": weak, "legend": legend})


weapon("cutlass", "Reef Cutlass", ["slashing"], "edge", ["cleave"], [1, 2, 4, 5], [1, 1, 2, 2],
       [S("edge.resistance", 6), S("speed", 3), S("slashing.resistance", 5), S("graceSecs", 0.25)],
       "A salt-pitted sailor's blade. Kills what you run into, and takes the one beside it.",
       "Fleas, moles, brambles, anything soft", "Crabs and knights shrug off an edge.", "Two harder on every blow.")
weapon("gatehalberd", "Gatehouse Halberd", ["piercing", "slashing"], "barb", ["pierce", "cleave"], [1, 3, 5, 5], [1, 2, 2, 3],
       [S("slashing.resistance", 8), S("piercing.resistance", 8), S("edge.resistance", 6), S("graceSecs", 0.25)],
       "An axe and a spear on one pole. Kills what you run into and what's beside it, and takes an extra piece of a boss's armor.",
       "Wasps, bees, bosses in their armor, the Keep", "Two tags, two ways to be resisted: tin knights shrug off both.")
weapon("tidetrident", "Tide Trident", ["piercing", "ice"], "rime", ["pierce", "chill"], [1, 3, 5, 5], [1, 1, 2, 3],
       [S("ice.resistance", 10), S("rime.resistance", 8), S("piercing.resistance", 6), S("speed", 3)],
       "Three prongs of cold iron. Spears what you run into, chills what's around it, and freezes a boss it strikes.",
       "Fire-born foes, bees, fleas, the Reef", "Frost sprites and ice floes don't care about its cold.")
weapon("scythe", "Reaper's Scythe", ["slashing", "venom"], "toxin", ["cleave", "toxin"], [1, 3, 5, 5], [1, 2, 2, 3],
       [S("venom.resistance", 10), S("toxin.resistance", 8), S("slashing.resistance", 6), S("applePoints", 4)],
       "A long curved blade with a green sheen. Cuts a swath, and a boss it strikes tires half again as fast.",
       "Swarms, locusts, moles, Gorgemaw", "Vipers, urchins and wraiths are as poisonous as it is.")
weapon("arcrapier", "Arc Rapier", ["electricity", "piercing"], "spark", ["shock", "pierce"], [1, 3, 4, 5], [1, 1, 2, 3],
       [S("electricity.resistance", 10), S("spark.resistance", 8), S("graceSecs", 0.5), S("speed", 4)],
       "A needle of blue steel that crackles. Kills what you run into, and a kill zaps the next nearest enemy.",
       "Knights in tin, crabs, scorpions, groups", "Spark beetles and the Stormwright laugh at lightning.")
weapon("cleaver", "Magma Cleaver", ["fire", "slashing"], "ember", ["burn", "cleave"], [1, 3, 5, 6], [1, 2, 3, 4],
       [S("fire.resistance", 14), S("ember.resistance", 10), S("heatWard", 10), S("edge.resistance", 8)],
       "A slab of glowing iron. Cuts down what you run into and what's beside it, and sets a boss alight.",
       "Brambles, ghosts, mantises, bosses of ice and wood", "The Crown's fire-born things don't feel the heat.", "Four harder on every blow.")

# ----------------------------------------------------------------------------- armor: four sets
SETS = [
    {"id": "tide", "name": "Tidecaller", "tier": 3, "bonus": [S("ice.resistance", 10), S("graceSecs", 0.5)], "bad": [S("fire.weakness", 15)]},
    {"id": "obsidian", "name": "Obsidian", "tier": 4, "bonus": [S("fire.resistance", 12), S("slashing.resistance", 8)], "bad": [S("ice.weakness", 25)]},
    {"id": "runeweave", "name": "Runeweave", "tier": 3, "bonus": [S("spellPower", 12), S("spellCharges", 1)], "bad": [S("slashing.weakness", 20)]},
    {"id": "gleaner", "name": "Gleaner's", "tier": 2, "bonus": [S("applePoints", 10), S("loot", 10)], "bad": [S("piercing.weakness", 15)]},
]
have_sets = {x["id"] for x in d["armorSets"]}
new_sets = [x for x in SETS if x["id"] not in have_sets]


def piece(id, set_id, kind, name, stats, does, strong, weak):
    add({"id": id, "family": "gear", "piece": kind, "set": set_id, "name": name, "stats": stats, "does": does, "strong": strong, "weak": weak, "legend": "All four of its lines."})


piece("shellhelm", "tide", "helmet", "Tidecaller Helm", [S("ice.resistance", 10), S("rime.resistance", 8), S("graceSecs", 0.25), S("speed", 3)],
      "A helm of blue-green shell with a fin down the back.", "Ice, frost, the Reef", "Wear the whole set and fire finds the gaps: Fire Weakness.")
piece("tidecoat", "tide", "body", "Tidecaller Coat", [S("ice.resistance", 12), S("electricity.resistance", 8), S("coldWard", 10), S("points", 3)],
      "A coat of overlapping scales that drips whatever the weather.", "Ice, lightning, spellcasters", "Wear the whole set and fire finds the gaps: Fire Weakness.")
piece("obsidianhelm", "obsidian", "helmet", "Obsidian Helm", [S("fire.resistance", 12), S("ember.resistance", 10), S("heatWard", 10), S("edge.resistance", 8)],
      "A black glass helm with a crest of cooled lava.", "Fire, embers, lava, the Crown", "Wear the whole set and cold bites hard: Ice Weakness.")
piece("obsidianplate", "obsidian", "body", "Obsidian Plate", [S("fire.resistance", 14), S("slashing.resistance", 10), S("heatWard", 12), S("armor", 1)],
      "Plates of volcanic glass, sharp-edged and warm to the touch.", "Fire, blades, bombs", "Wear the whole set and cold bites hard: Ice Weakness.")
piece("runehood", "runeweave", "helmet", "Runeweave Hood", [S("spellPower", 8), S("castCooldown", -10), S("electricity.resistance", 6), S("freeCasts", 1)],
      "A hood stitched with a running line of glowing glyphs.", "Spellcasters", "Wear the whole set and every blade finds you: Slashing Weakness.")
piece("runerobe", "runeweave", "body", "Runeweave Robe", [S("spellCharges", 1), S("spellPower", 10), S("castCooldown", -15), S("spark.resistance", 8)],
      "A long robe woven with ink that never dries.", "Spell-heavy runs, the Spire", "Wear the whole set and every blade finds you: Slashing Weakness.")
piece("gleanerhat", "gleaner", "helmet", "Gleaner's Hat", [S("applePoints", 6), S("loot", 10), S("graceSecs", 0.25), S("points", 2)],
      "A wide straw hat with a ribbon, sun-bleached and comfortable.", "Apple goals, finding trinkets", "Wear the whole set and barbs find you: Piercing Weakness.")
piece("gleanersack", "gleaner", "body", "Gleaner's Smock", [S("applePoints", 8), S("loot", 12), S("money", 4), S("stingGuard", 10)],
      "A canvas smock with pockets for everything the harvest drops.", "Farming, apples, the Hollow", "Wear the whole set and barbs find you: Piercing Weakness.")

# ----------------------------------------------------------------------------- spells
def spell(id, name, acts, charges, power, unit, does, strong, weak, legend, hit=None, grants=None, traits=None):
    it = {"id": id, "family": "spell", "acts": acts, "name": name, "charges": charges, "power": power, "unit": unit, "does": does, "strong": strong, "weak": weak, "legend": legend}
    if hit:
        it["hit"] = hit
    if grants:
        it["grants"] = grants
    if traits:
        it["traits"] = traits
    add(it)


spell("tidalsurge", "Tidal Surge", "frost", [1, 1, 2, 3], [3, 4, 5, 7], "s", "A wave rolls out from you and freezes every hazard and enemy it passes through.",
      "Swarms, chasers, the Reef", "A boss only freezes for half as long.", "A frozen boss loses stamina while it's frozen.", hit={"tags": ["ice"], "family": "rime"}, traits=["chill"])
spell("emberrain", "Ember Rain", "fireball", [1, 2, 3, 4], [2, 2, 3, 4], "targets", "Fire falls on the nearest enemies and hazards, more of them than a single fireball.",
      "Swarms, brambles, ghosts, boss armor", "Can't burn rocks or walls, and the Crown laughs at it.", "Each ember splits in two.", hit={"tags": ["fire"], "family": "ember"}, traits=["burn"])
spell("shadowstep", "Shadow Step", "blink", [2, 2, 3, 4], [4, 5, 6, 8], "squares", "You slip forward through whatever is in the way, as a shadow.",
      "Getting out of a corner, over gates and walls", "Only goes straight ahead, and it won't drop you in a wall.", "You're untouchable for a second after landing.")
spell("stormaegis", "Storm Aegis", "forcefield", [1, 2, 2, 3], [3, 4, 5, 7], "s", "A crackling dome: it soaks up hazards and enemies, and while it holds you have Electricity Immunity.",
      "Lightning, spark beetles, turrets", "Walls shatter it at once, and fire-born bosses walk right through it.", "Also shocks anything it soaks up.",
      hit={"tags": ["electricity"], "family": "spark"}, grants=[{"stat": "electricity.immunity", "amount": 1}])
spell("harvestcall", "Harvest Call", "magnet", [1, 2, 3, 4], [5, 7, 9, 13], "s", "Apples slide toward your head from across the board, and thieves lose interest.",
      "Apple goals, crows, big boards", "No protection at all.", "Called apples are worth double.")
spell("hexbolt", "Hex Bolt", "fireball", [1, 2, 3, 4], [1, 1, 1, 2], "targets", "A bolt of green fire seeks the nearest enemy and poisons it. On a boss it cracks a heart of armor.",
      "Knights, mantises, bees, the Spire", "Vipers, wraiths and urchins are poisonous themselves.", "Each bolt splits and seeks two targets.", hit={"tags": ["venom"], "family": "toxin"}, traits=["toxin"])

# ----------------------------------------------------------------------------- snacks
def snack(id, name, acts, charges, power, unit, does, strong, weak, legend):
    add({"id": id, "family": "food", "acts": acts, "name": name, "charges": charges, "power": power, "unit": unit, "does": does, "strong": strong, "weak": weak, "legend": legend})


snack("harvestpie", "Harvest Pie", "stew", [1, 2, 2, 3], [1, 1, 2, 2], "hearts", "Eat it to heal hearts.", "Long levels and boss fights", "Can't heal past your full hearts.", "Heals three hearts.")
snack("smokedfish", "Smoked Fish", "jerky", [1, 2, 3, 4], [1, 1, 2, 2], "charges", "Eat it to put charges back in your spell.", "Spell-heavy runs", "Does nothing without a spell, or if it's fully charged.", "Three charges back.")
snack("beebalm", "Bee Balm", "jelly", [1, 1, 2, 3], [4, 6, 7, 9], "s", "Eat it and enemies lose interest in you for a few seconds.", "Bees, wasps, hounds, locusts", "Hazards don't care what you ate.", "Enemies that touch you while it lasts are stunned.")
snack("crunchbar", "Crunch Bar", "candy", [1, 1, 2, 3], [2, 2, 3, 4], "smashes", "Eat it and your head smashes straight through the next rocks or hazards it hits.", "Rocks, boulders, brambles, mines", "Walls are still walls, and enemies still bite.", "Every smash is worth points.")

# ----------------------------------------------------------------------------- familiars
def pet(id, name, acts, power, unit, stats, does, strong, weak, legend, **extra):
    it = {"id": id, "family": "pet", "acts": acts, "name": name, "power": power, "unit": unit, "stats": stats, "does": does, "strong": strong, "weak": weak, "legend": legend}
    it.update(extra)
    add(it)


pet("ferret", "Rascal the Ferret", "firefly", [10, 8, 6, 5], "s", [S("applePoints", 5), S("loot", 8), S("speed", 3), S("piercing.resistance", 8)],
    "Darts at a nearby apple every few seconds and brings it back to you.", "Apple goals, crows' thieving", "Can't fight anything.", "Fetched apples count double, and Piercing Resistance.", range=[2, 2, 3, 3])
pet("raven", "Mooncrow", "firefly", [10, 9, 8, 7], "s", [S("electricity.resistance", 8), S("spark.resistance", 6), S("points", 3), S("graceSecs", 0.5)],
    "Perches on your shoulder and lights the dark around your head.", "Blackout levels, caves, gargoyles", "Does nothing in the light.", "A wide light, and Spark Resistance.")
pet("digger", "Digger the Mole", "crab", [11, 9, 7, 5], "s", [S("edge.resistance", 8), S("slashing.resistance", 8), S("graceSecs", 0.25), S("edge.immunity", 1)],
    "Pops up and snaps whatever gets close: a gnasher, a hound, a flea.", "Burrowers, hounds, fleas", "Won't touch ghosts, fire or anything big.", "Edge Immunity while it's with you.",
    snips=["flea", "wasp", "bee", "hound", "gnasher", "locust", "bramble"], range=[2, 2, 3, 3])
pet("axolotl", "Axel the Axolotl", "turtle", [36, 29, 22, 16], "s", [S("toxin.resistance", 10), S("ice.resistance", 8), S("coldWard", 10), S("rime.immunity", 1)],
    "Takes a hit for you, then needs a while to grow it back.", "Any one hit from a hazard or enemy", "Slow to recover, and it can't stop walls.", "Starts every level ready, plus one extra, and Rime Immunity.")
pet("bat", "Echo the Bat", "puffer", [2, 3, 3, 4], "squares", [S("spark.resistance", 8), S("electricity.resistance", 8), S("speed", 3), S("rime.resistance", 6)],
    "Screeches at chasing enemies and shoves them away from your head.", "Chasers, hounds, ambushers, bosses", "Hazards that sit still don't care.", "Bosses lose stamina when it shoves them.")
pet("pup", "Biscuit the Pup", "firefly", [9, 7, 6, 5], "s", [S("barb.resistance", 8), S("loot", 10), S("applePoints", 4), S("barb.immunity", 1)],
    "Sniffs out a nearby apple every few seconds and fetches it.", "Apple goals, finding trinkets", "Can't fight anything, and it doesn't light the dark.", "Fetched apples count double, and Barb Immunity.", range=[2, 2, 3, 3])

# ----------------------------------------------------------------------------- runes
def rune(id, name, color, good, bad, does, strong, weak):
    add({"id": id, "family": "rune", "name": name, "color": color, "good": good, "bad": bad, "does": does, "strong": strong, "weak": weak})


rune("mending", "Rune of Mending", "#c8f0ff", [S("graceSecs", [0.5, 0.75, 1, 1.5])], [S("applePoints", [-20, -15, -12, -10])],
     "After every hit you're safe a little longer.", "Busy boards, boss fights", "Apples are worth less.")
rune("anvil", "Rune of the Anvil", "#e8a030", [S("armor", [1, 1, 1, 2])], [S("speed", [10, 8, 6, 6])],
     "Extra armor plates in every level.", "Hits you can't dodge, the Crown", "You move faster.")
rune("thorn", "Rune of Thorns", "#5ac83a", [S("piercing.resistance", [20, 30, 40, 55]), S("barb.resistance", [5, 10, 10, 15])], [S("slashing.weakness", [40, 30, 25, 20])],
     "Stings, spikes and arrows hurt you less.", "Bees, brambles, turrets, the Hollow", "Blades hurt you more.")
rune("tide", "Rune of the Tide", "#3a82e0", [S("ice.resistance", [15, 25, 35, 45]), S("electricity.resistance", [10, 15, 20, 30])], [S("fire.weakness", [30, 25, 20, 15])],
     "Ice and lightning hurt you less.", "The Reef, the Spire, the climb", "Fire hurts you more.")
rune("scholar", "Rune of the Scholar", "#b98cff", [S("spellPower", [10, 15, 20, 30])], [S("hearts", [-0.5, -0.5, -0.5, -0.5])],
     "Your spells are stronger.", "Spell-heavy runs", "Half a heart less.")
rune("hunt", "Rune of the Hunt", "#ff5a3a", [S("bite", [1, 1, 1, 2])], [S("damage", [30, 25, 20, 15])],
     "Every blow on a boss lands harder.", "Boss fights", "You take more damage.")



def insert_into(lines, key, objs):
    """Adds one line per object at the end of the array `"key": [` (the file keeps one entry to a line)."""
    start = next(i for i, ln in enumerate(lines) if ln.startswith('  "%s": [' % key))
    end = next(i for i in range(start + 1, len(lines)) if lines[i].startswith("  ]"))
    if objs:
        lines[end - 1] = lines[end - 1].rstrip(",") + ","
        lines[end:end] = ["    " + json.dumps(o, ensure_ascii=False) + ("," if k < len(objs) - 1 else "") for k, o in enumerate(objs)]


raw = open(P, encoding="utf-8", newline="").read()
NL, CRLF = chr(10), chr(13) + chr(10)
crlf = CRLF in raw
lines = raw.replace(CRLF, NL).split(NL)
insert_into(lines, "armorSets", new_sets)
insert_into(lines, "items", new_items)
out = NL.join(lines)
json.loads(out)
open(P, "w", encoding="utf-8", newline="").write(out.replace(NL, CRLF) if crlf else out)
print("added", len(added), "items and", len(new_sets), "armor sets")
