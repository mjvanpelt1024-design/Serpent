# Snake

A snake game across five big islands strung along the Coil: 75 levels with their own ways to win, a boss on
every island fought three times, merchants, challengers, banks, five currencies, and a home base tree on every
island. The older 22-island game is still in the code, switched off.

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
├── SnakeGame.exe        the launcher: double-click to play
├── launcher.ini         launcher settings: window size, F5/F12, where mods live
├── version.txt          the build number shown in Settings
├── index.html           the page the launcher opens: screens and buttons
│
├── content/             EVERYTHING YOU TUNE BY HAND: plain text, no code
│   ├── campaign/            THE GAME: five islands (islands/*.json), items, upgrade trees, rules
│   │                        (check with tools/check-campaign.py, then sign with tools/sign-content.py)
│   ├── economy.txt          every price in the game (the ladder: docs/DESIGN-46.md)
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
│   ├── campaign/            the five-island campaign: save, validator, levels, boss, items, map, shops
│   ├── engine/              boot, content loader, storage, random, audio, drawing, input
│   ├── game/                rules: islands, economy, saves, story, runs, items, sandbox
│   ├── ui/                  screens: map, trees, Tailor, profiles, settings, tour...
│   ├── art/                 pixel art in code: theme patterns, Flair, story book scenes
│   └── dev/                 the cheat engine and the hidden terminal
│
├── styles/              CSS, in the order index.html links them
├── assets/              the font and icons
├── mods/                the example mod (copied to Documents\SnakeGame\mods on first run)
├── tools/               check-campaign.py, sign-content.py, check-content.py, bundle-content.py, serve.py
├── launcher/            the C++ launcher: Visual Studio solution and source
└── docs/                the guides below
```

---

## Common jobs

| I want to... | Open |
|---|---|
| Change a price, how fast the game climbs, badge and contract rewards | `content/economy.txt` (see `docs/DESIGN-46.md`) |
| Change what turns up on an island (hazards, power-ups) | the `[spawns.*]` parts of its `world.txt` |
| Change what an upgrade does per tier, its name or text | its `.upg` file: `content/worlds/builtin/<island>/upgrades/` or `content/great-tree/upgrades/` |
| Change an island's speed, rules, Nightmare or map spot | `content/worlds/builtin/<island>/world.txt` |
| Rename levels | `content/worlds/builtin/<island>/levels.dat` |
| Make the Labyrinth repeat the same maze | `content/worlds/builtin/labyrinth/seed.txt` |
| Add a skin, theme, Flair or avatar | copy a file in its folder, rename it, add the name to that folder's `_index.dat` |
| Add my own music | drop `menu.ogg` (etc.) in `content/music/`, see `music.dat` |
| Rewrite a story page | `content/story/<page>.story` |
| Add a Workshop level for everyone | `content/worlds/community/` |
| Bump the build number | `version.txt` |

After editing by hand, run `python tools/check-content.py` to catch typos before they reach the game.
If something is wrong anyway, the game shows a panel naming the file and line instead of starting.

---

## Guides

- [`docs/CAMPAIGN.md`](docs/CAMPAIGN.md): the five-island campaign: islands, levels, bosses, items, money, the save and its validator
- [`docs/DESIGN-46.md`](docs/DESIGN-46.md): the economy, the Nightmare Realm, and every island, hazard and power-up
- [`docs/CONTENT-FORMATS.md`](docs/CONTENT-FORMATS.md): every content file, field by field
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the code is organized and how it starts
- [`docs/MODDING.md`](docs/MODDING.md): mods that add or change content without touching the game
- [`docs/LAUNCHER.md`](docs/LAUNCHER.md): building the launcher, where saves live, shipping

## Saves

Saves live in the launcher's own browser storage, under `%APPDATA%\SnakeGame`. Replacing the game folder
with a new build never touches them. There is one save. It is signed and checked every time it loads, so
edits made outside the game are thrown out (see docs/CAMPAIGN.md). The map's Save button (or Settings > Your
save) copies a backup code, loads one, or starts over.
