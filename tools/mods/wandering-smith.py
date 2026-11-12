"""Builds the Wandering Smith content mod (mods/content/wandering-smith/): its data and its
12x12 pictures, drawn here as letter grids so they're easy to change. Run it again after an edit:

    python tools/mods/wandering-smith.py
"""
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "mods", "content", "wandering-smith")

PAL = {
    "A": "#1a1410",  # outline, like the game's own items
    "S": "#e3e8ee", "s": "#a8b2c0", "d": "#5a6472",          # steel
    "w": "#a8743a", "W": "#5a3a2a",                           # wood
    "G": "#ffd23f", "g": "#c88a1a", "F": "#ff8c1a", "R": "#a8202a", "r": "#e0453a",
    "I": "#dff4ff", "i": "#6fc3f0",                           # ice
    "T": "#7ae8dc", "t": "#2fa598", "u": "#1a6e66",           # tide
    "B": "#efe4c8", "b": "#b9a986", "V": "#8fe04a", "v": "#3d7a1f",
    "P": "#7a4fc8", "p": "#4a2d86", "L": "#9a6430", "l": "#5e3a1a",
}

ICONS = {
    "rapier": [
        "...........A",
        "..........ASA",
        ".........ASA",
        "........ASA.",
        ".......ASA..",
        "......ASA...",
        "..AAAASA....",
        "..AGGSA.....",
        "..AGAGA.....",
        ".AWAAGA.....",
        "AWA..AA.....",
        ".A..........",
    ],
    "halberd": [
        ".......AA...",
        "......AIIA..",
        "....AAiIIAA.",
        "...AiiAIAiiA",
        "...AIiAwAIiA",
        "....AAwAAAA.",
        "....AwA.....",
        "...AwA......",
        "..AwA.......",
        ".AWA........",
        "AWA.........",
        ".A..........",
    ],
    "sunsickle": [
        "....AAAAA...",
        "...AGGGGFA..",
        "..AGAAAAGFA.",
        "..AA....AFA.",
        ".........AA.",
        "........AwA.",
        ".......AwA..",
        "......AwA...",
        ".....AwA....",
        "....AWA.....",
        "...AgA......",
        "....A.......",
    ],
    "trident": [
        ".A...A...A..",
        "ATA.ATA.ATA.",
        "ATA.ATA.ATA.",
        "AtAAATAAAtA.",
        ".AtTTTTTtA..",
        "..AAAtAAA...",
        ".....AtA....",
        ".....AwA....",
        ".....AwA....",
        ".....AwA....",
        ".....AWA....",
        "......A.....",
    ],
    "bonescythe": [
        "....AAAAAA..",
        "...ABBBBBBA.",
        "..ABbAAAAwA.",
        "..AbA...AwA.",
        "..AVA..AwA..",
        "...A..AwA...",
        ".....AwA....",
        "....AwA.....",
        "...AwA......",
        "..AwA.......",
        ".AvA........",
        "..A.........",
    ],
    "kingsbane": [
        ".........AAA",
        "........ASSA",
        ".......ASSdA",
        "......ASSdA.",
        ".....ASSdA..",
        "..A.ASSdA...",
        ".AGAASdA....",
        "..AGGdA.....",
        "..AWAGGA....",
        ".AWA..AGA...",
        "AGA....A....",
        ".A..........",
    ],
    "duelisthat": [
        "............",
        ".......AA...",
        "......ArrA..",
        ".....ArrA...",
        "...AAArAA...",
        "..ApPPAPPA..",
        "..APPPPPPA..",
        ".AAGGGGGGAA.",
        "APPPPPPPPPpA",
        ".AAAAAAAAAA.",
        "............",
        "............",
    ],
    "duelistcoat": [
        "............",
        ".AAAA..AAAA.",
        "ALLLLAALLLLA",
        "ALLLLLLLLLLA",
        "AlLGLLLLGLlA",
        ".AAALLLLAAA.",
        "...ALGGLA...",
        "...ALLLLA...",
        "...AGLLGA...",
        "...AlLLlA...",
        "...AAAAAA...",
        "............",
    ],
    "tidehelm": [
        "............",
        ".....AA.....",
        "....ATTA....",
        "...ATTtTA...",
        "..AAAAAAAA..",
        ".AtTttttttA.",
        "AtTtttttttuA",
        "AtAAAAAAAAuA",
        "AtuAAAAAAuuA",
        "AtuA....AuuA",
        ".AA......AA.",
        "............",
    ],
    "tidemail": [
        "............",
        ".AAAA..AAAA.",
        "AtTttAAttTtA",
        "AtttTttTtttA",
        "AuttttttttuA",
        ".AAAtTTtAAA.",
        "...AtttuA...",
        "...ATtTtA...",
        "...AttttA...",
        "...AutTuA...",
        "...AAAAAA...",
        "............",
    ],
    "boneskull": [
        "............",
        "...AAAAAA...",
        "..ABBBBBBA..",
        ".ABBBBBBBbA.",
        ".ABAABBAAbA.",
        ".ABAVBBAVbA.",
        ".ABBBAABBbA.",
        "..ABBBBBbA..",
        "..ABABBAbA..",
        "...AAAAAA...",
        "............",
        "............",
    ],
    "boneplate": [
        "............",
        ".AAAA..AAAA.",
        "ABBBbAABBBbA",
        "ABBBBBBBBBbA",
        "AbAAAABAAAbA",
        ".AABBBBBbAA.",
        "...AAABAA...",
        "...ABBBbA...",
        "...AAABAA...",
        "...AbBVbA...",
        "...AAAAAA...",
        "............",
    ],
    "sunhelm": [
        "............",
        ".A...AA...A.",
        "AGA.AFFA.AGA",
        "AGGAGFFGAGGA",
        ".AGGGGGGGGA.",
        ".AGgGGGGgGA.",
        "AGGGGGGGGGgA",
        "AGAAAAAAAAgA",
        "AGgAAGGAAggA",
        ".AA.AGgA.AA.",
        "....AAAA....",
        "............",
    ],
    "sunplate": [
        "............",
        ".AAAA..AAAA.",
        "AGGGgAAGGGgA",
        "AGGGGGGGGGgA",
        "AgGGAFFAGGgA",
        ".AAAFrrFAAA.",
        "...AAFFAA...",
        "...AGGGgA...",
        "...AGGGgA...",
        "...AgGGgA...",
        "...AAAAAA...",
        "............",
    ],
}


def hex_rgba(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


def draw(rows):
    im = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
    for y, row in enumerate(rows[:12]):
        for x, ch in enumerate(row[:12]):
            if ch != ".":
                im.putpixel((x, y), hex_rgba(PAL[ch]))
    return im


def st(stat, v):
    return {"stat": stat, "v": v}


WEAPON = {"family": "gear", "piece": "weapon", "acts": "sword", "uses": [1, 3, 5, 5]}
ITEMS = [
    dict(WEAPON, id="rapier", name="Duelist's Rapier", hit={"tags": ["piercing"], "family": "barb"}, damage=[1, 1, 2, 2],
         traits=["pierce"], stats=[st("piercing.resistance", 8), st("graceSecs", 0.25), st("points", 3), st("loot", 8)],
         does="A long, thin blade that finds the gap in any armor. Kills what you run into; against a boss each blow takes an extra piece of armor off.",
         strong="Knightlings, crabs, the Black Knight", weak="Barbed foes (urchins, thistle-beasts) shrug it off.",
         legend="Three harder on every blow, and the lunge."),
    dict(WEAPON, id="halberd", name="Glacier Halberd", hit={"tags": ["piercing", "ice"], "family": "barb"}, damage=[1, 2, 2, 3],
         traits=["pierce", "chill"], stats=[st("piercing.resistance", 10), st("ice.resistance", 10), st("coldWard", 15), st("bossDrain", 10)],
         does="An axe on a pole, spiked and frosted. Kills what you run into, punches through boss armor and freezes the boss a moment.",
         strong="The Cinder Wyrm, Ashwing, armored bosses", weak="Two tags, two chances to be resisted: frost sprites and urchins barely notice.",
         legend="Three harder on every blow."),
    dict(WEAPON, id="sunsickle", name="Sunreaper Sickle", hit={"tags": ["slashing", "fire"], "family": "edge"}, damage=[1, 2, 2, 3],
         traits=["cleave", "burn"], stats=[st("slashing.resistance", 10), st("fire.resistance", 10), st("heatWard", 15), st("applePoints", 4)],
         does="A golden sickle that holds the noon sun. Reaps what you run into and what's beside it, and sets bosses alight.",
         strong="Swarms, brambles, ghosts, Gorgemaw", weak="Fire-born foes don't feel the burn, and crabs turn the edge.",
         legend="Three harder on every blow, and the burn."),
    dict(WEAPON, id="trident", name="Tidecaller Trident", hit={"tags": ["piercing", "electricity"], "family": "spark"}, damage=[1, 2, 2, 3],
         traits=["pierce", "shock"], stats=[st("spark.resistance", 10), st("electricity.resistance", 10), st("spellPower", 8), st("electricity.spells", 10)],
         does="Three prongs and a storm in the shaft. Kills what you run into, the spark leaps to the next enemy, and it goes through boss armor.",
         strong="Leviathorn, eels, crabs, knightlings", weak="Spark beetles drink it up, and the Stormwright is immune.",
         legend="Three harder on every blow."),
    dict(WEAPON, id="bonescythe", name="Ossuary Scythe", hit={"tags": ["slashing", "venom"], "family": "toxin"}, damage=[1, 1, 2, 3],
         traits=["cleave", "toxin"], stats=[st("toxin.resistance", 10), st("venom.resistance", 10), st("stingGuard", 15), st("venom.spells", 10)],
         does="A bone blade dripping green. Cuts down what you run into and what's beside it; a boss it strikes is poisoned and tires faster.",
         strong="Swarms, rival snakes, the Bramble Queen", weak="Venomous foes are used to it, and ghosts don't bleed.",
         legend="Three harder on every blow, and the poison."),
    dict(WEAPON, id="kingsbane", name="Kingsbane Greatsword", hit={"tags": ["slashing"], "family": "edge"}, damage=[2, 2, 3, 4],
         traits=["cleave"], stats=[st("slashing.resistance", 12), st("edge.resistance", 12), st("bossDrain", 15), st("hearts", 0.5)],
         does="A sword as long as you are. Kills what you run into, takes the ones beside it too, and hits bosses hardest of all.",
         strong="Every boss, every swarm", weak="Heavy: hitting a hazard snaps it like any blade, and walls stop it cold.",
         legend="Four harder on every blow."),

    {"id": "duelisthat", "family": "gear", "piece": "helmet", "set": "duelist", "name": "Feathered Duelist's Hat",
     "stats": [st("graceSecs", 0.25), st("points", 3), st("piercing.resistance", 6), st("loot", 8)],
     "does": "A wide hat with a red plume. Looks good, dodges better.", "strong": "Quick pokes", "weak": "Decent armor: it's a hat.",
     "legend": "All four of its lines."},
    {"id": "duelistcoat", "family": "gear", "piece": "body", "set": "duelist", "name": "Duelist's Brigandine",
     "stats": [st("piercing.resistance", 8), st("barb.resistance", 8), st("applePoints", 4), st("thiefGuard", 15)],
     "does": "Leather lined with little brass plates.", "strong": "Spines, stings, thieves", "weak": "Decent armor: fire goes right through leather.",
     "legend": "All four of its lines."},
    {"id": "tidehelm", "family": "gear", "piece": "helmet", "set": "tidewarden", "name": "Tidewarden Helm",
     "stats": [st("electricity.resistance", 12), st("spark.resistance", 12), st("ice.resistance", 8), st("electricity.spells", 10)],
     "does": "A finned helm from the sea-guard of the reef.", "strong": "Sparks, eels, storms", "weak": "Good armor, but salt-crusted: fire bakes it.",
     "legend": "All four of its lines."},
    {"id": "tidemail", "family": "gear", "piece": "body", "set": "tidewarden", "name": "Tidewarden Scalemail",
     "stats": [st("electricity.resistance", 12), st("spark.resistance", 12), st("coldWard", 15), st("spark.immunity", 1)],
     "does": "Fish-scale mail that drinks lightning.", "strong": "Sparks, eels, storms", "weak": "Good armor, but salt-crusted: fire bakes it.",
     "legend": "Spark Immunity."},
    {"id": "boneskull", "family": "gear", "piece": "helmet", "set": "ossuary", "name": "Ossuary Skullcap",
     "stats": [st("venom.resistance", 15), st("toxin.resistance", 15), st("slashing.resistance", 8), st("stingGuard", 15)],
     "does": "Something's skull, worn as a helmet. Something big.", "strong": "Poison, stings, blades", "weak": "Fine armor, and dry as tinder.",
     "legend": "All four of its lines."},
    {"id": "boneplate", "family": "gear", "piece": "body", "set": "ossuary", "name": "Ossuary Ribplate",
     "stats": [st("venom.resistance", 15), st("toxin.resistance", 15), st("piercing.resistance", 8), st("venom.immunity", 1)],
     "does": "A ribcage strapped over a padded shirt.", "strong": "Poison, stings, spears", "weak": "Fine armor, and dry as tinder.",
     "legend": "Venom Immunity."},
    {"id": "sunhelm", "family": "gear", "piece": "helmet", "set": "sunforged", "name": "Sunforged Crown-Helm",
     "stats": [st("fire.resistance", 20), st("ember.resistance", 15), st("slashing.resistance", 15), st("spellPower", 10)],
     "does": "A gold helm crowned with flame, forged at noon on the longest day.", "strong": "Almost everything", "weak": "Great armor, and it costs like it.",
     "legend": "All four of its lines."},
    {"id": "sunplate", "family": "gear", "piece": "body", "set": "sunforged", "name": "Sunforged Plate",
     "stats": [st("fire.resistance", 20), st("piercing.resistance", 15), st("slashing.resistance", 15), st("ember.immunity", 1)],
     "does": "Gold plate with a sun burning in its chest.", "strong": "Almost everything", "weak": "Great armor, and it costs like it.",
     "legend": "Ember Immunity."},
]

SETS = [
    {"id": "duelist", "name": "Duelist's", "tier": 2, "bonus": [st("graceSecs", 0.25), st("points", 2)], "bad": [st("fire.weakness", 20)]},
    {"id": "tidewarden", "name": "Tidewarden", "tier": 3, "bonus": [st("electricity.resistance", 10)], "bad": [st("fire.weakness", 25)]},
    {"id": "ossuary", "name": "Ossuary", "tier": 4, "bonus": [st("hearts", 0.5)], "bad": [st("fire.weakness", 30)]},
    {"id": "sunforged", "name": "Sunforged", "tier": 5, "bonus": [st("hearts", 0.5), st("fire.resistance", 10)], "bad": []},
]


def main():
    os.makedirs(os.path.join(ROOT, "campaign"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "textures", "gear"), exist_ok=True)
    data = {
        "_about": "The Wandering Smith's stock: new weapons and armor for the Armory merchants. Same fields as the game's "
                  "content/campaign/items.json; a new id adds, an existing one changes only the fields given (docs/MODDING.md).",
        "armorSets": SETS,
        "items": ITEMS,
    }
    with open(os.path.join(ROOT, "campaign", "items.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    index = {"_about": "The pictures for this mod's things, like the game's textures/index.json. Files are in this folder.",
             "textures": {}}
    for it in ITEMS:
        draw(ICONS[it["id"]]).save(os.path.join(ROOT, "textures", "gear", it["id"] + ".png"))
        index["textures"]["ci:" + it["id"]] = "gear/" + it["id"] + ".png"
    with open(os.path.join(ROOT, "textures", "index.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, indent=2)
        f.write("\n")
    print(f"{len(ITEMS)} things, {len(SETS)} armor sets")


if __name__ == "__main__":
    main()
