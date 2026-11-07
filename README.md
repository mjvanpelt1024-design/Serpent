# Snake

A snake game with five floating islands up the Coil, fifteen levels and three boss fights on each,
shopkeepers, upgrade trees, and a narrator with opinions.

**Build:** see [`version.txt`](version.txt) · **Runs on:** Windows 10 and 11, through its own launcher (`SnakeGame.exe`)

---

## Quick start

1. **Extract** the zip somewhere you own, such as `C:\Projects\SnakeGame` or `Documents\Projects\SnakeGame`.
   Avoid `Program Files`: Windows blocks programs from writing there.
2. **The launcher is ready:** `SnakeGame.exe` sits right next to `index.html`. To change the launcher
   itself, rebuild it from `launcher\SnakeGame.sln` in Visual Studio 2022 (details: [`docs/LAUNCHER.md`](docs/LAUNCHER.md)).
3. **Make a shortcut.** Right-click `SnakeGame.exe` > *Send to* > *Desktop (create shortcut)*, or pin it to Start.
4. **Play.** Edit any file under `content/`, press **F5** in the game, and the change is live.

| Key | In the launcher |
|---|---|
| **F5** | Reload the game (picks up content edits) |
| **F11** or **Alt+Enter** | Full screen |
| **F12** | Developer tools: console, errors, inspector |

---

## The folder at a glance

```
SnakeGame/
├── SnakeGame.exe        the launcher: double-click to open your saves and play
├── launcher.ini         launcher settings: window size, F5/F12, where mods live
├── version.txt          the build number shown in Settings
├── index.html           the page the launcher opens: screens and buttons
│
├── content/             EVERYTHING YOU TUNE BY HAND: plain text, no code
│   ├── campaign/            THE GAME: islands, levels, bosses, items, trees, rules (docs/CAMPAIGN.md)
│   ├── economy.txt          the old islands' prices (the ladder: docs/DESIGN-46.md)
│   ├── rules/               level tuning, prestige and Nightmare rules
│   ├── worlds/
│   │   ├── world-order.dat      the islands, in unlock order
│   │   ├── builtin/<island>/    world.txt, levels.dat, seed.txt, upgrades/*.upg
│   │   ├── community/           ready-made Workshop levels (*.level)
│   │   └── user/                notes on keeping your own levels
│   ├── great-tree/upgrades/ the Great Tree's upgrades (*.upg)
│   ├── items/               one-time items (*.item)
│   ├── skins/  themes/  flair/  avatars/     cosmetics, one file each
│   ├── story/               every page of the story book (*.story)
│   └── music/               music.dat, plus your .ogg files
│
├── src/                 THE CODE (JavaScript), loaded in the order of src/load-order.dat
│   ├── engine/              boot, content loader, storage, random, audio, drawing, input
│   ├── campaign/            the campaign: its save, levels, bosses, items, shops, home base, HUD
│   ├── game/                rules: islands, economy, saves, story, runs, items, sandbox
│   ├── ui/                  screens: map, trees, Tailor, profiles, settings, tour...
│   ├── art/                 pixel art still in code: theme patterns, Flair, story book scenes, frames
│   └── dev/                 the cheat engine and the hidden terminal
│
├── textures/            EVERY SMALL PICTURE, as a PNG you can repaint (textures/README.md)
│   ├── index.json           which file each picture is: move or rename a file, change one line
│   ├── items/  junk/  crafted/  upgrades/   the campaign's things, runes in all eight conditions
│   ├── foes/  hazards/  powerups/  board/   what's on the board
│   ├── hearts/  bosses/  coins/  icons/     the HUD, wanted posters, money, map pins, cursors, avatars...
│   ├── ui/                  the menus' frames: plates, windows, buttons, tabs (color-swap), parchment
│   ├── map/                 each island on the map: under the paths, over them, and in the haze
│   └── scenes/              painted scenes: backgrounds, layers, sprite sheets, lights (rooms, shops, keepers, home, story book...)
│
├── styles/              CSS, in the order index.html links them
├── assets/              the fonts (with their licenses) and icons
├── mods/                the example mod (copied to Documents\SnakeGame\mods on first run)
├── tools/               check-campaign.py, sign-content.py, check-content.py, bundle-content.py, serve.py,
│                        textures/textures.mjs (check or export the pictures)
├── launcher/            the C++ launcher: Visual Studio solution and source
└── docs/                the guides below
```

---

## Common jobs

| I want to... | Open |
|---|---|
| Change a level, a boss, a shopkeeper or an island's money | `content/campaign/islands/<island>.json` (see `docs/CAMPAIGN.md`) |
| Change an item, its rarities or prices | `content/campaign/items.json` |
| Change an upgrade tree | `content/campaign/upgrades.json` |
| Change rewards, the bank, challenges, achievements or gem prices | `content/campaign/rules.json` |
| Change a workshop: junk recipes, parts, spell levels, seals, the kitchen, training, the rune forge | `content/campaign/crafting.json` |
| Change a price, how fast the game climbs, badge and contract rewards | `content/economy.txt` (see `docs/DESIGN-46.md`) |
| Change what turns up on an island (hazards, power-ups) | the `[spawns.*]` parts of its `world.txt` |
| Change what an upgrade does per tier, its name or text | its `.upg` file: `content/worlds/builtin/<island>/upgrades/` or `content/great-tree/upgrades/` |
| Change an island's speed, rules, Nightmare or map spot | `content/worlds/builtin/<island>/world.txt` |
| Rename levels | `content/worlds/builtin/<island>/levels.dat` |
| Make the Labyrinth repeat the same maze | `content/worlds/builtin/labyrinth/seed.txt` |
| Repaint an icon, a foe, a heart or a boss face | its PNG in `textures/` (see `textures/README.md`), then F5 |
| Add a skin, theme, Flair or avatar | copy a file in its folder, rename it, add the name to that folder's `_index.dat` |
| Add my own music | drop `menu.ogg` (etc.) in `content/music/`, see `music.dat` |
| Rewrite a story page | `content/story/<page>.story` |
| Add a Workshop level for everyone | `content/worlds/community/` |
| Bump the build number | `version.txt` |

After editing `content/campaign/`, run `python tools/check-campaign.py` and then `python tools/sign-content.py`
(edited but unsigned data marks the save as modded). For the rest of `content/`, run `python tools/check-content.py`.
If something is wrong anyway, the game shows a panel naming the file and line instead of starting.

---

## Guides

- [`docs/CAMPAIGN.md`](docs/CAMPAIGN.md): the campaign: islands, levels, bosses, items, shopkeepers, money, home base, the save
- [`docs/DESIGN-46.md`](docs/DESIGN-46.md): the old islands' economy, the Nightmare Realm, and every hazard and power-up
- [`docs/CONTENT-FORMATS.md`](docs/CONTENT-FORMATS.md): every content file, field by field
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the code is organized and how it starts
- [`docs/MODDING.md`](docs/MODDING.md): mods that add or change content without touching the game
- [`docs/LAUNCHER.md`](docs/LAUNCHER.md): building the launcher, where saves live, shipping
- [`docs/WORLDS.md`](docs/WORLDS.md): the save files (`.world`), how the game writes them, the saves window

## Saves

Each save is a `.world` file in `%APPDATA%\SnakeGame\worlds`, listed by **Snake Saves** (the window that opens
when you run `SnakeGame.exe`). **New** makes an empty save; **Play** opens the game on it. The game saves every
minute when something changed, and again when its window closes. Replacing the game folder with a new build
never touches them. Settings > "Back up your progress" copies a save code you can keep. The save is signed and
checked on every load, so edits made outside the game don't stick. Details: [`docs/WORLDS.md`](docs/WORLDS.md).
