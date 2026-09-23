#!/usr/bin/env python3
"""Ve khung do, so thu tu va chu thich tieng Viet len anh chup console AWS.

Dung: annotate.py <anh.png> '<json boxes>'
  boxes: [{"x":..,"y":..,"w":..,"h":..,"n":1,"t":"chu thich"}, ...]

Chu thich dat ben phai khung neu con cho, khong thi dat ben duoi.
"""
import json
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

RED = (217, 30, 24)
INK = (25, 25, 25)
PAD = 8
BADGE = 28
WRAP = 34


def font(size, bold=False):
    names = ("DejaVuSans-Bold.ttf", "DejaVuSans.ttf")
    name = names[0] if bold else names[1]
    for base in ("/usr/share/fonts/truetype/dejavu/",):
        try:
            return ImageFont.truetype(base + name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def caption_size(draw, lines, fnt):
    widths, heights = [], []
    for line in lines:
        left, top, right, bottom = draw.textbbox((0, 0), line, font=fnt)
        widths.append(right - left)
        heights.append(bottom - top)
    return max(widths), sum(h + 6 for h in heights)


def main():
    path, boxes = sys.argv[1], json.loads(sys.argv[2])
    img = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(img)
    fnt = font(15)
    badge_fnt = font(17, bold=True)

    for box in boxes:
        x, y, w, h = (int(box[k]) for k in ("x", "y", "w", "h"))
        if box.get("mask"):  # che vung nhay cam, khong ve khung
            draw.rectangle([x, y, x + w, y + h], fill=(148, 163, 184))
            continue
        draw.rectangle([x - 3, y - 3, x + w + 3, y + h + 3], outline=RED, width=3)

        n = str(box.get("n", ""))
        if n:
            bx = x - BADGE - 7 if x >= BADGE + 7 else x + w + 7
            by = max(0, y + h // 2 - BADGE // 2)
            draw.rectangle([bx, by, bx + BADGE, by + BADGE], fill=RED)
            tw = draw.textlength(n, font=badge_fnt)
            draw.text((bx + (BADGE - tw) / 2, by + 4), n, fill="white", font=badge_fnt)

        text = box.get("t")
        if not text:
            continue
        lines = textwrap.wrap(text, WRAP) or [text]
        cw, ch = caption_size(draw, lines, fnt)
        cx = x + w + 14
        cy = y
        if cx + cw + 2 * PAD > img.width:  # khong du cho ben phai
            cx = max(4, x)
            cy = y + h + 12
        box_rect = [cx, cy, cx + cw + 2 * PAD, cy + ch + PAD]
        draw.rectangle(box_rect, fill=(255, 249, 235), outline=RED, width=2)
        ty = cy + PAD // 2
        for line in lines:
            draw.text((cx + PAD, ty), line, fill=INK, font=fnt)
            ty += 21

    out = path.replace(".raw.png", ".png") if path.endswith(".raw.png") else path
    img.save(out)
    print(f"annotated {out} ({len(boxes)} boxes)")


if __name__ == "__main__":
    main()
