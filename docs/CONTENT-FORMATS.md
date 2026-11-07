# Content formats

Everything in `content/` is plain text. Nothing in it ever runs as code: the game reads it with
`src/engine/content/formats.js` and turns it into numbers, words and lists. Open any of it in Notepad,
VS Code or Visual Studio.

After editing, reload the game (**F5** in the launcher). If a file has a problem, the game names the
file and line. `python tools/check-content.py` checks everything without starting the game.

---

## The three shapes of file

### 1. Value files: `.txt` `.upg` `.skin` `.theme` `.flair` `.avatar` `.item` and `world.txt`

```ini
# A line starting with # is a note for people. The game skips it.
name     = Snack Time                 # text needs no quotes
speed    = 7.5                        # numbers
hazard   = false                      # true or false
palette  = [#3ddc3d, #f5e642]         # a list, in square brackets
seq      = "12"                       # quotes keep text as text (so "12" isn't the number 12)
effect   = none                       # none means "nothing"

[rules]                               # a section: the lines below belong to "rules"
speed    = 5

[prestige.caps]                       # sections can nest with a dot
hearts   = 10
```

- One setting per line: `key = value`.
- A note after a value needs a space, `#` and a space: `speed = 5   # squares a second`.
  Colors like `#ff0000` are safe because there's no space after the `#`.
- Keys are case-sensitive. The same key twice: the last one wins (and the checker mentions it).
- Once a `[section]` starts, every key below it belongs to it, so sections go at the end of a file.

### 2. Table files: `.dat`

```text
# level | name             | Nightmare name
1       | Morning Dew      | Peckish
2       | Afternoon Stroll | Famished
```

One row per line, cells split by `|`. Spaces around cells are ignored, so line them up however you like.

Every folder of records has an **`_index.dat`**: one file name per line (no extension), in the order the
game shows them. **A file that isn't listed isn't loaded.** Reorder lines to reorder the game.

### 3. Text files: `.story` and `.level`

Value lines at the top, a line of three dashes, then the body:

```text
title = The Garden
---
The first paragraph.

The second paragraph, after a blank line.
```

---

## content/economy.txt

Every price in the game, in sections. Everything is counted in **good runs**: what one good run pays
on an island. `docs/DESIGN-46.md` explains how the numbers fit together.

| Section | Keys | Meaning |
|---|---|---|
| `[ladder]` | `runXp` | XP from a good run on the first island, before upgrades |
| | `worldGrowth` | each island's score multiplier is this many times the last |
| | `nightmareStart`, `nightmareGrowth` | the first Nightmare pays this many times the last island; each Nightmare this many times the one before |
| `[trees]` | `treeRunsFirst`, `treeRuns` | good runs to grow a whole tree, on the first island and on the last (evenly in between) |
| | `tierGrowth` | each tier of a part costs this many times the last |
| | `treeNodeCost` | weights for the trunk, left, right and crown |
| | `treeGate` | tiers a part needs before the parts above it can grow |
| `[unlock]` | `unlockRunsFirst`, `unlockRuns`, `unlockTreeShare` | an island costs this many good runs on the island before it (rising from first to last), and that island's tree must be this much grown |
| `[nightmares]` | `nmUnlockRuns`, `nmUnlockTreeShare`, `nmUpgradeRuns` | the same for the Nightmare Realm; the last is good Nightmare runs to grow a red upgrade |
| `[bucks]` | `buckPerRun`, `minXpPerBuck` | a good run on your best island trades for this many Snakebucks; the Exchange's lowest rate |
| `[great]` | `unit`, `tierRise`, and a weight per group | Great Tree tier *t* costs unit × weight × (1 + tierRise × (t − 1)) Snakebucks |
| `[badges]` | `badgeBucks`, `badgeRuns`, `badgePathBonus` | Snakebucks and good runs of XP per badge tier; extra for finishing a path |
| `[contracts]` | `contractRuns`, `contractBucks` | what a Bounty Contract pays |
| `[items]` | `itemStep`, `itemStepCap`, one line per item | each item's first price in good runs, and how it climbs |
| `[rename]` | `runs` | renaming your snake |
| `[cosmetics]` | `skinStep`, `backdropStep`, `skinTier`, `backdropTier`, `flairStep`, `avatarStep` | Tailor prices, in Snakebucks |
| `[prestige]` | `rankFee`, `strength` | Snakebucks per rank, and how much stronger each rank makes the core parts |

## content/rules/

- **`levels.dat`**: how the three levels of every island differ. Columns: level, speed multiplier, score
  multiplier, hazard multiplier, an unused column (it used to open Nightmares), and the line shown on the
  map. Keep three rows.
- **`rules.txt`**: the `[prestige]` rules: `maxRank`, `rankNames`, `rankedTracks` (Great Tree upgrades
  that come back 50% stronger per rank), `[prestige.caps]` and `[prestige.rounding]`.

---

## Worlds: content/worlds/

`world-order.dat` lists the islands in unlock order. Each name is a folder in `builtin/`. The folder names are the islands' ids, which saves use, so keep them; the name players see is in `world.txt`.

| # | Folder | Island |
|---|---|---|
| 1 | `easy` | Garden |
| 2 | `classic` | Old Yard |
| 3 | `sunflower` | Sunflower Fields |
| 4 | `challenge` | Quarry |
| 5 | `bramble` | Bramblewood |
| 6 | `insane` | Ice Parlor |
| 7 | `hive` | The Hive |
| 8 | `chaos` | Orchard |
| 9 | `thunder` | Thunder Peaks |
| 10 | `mirror` | Glass Hall |
| 11 | `frost` | Frostbite Fjord |
| 12 | `treasure` | Vault |
| 13 | `hunt` | Hunting Grounds |
| 14 | `endless` | Tunnel |
| 15 | `keg` | Powder Keg |
| 16 | `inferno` | Furnace |
| 17 | `moor` | Haunted Moor |
| 18 | `labyrinth` | Maze |
| 19 | `clockwork` | Clockwork Citadel |
| 20 | `chrono` | Chrono Rift |
| 21 | `gale` | Gale Cliffs |
| 22 | `maw` | The Maw |

Each folder holds:

```text
builtin/garden-name/
  world.txt        the island itself
  levels.dat       level names
  upgrades/        the island's tree: _index.dat + one .upg per upgrade
```

### world.txt

| Key | Meaning |
|---|---|
| `name` | the name on the map |
| `label` | a short name for the island (Easy, Classic, Sunny...) |
| `music` | a track name from `content/music/music.dat` |
| `medal` | the island's color in menus, medals and badges |
| `item` | the one-time item that grows on this island's tree (for reference; the item file decides) |
| `[rules]` `speed` | squares per second |
| `edge` | `wrap`, `wall`, `mirror`, `endless` or `maze` (the game code knows these five) |
| `hazard` | rocks on the board (`true`/`false`) |
| `maxPopsicle`, `popsicleEffect`, `popsicleDelay` | popsicles at once; `none`, `penalty` or `death`; `[min, max]` ms between them |
| `apples`, `cell`, `bigSpawns`, `innerWalls` | apples at once; square size (10 = half size); big spawns; walls in the middle |
| `startOrbs`, `orbChance` | XP orbs at the start; chance of another every 5 seconds |
| `hunter`, `echoes`, `rot` | the Hunter (`true`); Echoes (`true`); ms before an apple rots |
| `description` | the rules text on the island card |
| `[spawns.<type>]` | what turns up on the board (below) |
| `[nightmare]` `name`, `twist` | the Nightmare's name and description |
| `[nightmare]` flags, `rot` | twists for the islands from build 46: `hunter`, `echoes`, `overgrowth`, `supercell`, `shortfuse`, `poltergeist`, `overclock`, `fastsink` (`true`), and an apple rot time |
| `[nightmare.spawns.<type>]` | changes to `[spawns.<type>]` in the Nightmare |
| `[map]` `x`, `y`, `width`, `colors` | where the island floats (map pixels, 600 across and 340 down; the islands sit along a road that winds right, up, left, up), and, and its grass, edge and rock colors |
| `[tree]` `leaves` | three leaf colors and the fruit color of its tree |

An island's **score multiplier** isn't in `world.txt`: the economy's ladder sets it from the island's place
in `world-order.dat`, so income always climbs evenly (`[ladder] worldGrowth` in `economy.txt`).

### What turns up: `[spawns.<type>]`

```ini
[spawns.rock]          # placed at the start of a run
count = 4
s     = 40             # percent chance each is small (half a square)
l     = 10             # percent chance each is large (2 x 2)
[spawns.wasp]          # timed: one turns up every 3.5 to 7 seconds, at most 2 at once
max   = 2
delay = [3500, 7000]
[spawns.popsicle]      # the Tunnel only: a chance per column as it scrolls
rate  = 0.12
```

Types: `xp`, `apple`, `rock`, `popsicle`, `flea`, `fire`, `molasses`; the hazards `bramble`, `wasp`,
`lightning`, `ice`, `bomb`, `ghost`, `spikes`, `gust`, `sinkhole`; and the power-ups `golden`, `shears`,
`armor`, `shield`, `hourglass`, `star`, `phantom`, `lodestone`, `frenzy`. Brambles, ice and spikes are
placed with `count`; the rest are timed with `max` and `delay`. What each one does is game code:
`src/game/flow/entities.js`.

### Game levels: `content/levels/*.level`

A level whose board comes from a file. Nothing is generated: the Labyrinth's three mazes and every
campaign board (build 53: all 75, in `content/levels/campaign/`) are files. `content/levels/index.dat`
maps each level's name to its file:

```text
Hedgerow | labyrinth-1.level
reef-3   | campaign/reef-3.level
```

The name is the level's name in its world (`levels.dat`), or `island-level` for the campaign
(`reef-3` is Tidecoil Reef's third level). A file listed here replaces the level with that name.

**Putting a sandbox level into the game:** save it in Play > Sandbox, take `<name>.level` from your
downloads, and copy it over the board you want to replace, for example `content/levels/campaign/reef-3.level`
(keep the file name, or change the line in `index.dat`). Run `tools/check-content.py`. The campaign reads a
20 x 20 board's walls (`#`), portal walls (`P`, red walls outside a maze) and start (`S`); the sandbox's food
and hazard squares, panels and spawner chips are kept in the file but the campaign doesn't use them yet: its
goal, speed and spawns still come from the island's file in `content/campaign/islands/`. A board keeps
three open squares in front of the start, so the snake never starts against a wall.

Board sizes: 20 for the campaign's boards (and every sandbox level; `size` may be left out), 48 for a
field (`edge = wrap`), 80 for a maze (`edge = maze`, with `span` and `[portals]`). A pulse level's walls
are `1` (up first), `2` (up second) and `3` (always up). `tools/bake-campaign-levels.js` wrote the
campaign files once from the old builders; it keeps files that already exist (`--force` rewrites them).

```text
# Comments start with #
name    = Hedgerow
world   = labyrinth           # the island it belongs to
level   = 1
size    = 80                  # squares across; the board has this many rows of this many squares
edge    = maze
span    = 4                   # squares per maze cell

[portals]                     # dead-end portals: "wall squares > exit squares"
p01 = "3,20-22 > 4,20-22"     # a square x,y, or a line x,y1-y2 (a column) or x1-x2,y (a row)
---
....#####........
```

Below the `---`, one row per line: `.` open · `#` red wall · `P` portal wall · `S` snake start (exactly one) · `1 2 3` pulse walls.
A portal wall lets you through to its exit; a red wall in a dead end can be turned into one.

**Not in a `.level` file yet:** the island's spawns, speed, theme, skin and loadout. Those still come from
`world.txt`, `levels.dat` and the player's own settings.

### Upgrades: `.upg`

Island upgrades live in `worlds/builtin/<island>/upgrades/`, Great Tree upgrades in `great-tree/upgrades/`.

| Key | Meaning |
|---|---|
| `name`, `description` | shown on the tree card |
| `slot` | islands only: `trunk`, `left`, `right`, `crown` or `nightmare` (the red one) |
| `part` | Great Tree only: `trunk`, `bough`, `branch` or `dream` |
| `growsFrom` | Great Tree only: the upgrade it hangs from |
| `requires` | Great Tree only: `all` (the every-island branch) or `nightmare` (the dream roots) |
| `position` | Great Tree only: `[x, y]` on the tree picture (240 × 184) |
| `color` | its color on the tree |
| `icon`, `badge` | its picture: a name in `textures/index.json` (a PNG in `textures/icons/`), and a corner mark (`up`, `plus`, `x`, `star`) shown over it |
| `base` | the value before any tier is bought |
| `start`, `step`, `tiers` | tier 1's value, what each tier adds, how many tiers... |
| `values` | ...or every tier's value, listed: `[45, 44, 42, ...]` |
| `ratio` | ...or steady proportions: tier *t* is `base` × ratio^t |
| `effect` | islands only: `applePoints` or `passivePoints` (multiply on that island) or `orbChance` (adds a percent), so the upgrade needs no code |
| `group` | Great Tree only: `special` prices it with the `[great] special` weight |
| `format` | how a value is shown (below) |
| `prestige` | `mul` or `div`: how prestige ranks scale the trunk and boughs |
| `prices` | optional: fixed prices, one per tier, instead of the economy's |

**format**: `{v}` is the value. `{v|one|many}` picks a word by whether the value is 1.
Three named styles: `x` (multipliers like 1.20x), `per-xp` (points per XP) and `hearts`.

```ini
format = +{v}% orbs                   # +5% orbs
format = +{v} {v|square|squares}      # +1 square, +2 squares
format = x                            # 1.20x
```

What an upgrade *does* is game code, tied to its id (`getTrackValue("snack")` in the run code), unless it
has an `effect`. Changing numbers, text, color, icon or price needs no code. Island trees have 10 tiers per
part since build 46. A brand-new Great Tree upgrade appears at its
`position` and can be bought; a new island upgrade needs a free slot (four per tree, plus the red one).
Either way it only *does* something once code reads its id.

### Community levels: `.level`

```text
name          = The Donut
edge          = walls        # wrap, walls or mirror
speed         = 7            # 5 slow, 7 normal, 10 fast
hearts        = 3
respawnApples = true
twists        = []           # starve, dark, avalanche, noMercy, sugar, flip
spawns        = []           # popsicle, flea, fire, molasses
panelsV       = [7/4:r, 13/6:p]   # wall panels on vertical grid lines: x/y, r = red, p = portal
panelsH       = []
---
20 rows of 20 characters
```

Board characters: `.` empty · `#` red block · `P` portal block · `S` snake start ·
`A` `a` `@` apple (normal, small, large) · `X` `x` `*` XP · `R` `r` `%` rock · `O` `o` `&` popsicle ·
`F` `f` `!` flea · `H` `h` `^` fire · `M` `m` `~` molasses.

---

### Sandbox levels: `.level` (saved from the editor)

Made in the sandbox editor (Play > Sandbox > New level), saved as `<name>.level` and read back by **Paste Code**.
A plain text file, the same shape as the game levels above, with the sandbox's extra keys. Code: `src/game/sandbox/level-file.js`.

```text
# Sandbox level. Format: docs/CONTENT-FORMATS.md (Sandbox levels)
name     = Test Donut
edge     = walls                 # wrap, walls or mirror
speed    = 10                    # 5 slow, 7 normal, 10 fast
hearts   = 2
apples   = once                  # respawn or once
skin     = tangerine             # a skin id, or empty for the player's own
theme    = white                 # a theme (backdrop) id, or empty for the player's own
vanish   = 2                     # seconds a red wall is gone, then back. 0 = off
items    = booster               # boost items the run starts with (free)
twists   = dark                  # nightmare twists
off      = rock                  # hazards switched off in this level
boss     = crown                 # build 52: an island (its boss) or a champion's id, or empty for none
fight    = 2                     # which of the boss's fights: 1 stamina, 2 armor, 3 hearts

[panels]                         # v3,4 = the line left of square 3,4; h3,4 = the line above it
v3,4 = red                       # red or purple

[spawners]                       # chips on the edge: more chips of one enemy, more of them turn up
popsicle = 0,3; 0,9
flea     = 19,5

---
....#.....................       # 20 rows of 20: . open  # red wall  P portal wall  S snake start
```

Spawners can also be the campaign's enemies (build 52): `knightling`, `scorpion`, `sparkbeetle`, `inkwraith`,
`mantis`, `viper`, `frostsprite`, `urchin`, `firebat` (the editor's **Foes** tab).

Board characters are the sandbox's (the same as a share code): capitals and small letters for food and
hazards, `@ * % & ! ^ ~` for the large ones. A file must have 20 rows of 20 squares. Share codes (`SNK3-...`)
hold the same level and paste the same way.

## Items: content/items/*.item

`name`, `description`, `island` (the tree it grows on), `boost` (`true` = used up when a run starts),
`fruit` (`apple`, `pear`, `orange`, `plum`, `lemon`, `berry`), `color`, `icon`, `badge`, `recolor`.
Prices: `[items]` in `economy.txt`. What it does: `src/game/flow/item-effects.js`.

## Skins: content/skins/*.skin

| Key | Meaning |
|---|---|
| `name`, `group` | its name, and its tier (a row of `skins/tiers.dat`) |
| `palette` + `seq` | colors, and the pattern down the body: `"1122"` = two of color 1, two of color 2, repeat |
| `gradient` + `steps` | colors blended smoothly along the body, in this many shades |
| `fade` | `true` = blend once from head to tail instead of looping |
| `head` | a different color for the head |
| `animated` | the pattern scrolls; milliseconds per step |

## Themes: content/themes/*.theme

| Key | Meaning |
|---|---|
| `name`, `title` | the board's name, and the name shown if different |
| `group` | its tier (a row of `themes/tiers.dat`) |
| `kind` | `solid` or `pattern` |
| `base`, `accent`, `lines` | the board colors a pattern uses |
| `painter` | a pattern from `src/art/theme-painters.js` (any theme can reuse any painter) |
| `swirl` | the page's three paint colors: bright, middle, deep |
| `highlight` | the accent color across the menus |
| `particles` | `dust`, `hearts`, `sparkle`, `stars`, `leaves`, `embers`, `rain`, `bubbles`, `petals`, `steam`, `confetti`, `snow`, `fireflies`, `bits` |
| `emblem` | its symbol in the Tailor (the list is in `src/ui/tailor.js`) |

## Flair: content/flair/*.flair

`name`, `slot` (a row of `flair/slots.dat`), `set`, `priceRank` (price = `flairStep` × this),
`free` (given in the tutorial), `reward` (earned, never sold). How each piece is drawn is code:
`src/art/flair-drawing.js`, by id.

## Avatars: content/avatars/*.avatar

`name`, `picture` (a name in `textures/index.json`: a PNG in `textures/icons/`), `background`, `free`.
Price comes from `avatarStep` and the avatar's place in `_index.dat`.

## Story: content/story/*.story

`title`, then `---`, then paragraphs separated by blank lines. `{name}` becomes the snake's name.
`_index.dat` is the order of the story book. Page ids tie pages to the game: `easy` plays when the
Garden opens, `nm-easy` when its Nightmare does, `intro` at the start, and so on.

## Music: content/music/music.dat

```text
# track  | file       | loop from | loop to | volume
menu     | menu.ogg   | 0         | end     | 100
```

Drop a file with that name into `content/music/` and it plays instead of the built-in synth version.
The song plays from the start, then loops between `loop from` and `loop to` (seconds; `end` = the end).
OGG loops without a gap; WAV and MP3 also work. Until a file exists, the developer console shows a
"404" line for it when that track first plays: that's expected.
