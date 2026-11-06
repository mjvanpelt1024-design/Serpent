# Changelog

## v:11.06.2026_b:51: workshops, pictures, foes, and a title screen of your own

- **Gear and spells are yours for good.** Gear absorbs one hit a level, plus one for each part fitted and one
  for a trinket; it's whole again every level. Uncommon gear comes with Better Materials (or Tempered Steel)
  fitted, rare and legendary with both parts. Spells get their charges back every level. Snacks and heart
  canisters are still used up.
- **The shops are pictures.** No list under the scene: three things sit on a shelf of five spots (one with a
  red sale tag), the bell rings in new stock for gems, the crate takes what you sell. The sign on the counter
  pans over to the merchant's **workshop**, and the keeper slithers across:
  - Brightscale Keep, the workbench: 45 junk materials (common, uncommon, rare) make 18 trinkets and 4 parts on
    fixed recipes (2 to 8 hours); fit them to gear for good at the fitting stand. One trinket per piece, each
    part once; a trinket adds a hit and a small perk.
  - Arcanum Spire, the lectern: spell upgrade points (a daily gift, quests, level challenges, casting, gems)
    raise a spell through ten levels (1, 2, 3, 5, 7... points each). The seal press locks a spell's level
    for a bigger boost, for an uncommon or rare piece of junk and 8 hours.
  - Feastwood Hollow, the kitchen: six new snacks (Sugar Plum, Fire Pepper, Mint Leaf, Glow Berry, Rock
    Candy, Royal Jelly) and 14 recipes (one always on the shelf, some found in levels, the best from quests).
    Buy the ingredients with several islands' money and a fresh snack (one extra charge) comes out of the oven.
  - Tidecoil Reef, the training lagoon: familiars go away for one to three days and come back 12% better.
  - Cinder Crown, the rune anvil: five of a rune in one condition forge into the next: refurbished, repaired,
    polished (a little under the condition they copy) or legendary (past pristine). Runes now turn up in
    levels on every island.
  - Three orders at a time per workshop. A blurb over the merchant's stall and a note on the map say when an
    order is ready.
- **Your things, in pictures.** Home base has an armory rack, a spell shelf, a familiar den and rune stones
  (each once you can buy that kind of thing), and the Satchel only holds snacks (with your pocket of four),
  heart canisters, junk, crafted pieces and recipes. Click a thing to see it; wear, carry or pocket it there.
- **Foes for every island.** Thieves steal a set number of points from your body (never half your score);
  biters hurt your head. Bees on the Keep, wasps in the Hollow and on the Reef, yellow jackets on the Crown;
  imps on the Spire (their hex goes through armor), moles in the Hollow, crabs on the Reef, wisps on the
  Crown. A rival snake turns up on any island now and then, wanders after an apple, eats it and leaves.
  Bonk heads with it and lose a heart through armor; if it runs into you, it's gone.
- **Hazards that fit their island:** embers (Keep, Hollow), acid (Spire, through armor), frost (Reef, slows
  you), fire (Crown: half a heart through armor and a burst of speed) and lava. Every island shares zones:
  the rim crumbles into sinkholes, the merchant's ice box leaks popsicles, traps lie in the grass, and the
  climb to the last lair gathers storms, more lightning every level up. The map shows each zone. Power-ups
  answer the trouble: honey, a waterskin, mittens, a lightning rod, a rope, an antidote, a net.
- **The title screen** wears your theme again (no more drifting map behind the board). Around the board:
  every island's money, your adventure in numbers, a wanted poster for every boss (crossed out when it
  falls), and a sticker for every island you finish that covers part of a number and peels back when you
  point at it. Posters can carry quest pins (data only for now).
- **The map's arrows** sit on the side of the screen their stop really lies on. A boss has two ways on (its
  shop and the next level); shops are dead ends back to their boss.
- **The story stays in the book.** No boss taunts, no narrator on the result card. In their place, a page for
  every island you reach and every boss fight you win, waiting for its words.
- **The terminal speaks campaign.** Seven groups (dev, debug, attribute, item, upgrade, level, data) for
  every item, every island's money, upgrades, unlocks, spawning any foe, bosses, workshop orders, shops,
  quests and save codes. **Shift+Alt+C** opens and closes it from anywhere (a level pauses behind it).
  Opening it marks the campaign save as cheated, for good. `dev everything.unlock` makes a save 100%;
  `dev everything.reset` (then type CONFIRM) wipes the game back to a brand new, uncheated save.
- **Straight back to the map.** No result card after a level: the map flies to the next stop (a boss's shop
  first) with the run's numbers in a plate at the side. Click a stop's own pin to play it: a card over the
  map shows the objective, then Start. The Play button and the Rules signpost are gone.
- The rails beside the board are a little smaller and shrink to fit the window; the pocket is one row of four.
- Fixed: coming back to the map from a shop left the stop's scroll open on top of the island's banner.

## v:11.06.2026_b:50: runes for keeps

- **Runes are permanent.** They never wear out or burn up. One is active at a time, and you swap it or take
  it off in the Satchel or the carry box between levels. Old saves' stacked runes become separate stones.
- **Thirteen runes**, eight of them new: Haste, Iron, Vigor, the Magpie, the Sage, Greed, Calm and Grace
  join Plenty, Stillness, Fortune, Fury and Echoes. Every one has a good side and a bad side.
- **Conditions instead of rarities**: Broken, Cracked, Fine and Pristine, each drawn on the stone (a chipped
  corner, a crack, plain, polished with a sweeping glint). A better condition means a stronger good side
  and a milder bad side. Runes cost more now that they last.
- **The hearts chip** shows every heart slot there is, the ones you don't have as shadows, and your rune
  under them (a shadow stone when there's none) with its good side in green and its bad side in red, or
  "No rune selected".
- Runecraft now makes a rune's percentage boons stronger. The kit beside the board is gear and spell (with
  any free casts from the Sage).

## v:11.06.2026_b:49: the pocket, challenges, and the map up close

- **Your kit is three things**: one gear, one spell, one rune. **Snacks go in a pocket** of four and you
  eat them yourself with **1 to 4** (or a click beside the board); they no longer fire on their own, and a
  bite that would do nothing is refused for free. Your familiar has its own chip beside the board, or
  says No familiar. The "What will you carry?" box and the Satchel's Kit tab both fill the pocket.
- **Objective, Quest and Challenge** beside the board. The challenger's three trials are now a *quest*
  (shown from any island while one is on, None otherwise). Every one of the 75 levels has a
  **challenge**, something extra to do for points every time or coins or a gem once: smash three
  boulders, eat four apples in fifteen seconds, win without a hit, win inside two minutes...
- **No popups on the path.** Clicking a stop flies the camera down to it: the Play button stands on the
  stop, a Rules signpost beside it, the name on a parchment scroll, and arrows on both sides of the
  screen to the stop before and after (Home, Boss, the shopkeeper, Next island). Left and right arrow
  keys walk the path; Esc flies back out. Home dives straight in.
- **Home base** has no buttons: click the tree's carving for upgrades, the satchel, the trophy, the
  mirror or the easel. The bounty and your quest are pinned in the corner, and the place's name is on a
  scroll.
- **The upgrade tree** is one tree now, trunk to crown with a bough to every upgrade, roots, and a canopy
  in layers that fills out as you grow it.
- **Coins** carry their island's mark. Click the coin in the top bar to flip it to heads, with the
  money's name and a little story; Esc or a click away flips it back.
- **The title screen** looks out over the whole world, drifting from the sunrise to the stars, through
  the board.
- **A brass pointer** for a cursor (a gloved hand over anything clickable), hidden while you play.
- Fixed: every save reload said "Some save values were out of range" once you'd earned any island's
  money (its per-island tally was refused by the save check).

## v:11.05.2026_b:48: hearts, armor and the hub, in full retro fantasy dress

- **Points pay.** Every run's points turn into the island's money, won or lost (1 coin per 50 points,
  `rewards.pointsPerCoin`), on top of a win's reward. The purse in the hub shows what this run will pay.
- **No hearts to start.** One hit ends a run until Stout Heart (the first island's tree) adds hearts, one
  per tier up to five. Glass Scales now means no hearts, no armor, no canister.
- **Armor in pieces.** Plates come only from upgrades. Each has four pieces: a half-heart hit knocks one
  off (a dent, a crack, half a plate, gone) and a big hit carries on to the next plate. Breakers (bosses,
  bombs, spikes, the rival snake) knock off twice as much; lightning, ghosts and poison go straight through.
  Hearts are red, armored hearts gold, armor with no heart under it silver, all drawn as pixel hearts.
- **The Heart Canister**, a new kind of thing to carry: found on the board now and then or won from a
  challenge. 1 to 3 purple hearts (common to rare) or 5 plates of shiny purple armor (legendary), spent
  first, never refilled; the jar crumbles when it's empty.
- **The hub around the board.** Left: your hearts, score, purse and kit. Right: the island and level, the
  quest, the challenge's trials, and a wanted poster with the bounty on the next boss; the boss's own stats
  show only while you fight it.
- **Fonts.** Press Start 2P by default, with Retro (Silkscreen), Classic (VT323), Jersey and Original
  (Pixelify Sans) in Settings; titles in the blackletter Jacquarda Bastarda. All built in, all OFL.
- **The art pass.** Every panel, window, button, tab and chip has a pixel frame drawn from the theme's
  colors: brass trim and rivets, gems in the corners of big windows, a lip under every button, parchment
  for the bounty, brass brackets on the board. Every upgrade and rune has its own picture, and every icon
  is lit from the top left.
- **The map.** The islands climb in a zigzag, each with its own outline and an underside that curves like
  real rock (crystals under the Spire, tiers under the Hollow, coral under the Reef, a black spike under
  the Crown), islets floating nearby, signposts where the shops branch off, lanterns along the paths up in
  the dusk, chimney smoke, mist off the falls, birds by day and shooting stars by night.

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
