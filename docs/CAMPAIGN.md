# The campaign (build 47)

Five islands strung along the Coil, fifteen levels each, one boss per island fought three times, and a
shop economy where every island has its own money. This file is the design and the map of where things
live. The numbers themselves are all in `content/campaign/`.

## Where things live

| What | Where |
|---|---|
| Islands, their people, boss, currency and 15 levels | `content/campaign/islands/<id>.json` (order: `islands/_index.dat`) |
| Every item, rarity, price and loot trinket | `content/campaign/items.json` |
| The five upgrade trees | `content/campaign/upgrades.json` |
| Rewards, timers, the bank, challenges, achievements, cosmetics | `content/campaign/rules.json` |
| The signatures of all of the above | `content/campaign/manifest.dat` (made by a tool, never by hand) |
| The code | `src/campaign/*.js` (loaded just before `game/start.js`) |

After changing any campaign file:

```
python tools/check-campaign.py     # catches mistakes: unknown layouts, bad spawns, wrong-length price lists...
python tools/sign-content.py       # re-signs the data so saves aren't marked modded
```

## The save and its validator

There is one save (`snakeCampaign_v1` in the launcher's storage). Play loads it; there is nothing to pick.

- **Signed.** Every write stores the save's text with a signature (`src/campaign/integrity.js`). If the text
  is edited outside the game, the signature stops matching: the edited copy is kept aside, and the last copy
  the game signed itself is loaded, with a message saying so.
- **Checked.** Every load runs the save through `SAVE_SCHEMA`: numbers are clamped to their ranges, unknown
  fields are dropped, items that don't exist are removed, upgrade tiers can't pass their tree's top. To add
  something to the save, add it to `SAVE_SCHEMA`; that's the only place.
- **Data files.** At startup the campaign's data is checked against `manifest.dat`. Edited data still runs,
  but the save is marked *modded* for good (shown in the save menu).
- This is tamper-evident, not tamper-proof: the key is in the game's files. It stops casual editing.
  Console changes will go through the game, so they'll be signed properly and set the save's cheat flag
  (the console is the next pass).
- Backups: the map's **Save** button (or Settings > Your save) copies a signed `COIL1-` code, loads one, or
  starts over (the old save is kept aside, not deleted).

The old profile save still exists underneath for settings and the engine's own stats. Nothing of the
campaign lives in it.

## The map

One screen. Five floating islands climb from the sunrise at the bottom of the sky to the stars at the top,
strung together by the Coil, the giant serpent from the old story. Your snake travels the map itself: click
a spot and it slithers there along the paths and plank bridges; ride the Coil and it carries you up to the
next island while the camera follows. The Coil is green and gold where it's awake, glows with golden
cracks on the stretch ahead of you, and is grey stone beyond. Islands you haven't reached sit in clouds.

Every island uses the same layout:

```
                     bridge islet (the Coil leaves for the next island)
 challenger islet   11 12 13 14 BOSS 15 - bank islet
                    BOSS 10  9  8  7  6
                     1  2  3  4 BOSS 5 - merchant islet
                     home islet (the Coil arrives here)
```

- **Home** is the islet where the Coil arrives, with the island's tree on it. The tree starts as a sapling
  and grows as you buy that island's upgrades: a taller trunk, wider branches and canopy, and one fruit for
  every tier bought; fully grown, it sparkles. Click home and the camera moves in close. Click the tree for
  the upgrade trees (every open island's tree can be bought from any home). Keepsakes gather under the
  tree only once you have something for them: the satchel (once you carry an item), the trophy (your first
  achievement), the mirror (a second skin, or gems enough for one) and the easel (likewise for themes).
- **Levels 1-4** are fixed boards (no scrolling, no mazes). **6-9** are fixed boards with enemies (fleas,
  bees, ghosts, rival snakes). **11-14** move: the endless road (`tunnel`), the endless maze (`maze`), the
  endless hall of mirrored walls cascading out from the middle (`field`), and walls that rise and fall on a
  beat (`pulse`).
- Each level must be won to open the next, so every boss stands between you and what's past it.

| # | Island | Theme | Currency | Merchant sells | Boss (hearts / armor) |
|---|---|---|---|---|---|
| 1 | Brightscale Keep | medieval | Snaycoins | Gear | Grimscale the Black Knight (3 / 1) |
| 2 | Arcanum Spire | wizardry | Slithers | Spells | Hexfang the Archmage (3 / 3) |
| 3 | Feastwood Hollow | harvest | Scales | Snacks | Gorgemaw the Glutton (5 / 3) |
| 4 | Tidecoil Reef | ocean | Pearls | Familiars | Leviathorn (5 / 5) |
| 5 | Cinder Crown | volcano | Orobucks | Runes | Pyrrhus the Cinder Wyrm (7 / 5) |

### Ways to win (a level's `goal`)

`apples`, `score`, `length`, `survive` (seconds), `distance` (meters, tunnel only), `keys` (find N, then
the gate that appears), `buttons` (press N plates, optionally `"ordered": true`, then touch the seal),
`relic` (one hidden object: crown, grimoire, ladle, pearl, eye), `shards` (gather N), `thief` (a critter
that runs from you; corner it N times), `boss`.

A pointer in the right-hand rail always shows the way to the nearest thing the goal wants.

### Bosses

One boss per island, three fights. Its numbers are in the island file (`boss`).

1. **Level 5: outlast it.** It hunts you, charges now and then, and its stamina drains the whole time.
   At zero it gives up. You can't hurt it yet; a bite costs you a heart.
2. **Level 10: break its armor.** Stamina drains faster. At zero it's exhausted: slow, sleepy, and open.
   Bite its body to knock off a silver heart. Its stamina refills while it rests, then it's back to it.
   A sword cracks armor even while it's fresh; a fireball does too.
3. **Level 15: finish it.** No armor, full stamina. Exhaust it, bite its red hearts to zero.

The Coral tree's upgrades (wear it down faster, longer naps, double bites) and the Rune of Fury are built
for these fights.

## Items

Four rarities: Common, Uncommon, Rare, Legendary. Five kinds, one slot each ("a snake has no hands"):

| Slot | Island | Behaves | The five |
|---|---|---|---|
| Gear | 1 | worn; uses wear out, then it breaks and is gone | Kite Shield, Arming Sword, Bulwark Helm, Ember Cloak, Thorn Mail |
| Spell | 2 | Space casts; charges run out, then it's gone | Force Field, Fireball, Blink, Frost Nova, Apple Call |
| Snack | 3 | fires by itself when needed; charges run out | Hearty Stew, Honey Bread, Tinker's Pie, Spice Jerky, Phoenix Tart |
| Familiar | 4 | follows you into every level; never wears out | Lantern Firefly, Snip the Crab, Shellby the Turtle, Puff the Pufferfish, Sir Seahorse |
| Rune | 5 | burns up when a level starts and changes that level | Plenty, Stillness, Fortune, Fury, Echoes |

Every item has a strength and a weakness on purpose, written on its card: the shield shoves a bee aside but
the bee comes back, and it does nothing for walls or fire; the sword kills anything alive but snaps on a
rock; the helm saves you from walls and nothing else; the cloak takes fire, lightning and blasts but not a
rock; thorn mail guards your body, not your face. Legendaries add a perk (the legendary shield ignores
rocks, the legendary sword survives hazards, and so on).

Loot trinkets turn up during levels: sell them to any merchant, or keep them.

## Shops

- **Merchant** (after the first boss): three offers, three different items from the island's kind, each a
  random rarity (weighted: Common 55, Uncommon 28, Rare 13, Legendary 4), one of them on sale. New stock
  every 2 hours, or now for gems. Buys anything back for a share of its price, paid in the currency of the
  island it came from.
- **Challenger** (after the second boss): picks three of the island's levels you've won (never a boss) and
  adds two twists to each (faster, a bigger goal, a swarm, one heart, darkness, no items, a 90 second clock,
  rockslides). Once accepted it stays until it's done or its week runs out (`challenge.days` = 7). Finishing
  pays the island's currency plus one weighted roll from `challenge.pool`: gems, a rare or legendary item, or
  an exclusive skin or theme. A finished challenge waits out its week before the next.
- **Banker** (after the third boss): trades this island's money down to the previous island's (10 to 1,
  minus a flat 5 of the previous currency per trade) or into gems (500 Snaycoins' worth per gem, 1 gem fee).
  Trades only go down, never up. *Cash out* walks everything from this island down to Snaycoins, one fee per
  step, then into gems.

## Money

Each island has its own currency, earned by winning that island's levels (the first win pays more, a
flawless win pays a quarter extra) and from its challenges. Each upgrade tree is paid in its own island's
currency, but **every upgrade works on every island**:

| Tree | Island | Upgrades |
|---|---|---|
| The Oak of Basics | 1 | apple value, extra apples, score multiplier, extra hearts, bigger rewards, golden apples |
| The Warding Willow | 2 | armor plates, moving slower, hazard ward, enemy ward, shorter speed effects, spell recharge |
| The Pantry Pear | 3 | gear uses, spell charges, snack charges, loot luck, cheaper merchants, faster restocks |
| The Coral Fig | 4 | boss stamina drain, longer exhaustion, double bites, faster familiars, bigger challenge rewards, better sell prices |
| The Ember Ash | 5 | second wind, survival points, gem finder, runecraft, more of every currency, more armor slots |

**Gems** are the one shared currency: from achievements, challenges and the bank (and, once the game
launches, real money). They buy skins and themes. Some skins and themes are challenge-only and can't be
bought (`cosmetics.exclusiveSkins` / `exclusiveThemes`).

## The HUD

Nothing is drawn on the board during a level. The left rail has where you are, the goal and its progress,
the score, hearts and armor, and the boss's hearts and stamina. The right rail has your gear, spell, snack,
familiar and rune, active effects, the pointer, and loot found. On a tall narrow screen the rails sit above
and below the board instead.

## The reference plan, and what was decided

The earlier plan (from a Haiku session) was kept as a checklist. Where it and the brief disagreed, the
brief won:

- Upgrades are **global**, each tree paid in its own island's currency (the plan had them per island).
- Branches follow the brief: merchant after boss 1, challenger after boss 2, bank and bridge after boss 3.
- The bank fee is a flat **5** of the previous island's currency (the plan said 2).
- Open questions, answered: every level needs the one before it (so every boss gates what follows);
  reverse conversion is not allowed; the cash-out fee is the same per step; the challenger can't be visited
  before boss 2; the reward pool weights are in `rules.json` (`challenge.pool`).
- Not done yet, on purpose: the console's campaign commands and cheat flag (the save already has
  `flags.cheats`), Steam achievements, real-money gems, a seeded RNG stored in bug reports, headless tests.
  The Pluralus three-headed skeleton reward is a natural fit for the challenge pool once there's art for it.
