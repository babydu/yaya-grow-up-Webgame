#!/usr/bin/env python3
"""Design-pack asset pipeline (one-shot).

Converts /tmp/opencode/design-pack assets into runtime assets:
  - bg-{t}.jpg        room background, width 1600, JPEG q85
  - stages/{t}-{n}.png  character cutout per growth stage, height <= 720
  - acc/{t}-{n}.png     accessory cutout, height <= 560
"""
import sys
from PIL import Image
from rembg import remove, new_session

SRC = "/tmp/opencode/design-pack/assets"
OUT = "/workspace/assets"
TYPES = ["baby", "cat", "dog", "plant"]


def fix_acc_cat_2(path):
    # The source sheet draws the collar together with a scarf piece in the
    # same cell; the game only wears the collar. Erase everything left of
    # the collar subject (x < 0.34 of the frame). Keep the full frame size
    # so DIMS.acc in visuals.js stays valid.
    im = Image.open(path).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(int(im.width * 0.34)):
            px[x, y] = (0, 0, 0, 0)
    im.save(path)
    print("fixed", path, im.size, flush=True)


def cut(src, dst, max_h, session):
    im = Image.open(src).convert("RGBA")
    im = remove(im, session=session)
    if im.height > max_h:
        im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(dst)
    print(dst, im.size, flush=True)


def main():
    import os
    os.makedirs(f"{OUT}/stages", exist_ok=True)
    os.makedirs(f"{OUT}/acc", exist_ok=True)
    session = new_session("u2net")
    for t in TYPES:
        bg = Image.open(f"{SRC}/bg-{t}.png").convert("RGB")
        bg = bg.resize((1600, round(bg.height * 1600 / bg.width)), Image.LANCZOS)
        bg.save(f"{OUT}/bg-{t}.jpg", quality=85)
        print(f"{OUT}/bg-{t}.jpg", bg.size, flush=True)
        for n in range(1, 5):
            cut(f"{SRC}/stages/{t}-{n}.png", f"{OUT}/stages/{t}-{n}.png", 720, session)
        sheet = Image.open(f"{SRC}/acc-{t}.png")
        cell_w = sheet.width // 4
        for n in range(4):
            cell = sheet.crop((n * cell_w, 0, (n + 1) * cell_w, sheet.height))
            tmp = f"/tmp/opencode/acc-cell-{t}-{n}.png"
            cell.save(tmp)
            cut(tmp, f"{OUT}/acc/{t}-{n + 1}.png", 560, session)
        if t == "cat":
            fix_acc_cat_2(f"{OUT}/acc/cat-2.png")
    print("PIPELINE DONE", flush=True)


if __name__ == "__main__":
    main()
