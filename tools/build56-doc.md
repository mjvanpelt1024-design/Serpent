# Build 56: the content pass

This is the document for build 56: more of everything, a new family of walls, a smarter set of enemies, bosses
that have to be solved rather than outlasted, and every level of the campaign redesigned so that it is its own
experience. It is written to be read start to finish by someone who has not seen the game, and to be looked things
up in afterwards.

> The tables below are generated from the game's own data files by `python tools/make-build56-doc.py`
> (the prose is `tools/build56-doc.md`), so they cannot drift from what the game does.
> **Every number is a placeholder until it has been playtested by a person.** The behavior was checked by
> machine (`node tools/play-check.mjs`: 412 checks, including every new system), and every level and
> boss fight was run in a browser, but nobody has *felt* them yet.

## Contents

1. [What changed, in one page](#1-what-changed-in-one-page)
2. [How the islands teach](#2-how-the-islands-teach)
3. [Walls: the board's sides, and tiles inside the board](#3-walls-the-boards-sides-and-tiles-inside-the-board)
4. [Hazards and power-ups](#4-hazards-and-power-ups)
5. [Enemies: fourteen ways to think](#5-enemies-fourteen-ways-to-think)
6. [Bosses: objectives, shields and windows](#6-bosses-objectives-shields-and-windows)
7. [New goals](#7-new-goals)
8. [Every level, island by island](#8-every-level-island-by-island)
9. [Items: weapons, armor, spells, snacks, familiars, runes](#9-items)
10. [The alignment pass: making old things match](#10-the-alignment-pass)
11. [Where things live, and how to add more](#11-where-things-live-and-how-to-add-more)
12. [Testing, and what is still guesswork](#12-testing-and-what-is-still-guesswork)

---

## 1. What changed, in one page

| Area | Before | Now |
|---|---|---|
| **Board sides** | one edge for the whole board: open, wall or mirror (random exit) | each of the four sides is its own kind, from **ten** kinds: open, wall, mirror and the new **stairs, link, bumper, briar, toll, tide, lock** |
| **Inside the board** | walls, and portals that only worked in mazes | plus **one-way gates** and **linked doors** (you choose where they lead) |
| **Hazards** | rocks, popsicles, fleas, bombs, spikes, lightning, gusts, sinkholes, brambles... | plus **turret, cannon, geyser, conveyor belt, saw blade, mine, tar, crumbling floor** |
| **Power-ups** | golden apple, shield, hourglass, star... and island wards | plus **sprout, shrink potion, boots, lantern, bell, anchor** |
| **Enemies** | 27 enemies, almost all of which walked at your head | **18 new** ones on **14 new brains** (they lead you, follow your trail, mirror you, patrol, freeze when watched, tunnel, sleep, steal, flank, lob bombs, tug you, chase your tail...), each with a visible tell |
| **Bosses** | outlast it: let it crash into you | **fight 1** is a lesson (each success knocks a third off its wind); **fights 2 and 3** are *shielded*: blows only land after you do that boss's own thing |
| **Goals** | apples, score, length, survive, keys, plates, relic, shards, thief, boss | plus **light N lamps at once, hold the ring, haul a pouch** |
| **Levels** | the same board shapes on every island, the same few hazards | all 60 non-boss levels and 15 arenas redesigned: one idea per level (section 8) |
| **Items** | 104 | **+36**: 6 weapons, 8 armor pieces (4 sets), 6 spells, 4 snacks, 6 familiars, 6 runes |
| **Art** | the flea was huge and ugly, the popsicle a blue blob | both redrawn at all three board sizes; 40 new sprites in the house style |

Nothing was removed. Saves keep working; the old levels' *files* were rewritten, so a level you have won stays won.

---

## 2. How the islands teach

The rule for this pass: **you only meet a new idea on the island that introduces it, and the island's
levels train the thing its boss will ask of you.** The first island is the old game with a few new ideas lightly
added; by the Cinder Crown everything is on the table at once.

| Island | New sides | New hazards | New enemies | New goals | Boss objective | Levels that train it |
|---|---|---|---|---|---|---|
| **1. Brightscale Keep** | open and wall only (the old mirror once, level 11); *per-side* open/wall mixes (level 3, 8) | crumbling floor (4), mines (8), turrets (9), tar (11) | crow (6), hound (7, 12, 14), warden (9, 13) | none new | **snares**: lure Grimscale over them | 9 (traps catch enemies that chase you; a warden to lure), 14 (a hound to lead) |
| **2. Arcanum Spire** | **stairs** (1-3), **link** (4, 8, 9) | belts (11), cannons (14) | mirror shade (6, 13), gargoyle (7, 12), gale sprite (8), warding orb (9) | none new (ordered plates return, 13) | **crystals**: touch them all before they dim; in order in the last fight | 13 (ordered plates), 8 (ordered pickups under pressure), 4 and 9 (reading where a side leads) |
| **3. Feastwood Hollow** | **bumper** (1, 6, 11, 14), **briar** (2), **toll** (4) | belts (3, 9), saws (11, 14), tar (4) | crow (7, 13), locust pack (6), boar (8), gnasher (9, 12), gargoyle (13) | **haul** (3) | **spoiled fruit**: let Gorgemaw gorge on it | 7, 8, 13 (crows and boars react to apples: you learn that apples pull enemies) |
| **4. Tidecoil Reef** | **tide** (1, 6, 14), stairs and doors again (3, 4) | geysers (9, 14), mines (9), belts as currents (2, 11) | flying fish (6), shark (7, 13), anglerfish (8, 12), bomb squid (9) | **beacons** (8), **hold** (3) | **lamps**: light them all at once | 8 (the same lamps, in the dark), 1, 6, 9, 14 (timing a side that opens and closes) |
| **5. Cinder Crown** | **lock** (1), everything combined | lava, bombs, mines, geysers, cannons, saws, crumbling floor, belts | cinder knight (6, 13), bomb imp (6), golem (7, 12), ember hound (7), gargoyle (9) | **hold** (14), **haul** (3) | **pools**: lure Pyrrhus through water | 2, 3, 11 (routing a chase through hazards), 7 (a hound that follows your trail) |

Honest note: the Keep, Spire, Hollow and Reef have a level that *is* the boss's mechanic in miniature
(the Reef's lamps, the Spire's ordered plates). The Keep and the Crown teach their lure objective more
indirectly (enemies chasing you through traps and hazards): their first fight is the real lesson.

---

## 3. Walls: the board's sides, and tiles inside the board

### 3.1 The ten kinds of side

A level's `edge` (`wrap`, `wall`, `mirror`) is still the default for all four sides. A level's `edges` names any
side on its own: `top`, `right`, `bottom`, `left`. A value is either a word (`"stair"`) or an object with numbers
(`{"kind": "link", "to": "left", "flip": true}`).

| Kind | What it does when your head leaves the board through it | Numbers | First met |
|---|---|---|---|
| **open** (wrap) | you come out of the opposite side, same row or column | - | Keep 1 |
| **wall** | you die | - | Keep 2 |
| **mirror** | you come out of a *random* side (the old mirror) | - | Keep 11 |
| **stair** | you come out of the opposite side **one row lower** (leaving a left or right side) or **one column to the right** (leaving the top or bottom): the board is a spiral | `shift` (default 1) | Spire 1 |
| **link** | you always come out of one chosen side, heading in. The controlled replacement for the random mirror | `to` (a side), `flip` (come out the far end of it), `shift` | Spire 4 |
| **bounce** (bumper) | you are turned along the edge instead of leaving; you pick the side with more room | `turn`: `cw`, `ccw` or `auto` | Hollow 1 |
| **briar** | half a heart (a piercing hit), then a bumper's turn | - | Hollow 2 |
| **toll** | open, for a price: points off your score, or two tail squares if you cannot pay | `pay` (points) | Hollow 4 |
| **tide** | open for 5.6 seconds, a wall for 3.4, forever; it flashes for 1.3 seconds before each change. Different sides are out of step | `phase` (ms) | Reef 1 |
| **lock** | a wall until its condition is met, then whatever `then` says (open by default) | `after`: `{apples: n}`, `{score: n}`, `{secs: n}` or `{pieces: n}` | Crown 1 |

Examples from the levels:

```json
"edges": { "left":  { "kind": "link", "to": "right", "flip": true },
           "right": { "kind": "link", "to": "left",  "flip": true } }           // Spire 4, the Hall of Mirrors

"edges": { "top":    { "kind": "link", "to": "right" },  "right": { "kind": "link", "to": "bottom" },
           "bottom": { "kind": "link", "to": "left" },   "left":  { "kind": "link", "to": "top" } }   // Spire 9: a clockwise pinwheel

"edges": { "right": { "kind": "lock", "after": { "apples": 8 }, "then": "open" }, "left": "open" }    // Crown 1
```

**How you read them in the game.** Each special side is drawn as a strip along the board: stairs are teal with
little steps, a link is a color that its arrival side repeats (so you can see where it comes out), a bumper is a
yellow spring that jerks when you touch it, a briar is dark green thorns, a toll is gold with coins, a tide is blue
with waves (and flashes white before it closes), a lock is grey with a padlock that turns green when it opens.
Walls are the old red. The level's card on the map lists them under *Sides*, and a line of toast says them when the
level starts.

**How it works** (`src/campaign/camp-edges.js`). The old engine knows one edge for the whole board, so a level with
its own sides runs on the engine's *wall* edge and `camp-edges.js` wraps `stepSnake`: when the head is about to leave the
board it works out which side, asks what that side is *right now*, and either lets the engine kill you (wall), turns you
(bumper, briar) or moves the head to the landing square and lets the engine take the step from there (open, stair, link,
toll, mirror). The step's undo point is recorded first, so a revive still puts you back where your head really was. A
landing square that is blocked slides along the side to the next free one, so no side is ever a trap. Enemies see the
board as walled; they never use the sides.

### 3.2 Tiles inside the board

Written in a level's `.level` file (the letter legend is at the top of every file).

| Letter | Tile | What it does |
|---|---|---|
| `>` `<` `^` `v` | **one-way gate** | passable only in the direction of the arrow; the other way it is a wall |
| `a` `b` `c` `d` | **linked doors** | put one letter on two squares. Walk into one and you come out just past the other, still heading the way you were going. A level can have four pairs |

Gates and doors are in the board's wall map, so enemies, the boss and the pathfinding treat them as walls.

---

## 4. Hazards and power-ups

Eight new hazards (`src/campaign/camp-hazards.js`). **Every one gives a tell before it hurts**, so each can be read and beaten.

| Hazard | Board letter | What it does | The tell |
|---|---|---|---|
| **Turret** | `4` east `5` south `6` west `7` north | fires along its row or column: half a heart if it finds your head, robs your body | the whole line glows red and flickers faster for 0.85 s |
| **Cannon** | `8` | the same, a whole heart, and it **turns a quarter** after every shot | the line, for 1 s |
| **Geyser** | `G` | erupts in a plus shape and scalds (fire) | it bubbles for 1.1 s first |
| **Conveyor belt** | `E` `Z` `W` `N` | after each step that lands you on it, shoves you **one extra square** the way its arrows point | the arrows run |
| **Saw blade** | `B` | rides a rail back and forth (the free squares around it); a whole heart | the rail is drawn faintly; the blade spins |
| **Mine** | `*` | step on it and a fuse of 0.8 s starts, then a blast in a plus: run | it blinks red |
| **Tar** | `~` | slows you for a moment | - |
| **Crumbling floor** | `x` | step on it and 1.3 s later it is a pit (deadly) for 7 s, then mends | it cracks and darkens |

Where they are put: a level's board places them exactly (the letters above), and a level's `spawns` can also scatter
them (`"blade": {"count": 2}`). **A trap now catches an enemy that walks onto it** (stuns it 3.5 s): the first thing
that teaches you to lure.

Six new power-ups. They turn up where the trouble they answer does (`POWER_FOR` in `camp-foes.js` and `camp-hazards.js`):

| Power-up | Does | Answers |
|---|---|---|
| **Sprout** | three apples spring up round you | crows |
| **Shrink potion** | your tail is four squares shorter | saws, brambles |
| **Boots** | a 5-second burst of speed | turrets, cannons, mines |
| **Lantern** | 12 seconds of sight in the dark | any dark level |
| **Bell** | every enemy dazed 3.5 s, the boss 1.2 s | sentries, gargoyles, leapers, hounds, bombers |
| **Anchor** | 12 s in which nothing can push or pull you (gusts, belts, gale sprites) | gale sprites, belts, gusts |

---

## 5. Enemies: fourteen ways to think

Before this pass nearly every enemy chased your head: the new ones each ask something different of you. A **brain** is
what an enemy names as its `kind` in `foes.json`; the code is `src/campaign/camp-brains.js`. Every enemy still bites
your head (`bite`), robs your body (`steal`), takes your weapons by its own immune/resist/weak lists, and **shows its tell
before it acts**.

| Brain | How it thinks | What it asks of you | Its tell |
|---|---|---|---|
| **ambusher** | aims at the square four ahead of your head | stop running straight; weave | a red square where it is aiming |
| **shadow** | walks your exact trail, 10% faster than you | keep moving, never double back; lead it somewhere useful | it is always on your path |
| **mirror** | stays your reflection across the board (you go right, it goes left) | do not meet it in the middle; use it as a lure | a violet outline |
| **sentry** | patrols a line, turning at walls; chases whatever it *sees* along its facing for 3.8 s, then goes back | sneak across its sight line; lure it over a trap | its sight line is drawn; a `!` when it notices you |
| **watcher** | only moves while you are **not** facing it | face it to freeze it; it creeps up when you turn away | it turns stone-grey while watched |
| **orbiter** | circles an apple; breaks off to chase you when you step inside its ring | take the apple the long way, or lure it away | the ring is drawn dotted |
| **leaper** | jumps onto a square it has just marked: a **knight's L**, or **three in a line** | be off that square a heartbeat later | the landing square glows red for 0.65 s |
| **burrower** | tunnels under the floor (harmless there), cracks the ground where you *will be*, bursts up for 1.5 s | read the dust trail; step off the crack | a dust trail; a crack, reddening, before it rises |
| **sleeper** | asleep until you **eat an apple within 7 squares** (or brush past), then hunts for 6 s and dozes off again | plan where you eat | `z`s over it; a `!` when it wakes |
| **pilferer** | steals an apple off the board and runs for an edge; **harmless** | run it down with your head: it drops points | a little apple over its head |
| **pincer** | a pack; each takes a different side three squares off your head, then they all close in | do not be in the middle of the board | they glow red once all are in place |
| **bomber** | keeps its distance and lobs a bomb three squares ahead of you | change direction, do not run in a line | a raised bomb and a `!` for half a second |
| **gale** | sits still; every 4-6 s tugs you one square toward it | stay out of its line, or use an anchor | streaks run along the line to you for 0.9 s |
| **tailbiter** | goes for your tail, not your head | a long tail is a target, so is a short one that stops | - |

### The new enemies

{{ENEMY_TABLE}}

### The older ones, unchanged

They keep their brains (and, where they were chasers, they still chase; the new ones sit beside them rather than
replacing them). A level only gets the older island enemies if it does not say `exact`.

{{OLD_ENEMY_TABLE}}

Designed to be read: an enemy that is a threat is one you can see coming, and the answer to each is something you can
*do* (face it, step aside, eat elsewhere, lure it) rather than only avoid.

---

## 6. Bosses: objectives, shields and windows

Every island's boss is fought three times (levels 5, 10 and 15). The old way to hurt one was to let it crash
into your body. That still works, but from the second fight on **its shield holds until you have done its own thing**.

* **Fight 1 is the lesson.** It is *not* shielded. Each time you do the boss's thing, it knocks a third off its wind (about three
  successes win the fight). Crashing it into you still works as before. The point is to let you learn the trick with no risk.
* **Fights 2 and 3 are shielded.** A shimmering dome (in the island's color) is around the boss. Blows (its crashes into you, your
  weapon, spells, a bite on its body) are refused with "Its shield holds!" until you complete the objective. Then the dome cracks
  for a **window** (7 s in fight 2, about 6 in fight 3): the boss is dazed (half speed), a bite on its body counts, and every blow lands.
  When the window shuts the objective resets, a little after, and you do it again.
* **An exhausted boss is open too** (its stamina ran out, as before), so there is always a slow, safe, old-fashioned way.
* The boss's other tricks (charges, blinks, summons, rage, a last rally...) still run on top of this.

{{OBJECTIVE_TABLE}}

**The four kinds of objective** (`src/campaign/camp-objectives.js`, numbers in `foes.json` `objectives`):

* **Lure (snares at the Keep, pools at the Crown).** Marks lie on the board (the `m` squares in the arena's `.level`). The boss must run its
  head over `n` of them. A boss that charges does not swerve, so you bait a charge across them; in the last fight a sharp boss steps
  round a mark 70% of the time unless it is charging. Snares snap, pools cool it (a hiss, and it staggers). Once too few are left to finish, a fresh set is laid.
* **Crystals (the Spire).** `n` crystals flare at the arena's `p` squares. Touch them all within the time or they dim and you start again.
  In the last fight they are numbered and a wrong one darkens them all. Lit crystals beam to the dome.
* **Spoiled fruit (the Hollow).** Rotten bait appears on the `o` squares. The boss cannot resist it: it leaves off hunting you and goes
  for the nearest bait. When it gorges `n` times, it turns green and the shield drops. **Do not eat the bait yourself** (it is rotten),
  and if you do, more appears. (Its old apple-devouring trait now ignores bait, so you cannot feed it by accident.)
* **Lamps (the Reef).** Lamps stand on the `l` squares. Touch one and it burns for a while (a draining ring shows how long);
  the shield drops while all of them burn at once.

The boss plate and the *Objective* plate at the side show the live progress ("Crystals 2 of 3 (14 s), in order",
"Shield down! Strike it!"). The map's card for a boss level has an *Its weakness* row.

The arenas (`content/levels/campaign/<island>-5|10|15.level`) are drawn for it: the objective's spots are in the board, the
pillars get denser fight by fight, and the corners where the boss starts are always clear.

---

## 7. New goals

A level's `goal` can now also be:

| Goal | Where | How it plays |
|---|---|---|
| **beacons** `{need, lit}` | Reef 8 | lamps stand about the board; touching one lights it for `lit` seconds; win when all burn at once. Lit lamps light the ground round them in a dark level, and an unlit one is a faint ember |
| **hold** `{need, move, decay}` | Reef 3, Crown 14 | stand inside a 3 x 3 ring for `need` seconds in all. Each time you have held it `move` seconds it moves; outside it you lose `decay` seconds a second |
| **haul** `{need}` | Hollow 3, Crown 3 | pick up a pouch (it rides on your head), take it to the drop-off on the far side, `need` times. **A hit that lands drops it** where you stand |

The side pointer and the objective plate understand all three.

---

## 8. Every level, island by island

Every non-boss level was redesigned around **one idea** that makes it unlike the others on its island
(*The idea*, taken from the level's own card). The 15 lairs each have their own arena for fights 1, 2 and 3.
Boards are in `content/levels/campaign/`; they and the island entries are written by
`tools/design-levels-56.py`. The two generated kinds, the mazes (level 12) and the fields (level 13), keep their boards
(80 and 48 squares wide) but have new goals, hazards, enemies and darkness.

All levels except the lairs are `exact`: they spawn exactly what their entry lists (plus the answers to it), instead of the
island's automatic enemies and the zones that used to put a sinkhole in level 2 and a popsicle in level 6 of every island.

{{LEVEL_TABLES}}

The nightmare tunnels (`content/levels/nightmare/`) were re-baked: each is its base level's new board, a quarter turn
clockwise, and the letters that point somewhere (gates, turrets, belts) turn with the board.

---

## 9. Items

36 new things, all in the system that was already there: each borrows an old item's behavior with `acts`
(`docs/CAMPAIGN.md`, build 52). Merchants stock them (the Armory, Arcana, Kitchen, Familiars and Runes). Data:
`tools/add-items-56.py` (safe to run twice); pictures: `tools/textures/items56-art.py`.

### Weapons

{{WEAPON_TABLE}}

### Armor: four sets of two pieces

{{SET_TABLE}}

{{ARMOR_TABLE}}

### Spells

{{SPELL_TABLE}}

### Snacks

{{SNACK_TABLE}}

### Familiars

{{PET_TABLE}}

### Runes

{{RUNE_TABLE}}

Two ids the first draft used belonged to the Wandering Smith mod (`halberd`, `trident`, `rapier`, `tidehelm`); they were renamed so the mod and the
base game can be on together.

---

## 10. The alignment pass

*"The flea is huge and the art looks awful, the popsicle needs to be more conical... look at everything under that lens."*

**The rules this pass enforces**, so that old and new things match:

1. **One size per kind of thing.** Board items are one square: 19 pixels (`-19`), 9 on half-size squares (`-9`) and 39 for the big ones
   (`-39`). Nothing is allowed to overflow its square apart from a stick that pokes into the square below. The old flea was a 29 x 29 picture
   with its legs spread two squares wide.
2. **12 x 12 outlined sprites for everything that is not an item square** (foes, hazards, power-ups, board pieces, items): flat colors,
   a one-pixel dark outline, a light side up-left.
3. **Floors have no outline** (conveyor, tar, crumbling floor), so a row of them reads as a surface.
4. **A tell is part of the picture**, not an afterthought: the turret's lane, the leaper's landing square.

**What was redone.**

* **The flea** (`board/items/flea-9|19|39.png`): a compact outlined flea, brown with segmented stripes, a pale eye, feelers and six legs, inside its
  square at all three sizes. Anchored at the square's corner like every other board item.
* **The popsicle** (`board/items/popsicle-*.png` and its menu icon `icons/popsicle.png`): a **cone**: a point on top, widest at the base,
  three bands of blue with a shine down the left, on a wooden stick that pokes into the square below.
* **A review of every existing foe, hazard and power-up** against the contact sheet: they were already consistent 12 x 12 outlined sprites,
  so they were left alone. The story book's popsicle (`scenes/story/kit/popsicle.png`) is a separate color-swap scene picture and was
  **not** changed: it still shows the old blob. That is the one mismatch left.
* **New art** (40 sprites, `tools/textures/content-pass-art.py` and `items56-art.py`; both only write files that do not exist,
  `--force` redraws): 18 enemies, 8 hazards, 6 power-ups, 8 board pieces (crystals, lamps, snare, pool, pouch, drop-off) and 36 items.

**Behavior that was lined up with it:**

* The keeper stands lower, the strips and tells follow the same palette as the walls, and every new enemy has a `foe:<id>` picture
  registered in `textures/index.json` like the old ones.
* A level's old zones (sinkhole in 2-3, popsicles in 6, traps in 8-9, lightning in 11-14 on **every** island) no longer apply to a
  level that is `exact`: each island's levels decide their own hazards.
* The boss plate, the objective plate and the map's boss card all say what the objective is.

**Not done, on purpose:** the old enemies' *brains* were not rewritten (the wasp, bee, ghost, crab... still chase; they are the
baseline that the new ones are different from), and the older foes were not renamed or re-tuned beyond their level placement.

---

## 11. Where things live, and how to add more

| What | Where |
|---|---|
| The sides, gates and doors | `src/campaign/camp-edges.js`; level entries' `edges`; letters `> < ^ v a b c d` in `.level` files |
| Enemy brains | `src/campaign/camp-brains.js` (`BRAINS`), wired into `camp-bestiary.js`; enemies in `foes.json` `enemies` |
| Hazards, belts, mines..., power-ups | `src/campaign/camp-hazards.js`; numbers in `foes.json` `hazards`; board letters above |
| Boss objectives, the new goals | `src/campaign/camp-objectives.js`; numbers in `foes.json` `objectives`; spots `p l m o h` in arena `.level` files |
| Every level | `tools/design-levels-56.py` (the source of the 60 levels it writes) |
| New items | `tools/add-items-56.py`, art `tools/textures/items56-art.py` |
| New sprites and the flea/popsicle | `tools/textures/content-pass-art.py` |
| This document | `tools/build56-doc.md` + `tools/make-build56-doc.py` |

After changing data: `python tools/check-campaign.py`, `python tools/sign-content.py`, `python tools/bundle-content.py`, then `node tools/play-check.mjs`.

**Add a kind of side.** Add its words to `EDGE_NAMES` and its rule to the big `stepSnake` wrapper in `camp-edges.js` (one `if (kind === ...)` that
either returns after taking the step itself or sets `kind = "open"`), its strip to `drawEdges`, its name to `EDGE_KINDS` in `tools/check-campaign.py`.
**Add a brain.** One entry in `BRAINS` (`tick(id) -> fn(e, ts)`, optional `draw`, `touch`, `spawn`, `edge: true` if it should come in from an edge); then an
enemy in `foes.json` with `"kind": "<brain>"`, `"explicit": true`, and a `foe:<id>` picture. Add the kind to `ENEMY_KINDS` in the checker.
**Add a hazard.** An entry in `ENTITY_TYPES` in `camp-hazards.js` (with a `tick`, a `touch`, a `draw`, and a tell), a letter in `BOARD_ENTS`, a picture
`foe:<id>`, the id in `SPAWNS` and `PLACED` of the checker. **Add a boss objective kind.** A branch in `bossObjSpawn`, in `tickBossObjective` and in
`bossObjLine` (`camp-objectives.js`), and an island's entry in `objectives`.

---

## 12. Testing, and what is still guesswork

**Checked by machine** (`node tools/play-check.mjs`, 412 checks): every board builds from its file; every side kind does what it says
(stairs, flipped and pinwheel links, bumper, briar, toll, tide open and shut, lock before and after); gates and doors; every hazard (belt,
turret hit and miss, mine, crumble to a pit, geyser, saw blade on its rail); **all 18 enemies** run 400 ticks without leaving the board or throwing,
and the ones with a signature behavior do it (the mirror shade ends up exactly across from you, the gargoyle holds still while watched and creeps when
not, the boar sleeps until an apple is eaten near it, the crow takes an apple); **all 15 boss fights** spawn their objective, drop the shield when it is
done and let a blow land only then; the three goals. Also: the data check (`tools/check-campaign.py`), the pictures check (1,393 files), and a soak
that started every level and ran it for a few seconds with its enemies forced on.

**Not checked by a person.** Everything about *feel*: whether the tides are too fast, whether a hound is too relentless, whether the
Crown's boss is fair, whether the levels' goals are the right size. The numbers that most want tuning:

* `foes.json`: every enemy's `ms`, `sight`, `warn`, `every` and `steal`; the objectives' `window`, `secs`, `lit` and `count`.
* `camp-edges.js`: `EDGE_TIDE` (9 s period, 5.6 s open), the toll defaults.
* the levels' `need` and `speed` (they kept their old slots' numbers).

**Known gaps.**

* The sandbox editor cannot place the new tiles or edges yet (a sandbox level plays as before); `.level` files made by hand can.
* The story book's popsicle picture is still the old shape.
* The nightmare tunnels reuse the new boards but not their `edges` (they are walled, as before).
* Mazes (level 12) and fields (13) cannot have their own sides (they are wrap-around by nature).
* The old enemies were not re-braided.
* Boss objectives are only in island bosses; the quest champions still fight the old way.
