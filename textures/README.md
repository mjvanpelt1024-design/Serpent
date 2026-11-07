# Textures: the game's pictures

Every small picture in the game is a PNG in this folder: item and upgrade icons, junk, runes, foes,
hazards, power-ups, the goal pieces on the board, hearts, boss faces, map pins, cursors, and more and
more of the painted scenes (`scenes/`). One pixel in the file is one pixel in the game; the game scales
it up when it draws, with no smoothing, so it stays crisp.

## Repainting a picture

1. Open the file in any pixel-art editor that keeps transparency (Aseprite, LibreSprite, Pixelorama,
   GIMP, Paint.NET...).
2. Paint. Keep the size: icons are 12 x 12, boss faces 16 x 16, corner marks 5 x 5, room backgrounds
   240 x 135. Clear pixels stay clear in the game.
3. Save it as a PNG over the old one (RGBA or indexed with transparency, either is fine).
4. Press **F5** in the launcher (or reload the page in a browser). The game reads every picture again
   when it starts, so your change shows straight away.

If you open `index.html` straight from disk instead of using the launcher, run
`python tools/bundle-content.py` after editing: that mode reads pictures from `content.bundle.js`.

A file that's missing or can't be read shows as a pink and black checkerboard, with a warning in the
console (F12) naming it. The game never stops for it.

## What's where

```
textures/
├── index.json            which file each picture is (see below)
├── items/
│   ├── gear/  spells/  snacks/  familiars/  canister/
│   └── runes/<condition>/   one stone per rune in each of its eight conditions:
│                            broken, refurbished, cracked, repaired, fine, polished, pristine, legendary
│                            (and empty-slot.png, the stone's shadow under the hearts)
├── junk/                 the 45 materials found in levels
├── crafted/
│   ├── trinkets/  parts/ what the workbench makes from junk
├── upgrades/             the campaign's upgrade trees, by icon name
├── foes/  hazards/  powerups/
├── board/                the goal pieces: key, door, plates, seal, shard, thief; relics/ for the relics;
│                         crests/ for what each boss wears on its head, entities/ for the old engine's
│                         hazards and power-ups, items/ for apples, XP, rocks and the rest (20 pixels to
│                         a square, below)
├── hearts/               every heart slot the HUD shows (below)
├── bosses/               each island's boss face on its wanted poster
├── coins/                each island's coin, <island>-<tails|heads>-<12|20|32>.png (color-swap, below)
├── emblems/             each theme's little symbol in the Tailor (color-swap, below)
├── familiars/            the familiars, <id>-<size>.png, one for each size they're shown at (below)
├── map/                  each island on the map: <island>/under.png (its rock and ground, under the
│                         paths), over.png (trees, houses, props over them), fog.png (the silhouette
│                         you see before you reach it)
├── ui/                   the menus' frames: plate, chip, window, buttons, tab (color-swap, below), the
│                         wanted poster's parchment, the board's brass corners, the scroll
├── scenes/
│   ├── rooms/            the picture rooms at home: rack/, shelf/, den/, stones/, satchel/, each with
│   │                     background.png and the things that move in it; marks/ for the little marks
│   │                     on things (the away tag, a wax seal, a trinket's dot, the rarity pip)
│   ├── home/             home base: <island>/sky.png and ground.png (320 wide), tree.png, far islands
│   │                     and the falling leaf; the sun, moon, stars, clouds and everything around the tree
│   ├── tree/             the upgrade tree screen's sky and island, one per island (the tree itself
│   │                     is still grown by the game from your six upgrades)
│   ├── npc/              the scene at the top of each shop: <island>/back.png (the room behind the
│   │                     keeper), merchant.png (the awning), merchant-front.png (the counter),
│   │                     challenger.png (the tent), banker.png and banker-front.png (the vault)
│   ├── story/            the story book's pictures, one folder per page (garden/, shop/, storm/, the
│   │                     twelve islands' pages...): sky.png, then 1.png, 2.png... laid over it in that
│   │                     order between the things that move; the little things that move or switch
│   │                     looks (clouds, birds, the lamp, the mirror's eye, the bomb, ghosts, bees...);
│   │                     kit/ for the cast every page shares (apples, orbs, popsicles, the tortoise,
│   │                     the raccoon, the beetle, as sprite sheets); relic/ for the relics under
│   │                     their spotlight; night.png, laid over a nightmare's page; beat/ for the
│   │                     placeholder story page's picture (color-swap: the island's sky, grass, rock,
│   │                     accent)
│   ├── keepers/          the fifteen shopkeepers, <island>-<role>.png, as sprite sheets (below)
│   └── shops/            each island's shop and workshop: <island>/back.png (the walls),
│                         middle.png (the workshop and the shop's shelf), the things that move in that
│                         workshop; counter.png (in front of the keeper, every shop); shared/ for the
│                         order parcels, the glint, the sold-out box, sale tag, rarity ribbon, lantern
└── icons/                everything else: pictures asked for by name (avatars, the old-style
    ├── badges/           upgrades and items), the corner marks over some of them,
    ├── cursors/          the brass pointer and the gloved hand,
    ├── map-pins/         the map's side stops,
    ├── places/           the old hub's places,
    └── stickers/         the title screen's island stickers
```

Hearts are named for what they show: `full-armor4.png` is a whole heart under a whole plate,
`half-armor0.png` half a heart, `empty-armor2.png` an armor plate with a crack where you have no heart
(a plate has four pieces: 4 whole, 3 dented, 2 cracked, 1 only its left half). `canister-full.png`,
`canister-half.png` and `canister-armor1-4.png` are the canister's purple hearts and violet plates.

## index.json

The game never asks for a file by its path. It asks for a picture by its id, and `index.json` says which
file that is:

```json
"ci:sword": "items/gear/sword.png",
"foe:bee": "foes/bee.png",
```

So to move or rename a file, move it and change its one line here. Two ids can share a file.

| An id like | is |
|---|---|
| `ci:sword` | a campaign item, junk material, trinket or part (`ci:` and its id in `content/campaign/`) |
| `ci:plenty:polished` | a rune in one condition (`ci:plenty` alone is the rune as carved: `fine`) |
| `cu:apple` | a campaign upgrade, by its `icon` in `content/campaign/upgrades.json` |
| `foe:wasp` | an enemy, hazard or power-up on the board |
| `board:key`, `relic:crown` | a goal piece on the board |
| `pin:merchant`, `place:global`, `sticker:reef`, `cursor:hand`, `badge:up` | a map pin, old hub place, title sticker, cursor, corner mark |
| `heart:full-armor4`, `boss:keep`, `rune:empty` | a heart slot, a boss face, the empty rune slot |
| `room:rack`, `room:shelf:flame`, `room:mark:seal` | a picture room's background, something that moves in it, a mark on a thing |
| `shop:keep:back`, `shop:reef:hoop`, `shop:parcel` | a shop's walls (or `middle`, `front`), something in its workshop, something every shop shares |
| `coin:keep:tails:12` | an island's coin, a side and a size |
| `ui:plate`, `ui:button-up`, `ui:corner-tl` | a menu frame |
| `map:keep:under`, `map:keep:over`, `map:keep:fog` | an island on the map |
| `map:stone`, `map:keep:lair-2`, `map:keep:stall-banker` | a stop on the map |
| `emblem:sparkle` | a theme's emblem in the Tailor |
| `keeper:keep:merchant` | a shopkeeper's sprite sheet (island, then merchant, challenger or banker) |
| `home:keep:tree`, `home:trophy`, `home:cloud-3` | home base: an island's own picture, or one every home shares |
| `story:garden:sky`, `story:shop:2`, `story:raccoon`, `story:relic:brick` | the story book: a page's sky or layer, a moving bit, the cast, a relic |
| `gem`, `clock`, `anchor` | a picture asked for by name: by the code, or by a content file's `icon =` (old-style upgrades and items) or `picture =` (avatars) |

To give an old-style upgrade, item or avatar a new picture: put the PNG in `icons/`, add a line
`"mypicture": "icons/mypicture.png"`, and set `icon = mypicture` (or `picture = mypicture`) in its
content file. Its corner mark is still its `badge =`.

## Scenes: backgrounds, sprite sheets, lights and color swaps

A scene (one of the picture rooms, and soon the shops, home base and the rest) is a background picture
with the things that move drawn over it. Each of those is a PNG too:

- **The background** (`background.png`) is everything that stands still, the size of the scene. A
  shop has three, stacked: `back.png` (the walls) under the things that move on them (the Spire's stars,
  the Reef's bubbles, the Crown's glow), `middle.png` over those, and `counter.png` in front of the
  shopkeeper. Clear pixels in the upper ones show what's below; half-clear ones (the line between the
  rooms) shade it.
- **A sprite sheet** is something that changes shape, like the candle's flame on the spell shelf
  (`scenes/rooms/shelf/candle-flame.png`) or the Keep's forge (`scenes/shops/keep/forge.png`, three
  flickers): its frames side by side, all the same width, and `"frames": 2` in its entry. Some sheets
  are states rather than moments: an order parcel busy and ready, the lagoon's three hoops. A sheet can
  be a grid instead (`"columns": 3`: frame 0 top left, along the row, then down), and an `"anchor"`
  says which pixel of a frame stands on the spot the game draws it at.
- **Home base** is as wide as the window allows (184 to 320 pixels), so its `sky.png` and `ground.png` are
  320 wide and the game shows their middle. Its tree (`<island>/tree.png`) is a sheet with four columns
  (its leaves stirring) and a row for every upgrade tier you can buy, from bare to full; the game picks the
  row by how many you've bought, so a sheet with fewer rows (say six sizes) works too, spread over the
  tiers. The fruit are part of each row; their glints are `glint.png`. Each cloud is three puffs, one a
  frame, laid over one another; the far islands drift as one picture each.
- **The shopkeepers** are one sheet each (`scenes/keepers/keep-merchant.png` is Sir Hissington): three
  columns as they sway (left, upright, right), four rows (eyes open, blinking, tongue out, blinking with
  the tongue out). The anchor is the bottom of the coil. The same sheet is drawn small by the stall on
  the map, three times the size in the shop's scene and four times behind the counter. Their colors in
  `content/campaign/islands/*.json` (`look`) only painted the first sheets: repaint the PNG. Paint each frame; add frames by making the sheet wider and raising the
  number (the game picks the frame from the time, so more frames than it asks for just wait unused).
- **A light** is a picture the game lays over the scene with an alpha that pulses: the rack's window
  light, the den's sea light, the altar's glow. Paint its shape and color at full strength; clear
  pixels let nothing through, half-clear ones half as much.
- **A particle** is a tiny picture the game moves and fades, like the altar's rising embers.
- **The story book's pages** (`scenes/story/<page>/`) are a sky and numbered layers: `sky.png` first, then
  `1.png`, `2.png`... each laid where it always was among the things the game draws live (the hills
  rolling by, your snake in your skin, flames, glows), so a layer's clear pixels show what's under it and
  its half-clear ones (the shop's shadowed planks, the jars of XP) shade it. The storm's `sky.png` has two
  frames, the second lit by lightning. A relic (`relic/brick.png`) has an anchor: the pixel that sits
  in the middle of the spotlight as it bobs. The tortoise's three frames are its head bobbing down,
  level and up; the raccoon's two rows are eyes open and shut, by the same three bobs; the popsicle's
  magenta is swapped for each flavor. Still drawn live: your snake (in your skin), the rolling hills,
  flames, glows, the falling rain and rising embers, the twinkling stars, and whatever turns or stretches
  (the vault's wheel, the Ouroboros, the curtains, the tunnel's walls, the maw's teeth).

Soft glows and the dark vignette around a scene's edges are smooth gradients, not pixel art: the game
still paints those itself, between the pictures, along with the things that move.

Where each moving thing sits and how fast it moves is still in the code (the room's `fx` in
`src/campaign/camp-invpics.js`, `SS_WALL_FX` and `SS_WORK_FX` in `src/campaign/camp-shop-stage.js`).
Its picture is yours.

**Color-swap pictures** are painted partly in key colors that the game replaces: the rarity pip under
each thing (`scenes/rooms/marks/rarity-pip.png`) and the ribbon under each thing in a shop
(`scenes/shops/shared/rarity-ribbon.png`) are pure magenta `#ff00ff`, and the game paints those pixels
in the thing's rarity color. Its entry says which colors are keys and what they stand for:

```json
"room:mark:pip": { "file": "scenes/rooms/marks/rarity-pip.png", "keys": { "#ff00ff": "pip" } }
```

Paint the key colors exactly (any other color shows as it is).

**Coins** are color-swap pictures too: each island's money is one color (its currency's `color` in
`content/campaign/islands/<island>.json`), and the coin is painted in shades of it. Paint a coin with
these keys and the game fills in that island's shades; the hats and the snake's tongue are real colors:

| Key | Becomes the money color... |
|---|---|
| `#ff00ff` | as it is (the face) |
| `#ff20ff` | 12% lighter (the shine in the middle) |
| `#ff40ff` | 10% lighter (the rim's lit side) |
| `#ff80ff` | 45% lighter (lit edges of the carving, the beads) |
| `#c000c0` | 42% darker (the rim's shadowed side) |
| `#a000a0` | 28% darker (the carving) |
| `#600060` | 50% darker (the carving's shadow, the snake's eye) |

**The menus' frames** (`ui/`) are tiny pictures the styles cut into nine pieces (`border-image`): the
corners stay as they are, the edges and middle stretch. Each theme sets its colors in its theme file,
so the plate, chip, window, buttons and tab are color-swap pictures:

| Key | Becomes |
|---|---|
| `#ff00ff` | the panel's fill (a button's face) |
| `#ff60ff` | the fill's lit bevel (a button's highlight down its left side) |
| `#a000a0` | the fill's shaded bevel (a button's shadow) |
| `#e000e0` | a worn speck in the fill |
| `#ffa0ff` | a button's top edge, catching the light |
| `#500050` | a button's lip underneath |
| `#00ffff`, `#00c0c0`, `#009090`, `#005050` | the trim's metal: shine, light, body, shadow (brass, silver, blood or violet) |
| `#ffff60`, `#808000` | a window's corner gems: lit, dark (the theme's accent) |

The dark outline (`#0b0907`) and everything else show as painted. Keep each picture's size: the styles
slice them at fixed widths (5 pixels for plates, 3 for chips, 8 for windows; 3 for buttons, 5 at a
button's bottom).

**Theme emblems** (`emblems/`) are color-swap too, filled in with the theme's colors from its theme
file: `#ff00ff` its accent, `#ff40ff`, `#c000c0` and `#800080` its three swirl colors (white and the
outline `#120e16` show as painted). A theme names its emblem in its file (`emblem = sparkle`).

**The story book** has two color-swap pictures too. The popsicle (`scenes/story/kit/popsicle.png`) is
`#ff00ff` where its flavor goes. The placeholder story page's picture (`scenes/story/beat/`) takes the
island's colors from its content file: `#00ffff` the sky in the island's light, `#00ff00` and `#80ff80`
its grass and the grass's lit edge, `#ff00ff` and `#800080` its rock and the rock's darker stripes,
`#ffff00` its accent (the pennants).

Money shows tails at 12 pixels (20 in the top bar); click the coin in the top bar and it flips to heads,
with a 32-pixel heads on its card.

## The board, 20 pixels to a square

The board is 20 squares across, and its own pictures are drawn 20 pixels to a square: one pixel in the
file is one unit of the board, so a picture 20 wide is one square wide (a crest sticks out above the
head it sits on). The game scales them up to the screen with hard edges, like everything else.

- **The bosses' crests** (`board/crests/<island>.png`): each one's anchor is the boss's head's top
  left corner. The Keep's knight is a sheet of four frames, its plume at four heights; the Spire's hat
  has its tip dull and twinkling, the Crown's horns dark and glowing.
- **The familiars** (`familiars/<id>-<size>.png`) come in the sizes the game shows them at, since pixel
  art is drawn for its size: 16 beside your snake on the board, 12 at home and in the shop, 20 and 32 in
  the den. Repaint each one you want changed. Their frames: the crab's claw up and down, the firefly's
  wings up and down, the turtle with its shells ready and spent. The firefly's glowing body is drawn by
  the game, under its head and wings.
- **The old engine's hazards and power-ups** (`board/entities/<type>-19.png`, and `-9` for the half-size
  squares) are 19 pixels: a square less the line between squares. Their frames are their looks: the
  wasp's wings up and down, the lightning's warning dim and lit, the bomb's fuse dark and sparking, the
  spikes up, down and flashing red before they rise, the sinkhole cracking and open, the phantom's body
  and its eye (each fades on its own). The star's `#ff00ff` is painted in its cycling colors. Still
  drawn by the game: the glow under every power-up, the numbers and the "!", the blast, the lightning
  strike, the gust's arrows across the board, the frenzy's turning hand.
- **The items** (`board/items/<type>-19.png`: apple, XP, rock, popsicle, flea, fire, molasses; `-39` for
  two-square ones, `-9` for small ones) are their full look, with their hard drop shadow painted in (the
  see-through black under them). The XP's and the fire's glow are drawn by the game around the picture.
  The game still draws the plainer looks itself: with Details or Extras off in the settings, when a
  theme's colors would hide an item (it's drawn in a plain color that shows up), and on the half-size
  squares of Treasure.

Half-covered pixels at a picture's edges (where the old drawing fell between pixels) are baked into
these PNGs, so where they sit over a scene they can come out a shade or two off what the old code
blended; `check --legacy` counts those separately and passes them.

## The map's islands

Each island on the map is three pictures in `map/<island>/`. The game lays `under.png`, then the paths
you've opened, then `over.png`, then the signposts and lantern posts where they fit
(`map/stops/signpost.png`, pointing right and left, its board color-swapped: `#ff00ff`, `#ff60ff` and
`#a000a0` become the island's accent, its lit edge and the writing once the shop opens, weathered grey
before; `map/stops/lantern-post.png`). An island you haven't reached shows `fog.png` instead.
The small islets floating near each one are `islet-<n>.png`, each with an `"anchor"` (the point that
sits on its spot); they bob on their own. Under each island hang spikes that drip water, sparkles, sand or lava: the drips fall from the points
listed in the picture's entry, `"tips": [[x, y], ...]`, so if you repaint the spikes, move the points.
The stops are pictures too: `map/stops/` (the level stone, locked and open; the pennant on a won level,
color-swapped to the island's accent; the gate, locked and open, and its torch flames; the bones, eyes
and glows of a lair; the tent's pennant; the bank's coin turning, five widths, in the island's money
color) and `map/<island>/` (its lairs in three sizes, the last one's spikes, its little home tree with
a row for every tier bought, and its three stalls, open and boarded up, in the island's accent). The
water, birds and smoke are still drawn live.

## How menus light a picture

The board and the painted scenes (shops, the rack, the den...) draw a picture exactly as the file is.
Menus and lists light it from the top left: every color brightens one step along its top and left
edges and darkens along its bottom and right ones, so flat shapes read as little solid things. Two
colors are left alone: the outline color **#1a1410** (it also counts as an edge) and pure white
**#ffffff** (for shine). Paint outlines in #1a1410 and the light falls where it should.

An entry can change that, written as an object instead of a path:

| Field | What it does |
|---|---|
| `"keep": ["#d8dde6"]` | more colors menus leave alone, like white (a few recolored junk pieces use it) |
| `"ink": ["#202020"]` | more colors that count as outline |
| `"light": false` | no light at all: menus show the file as it is (for pictures you shade by hand) |
| `"menu": "junk/obsidian.menu.png"` | menus show this file instead, as it is |
| `"badge": "up"` | a corner mark from `icons/badges/` over it in menus |
| `"frames": 2` | a sprite sheet: that many frames side by side |
| `"keys": { "#ff00ff": "pip" }` | a color-swap picture: those colors are painted in colors the game supplies |

Two pictures have a `.menu.png` beside them, `junk/blackpearl` and `junk/obsidian`: they were made
by recoloring part of another picture to the outline color, so the light couldn't be worked out from
their colors. Repaint both files if you change one, or delete the `menu` field to let the light work
it out from your new picture.

`apple` has `"badge": "up"` because it's both the Apple avatar's picture and the id of a Great Tree
upgrade, and the game has always drawn both with that upgrade's corner mark.

## Tools

```
node tools/textures/textures.mjs check
```
boots the game in a headless Chrome or Edge and makes sure every file in `index.json` loads. Add
`--legacy` to also compare every picture with the game from before textures/ (from git), pixel by pixel,
the rooms at sixty moments each, every shop with and without stock and orders, and every keeper in
every one of its looks, and home base piece by piece; that only passes for pictures that haven't been repainted.
`export <set>` (`icons`, `rooms`, `shops`, `keepers`, `home`, `coins`, `frames`, `map`, `emblems`, `stops`, `tree`, `npc`, `story`) writes a set from that old game into this folder and its index: it's
how the folder was made, and with `--force` it overwrites files, repaints and all.
