#!/usr/bin/env node
// Generate a finished spread from a yearbook_import_pack folder + the
// compiled copy doc, via the production API (full pipeline: smart crop,
// content polishing, hand templates).
//
// Usage:
//   node scripts/generate-from-pack.js <spreadFolder> [outDir] [apiBase]
//   node scripts/generate-from-pack.js 01_bible "~/Downloads/finished spreads"
//
// Reads:
//   ~/Downloads/yearbook_import_pack/<spreadFolder>/*.jpg  (photos, sorted)
//   ~/Downloads/yearbook_import_pack/final_manifest.csv    (captions)
//   compiled copy txt (see COMPILED_TXT) for title/summary/quotes/stats

const fs = require('fs');
const path = require('path');
const os = require('os');

const PACK_DIR = path.join(os.homedir(), 'Downloads', 'yearbook_import_pack');
// Plain-text copy of the compiled doc, cached beside the pack; regenerated
// from the docx (via macOS textutil) when missing.
const COMPILED_DOCX = path.join(os.homedir(), 'Downloads', 'Yearbook_2025-2026_Compiled.docx');
const COMPILED_TXT = process.env.COMPILED_TXT || path.join(PACK_DIR, '_compiled_copy.txt');

function ensureCompiledTxt() {
  if (fs.existsSync(COMPILED_TXT)) return;
  const { execFileSync } = require('child_process');
  execFileSync('textutil', ['-convert', 'txt', '-output', COMPILED_TXT, COMPILED_DOCX]);
}

// Confirmed full names for first-name-only quote attributions (verified
// with Josh 2026-07-20). Bare names not listed here hold their spread
// with NEEDS NAME VERIFICATION.
const NAME_FIXES = {
  'VJ': 'VJ Ryan',
  'Niko': 'Niko Diakos',
};

// Doc sections with no pack folder yet — they still BOUND the previous
// section in the parser, else their Summary overwrites its neighbor's
// (Media was inheriting Aspire Leadership's copy).
const EXTRA_SECTIONS = [
  'Consumer Science', 'Industrial Arts', 'Aspire Leadership (Thrive)',
  'Baccalaureate',
  // Cut from the book (Josh 2026-07-28) — kept as a parser boundary.
  'Ambassadors',
];

// Folder slug → section name as it appears in the compiled doc.
const SECTION_NAMES = {
  '01_bible': 'Bible', '02_english': 'English', '03_math': 'Math',
  '04_science': 'Science', '05_history': 'History', '06_spanish': 'Spanish',
  '07_art': 'Art', '08_media': 'Media',
  '12_praise_and_worship': 'Praise and Worship', '13_gym_health': 'Gym / Health',
  '14_boys_soccer': 'Boys Soccer', '15_girls_soccer': 'Girls Soccer',
  '16_boys_basketball': 'Boys Basketball', '17_girls_basketball': 'Girls Basketball',
  '18_baseball': 'Baseball', '19_softball': 'Softball',
  // Two volleyball spreads (Josh 2026-07-28, like last year's book): the
  // doc's 'Volleyball' section is the BOYS team; the girls spread awaits
  // its own copy ('Girls Volleyball' section not in the doc yet).
  '20_boys_volleyball': 'Volleyball',
  '20_girls_volleyball': 'Girls Volleyball',
  '21_cheer': 'Cheer',
  '22_cross_country': 'Cross Country', '23_field_hockey': 'Field Hockey',
  '24_chapel_and_community_groups': 'Chapel and Community Groups',
  '25_see_you_at_the_pole': 'See You At The Pole',
  '26_freshman_retreat': 'Freshman Retreat', '27_senior_retreat': 'Senior Retreat',
  '28_spirit_week': 'Spirit Week', '29_artist_showcase': 'Artist Showcase',
  '30_christmas_show': 'Christmas Show',
  '31_spring_production_a_week_away': 'Spring Production: A Week Away',
  '32_royal_ball': 'Royal Ball', '33_fall_fest_harvest_party': 'Fall Fest / Harvest Party',
  '34_scholarship_banquet': 'Scholarship Banquet', '35_grandparents_day': "Grandparents' Day",
  '36_community_service': 'Community Service',
  '37_student_leadership_council_slc': 'Student Leadership Council (SLC)',
  '39_senior_thesis_project_stp': 'Senior Thesis Project (STP)',
  '40_graduation': 'Graduation', '42_collage_spread': 'Collage Spread',
  // JTerm confirmed for this year's book (Josh 2026-07-28) — photos and
  // copy incoming; held until both land.
  '43_jterm': 'JTerm',
};

// ---------------------------------------------------------------------------
// Parse the compiled copy into sections.
// Structure per section:  <Section Name>\n<Page Title>\n[<Tagline>]\nSummary\n
//   <body>\nQuotes\n<bullets>\n[Stats & Facts\n<bullets>]\nPhotos\n<bullets>
// ---------------------------------------------------------------------------
function parseCompiled(txt) {
  const lines = txt.split('\n').map(l => l.replace(/ /g, ' ').trimEnd());
  const names = [...Object.values(SECTION_NAMES), ...EXTRA_SECTIONS];
  const sections = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (names.includes(line)) {
      const name = line;
      const sec = { title: '', subheadline: '', bodyCopy: '', quotes: [], highlights: [], photoBullets: [] };
      i++;
      // Title (+ optional tagline) until a known keyword line
      const header = [];
      while (i < lines.length && !/^(Summary|Quotes|Stats & Facts|Photos)$/.test(lines[i].trim())) {
        if (lines[i].trim()) header.push(lines[i].trim());
        i++;
      }
      sec.title = header[0] || name;
      if (header[1]) sec.subheadline = header[1];
      // Keyword blocks. A repeated keyword means an unrecognized section
      // header slipped past — stop this section rather than absorb it.
      const seenKw = new Set();
      while (i < lines.length && !names.includes(lines[i].trim())) {
        const kw = lines[i].trim();
        if (seenKw.has(kw)) break;
        seenKw.add(kw);
        i++;
        const block = [];
        while (i < lines.length && !/^(Summary|Quotes|Stats & Facts|Photos)$/.test(lines[i].trim()) && !names.includes(lines[i].trim())) {
          if (lines[i].trim()) block.push(lines[i].trim());
          i++;
        }
        if (kw === 'Summary') sec.bodyCopy = block.join('\n\n');
        else if (kw === 'Quotes') {
          for (const b of block) {
            const m = b.replace(/^[•\t\s]+/, '').match(/^(.+?):\s*[""]?(.+?)[""]?$/);
            if (m) {
              const rawAttr = m[1].trim();
              sec.quotes.push({ attribution: NAME_FIXES[rawAttr] || rawAttr, text: m[2].replace(/^["""]|["""]$/g, '').trim() });
            }
          }
        } else if (kw === 'Stats & Facts') {
          sec.highlights = block.map(b => b.replace(/^[•\t\s]+/, '').trim()).filter(Boolean);
        } else if (kw === 'Photos') {
          sec.photoBullets = block.map(b => b.replace(/^[•\t\s]+/, '').replace(/\s*-\s*https?:\/\/\S+$/, '').trim()).filter(Boolean);
        }
      }
      sections[name] = sec;
    } else i++;
  }
  return sections;
}

// Minimal CSV parser (handles quoted fields with commas).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function manifestCaptions(spreadFolder) {
  const map = {};
  // Pipeline manifest first, then user-confirmed captions (captions_confirmed.csv,
  // built through the photo-by-photo review with Josh) override/extend it.
  for (const file of ['final_manifest.csv', 'captions_confirmed.csv']) {
    const fp = path.join(PACK_DIR, file);
    if (!fs.existsSync(fp)) continue;
    const csv = parseCsv(fs.readFileSync(fp, 'utf8'));
    const head = csv[0];
    const iPath = head.indexOf('final_path');
    const iCap = head.indexOf('caption');
    const iAct = head.indexOf('action');
    for (const r of csv.slice(1)) {
      const p = r[iPath] || '';
      if (iAct >= 0 && (r[iAct] || '').trim() === 'remove') continue;
      if (p.startsWith(spreadFolder + '/')) {
        // Doc sections with bare-link photo bullets leave the raw Drive URL
        // in the caption column — that's no caption, not a caption.
        const cap = (r[iCap] || '').trim();
        map[path.basename(p).replace(/\.\w+$/, '')] = /^https?:\/\//i.test(cap) ? '' : cap;
      }
    }
  }
  return map;
}

// Photos Josh removed in the review UI (action=remove rows) never reach
// a spread.
let _excludedCache = null;
function excludedPhotos() {
  if (_excludedCache) return _excludedCache;
  _excludedCache = new Set();
  const fp = path.join(PACK_DIR, 'captions_confirmed.csv');
  if (fs.existsSync(fp)) {
    const csv = parseCsv(fs.readFileSync(fp, 'utf8'));
    const head = csv[0];
    const iPath = head.indexOf('final_path');
    const iAct = head.indexOf('action');
    if (iAct >= 0) {
      for (const r of csv.slice(1)) {
        if ((r[iAct] || '').trim() === 'remove' && r[iPath]) _excludedCache.add(r[iPath]);
      }
    }
  }
  return _excludedCache;
}

// Per-folder photo source restriction (Josh 2026-07-21: for Spirit Week
// only the "Spirit Week Photos" folder matters — ignore everything else).
const PHOTO_SOURCE_ONLY = {
  '28_spirit_week': 'Spirit Week Photos',
};

// Photos on disk for a spread: top-level files first (caption-matched via
// the manifest), then EVERY subdirectory (Drive folder pulls, user-added
// folders like "Spirit Week Photos" or "Grad Day Pics"), capped at maxPhotos.
function collectPhotos(spreadFolder, maxPhotos = 13) {
  const dir = path.join(PACK_DIR, spreadFolder);
  if (!fs.existsSync(dir)) return [];
  const excluded = excludedPhotos();
  const keep = (rel) => !excluded.has(spreadFolder + '/' + rel);
  if (PHOTO_SOURCE_ONLY[spreadFolder]) {
    const sub = PHOTO_SOURCE_ONLY[spreadFolder];
    const only = path.join(dir, sub);
    if (!fs.existsSync(only)) return [];
    return fs.readdirSync(only).sort()
      .filter(f => /\.(jpe?g|png)$/i.test(f) && !f.startsWith('.') && keep(sub + '/' + f))
      .map(f => ({ file: path.join(only, f), base: f.replace(/\.\w+$/, ''), captioned: true }))
      .slice(0, maxPhotos);
  }
  const top = fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png)$/i.test(f) && fs.statSync(path.join(dir, f)).isFile() && keep(f))
    .sort()
    .map(f => ({ file: path.join(dir, f), base: f.replace(/\.\w+$/, ''), captioned: true }));
  const pulls = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d).sort()) {
      if (e.startsWith('.') || e === '_raw_originals' || e === '_review') continue;
      const p = path.join(d, e);
      const st = fs.statSync(p);
      const r = rel ? rel + '/' + e : e;
      if (st.isDirectory()) walk(p, r);
      else if (/\.(jpe?g|png)$/i.test(e) && keep(r)) pulls.push({ file: p, base: e.replace(/\.\w+$/, ''), captioned: false });
    }
  };
  for (const sub of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, sub);
    if (!sub.startsWith('.') && sub !== '_raw_originals' && fs.statSync(p).isDirectory()) walk(p, sub);
  }
  return [...top, ...pulls].slice(0, maxPhotos);
}

// Missing-content records from the pack's own pipeline reports.
function missingPhotoRecords(spreadNum) {
  const out = { noLink: 0, authErrors: 0 };
  const npPath = path.join(PACK_DIR, 'needs_photo.csv');
  if (fs.existsSync(npPath)) {
    const rows = parseCsv(fs.readFileSync(npPath, 'utf8'));
    out.noLink = rows.slice(1).filter(r => (r[0] || '').padStart(2, '0') === spreadNum).length;
  }
  const sumPath = path.join(PACK_DIR, 'summary.md');
  if (fs.existsSync(sumPath)) {
    const re = new RegExp(`^- \\*\\*Spread ${Number(spreadNum)} `, 'gm');
    out.authErrors = (fs.readFileSync(sumPath, 'utf8').match(re) || []).length;
  }
  return out;
}

// Content scrutiny: is there enough material for a strong spread?
function auditSpread(spreadFolder, sec, photos) {
  const flags = [];
  // A photo counts as captioned if ANY caption source covers it — the
  // confirmed-captions review keys by basename, so folder pulls qualify
  // too (the old p.captioned check false-flagged reviewed spreads).
  const capMap = manifestCaptions(spreadFolder);
  const captioned = photos.filter(p => capMap[p.base]).length;
  const missing = missingPhotoRecords(spreadFolder.slice(0, 2));
  if (photos.length === 0) flags.push('NO PHOTOS on disk — cannot generate');
  else if (photos.length < 3) flags.push(`NEEDS MORE PHOTOS — only ${photos.length}, not generating (5-9 ideal)`);
  else if (photos.length <= 4) flags.push(`${photos.length} photos — usable but thin (5-9 ideal)`);
  if (photos.length && captioned < photos.length) flags.push(`${photos.length - captioned} photo(s) have no caption (Drive folder pulls)`);
  // Shape coverage: every template has tall slots (heroes, rails). If the
  // pool is all-landscape, even best-fit placement crops somebody — ask
  // for a couple of vertical shots before it reaches print.
  const aspects = photos.map(p => p.aspectRatio).filter(Boolean);
  if (aspects.length >= 3) {
    if (Math.min(...aspects) > 1.25) flags.push('ALL PHOTOS LANDSCAPE — tall slots will crop tightly; add 1-2 portrait/vertical shots');
    else if (Math.max(...aspects) < 0.9) flags.push('ALL PHOTOS PORTRAIT — wide slots will crop tightly; add 1-2 landscape shots');
  }
  if (missing.noLink) flags.push(`${missing.noLink} photo(s) listed in the doc with no Drive link`);
  if (missing.authErrors) flags.push(`${missing.authErrors} photo(s) blocked by Drive permissions (Request Access)`);
  if (!sec) { flags.push('NO COPY found in compiled doc'); return flags; }
  // First-name-only quote attributions ("Niko", "VJ") don't print in a
  // yearbook — hold the spread until the full name is confirmed.
  const bareNames = sec.quotes
    .map(q => (q.attribution || '').replace(/\(\d+\)/g, '').replace(/,.*$/, '').trim())
    .filter(n => n && !n.includes(' '));
  if (bareNames.length) flags.push(`NEEDS NAME VERIFICATION — quote attributed to first name only: ${[...new Set(bareNames)].map(n => `'${n}'`).join(', ')}`);
  if ((sec.bodyCopy || '').length < 250) flags.push(`body copy short (${(sec.bodyCopy || '').length} chars)`);
  if (sec.quotes.length === 0) flags.push('no quotes');
  else if (sec.quotes.length === 1) flags.push('only 1 quote (2-3 ideal: hero pull-quote + sidebar mods)');
  if (sec.highlights.length === 0) flags.push('no stats/facts (highlights fill rails and bands)');
  return flags;
}

// Attach width/height-derived aspect ratios so shape checks and the
// templates' aspect repair can see photo shapes.
async function attachAspects(photos) {
  const sharp = require('sharp');
  for (const p of photos) {
    try {
      const meta = await sharp(p.file).metadata();
      const rotated = (meta.orientation || 1) >= 5;
      const w = rotated ? meta.height : meta.width;
      const h = rotated ? meta.width : meta.height;
      if (w && h) p.aspectRatio = w / h;
    } catch (e) { /* unreadable file — leave undefined */ }
  }
}

async function generateSpread(spreadFolder, sections, outDir, apiBase) {
  const sectionName = SECTION_NAMES[spreadFolder];
  const sec = sections[sectionName];
  const photos = collectPhotos(spreadFolder);
  await attachAspects(photos);
  const flags = auditSpread(spreadFolder, sec, photos);
  const result = { spread: spreadFolder, title: sec ? sec.title : '(no copy)', photos: photos.length, quotes: sec ? sec.quotes.length : 0, flags, status: 'skipped' };

  // AUDIT_ONLY=1 rebuilds the content report without re-rendering; a spread
  // counts as done if its output file already exists.
  if (process.env.AUDIT_ONLY) {
    const existing = ['png', 'jpg'].map(e => path.join(outDir, `${spreadFolder}.${e}`)).find(p => fs.existsSync(p));
    if (existing) { result.status = 'ok'; result.out = existing; }
    return result;
  }
  // Under 3 photos: don't generate a half-empty spread — flag for the
  // second content batch instead. Unverified first-name attributions also
  // hold the spread until the full name is confirmed.
  if (!sec || photos.length < 3 || flags.some(f => f.startsWith('NEEDS NAME'))) return result;

  // Drive folder pulls contain burst shots and same-image-different-size
  // duplicates that byte-level dedup can't catch — drop perceptual
  // near-duplicates (8x8 average hash, hamming distance <= 6).
  const sharp = require('sharp');
  const ahash = async (file) => {
    const px = await sharp(file).rotate().grayscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
    const avg = px.reduce((a, b) => a + b, 0) / px.length;
    let bits = 0n;
    for (let i = 0; i < 64; i++) bits = (bits << 1n) | (px[i] > avg ? 1n : 0n);
    return bits;
  };
  const hamming = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
  const seen = [];
  const unique = [];
  for (const p of photos) {
    const h = await ahash(p.file);
    if (seen.some(s => hamming(s, h) <= 6)) continue;
    seen.push(h);
    unique.push(p);
  }
  if (unique.length < photos.length) result.flags.push(`dropped ${photos.length - unique.length} near-duplicate photo(s)`);

  // Captions indexed against the deduped photo list.
  const capMap = manifestCaptions(spreadFolder);
  const seenCapText = new Set();
  const photoCaptions = unique.map((p, i) => {
    // Confirmed captions (captions_confirmed.csv) key by basename, so
    // subfolder photos are captionable too — no top-level-only gate.
    const cap = capMap[p.base] || '';
    if (!cap) return null;
    // Burst siblings share a manifest caption — print it once.
    const norm = cap.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenCapText.has(norm)) return null;
    seenCapText.add(norm);
    return { photoIndex: i, caption: cap, people: '' };
  }).filter(Boolean);

  // Per-photo focal overrides: <folder>/_focus.json maps basename -> CSS
  // object-position ("38% 45%"). Wins over server smart crop for photos
  // whose subject sits at the frame edge.
  const photoFocus = {};
  const focusPath = path.join(PACK_DIR, spreadFolder, '_focus.json');
  if (fs.existsSync(focusPath)) {
    const hints = JSON.parse(fs.readFileSync(focusPath, 'utf8'));
    unique.forEach((p, i) => { if (hints[p.base]) photoFocus[i] = hints[p.base]; });
  }

  const pageContent = {
    pageTitle: sec.title.toUpperCase(),
    section: sectionName,
    subheadline: sec.subheadline,
    bodyCopy: sec.bodyCopy,
    quotes: sec.quotes,
    highlights: sec.highlights,
    photoCaptions,
    ...(Object.keys(photoFocus).length ? { photoFocus } : {}),
  };

  const form = new FormData();
  for (const p of unique) {
    const buf = await sharp(p.file)
      .rotate()
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    form.append('photos', new Blob([buf], { type: 'image/jpeg' }), p.base + '.jpg');
  }
  // TEMPLATE=1..5 (or a style id) forces a template instead of the hash pick.
  const TEMPLATE_IDS = {
    1: 'hero-top-bleed', 2: 'hero-left-magazine', 3: 'hero-dominant-sidebar',
    4: 'sidebar-mods-bleed', 5: 'cross-gutter-mosaic',
  };
  if (process.env.TEMPLATE) {
    const style = TEMPLATE_IDS[process.env.TEMPLATE] || process.env.TEMPLATE;
    pageContent.layoutStyle = style;
    form.append('layoutStyle', style);
  }
  form.append('pageContent', JSON.stringify(pageContent));
  form.append('pageType', 'spread');
  form.append('format', 'png');

  const t0 = Date.now();
  const res = await fetch(`${apiBase}/api/generate-spread`, { method: 'POST', body: form });
  if (!res.ok || (res.headers.get('content-type') || '').includes('json')) {
    result.status = `FAILED (${res.status}): ${(await res.text()).slice(0, 200)}`;
    return result;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (res.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
  const outPath = path.join(outDir, `${spreadFolder}.${ext}`);
  fs.writeFileSync(outPath, buf);
  result.status = 'ok';
  result.out = outPath;
  result.seconds = Math.round((Date.now() - t0) / 1000);
  return result;
}

// ---------------------------------------------------------------------------
// Pair mode: two subjects on one split spread (Tpl 6), rendered locally
// through the same template engine + exporter the server uses.
//   node scripts/generate-from-pack.js pair 01_bible+02_english [outDir]
// ---------------------------------------------------------------------------
async function generatePair(pairSpec, sections, outDir) {
  const [fa, fb] = pairSpec.split('+');
  if (!SECTION_NAMES[fa] || !SECTION_NAMES[fb]) throw new Error(`unknown pair folders: ${pairSpec}`);
  const sharp = require('sharp');
  const { renderHandTemplate } = require('../src/services/templates');
  const { exportToFile } = require('../src/services/exporter');

  const halves = [];
  const allPhotos = [];
  const flags = [];
  for (const folder of [fa, fb]) {
    const sec = sections[SECTION_NAMES[folder]];
    const photosRaw = collectPhotos(folder, 6);
    await attachAspects(photosRaw);
    const halfFlags = auditSpread(folder, sec, photosRaw).map(f => `${folder}: ${f}`);
    flags.push(...halfFlags);
    if (!sec) throw new Error(`${folder}: no copy in compiled doc`);
    if (halfFlags.some(f => f.includes('NEEDS NAME'))) {
      return { spread: pairSpec, title: '(held)', photos: 0, quotes: 0, flags, status: 'skipped' };
    }
    // Perceptual dedupe within the half, then top 3 photos.
    const seen = [];
    const unique = [];
    for (const p of photosRaw) {
      const pxbuf = await sharp(p.file).rotate().grayscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
      const avg = pxbuf.reduce((x, y) => x + y, 0) / pxbuf.length;
      let bits = 0n;
      for (let i = 0; i < 64; i++) bits = (bits << 1n) | (pxbuf[i] > avg ? 1n : 0n);
      const ham = (x, y) => { let v = x ^ y, n = 0; while (v) { n += Number(v & 1n); v >>= 1n; } return n; };
      if (seen.some(s => ham(s, bits) <= 6)) continue;
      seen.push(bits);
      unique.push(p);
      if (unique.length === 5) break;
    }
    const capMap = manifestCaptions(folder);
    const seenCapText = new Set();
    const photoCaptions = unique.map((p, i) => {
      const cap = capMap[p.base] || '';
      if (!cap) return null;
      const norm = cap.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenCapText.has(norm)) return null;
      seenCapText.add(norm);
      return { photoIndex: i, caption: cap, people: '' };
    }).filter(Boolean);
    for (const p of unique) {
      const buf = await sharp(p.file).rotate().resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
      allPhotos.push({ base64: buf.toString('base64'), captioned: p.captioned });
    }
    halves.push({
      title: sec.title.toUpperCase(),
      section: SECTION_NAMES[folder],
      bodyCopy: sec.bodyCopy,
      quotes: sec.quotes,
      photoCaptions,
      _photoCount: unique.length,
    });
  }
  const pageContent = { split: halves, photoSplit: halves[0]._photoCount };
  const html = renderHandTemplate('split-academic', pageContent, allPhotos, { dpi: 450, variant: 0 });
  const t0 = Date.now();
  const out = await exportToFile(html, 'png', 'spread');
  const outPath = path.join(outDir, `${fa}+${fb}.${out.extension}`);
  fs.writeFileSync(outPath, out.buffer);
  return {
    spread: pairSpec,
    title: `${halves[0].title} / ${halves[1].title}`,
    photos: allPhotos.length, quotes: halves[0].quotes.length + halves[1].quotes.length,
    flags, status: 'ok', out: outPath, seconds: Math.round((Date.now() - t0) / 1000),
  };
}

async function main() {
  const [target, pairOrOutDir, outDirArg, apiBase = 'https://api.yearbook101.com'] = process.argv.slice(2);
  if (target === 'pair') {
    if (!pairOrOutDir || !pairOrOutDir.includes('+')) {
      console.error('Usage: node scripts/generate-from-pack.js pair <folderA>+<folderB> [outDir]');
      process.exit(1);
    }
    const outDir = (outDirArg || path.join(os.homedir(), 'Downloads', 'finished spreads')).replace(/^~/, os.homedir());
    fs.mkdirSync(outDir, { recursive: true });
    ensureCompiledTxt();
    const sections = parseCompiled(fs.readFileSync(COMPILED_TXT, 'utf8'));
    process.stdout.write(`${pairOrOutDir} … `);
    const r = await generatePair(pairOrOutDir, sections, outDir);
    console.log(`${r.status}${r.seconds ? ` (${r.seconds}s)` : ''}${r.flags.length ? ` | FLAGS: ${r.flags.join('; ')}` : ''}`);
    process.exit(r.status === 'ok' ? 0 : 1);
  }
  const outDirLegacy = pairOrOutDir;
  if (!target || (target !== 'all' && !SECTION_NAMES[target])) {
    console.error('Usage: node scripts/generate-from-pack.js <spreadFolder|all|pair a+b> [outDir] [apiBase]');
    process.exit(1);
  }
  const outDir = (outDirLegacy || path.join(os.homedir(), 'Downloads', 'finished spreads')).replace(/^~/, os.homedir());
  fs.mkdirSync(outDir, { recursive: true });
  ensureCompiledTxt();
  const sections = parseCompiled(fs.readFileSync(COMPILED_TXT, 'utf8'));

  const folders = target === 'all' ? Object.keys(SECTION_NAMES) : [target];
  const results = [];
  for (const folder of folders) {
    process.stdout.write(`${folder} … `);
    try {
      const r = await generateSpread(folder, sections, outDir, apiBase);
      results.push(r);
      console.log(`${r.status}${r.seconds ? ` (${r.seconds}s)` : ''}${r.flags.length ? ` | FLAGS: ${r.flags.join('; ')}` : ''}`);
    } catch (e) {
      results.push({ spread: folder, status: 'error: ' + e.message, flags: [] });
      console.log('error: ' + e.message);
    }
  }
  const reportPath = path.join(outDir, '_content_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  const flagged = results.filter(r => r.flags.length);
  console.log(`\nDone: ${results.filter(r => r.status === 'ok').length}/${results.length} generated. ${flagged.length} flagged. Report: ${reportPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
