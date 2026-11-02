# Mods

A mod is a folder that adds to, or changes, the game's content. The game's own files stay untouched,
so turning a mod off puts everything back.

## Where mods live

- **With the launcher:** `Documents\SnakeGame\mods`. The first time the launcher runs, it creates that
  folder and copies in the game's `mods` folder (an `_enabled.dat` and `example-pack`).
- To keep mods next to the game instead, set `folder = game` under `[mods]` in `launcher.ini`.

## Turning mods on

`_enabled.dat` lists the mods to load, one folder name per line, in order (later mods win). A `#` in
front turns one off. Reload with **F5**.

## What a mod can contain

```
my-mod/
  mod.txt                  name, version, author, about
  skins/    _index.dat + *.skin      add skins, or change one by using its file name
  themes/   _index.dat + *.theme     add themes (patterned ones reuse a painter by name)
  avatars/  _index.dat + *.avatar
  story/    _index.dat + *.story     rewrite pages (new page ids need code to ever play)
  upgrades/ _index.dat + *.upg       change any upgrade, by id: only the lines you write change
  economy.txt                        change any price: only the lines you write change (use the
                                     same [sections] as content/economy.txt, e.g. [great] unit = 8)
  music/    music.dat + audio        replace tracks: rows with the same track name win
```

Every folder works like the game's own: an `_index.dat` lists the files to load.

### Adding versus changing

- A **new name** adds something: `skins/peach-fizz.skin` is a new skin in the Tailor.
- An **existing name** changes it: `skins/classic.skin` with just `name = Original` renames the classic
  skin and keeps everything else.
- Upgrades and the economy only change: `upgrades/snack.upg` with `step = 0.06` makes each tier of Snack
  Time give a bit more, and nothing else moves. Island upgrades have 10 tiers since build 46.

## The example

`example-pack` adds a skin (Peach Fizz) and a theme (Midnight Garden), and makes Snack Time a little
stronger. Enable it in `_enabled.dat` to see it, then copy the folder to start your own.

## Mods and saves

Anything bought from a mod is kept when the mod is turned off: it's set aside in the save, out of sight,
and comes back when the mod does. (If it was being worn, the default skin or theme goes on meanwhile.)

## What needs code

Mods are content only, by design: a downloaded mod can never run code on a player's PC. New kinds of
things (a new item effect, a new Flair drawing, a new theme pattern, a new island type) need code in the
game itself, and then mods can use them. Names that would reach into the game's own objects
(`__proto__`, `constructor`, `prototype`) are refused as keys and section names, so a mod can't
switch on cheats that way.
