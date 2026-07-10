#!/usr/bin/env python3
"""
Generate the site's social-share assets, on-brand with the live typography:

  - title   -> Chillax Bold   (matches .homepage-name / .detail-title weight 700)
  - summary -> Inter Medium   (matches .detail-summary weight 500)
  - tags    -> Inter SemiBold

Outputs:
  1. assets/images/og.png               — homepage share card
  2. assets/images/og/<slug>.png         — per-project 1200x630 share cards
  3. projects/<slug>/index.html          — prerendered stubs with per-project
                                           OG/Twitter meta + the SPA-redirect
                                           script (humans bounce into the app;
                                           scrapers read the baked meta).

Fonts are vendored in tools/fonts/ (used only at generate time — the live site
loads Chillax/Inter from CDN). Titles render as-is from frontmatter, preserving
the lowercase voice with proper-noun exceptions (see docs/design.md).

Run after adding or editing a project:

    uv run --with pillow,pyyaml python tools/generate_og.py
"""

import html
import json
import os
import subprocess
import tempfile

import yaml
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "tools/fonts")
SITE = "https://www.rohanjk.xyz"

BG = (26, 26, 46)        # #1a1a2e  page
AMBER = (255, 204, 128)  # #FFCC80  accent / titles
MUTED = (176, 176, 200)  # summary
DIM = (120, 120, 150)    # tags / sub

CHILLAX_BOLD = os.path.join(FONT_DIR, "Chillax-Bold.ttf")
INTER_MEDIUM = os.path.join(FONT_DIR, "Inter-Medium.ttf")
INTER_SEMIBOLD = os.path.join(FONT_DIR, "Inter-SemiBold.ttf")


def font(path, size):
    return ImageFont.truetype(path, size)


def parse_frontmatter(md_text):
    if md_text.startswith("---"):
        _, fm, _ = md_text.split("---", 2)
        return yaml.safe_load(fm) or {}
    return {}


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_title(draw, text, max_w, path, start=96, floor=52):
    size = start
    while size > floor and draw.textlength(text, font=font(path, size)) > max_w:
        size -= 4
    return font(path, size), size


def amber_glyph(size):
    """Rasterize the logo SVG (macOS QuickLook) and recolor it amber on transparent."""
    tmp = tempfile.mkdtemp()
    subprocess.run(
        ["qlmanage", "-t", "-s", "1024", "-o", tmp, os.path.join(ROOT, "assets/images/logo.svg")],
        capture_output=True,
    )
    png = os.path.join(tmp, "logo.svg.png")
    if not os.path.exists(png):
        return None
    g = Image.open(png).convert("L").resize((size, size), Image.LANCZOS)
    mask = ImageOps.invert(g)  # black glyph -> opaque, white bg -> transparent
    solid = Image.new("RGBA", (size, size), AMBER + (0,))
    solid.putalpha(mask)
    return solid


def rounded_banner(banner_path, box_w, box_h, radius=14):
    img = ImageOps.fit(Image.open(banner_path).convert("RGB"), (box_w, box_h), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (box_w, box_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, box_w, box_h], radius=radius, fill=255)
    img.putalpha(mask)
    return img


def base_card():
    img = Image.new("RGBA", (1200, 630), BG + (255,))
    ImageDraw.Draw(img).rectangle([0, 0, 1200, 6], fill=AMBER + (255,))
    return img


def make_homepage_card():
    W, H, PAD = 1200, 630, 90
    card = base_card()
    d = ImageDraw.Draw(card)

    glyph = amber_glyph(300)
    if glyph:
        card.alpha_composite(glyph, (W - 300 - PAD + 10, (H - 300) // 2))

    y = 250
    word_font, wsize = font(CHILLAX_BOLD, 150), 150
    wb = d.textbbox((0, 0), "rohan.jk", font=word_font)
    d.text((PAD, y), "rohan.jk", font=word_font, fill=AMBER + (255,))
    y += (wb[3] - wb[1]) + 55
    d.text((PAD, y), "software & ai", font=font(INTER_MEDIUM, 46), fill=MUTED + (255,))
    y += 86
    d.text((PAD, y), "computer engineering @ ntu",
           font=font(INTER_MEDIUM, 30), fill=DIM + (255,))

    out = os.path.join(ROOT, "assets/images/og.png")
    card.convert("RGB").save(out, "PNG")
    return out


def make_project_card(slug, title, summary, techs, banner_path):
    W, H, PAD = 1200, 630, 90
    card = base_card()
    d = ImageDraw.Draw(card)

    thumb_w, thumb_h = 380, 150
    text_right = W - PAD
    if banner_path and os.path.exists(banner_path):
        try:
            card.alpha_composite(rounded_banner(banner_path, thumb_w, thumb_h),
                                 (W - PAD - thumb_w, (H - thumb_h) // 2 - 30))
            text_right = W - PAD - thumb_w - 50
        except Exception as e:
            print(f"  ! banner thumb failed for {slug}: {e}")

    text_w = text_right - PAD
    y = 150

    title_font, tsize = fit_title(d, title, text_w, CHILLAX_BOLD)
    if d.textlength(title, font=title_font) > text_w:
        # Too long even at the floor size: wrap, shrinking further until the
        # whole title fits in three lines (never ellipsize away the ending).
        while True:
            tlines = wrap(d, title, title_font, text_w)
            if len(tlines) <= 3 or tsize <= 36:
                break
            tsize -= 4
            title_font = font(CHILLAX_BOLD, tsize)
        if len(tlines) > 3:
            tlines = tlines[:3]
            tlines[-1] = tlines[-1].rstrip(" ,;:") + "…"
    else:
        tlines = [title]
    for tline in tlines:
        d.text((PAD, y), tline, font=title_font, fill=AMBER + (255,))
        y += tsize + 10
    y += 20

    # Trade summary lines for title lines so the tags row never collides.
    max_summary = min(3, 5 - len(tlines))
    sum_font = font(INTER_MEDIUM, 36)
    lines = wrap(d, summary, sum_font, text_w)
    if len(lines) > max_summary:
        lines = lines[:max_summary]
        lines[-1] = lines[-1].rstrip(" ,;:") + "…"
    for line in lines:
        d.text((PAD, y), line, font=sum_font, fill=MUTED + (255,))
        y += 50

    if techs:
        d.text((PAD, H - PAD - 6), "  ·  ".join(techs[:5]),
               font=font(INTER_SEMIBOLD, 26), fill=DIM + (255,))

    out_dir = os.path.join(ROOT, "assets/images/og")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{slug}.png")
    card.convert("RGB").save(out, "PNG")
    return out


STUB = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title_e} — rohan.jk</title>
    <meta name="description" content="{summary_a}">
    <link rel="canonical" href="{site}/projects/{slug}">

    <meta property="og:type" content="article">
    <meta property="og:url" content="{site}/projects/{slug}">
    <meta property="og:title" content="{title_a} — rohan.jk">
    <meta property="og:description" content="{summary_a}">
    <meta property="og:site_name" content="rohan.jk">
    <meta property="og:image" content="{site}/assets/images/og/{slug}.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="{title_a} — rohan.jk">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title_a} — rohan.jk">
    <meta name="twitter:description" content="{summary_a}">
    <meta name="twitter:image" content="{site}/assets/images/og/{slug}.png">

    <!-- Humans: boot the SPA at the right route (scrapers stop at the meta above). -->
    <script>
        sessionStorage.setItem('spa-redirect', '/projects/{slug}');
        location.replace('/');
    </script>
    <noscript><meta http-equiv="refresh" content="0; url=/"></noscript>
</head>
<body></body>
</html>
"""


def make_stub(slug, title, summary):
    out_dir = os.path.join(ROOT, "projects", slug)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "index.html")
    with open(out, "w") as f:
        f.write(STUB.format(
            site=SITE, slug=slug,
            title_e=html.escape(title),
            title_a=html.escape(title, quote=True),
            summary_a=html.escape(summary, quote=True),
        ))
    return out


def main():
    print("Homepage card:", os.path.relpath(make_homepage_card(), ROOT))
    index = json.load(open(os.path.join(ROOT, "projects/index.json")))
    # Unlisted articles get share cards + meta stubs too — they're shared by
    # direct link, so link previews matter. They stay out of the grid/sitemap.
    unlisted_path = os.path.join(ROOT, "projects/unlisted.json")
    if os.path.exists(unlisted_path):
        index = index + json.load(open(unlisted_path))
    print(f"\nProjects ({len(index)}):")
    for fname in index:
        slug = fname[:-3] if fname.endswith(".md") else fname
        fm = parse_frontmatter(open(os.path.join(ROOT, "projects", fname)).read())
        title = fm.get("title", slug)
        summary = fm.get("summary", "")
        techs = fm.get("technologies") or []
        banner = os.path.join(ROOT, fm["image"]) if fm.get("image") else None
        card = make_project_card(slug, title, summary, techs, banner)
        make_stub(slug, title, summary)
        print(f"  {slug:18} -> {os.path.relpath(card, ROOT)} + stub")
    print("\nDone.")


if __name__ == "__main__":
    main()
