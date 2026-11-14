#!/usr/bin/env python3
"""
Build 56's level design: writes the board (a .level file) and the island-file entry of every campaign
level that isn't the maze or the field's board, and the nightmare boards that are turned copies of them.

    python tools/design-levels-56.py            # writes content/levels/campaign/*.level, nightmare/*.level and the islands' levels
    python tools/design-levels-56.py --show     # prints the boards instead of writing

One level, one idea (docs/BUILD-56.md has the whole table). Edit this file and run it again to change
a level: it is the source of the 60 levels it writes, so hand edits to those files get overwritten.
The mazes (level 12) and the fields (level 13) keep their boards (they are 80 and 48 squares wide and
generated): their goals, hazards and enemies are designed here, the board is untouched.

Board letters (docs/CAMPAIGN.md, camp-edges.js, camp-hazards.js, camp-objectives.js):
  .  open   #  wall   S  start   1 2 3  pulse walls
  > < ^ v  one-way gates          a b c d  linked doors (come out of the other with the same letter)
  4 5 6 7  turrets east, south, west, north   8  cannon   G geyser   E Z W N belts east, south, west, north
  ~  tar   x  crumble   *  mine   B  saw blade
  p pylon spot   l beacon spot   m snare/pool spot   o bait spot   h the ring's middle
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMP = os.path.join(ROOT, "content", "campaign")
LVL = os.path.join(ROOT, "content", "levels")
SHOW = "--show" in sys.argv
W = 20


class Bd:
    def __init__(s):
        s.g = [["."] * W for _ in range(W)]
        s.sx, s.sy = 2, 10

    def p(s, x, y, c="#"):
        if 0 <= x < W and 0 <= y < W:
            s.g[y][x] = c
        return s

    def pts(s, lst, c="#"):
        for x, y in lst:
            s.p(x, y, c)
        return s

    def r(s, x1, y1, x2, y2, c="#"):
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                s.p(x, y, c)
        return s

    def box(s, x1, y1, x2, y2, c="#"):
        s.h(y1, x1, x2, c).h(y2, x1, x2, c).v(x1, y1, y2, c).v(x2, y1, y2, c)
        return s

    def h(s, y, x1, x2, c="#"):
        for x in range(x1, x2 + 1):
            s.p(x, y, c)
        return s

    def v(s, x, y1, y2, c="#"):
        for y in range(y1, y2 + 1):
            s.p(x, y, c)
        return s

    def start(s, x, y):
        s.sx, s.sy = x, y
        return s

    def sym(s, how):
        """Copy the top-left quadrant: 'h' mirrors left to right, 'v' top to bottom, 'hv' both."""
        for y in range(W):
            for x in range(W):
                if "h" in how and x >= W // 2 and not (y >= W // 2 and "v" in how):
                    s.g[y][x] = s.g[y][W - 1 - x]
        for y in range(W):
            for x in range(W):
                if "v" in how and y >= W // 2:
                    s.g[y][x] = s.g[W - 1 - y][x]
        return s

    def rows(s):
        g = [r[:] for r in s.g]
        g[s.sy][s.sx] = "S"
        return ["".join(r) for r in g]


def existing(isl, n):
    src = open(os.path.join(LVL, "campaign", f"{isl}-{n}.level"), encoding="utf-8").read().replace("\r", "").split("\n")
    rows = [l for l in src[src.index("---") + 1:] if l.strip()]
    b = Bd()
    for y, row in enumerate(rows[:W]):
        for x, ch in enumerate(row[:W]):
            if ch == "S":
                b.sx, b.sy = x, y
                ch = "."
            b.g[y][x] = ch
    return b


# a few stock shapes (the same ones the old LAYOUTS drew)
def pillars(b=None):
    b = b or Bd()
    for x, y in [(4, 4), (14, 4), (4, 14), (14, 14), (9, 3), (9, 15)]:
        b.r(x, y, x + 1, y + 1)
    return b.start(2, 10)


def ring(b=None, gap=True):
    b = b or Bd()
    for i in range(5, 15):
        if i in (9, 10) and gap:
            continue
        b.p(i, 5).p(i, 14).p(5, i).p(14, i)
    b.pts([(5, 5), (14, 5), (5, 14), (14, 14)])
    return b.start(2, 2)


def comb(b=None):
    b = b or Bd()
    for x in (3, 7, 11, 15):
        b.v(x, 3, 12)
    for x in (5, 9, 13):
        b.v(x, 8, 16)
    return b.start(1, 18)


def rooms(b=None):
    b = b or Bd()
    for i in range(W):
        if i not in (3, 4, 15, 16):
            b.p(10, i).p(i, 10)
    return b.start(2, 2)


def lanes(b=None):
    b = b or Bd()
    for k, y in enumerate((5, 10, 15)):
        for x in range(3, 17):
            if (x > 5) if k % 2 else (x < 14):
                b.p(x, y)
    return b.start(2, 2)


def cross(b=None):
    b = b or Bd()
    for i in range(5, 15):
        if i not in (9, 10):
            b.p(9, i).p(10, i).p(i, 9).p(i, 10)
    return b.start(2, 16)


def spiral(b=None):
    b = b or Bd()
    for i in range(3, 17):
        for x, y in ((i, 3), (i, 16), (3, i), (16, i)):
            if not (y == 3 and 4 <= x <= 6):
                b.p(x, y)
    for i in range(7, 13):
        for x, y in ((i, 7), (i, 12), (7, i), (12, i)):
            if not (y == 12 and 9 <= x <= 10):
                b.p(x, y)
    return b.start(1, 1)


def diamond(b=None):
    b = b or Bd()
    for d in range(1, 7):
        for x, y in ((3 + d, 10 - d), (12 - d, 10 - d), (3 + d, 9 + d), (12 - d, 9 + d)):
            b.p(x, y)
    return b.start(2, 2)


def checker(b=None):
    b = b or Bd()
    for y in range(2, 19, 4):
        for x in range(2, 19, 4):
            b.p(x, y)
    return b.start(1, 1)


# ----------------------------------------------------------------------------------------------
# The pulse boards: 1 up first, 2 up second, 3 always up
def pulse_keep():
    return existing("keep", 14)


def pulse_spire():
    b = Bd()
    for y in range(3, 17):
        for x in range(3, 17):
            if (x + y) % 6 == 0:
                b.p(x, y, "1")
            elif (x + y) % 6 == 3:
                b.p(x, y, "2")
    b.p(10, 10, ".").p(9, 9, ".")
    return b.start(1, 10)


def pulse_hollow():
    b = Bd()
    for x in (4, 8, 12, 16):
        for y in range(2, 18):
            if y not in (9, 10):
                b.p(x, y, "1")
    for y in (4, 8, 12, 16):
        for x in range(2, 18):
            if x not in (9, 10) and b.g[y][x] == ".":
                b.p(x, y, "2")
    return b.start(1, 1)


def pulse_reef():
    b = Bd()
    for i in range(5, 15):
        if i not in (9, 10):
            b.p(i, 5, "1").p(i, 14, "1").p(5, i, "1").p(14, i, "1")
    for i in range(2, 18):
        if i not in (9, 10):
            b.p(i, 2, "2").p(i, 17, "2").p(2, i, "2").p(17, i, "2")
    return b.start(0, 0)


def pulse_crown():
    b = Bd()
    b.r(8, 8, 11, 11, "3")
    b.r(9, 9, 10, 10, ".")
    for i in range(3, 17):
        if i not in (9, 10):
            b.p(i, 6, "1").p(i, 13, "1")
            b.p(6, i, "2").p(13, i, "2")
    b.pts([(2, 2), (17, 2), (2, 17), (17, 17)], "3")
    return b.start(1, 10)



def den():
    """Four rooms and the wardrobe doors between them."""
    b = Bd().v(10, 0, 19).h(10, 0, 19)
    return b.p(4, 10, "a").p(15, 10, "a").p(10, 4, "b").p(10, 15, "b").start(2, 2)


def vaults():
    """The den again, with two more pairs of doors and a turret at each corner."""
    b = den()
    b.p(7, 10, "c").p(12, 10, "c").p(10, 7, "d").p(10, 12, "d")
    return b.pts([(1, 6)], "4").pts([(18, 13)], "6").pts([(6, 1)], "5").pts([(13, 18)], "7")


# ----------------------------------------------------------------------------------------------
LEVELS = {}          # island -> { n: spec }
EDGE_TEXT = {}


def L(isl, n, name, goal, text, speed, board, edge="wall", edges=None, spawns=None, bonus=None, dark=False, layout="open", zones=None):
    LEVELS.setdefault(isl, {})[n] = dict(n=n, name=name, goal=goal, text=text, speed=speed, board=board, edge=edge, edges=edges,
                                         spawns=spawns or {}, bonus=bonus, dark=dark, layout=layout, zones=zones)


def sp(max_=1, lo=7000, hi=11000, **kw):
    return dict(max=max_, delay=[lo, hi], **kw)


def cnt(n, **kw):
    return dict(count=n, **kw)


def bonus(kind, need=None, **reward):
    b = {"type": kind}
    if need is not None:
        b["need"] = need
    b["reward"] = reward
    return b


def streak(need, secs, **reward):
    b = bonus("streak", need, **reward)
    b["secs"] = secs
    return b


# ============================== BRIGHTSCALE KEEP: the basics ==============================
# edges here are only open (wrap) and wall (and the old mirror once). Hazards: rocks, popsicles, fleas, bees, then the first of the new.
L("keep", 1, "The Village Green", {"type": "apples", "need": 10},
  "Snake the way it has always been: no walls, no hazards, just you and the apples. Eat 10.", 6,
  lambda: Bd().start(3, 10), edge="wrap", bonus=streak(4, 15, points=200), zones=[])
L("keep", 2, "Castle Yard", {"type": "score", "need": 1500},
  "Now there are walls, and they mean it. A well stands in the yard. Reach 1,500 points.", 6.5,
  lambda: Bd().r(9, 9, 10, 10).pts([(3, 3), (16, 3), (3, 16), (16, 16)]).start(2, 10), bonus=bonus("fast", 75, coins=16), zones=[])
L("keep", 3, "The Pillared Hall", {"type": "apples", "need": 14},
  "The hall's side doors are walls, but its ends are open: leave one end and come back in the other. Mind the rocks. Eat 14 apples.", 7,
  lambda: pillars(), edges={"top": "open", "bottom": "open"}, spawns={"rock": cnt(3, s=30)}, bonus=bonus("rocks", 3, gems=1), zones=[])
L("keep", 4, "Frostkeep Cellar", {"type": "length", "need": 22},
  "The cellar is chilly and the popsicles are not food. Cracked flagstones (the pale ones) fall away a moment after you step on them, and they mend slowly: don't go back over one.", 7,
  lambda: rooms().p(10, 3, "x").p(10, 16, "x").p(3, 10, "x").p(16, 10, "x").p(5, 5, "x").p(14, 14, "x"),
  spawns={"popsicle": sp(2, 4000, 8000, s=40), "rock": cnt(2)}, bonus=bonus("points", 2500, coins=22), zones=[])
L("keep", 6, "Flea Market", {"type": "apples", "need": 16},
  "Haggling fleas, and thieving crows that snatch an apple off the board and run for the edge. Run one down with your head and it drops points. Eat 16 apples.", 7.5,
  lambda: Bd().r(3, 3, 5, 4).r(14, 3, 16, 4).r(3, 15, 5, 16).r(14, 15, 16, 16).r(9, 9, 10, 10).r(8, 5, 11, 5).r(8, 14, 11, 14).start(2, 10),
  spawns={"flea": sp(3, 3000, 6000, s=40), "crow": sp(1, 8000, 12000)}, bonus=bonus("kills", 2, coins=28), zones=["shop"])
L("keep", 7, "The Apiary Gate", {"type": "score", "need": 3500},
  "The hive has one-way doors (the arrows): a bee's way in is one way only, and so is yours. A hound picks up your trail and follows it, a little faster than you. Reach 3,500.", 7.5,
  lambda: Bd().v(6, 0, 19).v(13, 0, 19).p(6, 4, ">").p(6, 15, "<").p(13, 4, ">").p(13, 15, "<").r(9, 8, 10, 11).start(2, 10),
  spawns={"wasp": sp(2, 5000, 9000), "hound": sp(1, 9000, 13000)}, bonus=bonus("untouched", coins=31), zones=[])
L("keep", 8, "Jousting Lists", {"type": "survive", "need": 60},
  "Ride off either end of the lists and come back in at the other; the rails above and below are walls. Powder kegs lie in the sand: step on one and run. Survive a minute.", 8,
  lambda: Bd().h(7, 3, 16).h(12, 3, 16).pts([(6, 9), (13, 10), (9, 3), (10, 16), (4, 16), (15, 3)], "*").start(1, 9),
  edges={"left": "open", "right": "open"}, spawns={"wasp": sp(2, 5000, 9000), "flea": sp(2, 4000, 7000)}, bonus=streak(6, 20, points=500), zones=[])
L("keep", 9, "Watchtower Ring", {"type": "keys", "need": 3},
  "Archers in the corner towers fire along their row or column (the line shows first). A warden walks the wall and chases whatever he sees. Find three tower keys, then reach the gate.", 8,
  lambda: ring().pts([(1, 3)], "4").pts([(18, 1)], "5").pts([(18, 16)], "6").pts([(1, 18)], "7").start(2, 8),
  spawns={"warden": sp(1, 8000, 12000)}, bonus=bonus("fast", 100, gems=1), zones=["trap"])
L("keep", 11, "The King's Road", {"type": "apples", "need": 12},
  "Weave through the comb and eat 12. The road's edges are mirrors: leave one and you can come out of any side. Pitch is spilled on the road: it slows you.", 7,
  lambda: comb().pts([(2, 5), (2, 6), (4, 14), (4, 15), (8, 4), (8, 5), (12, 15), (12, 16), (16, 8), (16, 9)], "~"),
  edge="mirror", spawns={"flea": sp(2, 5000, 8000)}, bonus=bonus("length", 25, coins=43), zones=[])
L("keep", 12, "The Hedge Maze", {"type": "relic", "item": "crown", "need": 1},
  "Night has fallen on the royal hedges. Somewhere lies the Lost Crown. A hound keeps to your trail, so don't stand still. The arrow at the side shows the way.", 7.5,
  None, edge="maze", layout="maze", spawns={"hound": sp(1, 9000, 13000), "flea": sp(1, 6000, 10000)}, dark=True, bonus=bonus("fast", 120, gems=1), zones=[])
L("keep", 13, "Hall of Plates", {"type": "buttons", "need": 4},
  "An endless hall of mirrored walls. Step on all four pressure plates and the great seal appears. A warden walks the hall.", 7.5,
  None, edge="maze", layout="field", spawns={"rock": cnt(4), "warden": sp(1, 9000, 13000)}, bonus=bonus("rocks", 2, coins=49), zones=[])
L("keep", 14, "The Shifting Bailey", {"type": "apples", "need": 18},
  "The castle walls rise and fall on a timer. Watch for the glow. Eat 18 apples.", 8,
  pulse_keep, layout="pulse", spawns={"wasp": sp(1, 7000, 11000), "hound": sp(1, 10000, 14000)}, bonus=bonus("untouched", gems=1), zones=[])

# ============================== ARCANUM SPIRE: stairs and links ==============================
L("spire", 1, "Apprentice Courtyard", {"type": "score", "need": 2500},
  "The courtyard is a spiral stair: out the right side, in the left one row lower. Top and bottom are walls. Reach 2,500 points.", 7,
  lambda: Bd().start(3, 10), edges={"left": "stair", "right": "stair"}, spawns={"molasses": sp(2, 6000, 10000), "golden": sp(1, 12000, 18000)},
  bonus=streak(4, 15, points=300), zones=[])
L("spire", 2, "Rune Circle", {"type": "apples", "need": 15},
  "Every side of the circle is a stair: out the right and you come in the left a row lower, out the bottom and you come in the top a column over. The runes (the spikes) beat on a time. Eat 15 apples.", 7,
  lambda: ring(), edges={"top": "stair", "bottom": "stair", "left": "stair", "right": "stair"}, spawns={"spikes": cnt(6)},
  bonus=bonus("fast", 85, coins=20), zones=[])
L("spire", 3, "Storm Library", {"type": "survive", "need": 45},
  "The shelves climb: leave through the top and you come out of the bottom a column to the right. The storm over the stacks flashes before it strikes. Survive 45 seconds.", 7.5,
  lambda: comb(), edges={"top": "stair", "bottom": "stair"}, spawns={"lightning": sp(2, 6000, 9500)}, bonus=bonus("length", 26, gems=1), zones=[])
L("spire", 4, "Hall of Mirrors", {"type": "score", "need": 4000},
  "The mirrors here aren't random any more: the left and right glass lead to each other, but flipped, so what leaves at the top of one comes in at the bottom of the other. Reach 4,000 points.", 7.5,
  lambda: diamond(), edges={"left": {"kind": "link", "to": "right", "flip": True}, "right": {"kind": "link", "to": "left", "flip": True}},
  spawns={"spikes": cnt(4), "molasses": sp(1, 7000, 11000)}, bonus=bonus("length", 28, coins=26), zones=[])
L("spire", 6, "Wisp Wood", {"type": "apples", "need": 18},
  "Ghosts drift through the trees, and a mirror shade copies your every move from across the glade: when you go right it goes left, so don't meet it in the middle. Eat 18 apples.", 8,
  lambda: pillars(), spawns={"ghost": sp(2, 7000, 11000), "reflection": sp(1, 9000, 13000)}, bonus=bonus("kills", 2, coins=32), zones=[])
L("spire", 7, "The Familiar's Den", {"type": "thief", "need": 3},
  "Wardrobe doors link the four rooms (the glowing ones: go in one and come out past the other of its color). Stone gargoyles creep when you look away. Corner the thief three times.", 8,
  lambda: den(),
  spawns={"wasp": sp(2, 6000, 10000), "gargoyle": sp(1, 9000, 13000)}, bonus=bonus("untouched", coins=35), zones=[])
L("spire", 8, "Spellbound Stacks", {"type": "keys", "need": 3},
  "The stacks loop top to bottom, flipped. A gale sprite sits in the aisles and tugs you toward it a square at a time (the streaks show first). Find three keys, then the gate.", 8,
  lambda: lanes(), edges={"top": {"kind": "link", "to": "bottom", "flip": True}, "bottom": {"kind": "link", "to": "top", "flip": True}},
  spawns={"ghost": sp(2, 7000, 11000), "lightning": sp(1, 8000, 12000), "galesprite": sp(1, 9000, 13000)}, bonus=streak(6, 20, points=650), zones=[])
L("spire", 9, "Astral Observatory", {"type": "score", "need": 6000},
  "The dome turns: each side leads to the next, clockwise (top to the right side, right to the bottom, bottom to the left, left to the top). Warding orbs circle the apples. Reach 6,000.", 8.5,
  lambda: cross().pts([(7, 7), (12, 7), (7, 12), (12, 12)]),
  edges={"top": {"kind": "link", "to": "right"}, "right": {"kind": "link", "to": "bottom"}, "bottom": {"kind": "link", "to": "left"}, "left": {"kind": "link", "to": "top"}},
  spawns={"spikes": cnt(4), "orb": sp(1, 8000, 12000)}, bonus=bonus("fast", 110, gems=1), zones=[])
L("spire", 11, "Ley Line Tunnel", {"type": "apples", "need": 12},
  "Ley lines run round the tunnel: the belts shove you an extra square the way their arrows point. Eat 12 apples.", 7.5,
  lambda: comb().h(1, 2, 16, "E").h(18, 3, 17, "W").v(18, 2, 17, "Z").v(1, 3, 16, "N").start(2, 2),
  spawns={"flea": sp(2, 5000, 9000)}, bonus=bonus("length", 28, coins=47), zones=[])
L("spire", 12, "The Twisting Archive", {"type": "relic", "item": "grimoire", "need": 1},
  "The archive is dark, and gargoyles hold still while you look at them. Find the Forbidden Grimoire.", 8,
  None, edge="maze", layout="maze", spawns={"ghost": sp(1, 8000, 12000), "gargoyle": sp(1, 9000, 13000)}, dark=True, bonus=bonus("fast", 130, gems=1), zones=[])
L("spire", 13, "Glyph Field", {"type": "buttons", "need": 5, "ordered": True},
  "An endless hall of glyphs. Press the plates in order, 1 to 5 (a wrong one resets them all), then the seal. Your reflection stalks you.", 8,
  None, edge="maze", layout="field", spawns={"spikes": cnt(6), "reflection": sp(1, 9000, 13000)}, bonus=bonus("spells", 2, coins=53), zones=[])
L("spire", 14, "Pulse of the Spire", {"type": "score", "need": 7000},
  "The walls beat in diagonals, and the wizards' cannons turn a quarter after every shot. Reach 7,000 points.", 8.5,
  pulse_spire, layout="pulse", spawns={"lightning": sp(1, 8000, 12000), "cannon": cnt(2)}, bonus=bonus("untouched", gems=1), zones=[])

# ============================== FEASTWOOD HOLLOW: bumpers, briars, tolls ==============================
L("hollow", 1, "Orchard Row", {"type": "apples", "need": 18},
  "Rows of fruit trees. The fence along the top and bottom is a bumper: it turns you along it instead of letting you out. The sides are open. Eat 18 apples.", 7.5,
  lambda: (lambda b: [b.pts([(x, y) for y in (4, 8, 12, 16) for x in range(3, 17, 3)]), b.start(1, 10)] and b)(Bd()),
  edge="wrap", edges={"top": "bounce", "bottom": "bounce"}, spawns={"golden": sp(1, 11000, 17000)}, bonus=streak(4, 15, points=400), zones=[])
L("hollow", 2, "Bramble Patch", {"type": "score", "need": 4000},
  "The hedge at either side is briar: it pricks you for half a heart, and turns you. Brambles grow in the patch. Reach 4,000 points.", 7.5,
  lambda: Bd().start(3, 10), edge="wrap", edges={"left": "briar", "right": "briar"}, spawns={"bramble": cnt(6)}, bonus=bonus("fast", 95, coins=24), zones=[])
L("hollow", 3, "The Bakehouse", {"type": "haul", "need": 4},
  "Carry the loaves from the ovens to the counter, one at a time: a hit drops the one you're carrying. The belts shove you; the ovens flare. Deliver four.", 8,
  lambda: rooms().h(5, 1, 8, "E").h(14, 11, 18, "W").start(2, 2),
  spawns={"fire": sp(2, 6000, 10000)}, bonus=bonus("untouched", gems=1), zones=[])
L("hollow", 4, "Honey Hall", {"type": "length", "need": 28},
  "Honey pools slow you. The doors at either end are tolls: out the side and in the other, for 40 points a time. Grow to 28.", 8,
  lambda: checker().pts([(9, 9), (10, 9), (9, 10), (10, 10), (5, 6), (6, 6), (13, 13), (14, 13)], "~").start(1, 1),
  edges={"left": {"kind": "toll", "pay": 40}, "right": {"kind": "toll", "pay": 40}}, spawns={"molasses": sp(2, 6000, 10000), "frenzy": sp(1, 12000, 18000)},
  bonus=bonus("points", 4500, coins=30), zones=[])
L("hollow", 6, "The Beehive", {"type": "apples", "need": 20},
  "The hive's walls bounce: every side turns you along it. Wasps, and a pack of locusts that comes at you from four sides at once. Eat 20 apples.", 8,
  lambda: pillars(), edges={"top": "bounce", "bottom": "bounce", "left": "bounce", "right": "bounce"},
  spawns={"wasp": sp(2, 5000, 9000), "locust": sp(3, 6000, 9000)}, bonus=bonus("kills", 2, coins=36), zones=[])
L("hollow", 7, "Fox Run", {"type": "score", "need": 7000},
  "Hay bales and open ground, the sides wrap. A crow steals apples off the board, and a hound follows your trail. Reach 7,000.", 8.5,
  lambda: Bd().r(4, 4, 5, 5).r(14, 5, 15, 6).r(8, 9, 9, 10).r(4, 14, 5, 15).r(14, 14, 15, 15).start(1, 10),
  edge="wrap", spawns={"bramble": cnt(4), "crow": sp(2, 7000, 11000)}, bonus=bonus("untouched", coins=39), zones=[])
L("hollow", 8, "Pantry Raid", {"type": "keys", "need": 4},
  "A boar sleeps in the pantry. Eating an apple near it wakes it, and so does brushing past. Find four pantry keys, then the door.", 8.5,
  lambda: rooms().r(2, 5, 4, 6).r(15, 13, 17, 14).r(5, 15, 6, 17).r(13, 2, 14, 4).start(2, 2),
  spawns={"flea": sp(3, 4000, 7000), "wasp": sp(1, 7000, 11000), "boar": sp(1, 9000, 13000)}, bonus=streak(6, 20, points=750), zones=[])
L("hollow", 9, "Mill Stream", {"type": "thief", "need": 4},
  "The millrace runs two ways at once: the belts across the middle shove you east along the upper lane, west along the lower. Gnashers tunnel under the floor and burst up where you're going. Corner the thief four times.", 8.5,
  lambda: cross().h(9, 0, 7, "E").h(9, 12, 19, "E").h(10, 0, 7, "W").h(10, 12, 19, "W").start(2, 16),
  spawns={"ghost": sp(1, 9000, 13000), "bramble": cnt(4), "gnasher": sp(1, 9000, 13000)}, bonus=bonus("fast", 120, gems=1), zones=[])
L("hollow", 11, "The Cart Track", {"type": "apples", "need": 12},
  "Saw blades ride the cart rails (the faint lines) back and forth. The ends of the track bounce you. Eat 12 apples.", 8,
  lambda: comb().pts([(5, 4), (11, 14), (1, 8), (17, 15)], "B"),
  edges={"top": "bounce", "bottom": "bounce"}, edge="wrap", spawns={"flea": sp(2, 5000, 9000)}, bonus=bonus("length", 31, coins=51), zones=[])
L("hollow", 12, "Hedge of Thorns", {"type": "relic", "item": "ladle", "need": 1},
  "Thorns all round in the dark, and gnashers under the ground: watch for ripples, then a crack. Find the Golden Ladle.", 8,
  None, edge="maze", layout="maze", spawns={"wasp": sp(2, 6000, 10000), "gnasher": sp(1, 9000, 13000)}, dark=True, bonus=bonus("fast", 140, gems=1), zones=[])
L("hollow", 13, "Scarecrow Field", {"type": "shards", "need": 6},
  "Gather six pouches of seed. The crows are after the same seed: they steal apples, and the scarecrows only move when you look away.", 8.5,
  None, edge="maze", layout="field", spawns={"bramble": cnt(10), "crow": sp(1, 8000, 12000), "gargoyle": sp(1, 10000, 14000)}, bonus=bonus("spells", 2, coins=57), zones=[])
L("hollow", 14, "Threshing Floor", {"type": "apples", "need": 24},
  "Threshers sweep the floor on their rails while the walls beat in rows and columns. The sides bounce. Eat 24 apples.", 9,
  pulse_hollow, layout="pulse", edges={"left": "bounce", "right": "bounce"}, spawns={"bramble": cnt(3), "fire": sp(1, 8000, 12000), "blade": cnt(2)},
  bonus=bonus("untouched", gems=1), zones=[])

# ============================== TIDECOIL REEF: tides and currents ==============================
L("reef", 1, "Shallow Lagoon", {"type": "score", "need": 5000},
  "The tide washes in over the left and right sides: open, then a wall while the sea is in (it flashes first), and the two sides are out of step. Top and bottom are open. Reach 5,000 points.", 8,
  lambda: Bd().start(3, 10), edge="wrap", edges={"left": "tide", "right": "tide"}, spawns={"gust": sp(1, 9000, 14000)}, bonus=streak(4, 15, points=500), zones=[])
L("reef", 2, "Kelp Corridors", {"type": "apples", "need": 20},
  "A current runs clockwise round the edge of the reef (the belts): ride it, or fight it. Ice floes drift in the kelp. Eat 20 apples.", 8,
  lambda: (lambda b: [b.h(1, 1, 17, "E"), b.v(18, 1, 17, "Z"), b.h(18, 2, 18, "W"), b.v(1, 2, 18, "N"), b.start(3, 5)] and b)(comb()),
  spawns={"ice": cnt(8)}, bonus=bonus("fast", 105, coins=28), zones=[])
L("reef", 3, "Whirlpool Basin", {"type": "hold", "need": 30, "move": 7, "decay": 0.35},
  "Every side of the basin is a stair, so the whole sea turns in a spiral. Hold the eye of the whirlpool (the ring): it drifts to a new place after you've held it a while, and you lose ground when you leave it. Sinkholes open in the rock.", 8.5,
  lambda: ring().p(9, 9, "h"), edges={"top": "stair", "bottom": "stair", "left": "stair", "right": "stair"}, spawns={"sinkhole": sp(2, 8000, 12000)},
  bonus=bonus("length", 30, gems=1), zones=[])
L("reef", 4, "Coral Spiral", {"type": "keys", "need": 3},
  "Pearl doors pierce the coral: go in one and come out just past the other (they glow alike). Find three keys, then the gate.", 8.5,
  lambda: spiral().p(3, 10, "a").p(7, 10, "a").p(16, 9, "b").p(12, 9, "b"), spawns={"rock": cnt(4), "gust": sp(1, 9000, 14000)}, bonus=bonus("length", 32, coins=34), zones=[])
L("reef", 6, "Jelly Bloom", {"type": "apples", "need": 22},
  "The tide comes over the top and bottom (flashing before it shuts). Ghosts of jellyfish drift, and flying fish leap three squares at a time, at the square they've just marked. Eat 22 apples.", 8.5,
  lambda: pillars(), edges={"top": "tide", "bottom": "tide"}, spawns={"ghost": sp(2, 7000, 11000), "flyingfish": sp(2, 7000, 11000)}, bonus=bonus("kills", 2, coins=40), zones=[])
L("reef", 7, "Piranha Narrows", {"type": "score", "need": 8000},
  "Sharks go for your tail, not your head: a long tail is a target, and so is a short one that stops. Reach 8,000.", 9,
  lambda: lanes(), spawns={"wasp": sp(2, 6000, 10000), "shark": sp(1, 9000, 13000)}, bonus=bonus("untouched", coins=43), zones=[])
L("reef", 8, "Eel Grotto", {"type": "beacons", "need": 3, "lit": 14},
  "The grotto is black. Light the three lamps (each stays lit 14 seconds after you touch it) so that all three burn at once. An anglerfish's lure glows ahead of you and it aims for where you're going.", 9,
  lambda: rooms().pts([(3, 3), (16, 3), (3, 16), (16, 16), (10, 6), (10, 13)], "l").start(1, 10),
  spawns={"angler": sp(1, 8000, 12000)}, dark=True, bonus=streak(6, 20, points=850), zones=[])
L("reef", 9, "Shipwreck Hold", {"type": "thief", "need": 4},
  "Sea mines among the wreckage (step on one and run), geysers in the hull, and a squid that lobs bombs where you're heading. Corner the thief four times.", 9,
  lambda: cross().pts([(3, 3), (16, 4), (4, 16), (15, 15), (6, 12), (13, 7)], "*").pts([(2, 8), (17, 12)], "G").start(2, 16),
  spawns={"flea": sp(2, 6000, 10000), "squid": sp(1, 9000, 13000)}, bonus=bonus("fast", 130, gems=1), zones=[])
L("reef", 11, "The Undertow", {"type": "apples", "need": 12},
  "The current runs the other way now, anticlockwise, and it's strong. Eat 12 apples.", 8.5,
  lambda: (lambda b: [b.h(1, 2, 18, "W"), b.v(1, 2, 18, "Z"), b.h(18, 1, 17, "E"), b.v(18, 1, 17, "N"), b.start(3, 5)] and b)(comb()),
  spawns={"flea": sp(2, 5000, 9000)}, bonus=bonus("length", 34, coins=55), zones=[])
L("reef", 12, "Sunken Maze", {"type": "relic", "item": "pearl", "need": 1},
  "A drowned maze in the dark, and an anglerfish between the walls. Find the Pearl of Tides.", 8.5,
  None, edge="maze", layout="maze", spawns={"ghost": sp(1, 9000, 13000), "angler": sp(1, 9000, 13000)}, dark=True, bonus=bonus("fast", 150, gems=1), zones=[])
L("reef", 13, "Tidal Glyphs", {"type": "buttons", "need": 6, "ordered": True},
  "Press the glyphs in order, 1 to 6. Sharks circle, and the ice drifts.", 9,
  None, edge="maze", layout="field", spawns={"ice": cnt(10), "sinkhole": sp(1, 9000, 13000), "shark": sp(1, 9000, 13000)}, bonus=bonus("spells", 2, coins=61), zones=[])
L("reef", 14, "The Breathing Reef", {"type": "score", "need": 10000},
  "The reef breathes in rings, and all four sides are tides. Geysers vent in the rock. Reach 10,000 points.", 9.5,
  pulse_reef, layout="pulse", edges={"top": "tide", "bottom": "tide", "left": "tide", "right": "tide"}, spawns={"sinkhole": sp(1, 9000, 13000), "wasp": sp(1, 7000, 11000), "geyser": cnt(3)},
  bonus=bonus("untouched", gems=1), zones=[])

# ============================== CINDER CROWN: everything ==============================
L("crown", 1, "Ashen Steps", {"type": "score", "need": 6000},
  "The east gate is locked until you've eaten 8 apples; then it's open. Lava seeps through the steps. Reach 6,000.", 8.5,
  lambda: Bd().start(3, 10), edge="wall", edges={"right": {"kind": "lock", "after": {"apples": 8}, "then": "open"}, "left": "open"},
  spawns={"fire": sp(3, 5000, 9000), "lava": cnt(3)}, bonus=streak(4, 15, points=600), zones=[])
L("crown", 2, "Bomb Quarry", {"type": "apples", "need": 22},
  "Mines everywhere, bombs overhead, and cracked obsidian that falls away when you step on it. Eat 22 apples.", 8.5,
  lambda: pillars().pts([(7, 7), (12, 8), (3, 8), (16, 12), (8, 17), (11, 2), (6, 12), (14, 16)], "*").pts([(9, 7), (10, 12), (7, 9), (12, 10)], "x"),
  spawns={"bomb": sp(2, 6000, 10000)}, bonus=bonus("fast", 115, coins=32), zones=[])
L("crown", 3, "The Lava Forge", {"type": "haul", "need": 3},
  "Carry three ingots from the furnace to the anvil: the forge belts shove you, saws swing on their rails, and a hit drops the ingot. The top is a briar: it pricks and turns you.", 9,
  lambda: rooms().h(5, 1, 8, "E").h(14, 11, 18, "W").v(5, 12, 18, "Z").v(14, 1, 8, "N").pts([(7, 7), (12, 12), (2, 16), (17, 3)], "B").start(2, 2),
  edges={"top": "briar"}, spawns={"fire": sp(2, 5000, 9000), "spikes": cnt(6)}, bonus=bonus("untouched", gems=1), zones=[])
L("crown", 4, "Obsidian Spiral", {"type": "length", "need": 32},
  "Cracked obsidian (step and it falls), vents that scald in a plus, and a toll at the top: 120 points to cross. Grow to 32.", 9,
  lambda: spiral().pts([(4, 5), (5, 14), (14, 14), (14, 5), (10, 9)], "x").pts([(8, 9)], "G").pts([(11, 10)], "G"),
  edges={"top": {"kind": "toll", "pay": 120}}, spawns={"lightning": sp(2, 6000, 10000)}, bonus=bonus("points", 6500, coins=38), zones=[])
L("crown", 6, "Imp Warren", {"type": "apples", "need": 24},
  "Every wall of the warren is a bumper. Imps lob bombs where you're heading, and cinder knights move like a chess knight onto the square they've marked. Eat 24 apples.", 9,
  lambda: cross(), edges={"top": "bounce", "bottom": "bounce", "left": "bounce", "right": "bounce"},
  spawns={"blastimp": sp(1, 8000, 12000), "cinderknight": sp(2, 7000, 11000)}, bonus=bonus("kills", 2, coins=44), zones=[])
L("crown", 7, "Wyrmling Roost", {"type": "score", "need": 11000},
  "The roost wheels clockwise: each side leads to the next. Golem eggs sleep among the boulders: an apple eaten near one wakes it. An ember hound runs your trail. Reach 11,000.", 9.5,
  lambda: Bd().r(4, 4, 5, 5).r(14, 4, 15, 5).r(9, 9, 10, 10).r(4, 14, 5, 15).r(14, 14, 15, 15).start(2, 10),
  edges={"top": {"kind": "link", "to": "right"}, "right": {"kind": "link", "to": "bottom"}, "bottom": {"kind": "link", "to": "left"}, "left": {"kind": "link", "to": "top"}},
  spawns={"fire": sp(2, 5000, 9000), "golem": sp(2, 8000, 12000), "emberhound": sp(1, 9000, 13000)}, bonus=bonus("untouched", coins=47), zones=[])
L("crown", 8, "The Ember Vaults", {"type": "keys", "need": 5},
  "Four vault doors, each a pair: go in one and come out past the other. Turrets guard the passages and bombs lie about. Find five keys, then the gate.", 9.5,
  lambda: vaults(),
  spawns={"bomb": sp(2, 6000, 10000), "wasp": sp(2, 7000, 11000)}, bonus=streak(6, 20, points=950), zones=[])
L("crown", 9, "Smoke Choke", {"type": "thief", "need": 5},
  "Black smoke fills the lanes. The smoke rolls over the top and bottom of the cavern (open, then shut: it flashes first), and the cannons in the walls turn a quarter after every shot. Corner the thief five times.", 9.5,
  lambda: lanes().pts([(1, 1)], "8").pts([(18, 18)], "8"), edges={"top": "tide", "bottom": "tide"},
  spawns={"ghost": sp(2, 7000, 11000), "lightning": sp(1, 8000, 12000), "gargoyle": sp(1, 9000, 13000)}, dark=True, bonus=bonus("fast", 140, gems=1), zones=[])
L("crown", 11, "Magma Run", {"type": "apples", "need": 12},
  "Lava rivers run along the comb (belts), vents scald, and every side is a stair. Eat 12 apples.", 9,
  lambda: comb().h(1, 1, 17, "E").h(18, 2, 18, "W").pts([(4, 14), (8, 3), (12, 15), (16, 4)], "G"),
  edges={"top": "stair", "bottom": "stair", "left": "stair", "right": "stair"}, spawns={"flea": sp(2, 5000, 9000)}, bonus=bonus("length", 37, coins=59), zones=[])
L("crown", 12, "Caldera Maze", {"type": "relic", "item": "eye", "need": 1},
  "The caldera is dark and a golem sleeps in every other corridor. Find the Dragon's Eye.", 9,
  None, edge="maze", layout="maze", spawns={"ghost": sp(1, 8000, 12000), "fire": sp(1, 8000, 12000), "golem": sp(1, 9000, 13000)}, dark=True, bonus=bonus("fast", 160, gems=1), zones=[])
L("crown", 13, "Rune Lattice", {"type": "buttons", "need": 7, "ordered": True},
  "Press the runes in order, 1 to 7. Your reflection hunts you and the cinder knights jump on marked squares.", 9.5,
  None, edge="maze", layout="field", spawns={"spikes": cnt(8), "fire": sp(1, 8000, 12000), "reflection": sp(1, 9000, 13000), "cinderknight": sp(1, 9000, 13000)}, bonus=bonus("spells", 2, coins=65), zones=[])
L("crown", 14, "Heart of the Mountain", {"type": "hold", "need": 40, "move": 8, "decay": 0.4},
  "The walls beat in a cross, the side doors tide in and out, and the heart's ring drifts. Hold it for 40 seconds in all while cannons and saws sweep the chamber.", 10,
  lambda: pulse_crown().p(10, 10, "h"), layout="pulse", edges={"left": "tide", "right": "tide"},
  spawns={"fire": sp(2, 6000, 10000), "bomb": sp(1, 9000, 13000), "cannon": cnt(2), "blade": cnt(2)}, bonus=bonus("untouched", gems=1), zones=[])


# ============================== The lairs: arenas for fights 1, 2, 3 ==============================
def arena(isl, fight):
    b = Bd().start(2, 10)
    corners = [(5, 5), (14, 5), (5, 14), (14, 14)]
    if isl == "keep":                      # a tilting yard: snares in the grass
        for x, y in corners:
            b.p(x, y)
        if fight >= 2:
            b.h(10, 8, 11).p(9, 4).p(10, 15)
        if fight >= 3:
            b.r(8, 7, 11, 7).r(8, 12, 11, 12)
        b.pts([(3, 3), (16, 3), (3, 16), (16, 16), (9, 8), (10, 11), (7, 10), (12, 9), (8, 2), (11, 17)], "m")
    elif isl == "spire":                   # a ring of standing stones, crystals between them
        for x, y in corners:
            b.r(x, y, x + 1, y + 1)
        if fight >= 2:
            b.pts([(9, 2), (10, 2), (9, 17), (10, 17)])
        if fight >= 3:
            b.pts([(2, 9), (2, 10), (17, 9), (17, 10)])
        b.pts([(3, 3), (16, 3), (3, 16), (16, 16), (10, 8), (9, 11), (7, 9), (12, 10)], "p")
    elif isl == "hollow":                  # a banquet hall: tables and a trough of rotten fruit
        for x, y in [(4, 4), (14, 4), (4, 14), (14, 14)]:
            b.r(x, y, x + 1, y)
        if fight >= 2:
            b.r(9, 8, 10, 8).r(9, 11, 10, 11)
        if fight >= 3:
            b.r(8, 5, 11, 5).r(8, 14, 11, 14)
        b.pts([(2, 3), (17, 3), (2, 17), (17, 17), (9, 9), (10, 10), (6, 9), (13, 10)], "o")
    elif isl == "reef":                    # coral columns, lamps among them
        for x, y in corners:
            b.pts([(x, y), (x + 1, y + 1)])
        if fight >= 2:
            b.pts([(9, 3), (10, 16), (3, 9), (16, 10)])
        if fight >= 3:
            b.pts([(8, 8), (11, 8), (8, 11), (11, 11)])
        b.pts([(2, 2), (17, 2), (2, 17), (17, 17), (9, 6), (10, 13), (6, 10), (13, 9)], "l")
    else:                                  # a caldera: stone steps, pools of cooling water
        for x, y in corners:
            b.p(x, y).p(x + 1, y)
        if fight >= 2:
            b.r(8, 9, 11, 10)
        if fight >= 3:
            b.pts([(3, 9), (16, 10), (9, 3), (10, 16)])
        b.pts([(3, 3), (16, 3), (3, 16), (16, 16), (9, 7), (10, 12), (6, 10), (13, 9)], "m")
    return b


ARENA_TEXT = {
    "keep": ["Grimscale rides out, and you cannot hurt him yet. Each time he charges over a snare in the grass (the pale marks), it knocks the wind out of him. Dodge until his stamina runs dry, or trap him.",
             "Grimscale's silver plate turns every blow. Make him run over two snares (he runs over them when he charges, not when he's careful) and the plate drops for a moment: strike then, with a bite on his body or a blow of your own.",
             "No armor left, but a shield around his hide. Five snares now, and he steps round them unless he's charging. Bring him down the moment it drops."],
    "spire": ["Hexfang's shield is powered by crystals that flare up around the arena. Touch both of them before they dim and it knocks the wind out of him. Dodge until his stamina runs dry.",
              "Three crystals flare at a time: touch them all within 24 seconds and his shield falls for a few seconds. Strike while it's down.",
              "Four crystals, and they have to be touched in order, 1 to 4. A wrong one darkens them all. His shield falls for only a moment."],
    "hollow": ["Gorgemaw can't resist spoiled fruit. When he gorges on one, he turns green and reels. Don't eat it yourself.",
               "Two helpings of the bad fruit and his shield-like hide goes soft. Strike while he's sick, before the next one's gone.",
               "Three helpings, and more apples on the board for him to wolf down instead. Strike while the sickness lasts."],
    "reef": ["Leviathorn's shell glows with the lamps' light. Light both lamps (each burns for a while) and it knocks the wind out of him. Dodge until his stamina runs dry.",
             "Light all three lamps at once and the shell dims. Strike while it's dim.",
             "Four lamps, each gutters sooner. Light them all together and strike."],
    "crown": ["Pyrrhus is too hot to hurt. Pools of water cool him: make him cross one and he reels. Dodge until his stamina runs dry.",
              "Make him cross two pools and the heat on his scales falls away for a moment. Strike then.",
              "Three pools, and a sharp wyrm steps round them unless it's charging. Lure it over them and strike."]
}
ARENA_SPAWNS = {
    "keep": [{}, {}, {}], "spire": [{"lightning": sp(1, 9000, 13000)}, {"lightning": sp(1, 8000, 12000)}, {"lightning": sp(2, 7000, 11000)}],
    "hollow": [{"bramble": cnt(4)}, {"bramble": cnt(4)}, {"bramble": cnt(6), "fire": sp(1, 8000, 12000)}],
    "reef": [{"gust": sp(1, 9000, 14000)}, {"ghost": sp(1, 9000, 13000)}, {"gust": sp(1, 8000, 12000), "ghost": sp(1, 9000, 13000)}],
    "crown": [{"fire": sp(1, 7000, 11000)}, {"fire": sp(2, 6000, 10000)}, {"fire": sp(2, 6000, 10000), "lightning": sp(1, 8000, 12000)}]
}

# ----------------------------------------------------------------------------------------------
HEADER = """# ==================================================================
#  {title}
#  A campaign level's board. Format: docs/CONTENT-FORMATS.md (Levels); build 56's letters: docs/BUILD-56.md.
#  The island's file (content/campaign/islands/) still holds the goal, speed, sides and spawns;
#  this file is the board. Written by tools/design-levels-56.py.
#    .  open   #  wall   S  start   1 2 3  pulse walls (1 up first, 2 up second, 3 always up)
#    > < ^ v  one-way gates    a b c d  linked doors     4 5 6 7  turrets   8  cannon   G  geyser
#    E Z W N  belts east, south, west, north     ~  tar   x  crumble   *  mine   B  saw blade
#    p  pylon   l  beacon   m  snare or pool   o  bait   h  the ring's middle
# ==================================================================

"""


def write_level(path, title, isl, n, layout, edge, rows, extra=()):
    head = [f"name    = {title}", f"island  = {isl}", f"level   = {n}", f"layout  = {layout}", f"size    = {len(rows)}", f"edge    = {edge}"] + list(extra)
    text = HEADER.format(title=title) + "\n".join(head) + "\n---\n" + "\n".join(rows) + "\n"
    if SHOW:
        print(f"== {title}\n" + "\n".join(rows) + "\n")
        return
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def flood_ok(rows, name):
    """Every open square should be reachable from the start (doors and gates count as ways through)."""
    H = len(rows)
    free = {(x, y) for y in range(H) for x in range(len(rows[y])) if rows[y][x] not in "#"}
    start = next(((x, y) for y in range(H) for x in range(len(rows[y])) if rows[y][x] == "S"), None)
    if not start:
        print("  !! no start in", name)
        return
    seen, stack = {start}, [start]
    doors = {}
    for (x, y) in free:
        if rows[y][x] in "abcd":
            doors.setdefault(rows[y][x], []).append((x, y))
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p in free and p not in seen:
                seen.add(p); stack.append(p)
        ch = rows[y][x]
        if ch in "abcd":
            for q in doors[ch]:
                if q != (x, y):
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        r = (q[0] + dx, q[1] + dy)
                        if r in free and r not in seen:
                            seen.add(r); stack.append(r)
    if len(seen) < len(free) * 0.9:
        print(f"  !! {name}: only {len(seen)} of {len(free)} open squares can be reached")


def turn(rows):
    """A quarter turn clockwise, for the nightmare boards: the letters that point somewhere turn with the board."""
    H = len(rows)
    swap = {">": "v", "v": "<", "<": "^", "^": ">", "4": "5", "5": "6", "6": "7", "7": "4", "E": "Z", "Z": "W", "W": "N", "N": "E"}
    return ["".join(swap.get(rows[H - 1 - x][y], rows[H - 1 - x][y]) for x in range(H)) for y in range(H)]


def main():
    islands = ["keep", "spire", "hollow", "reef", "crown"]
    boards = {}
    for isl in islands:
        path = os.path.join(CAMP, "islands", f"{isl}.json")
        data = json.load(open(path, encoding="utf-8"))
        old = {l["n"]: l for l in data["levels"]}
        new = []
        for n in range(1, 16):
            o = old[n]
            if n in (5, 10, 15):
                fight = n // 5
                b = arena(isl, fight)
                rows = b.rows()
                boards[(isl, n)] = rows
                flood_ok(rows, f"{isl}-{n}")
                lv = dict(o)
                lv["text"] = ARENA_TEXT[isl][fight - 1]
                lv["spawns"] = ARENA_SPAWNS[isl][fight - 1]
                new.append(lv)
                write_level(os.path.join(LVL, "campaign", f"{isl}-{n}.level"), o["name"], isl, n, "arena", "wall", rows)
                continue
            S = LEVELS[isl][n]
            lv = {"n": n, "name": S["name"], "kind": o["kind"], "layout": S["layout"] if S["layout"] != "open" else o["layout"], "edge": S["edge"], "speed": S["speed"],
                  "goal": S["goal"], "text": S["text"]}
            if S["edges"]:
                lv["edges"] = S["edges"]
            lv["exact"] = True
            if S["zones"]:
                lv["zones"] = S["zones"]
            if S["dark"]:
                lv["dark"] = True
            if S["spawns"]:
                lv["spawns"] = S["spawns"]
            if S["bonus"]:
                lv["bonus"] = S["bonus"]
            # the old layout label stays valid for tools that still read it
            if S["board"] is not None:
                b = S["board"]()
                rows = b.rows()
                boards[(isl, n)] = rows
                flood_ok(rows, f"{isl}-{n}")
                extra = []
                if S["edges"]:
                    extra.append("# sides   = " + json.dumps(S["edges"], separators=(",", ":")))
                write_level(os.path.join(LVL, "campaign", f"{isl}-{n}.level"), S["name"], isl, n, lv["layout"], S["edge"], rows)
            new.append(lv)
        data["levels"] = new
        if not SHOW:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")
    # nightmare: each tunnel level is its base level's board, a quarter turn clockwise; the Maw's is the island's last arena
    NM = json.load(open(os.path.join(CAMP, "nightmare.json"), encoding="utf-8"))
    for isl in NM["order"]:
        T = NM["tunnels"][isl]
        for k in range(1, NM["levels"] + 2):
            base = NM["base"][k - 1] if k <= NM["levels"] else 15
            src_rows = boards.get((isl, base))
            if src_rows is None:
                # the maze and the field boards are not drawn here: leave their nightmare files as they are
                continue
            rows = turn(src_rows)
            name = T["names"][k - 1] if k <= NM["levels"] else f"{T['name']}: the Maw"
            extra = [f"tunnel  = {T['name']}"]
            if SHOW:
                continue
            path = os.path.join(LVL, "nightmare", f"{isl}-{k}.level")
            head = [f"name    = {name}", f"island  = {isl}", f"level   = {k}", f"tunnel  = {T['name']}", f"size    = {len(rows)}", "edge    = wall"]
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(HEADER.format(title=f"{name} (nightmare, under {isl})") + "\n".join(head) + "\n---\n" + "\n".join(rows) + "\n")
    print("done" if not SHOW else "")


if __name__ == "__main__":
    main()
