# Build 46 design: twelve new islands, the Nightmare Realm and a new economy

This is the plan for build 46. It explains *why* the numbers are what they are. The numbers themselves live
in `content/economy.txt` and the island folders, so they can still be tuned by hand.

---

## 1. The economy

### The problem with build 45

- Island upgrades multiplied income by up to 5x, so a fully grown early island out-earned a fresh later one.
  Moving on never paid.
- Islands cost a flat 300 XP more each, so the next island was always cheap, however little you had grown.
- Great Tree prices climbed in straight lines while income grew without limit, so late in the game
  everything cost nothing. Prestige multiplied the core stats by 10 per rank on top of that.
- Badge rewards were a fixed number of XP: a lot at first, nothing later.

### The ladder

Every price is anchored to one number: **what a good run pays on an island**.

```
multiplier(island i)   = worldGrowth ^ i                 (i = 0 for the Garden)
goodRun(island i)      = runXp x multiplier(i) x greatBoost(i)
```

- `worldGrowth` (1.5) is how much more each island pays than the one before.
- `runXp` (40) is a good run on the Garden with nothing bought.
- `greatBoost(i)` is how much the Great Tree is *allowed* to boost income by the time you reach island `i`
  (see "Great Tree ceiling" below). Prices assume you've grown the Great Tree as far as it can go.

Because an island's own upgrades are capped at about +50% income, and the next island pays +50% before
any upgrades, **moving on always pays at least as well as staying**. Once the new island's tree starts
growing, it pays clearly more.

### Island trees

- Every island tree has four parts (trunk, two branches, crown) with **10 tiers each**.
- Tier `t` of a part costs `base x tierGrowth^(t-1)` where `tierGrowth` = 1.25 and the part's weight comes
  from `treeNodeCost`.
- `base` is chosen so the **whole tree costs `treeRuns` good runs on that island**: 12 on the Garden,
  rising evenly to 24 on the Maw, so the first islands go quickly.
- The parts above the trunk still grow once the trunk (or both branches) reach `treeGate` tiers.

### Unlocking the next island

Two conditions, both shown on the map:

1. **The previous island's tree is at least `unlockTreeShare` (75%) grown** (tiers owned / all tiers).
   This is a hard rule, so no amount of grinding skips a tree.
2. **XP:** `unlockRuns` good runs on the previous island: 3 after the Garden, rising evenly to 6.

### Great Tree ceiling

The Great Tree is bought with Snakebucks. Each part's tiers open up as you unlock islands:

```
tiers you may own = ceil(maxTiers x islandsUnlocked / islandCount)
```

So the Great Tree can never run ahead of the islands, and `greatBoost(i)` is known exactly. The core
parts now grow geometrically, so every tier is worth about the same step:

| Part | Tier 0 | Tier 20 |
|---|---|---|
| Experience Booster | 100 points per XP | 25 points per XP (x4 XP) |
| Score Boost | x1 | x2 |
| Apple-er Apples | x1 | x2 |

### Snakebucks: a steady currency

Snakebucks stay the same size all game. The Exchange's rate follows your income instead:

```
XP per Snakebuck = goodRun(best island you own) / buckPerRun
```

So one good run on your best island always trades for about `buckPerRun` (12) Snakebucks, at any point
in the game. Because of that, everything priced in Snakebucks (the Great Tree, cosmetics, prestige)
can use fixed prices, and badges can pay fixed Snakebucks.

### Badges

Every badge tier pays **both**:

- **Snakebucks:** a fixed amount per tier, `badgeBucks` (1, 2, 4, 8, 15, 25, 40, 60).
- **XP:** `badgeRuns` of a good run on your best island per tier (0.25, 0.5, 1, 1.5, 2, 3, 4, 5),
  so a badge is worth the same effort early and late.

Finishing a whole badge path pays 3x its last tier again.

### One-time items and renaming

Priced as a share of a good run on your best island (`[items]` in `economy.txt`), and each one you buy
raises the next by `itemStep`, up to `itemStepCap` purchases.

### Prestige

Prestige still cuts the Great Tree back for good. Each rank makes the core parts' final value
`prestigeStrength` (2x) stronger instead of 10x, and every price is `1 + rank` times higher. It needs the
whole Great Tree trunk and boughs grown, which means every island unlocked: it's an endgame option that
makes the Nightmare Realm easier, not a way to break the island ladder.

---

## 2. The Nightmare Realm

Nightmares are now their own campaign.

- **The Realm opens once every island is unlocked.** Before that, Nightmares stay hidden.
- Nightmare islands unlock **in the same order** as the islands, each for XP (`nmUnlockRuns` good runs on
  the previous Nightmare), and each needs the previous Nightmare's red upgrade at least
  `nmUnlockTreeShare` grown.
- Inside a Nightmare island, its three Nightmare levels open one after another, like ordinary levels.
- The red upgrade on each island tree opens when that Nightmare island is unlocked, and is priced from
  Nightmare income (`nightmareMultiplier` x a good run).
- **Nightmare-run saves** (the skull profile) are unchanged: that save chose to skip the islands, so its
  island unlocks are Nightmare unlocks, priced from the Nightmare table.

---

## 3. Twenty-two islands

The Garden and the Old Yard stay first and second. Every new island introduces at least one new hazard,
power-up or mechanic.

| # | Island | Folder | New on this island |
|---|---|---|---|
| 1 | Garden | easy | apples, XP |
| 2 | Old Yard | classic | walls |
| 3 | **Sunflower Fields** | sunflower | **Golden Apples** (power-up), **Fever** (mechanic) |
| 4 | Quarry | challenge | rocks |
| 5 | **Bramblewood** | bramble | **Brambles** (hazard), **Shears** (power-up) |
| 6 | Ice Parlor | insane | popsicles |
| 7 | **The Hive** | hive | **Wasps** (hazard), **Armor** (mechanic + power-up) |
| 8 | Orchard | chaos | speed |
| 9 | **Thunder Peaks** | thunder | **Lightning** (hazard), **Bubble Shield** (power-up) |
| 10 | Glass Hall | mirror | mirror edges, fleas |
| 11 | **Frostbite Fjord** | frost | **Ice** (hazard), **Hourglass** (power-up) |
| 12 | Vault | treasure | half-size snake, big things |
| 13 | **Hunting Grounds** | hunt | **The Hunter** (rival snake), **Shed Skin** (mechanic) |
| 14 | Tunnel | endless | scrolling |
| 15 | **Powder Keg** | keg | **Bombs** (hazard), **Rampage Star** (power-up) |
| 16 | Furnace | inferno | fire, inner walls, portals |
| 17 | **Haunted Moor** | moor | **Ghosts** (hazard), **Phantom** (power-up) |
| 18 | Maze | labyrinth | maze, molasses |
| 19 | **Clockwork Citadel** | clockwork | **Spike traps** (hazard), **Bounty Contracts** (mechanic) |
| 20 | **Chrono Rift** | chrono | **Echoes** (mechanic), **Rotten Apples** (hazard) |
| 21 | **Gale Cliffs** | gale | **Gusts** (hazard), **Lodestone** (power-up) |
| 22 | **The Maw** | maw | **Sinkholes** (hazard), **Frenzy Clock** (power-up), the Hunter returns |

Folder names are save ids, so the ten old folders keep their names.

### Hazards (4 before, 15 now)

| Hazard | What it does |
|---|---|
| Rock, popsicle, flea, fire | unchanged |
| Bramble | Thorny bushes that slowly grow into neighbouring squares. Half a heart. |
| Wasp | Flies at your head a square at a time. Half a heart, then it's gone. |
| Lightning | A square flashes a warning, then lightning strikes it. A heart. |
| Ice | You can't turn while sliding on ice. |
| Bomb | Ticks down, then blows up a 3x3 area: a heart if you're in it. Rocks in the blast are cleared. |
| Ghost | Drifts slowly toward you through walls. Half a heart and a third of your score. |
| Spike trap | Spikes rise and fall on a beat. A heart if they're up. |
| Rotten apple | Apples left too long rot. A rotten one shrinks you and costs points. |
| Gust | A gust of wind shoves the whole snake a square sideways. |
| Sinkhole | A crack appears, then opens into a pit that ends the run, then closes again. |
| The Hunter | A rival snake (see below). |

### Power-ups (1 before, 10 now)

| Power-up | What it does |
|---|---|
| Molasses | unchanged (slowing down helps) |
| Golden Apple | 10x the points of an apple, and fills a big slice of Fever |
| Shears | Snips your tail in half, paying points for every segment |
| Armor Plate | One plate of armor (see below) |
| Bubble Shield | The next hit of any kind, even a wall, is shrugged off |
| Hourglass | Freezes every hazard, wasp, ghost and the Hunter for 5 seconds |
| Rampage Star | 5 seconds of smashing through rocks, hazards and the Hunter for points |
| Phantom | 6 seconds of sliding through your own body and rocks |
| Lodestone | Pulls apples and XP toward your head for 8 seconds |
| Frenzy Clock | Double points for 10 seconds |

### The big mechanics

- **Armor.** Grey plates that sit over your hearts. A plate soaks one hit of hazard damage, of any size,
  even a mega pop, and then breaks. Walls and your own tail ignore armor. Plates come from Armor Plate
  power-ups, the Great Tree's Scale Armor, and the Armor Polish item.
- **The Hunter.** A rival snake that hunts your head, eats your apples and grows. If it bites you, you lose a
  heart and it backs off. If it runs into *your* body it's stunned and shrinks; the third time, it dies and
  drops a pile of XP. You can trap it.
- **Fever.** Eating things quickly fills a Fever bar. When it's full, Fever runs for 8 seconds: triple
  points, and touching small hazards destroys them for points instead of hurting you.
- **Shed Skin.** Press **E** (or the touch button) to shed the back half of your tail. The shed skin
  stays as a husk that blocks the Hunter, wasps and ghosts, then crumbles into XP crumbs. It recharges.
- **Echoes.** On the Chrono Rift, your own path from a few seconds ago comes back as a solid Echo that
  retraces your moves exactly. You have to stay out of your own past.
- **Bounty Contracts.** From the Clockwork Citadel on, every run offers a contract ("eat 12 apples",
  "collect 6 XP without getting hurt"...). Finishing it pays XP and Snakebucks.

### New Great Tree parts

| Part | Grows from | Does |
|---|---|---|
| Scale Armor | Extra Hearts | Start every run with armor plates (up to 3) |
| Fever Pitch | Apple-er Apples | Fever fills faster and lasts longer |
| Molting | Score Boost | Shed Skin recharges faster |
| Bounty Hunter | Score Boost | Contracts pay more |
| Lucky Charms | Apple-er Apples | Power-ups turn up more often |

### New one-time items

| Item | Island | Does |
|---|---|---|
| Armor Polish | The Hive | Start one run with two extra armor plates |
| Fever Dream | Sunflower Fields | Start one run with a full Fever bar |
