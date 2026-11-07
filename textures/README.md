# Textures: the game's pictures

Every small picture in the game is a PNG in this folder: item and upgrade icons, junk, runes, foes,
hazards, power-ups, the goal pieces on the board, hearts, boss faces, map pins, cursors. One pixel in
the file is one pixel in the game; the game scales it up when it draws, with no smoothing, so it stays
crisp.

## Repainting a picture

1. Open the file in any pixel-art editor that keeps transparency (Aseprite, LibreSprite, Pixelorama,
   GIMP, Paint.NET...).
2. Paint. Keep the size: icons are 12 x 12, boss faces 16 x 16, corner marks 5 x 5. Clear pixels stay
   clear in the game.
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
| `gem`, `clock`, `anchor` | a picture asked for by name: by the code, or by a content file's `icon =` (old-style upgrades and items) or `picture =` (avatars) |

To give an old-style upgrade, item or avatar a new picture: put the PNG in `icons/`, add a line
`"mypicture": "icons/mypicture.png"`, and set `icon = mypicture` (or `picture = mypicture`) in its
content file. Its corner mark is still its `badge =`.

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
`--legacy` to also compare every picture with the game from before textures/ (from git), pixel by pixel;
that only passes for pictures that haven't been repainted. `export --force` rewrites this whole folder
from that old game, throwing away every repaint: it's how the folder was made, not something to run
again lightly.
