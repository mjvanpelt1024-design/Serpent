#!/usr/bin/env python3
"""
Signs the campaign data (content/campaign/) so the game can tell when it was
edited by hand. Run it after every change to a campaign file:

    python tools/check-campaign.py      (make sure the data is sane first)
    python tools/sign-content.py

It writes content/campaign/manifest.dat: one line per file with its digest,
and a seal over the whole list. The game recomputes both at startup
(src/campaign/integrity.js); if they don't match, the save is marked modded.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMP = os.path.join(ROOT, "content", "campaign")
KEY = "coil-of-five:7f3a9c21"          # must match INTEGRITY_KEY in src/campaign/integrity.js


def fnv32(data, seed):
    h = seed & 0xFFFFFFFF
    for b in data:
        h ^= b
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def digest(text):
    b = text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")
    return "%08x%08x" % (fnv32(b, 2166136261), fnv32(b, 3735928559))


def sign(text):
    return digest(KEY + "|" + text + "|" + KEY)


def campaign_files():
    with open(os.path.join(CAMP, "islands", "_index.dat"), encoding="utf-8") as f:
        ids = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
    return ["items.json", "upgrades.json", "rules.json", "crafting.json", "foes.json", "nightmare.json"] + ["islands/%s.json" % i for i in ids]


def main():
    lines = []
    for rel in sorted(campaign_files()):
        with open(os.path.join(CAMP, rel), encoding="utf-8") as f:
            lines.append("%s %s" % (rel, digest(f.read())))
    body = "\n".join(lines)
    out = os.path.join(CAMP, "manifest.dat")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("# Made by tools/sign-content.py. Don't edit: change the data and run it again.\n")
        f.write(body + "\n")
        f.write("seal %s\n" % sign(body))
    print("signed %d campaign files" % len(lines))


if __name__ == "__main__":
    sys.exit(main())
