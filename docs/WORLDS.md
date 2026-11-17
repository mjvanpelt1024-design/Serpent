# Worlds: the save files

A **world** is one save. Each one is a `.world` file in `%APPDATA%\SerpentGame\worlds`, named after its
save key (`w` plus 16 hex digits, e.g. `w0c445a815cafb8ca.world`). The saves window lists them, makes
new ones, renames them, gives them a picture and mods, and starts the game on one; the game holds its
save in memory and asks the launcher to write the file back.

## Two windows, one program

| Run as | Window |
|---|---|
| `SerpentGame.exe` | **Serpent Saves**: the list of worlds. At the bottom, **Quit** and **New**; once a save is picked, **Cancel**, **Edit** and **Play** |
| `SerpentGame.exe --world <key>` | the game, on that world. **Play** starts it, in a window of its own |

Several games can be open at once, one per world. Two windows never share a world (a second open of
the same save says so and does nothing), so a save is never written by two games at once.

## The file

Plain JSON, UTF-8:

```json
{
  "format": "snakegame-world",
  "version": 1,
  "id": "w0c445a815cafb8ca",
  "title": "Test run",
  "created": 1794069901249,
  "saved": 1794070139434,
  "icon": "crown",
  "mods": ["content/wandering-smith", "cosmetic/dev-stats"],
  "data": {
    "snakeMeta_v1": "{\"snakebucks\":7, ...}",
    "snakeProfile_1": "{ ... }",
    "snakeActive_v1": "1",
    "snakeCampaign_v1": "{ ... }"
  }
}
```

- `id` is the save key: letters, digits, `-` and `_` only (it is the file name). A file's `id` must match
  its name.
- `title` is what the saves window shows. `created` and `saved` are milliseconds since 1970. A new save
  has `saved` 0 until the game first writes it.
- `icon` is the save's picture in the saves window: an avatar's id from `content/avatars` (any of them,
  bought or not; it's only the save's picture). A save without one shows its active profile's avatar.
- `mods` are the mods this save plays with, as folders inside the mods folder (`content/<name>`,
  `cosmetic/<name>`, or a plain `<name>` for a mod from before the two folders), content ones first.
  Content mods are chosen when the save is made and never change after; cosmetic ones come and go
  (docs/MODDING.md). A save without `mods` (made before saves had them) plays with none. The game writes
  `icon` and `mods` back as they came; only the saves window changes them.
- `data` holds the game's own keys, **exactly the keys the game has always used** (`snakeMeta_v1`,
  `snakeActive_v1`, `snakeProfile_<n>`, `snakeCampaign_v1`, ...), with the values as text, the same
  strings the game stored in the browser before. The game's save code didn't change its key names or
  its formats; only where they live.
- A new save has `"data": {}`: the game starts it fresh (no progress, 0 Snakebucks).

The file is written whole, to a `.tmp` file first and then moved over the old one, so a crash can't
leave a half-written save. A file that can't be read is left alone: the saves window counts it and
doesn't list it, and the game never writes to a file it couldn't read.

## Where the save key lives in the code

| Before | Now |
|---|---|
| `src/engine/core/storage.js`: `store` is `localStorage`, or a memory stand-in if the browser blocks it | Inside a world, `store` is a memory map loaded from the `.world` file (`worldStore`). Outside one (opening `index.html` in a browser), it is still `localStorage`. |
| Every save and campaign read/write goes through `store` (`profiles-storage.js`, `save-data.js`, `camp-save.js`, `backups.js`, ...) | Unchanged. None of them touched `localStorage` directly. |
| `SAVE_KEY`, `META_KEY`, `ACTIVE_KEY`, `profileKey(n)`, `CAMP_KEY` | Unchanged. They are the keys inside `data`. |
| One save in the browser's storage, under `%APPDATA%\SerpentGame\WebView2` | Each world is its own file. The old browser storage is no longer read by the game. |

**Migration.** The first time the saves window opens and there are no worlds, it copies the old save
(every `snake*` key in the browser's storage, skipping `_rescue_` copies) into a new world titled
**Your saved game**. It does this once (the flag `snakeWorldsImported_v1`). The old keys stay where they
were, untouched, as a backup.

## The saves window

- **Nothing picked:** **Quit** and **New** at the bottom.
- **A save picked** (click it, or the arrow keys): **Cancel** (or Esc) lets go of it, **Edit** (or E) opens
  it, **Play** (or Enter, or a double-click) starts it.
- **Edit:** the save's **name** (no two saves share one), its **picture** (arrow keys move through them),
  and **Choose mods…**: every installed mod, content and cosmetic, with what it says about itself. On a
  save that already exists, content mods are shown but locked. **Save** keeps the changes, **Play** keeps
  them and starts the game, **Delete** is here too. **Open mods folder** shows the folder in Explorer.
- **New** opens the same view for a save that doesn't exist yet: name it, pick its picture and its mods
  (this is the only time content mods can be chosen), then **Create** or **Play**.
- A save that's open in a game can't be changed or deleted: the saves window says to close that game
  first. A save whose content mod isn't installed any more says so in the list, and plays without it.

## Deleting a save

Pick it, press **Edit**, then **Delete** (or pick it and press the Delete key). A dialog names the save, its
Snakebucks and when it was last played, and asks again; **Cancel** has the focus, so Enter alone never
deletes. The file goes to the Windows Recycle Bin, so it can be restored from there (put it back in the
`worlds` folder). A save that is open in a game window can't be deleted: close that game first.

## When the game saves

- **On a timer**: once a minute, if anything changed since the last write.
- **On close**: when the window closes (the Quit button, the close box, or the window being closed by
  Windows), the game writes its save first. If it can't answer within two seconds, the window closes
  anyway, with the save as of the last timer write.
- The game's own **Back up your progress** (Settings) is unchanged; it still makes a save code from the
  current save.

## The messages between the windows

Pages talk to the launcher with `window.chrome.webview.postMessage`:

| From | Message | Does |
|---|---|---|
| saves window | `worlds:list` | asks for every readable world |
| saves window | `world:write:<key>:<json>` | writes a world's file |
| saves window | `world:play:<key>` | starts `SerpentGame.exe --world <key>` |
| saves window | `world:delete:<key>` | moves the world's file to the Recycle Bin, unless a game has it open |
| saves window | `mods:list` | asks for every installed mod |
| saves window | `mods:open` | shows the mods folder in Explorer |
| saves window or game | `quit` | closes that window |
| game | `world:write:<key>:<json>` | writes its own world's file (other keys are ignored) |
| game | `world:flushed` | the save is written; the window may close |

The launcher answers `worlds:list` with one `world|<key>|<json>` message per file and then `end|`, and
`mods:list` with one `mod|<path>|<mod.txt>` message per installed mod and then `modsend|`, a saves
window's `world:write` with `written|<key>|ok` or `written|<key>|open` (a game has it open, so nothing
was written), and `world:delete:<key>` with `deleted|<key>|ok`, `deleted|<key>|open` (a game window has that save open, so
nothing was deleted) or `deleted|<key>|failed`.
The launcher only moves the file's text; the saves window and the game read and build the JSON.

The game's first script gets its save as `window.SNAKE_WORLD` (the parsed file). If that can't be
parsed, `window.SNAKE_WORLD_ERROR` says why and the game refuses to write to the file.
