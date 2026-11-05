# The campaign (build 47)

Five islands strung up the sky along the Coil, fifteen levels each, one boss per island fought three times,
shopkeepers off every path, and an economy where every island has its own money. It looks the way build
46.1 did: the same map, sky, Coil, pins, banner, screens, fonts and pixel art, extended rather than redrawn.
This file is the design and the map of where things live. The numbers themselves are all in
`content/campaign/`.

## Where things live

| What | Where |
|---|---|
| Islands, their people, boss, currency and 15 levels | `content/campaign/islands/<id>.json` (order: `islands/_index.dat`) |
| Every item, rarity, price and loot trinket | `content/campaign/items.json` |
| The five upgrade trees | `content/campaign/upgrades.json` |
| Rewards, timers, the bank, challenges, achievements, cosmetics | `content/campaign/rules.json` |
| The signatures of all of the above | `content/campaign/manifest.dat` (made by a tool, never by hand) |
| The save, its schema and the data check | `src/campaign/integrity.js`, `src/campaign/camp-save.js` |
| The map: islands, paths, stops, pins, camera | `src/ui/map.js` (the Coil and the sky: `map-coil.js`) |
| What's painted on each island | `src/ui/map-isles.js` |
| Playing a level on the old engine | `src/campaign/camp-run.js`, `camp-levels.js`, `camp-boss.js`, `camp-items.js` |
| The HUD beside the board, the result card | `src/campaign/camp-hud.js`, `camp-screens.js` |
| Shops, shopkeeper scenes, the kit box, trees | `camp-shops.js`, `camp-scenes.js`, `camp-kit.js`, `camp-tree.js` |
| Home base, the Satchel, Tailor and Trophy Hall | `camp-home.js`, `camp-collection.js` |
| Item and goal pictures (12 x 12, like every icon) | `camp-art.js` (goal pieces: `camp-levels.js`) |
| One save, no profiles, settings rows | `camp-menu.js` |

After changing any campaign file:

```
python tools/check-campaign.py     # catches mistakes: unknown layouts, bad spawns, wrong-length price lists...
python tools/sign-content.py       # re-signs the data so saves aren't marked modded
python tools/bundle-content.py     # only if you run the game straight from index.html, without the launcher
```

## The save and its validator

There is one save (`snakeCampaign_v1` in the launcher's storage). Play loads it; the first time it asks
for the snake's name. There are no profiles any more.

- **Signed.** Every write stores the save's text with a signature. If the text is edited outside the game,
  the signature stops matching: the edited copy is kept aside and the last copy the game signed loads.
- **Checked.** Every load runs the save through `SAVE_SCHEMA` (`src/campaign/integrity.js`): numbers are
  clamped to their ranges, unknown fields dropped, items that don't exist removed, upgrade tiers capped. To
  add something to the save, add it to `SAVE_SCHEMA`; that's the only place.
- **Data files.** At startup the campaign data is checked against `manifest.dat`. Edited data still runs,
  but the save is marked *modded* for good (Settings says so).
- **The console** (next pass) will change the save through `campCheatEdit()` in `camp-save.js`: the change
  is validated and signed like any other, and `flags.cheats` is set for good.
- This is tamper-evident, not tamper-proof: the key is in the game's files. It stops casual editing.
- Backups: Settings > Just for fun has rename, back up, restore and start over, all on the one save
  (`COIL1-` codes). Starting over keeps the old save aside in storage.

The old profile save still exists underneath (slot 1, chosen quietly) for settings and the engine's own
stats. Nothing of the campaign lives in it.

## The map

The 46.1 map, with five big islands stacked up the sky from the sunrise to the stars. The Coil's tail
rises out of the cloud sea, threads under each island's grass from its home end to its far end, swings out
past the end and climbs to the next island, which runs the other way. It's green and gold up to where
you've reached, glows with golden cracks on the climb ahead, and is stone beyond. The next island is a
silhouette in the haze; the ones after it are lost in clouds. Its head lies past the last island; its eye
opens when you reach that island and burns purple once its last boss falls.

Drag to explore, scroll or pinch to zoom; click an island to fly in. Up close the banner shows its name,
your money there, Home base and the next level; the arrows (or a swipe up or down) step between islands.

Every island has the same twenty stops on a winding dirt path (paths you've opened are trodden smooth):

```
 (the castle,   11 12 13 14 [15] - bank      bridge
  the spire...) challenger [10]  9  8  7  6
 home   1  2  3  4 [5] - merchant
```

(Islands 2 and 4 run right to left.) Each stop has its own picture: stepping stones with a pennant once
won, boss lairs with eyes that watch you (a banner flies over them once beaten), the market stall, the
challenger's tent, the bank with a coin turning on its roof, the bridge gate with torches, and the home
tree, which grows as you buy that island's upgrades. The shopkeepers stand by their stalls.

- **Levels 1-4** are still boards (no mazes, no endless roads). **6-9** are still boards with enemies
  (fleas, bees, ghosts, rival snakes). **11-14** move: the endless road, the endless maze, the endless
  mirrored field and walls that rise and fall on a beat.
- Every level needs the one before it, so every boss stands between you and what's past it.

| # | Island | Theme | Currency | Merchant sells | Boss (hearts / armor) |
|---|---|---|---|---|---|
| 1 | Brightscale Keep | medieval | Snaycoins | Gear | Grimscale the Black Knight (3 / 1) |
| 2 | Arcanum Spire | wizardry | Slithers | Spells | Hexfang the Archmage (3 / 3) |
| 3 | Feastwood Hollow | harvest | Scales | Snacks | Gorgemaw the Glutton (5 / 3) |
| 4 | Tidecoil Reef | ocean | Pearls | Familiars | Leviathorn (5 / 5) |
| 5 | Cinder Crown | volcano | Orobucks | Runes | Pyrrhus the Cinder Wyrm (7 / 5) |

## Playing a level

Play (or the level's rules card) opens the old "Bring anything?" box when you own something to carry: one
gear, spell, snack, familiar and rune, picked with arrows. Then the old 3-2-1 countdown.

**Nothing is drawn on the board but the game.** The game's own HUD keeps the hearts (with armor), the
score and the pause button; plates in the same style hold the rest. On a wide screen the level, its goal
and the boss sit in the left rail and your kit, effects, the pointer and found loot in the right rail; on a
narrow screen they line up under the board. The old effect bars along the bottom of the board are gone.

The result shows on the old game-over card: the money won (a first win pays more, a flawless one a quarter
extra), what just opened, and a Next button.

### Ways to win (a level's `goal`)

`apples`, `score`, `length`, `survive` (seconds), `distance` (meters, endless road only), `keys` (find N,
then the gate that appears), `buttons` (press N plates, optionally `"ordered": true`, then touch the seal
that appears in the middle of the endless mirrored field), `relic` (one hidden thing: crown, grimoire,
ladle, pearl, eye), `shards` (gather N), `thief` (a raccoon that runs from you; corner it N times),
`boss`. The goal pieces are 12 x 12 pixel sprites like every icon in the game.

### Bosses

A big rival snake, drawn the way your snake is, in its own colors, with its island's crest (a plumed helm,
a wizard's hat, a bib and fork, a crown of fins, burning horns). Its hearts, stamina and mood are in a
plate beside the board; silver hearts are armor.

1. **Level 5: outlast it.** It hunts you, charges now and then, and its stamina drains the whole time. At
   zero it gives up. You can't hurt it yet; a bite costs you a heart.
2. **Level 10: break its armor.** Stamina drains faster. At zero it's exhausted: slow, sleepy, open, and
   recovering. Bite its body to knock off a silver heart. A sword or a fireball cracks armor too.
3. **Level 15: finish it.** No armor, full stamina. Exhaust it and bite its red hearts to zero.

## Items

Four rarities (Common, Uncommon, Rare, Legendary), five kinds, one of each carried at a time:

| Kind | Island | Behaves | The five |
|---|---|---|---|
| Gear | 1 | worn; uses wear out (1/3/5/5), then it breaks; legendaries add an immunity | Kite Shield, Arming Sword, Bulwark Helm, Ember Cloak, Thorn Mail |
| Spell | 2 | Space casts; rarity sets charges and duration | Force Field, Fireball, Blink, Frost Nova, Apple Call |
| Snack | 3 | fires by itself when needed: heals, regrows armor, repairs gear | Hearty Stew, Honey Bread, Tinker's Pie, Spice Jerky, Phoenix Tart |
| Familiar | 4 | follows you into every level; never wears out | Lantern Firefly, Snip the Crab, Shellby the Turtle, Puff the Pufferfish, Sir Seahorse |
| Rune | 5 | burns up when a level starts and changes that level | Plenty, Stillness, Fortune, Fury, Echoes |

Every item has a strength and a weakness, written on its row: the shield shoves a bee aside but the bee
comes back, and does nothing for walls or fire; the sword kills anything alive but snaps on a rock; the
helm saves you from walls and nothing else; the cloak takes fire, lightning and blasts but not a rock;
thorn mail guards your body, not your face. Loot trinkets turn up during levels: any merchant buys them.

## The shopkeepers

Each is a named snake with a hat, standing by their stall on the map; their screen opens with a little
animated scene of their shop in the story book's style.

- **Merchant** (after boss 1): three different items of the island's kind, each a random rarity (Common
  55, Uncommon 28, Rare 13, Legendary 4), one on sale. New stock every 2 hours, or now for gems. A Sell tab
  buys anything back in the money of the island it came from.
- **Challenger** (after boss 2): three of the island's won levels (never a boss) with two nightmare-style
  twists each (faster, a bigger goal, a swarm, one heart, darkness, no items, a 90 second clock,
  rockslides), different twists on each trial. Once accepted it stays until it's done or its week runs out
  (`challenge.days`). Finishing pays the island's money plus one weighted roll from `challenge.pool`
  (gems, a rare or legendary item, an exclusive skin or theme); the odds are shown.
- **Banker** (after boss 3): trades this island's money down to the previous island's (10 to 1, less a
  flat 5 of the previous money per trade) or into gems, with the old Exchange's slider. Trades only go
  down. *Cash out* walks everything down to Snaycoins, one fee per step, then into gems.

## Money and upgrades

Each island has its own money, earned on its levels and from its challenges. Each upgrade tree is paid in
its own island's money, but **every upgrade works on every island**:

| Tree | Island | Upgrades |
|---|---|---|
| The Oak of Basics | 1 | apple value, extra apples, score multiplier, extra hearts, bigger rewards, golden apples |
| The Warding Willow | 2 | armor plates, moving slower, hazard ward, enemy ward, shorter speed effects, spell recharge |
| The Pantry Pear | 3 | gear uses, spell charges, snack charges, loot luck, cheaper merchants, faster restocks |
| The Coral Fig | 4 | boss stamina drain, longer exhaustion, double bites, faster familiars, bigger challenge rewards, better sell prices |
| The Ember Ash | 5 | second wind, survival points, gem finder, runecraft, more of every currency, more armor slots |

**Gems** are the one shared currency: from achievements, challenges and the banks (and, once the game
launches, real money). They buy skins and themes at the Tailor. Some skins and themes are challenge prizes
only (`cosmetics.exclusiveSkins` / `exclusiveThemes`).

## Home base

The home stop on every island is its tree. Click it and the map's camera dives at the tree, into a close-up
of the island's home in the map's own pixel style, in the sky at that island's height: the upgrade tree,
as tall and full as its upgrades (a fruit for every tier), your satchel leaning on the trunk with what you
carry peeking out, a golden trophy on a plinth, a standing mirror with your snake in it, an easel painted
with your theme, and your snake curled up by the roots. Each opens its page on the old screens:

- the tree: the island's upgrade tree (the old tree screen)
- the satchel: the Satchel (Kit to carry, Loot, Wardrobe)
- the trophy: the Trophy Hall (the campaign's achievements and their gem rewards)
- the mirror and the easel: the Tailor (skins and themes for gems)

## Decided, and not done yet

- From the earlier plan, kept as a checklist: one commit per task; satchel roles (carried, cast, passive,
  loot to sell); the bank's cash-out to gems.
- Not done yet, on purpose: the console's campaign commands (the sticky cheat flag is in the save), a
  seeded RNG in bug reports, save versioning beyond `v: 1`, headless tests, real-money gems.
