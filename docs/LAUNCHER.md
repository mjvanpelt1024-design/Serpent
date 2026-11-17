# The launcher

`SerpentGame.exe` is a small C++ program that opens its windows using **WebView2**: the
Microsoft Edge engine that ships with Windows 11 and with Windows 10 through Windows Update. The game
itself stays HTML, CSS and JavaScript; the launcher is its home on the desktop (and, later, on Steam).

It has two windows. Run with no arguments, it shows **Serpent Saves**: the list of saves, with **Quit** and
**New**; pick a save and it's **Cancel**, **Edit** and **Play**. **Edit** renames a save and changes its
picture and its mods; **New** opens the same view for a new save. **Play** starts the game in a window
of its own, on that save (`SerpentGame.exe --world <key>`).
The saves themselves are described in [`WORLDS.md`](WORLDS.md).

## Building it

The game ships with a ready-made `SerpentGame.exe`. You only need to build it again after changing the
launcher's own code (`launcher\src\main.cpp`). There are three ways.

**`launcher\build-msvc.cmd`**, the quickest if Visual Studio (any edition with C++) is installed: run it
from a command prompt or by double-clicking. It finds Visual Studio's compiler on its own, uses the
open-source WebView2 loader in `launcher\third_party` (so nothing is downloaded), and puts
`SerpentGame.exe` in the game folder. The current `SerpentGame.exe` was built this way.

**Visual Studio 2022** (with the *Desktop development with C++* workload):

1. Open `launcher\SerpentGame.sln`.
2. Pick **Release** and **x64** in the toolbar.
3. **Build > Build Solution** (Ctrl+Shift+B).

The first build downloads the WebView2 SDK package (NuGet). If Visual Studio says the package is
missing, right-click the solution > **Restore NuGet Packages**, then build again. The new `SerpentGame.exe`
replaces the old one in the game folder. **Debug builds** go to `launcher\build\Debug\` and find the
game folder on their own; press F5 in Visual Studio to run one under the debugger.

**MinGW (clang)**, with no Visual Studio: `launcher\mingw\build.sh` builds it with
[llvm-mingw](https://github.com/mstorsjo/llvm-mingw), using the open-source WebView2 loader in
`launcher\third_party\OpenWebView2Loader` (ISC license).

Either way the `.exe` has everything built in: it's the only file the launcher needs.

## What it does

| | |
|---|---|
| Serves the game | the game folder is `https://game.serpentgame.example/` inside the window, so the game reads `content/` straight from disk, never cached, so F5 shows every edit |
| Serves mods | the mods folder is `https://mods.serpentgame.example/`; the saves window asks it for the installed mods (each `mod.txt` in `mods\content` and `mods\cosmetic`). A mod that comes with a newer game is copied into `Documents\SerpentGame\mods` once (`%APPDATA%\SerpentGame\mods-offered.dat` remembers it, so a mod you delete stays deleted) |
| Keeps saves | each save is a `.world` file in `%APPDATA%\SerpentGame\worlds` (see [`WORLDS.md`](WORLDS.md)); the browser's own data is in `%APPDATA%\SerpentGame\WebView2`. Both are separate from the game folder, so updating the game never touches them |
| Remembers the window | size, position, maximized and full screen, in `%APPDATA%\SerpentGame\window.ini` |
| Full screen | **F11** or **Alt+Enter**, and the game's own full screen button |
| Developer keys | **F5** reload, **F12** developer tools (both can be turned off in `launcher.ini`) |
| Links | anything outside the game opens in the player's browser |
| One at a time | starting it again brings the open window forward |
| Missing WebView2 | on an old PC without it, offers the Microsoft download page |
| Saves window | `SerpentGame.exe` with no arguments: the list of saves, **Quit** and **New**, then **Cancel**, **Edit** and **Play** for the one picked; Edit renames it and changes its picture and mods |
| Game window | `SerpentGame.exe --world <key>`: the game on one save; closing it saves first |

The game can also talk to the launcher with `window.chrome.webview.postMessage(...)`:
`"quit"`, `"fullscreen:on"`, `"fullscreen:off"` and `"fullscreen:toggle"`. The game's Quit button
already closes the game window (through `window.close()`), after saving.

## launcher.ini

Next to `SerpentGame.exe`. Read at every start.

```ini
[window]
title      = Serpent
width      = 1280
height     = 800
fullscreen = false

[developer]
devTools   = true      ; F12
reloadKey  = true      ; F5

[mods]
folder     = documents ; or: game
```

Turn `devTools` and `reloadKey` off for the version players get.

## Important: the host name

Saves are stored under the game's web address, `https://game.serpentgame.example`. If that name in
`main.cpp` ever changes, every player's saves will seem to vanish (they're still on disk, under the old
name). Keep it as it is.

## Shipping on Steam (later)

Steam installs a game by copying its folder, so this layout is already Steam-shaped: the launcher, the
content and the code side by side. Steam's own features (achievements, cloud saves, the Workshop for
mods) come from the Steamworks SDK, which is C++ and plugs into this launcher. Steam can also install the
WebView2 Runtime as a prerequisite for the few PCs that don't have it.
