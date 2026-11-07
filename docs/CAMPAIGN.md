# The campaign (builds 47 to 51)

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
| Rewards, timers, the bank, challenges, achievements, cosmetics, zones | `content/campaign/rules.json` |
| The workshops: junk recipes, parts, spell levels and seals, recipes and ingredients, training, the forge | `content/campaign/crafting.json` |
| The signatures of all of the above | `content/campaign/manifest.dat` (made by a tool, never by hand) |
| The save, its schema and the data check | `src/campaign/integrity.js`, `src/campaign/camp-save.js` |
| The map: islands, paths, stops, pins, camera | `src/ui/map.js` (the Coil and the sky: `map-coil.js`) |
| What's painted on each island, and each island's shape | `src/ui/map-isles.js` (`ISLE_SHAPE`) |
| Playing a level on the old engine | `src/campaign/camp-run.js`, `camp-levels.js`, `camp-boss.js`, `camp-items.js` |
| The hub beside the board, the result card | `src/campaign/camp-hud.js`, `camp-screens.js` |
| Hearts and armor: the rules (`campDamage`) and their pictures | `camp-run.js`, `camp-hearts.js` |
| Shops, shopkeeper scenes, the kit box, trees | `camp-shops.js`, `camp-scenes.js`, `camp-kit.js`, `camp-tree.js` |
| Every level's challenge (its `bonus`) | `camp-bonus.js` |
| Runes: what each stat does, their words and their four conditions | `camp-runes.js` |
| Home base, the Satchel, Tailor and Trophy Hall | `camp-home.js`, `camp-collection.js` |
| Item and goal pictures (12 x 12 PNGs, like every icon) | `textures/` (see `textures/README.md`); drawn by `src/engine/render/pixel-icons.js` |
| The pixel frames on every panel, button and window | `src/art/ui-frames.js`, `styles/16-retro-fantasy.css` |
| Scrolls, the cursor, coins and their card, the title screen's world | `src/art/ui-scroll.js`, `coins.js`, `title-scene.js`, `styles/17-hub-nodes.css` |
| One save, no profiles, settings rows | `camp-menu.js` |
| The workshops' rules: orders, parts and trinkets, spell levels, training, the forge, the kitchen | `camp-craft.js` |
| The shops as pictures, and their workshops | `camp-shop-stage.js` |
| Your things in pictures: the rack, the shelf, the den, the stones, the Satchel | `camp-invpics.js` |
| Enemies, hazards, power-ups, the rival snake, zones and their map cues, the new snacks | `camp-foes.js` |
| The title screen's numbers, posters, stickers and pins | `camp-title.js` |
| Story placeholder pages | `camp-story.js` |
| The terminal's campaign commands, Shift+Alt+C | `src/dev/terminal/cmd-camp.js` |

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

The 46.1 map, with five big islands climbing the sky in a zigzag from the sunrise to the stars, each pushed
toward the side the Coil comes up on (`ISLE_STAGGER` in `map.js`). Every island has its own outline and
underside (`ISLE_SHAPE` in `map-isles.js`): the rock is a stack of ever smaller copies of the grassy top, so
its layers curve with the front rim, with crystals, coral, obsidian or earth hanging off it and little
islets floating nearby. Shapes there must keep every stop on the grass. The Coil's tail
rises out of the cloud sea, threads under each island's grass from its home end to its far end, swings out
past the end and climbs to the next island, which runs the other way. It's green and gold up to where
you've reached, glows with golden cracks on the climb ahead, and is stone beyond. The next island is a
silhouette in the haze; the ones after it are lost in clouds. Its head lies past the last island; its eye
opens when you reach that island and burns purple once its last boss falls.

Drag to explore, scroll or pinch to zoom; click an island to fly in. Up close the banner shows its name,
your money there, Home base and the next level; the arrows (or a swipe up or down) step between islands.

**There are no popups on the path.** Click a stop and the camera flies right down to it (`renderNodeFocus`
in `map.js`): its name on a parchment scroll at the top (with the level's goal and challenge, or the
shopkeeper's line), and the stop's own pin glowing, with a caption under it (Play, Play again, Visit,
Cross, or why it's locked). Click the pin itself: a shop opens, and a level first shows its objective on a
card over the map (`openMapGoal`) with Start and Back. The stop's record (objective, best, wins, challenge,
reward) and your last run's numbers sit in a plate at the side (`renderNodeSide`). Big arrows on either
side step to the stops around it (also the arrow keys, or WASD), and say where they go:
Home before level 1, Boss before a lair, the shopkeeper's name before a shop, Next island at the bridge.
The shops go by their own names everywhere (The Coiled Anvil, The Tourney Tent, The Counting House...), and
an island's banner has a button for each: the map flies to that shop's stop, then walks you in
(`mapFlyTo`). Home base has arrows like a stop's: on to level 1, and down to the bridge of the island below.
Esc, a click on the grass or scrolling out flies back up. Home doesn't stop to ask: it dives straight
into home base.

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

- **Levels 1-4 and 11** are still boards (no mazes, no endless roads). Level 11 is a comb board on every
  island: the endless road was taken off the path (see `docs/PHYSICS.md`, "The scroller" for where it
  can come back). **6-9** are still boards with enemies (fleas, bees, ghosts, rival snakes). **12-14**
  move: the endless maze, the endless mirrored field and walls that rise and fall on a beat.
- Every level needs the one before it, so every boss stands between you and what's past it.

| # | Island | Theme | Currency | Merchant sells | Boss (hearts / armor) |
|---|---|---|---|---|---|
| 1 | Brightscale Keep | medieval | Snaycoins | Gear | Grimscale the Black Knight (3 / 1) |
| 2 | Arcanum Spire | wizardry | Slithers | Spells | Hexfang the Archmage (3 / 3) |
| 3 | Feastwood Hollow | harvest | Scales | Snacks | Gorgemaw the Glutton (5 / 3) |
| 4 | Tidecoil Reef | ocean | Pearls | Familiars | Leviathorn (5 / 5) |
| 5 | Cinder Crown | volcano | Orobucks | Runes | Pyrrhus the Cinder Wyrm (7 / 5) |

## Playing a level

Play (on the stop, or on the rules card) opens the old "Bring anything?" box, now "What will you carry?",
when you own something to carry: **your kit** (one gear, one spell, picked with arrows), your familiar,
your active rune and heart canister ("with your hearts"), and **the pocket**, four snack slots you click to fill (never the same
snack twice). The Satchel's Kit tab changes the same things between levels. Then the old 3-2-1
countdown, and the cursor hides until the run ends or you pause.

**Nothing is drawn on the board but the game.** The hub around it, in pixel-framed plates:

- **Left, you:** the hearts chip (below), the score and the pause button (the game's own HUD), your purse
  (this island's money and your gems, and what this run's points will pay), your kit (gear, spell with
  its Space key and any free casts), the pocket (four snacks with their keys 1 to 4 and charges left; click one to eat
  it too), a chip with your familiar (or No familiar), effects, and what you've found.
- **Right, the world:** the island and level, then three plates: **Objective** (the level's goal),
  **Quest** (the challenger's three trials while one is on, from any island; None otherwise) and
  **Challenge** (the level's extra, below), and a wanted poster with the bounty on the next boss: its
  face, its name, where it waits and the reward. The boss's own hearts, stamina and mood only show while
  you fight it.

On a narrow screen both sides line up under the board. On a wide one each rail shrinks to fit the
window (`campFitRails` in `camp-hud.js`): never a scrollbar, never cut off.

### Snacks

Snacks don't fire by themselves any more: **1 to 4** (number row or keypad) eat the one in that pocket
slot, once the countdown is over. Each bite spends a charge, the last one empties the slot. A bite that
would do nothing is refused and costs nothing: Hearty Stew heals hearts up to your full hearts, Honey
Bread grows armor plates back, Tinker's Pie gives your gear its uses back, Spice Jerky puts charges back
in your spell (up to full), and Phoenix Tart readies a second chance for this level (`campRun.phoenix`).
The save keeps the pocket as four item ids (`pocket`, 0 for empty); an old save's carried snack moves
into it.

### Challenges

Every level has one (`bonus` in its island file, checked by `tools/check-campaign.py`), shown on the map
and beside the board even when you can't manage it yet: eat N apples within S seconds (`streak`), win
within N seconds (`fast`), smash into N boulders (`rocks`, only where rocks fall), grow to N (`length`),
score N (`points`), win without a hit (`untouched`), defeat N enemies (`kills`: sword, fireball, crab,
the hunter), cast N spells (`spells`), find N trinkets (`loot`). The reward is `{"points"}` every time
you do it, or `{"gems"}` / `{"coins"}` once (the level's record keeps `bonus: true`).

### Hearts and armor

The hearts chip always shows as many slots as anyone can have (`campHeartCap`: five from Stout Heart, more
if a rune or your armor needs them). The hearts you don't have, or have lost, are **shadows**. Under
them sits your **rune**: its stone (or a shadow of one when there's none) and a two-line blurb, the good
side in green and the bad side in red, or "No rune selected".

You start the game with **no hearts**: one hit ends a run. Stout Heart (the first island's tree) adds one
per tier, up to five. The engine's rule stays: at zero hearts you're still alive, and the next hit kills.

- Hearts come in **halves**. Wasps, ghosts, brambles, fire, smaller fleas and a boss biting your body cost
  half a heart; spikes, lightning, bombs, big fleas, the rival snake and running into a boss a whole one.
- **Armor plates** come only from upgrades (Arcane Plating on the Spire, more room from Iron Scales on the
  Crown); armor pickups pay points instead. A plate has four pieces (`rules.snake.armorPieces`): every half
  heart of damage knocks one off, so it shows a dent, a crack, half a plate, then it's gone, and what's left
  of a big hit carries on to the next plate, then the hearts. Armor works with no hearts at all.
- **Breakers** (`rules.damage.crush`: the boss, bombs, spikes, the rival snake) knock off two pieces per
  half heart, a whole plate for a one-heart hit. **Piercing** hits (`rules.damage.pierce`: lightning,
  ghosts, poison) go straight through armor to the hearts.
- In the HUD each slot is a pixel heart: **red** is a heart, **gold** a heart with a plate over it,
  **silver** a plate where you have no heart. Bosses use the same pictures (silver while armored).

There's no result card: the game goes straight back to the map, up close on the next stop (after a boss,
its shop, the challenger or the bank; after a quest trial, the next trial, or the challenger once all three
are done; after a loss, the same level),
with the run's numbers at the side: the money won (a first win pays more, a flawless one a quarter extra),
what this run's points paid, what you found, what just opened.

### Ways to win (a level's `goal`)

`apples`, `score`, `length`, `survive` (seconds), `distance` (meters, endless road only), `keys` (find N,
then the gate that appears), `buttons` (press N plates, optionally `"ordered": true`, then touch the seal
that appears in the middle of the endless mirrored field), `relic` (one hidden thing: crown, grimoire,
ladle, pearl, eye), `shards` (gather N), `thief` (a raccoon that runs from you; corner it N times),
`boss`. The goal pieces are 12 x 12 pictures like every icon in the game (`textures/board/`).

### Bosses

A big rival snake, drawn the way your snake is, in its own colors, with its island's crest (a plumed helm,
a wizard's hat, a bib and fork, a crown of fins, burning horns). Its hearts, stamina and mood are in a
plate beside the board; silver hearts are armor.

**Hurting it** (`camp-boss.js`): when the boss's head runs into your snake it hurts itself (and bounces off);
when your head runs into it, you're hurt (a heart, a breaker). So dodge its head and let it crash. Every blow
is one, plus one with a sword worn (two for a legendary one), plus the Rune of Fury's bite and the Coral Fig's
bite chance; Thorn Mail adds one when it rams your body. A sword also lets you strike it head-on (one of the
sword's hits for the level), a shield shoves it back, a fireball burns it, a force field zaps it when you
touch it, and Frost Nova freezes it, unless that boss shrugs the spell off (`boss.resist` in its island's file:
the Cinder Wyrm is fireproof, the Archmage counters frost). While it's worn out (fights 2 and 3), a bite on
its body hurts it too.

1. **Level 5: wear it out.** Each blow knocks the wind out of it (a fifth of its stamina), and its stamina
   drains as it hunts you anyway. At zero it gives up.
2. **Level 10: break its armor.** Each blow knocks off a silver heart. At zero stamina it's exhausted:
   slow, sleepy and open to bites.
3. **Level 15: finish it.** No armor: each blow takes a red heart.

**How sharp it is** (`boss.smart`, 0 to 1, from `bossSmartFor`): every fight a little sharper than the one
before, island by island, from 0.12 (the first island's first fight: slow, mostly wandering, blundering
into you) to 1 (the last island's last fight, as hard as bosses have ever hunted). A dull boss wanders off
your trail and runs into you; a sharp one heads for the squares in front of your head to get in your way,
swerves rather than ram you, and charges more often. Its speed and charges scale with it too.

## Items

Four rarities (Common, Uncommon, Rare, Legendary), six kinds. Your kit is one gear and one spell; snacks
go in the pocket, four at most; one familiar, one rune and one heart canister come along too:

| Kind | Island | Behaves | The five |
|---|---|---|---|
| Gear | 1 | worn; absorbs hits each level (1 + parts + trinket), lasts for good; legendaries add an immunity | Kite Shield, Arming Sword, Bulwark Helm, Ember Cloak, Thorn Mail |
| Spell | 2 | Space casts; rarity and level set charges (every level) and power | Force Field, Fireball, Blink, Frost Nova, Apple Call |
| Snack | 3 | in the pocket; 1 to 4 eat one: heals, regrows armor, repairs gear, recharges a spell, a second chance | Hearty Stew, Honey Bread, Tinker's Pie, Spice Jerky, Phoenix Tart |
| Familiar | 4 | follows you into every level; never wears out | Lantern Firefly, Snip the Crab, Shellby the Turtle, Puff the Pufferfish, Sir Seahorse |
| Rune | 5 | yours for good; one active at a time, a good side and a bad side in every level | Plenty, Stillness, Fortune, Fury, Echoes, Haste, Iron, Vigor, the Magpie, the Sage, Greed, Calm, Grace |
| Canister | never sold | purple hearts on top of your own, lost first; they never refill | Heart Canister |

### Runes

A rune never wears out or burns up. One is active (`camp.equip.rune`), chosen in the Satchel or the
carry box, and both its sides work in every level until you take it off (never during one). A rune's
rarity is its **condition**, named by the family's `grades`: **Broken** (a chip knocked out of its
corner, dull), **Cracked** (a split down its face), **Fine** (as carved) and **Pristine** (polished,
with a glint that sweeps across it). A better condition makes the good side stronger and the bad side
milder. Runecraft (the Ember Ash) makes the good side's percentages stronger still.

| Rune | Good (broken / cracked / fine / pristine) | Bad |
|---|---|---|
| Plenty | apples +10/20/30/45% points; +1/1/1/2 apples | hazards 35/30/25/20% faster |
| Stillness | move 6/10/14/20% slower | points -20/17/15/12% |
| Fortune | +25/40/60/100% money | -1/1/1/½ heart |
| Fury | bosses tire 20/30/40/60% faster; +1/1/1/2 bite | take 100/90/75/50% more damage |
| Echoes | come back once with ½/1/1½/2 hearts | pay -50/40/30/20% if it saves you |
| Haste | points +15/20/28/40% | move 14/12/10/8% faster |
| Iron | +1/1/2/2 armor plates (over the cap) | each apple grows you 2/2/1/1 more |
| Vigor | +½/1/1/2 hearts | hazards 30/25/20/15% faster |
| The Magpie | trinkets 50/75/100/150% more often | points -15/12/10/8% |
| The Sage | 1/1/2/3 free casts a level | spell recharge 50/40/30/20% slower |
| Greed | 10/15/20/30% chance of a gem on a win | -40/35/30/25% money |
| Calm | hazards 15/20/25/35% slower | apples -20/16/12/10% points |
| Grace | 1/1½/2/3 s safe after every hit | -1/1/½/½ heart |

**Adding one.** A rune is only data: an entry in `items.json` with a `color`, a `good` and a `bad` list of
`{"stat", "v": [four values]}`, and a picture (`RUNE_GLYPHS` in `camp-runes.js`, a 7 x 7 glyph carved
into the stone; the four conditions are drawn from it). The stats it can use are `RUNE_STATS` in
`camp-runes.js` (each with its long and short words) and the same names in `tools/check-campaign.py`; the
game reads them with `runeVal(stat)` where each one acts. A new kind of effect is one entry in each of
those and one `runeVal()` call. Hazards (`HAZARD_SPAWNS` in `camp-run.js`) are the spawns that hurt.
Old saves' stacked runes are split into separate stones (`campSplitRunes`).

### The Heart Canister

The **Heart Canister** is found on the board now and then (`rewards.canisterShare` of loot drops) or won
from a quest (`challenge.pool`). Common, uncommon and rare ones hold 1, 2 and 3 **purple hearts**; a
legendary holds 5 plates of **shiny purple armor** (four pieces each, like yours). Its pieces are spent
before your own armor and hearts, a lost one is gone for good, and the jar crumbles when it's empty. It's
switched off by the Glass Scales and Bare Scales twists. Stored in the save as its pieces left (`uses`).

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
- **Challenger** (after boss 2): a **quest**, three of the island's won levels (never a boss) with two nightmare-style
  twists each (faster, a bigger goal, a swarm, no hearts or armor, darkness, no items, a 90 second clock,
  rockslides), different twists on each trial. Once accepted it stays until it's done or its week runs out
  (`challenge.days`). Finishing pays the island's money plus one weighted roll from `challenge.pool`
  (gems, a rare or legendary item, a heart canister, an exclusive skin or theme); the odds are shown.
  Accepting it flies the map straight to the first trial. The three trials' pins are ringed in violet and
  numbered (gold with a tick once done), a dashed violet trail runs from the tent through them, over the
  island's own path, and a purple **Quest** arrow at every trial points on to the next one. A trial's
  objective card lists its twists, with **Start trial** (or a normal run); after a trial the map flies to
  the next one, and after the last, back to the challenger to claim (`questFor`, `questNextFrom` and
  `drawQuestTrail` in `map.js`).
- **Banker** (after boss 3): trades this island's money down to the previous island's (10 to 1, less a
  flat 5 of the previous money per trade) or into gems, with the old Exchange's slider. Trades only go
  down. *Cash out* walks everything down to Snaycoins, one fee per step, then into gems.

## Money and upgrades

Each island has its own money, earned on its levels, its quests and some challenges. Every coin has its
island's mark on its tails side; click the coin in the top bar and it flips to heads (a snake's head in
the island's hat, `coins.js`) with a card about the money (its `tale` in the island file). Esc or a click
anywhere else puts it away and flips it back. **Every run's points pay
too, won or lost**: one coin per `rewards.pointsPerCoin` points (50), with Coil Mastery's bonus, on top of
a win's reward. Even quitting pays for the points you made. Each upgrade tree is paid in
its own island's money, but **every upgrade works on every island**:

| Tree | Island | Upgrades |
|---|---|---|
| The Oak of Basics | 1 | apple value, extra apples, score multiplier, extra hearts, bigger rewards, golden apples |
| The Warding Willow | 2 | armor plates, moving slower, hazard ward, enemy ward, shorter speed effects, spell recharge |
| The Pantry Pear | 3 | gear uses, spell charges, snack charges, loot luck, cheaper merchants, faster restocks |
| The Coral Fig | 4 | boss stamina drain, longer exhaustion, double bites, faster familiars, bigger challenge rewards, better sell prices |
| The Ember Ash | 5 | second wind, survival points, gem finder, runecraft, more of every currency, more armor slots |

**Gems** are the one shared currency: from achievements, quests, challenges and the banks (and, once the game
launches, real money). They buy skins and themes at the Tailor. Some skins and themes are quest prizes
only (`cosmetics.exclusiveSkins` / `exclusiveThemes`).

## Home base

The home stop on every island is its tree. Click it and the map's camera dives at the tree, into a close-up
of the island's home in the map's own pixel style, in the sky at that island's height: the upgrade tree,
as tall and full as its upgrades (a fruit for every tier), your satchel leaning on the trunk with what you
carry peeking out, a golden trophy on a plinth, a standing mirror with your snake in it, an easel painted
with your theme, and your snake curled up by the roots. There are no buttons: point at a thing and it
glows with its name on a little scroll, click it and its page opens on the old screens. The bounty and
your quest are pinned up in the corner.

- the carving on the trunk (it turns gold when you can afford an upgrade): the island's upgrade tree, one
  trunk from the roots to the crown with a bough out to every upgrade and a canopy that fills out tier
  by tier
- the satchel: the Satchel (Kit to carry, Loot, Wardrobe)
- the trophy: the Trophy Hall (the campaign's achievements and their gem rewards)
- the mirror and the easel: the Tailor (skins and themes for gems)

## The title screen

Since build 51 the board wears your theme, with your numbers, the wanted posters and island stickers
around it (below). The drifting world of build 49 (`title-scene.js`) is still in the code, switched off.

## Pictures

Every small picture is a PNG in `textures/`, one pixel per game pixel (how to repaint one, and every
folder: `textures/README.md`). `textures/index.json` maps the ids the game asks for to files:
`ci:<item>` (items, junk, trinkets and parts), `ci:<rune>:<condition>` (eight per rune),
`cu:<icon>` (upgrades), `foe:<type>`, `board:<piece>`, `relic:<item>`, `heart:<slot>`, `boss:<island>`,
`pin:<stop>`, `sticker:<island>`, `cursor:<name>`, and plain names for pictures content files ask for
(`icon =`, `picture =`). `src/engine/content/textures.js` loads them all before any script runs (a missing
one is a pink checkerboard and a console warning); `src/engine/render/pixel-icons.js` draws them flat on
the board and in the painted scenes (`texCanvas`, `texUrl`) and lit from the top left in menus
(`iconUrl`). A new item needs its PNG and its line in the index, nothing in the code. The picture rooms,
the shops and workshops, the shopkeepers and home base are scenes in `textures/scenes/`, and the coins and
the menus' frames are color-swap pictures in `textures/coins/` and `textures/ui/` (`src/engine/render/scene-art.js`
draws their layers, sprite sheets, lights and color-swap pictures). The map's islands are pictures
in `textures/map/` (the paths are drawn live; the signposts, lantern posts and stops are pictures placed live), and the story book's pages are a sky and
layers in `textures/scenes/story/` with what moves drawn live between them. The board is drawn 20 pixels to a
square (`texBoard`): the bosses' crests, the familiars, the old engine's hazards and power-ups, the items, the
snake's squares (color-swapped with each skin's colors) and the pattern themes' backdrops are pictures in
`textures/board/`, `textures/familiars/` and `textures/themes/`, and so is the flair (`textures/board/flair/`).
Still drawn by code on purpose: smooth gradients and glows, particles, and things that turn or stretch.

## Build 51

### Gear, spells and the rest

Gear and spells last for good. Gear absorbs `armory.baseUses` (1) hit a level, plus one for each **part**
fitted and one for a **trinket**; uncommon gear comes from the merchant with one part fitted, rare and
legendary with both (`armory.builtIn`). Spells get their charges back every level; their **level** (0-10)
adds `powerPerLevel`% power and a charge at `chargeAt`, a **seal** adds more and locks the level. A familiar's
**training** (0-3) makes it `better`% better. A rune's condition is 0-7 (`grade`, -1 means from its rarity):
broken, refurbished, cracked, repaired, fine, polished, pristine, legendary; the forged in-betweens are
`lower`% under the condition they copy, legendary `legendBoost`% past pristine (`runeStatAt`). Snacks and
canisters are still used up; a **fresh** snack (from the kitchen) has `freshCharges` more. A trinket's perk
uses the rune stat table (`runeVal` adds the worn gear's trinket), plus four stats of its own: thiefGuard,
stingGuard, coldWard, heatWard.

**Junk** (items.json `loot`) has a grade, common, uncommon or rare (`lootGrades` weights how often each turns
up), and sells for more the rarer it is. It's what trinkets and parts are made of.

### The shops and their workshops

A merchant's screen is a picture (320 x 100): the shop on the right with a shelf of five spots, three
stocked (`spot` in the stock; a five-item family gives each its own spot, the kitchen keeps one for a recipe),
and the workshop on the left. The sign on the counter pans across; the keeper slithers after you. Every timed
job is an **order** (`camp.orders`: kind craft, seal, cook, train or forge, ready at `readyAt`), three per
workshop. A seal or training takes the item away until it's collected (`itemAway`). Ready orders show as a
blurb over the merchant's stall and a note on the map, and over the workshop sign in the shop.

### Foes

New entities in `ENTITY_TYPES` (camp-foes.js), all 12 x 12 pictures (`textures/foes/`, `hazards/`, `powerups/`). Each island swaps or adds its own
(`ISLAND_FOES`): bees for wasps on the Keep, imps and acid on the Spire, embers for fire and moles in the
Hollow, crabs and frost on the Reef, yellow jackets, wisps and lava on the Crown. Thieves steal
`steal x (1 + 0.35 per island above the first)` points from your body (`campSteal`; the old share-of-score
losses are flat amounts too). The **zones** in rules.json (`edge`, `shop`, `trap`, `mountain`) add sinkholes,
popsicles, traps and lightning (more every level up the mountain) to those levels on every island, drawn on
the map as cracks, frost, snares and storm clouds (`drawZoneCues`). `POWER_FOR` adds a power-up wherever the
trouble it answers turns up. The rival snake (`campRival`) comes on a timer in any level that isn't a boss,
an endless road or a maze.

### The title screen

The theme's board and backdrop, with camp-title.js laying the numbers, posters and stickers out around the
board: wide (plates either side), compact (everything shrunk to the room there is) or narrow (strips above
and below). `camp.pins[island]` holds quest pin ids for the posters (`campPin`, `campUnpin`).

### The story

Nothing tells it during play. Each island's `story` entry (arrive, boss1-3) gives a page its title and words;
while the words are empty the page says it's coming. Seen pages are in `camp.storySeen`.

### The terminal

Shift+Alt+C, or tap the build number in Settings five times. The first time, it marks the campaign save as
cheated for good. `help`, `help item`, tab completion and history work as before. A few to start with:
`item sword.give legendary parts trinket=t_rivet`, `item fireball.give rare lv=10 seal`,
`item plenty.give polished`, `attribute money.set 5000 all`, `level reef.unlock all`, `dev run.play crown 15 hold`,
`dev spawn.rival`, `dev orders.finish`, `upgrade tree.max all`, `data list.junk`.
`dev everything.unlock` makes a save 100% (every level won flawlessly with its challenge, every tree, achievement,
recipe, skin and theme). `dev everything.reset` wipes the whole game back to a brand new save once you type
CONFIRM on the next line: every bent rule goes back to normal, the cheated marker is cleared, and the terminal
closes (settings are kept).

## Decided, and not done yet

- From the earlier plan, kept as a checklist: one commit per task; satchel roles (carried, cast, passive,
  loot to sell); the bank's cash-out to gems.
- Not done yet, on purpose: a seeded RNG in bug reports, save versioning beyond `v: 1`, headless tests, real-money gems.
