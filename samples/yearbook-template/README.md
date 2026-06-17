# Yearbook Bulk Input Template

This folder shows the format the bulk generator expects. Copy it somewhere outside the repo, fill it in with your real content + photos, then run:

```bash
npm run bulk-generate -- --input "/path/to/your/copied/folder"
```

## Folder structure

```
MyYearbook/
├── pages.csv                      ← One row per yearbook page
├── boys-soccer/                   ← Folder name matches "folder" column in pages.csv
│   ├── 01-action-shot.jpg         ← Photo files (any name)
│   ├── 02-game-day.jpg
│   └── captions.csv               ← (Optional) per-photo captions
├── chapel/
│   ├── photo1.jpg
│   └── photo2.jpg
├── homecoming/
│   └── ... (lots of photos for collage page)
└── athletics-divider/             ← Divider page — no photos needed
```

## pages.csv columns

| Column | Required? | Notes |
|--------|-----------|-------|
| `folder` | **YES** | Must match a subfolder name in the input directory |
| `pageType` | recommended | `spread` (default) or `page` |
| `pageCategory` | recommended | `activity` (default), `collage`, `divider`, `index` |
| `section` | one of these | "Boy's Soccer" — used as subtitle on page |
| `pageTitle` | one of these | Big themed title, e.g. "BUILDING RESILIENCE" |
| `pageTitleThemeWord` | optional | The word to italicize in the page title |
| `headline` | one of these | Tagline, appears in purple bar |
| `record` | optional | Stats line like "3-12" |
| `dateOrYear` | optional | "FALL 2025" |
| `bodyCopy` | optional | Long paragraph text |
| `roster` | optional | Names separated by `;` |
| `coaches` | optional | Names separated by `;` |
| `quotes` | optional | "text — Attribution" pairs separated by `;` |
| `highlights` | optional | Items separated by `;` |
| `folio` | optional | Page numbers, e.g. "42-43" |

**At minimum**, every row needs `folder` + one of `section`/`pageTitle`/`headline`.

### Multi-value column syntax

Use semicolons to separate items:

```
roster: "Jane Smith; John Doe; Mary Jones"
quotes: "Best season ever — Jane; Worth every minute — John"
highlights: "Won state; All-conference selections; Senior night"
```

### Page categories

- **`activity`** (default) — Sports/clubs/events spread with photos, body copy, roster, etc.
- **`collage`** — Many photos arranged organically, minimal text. Photos required.
- **`divider`** — Section title page (huge centered title). No photos required.
- **`index`** — Alphabetical topic-and-page-number list. No photos required.

## captions.csv (optional, per folder)

Place inside any photo folder to give specific photos custom caption text:

```csv
filename,captionTitle,caption,people,isPrimary
01-action-shot.jpg,FIGHTING THROUGH,Blake Dale battles a defender,Blake Dale (10),true
02-game-day.jpg,BALL CONTROL,Jay Parrish settles the ball,Jay Parrish (11),false
```

- `filename` matches the photo file name exactly (including extension).
- `captionTitle` is the bold ALL-CAPS label.
- `caption` is the descriptive sentence.
- `people` lists names with grade in parens.
- `isPrimary` (`true`/`false`) marks the dominant/hero photo.

If a photo isn't listed in `captions.csv`, AI will generate captions automatically (assuming `--no-polish` isn't set).

## Run options

```bash
# Generate everything
npm run bulk-generate -- --input /path/to/MyYearbook

# Skip AI polishing (faster, raw text used)
npm run bulk-generate -- --input /path/to/MyYearbook --no-polish

# Skip smart crop AI (faster, default crop used)
npm run bulk-generate -- --input /path/to/MyYearbook --no-crop

# Only process specific pages
npm run bulk-generate -- --input /path/to/MyYearbook --only "boys-soccer,chapel"

# Validate without generating
npm run bulk-generate -- --input /path/to/MyYearbook --dry-run
```

## After bulk-generate completes

Sessions are saved to `sessions/`. Bundle them for InDesign:

```bash
npm run export:indesign -- --all --batch "fall-2025-yearbook"
```

Then in InDesign 2024+, run `ImportYearbook.jsx` and point at the export bundle folder. See `indesign/README.md` for full InDesign workflow.
