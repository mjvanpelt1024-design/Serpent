# Physics rules

How the snake moves, what happens when its head lands somewhere, and how things pushed by the
wind or the board interact with it. New features should build on these rules, not around them.
The code lives in `src/game/flow/`:

- `item-effects.js`: `stepSnake` (the normal step) and `resolveContact` (what a head meets)
- `entities.js`: hazard entities, `landingCell` and `blowSnake` (gusts)
- `game-flow.js`: the board's edge modes, the Endless camera

## 1. The board's edge modes

`edgeMode` says what happens past the edge. Every mode goes through the same step (section 2).

| Mode | Past the edge | Notes |
|---|---|---|
| `wall` | Dead | Also the wall for red panels |
| `wrap` | Comes out the other side | The board is a loop |
| `mirror` | Exits a random wall (`pickMirrorExit`) unless the Compass roll wraps it | Counts as a wrap for gusts |
| `maze` | Wraps on the labyrinth's own grid (`wrapW`) | Not the board's 20-cell wrap |
| `endless` | Never wraps. The Endless road has walls (`endlessRows`); `x` runs on forever | Falling behind the camera ends the run |
| `tutorial` | The red side kills, the other side mirrors | Tutorial only |

Coordinates are pixels, a cell is `cell` pixels. Endless uses world coordinates, so its `x` is not
bounded by the board.

## 2. The normal step (`stepSnake`)

1. The turn queue is read. On ice the snake keeps sliding: turns wait until it is off the ice or the
   Crampons grip.
2. Panels are checked first: a red panel crossing kills; a purple panel warps to its exit.
3. The edge mode is applied (section 1). Endless walls and the camera kill.
4. Purple walls are portals, red walls kill, unless invincible or the step is in grace.
5. The head moves; the segment is pushed to the front of the body and the tail drops off.
6. `resolveContact` runs on the new head square (section 3).
7. `stepEchoes`, then the spawns: `spawnEndlessItems` on Endless, `maintainApples` elsewhere.

## 3. What a head meets (`resolveContact`)

In this order, and the first thing that ends the step ends the rest:

1. Apples: a fake one is a boulder (a rock hit), a rotten one is `eatRotten`, a real one is eaten.
   In Endless the apple may have moved the camera, so the head's position is re-read.
2. Orbs, rocks (Phantoms pass through), relics, shimmers.
3. Popsicles (a bonus apple is eaten, a death popsicle hits unless in grace).
4. Hazards on the square (`hitHazard`), then `touchEntities` (every non-global entity on the square;
   a hazard may be smashed by Fever or a Star).
5. The Hunter (`hunterTouchedBy`), unless in grace.
6. Self-collision: the head on a body segment ends the run (Phantoms pass through their own body).
7. Echoes (`stepEchoes`) run only in a normal step.

A function that returns `true` from `resolveContact` means the step is over: the game ended or the
snake was sent elsewhere. Callers must not do more to the snake after `true`.

**Grace** (`graceUntil`) is the short window after a restart or revive: hazards are not touched, but
apples and pickups still are.

## 4. Gusts (`blowSnake`)

A gust is a global hazard that waits (`GUST_WARN` ms, the arrows show the direction), then pushes the
whole snake one square.

- The snake moves as one body. The blow is refused (with a rock sound) if **any** segment would land:
  off the board (after the edge mode's rules), in a wall, or on a rock. A gust never moves part of the
  snake through an obstacle.
- Each segment is mapped by `landingCell`, which uses the same edge rules as steps: a wall edge stops
  it, Endless stops at its walls and never wraps, the labyrinth wraps on its grid, wrap and mirror
  boards are loops.
- The Windbreak roll (`windbreak` track value, `nm_gale`) can cancel the gust.
- After a successful blow the head goes through `resolveContact`, so a gust can eat an apple, hit a
  hazard or a hunter, or end the run in a self-collision. Before this change a gust ignored everything
  except walls and rocks.
- The Updraft bonus pays per successful blow. `runCount("gusts")` counts successful blows only.
- Freezing (Hourglass) pushes `blowAt` back with the other hazard clocks (`freezeHazards`).

## 5. Things that move the snake's body but are not steps

Any code that moves segments must (a) keep `snake.x/y` equal to `snake.cells[0]`, (b) set
`endless.prev` / `maze.prev` before moving so the renderer can glide each segment, and (c) go through
`resolveContact` for the new head. `blowSnake` does all three. Teleports (portals, mirror exits) use
their own code in `stepSnake` and are not covered by this section.

## 6. Timing

- The step interval is `moveInterval = 1000 / (speed * save.dev.speedMult)`. Speed is reduced by
  Classic/Steady (and by the Wind challenge mode, see `game-flow.js`) and by Chaos brake.
- Hazard clocks are absolute timestamps (`expiresAt`, `blowAt`, `strikeAt`, `openAt`, ...). Anything
  that pauses hazards must push all of them (`freezeHazards` lists them). Add a new clock to that list.

## 7. The scroller (the endless road)

The Endless road is the `tunnel` layout with `edge: "endless"`. It is no longer on any island's
path: level 11 is a comb board on all five islands (`content/campaign/islands/*.json`), and
`tools/check-campaign.py` requires level 11 to be static.

The code is still here (`layout: "tunnel"` in `camp-levels.js`, `ENDLESS` and the camera in
`game-flow.js`, the `distance` goal, the `road` achievement in `content/campaign/rules.json`). It is
only unreachable from the path.

**Hook for a bonus or daily entry:** `campBeginLevel(isl, n)` only starts levels that are on an
island's path. To bring the road back, give it its own entry: a level definition with
`layout: "tunnel"`, `edge: "endless"`, and a launch function that calls `campRun`'s start code with it.
Nothing does this yet. The `distance`-based road achievement will then need the bonus entry to count.

## 8. Status

Checked: `node --check` on the changed scripts, and `tools/check-campaign.py` on the content. Not yet
checked in a running game: the gust behaviour at the edges, on Endless and in the labyrinth.
