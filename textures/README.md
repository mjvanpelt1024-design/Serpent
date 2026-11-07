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
├── board/                the goal pieces: key, door, plates, seal, shard, thief; relics/ for the relics
├── hearts/               every heart slot the HUD shows (below)
├── bosses/               each island's boss face on its wanted poster
├── scenes/
│   ├── rooms/            the picture rooms at home: rack/, shelf/, den/, stones/, satchel/, each with
│   │                     background.png and the things that move in it; marks/ for the little marks
│   │                     on things (the away tag, a wax seal, a trinket's dot, the rarity pip)
│   ├── home/             home base: <island>/sky.png and ground.png (320 wide), tree.png, far islands
│   │                     and the falling leaf; the sun, moon, stars, clouds and everything around the tree
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
| `keeper:keep:merchant` | a shopkeeper's sprite sheet (island, then merchant, challenger or banker) |
| `home:keep:tree`, `home:trophy`, `home:cloud-3` | home base: an island's own picture, or one every home shares |
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

Paint the key colors exactly (any other color shows as it is). The coins and the menus' pixel frames
will work this way too, with each island's or theme's colors filled in.

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
`export <set>` (`icons`, `rooms`, `shops`, `keepers`, `home`) writes a set from that old game into this folder and its index: it's
how the folder was made, and with `--force` it overwrites files, repaints and all.
