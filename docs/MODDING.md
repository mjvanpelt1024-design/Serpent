# Mods

A mod is a folder that adds to, or changes, the game. The game's own files stay untouched, so turning a
mod off puts everything back.

## Two kinds

| | Content mods | Cosmetic mods |
|---|---|---|
| Folder | `mods\content\<name>` | `mods\cosmetic\<name>` |
| What they change | what's **in** the game: skins, themes, avatars, story pages, upgrades, prices, campaign items and armor sets, pictures, music | how the game **looks and sounds**: the screen filter, the stats overlay, pictures, music |
| When | chosen when a save is made, and kept with it for good | switched on and off for any save, any time |

Content mods are fixed to a save because a save holds things they made (a weapon bought from a mod's
merchant stock, a skin): taking the mod away halfway would leave them with nothing behind them. A mod
folder at the top of `mods\` (from before the two folders) still works: its `mod.txt` can say
`type = cosmetic`, or it counts as content.

## Where mods live

- **With the launcher:** `Documents\SnakeGame\mods`. The first time the launcher runs, it creates that
  folder and copies in the game's `mods` folder. A mod that comes with a newer version of the game is
  copied in once, the first time that version runs (deleting it afterwards keeps it deleted).
- To keep mods next to the game instead, set `folder = game` under `[mods]` in `launcher.ini`.
- In the saves window, **Edit > Choose mods… > Open mods folder** opens the folder in Explorer.

## Choosing mods

**With the launcher**, each save has its own mods, kept in its `.world` file (docs/WORLDS.md):

- **New** opens the new save's Edit view: **Choose mods…** lists every installed mod, content and
  cosmetic, with its name, version, author and what it says about itself. Tick the ones it starts with.
- **Edit** on a save that exists shows the same list. Its content mods are locked (on for good, or
  never); its cosmetic mods can be ticked and unticked. The change takes effect the next time it plays.
- A save whose content mod has been removed from the folder says so in the list, and the game plays it
  without that mod (and says so when it starts). Put the folder back and it's whole again.

**Without the launcher** (`index.html` in a browser, for testing), `mods/_enabled.dat` lists the mods,
one per line as `content/<name>` or `cosmetic/<name>`; `#` in front turns one off. Reload with F5.

Content mods load first, then cosmetic ones; a later mod wins over an earlier one.

## What a mod can contain

```
my-mod/
  mod.txt                  name, version, author, about, type (content or cosmetic)

  content mods:
  skins/    _index.dat + *.skin      add skins, or change one by using its file name
  themes/   _index.dat + *.theme     add themes (patterned ones reuse a painter by name)
  avatars/  _index.dat + *.avatar
  story/    _index.dat + *.story     rewrite pages (new page ids need code to ever play)
  upgrades/ _index.dat + *.upg       change any upgrade, by id: only the lines you write change
  economy.txt                        change any price: only the lines you write change (use the
                                     same [sections] as content/economy.txt, e.g. [great] unit = 8)
  campaign/items.json                new weapons, armor and other merchants' things, new armor sets

  cosmetic mods:
  filter.txt                         the screen filter
  overlay.txt                        the stats overlay

  either kind:
  textures/index.json + PNGs         pictures, for new things or in place of the game's own
  music/    music.dat + audio        replace tracks: rows with the same track name win
```

Every folder works like the game's own: an `_index.dat` lists the files to load.

### Adding versus changing

- A **new name** adds something: `skins/peach-fizz.skin` is a new skin in the Tailor.
- An **existing name** changes it: `skins/classic.skin` with just `name = Original` renames the classic
  skin and keeps everything else.
- Upgrades and the economy only change: `upgrades/snack.upg` with `step = 0.06` makes each tier of Snack
  Time give a bit more, and nothing else moves. Island upgrades have 10 tiers since build 46.

### New weapons and armor (`campaign/items.json`)

The same fields as the game's `content/campaign/items.json`, in two lists:

- `"items"`: each with an `id` of small letters, a `family` (`gear` for the Armory, or `spell`, `food`,
  `pet`, `rune`) and a `name`. A weapon is `"piece": "weapon"` with `"acts": "sword"`, its `hit` (damage
  tags, docs/DAMAGE.md), `damage` and `uses` for each rarity, `traits` and four `stats`. A helmet or body
  piece is `"piece": "helmet"` or `"body"`, with a `set` and four `stats`. Every merchant of that family
  stocks it.
- `"armorSets"`: `id`, `name`, `tier` (1 to 5: sets the price), `bonus` and `bad` stat lines.

An existing id changes only the fields you give. Anything that can't work (no such family or set, a
missing name) is skipped, with a line in the console saying why.

### Pictures (`textures/index.json`)

Like the game's own `textures/index.json`, with paths inside the mod's `textures` folder. Campaign
things are `ci:<id>`: `"ci:rapier": "gear/rapier.png"`. Items are 12×12 PNGs, one pixel for one game
pixel. An id the game already has (`"ci:sword"`) is drawn with the mod's picture instead.

### The screen filter (`filter.txt`)

Every line optional; 0 turns that part off. `glass` is `auto` (the full glass, unless the PC can't keep
50 frames a second with it), `full` or `light`. Then `curve`, `corner`, `vignette`, `reflection`,
`scanlines`, `lineGap`, `mask`, `aberration`, `bloom`, `tint`, `tintAmount`, `saturation`, `contrast`,
`brightness`, `noise`, `flicker` (at most 0.08: it's never a strobe), `roll`, `rollSecs`, `jitter` and
`toggleKey` (F4). `mods/cosmetic/crt-extreme/filter.txt` explains each. Nothing moves when Windows asks
for less motion. The full glass bends the picture a little, so a click right at the edge of the screen
lands a few pixels off: lower `curve` if that matters.

### The stats overlay (`overlay.txt`)

`corner`, `size`, `opacity`, `every` (milliseconds between updates), `graph`, `shown`, `toggleKey` (F3;
Shift+F3 size, Ctrl+F3 corner), `accent`, `warn`, `bad`, and `panels`: which panels, in order. The panels
are `frame`, `game`, `campaign`, `save`, `mods`, `content`, `screen`, `gpu`, `system`, `memory`, `audio`,
`input`, `storage`, `network`, `power`, `page` and `warnings`; `mods/cosmetic/dev-stats/overlay.txt` says
what's in each.

## The mods that come with the game

| Mod | Kind | |
|---|---|---|
| `content/example-pack` | content | a skin (Peach Fizz), a theme (Midnight Garden), a slightly stronger Snack Time. Copy it to start your own |
| `content/wandering-smith` | content | six weapons (Duelist's Rapier, Glacier Halberd, Sunreaper Sickle, Tidecaller Trident, Ossuary Scythe, Kingsbane Greatsword) and four armor sets with a helmet and body each (Duelist's, Tidewarden, Ossuary, Sunforged), with their own pictures. Made by `tools/mods/wandering-smith.py` |
| `cosmetic/crt-extreme` | cosmetic | an overdriven 1980s TV: bent glass, scanlines, a phosphor grille, colors bleeding, glow, static, a rolling bar, wobble. F4 switches it off and on |
| `cosmetic/dev-stats` | cosmetic | the stats overlay with every panel. F3 shows and hides it |

## Mods and saves

Anything bought from a skin or theme mod is kept when the mod is gone: it's set aside in the save, out of
sight, and comes back when the mod does. (If it was being worn, the default skin or theme goes on
meanwhile.) Campaign things from a content mod stay in the satchel too, but can't be worn until the mod
is back.

## What needs code

Mods are data only, by design: a downloaded mod can never run code on a player's PC. The screen filter
and the stats overlay are the game's own code (`src/ui/mod-filter.js`, `src/ui/mod-overlay.js`); a
cosmetic mod only switches them on and sets their numbers. New kinds of things (a new item effect, a new
Flair drawing, a new theme pattern, a new island type, a new overlay panel) need code in the game itself,
and then mods can use them. Names that would reach into the game's own objects (`__proto__`,
`constructor`, `prototype`) are refused as keys and section names, and taken out of a mod's JSON, so a
mod can't switch on cheats that way.
