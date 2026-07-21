#!/usr/bin/env python3
"""Blueprint-theme OG share cards (1200x630), drawn in the drafting-sheet
style: cream paper, crimson double frame + corner rivets, DWG header, the
project banner, and the inverted crimson title bar.

Outputs (committed, like classic's /assets/images/og/):
  themes/blueprint/public/og/<slug>.png   one per listed project
  themes/blueprint/public/og/blueprint.png  generic card (home/sections)

Run with uv (Pillow + fonttools for the woff2 faces):
  uv run --with pillow --with fonttools --with brotli tools/generate_blueprint_og.py
"""
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'themes/blueprint/public/fonts'
OUT = ROOT / 'themes/blueprint/public/og'
CONTENT = ROOT / 'src/content/projects'
BANNERS = ROOT / 'public/assets/images/projects'

CREAM = (255, 248, 225)
INK = (199, 75, 80)
NAVY = (31, 42, 86)

W, H = 1200, 630


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    """woff2 -> in-memory ttf -> PIL font (PIL can't read woff2 directly)."""
    src = FONTS / name
    if src.suffix == '.woff2':
        tt = TTFont(src)
        tt.flavor = None
        buf = io.BytesIO()
        tt.save(buf)
        buf.seek(0)
        return ImageFont.truetype(buf, size)
    return ImageFont.truetype(str(src), size)


def frontmatter(md: Path) -> dict:
    text = md.read_text(encoding='utf-8')
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    data: dict = {}
    if not m:
        return data
    for line in m.group(1).splitlines():
        kv = re.match(r'^(\w+):\s*(.*)$', line)
        if kv:
            data[kv.group(1)] = kv.group(2).strip().strip('"').strip("'")
    return data


def dashed_grid(d: ImageDraw.ImageDraw):
    def dashed(x0, y0, x1, y1):
        length, gap, pos = 10, 8, 0
        total = max(abs(x1 - x0), abs(y1 - y0))
        while pos < total:
            t0, t1 = pos / total, min(1, (pos + length) / total)
            d.line([
                (x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0),
                (x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1),
            ], fill=(236, 205, 197), width=2)
            pos += length + gap
    for x in range(80, W, 80):
        dashed(x, 0, x, H)
    for y in range(70, H, 80):
        dashed(0, y, W, y)


def sheet_chrome(d: ImageDraw.ImageDraw):
    d.rectangle([16, 16, W - 16, H - 16], outline=INK, width=4)
    d.rectangle([32, 32, W - 32, H - 32], outline=INK, width=2)
    for cx, cy in [(30, 30), (W - 30, 30), (30, H - 30), (W - 30, H - 30)]:
        d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], outline=INK, width=3)


def fit_lines(d, text, font_name, max_width, start, floor=34, max_lines=2):
    for size in range(start, floor - 1, -2):
        font = load_font(font_name, size)
        words, lines, line = text.split(' '), [], ''
        for word in words:
            trial = f'{line} {word}'.strip()
            if d.textlength(trial, font=font) <= max_width:
                line = trial
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
        if len(lines) <= max_lines:
            return lines, font, size
    return [text], load_font(font_name, floor), floor


def project_card(slug: str, title: str, number: int, image_path: str):
    img = Image.new('RGB', (W, H), CREAM)
    d = ImageDraw.Draw(img)
    dashed_grid(d)
    sheet_chrome(d)

    head = load_font('BeVietnamPro-SemiBold.woff2', 30)
    d.text((60, 58), f'01 / SHEET {number:02d}', font=head, fill=INK)
    right = f'SCENE01 / DWG {number:03d}'
    d.text((W - 60 - d.textlength(right, font=head), 58), right, font=head, fill=INK)
    brand = load_font('BeVietnamPro-Bold.woff2', 46)
    d.text(((W - d.textlength('rohan.jk', font=brand)) / 2, 44), 'rohan.jk', font=brand, fill=INK)

    # banner, cover-fitted into a drafted panel (path from frontmatter — slug
    # dirs and image dirs don't always match)
    bx0, by0, bx1, by1 = 60, 122, W - 60, 432
    banner = ROOT / 'public' / image_path.lstrip('/')
    if banner.exists():
        pic = Image.open(banner).convert('RGB')
        scale = max((bx1 - bx0) / pic.width, (by1 - by0) / pic.height)
        pic = pic.resize((round(pic.width * scale), round(pic.height * scale)))
        left = (pic.width - (bx1 - bx0)) // 2
        top = (pic.height - (by1 - by0)) // 2
        img.paste(pic.crop((left, top, left + bx1 - bx0, top + by1 - by0)), (bx0, by0))
    else:
        print(f'  WARNING: no banner for {slug}: {banner}', file=sys.stderr)
        d.rectangle([bx0, by0, bx1, by1], fill=CREAM)
    d.rectangle([bx0, by0, bx1, by1], outline=INK, width=3)

    # inverted title bar, full width
    d.rectangle([32, 452, W - 32, H - 32], fill=INK)
    lines, font, size = fit_lines(d, title, 'BeVietnamPro-SemiBold.woff2', W - 160, 56)
    total = len(lines) * (size + 10) - 10
    y = 452 + (H - 32 - 452 - total) / 2
    for line in lines:
        d.text((64, y), line, font=font, fill=CREAM)
        y += size + 10
    img.save(OUT / f'{slug}.png', optimize=True)


def generic_card():
    img = Image.new('RGB', (W, H), CREAM)
    d = ImageDraw.Draw(img)
    dashed_grid(d)
    sheet_chrome(d)

    # centre crimson panel, like the home menu — sized so the type carries
    px0, py0, px1, py1 = 220, 140, W - 220, H - 140
    d.rectangle([px0, py0, px1, py1], fill=INK)
    chip = load_font('BeVietnamPro-Bold.woff2', 62)
    chip_w = d.textlength('rohan.jk', font=chip) + 48
    cx = px0 + 56
    cy = py0 + 62
    d.rectangle([cx, cy, cx + chip_w, cy + 92], fill=CREAM)
    d.text((cx + 24, cy + 10), 'rohan.jk', font=chip, fill=INK)
    d.text((cx + chip_w + 30, cy + 12), 'blueprints', font=chip, fill=CREAM)
    sub = load_font('BeVietnamPro-SemiBold.woff2', 36)
    d.text((cx, cy + 148), '01 projects · 02 music · 03 about me', font=sub, fill=CREAM)

    img.save(OUT / 'blueprint.png', optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    projects = []
    for md in sorted(CONTENT.glob('*.md')):
        fm = frontmatter(md)
        if fm.get('unlisted', '').lower() == 'true':
            continue
        projects.append((int(fm.get('order', 999)), md.stem, fm.get('title', md.stem), fm.get('image', '')))
    projects.sort()
    for i, (_, slug, title, image) in enumerate(projects):
        project_card(slug, title, i + 1, image)
        print(f'og: {slug}.png')
    generic_card()
    print('og: blueprint.png')
    print(json.dumps({'count': len(projects) + 1}))


if __name__ == '__main__':
    sys.exit(main())
