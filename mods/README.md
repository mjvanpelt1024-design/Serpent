# Mods

A mod is a folder that adds to, or changes, the game, without touching the game's own files. There are
two kinds, each in its own folder here:

- **`content\`**: new things in the game (weapons, armor, skins, themes, upgrades, prices...). Chosen
  when a save is made, and kept with it for good.
- **`cosmetic\`**: how the game looks (a screen filter, a stats overlay, pictures, music). Switched on
  and off for any save, any time.

To add a mod, put its folder in `content` or `cosmetic`. Then, in **Serpent Saves**: **New** (or pick a
save and press **Edit**), **Choose mods…**, and tick it.

When you run **SerpentGame.exe**, mods are read from `Documents\SerpentGame\mods`, not from this folder.
The launcher copies this folder there the first time, and any mod that comes with a newer version of the
game once. To keep mods next to the game instead, set `folder = game` under `[mods]` in `launcher.ini`.

Playing from `index.html` in a browser (no launcher)? Then `_enabled.dat` here lists the mods.

Full guide: `docs/MODDING.md`.
