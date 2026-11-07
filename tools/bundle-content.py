#!/usr/bin/env python3
"""
Packs every content file, and every picture in textures/, into
content.bundle.js, so index.html also works when it's opened straight from
disk in a browser (no launcher, no server). Pictures go in as data URLs: a
browser won't let a page opened from disk draw loose image files onto a canvas.

The launcher never needs this: it reads the loose files directly, so edits
show up on reload. Run this only before testing in a plain browser:

    python tools/bundle-content.py
"""
import base64
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT = {".txt", ".dat", ".upg", ".skin", ".theme", ".flair", ".avatar", ".item", ".story", ".level", ".world", ".json"}


def main():
    files = {}
    for rel in ("version.txt", "src/load-order.dat"):
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            files[rel] = f.read()
    for folder, _, names in os.walk(os.path.join(ROOT, "content")):
        for name in sorted(names):
            if os.path.splitext(name)[1].lower() in TEXT:
                full = os.path.join(folder, name)
                rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
                with open(full, encoding="utf-8") as f:
                    files[rel] = f.read()
    # the pictures: textures/index.json as text, every PNG as a data URL
    pictures = 0
    for folder, _, names in os.walk(os.path.join(ROOT, "textures")):
        for name in sorted(names):
            full = os.path.join(folder, name)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            ext = os.path.splitext(name)[1].lower()
            if ext == ".json":
                with open(full, encoding="utf-8") as f:
                    files[rel] = f.read()
            elif ext == ".png":
                with open(full, "rb") as f:
                    files[rel] = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
                pictures += 1
    out = os.path.join(ROOT, "content.bundle.js")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Made by tools/bundle-content.py. Don't edit: edit the files in content/ and textures/ and run it again.\n")
        f.write("window.CONTENT_BUNDLE = ")
        json.dump(files, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write(";\n")
    print(f"content.bundle.js: {len(files)} files ({pictures} pictures)")


if __name__ == "__main__":
    sys.exit(main())
