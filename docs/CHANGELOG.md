# Changelog

## v:11.02.2026_b:46.0: twenty-two islands and a new economy

**Twelve new islands**, each bringing something new (the Garden and the Old Yard still come first):
Sunflower Fields, Bramblewood, the Hive, Thunder Peaks, Frostbite Fjord, the Hunting Grounds, the Powder
Keg, the Haunted Moor, the Clockwork Citadel, the Chrono Rift, Gale Cliffs and the Maw. Each has its own
tree of upgrades, three levels, a Nightmare twist, story pages and a story book picture.

- **New hazards:** brambles that grow, wasps that chase, lightning that strikes where it flashes, ice you
  can't turn on, bombs, ghosts that drift through walls, spike traps on a beat, apples that rot, gusts
  that shove the whole snake, and sinkholes.
- **New power-ups:** Golden Apples, Shears, Armor Plates, Bubble Shields, Hourglasses, Rampage Stars,
  Phantoms, Lodestones and Frenzy Clocks. Older islands now turn up the power-ups introduced before them.
- **New mechanics:** Armor, the Hunter (a rival snake you can trap), Fever, Shed Skin (press E), Echoes,
  and Bounty Contracts.
- **The Nightmare Realm:** Nightmares are now their own campaign. It opens once every island is unlocked;
  Nightmare islands then unlock in order, and their levels open one after another. Nightmares you'd
  already opened are kept for when the Realm opens.
- **A new economy** (`docs/DESIGN-46.md`): every price is counted in good runs on an island, and each
  island pays 1.5x the last. Unlocking the next island needs 75% of the previous island's tree grown.
  Island trees have 10 tiers per part (older saves keep the same strength). The Great Tree grows as far
  as your islands allow. Snakebucks stay the same size all game: the Exchange's rate follows your income.
- **Badges pay Snakebucks and XP.** Five new badge paths.
- **Five new Great Tree parts** (Scale Armor, Fever Pitch, Molting, Bounty Hunter, Lucky Charms) and two
  new one-time items (Armor Polish, Fever Dream).
- **Fixes:** a mod could switch on cheats through a `[__proto__]` section; the launcher could serve files
  from a folder next to the game folder whose name began the same way, and opened any kind of link;
  a damaged save was silently replaced (it's now copied aside first); restoring a backup with all three
  saves full overwrote save 3; holding Space flickered the pause screen or restarted the run at once;
  switching windows in the launcher didn't pause the run; very old saves lost half their heart upgrades;
  a failed first request on a served page could switch the game to an out-of-date content bundle; worn
  Flair wasn't checked against what you own.
- `tools/serve.py`: a test server that never serves stale scripts.

## v:10.21.2026_b:45.0: the project layout

- The single HTML file is now a project: code in `src/` (engine, game, ui, art, dev), styles in
  `styles/`, and everything tunable in `content/` as plain text files.
- Content is data, never code: economy, islands, levels, seeds, every upgrade, items, skins, themes,
  Flair, avatars, story pages, community levels and music each have their own files.
- Music plays your own audio files from `content/music/` (listed in `music.dat`), falling back to the
  built-in synth version of each track until a file exists.
- The Labyrinth's maze takes its settings and seed from its world folder: a fixed seed repeats a maze.
- Mods: folders of content that add or change things without touching the game. Owned items from a mod
  that's turned off are set aside, not lost.
- A Windows launcher (C++, WebView2): its own window and icon, full screen, saves in `%APPDATA%`,
  F5 reload and F12 developer tools for development.
- Tools: `check-content.py` finds content mistakes; `bundle-content.py` makes `index.html` work when
  opened straight from disk.
- The game plays exactly as build 44.0 did: every number, name and picture was carried over and checked.

## v:10.10.2026_b:44.0

Three save profiles, Snakebucks and the Exchange, XP paid at the end of a run, avatars, Nightmare runs,
and the Tailor without bubbles.
