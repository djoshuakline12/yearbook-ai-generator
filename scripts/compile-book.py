#!/usr/bin/env python3
"""Compile the full 140-page book into one proof PDF.

Sources:
- Josh's eDesign proof pages (auto-cropped out of the pink bleed/slug chrome)
- Generated spreads from ~/Downloads/finished spreads/
- Dividers/signatures/back from _book_pages/
- Labeled gray placeholders for pages still awaiting content

Output: ~/Downloads/finished spreads/DCHS_Yearbook_2026_PROOF.pdf (150 dpi proof)
Usage:  python3 scripts/compile-book.py
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

HOME = os.path.expanduser("~")
FS = os.path.join(HOME, "Downloads", "finished spreads")
BP = os.path.join(FS, "_book_pages")
EDESIGN_PDF = os.path.join(HOME, "Downloads", "PDF - 1-29 .pdf")
OUT = os.path.join(FS, "DCHS_Yearbook_2026_PROOF.pdf")

PROOF_W = 2400          # spread width in px (150 dpi)
SINGLE_W = PROOF_W // 2

# ---------------------------------------------------------------------------
# Book sequence. ('ed', proofPage) = eDesign page, ('sp', file) = my spread,
# ('pg', file) = single page, ('ph', label, nPages) = placeholder.
# ---------------------------------------------------------------------------
BOOK = [
    ("ed", 1),                                  # p1 theme opener
    ("ph", "Theme opening — Josh (pp 2-3)", 2),
    ("ph", "Theme / TOC — Josh (pp 4-5)", 2),
    ("ed", 4), ("ed", 5), ("ed", 6),            # seniors 6-11
    ("ed", 7), ("ed", 8), ("ed", 9),            # seniors 12-17
    ("ph", "Baccalaureate — photos coming (pp 18-19)", 2),
    ("sp", os.path.join(FS, "40_graduation.jpg")),
    ("ed", 12), ("ed", 13), ("ed", 14), ("ed", 15),  # classes + faculty 22-29
    ("sp", os.path.join(BP, "divider_1_student_life.jpg")),
    ("sp", os.path.join(FS, "24_chapel_and_community_groups.jpg")),
    ("sp", os.path.join(FS, "25_see_you_at_the_pole.jpg")),
    ("sp", os.path.join(FS, "26_freshman_retreat.jpg")),
    ("sp", os.path.join(FS, "27_senior_retreat.jpg")),
    ("sp", os.path.join(FS, "28_spirit_week.jpg")),
    ("sp", os.path.join(FS, "29_artist_showcase.jpg")),
    ("sp", os.path.join(FS, "30_christmas_show.jpg")),
    ("sp", os.path.join(FS, "31_spring_production_a_week_away.jpg")),
    ("sp", os.path.join(FS, "32_royal_ball.jpg")),
    ("sp", os.path.join(FS, "34_scholarship_banquet.jpg")),
    ("sp", os.path.join(FS, "35_grandparents_day.jpg")),
    ("sp", os.path.join(FS, "36_community_service.jpg")),
    ("ph", "Spiritual Emphasis Day — copy & photos coming", 2),
    ("sp", os.path.join(FS, "43_jterm.jpg")),
    ("sp", os.path.join(FS, "42_collage_spread.jpg")),
    ("sp", os.path.join(FS, "46_collage_2.jpg")),
    ("sp", os.path.join(BP, "divider_2_academics.jpg")),
    ("sp", os.path.join(FS, "01_bible+02_english.jpg")),
    ("sp", os.path.join(FS, "03_math+04_science.jpg")),
    ("sp", os.path.join(FS, "05_history+06_spanish.jpg")),
    ("sp", os.path.join(FS, "07_art+08_media.jpg")),
    ("ph", "Consumer Science + Industrial Arts — photos coming", 2),
    ("sp", os.path.join(FS, "13_gym_health.jpg")),
    ("sp", os.path.join(FS, "12_praise_and_worship.jpg")),
    ("sp", os.path.join(FS, "39_senior_thesis_project_stp.jpg")),
    ("sp", os.path.join(BP, "divider_3_sports.jpg")),
    ("sp", os.path.join(FS, "14_boys_soccer.jpg")),
    ("sp", os.path.join(FS, "15_girls_soccer.jpg")),
    ("sp", os.path.join(FS, "16_boys_basketball.jpg")),
    ("sp", os.path.join(FS, "17_girls_basketball.jpg")),
    ("sp", os.path.join(FS, "18_baseball.jpg")),
    ("sp", os.path.join(FS, "19_softball.jpg")),
    ("sp", os.path.join(FS, "20_girls_volleyball.jpg")),
    ("sp", os.path.join(FS, "20_boys_volleyball.jpg")),
    ("sp", os.path.join(FS, "21_cheer.jpg")),
    ("sp", os.path.join(FS, "22_cross_country.jpg")),
    ("sp", os.path.join(FS, "23_field_hockey.jpg")),
    ("sp", os.path.join(FS, "44_swim.jpg")),
    ("sp", os.path.join(FS, "45_golf.jpg")),
    ("sp", os.path.join(FS, "teams_p1.jpg")),
    ("sp", os.path.join(FS, "teams_p2.jpg")),
    ("sp", os.path.join(FS, "teams_p3.jpg")),
    ("sp", os.path.join(FS, "teams_p4.jpg")),
    ("sp", os.path.join(FS, "teams_p5.jpg")),
    ("sp", os.path.join(FS, "teams_p6.jpg")),
    ("sp", os.path.join(FS, "teams_p7.jpg")),
    ("sp", os.path.join(BP, "divider_4_royal_finish.jpg")),
    ("sp", os.path.join(FS, "37_student_leadership_council_slc.jpg")),
    ("ph", "Senior Recognition & Ads (pp 128-135)", 8),
    ("sp", os.path.join(BP, "signatures.jpg")),
    ("ph", "Flex — extra signatures / collage (pp 138-139)", 2),
    ("pg", os.path.join(BP, "back_page.jpg")),
]

# ---------------------------------------------------------------------------
def extract_edesign_pages(needed):
    """Rasterize needed proof pages and crop the trim area inside the pink
    bleed strips. Returns {proofPage: PIL.Image}."""
    out = {}
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["pdftoppm", "-jpeg", "-r", "200", EDESIGN_PDF,
                        os.path.join(td, "pg")], check=True)
        for n in needed:
            fp = next((os.path.join(td, f) for f in sorted(os.listdir(td))
                       if f.endswith(f"-{n:02d}.jpg") or f.endswith(f"-{n}.jpg")), None)
            if not fp:
                continue
            im = Image.open(fp).convert("RGB")
            a = np.asarray(im)
            r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
            pink = (r > 210) & (r - g > 35) & (r - b > 20) & (g < 215)
            rows = pink.mean(axis=1) > 0.25
            cols = pink.mean(axis=0) > 0.25
            ys = np.where(rows)[0]
            xs = np.where(cols)[0]
            if len(ys) >= 2 and len(xs) >= 2:
                # content sits between the outermost pink bands
                top_band_end = ys[ys < a.shape[0] * 0.3]
                bot_band_start = ys[ys > a.shape[0] * 0.5]
                y0 = (top_band_end.max() + 1) if len(top_band_end) else 0
                y1 = (bot_band_start.min() - 1) if len(bot_band_start) else a.shape[0]
                left_band = xs[xs < a.shape[1] * 0.2]
                right_band = xs[xs > a.shape[1] * 0.8]
                x0 = (left_band.max() + 1) if len(left_band) else 0
                x1 = (right_band.min() - 1) if len(right_band) else a.shape[1]
                im = im.crop((x0, y0, x1, y1))
            out[n] = im
            ar = im.width / im.height
            kind = "spread" if ar > 1.1 else "single"
            print(f"  eDesign p{n}: cropped {im.width}x{im.height} ({kind}, ar {ar:.2f})",
                  file=sys.stderr)
    return out


def placeholder(label, spread=True):
    w = PROOF_W if spread else SINGLE_W
    h = int(PROOF_W * 10.5 / 16)
    im = Image.new("RGB", (w, h), (238, 236, 242))
    d = ImageDraw.Draw(im)
    d.rectangle([20, 20, w - 20, h - 20], outline=(150, 140, 170), width=4)
    try:
        from PIL import ImageFont
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 64)
        font2 = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
    except Exception:
        font = font2 = None
    d.text((w // 2, h // 2 - 40), "COMING SOON", fill=(86, 61, 130),
           font=font, anchor="mm")
    d.text((w // 2, h // 2 + 50), label, fill=(90, 90, 100), font=font2, anchor="mm")
    return im


def norm(im, spread=True):
    w = PROOF_W if spread else SINGLE_W
    h = int(w * 10.5 / (16 if spread else 8))
    return im.convert("RGB").resize((w, h), Image.LANCZOS)


def main():
    needed = sorted({n for t, *rest in [(i[0], i[1:]) for i in BOOK]
                     for n in ([rest[0][0]] if t == "ed" else [])
                     } | {i[1] for i in BOOK if i[0] == "ed"})
    print("Extracting eDesign pages…", file=sys.stderr)
    ed = extract_edesign_pages(needed)

    pages = []
    page_no = 1
    for item in BOOK:
        if item[0] == "ed":
            im = ed.get(item[1])
            if im is None:
                im = placeholder(f"eDesign page {item[1]} missing")
            spread = (im.width / im.height) > 1.1
            pages.append(norm(im, spread))
            page_no += 2 if spread else 1
        elif item[0] == "sp":
            if os.path.exists(item[1]):
                pages.append(norm(Image.open(item[1]), True))
            else:
                pages.append(placeholder(os.path.basename(item[1]) + " (missing file)"))
            page_no += 2
        elif item[0] == "pg":
            if os.path.exists(item[1]):
                pages.append(norm(Image.open(item[1]), False))
            else:
                pages.append(placeholder(os.path.basename(item[1]), False))
            page_no += 1
        elif item[0] == "ph":
            label, n = item[1], item[2]
            for _ in range(0, n, 2):
                pages.append(placeholder(label, True))
            page_no += n
    print(f"Book pages accounted: {page_no - 1}", file=sys.stderr)

    pages[0].save(OUT, save_all=True, append_images=pages[1:],
                  resolution=150.0, quality=82)
    print(f"Wrote {OUT} ({len(pages)} PDF pages, {os.path.getsize(OUT) // 1024 // 1024}MB)")


if __name__ == "__main__":
    main()
