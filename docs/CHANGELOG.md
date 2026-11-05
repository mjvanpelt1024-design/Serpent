# Changelog

## v:11.04.2026_b:47: the five-island campaign, in the old look

A new game on the old engine and in the old look: the same map, sky, Coil, screens, fonts and pixel art,
extended rather than redrawn. The campaign's design is in [`CAMPAIGN.md`](CAMPAIGN.md).

- **One save.** Play loads it (naming your snake the first time); no profiles. It's signed and checked
  against a schema on every load, so values edited outside the game don't stick. Settings backs it up,
  restores it, renames your snake and starts over.
- **Five islands on the Coil**, stacked from the sunrise to the stars, each with its own landmark, scenery
  and living details (flags, bees, an orbiting orb, windmill sails, a lighthouse beam, smoke and embers).
  Every island: home base, fifteen levels on a winding path, bosses at 5, 10 and 15, and the merchant, the
  challenger, the bank and the bridge after them. Every level needs the one before it.
- **Levels** have their own goals: apples, score, length, survival, distance, keys and a gate, pressure
  plates and a seal on an endless mirrored field, a thief, a relic in an endless maze.
- **Bosses** are snakes with stamina and hearts (silver ones are armor): outlast it, break its armor,
  finish it. Hearts grow island by island.
- **Shopkeepers**, each a named snake with a hat and a little animated shop: a merchant per island
  selling one kind of thing (gear, spells, snacks, familiars, runes; four rarities; new stock every two
  hours), a challenger with three twisted trials and a prize roll, and a bank that trades money down or
  into gems.
- **Money**: every island has its own, for its own upgrade tree; every upgrade works everywhere. Gems buy
  skins and themes; some are challenge prizes only.
- **Home base**: the map dives into each island's tree, with your satchel, trophy, mirror and easel
  around it.
- **Nothing on the board but the game**: the level, goal, boss and your kit sit in plates beside it (under
  it on a narrow screen); the old effect bars along the bottom of the board are gone.
- The old islands, levels, profiles and story stay in the code, switched off.

## v:11.02.2026_b:46.1: the map, rebuilt

- The map fills the whole screen. The islands sit along a winding road, right along the bottom, up, back
  left, up, and so on to the Maw; the Commons is the starting dock and the Workshop waits past the Maw.
- The road is **the Coil**, the serpent from the story: its scales light up green and gold as far as
  you've unlocked, light flows along it toward your next island, the stretch ahead glows with golden
  cracks, and the rest is cold stone. Unlocking an island sends a surge of light along it. Its head lies
  past the Maw; its eye opens when the Maw is yours and burns purple once the Nightmare Realm wakes.
- The sky climbs from sunrise at the Garden to a starry night at the Maw, with stars, a moon and far-off
  islands drifting behind the map as you move.
- It opens on the island you're working toward. Drag in any direction (a flick keeps it gliding), scroll
  or pinch to zoom; zoomed all the way out, the whole map still fills the screen.
- Every build 46 island has its own landmark on the map, and some of them move.
- Fixed: the bottom of the map was cut off, so most islands couldn't be seen.
- The game starts in full screen (`fullscreen = true` in `launcher.ini`; F11 or Alt+Enter switches).

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
