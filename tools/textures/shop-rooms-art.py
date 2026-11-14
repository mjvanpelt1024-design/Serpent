#!/usr/bin/env python3
"""
Draws the extra pictures that dress the shops, the tents and the vaults (build 56):

  textures/scenes/shops/<island>/decor.png     320 x 100  things on the walls of the workshop (left half) and
                                                         the shop (right half), drawn over back.png and under
                                                         middle.png
  textures/scenes/shops/<island>/counter.png   320 x 100  the counter, with its bell and crate, in front of the
                                                         keeper (the old shared one is counter.png in shops/)
  textures/scenes/npc/<island>/challenger-decor.png  160 x 60  behind the challenger: rug, rack, hay, banners
  textures/scenes/npc/<island>/challenger-front.png  160 x 60  in front of it: a rope, a bale, bunting
  textures/scenes/npc/<island>/banker-decor.png      160 x 60  behind the banker: chandelier, sacks, a notice

    python tools/textures/shop-rooms-art.py           # writes only the pictures that don't exist yet
    python tools/textures/shop-rooms-art.py --force   # redraws them all (loses any repainting!)

Meant to be repainted by hand: once a file exists this tool leaves it alone. It also adds the pictures'
lines to textures/index.json.
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("room_kit", os.path.join(HERE, "room-kit.py"))
K = importlib.util.module_from_spec(spec)
spec.loader.exec_module(K)
from PIL import Image  # noqa: E402

Pic, rgb, mix, lite, dark, place = K.Pic, K.rgb, K.mix, K.lite, K.dark, K.place

ROOT = os.path.dirname(os.path.dirname(HERE))
TEX = os.path.join(ROOT, "textures")
FORCE = "--force" in sys.argv
ISLANDS = ["keep", "spire", "hollow", "reef", "crown"]

# what each island's rooms are made of
TH = {
    "keep":   dict(wood="#7a5230", trim="#d8b050", cloth="#a82a2a", cloth2="#ffd23f", floor="#5a4a3a", glow="#ffd27a", steel="#aab2bc"),
    "spire":  dict(wood="#43306a", trim="#7fe3ff", cloth="#6a3aa8", cloth2="#ffd23f", floor="#2a2050", glow="#b8a0ff", steel="#9aa0d8"),
    "hollow": dict(wood="#8a5a30", trim="#e8802a", cloth="#c0392b", cloth2="#f4ecd0", floor="#5a3a1e", glow="#ffc878", steel="#a8a090"),
    "reef":   dict(wood="#7a6a50", trim="#ff8a9a", cloth="#1e8aa8", cloth2="#f4ecd0", floor="#1a4a64", glow="#a8f0ff", steel="#b8c8d0"),
    "crown":  dict(wood="#4a2a28", trim="#ff7a1a", cloth="#8a1a1a", cloth2="#ffb02a", floor="#2a1a1e", glow="#ff9a4a", steel="#6a6a76"),
}

written, kept, index_add = [], [], {}


def want(rel, tex_id=None):
    path = os.path.join(TEX, rel)
    if tex_id:
        index_add[tex_id] = rel
    if os.path.exists(path) and not FORCE:
        kept.append(rel)
        return None
    os.makedirs(os.path.dirname(path), exist_ok=True)
    written.append(rel)
    return path


# --------------------------------------------------------------- the shops ----

def wall_light(Z, x0, x1):
    """the room's own light: darker under the awning and toward the edges, in a few flat translucent steps"""
    for i, a in enumerate((70, 46, 28, 14)):
        Z.wash(x0, 10 + i * 4, x1 - x0, 4, "#0a0610", a)
    for i, a in enumerate((60, 36, 18)):
        Z.wash(x0 + i * 3, 10, 3, 62, "#0a0610", a)
        Z.wash(x1 - 3 - i * 3, 10, 3, 62, "#0a0610", a)


def lamp_glow(Z, x, y, c, r=12):
    Z.glow(x, y, r, c, 70)


def floor_planks(Z, x0, x1, y0, th):
    base = rgb(th["floor"])
    for i, x in enumerate(range(x0, x1, 11)):
        Z.vl(x, y0, 100 - y0, dark(base, 0.35))
    Z.hl(x0, y0, x1 - x0, lite(base, 0.25))
    Z.hl(x0, y0 + 1, x1 - x0, lite(base, 0.1))


def shop_keep(Z, th):
    wall_light(Z, 160, 320)
    place(Z, K.banner(11, 18, th["cloth"], th["cloth2"]), 164, 50)
    place(Z, K.banner(11, 18, th["cloth"], th["cloth2"]), 302, 50)
    place(Z, K.crossed_swords(th["steel"], th["trim"]), 254, 49)
    place(Z, K.shield(th["cloth"], th["trim"]), 256, 52)
    for x in (184, 272):
        place(Z, K.sconce(th["glow"]), x, 50)
        lamp_glow(Z, x + 3, 53, th["glow"], 13)


def work_keep(Z, th):
    wall_light(Z, 0, 160)
    # a tool rack over the forge
    Z.r(6, 12, 40, 3, "#6a4424"); Z.hl(6, 12, 40, lite("#6a4424", 0.3)); Z.hl(6, 14, 40, dark("#6a4424", 0.3))
    for x, kind in ((10, "hammer"), (18, "tongs"), (27, "hammer2"), (36, "saw")):
        t = Pic(8, 16)
        if kind == "hammer":
            t.r(3, 0, 2, 12, "#7a5230"); t.r(0, 0, 8, 4, "#8a8a96"); t.hl(0, 0, 8, "#c8c8d0")
        elif kind == "tongs":
            t.line(1, 0, 3, 13, "#6a6a76"); t.line(6, 0, 4, 13, "#6a6a76"); t.r(2, 12, 3, 3, "#c8c8d0")
        elif kind == "hammer2":
            t.r(3, 3, 2, 12, "#7a5230"); t.r(1, 0, 6, 5, "#8a8a96"); t.hl(1, 0, 6, "#c8c8d0")
        else:
            t.r(0, 2, 8, 3, "#b8b8c4"); t.r(0, 5, 8, 1, "#6a6a76"); t.r(2, 6, 4, 7, "#7a5230")
        place(Z, t, x, 15)
    # a window with a shaft of light
    w = K.window(26, 24, sky="#9ad0f0", frame_c="#6a4424")
    place(Z, w, 112, 6)
    for i in range(18):
        Z.wash(112 + 6 + i // 2, 31 + i, 14 + i, 1, "#fff0b0", 18)
    # a barrel and a sack of coal
    place(Z, K.barrel(13, 15), 108, 77)
    place(Z, K.sack(10, 11, "#4a4a52", "#8a6a3a"), 148, 81)
    floor_planks(Z, 0, 160, 92, th)


def shop_spire(Z, th):
    wall_light(Z, 160, 320)
    Z.glow(240, 40, 36, "#7a5cff", 40)
    # a moon window
    w = K.window(22, 22, sky="#1a1450", frame_c="#6a4a9a", night=True, round_=True)
    place(Z, w, 262, 48)
    # hanging star and moon
    for x, y, c in ((171, 49, "#ffd23f"), (200, 52, "#7fe3ff"), (296, 50, "#ffd23f")):
        s = Pic(7, 7); s.r(3, 0, 1, 7, c); s.r(0, 3, 7, 1, c); s.r(2, 2, 3, 3, lite(c, 0.4))
        Z.vl(x + 3, 47, y - 46, "#8a7acc")
        place(Z, s, x, y)
        Z.glow(x + 3, y + 3, 8, c, 40)
    for x in (184, 240):
        place(Z, K.sconce("#b8a0ff"), x, 50)
        lamp_glow(Z, x + 3, 53, "#b8a0ff", 12)
    place(Z, K.plant("#6a3aa8", "#7fe3ff"), 300, 56)


def work_spire(Z, th):
    wall_light(Z, 0, 160)
    # an arched window on the night, a hanging orb
    w = K.window(30, 30, sky="#1a1450", frame_c="#6a4a9a", night=True)
    place(Z, w, 14, 8)
    Z.glow(29, 23, 24, "#7a5cff", 40)
    for i in range(22):
        Z.wash(30 + i // 2, 40 + i, 10 + i, 1, "#9a8aff", 14)
    for x, y, c in ((120, 10, "#7fe3ff"), (138, 18, "#ffd23f")):
        Z.vl(x + 2, 0, y, "#8a7acc")
        o = Pic(6, 6); o.disc(3, 3, 2, c); o.p(2, 2, "#ffffff")
        place(Z, o, x, y)
        Z.glow(x + 3, y + 3, 9, c, 50)
    place(Z, K.plant("#6a3aa8", "#7fe3ff"), 62, 74)
    floor_planks(Z, 0, 160, 92, th)


def shop_hollow(Z, th):
    wall_light(Z, 160, 320)
    # herb bundles and garlic hanging from a beam under the shelf
    Z.r(164, 49, 70, 2, "#5a3a1e"); Z.hl(164, 49, 70, lite("#5a3a1e", 0.3))
    for i, x in enumerate(range(168, 232, 9)):
        h = 6 + (i * 3) % 3
        Z.vl(x + 1, 51, 2, "#c8a060")
        b = Pic(4, h)
        col = ["#5a9a3a", "#e8e0c8", "#c0392b", "#7ab84a", "#e8c070", "#5a9a3a"][i % 6]
        b.r(0, 0, 4, h, col); b.p(1, 1, lite(col, 0.4)); b.vl(3, 2, h - 3, dark(col, 0.3))
        place(Z, b, x, 53, shadow=True)
    # a pan rack
    Z.r(250, 52, 30, 2, "#5a3a1e")
    for x, r in ((254, 4), (264, 3), (273, 4)):
        Z.vl(x, 54, 3, "#4a4a52")
        p = Pic(r * 2 + 1, r * 2 + 1); p.disc(r, r, r, "#6a6a72"); p.disc(r, r, r - 1, "#8a8a94"); p.p(r - 1, r - 1, "#c8c8d0")
        place(Z, p, x - r, 57)
    sc = K.sconce("#ffc878")
    place(Z, sc, 292, 50)
    lamp_glow(Z, 295, 53, "#ffc878", 14)
    place(Z, K.plant("#a85a3a", "#5a9a3a", 15, 11), 168, 70) if False else None


def work_hollow(Z, th):
    wall_light(Z, 0, 160)
    # hanging herbs and pans over the recipe book, a window by the pantry
    Z.r(4, 8, 54, 3, "#5a3a1e"); Z.hl(4, 8, 54, lite("#5a3a1e", 0.3))
    for i, x in enumerate(range(8, 54, 8)):
        h = 10 + (i * 7) % 8
        Z.vl(x + 1, 11, 2, "#c8a060")
        b = Pic(4, h)
        col = ["#5a9a3a", "#e8e0c8", "#c0392b", "#7ab84a", "#e8c070", "#5a9a3a"][i % 6]
        b.r(0, 0, 4, h, col); b.p(1, 1, lite(col, 0.4)); b.vl(3, 2, h - 3, dark(col, 0.3))
        place(Z, b, x, 13)
    w = K.window(20, 18, sky="#9ad0f0", frame_c="#5a3a1e")
    place(Z, w, 32, 38)
    place(Z, K.plant("#a85a3a", "#5a9a3a"), 110, 20) if False else None
    place(Z, K.sack(10, 11, "#e8d8b0", "#7a5230"), 148, 14) if False else None
    place(Z, K.sack(10, 11, "#e8d8b0", "#7a5230"), 4, 78) if False else None
    Z.glow(132, 66, 22, "#ff9a3a", 30)
    floor_planks(Z, 0, 160, 92, th)


def shop_reef(Z, th):
    wall_light(Z, 160, 320)
    place(Z, K.fish_net(26, 14), 164, 49, shadow=False, outline=False)
    w = K.window(22, 22, sky="#1a8ab8", frame_c="#c8a060", round_=True)
    place(Z, w, 262, 48)
    for x in (230,):
        r = Pic(14, 14); r.disc(7, 7, 6, "#e8e0c8"); r.disc(7, 7, 3, "#1a5a7a")
        for a in range(0, 14, 4):
            r.r(a, 6, 2, 2, "#d1202a") if False else None
        r.r(0, 6, 3, 2, "#d1202a"); r.r(11, 6, 3, 2, "#d1202a"); r.r(6, 0, 2, 3, "#d1202a"); r.r(6, 11, 2, 3, "#d1202a")
        place(Z, r, x, 50)
    for x in (212, 300):
        sh = Pic(7, 6); sh.oval(3, 3, 3, 2, "#ff8a9a"); sh.hl(1, 3, 5, lite("#ff8a9a", 0.4))
        place(Z, sh, x, 60)
    Z.glow(250, 60, 26, "#a8f0ff", 25)


def work_reef(Z, th):
    wall_light(Z, 0, 160)
    # portholes on the sea, a net, an anchor
    for x in (10, 38, 66):
        w = K.window(20, 20, sky="#2a9ac8", frame_c="#c8a060", round_=True)
        place(Z, w, x, 10)
        Z.glow(x + 10, 20, 14, "#a8f0ff", 28)
    place(Z, K.fish_net(36, 22), 84, 6, outline=False)
    a = Pic(14, 18)
    a.vl(6, 2, 14, "#c8d4de"); a.hl(5, 4, 4, "#c8d4de"); a.disc(7, 1, 1, "#c8d4de")
    a.line(1, 10, 6, 15, "#c8d4de"); a.line(12, 10, 7, 15, "#c8d4de"); a.hl(0, 10, 3, "#c8d4de"); a.hl(11, 10, 3, "#c8d4de")
    place(Z, a, 104, 38)
    floor_planks(Z, 0, 160, 92, th)


def shop_crown(Z, th):
    wall_light(Z, 160, 320)
    for i, a in enumerate((8, 14, 22, 32)):
        Z.wash(160, 60 + i * 3, 160, 3, "#ff5a1a", a)
    for x in (172, 304):
        Z.vl(x, 10, 40, "#5a5a66"); Z.vl(x + 1, 10, 40, "#3a3a46")
        for y in range(12, 50, 4):
            Z.hl(x - 1, y, 4, "#8a8a96")
    # a horned skull over the crate, a brazier
    sk = Pic(14, 12)
    sk.oval(7, 6, 6, 5, "#e8e0c8"); sk.r(4, 10, 6, 2, "#e8e0c8")
    sk.r(3, 5, 3, 3, "#1a1216"); sk.r(8, 5, 3, 3, "#1a1216"); sk.p(7, 8, "#1a1216")
    sk.p(1, 1, "#e8e0c8"); sk.p(0, 0, "#e8e0c8"); sk.p(12, 1, "#e8e0c8"); sk.p(13, 0, "#e8e0c8")
    place(Z, sk, 228, 50)
    sc = K.sconce("#ff9a4a")
    place(Z, sc, 202, 50)
    place(Z, K.sconce("#ff9a4a"), 280, 50)
    for x in (205, 283):
        lamp_glow(Z, x, 53, "#ff7a1a", 14)


def work_crown(Z, th):
    wall_light(Z, 0, 160)
    for i, a in enumerate((6, 10, 15, 21, 28, 36)):
        Z.wash(0, 62 + i * 5, 160, 5, "#ff5a1a", a)
    # chains and a forge hood, glowing vents
    for x in (18, 52, 92):
        Z.vl(x, 0, 22, "#5a5a66"); Z.vl(x + 1, 0, 22, "#3a3a46")
        for y in range(2, 22, 4):
            Z.hl(x - 1, y, 4, "#8a8a96")
    h = Pic(34, 14)
    for j in range(14):
        h.hl(14 - j if j < 10 else 4, j, 6 + (j if j < 10 else 10) * 2 if j < 10 else 26, "#3a3a46")
    place(Z, h, 20, 4)
    for x in (70, 96):
        v = Pic(10, 8); v.r(0, 0, 10, 8, "#1a1216"); v.r(1, 1, 8, 6, "#ff5a1a"); v.r(3, 3, 4, 2, "#ffb02a")
        place(Z, v, x, 40)
        Z.glow(x + 5, 44, 14, "#ff7a1a", 60)
    # a coal pile
    for i, (x, y) in enumerate(((112, 84), (118, 80), (124, 84), (130, 82), (136, 86), (142, 84), (122, 88), (132, 88))):
        c = Pic(7, 5); c.oval(3, 2, 3, 2, "#2a2a32"); c.p(2, 1, "#ff7a1a") if i % 2 else c.p(4, 2, "#ffb02a")
        place(Z, c, x, y, shadow=False, outline=False)
    floor_planks(Z, 0, 160, 92, th)


SHOPS = {"keep": (shop_keep, work_keep), "spire": (shop_spire, work_spire), "hollow": (shop_hollow, work_hollow),
         "reef": (shop_reef, work_reef), "crown": (shop_crown, work_crown)}


def counter_for(isl, th, orig):
    """the counter in front of the keeper: the old one's bell and crate, a better counter under them"""
    C = Pic(320, 100)
    wood = rgb(th["wood"])
    top = lite(wood, 0.28)
    # the old picture's bell and crate (rows above the counter top)
    C.im.alpha_composite(orig.crop((160, 56, 320, 72)), (160, 56))
    # the top
    C.hl(160, 72, 160, lite(top, 0.3))
    C.r(160, 73, 160, 3, top)
    C.hl(160, 75, 160, dark(wood, 0.3))
    C.hl(160, 76, 160, dark(wood, 0.5))
    # the front
    C.r(160, 77, 160, 23, wood)
    C.hl(160, 77, 160, lite(wood, 0.15))
    # posts and carved panels
    for i in range(5):
        x = 160 + i * 40
        C.r(x, 77, 4, 23, dark(wood, 0.2)); C.vl(x, 77, 23, lite(wood, 0.1)); C.vl(x + 3, 77, 23, dark(wood, 0.45))
    for i in range(4):
        x = 164 + i * 40
        C.r(x + 3, 81, 30, 12, dark(wood, 0.28))
        C.hl(x + 3, 81, 30, dark(wood, 0.5)); C.vl(x + 3, 81, 12, dark(wood, 0.5))
        C.hl(x + 3, 92, 30, lite(wood, 0.12)); C.vl(x + 32, 81, 12, lite(wood, 0.12))
        C.r(x + 6, 84, 24, 6, wood)
        C.hl(x + 6, 84, 24, lite(wood, 0.2)); C.hl(x + 6, 89, 24, dark(wood, 0.3))
        C.p(x + 18, 86, rgb(th["trim"])); C.p(x + 17, 87, rgb(th["trim"])); C.p(x + 19, 87, rgb(th["trim"])); C.p(x + 18, 88, rgb(th["trim"]))
    # the trim along the top
    C.hl(160, 77, 160, rgb(th["trim"]))
    C.hl(160, 78, 160, dark(rgb(th["trim"]), 0.4))
    # the plinth
    C.r(160, 94, 160, 6, dark(wood, 0.55))
    C.hl(160, 94, 160, dark(wood, 0.35))
    # a cloth runner over the front
    cx0, cw = 204, 52
    cloth, cloth2 = rgb(th["cloth"]), rgb(th["cloth2"])
    C.r(cx0, 72, cw, 21, cloth)
    C.vl(cx0, 72, 21, lite(cloth, 0.25)); C.vl(cx0 + cw - 1, 72, 21, dark(cloth, 0.3))
    C.hl(cx0, 72, cw, lite(cloth, 0.2))
    C.hl(cx0 + 3, 75, cw - 6, cloth2); C.hl(cx0 + 3, 76, cw - 6, dark(cloth2, 0.35))
    for k in range(5):
        x = cx0 + 6 + k * 9
        C.r(x, 80, 4, 4, cloth2); C.r(x + 1, 81, 2, 2, lite(cloth2, 0.5))
    for x in range(cx0, cx0 + cw, 4):
        C.r(x, 93, 3, 3, cloth2 if (x // 4) % 2 else dark(cloth2, 0.1))
        C.vl(x + 1, 90, 3, dark(cloth, 0.25))
    # on the counter, to the right: a coin dish and a ledger to the left
    dish = Pic(14, 6)
    dish.oval(7, 4, 6, 2, "#c8a050"); dish.hl(1, 3, 12, "#8a6a30")
    for i in range(5):
        dish.r(2 + i * 2, 1 + (i % 2), 2, 2, "#ffd23f")
    place(C, dish, 270, 67, shadow=False)
    led = Pic(14, 5)
    led.r(0, 1, 14, 4, "#6a2a2a"); led.r(1, 0, 12, 1, "#f4ecd0"); led.hl(0, 4, 14, "#3a1a1a"); led.r(6, 1, 1, 3, "#d8b050")
    place(C, led, 166, 67, shadow=False)
    C.im.alpha_composite(orig.crop((160, 56, 320, 72)), (160, 56)) if False else None
    return C


# --------------------------------------------------------- the tent and the vault ----

def tent_decor(isl, th):
    """behind the challenger (160 x 60): a rug on the floor, a weapon rack, hay, a banner"""
    D = Pic(160, 60)
    # a rug in the ring
    rg = K.rug(70, 9, dark(rgb(th["cloth"]), 0.15), rgb(th["cloth2"]), rgb(th["trim"]))
    place(D, rg, 36, 47, shadow=False, outline=False)
    # a weapon rack on the left, and banners at the sides
    rack = Pic(24, 22)
    rack.r(0, 18, 24, 3, "#5a3a1e"); rack.r(0, 6, 24, 2, "#5a3a1e")
    rack.vl(1, 6, 15, "#5a3a1e"); rack.vl(22, 6, 15, "#5a3a1e")
    for x, c in ((3, th["steel"]), (8, th["steel"]), (13, "#7a5230"), (18, th["steel"])):
        rack.r(x, 0, 2, 19, c); rack.p(x, 0, lite(c, 0.5))
    rack.r(3, 3, 2, 2, "#d8b050"); rack.r(8, 3, 2, 2, "#d8b050"); rack.r(18, 3, 2, 2, "#d8b050")
    place(D, rack, 26, 29)
    place(D, K.banner(7, 16, th["cloth"], th["cloth2"]), 150, 8)
    place(D, K.banner(7, 16, th["cloth"], th["cloth2"]), 3, 8)
    place(D, K.hay(22, 12), 128, 41)
    D.glow(24, 28, 10, th["glow"], 20)
    return D


def tent_front(isl, th):
    """in front of the challenger, at the two corners: a barrel of spears, a stack of sacks"""
    F = Pic(160, 60)
    place(F, K.barrel(13, 15), 1, 45)
    place(F, K.coin_sack(10, 11), 144, 46)
    place(F, K.coin_sack(10, 11, "#b89868"), 151, 49)
    return F


def bank_decor(isl, th):
    """behind the banker: marble tiles on the floor, two hanging lamps, sacks of coin by the pillar"""
    D = Pic(160, 60)
    # the floor: tiles, wider toward you
    light, dk = rgb(th["trim"]), (10, 6, 12)
    rows = ((45, 3, 8), (48, 3, 10), (51, 4, 13), (55, 5, 17))
    for y0, hh, tw in rows:
        for i, x in enumerate(range(-tw // 2 + (y0 % 5), 160, tw)):
            if (i + y0) % 2:
                D.wash(max(0, x), y0, min(tw, 160 - max(0, x)), hh, light, 56)
            else:
                D.wash(max(0, x), y0, min(tw, 160 - max(0, x)), hh, dk, 70)
    for x in (22, 138):
        place(D, K.hang_lamp(th["trim"]), x - 4, 0)
        D.glow(x, 12, 16, "#ffe08a", 36)
    place(D, K.coin_sack(11, 12), 28, 38)
    place(D, K.coin_sack(10, 11, "#b89868"), 38, 40)
    return D


def write_npc(isl, th):
    for name, fn in (("challenger-decor", tent_decor), ("challenger-front", tent_front), ("banker-decor", bank_decor)):
        rel = f"scenes/npc/{isl}/{name}.png"
        path = want(rel, f"npc:{isl}:{name}")
        if path:
            fn(isl, th).im.save(path)


def main():
    orig_counter = Image.open(os.path.join(TEX, "scenes", "shops", "counter.png")).convert("RGBA")
    for isl in ISLANDS:
        th = TH[isl]
        path = want(f"scenes/shops/{isl}/decor.png", f"shop:{isl}:decor")
        if path:
            Z = Pic(320, 100)
            SHOPS[isl][0](Z, th)
            SHOPS[isl][1](Z, th)
            Z.im.save(path)
        path = want(f"scenes/shops/{isl}/counter.png", f"shop:{isl}:front")
        if path:
            counter_for(isl, th, orig_counter).im.save(path)
        write_npc(isl, th)
    # the index: the counters' lines move to their own pictures, the rest are added next to their neighbours
    ip = os.path.join(TEX, "index.json")
    raw = open(ip, encoding="utf-8", newline="").read()
    lines = raw.split(chr(10))
    added = 0
    for k, v in index_add.items():
        line = '    "' + k + '": "' + v + '",'
        have = [i for i, l in enumerate(lines) if l.strip().startswith('"' + k + '":')]
        if have:
            if lines[have[0]] != line:
                lines[have[0]] = line
                added += 1
            continue
        parts = k.split(":")
        anchor = '"shop:' + parts[1] + ':back"' if parts[0] == "shop" else '"npc:' + parts[1] + ':challenger"'
        at = [i for i, l in enumerate(lines) if l.strip().startswith(anchor + ":")][0]
        lines.insert(at + 1, line)
        added += 1
    out = chr(10).join(lines)
    json.loads(out)
    open(ip, "w", encoding="utf-8", newline="").write(out)
    print("wrote %d, kept %d; index lines changed: %d" % (len(written), len(kept), added))


if __name__ == "__main__":
    main()
