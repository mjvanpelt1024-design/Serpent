# How the code is organized

The game is plain JavaScript in `src/`, plus a few hundred content files. This guide is the
map: what loads when, where things live, and how the code reads content.

## Three layers

```
 content/   what the game is made of: numbers, names, text, colors, music      (no code)
    │
    ▼  read by src/engine/content/
 src/campaign/  the game since build 47: its one save, levels, bosses, items, shops, home base, HUD
 src/game/  the rules underneath: the engine's runs, hazards, saves, old islands, story, sandbox
 src/ui/    the screens: the map (and its islands), trees, Tailor, settings
 src/art/   pixel art drawn in code: theme patterns, Flair, story book scenes
 src/dev/   the cheat engine and the hidden terminal
    │
    ▼  built on
 src/engine/  boot, content loading, storage, random numbers, sound, music, drawing, input
```

**Engine** code doesn't know what a snake is: it loads files, keeps saves, makes sounds and pictures, and
reads the keyboard. **Game** code is the rules. **Content** is everything you'd tune by hand.

This is a first pass at the split. A few engine files still lean on game names (the renderer draws snakes
and apples; the theme code reads the save to know which theme is on). Separating those further is a good
next step whenever one of them needs real work anyway.

## How the game starts

1. The launcher opens `index.html` at `https://game.snakegame.example/` (the game folder, served locally).
2. `index.html` loads the stylesheets, then three scripts:
   - `src/engine/content/formats.js`: the readers for each kind of content file
   - `src/engine/content/loader.js`: reads every file in `content/`, then any enabled mods
   - `src/engine/boot.js`: runs the loader, puts the result in `CONTENT`, then loads every script listed
     in `src/load-order.dat`, one after another
3. The last script, `src/game/start.js`, sets every price from `content/economy.txt` (`applyEconomy()`)
   and opens the title screen.

If a content file is missing, or a script fails while loading, `boot.js` shows a panel naming the file
and line instead of a blank window. Content warnings that don't stop the game (a mistyped line, a key set
twice) go to the developer console (**F12**).

## One shared scope

The scripts are classic scripts, not modules: everything one file defines at the top level is visible to
every file loaded after it. That's why **order matters** in `src/load-order.dat`:

- A file can *use* anything defined above it while it loads.
- Inside functions, anything from any file works, because functions run after everything has loaded.

Adding a script: create the file, then add its path to `src/load-order.dat` after the files it needs.

## From content to code

Each content folder has one place in the code that reads it. The rest of the code keeps using the same
names it always did, so the content can change without touching the rules.

| Content | Read in | Becomes |
|---|---|---|
| `version.txt` | `src/engine/core/storage.js` | `BUILD_NUMBER` |
| `economy.txt` | `src/game/economy/upgrades.js`, `src/game/economy/ladder.js` | `ECON`, every price (`goodRun`, `islandTreePrices`, `xpPerBuck`...) |
| `rules/levels.dat` | `src/game/world/levels.js` | `LEVEL_TUNE`, `NM_GOAL_APPLES`, `LEVEL_LINES` |
| `rules/rules.txt` | `src/game/economy/upgrades.js` | prestige rules |
| `world.txt` `[spawns]`, `[nightmare.spawns]` | `src/game/flow/game-flow.js`, `src/game/flow/nightmares.js` | `MODE_ITEMS`, the run's `spec` |
| `worlds/world-order.dat` + `world.txt` | `src/game/world/islands.js` | `MODE_KEYS`, `modes`, `NIGHTMARES` |
| `world.txt` `[map]` | `src/ui/map.js` | `ISLANDS`, `MAP_BIOME` |
| `world.txt` `[tree]`, upgrade `slot`s | `src/ui/trees.js` | `TREES`, `TREE_LEAVES` |
| `world.txt` `music` | `src/engine/audio/music.js` | `MODE_MUSIC` |
| `worlds/*/levels.dat` | `src/game/world/levels.js` | `LEVEL_NAMES`, `NM_LEVEL_NAMES` |
| `worlds/*/seed.txt` | `src/engine/core/random.js` | `worldRandom(island)` |
| labyrinth `[generator]` | `src/game/world/labyrinth.js` | `MAZE` |
| `*.upg` (islands and Great Tree) | `src/game/economy/upgrades.js` | `upgradeTracks` |
| Great Tree `growsFrom`, `part`, `position` | `src/ui/trees.js` | `GLOBAL_GATES`, `GLOBAL_MAIN`, `GLOBAL_DREAMS`, `GLOBAL_TREE` |
| `items/*.item` | `src/game/items/items.js`, `src/engine/render/pixel-icons.js`, `src/ui/trees.js` | `CONSUMABLES`, `ITEM_FRUIT`, `ITEM_COLOR`, `ITEM_ISLAND` |
| `world.txt` `medal` | `src/game/items/items.js` | `MEDAL_COLORS` |
| `skins/` | `src/game/cosmetics/skins.js` | `skins` |
| `themes/` | `src/game/cosmetics/themes.js`, `src/engine/render/themes.js`, `src/ui/tailor.js` | `backdrops`, `THEME_STYLE`, `THEME_EMBLEM` |
| `skins/tiers.dat`, `themes/tiers.dat` | `src/game/cosmetics/themes.js` | `COSMETIC_TIERS` |
| `flair/` | `src/game/items/items.js` | `FLAIR`, `FLAIR_SLOTS` |
| `avatars/` | `src/game/world/islands.js` | `AVATARS` |
| `story/` | `src/game/story/story.js` | `STORY`, `STORY_ORDER` |
| `music/music.dat` | `src/engine/audio/music.js` | `MUSIC_FILES` |
| `worlds/community/*.level` | `src/game/sandbox/sandbox.js` | `starterLevels()` |

## The campaign on the old engine

Since build 47 the game is the campaign (`docs/CAMPAIGN.md`). It doesn't replace the engine: a campaign
level is played as the mode `"campaign"` with rules built from the level's entry in
`content/campaign/islands/*.json`, and `src/campaign/camp-run.js` wraps a handful of engine functions
(`endGame`, `takeHit`, `stepSnake`, `tickMechanics`, `drawHunter`...) to add goals, the boss, items and
rewards. Every wrapper does nothing when no campaign level is running. Its screens reuse the old ones by
wrapping their render functions (`renderTree`, `renderInventory`, `renderTailor`, `renderAchievements`,
the game-over card) rather than adding a new look. `content/campaign/` is read as JSON, kept as text,
and checked against a signed manifest at startup; the save goes through `SAVE_SCHEMA` in
`src/campaign/integrity.js`.

## Where to find things

| Looking for | File |
|---|---|
| A run starting, ticking and ending | `src/game/flow/game-flow.js` |
| What apples, popsicles, fleas, fire and items do | `src/game/flow/item-effects.js` |
| The hazards and power-ups from build 46 (brambles to sinkholes, Golden Apples to Frenzy Clocks) | `src/game/flow/entities.js` |
| Armor, Fever, the power-up buffs, Shed Skin, Bounty Contracts, the meters on the board | `src/game/flow/mechanics.js` |
| The Hunter (the rival snake) | `src/game/flow/hunter.js` |
| Echoes (the Chrono Rift) | `src/game/flow/echoes.js` |
| Every price: the ladder of good runs | `src/game/economy/ladder.js` |
| Unlocking islands and the Nightmare Realm | `src/game/world/unlocks.js` |
| Story book pictures for the build 46 islands | `src/art/island-art-46.js` |
| The map: islands, camera, pins, landmarks | `src/ui/map.js` |
| The Coil (the glowing road joining the islands) and the parallax sky | `src/ui/map-coil.js` |
| Moving the snake | `src/game/flow/snake.js` |
| Nightmare twists, Inferno walls, portals | `src/game/flow/nightmares.js` |
| The maze | `src/game/world/labyrinth.js` |
| XP, Snakebucks, the Exchange's maths | `src/game/economy/experience.js` |
| Prices (the economy pass) | `applyEconomy()` in `src/game/start.js`, from `src/game/economy/ladder.js` |
| Save format, defaults, migration | `src/game/save/save-data.js`, `src/game/save/profiles-storage.js` |
| Badges | `src/game/progress/badges.js` |
| Drawing the board | `src/engine/render/renderer.js` |
| Sound effects, the synth | `src/engine/audio/synth.js` |
| Music player | `src/engine/audio/music.js` (files) and `songs.js` (synth versions) |
| Screens and the back button | `src/ui/navigation.js` |
| Every button's wiring | `src/game/wiring.js` |
| Keyboard | `src/engine/input/keyboard.js` |
| Pixel icons (sprites) | `src/engine/render/pixel-icons.js` |
| The menus' pixel frames (panels, windows, buttons, tabs, the parchment), drawn from the theme's colors | `src/art/ui-frames.js`, used by `styles/16-retro-fantasy.css` |
| The fonts and the Font setting | `styles/00-fonts.css`, `FONT_OPTIONS` in `src/ui/settings.js` (canvases use `GAME_FONT`) |
| Terminal commands | `src/dev/terminal/cmd-*.js` |

## Styles

`styles/` holds the CSS, split by area and numbered in the order `index.html` loads them. Later files win
when two rules clash, so keep the numbers in order when adding one. `16-retro-fantasy.css` comes last on purpose: it dresses
every panel, button and window in pixel frames (border images from `src/art/ui-frames.js`), so the files
before it lay things out and it gives them their look.

## Testing outside the launcher

Any local web server works: from the game folder, `python tools/serve.py`, then open
`http://localhost:8000`. (`tools/serve.py` turns caching off, so every reload picks up edited scripts;
`python -m http.server` works too, but the browser may keep old copies of scripts.) Opening `index.html` straight from disk needs `content.bundle.js`
(run `python tools/bundle-content.py`), and can't play music files.
