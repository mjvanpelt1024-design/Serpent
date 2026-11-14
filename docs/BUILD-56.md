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

| Enemy | Brain | Where | Hits with | Takes | What to do |
|---|---|---|---|---|---|
| Castle hound (`hound`) | shadow | keep | piercing | weak electricity | hounds pick up your trail and follow it, a little faster than you walk it |
| Thieving crow (`crow`) | pilferer | keep, hollow | piercing | weak fire | crows snatch an apple off the board and run for an edge: catch one with your head for points |
| Tower warden (`warden`) | sentry | keep | slashing | resists slashing, piercing; weak electricity | wardens patrol a line, and chase whatever they see for a few seconds |
| Mirror shade (`reflection`) | mirror | spire, crown | electricity | weak fire | a mirror shade copies your moves from the other side of the board: it goes left when you go right |
| Stone gargoyle (`gargoyle`) | watcher | spire, hollow, crown | slashing | resists slashing, piercing; weak ice | gargoyles only move while you aren't facing them |
| Warding orb (`orb`) | orbiter | spire | electricity | immune electricity; weak venom | warding orbs circle an apple; step inside their ring and they chase you |
| Gale sprite (`galesprite`) | gale | spire | ice | weak piercing | gale sprites sit still and tug you a square toward them; the streaks show first |
| Gnasher worm (`gnasher`) | burrower | hollow | slashing | weak electricity | gnashers tunnel under the floor, crack the ground where you're going, and burst up |
| Locust (`locust`) | pincer | hollow | piercing | weak fire | locusts come as a pack from different sides and close the ring |
| Boar (`boar`) | sleeper | hollow | piercing | resists piercing; weak venom | boars sleep until you eat an apple nearby or brush past, then hunt for a while |
| Anglerfish (`angler`) | ambusher | reef | piercing | weak electricity | anglerfish aim for where you're going, not where you are |
| Bomb squid (`squid`) | bomber | reef | fire | weak ice | bomb squids keep their distance and lob bombs where you're heading |
| Flying fish (`flyingfish`) | leaper | reef | piercing | weak electricity | flying fish leap three squares onto the square they've just marked |
| Reef shark (`shark`) | tailbiter | reef | slashing | resists slashing; weak electricity | sharks go for your tail, not your head |
| Magma golem (`golem`) | sleeper | crown | fire | immune fire; weak ice | golems sleep until you eat an apple nearby, then hunt for a while |
| Cinder knight (`cinderknight`) | leaper | crown | fire | immune fire; resists slashing; weak ice | cinder knights move like a chess knight, onto the square they've marked |
| Bomb imp (`blastimp`) | bomber | crown | fire | immune fire; weak ice | bomb imps keep away and lob bombs where you're heading |
| Ember hound (`emberhound`) | shadow | crown | fire | immune fire; weak ice | ember hounds follow your trail a little faster than you walk it |

### The older ones, unchanged

They keep their brains (and, where they were chasers, they still chase; the new ones sit beside them rather than
replacing them). A level only gets the older island enemies if it does not say `exact`.

| Enemy | Brain | Where |
|---|---|---|
| Tin knightling (`knightling`) | chaser | keep, from level 7 |
| Scorpion (`scorpion`) | crawler | keep, crown, from level 8 |
| Spark beetle (`sparkbeetle`) | charger | spire, from level 7 |
| Ink wraith (`inkwraith`) | drifter | spire, from level 8 |
| Blade mantis (`mantis`) | charger | hollow, from level 7 |
| Marsh viper (`viper`) | chaser | hollow, from level 8 |
| Frost sprite (`frostsprite`) | blinker | reef, from level 7 |
| Sea urchin (`urchin`) | lurker | reef, from level 8 |
| Cinder bat (`firebat`) | drifter | crown, from level 7 |

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

| Island | Boss | Kind | Fight 1 (the lesson) | Fight 2 (shield) | Fight 3 (shield) |
|---|---|---|---|---|---|
| Brightscale Keep | Grimscale the Black Knight | lure (snares) | need 1, 3 on the board, each knocks off 34% of its wind | need 2, 4 on the board, shield down 7.5 s | need 3, 6 on the board, shield down 6 s |
| Arcanum Spire | Hexfang the Archmage | pylons (crystals) | need 2, 30 s to do it, each knocks off 34% of its wind | need 3, 24 s to do it, shield down 7.5 s | need 4, 22 s to do it, in order, shield down 6.5 s |
| Feastwood Hollow | Gorgemaw the Glutton | bait (spoiled fruit) | need 1, 2 on the board, each knocks off 34% of its wind | need 2, 3 on the board, shield down 7.5 s | need 3, 4 on the board, shield down 6.5 s |
| Tidecoil Reef | Leviathorn | beacons (lamps) | need 2, lamps burn 16 s, each knocks off 34% of its wind | need 3, lamps burn 13 s, shield down 7 s | need 4, lamps burn 11 s, shield down 6 s |
| Cinder Crown | Pyrrhus the Cinder Wyrm | lure (pools) | need 1, 3 on the board, each knocks off 34% of its wind | need 2, 4 on the board, shield down 7 s | need 3, 5 on the board, shield down 6 s |

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

### 1. Brightscale Keep (medieval)

| # | Level | Goal | Sides | Board | On the board | The idea |
|---|---|---|---|---|---|---|
| 1 | The Village Green | eat 10 apples | open | - | - | Snake the way it has always been: no walls, no hazards, just you and the apples. |
| 2 | Castle Yard | reach 1,500 points | walls | - | - | Now there are walls, and they mean it. A well stands in the yard. Reach 1,500 points. |
| 3 | The Pillared Hall | eat 14 apples | T: open, R: wall, B: open, L: wall | - | rock x3 | The hall's side doors are walls, but its ends are open: leave one end and come back in the other. |
| 4 | Frostkeep Cellar | grow to 22 | walls | crumble | popsicle, rock x2 | The cellar is chilly and the popsicles are not food. Cracked flagstones (the pale ones) fall away a moment after you step on them, and they mend slowly: don't go back over one. |
| 5 | Lair: The First Hunt | wear it out | walls | - | boss shield: snares | Grimscale rides out, and you cannot hurt him yet. Each time he charges over a snare in the grass (the pale marks), it knocks the wind out of him. |
| 6 | Flea Market | eat 16 apples | walls | - | flea, crow | Haggling fleas, and thieving crows that snatch an apple off the board and run for the edge. |
| 7 | The Apiary Gate | reach 3,500 points | walls | gate | wasp, hound | The hive has one-way doors (the arrows): a bee's way in is one way only, and so is yours. |
| 8 | Jousting Lists | survive 60 s | T: wall, R: open, B: wall, L: open | mine | wasp, flea | Ride off either end of the lists and come back in at the other; the rails above and below are walls. |
| 9 | Watchtower Ring | find 3 keys, then the gate | walls | turret | warden | Archers in the corner towers fire along their row or column (the line shows first). |
| 10 | Lair: The Armored Duel | break its armor | walls | - | boss shield: snares | Grimscale's silver plate turns every blow. Make him run over two snares (he runs over them when he charges, not when he's careful) and the plate drops for a moment: strike then, with a bite on his body or a blow of your own. |
| 11 | The King's Road | eat 12 apples | mirror | tar | flea | Weave through the comb and eat 12. The road's edges are mirrors: leave one and you can come out of any side. |
| 12 | The Hedge Maze | find the crown relic | (a maze) | -, dark | hound, flea | Night has fallen on the royal hedges. Somewhere lies the Lost Crown. A hound keeps to your trail, so don't stand still. |
| 13 | Hall of Plates | press 4 plates | (a maze) | - | rock x4, warden | An endless hall of mirrored walls. Step on all four pressure plates and the great seal appears. |
| 14 | The Shifting Bailey | eat 18 apples | walls | - | wasp, hound | The castle walls rise and fall on a timer. Watch for the glow. Eat 18 apples. |
| 15 | Lair: The Last Stand | finish it | walls | - | boss shield: snares | No armor left, but a shield around his hide. Five snares now, and he steps round them unless he's charging. |

### 2. Arcanum Spire (wizard)

| # | Level | Goal | Sides | Board | On the board | The idea |
|---|---|---|---|---|---|---|
| 1 | Apprentice Courtyard | reach 2,500 points | T: wall, R: stairs, B: wall, L: stairs | - | molasses, golden | The courtyard is a spiral stair: out the right side, in the left one row lower. |
| 2 | Rune Circle | eat 15 apples | T: stairs, R: stairs, B: stairs, L: stairs | - | spikes x6 | Every side of the circle is a stair: out the right and you come in the left a row lower, out the bottom and you come in the top a column over. |
| 3 | Storm Library | survive 45 s | T: stairs, R: wall, B: stairs, L: wall | - | lightning | The shelves climb: leave through the top and you come out of the bottom a column to the right. |
| 4 | Hall of Mirrors | reach 4,000 points | T: wall, R: link, B: wall, L: link | - | spikes x4, molasses | The mirrors here aren't random any more: the left and right glass lead to each other, but flipped, so what leaves at the top of one comes in at the bottom of the other. |
| 5 | Lair: The First Hunt | wear it out | walls | - | boss shield: crystals | Hexfang's shield is powered by crystals that flare up around the arena. |
| 6 | Wisp Wood | eat 18 apples | walls | - | ghost, reflection | Ghosts drift through the trees, and a mirror shade copies your every move from across the glade: when you go right it goes left, so don't meet it in the middle. |
| 7 | The Familiar's Den | corner the thief 3 times | walls | door | wasp, gargoyle | Wardrobe doors link the four rooms (the glowing ones: go in one and come out past the other of its color). |
| 8 | Spellbound Stacks | find 3 keys, then the gate | T: link, R: wall, B: link, L: wall | - | ghost, lightning, galesprite | The stacks loop top to bottom, flipped. A gale sprite sits in the aisles and tugs you toward it a square at a time (the streaks show first). |
| 9 | Astral Observatory | reach 6,000 points | T: link, R: link, B: link, L: link | - | spikes x4, orb | The dome turns: each side leads to the next, clockwise (top to the right side, right to the bottom, bottom to the left, left to the top). |
| 10 | Lair: The Armored Duel | break its armor | walls | - | boss shield: crystals | Three crystals flare at a time: touch them all within 24 seconds and his shield falls for a few seconds. |
| 11 | Ley Line Tunnel | eat 12 apples | walls | belt | flea | Ley lines run round the tunnel: the belts shove you an extra square the way their arrows point. |
| 12 | The Twisting Archive | find the grimoire relic | (a maze) | -, dark | ghost, gargoyle | The archive is dark, and gargoyles hold still while you look at them. Find the Forbidden Grimoire. |
| 13 | Glyph Field | press 5 plates in order | (a maze) | - | spikes x6, reflection | An endless hall of glyphs. Press the plates in order, 1 to 5 (a wrong one resets them all), then the seal. |
| 14 | Pulse of the Spire | reach 7,000 points | walls | - | lightning, cannon x2 | The walls beat in diagonals, and the wizards' cannons turn a quarter after every shot. |
| 15 | Lair: The Last Stand | finish it | walls | - | boss shield: crystals | Four crystals, and they have to be touched in order, 1 to 4. A wrong one darkens them all. |

### 3. Feastwood Hollow (harvest)

| # | Level | Goal | Sides | Board | On the board | The idea |
|---|---|---|---|---|---|---|
| 1 | Orchard Row | eat 18 apples | T: bumper, R: open, B: bumper, L: open | - | golden | Rows of fruit trees. The fence along the top and bottom is a bumper: it turns you along it instead of letting you out. |
| 2 | Bramble Patch | reach 4,000 points | T: open, R: briar, B: open, L: briar | - | bramble x6 | The hedge at either side is briar: it pricks you for half a heart, and turns you. |
| 3 | The Bakehouse | deliver 4 pouches | walls | belt | fire | Carry the loaves from the ovens to the counter, one at a time: a hit drops the one you're carrying. |
| 4 | Honey Hall | grow to 28 | T: wall, R: toll, B: wall, L: toll | tar | molasses, frenzy | Honey pools slow you. The doors at either end are tolls: out the side and in the other, for 40 points a time. |
| 5 | Lair: The First Hunt | wear it out | walls | - | boss shield: spoiled fruit | Gorgemaw can't resist spoiled fruit. When he gorges on one, he turns green and reels. |
| 6 | The Beehive | eat 20 apples | T: bumper, R: bumper, B: bumper, L: bumper | - | wasp, locust | The hive's walls bounce: every side turns you along it. Wasps, and a pack of locusts that comes at you from four sides at once. |
| 7 | Fox Run | reach 7,000 points | open | - | bramble x4, crow | Hay bales and open ground, the sides wrap. A crow steals apples off the board, and a hound follows your trail. |
| 8 | Pantry Raid | find 4 keys, then the gate | walls | - | flea, wasp, boar | A boar sleeps in the pantry. Eating an apple near it wakes it, and so does brushing past. |
| 9 | Mill Stream | corner the thief 4 times | walls | belt | ghost, bramble x4, gnasher | The millrace runs two ways at once: the belts across the middle shove you east along the upper lane, west along the lower. |
| 10 | Lair: The Armored Duel | break its armor | walls | - | boss shield: spoiled fruit | Two helpings of the bad fruit and his shield-like hide goes soft. Strike while he's sick, before the next one's gone. |
| 11 | The Cart Track | eat 12 apples | T: bumper, R: open, B: bumper, L: open | blade | flea | Saw blades ride the cart rails (the faint lines) back and forth. The ends of the track bounce you. |
| 12 | Hedge of Thorns | find the ladle relic | (a maze) | -, dark | wasp, gnasher | Thorns all round in the dark, and gnashers under the ground: watch for ripples, then a crack. |
| 13 | Scarecrow Field | gather 6 pouches | (a maze) | - | bramble x10, crow, gargoyle | Gather six pouches of seed. The crows are after the same seed: they steal apples, and the scarecrows only move when you look away. |
| 14 | Threshing Floor | eat 24 apples | T: wall, R: bumper, B: wall, L: bumper | - | bramble x3, fire, blade x2 | Threshers sweep the floor on their rails while the walls beat in rows and columns. |
| 15 | Lair: The Last Stand | finish it | walls | - | boss shield: spoiled fruit | Three helpings, and more apples on the board for him to wolf down instead. |

### 4. Tidecoil Reef (ocean)

| # | Level | Goal | Sides | Board | On the board | The idea |
|---|---|---|---|---|---|---|
| 1 | Shallow Lagoon | reach 5,000 points | T: open, R: tide, B: open, L: tide | - | gust | The tide washes in over the left and right sides: open, then a wall while the sea is in (it flashes first), and the two sides are out of step. |
| 2 | Kelp Corridors | eat 20 apples | walls | belt | ice x8 | A current runs clockwise round the edge of the reef (the belts): ride it, or fight it. |
| 3 | Whirlpool Basin | hold the ring 30 s | T: stairs, R: stairs, B: stairs, L: stairs | - | sinkhole | Every side of the basin is a stair, so the whole sea turns in a spiral. |
| 4 | Coral Spiral | find 3 keys, then the gate | walls | door | rock x4, gust | Pearl doors pierce the coral: go in one and come out just past the other (they glow alike). |
| 5 | Lair: The First Hunt | wear it out | walls | - | boss shield: lamps | Leviathorn's shell glows with the lamps' light. Light both lamps (each burns for a while) and it knocks the wind out of him. |
| 6 | Jelly Bloom | eat 22 apples | T: tide, R: wall, B: tide, L: wall | - | ghost, flyingfish | The tide comes over the top and bottom (flashing before it shuts). Ghosts of jellyfish drift, and flying fish leap three squares at a time, at the square they've just marked. |
| 7 | Piranha Narrows | reach 8,000 points | walls | - | wasp, shark | Sharks go for your tail, not your head: a long tail is a target, and so is a short one that stops. |
| 8 | Eel Grotto | light 3 lamps at once | walls | -, dark | angler | The grotto is black. Light the three lamps (each stays lit 14 seconds after you touch it) so that all three burn at once. |
| 9 | Shipwreck Hold | corner the thief 4 times | walls | geyser, mine | flea, squid | Sea mines among the wreckage (step on one and run), geysers in the hull, and a squid that lobs bombs where you're heading. |
| 10 | Lair: The Armored Duel | break its armor | walls | - | boss shield: lamps | Light all three lamps at once and the shell dims. Strike while it's dim. |
| 11 | The Undertow | eat 12 apples | walls | belt | flea | The current runs the other way now, anticlockwise, and it's strong. Eat 12 apples. |
| 12 | Sunken Maze | find the pearl relic | (a maze) | -, dark | ghost, angler | A drowned maze in the dark, and an anglerfish between the walls. Find the Pearl of Tides. |
| 13 | Tidal Glyphs | press 6 plates in order | (a maze) | - | ice x10, sinkhole, shark | Press the glyphs in order, 1 to 6. Sharks circle, and the ice drifts. |
| 14 | The Breathing Reef | reach 10,000 points | T: tide, R: tide, B: tide, L: tide | - | sinkhole, wasp, geyser x3 | The reef breathes in rings, and all four sides are tides. Geysers vent in the rock. |
| 15 | Lair: The Last Stand | finish it | walls | - | boss shield: lamps | Four lamps, each gutters sooner. Light them all together and strike. |

### 5. Cinder Crown (volcano)

| # | Level | Goal | Sides | Board | On the board | The idea |
|---|---|---|---|---|---|---|
| 1 | Ashen Steps | reach 6,000 points | T: wall, R: lock, B: wall, L: open | - | fire, lava x3 | The east gate is locked until you've eaten 8 apples; then it's open. Lava seeps through the steps. |
| 2 | Bomb Quarry | eat 22 apples | walls | crumble, mine | bomb | Mines everywhere, bombs overhead, and cracked obsidian that falls away when you step on it. |
| 3 | The Lava Forge | deliver 3 pouches | T: briar, R: wall, B: wall, L: wall | belt, blade | fire, spikes x6 | Carry three ingots from the furnace to the anvil: the forge belts shove you, saws swing on their rails, and a hit drops the ingot. |
| 4 | Obsidian Spiral | grow to 32 | T: toll, R: wall, B: wall, L: wall | crumble, geyser | lightning | Cracked obsidian (step and it falls), vents that scald in a plus, and a toll at the top: 120 points to cross. |
| 5 | Lair: The First Hunt | wear it out | walls | - | boss shield: pools | Pyrrhus is too hot to hurt. Pools of water cool him: make him cross one and he reels. |
| 6 | Imp Warren | eat 24 apples | T: bumper, R: bumper, B: bumper, L: bumper | - | blastimp, cinderknight | Every wall of the warren is a bumper. Imps lob bombs where you're heading, and cinder knights move like a chess knight onto the square they've marked. |
| 7 | Wyrmling Roost | reach 11,000 points | T: link, R: link, B: link, L: link | - | fire, golem, emberhound | The roost wheels clockwise: each side leads to the next. Golem eggs sleep among the boulders: an apple eaten near one wakes it. |
| 8 | The Ember Vaults | find 5 keys, then the gate | walls | door, turret | bomb, wasp | Four vault doors, each a pair: go in one and come out past the other. Turrets guard the passages and bombs lie about. |
| 9 | Smoke Choke | corner the thief 5 times | T: tide, R: wall, B: tide, L: wall | cannon, dark | ghost, lightning, gargoyle | Black smoke fills the lanes. The smoke rolls over the top and bottom of the cavern (open, then shut: it flashes first), and the cannons in the walls turn a quarter after every shot. |
| 10 | Lair: The Armored Duel | break its armor | walls | - | boss shield: pools | Make him cross two pools and the heat on his scales falls away for a moment. |
| 11 | Magma Run | eat 12 apples | T: stairs, R: stairs, B: stairs, L: stairs | belt, geyser | flea | Lava rivers run along the comb (belts), vents scald, and every side is a stair. |
| 12 | Caldera Maze | find the eye relic | (a maze) | -, dark | ghost, fire, golem | The caldera is dark and a golem sleeps in every other corridor. Find the Dragon's Eye. |
| 13 | Rune Lattice | press 7 plates in order | (a maze) | - | spikes x8, fire, reflection, cinderknight | Press the runes in order, 1 to 7. Your reflection hunts you and the cinder knights jump on marked squares. |
| 14 | Heart of the Mountain | hold the ring 40 s | T: wall, R: tide, B: wall, L: tide | - | fire, bomb, cannon x2, blade x2 | The walls beat in a cross, the side doors tide in and out, and the heart's ring drifts. |
| 15 | Lair: The Last Stand | finish it | walls | - | boss shield: pools | Three pools, and a sharp wyrm steps round them unless it's charging. Lure it over them and strike. |


The nightmare tunnels (`content/levels/nightmare/`) were re-baked: each is its base level's new board, a quarter turn
clockwise, and the letters that point somewhere (gates, turrets, belts) turn with the board.

---

## 9. Items

36 new things, all in the system that was already there: each borrows an old item's behavior with `acts`
(`docs/CAMPAIGN.md`, build 52). Merchants stock them (the Armory, Arcana, Kitchen, Familiars and Runes). Data:
`tools/add-items-56.py` (safe to run twice); pictures: `tools/textures/items56-art.py`.

### Weapons

| Weapon | Hits | Traits | Damage by rarity | Uses | Good against | Weak against |
|---|---|---|---|---|---|---|
| Reef Cutlass (`cutlass`) | slashing | cleave | 1/1/2/2 | 1/2/4/5 | Fleas, moles, brambles, anything soft | Crabs and knights shrug off an edge. |
| Gatehouse Halberd (`gatehalberd`) | piercing+slashing | pierce, cleave | 1/2/2/3 | 1/3/5/5 | Wasps, bees, bosses in their armor, the Keep | Two tags, two ways to be resisted: tin knights shrug off both. |
| Tide Trident (`tidetrident`) | piercing+ice | pierce, chill | 1/1/2/3 | 1/3/5/5 | Fire-born foes, bees, fleas, the Reef | Frost sprites and ice floes don't care about its cold. |
| Reaper's Scythe (`scythe`) | slashing+venom | cleave, toxin | 1/2/2/3 | 1/3/5/5 | Swarms, locusts, moles, Gorgemaw | Vipers, urchins and wraiths are as poisonous as it is. |
| Arc Rapier (`arcrapier`) | electricity+piercing | shock, pierce | 1/1/2/3 | 1/3/4/5 | Knights in tin, crabs, scorpions, groups | Spark beetles and the Stormwright laugh at lightning. |
| Magma Cleaver (`cleaver`) | fire+slashing | burn, cleave | 1/2/3/4 | 1/3/5/6 | Brambles, ghosts, mantises, bosses of ice and wood | The Crown's fire-born things don't feel the heat. |

### Armor: four sets of two pieces

| Set | Tier | Both pieces give | But |
|---|---|---|---|
| Tidecaller | 3 | ice.resistance 10, graceSecs 0.5 | fire.weakness 15 |
| Obsidian | 4 | fire.resistance 12, slashing.resistance 8 | ice.weakness 25 |
| Runeweave | 3 | spellPower 12, spellCharges 1 | slashing.weakness 20 |
| Gleaner's | 2 | applePoints 10, loot 10 | piercing.weakness 15 |

| Piece | Set | Stat lines (best four) |
|---|---|---|
| Tidecaller Helm (`shellhelm`) | tide | ice.resistance 10; rime.resistance 8; graceSecs 0.25; speed 3 |
| Tidecaller Coat (`tidecoat`) | tide | ice.resistance 12; electricity.resistance 8; coldWard 10; points 3 |
| Obsidian Helm (`obsidianhelm`) | obsidian | fire.resistance 12; ember.resistance 10; heatWard 10; edge.resistance 8 |
| Obsidian Plate (`obsidianplate`) | obsidian | fire.resistance 14; slashing.resistance 10; heatWard 12; armor 1 |
| Runeweave Hood (`runehood`) | runeweave | spellPower 8; castCooldown -10; electricity.resistance 6; freeCasts 1 |
| Runeweave Robe (`runerobe`) | runeweave | spellCharges 1; spellPower 10; castCooldown -15; spark.resistance 8 |
| Gleaner's Hat (`gleanerhat`) | gleaner | applePoints 6; loot 10; graceSecs 0.25; points 2 |
| Gleaner's Smock (`gleanersack`) | gleaner | applePoints 8; loot 12; money 4; stingGuard 10 |

### Spells

| Spell | Acts as | Charges by rarity | Power | What it does |
|---|---|---|---|---|
| Tidal Surge (`tidalsurge`) | frost | 1/1/2/3 | 3/4/5/7 s | A wave rolls out from you and freezes every hazard and enemy it passes through. |
| Ember Rain (`emberrain`) | fireball | 1/2/3/4 | 2/2/3/4 targets | Fire falls on the nearest enemies and hazards, more of them than a single fireball. |
| Shadow Step (`shadowstep`) | blink | 2/2/3/4 | 4/5/6/8 squares | You slip forward through whatever is in the way, as a shadow. |
| Storm Aegis (`stormaegis`) | forcefield | 1/2/2/3 | 3/4/5/7 s | A crackling dome: it soaks up hazards and enemies, and while it holds you have Electricity Immunity. |
| Harvest Call (`harvestcall`) | magnet | 1/2/3/4 | 5/7/9/13 s | Apples slide toward your head from across the board, and thieves lose interest. |
| Hex Bolt (`hexbolt`) | fireball | 1/2/3/4 | 1/1/1/2 targets | A bolt of green fire seeks the nearest enemy and poisons it. On a boss it cracks a heart of armor. |

### Snacks

| Snack | Acts as | Charges | Power | What it does |
|---|---|---|---|---|
| Harvest Pie (`harvestpie`) | stew | 1/2/2/3 | 1/1/2/2 hearts | Eat it to heal hearts. |
| Smoked Fish (`smokedfish`) | jerky | 1/2/3/4 | 1/1/2/2 charges | Eat it to put charges back in your spell. |
| Bee Balm (`beebalm`) | jelly | 1/1/2/3 | 4/6/7/9 s | Eat it and enemies lose interest in you for a few seconds. |
| Crunch Bar (`crunchbar`) | candy | 1/1/2/3 | 2/2/3/4 smashes | Eat it and your head smashes straight through the next rocks or hazards it hits. |

### Familiars

| Familiar | Acts as | Stat lines | What it does |
|---|---|---|---|
| Rascal the Ferret (`ferret`) | firefly | applePoints 5; loot 8; speed 3; piercing.resistance 8 | Darts at a nearby apple every few seconds and brings it back to you. |
| Mooncrow (`raven`) | firefly | electricity.resistance 8; spark.resistance 6; points 3; graceSecs 0.5 | Perches on your shoulder and lights the dark around your head. |
| Digger the Mole (`digger`) | crab | edge.resistance 8; slashing.resistance 8; graceSecs 0.25; edge.immunity 1 | Pops up and snaps whatever gets close: a gnasher, a hound, a flea. |
| Axel the Axolotl (`axolotl`) | turtle | toxin.resistance 10; ice.resistance 8; coldWard 10; rime.immunity 1 | Takes a hit for you, then needs a while to grow it back. |
| Echo the Bat (`bat`) | puffer | spark.resistance 8; electricity.resistance 8; speed 3; rime.resistance 6 | Screeches at chasing enemies and shoves them away from your head. |
| Biscuit the Pup (`pup`) | firefly | barb.resistance 8; loot 10; applePoints 4; barb.immunity 1 | Sniffs out a nearby apple every few seconds and fetches it. |

### Runes

| Rune | Good (broken / cracked / fine / pristine) | Bad |
|---|---|---|
| Rune of Mending (`mending`) | graceSecs 0.5/0.75/1/1.5 | applePoints -20/-15/-12/-10 |
| Rune of the Anvil (`anvil`) | armor 1/1/1/2 | speed 10/8/6/6 |
| Rune of Thorns (`thorn`) | piercing.resistance 20/30/40/55; barb.resistance 5/10/10/15 | slashing.weakness 40/30/25/20 |
| Rune of the Tide (`tide`) | ice.resistance 15/25/35/45; electricity.resistance 10/15/20/30 | fire.weakness 30/25/20/15 |
| Rune of the Scholar (`scholar`) | spellPower 10/15/20/30 | hearts -0.5/-0.5/-0.5/-0.5 |
| Rune of the Hunt (`hunt`) | bite 1/1/1/2 | damage 30/25/20/15 |

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
