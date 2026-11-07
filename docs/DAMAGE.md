# Damage types, resistance and the naming scheme

The rules live in `src/game/damage/damage.js`, with tests in `tools/tests/damage.test.js`
(run `node --test tools/tests/damage.test.js`). Enemies, bosses, hazards, items, trinkets and the
player all use these same rules.

## The six tags

| Tag | Group | Broad word | Narrow word |
|---|---|---|---|
| `piercing` | physical | Piercing | Barb |
| `slashing` | physical | Slashing | Edge |
| `fire` | elemental | Fire | Ember |
| `ice` | elemental | Ice | Rime |
| `electricity` | elemental | Electric | Spark |
| `venom` | elemental | Venom | Toxin |

The group is for display only; the rules treat all six the same.

## The naming scheme

Every tag has two words, and each word can be paired with one of three kinds:
**Resistance**, **Weakness**, **Immunity**. That gives 6 × 3 × 2 = 36 stats, each with its own name.

- **Broad stat**: covers every hit with that tag. `fire.resistance` is **Fire Resistance**.
- **Narrow stat**: covers only hits from one family of sources, flagged with `family`. `ember.resistance`
  is **Ember Resistance**, and it only applies to a hit whose `family` is `ember`.

A broad stat and a narrow stat are different stats. A trinket line can give one, the other, or both.
If it gives both, they add up for a hit that matches both (see the tests).

Stat ids are lowercase and dotted: `<word>.<kind>`, where `<word>` is the broad word for a tag
(`fire`) or the narrow word for a family (`ember`). Use the id in content (`grants`), and
`damageStatName(id)` for the name shown to players.

| Kind | Broad id example | Narrow id example | Points |
|---|---|---|---|
| Resistance | `fire.resistance` | `ember.resistance` | % taken off, capped at 90 |
| Weakness | `ice.weakness` | `rime.weakness` | % added on, capped at 200 |
| Immunity | `venom.immunity` | `toxin.immunity` | any amount above 0 blocks the tag |

Words are unique across tags, so a narrow word always identifies its tag.

## The rules

For each tag of a hit, against a target:

1. **Immunity** (broad, or narrow when the family matches) above 0: that tag does 0.
2. Otherwise: `multiplier = (1 - resistance/100) × (1 + weakness/100)`. Broad and narrow stats add up.
3. A hit with several tags multiplies the tags' multipliers together. One immune tag blocks the whole hit.

A **target** is a flat record of stat id → points. An enemy's static lines become points:

| Enemy line | Becomes |
|---|---|
| `immune = [venom]` | `venom.immunity` = 1 |
| `resist = [piercing]` | `piercing.resistance` = 50 |
| `weak = [electricity]` | `electricity.weakness` = 50 |

The player's own stats are added in the same record, so a trinket's resistance stacks with an enemy's.
Listing the same tag under two of `immune`, `resist` and `weak` is a content error.

## Fields for items, trinkets and hazards

These fields are checked by `checkDamageSpec`. Since build 52 the campaign uses them (see "Where the content
uses them" below).

| Field | On | Meaning |
|---|---|---|
| `tags` | hazards, items, weapons | the damage tags of a hit |
| `family` | hazards, items, weapons | optional narrow word, e.g. `ember` |
| `immune`, `resist`, `weak` | enemies, bosses, hazards | static rules, lists of tags |
| `grants` | trinkets | list of `{ stat, amount }`, e.g. `{ stat: "ember.resistance", amount: 5 }` |

## Adding a word or a tag

Words and tags are in `DAMAGE_TAGS` and `DAMAGE_NAMES` in `damage.js`. Change them there, then update
the table above and the tests (the tests check for 36 stats and unique names).

## Where the content uses them (build 52)

| What | Where | Fields |
|---|---|---|
| Hazard and enemy hits | `content/campaign/foes.json` `hits`, and each new enemy's `hit` | `tags`, `family` |
| How enemies take weapons and spells | `foes.json` `rules` (old enemies), each new enemy | `immune`, `resist`, `weak` |
| How bosses and champions take them | `foes.json` `bosses.<island>.rules`, `champions[].rules` | `immune`, `resist`, `weak` |
| Weapons and spells | `content/campaign/items.json`, `hit` on the item | `tags`, `family` |
| Armor, weapons, familiars | `items.json` `stats` (rarity sets how many count) | stat ids as `grants` |
| Trinkets | `content/campaign/crafting.json`, `major` and `minor` | stat ids |
| Runes | `items.json` `good` and `bad` | stat ids |
| Power-ups and Flame Shroud | `foes.json` `powerups[].grants`, `items.json` `grants` | `grants` |

The campaign adds one more kind of stat beside these 36: **spell stats**, `<word>.spells` with the same twelve
words ("Fire Spells", "Ember Spells"), plus `spellPower` and `spellCharges`. They make spells stronger and live in
`src/campaign/camp-arsenal.js`, not in `damage.js`.

**Trinket names.** A trinket gives two stats, a major one and then a minor one. One made of two damage (or spell)
stats is named after them in that order: its first name is its major stat's word and its second name its minor
stat's, so a *Fire Ember Locket* (Fire Resistance, then Ember Resistance) and an *Ember Fire Locket* (Ember
Resistance, then Fire Resistance) are different trinkets. `tools/check-campaign.py` and
`tools/tests/arsenal.test.js` hold the content to this.

**In play** (`camp-arsenal.js`): your worn pieces' stat lines, their trinkets, the set bonus, your familiar's
lines, your rune and any power-up you picked up add up into one target; `takeHit` resolves each hit's tags
against it. Damage comes in halves, so what resistance takes off (or weakness adds on) carries over between hits.

