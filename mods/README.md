# Mods

A mod is a folder that adds to, or changes, the game's content, without touching the game's own files.

When you run **SnakeGame.exe**, mods are read from `Documents\SnakeGame\mods`, not from this folder. The first
time the launcher runs, it copies this folder there for you (including `example-pack`). If you'd rather keep
mods next to the game, set `folder = game` under `[mods]` in `launcher.ini`.

To turn a mod on, add its folder name to `_enabled.dat` and reload (F5).

Full guide: `docs/MODDING.md`.
