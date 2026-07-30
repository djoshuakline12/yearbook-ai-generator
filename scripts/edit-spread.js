#!/usr/bin/env node
// Spread editor: open a spread in the browser, drag inside any photo to
// re-crop it, swap two photos between their blocks, then Save — producing
// <packFolder>/_layout_edit.json which generate-from-pack.js honors on
// every future render (crops override smart crop; the photo->slot order
// renders with aspect repair locked). Captions & badges follow their
// photos when the spread regenerates.
//
// Usage:
//   node scripts/edit-spread.js <spreadFolder>
//   TEMPLATE=5 MIRROR=1 node scripts/edit-spread.js 19_softball
//
// The preview renders locally (unpolished copy, default variant), so text
// lengths can differ slightly from the production spread — photo slots,
// crops, and ordering are what this tool is for.

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const sharp = require(path.join(REPO, 'node_modules', 'sharp'));
const { renderHandTemplate } = require(path.join(REPO, 'src', 'services', 'templates'));

// Reuse the generator's parsing/collection logic.
const gen = fs.readFileSync(path.join(__dirname, 'generate-from-pack.js'), 'utf8')
  .replace(/async function main[\s\S]*$/,
    'module.exports = { SECTION_NAMES, parseCompiled, ensureCompiledTxt, manifestCaptions, collectPhotos, COMPILED_TXT, PACK_DIR };');
const tmp = path.join(os.tmpdir(), 'gfp-editor-lib.js');
fs.writeFileSync(tmp, gen);
const { SECTION_NAMES, parseCompiled, ensureCompiledTxt, manifestCaptions, collectPhotos, COMPILED_TXT, PACK_DIR } = require(tmp);

// Hash-assigned templates per spread (from the 2026-07-29 variety audit);
// _layout_overrides.json and TEMPLATE/MIRROR env win over these.
const TPL_DEFAULT = {
  '12_praise_and_worship': 4, '13_gym_health': 1, '14_boys_soccer': 3,
  '16_boys_basketball': 5, '17_girls_basketball': 4, '18_baseball': 4,
  '19_softball': 1, '20_girls_volleyball': 1, '21_cheer': 2,
  '22_cross_country': 2, '23_field_hockey': 1,
  '24_chapel_and_community_groups': 2, '25_see_you_at_the_pole': 5,
  '26_freshman_retreat': 4, '27_senior_retreat': 4, '28_spirit_week': 2,
  '29_artist_showcase': 3, '30_christmas_show': 2,
  '31_spring_production_a_week_away': 1, '32_royal_ball': 2,
  '34_scholarship_banquet': 4, '35_grandparents_day': 2,
  '36_community_service': 5, '37_student_leadership_council_slc': 5,
  '39_senior_thesis_project_stp': 1, '40_graduation': 1,
  '42_collage_spread': 3, '43_jterm': 5,
};
const TEMPLATE_IDS = {
  1: 'hero-top-bleed', 2: 'hero-left-magazine', 3: 'hero-dominant-sidebar',
  4: 'sidebar-mods-bleed', 5: 'cross-gutter-mosaic',
};

// Academics run as split pairs (Josh 2026-07-28) — the editor rotation
// shows the pair spreads, never the full-spread academic versions.
const PAIRS = [
  '01_bible+02_english', '03_math+04_science',
  '05_history+06_spanish', '07_art+08_media',
];

async function buildOne(folder, navList) {
  let overrides = {};
  const ovPath = path.join(PACK_DIR, '_layout_overrides.json');
  if (fs.existsSync(ovPath)) overrides = JSON.parse(fs.readFileSync(ovPath, 'utf8'))[folder] || {};
  const tplN = process.env.TEMPLATE || overrides.template || TPL_DEFAULT[folder] || 5;
  const styleId = TEMPLATE_IDS[tplN] || tplN;
  const mirror = process.env.MIRROR != null ? process.env.MIRROR === '1' : !!overrides.mirror;
  const variant = mirror ? 4 : 0;

  ensureCompiledTxt();
  const sections = parseCompiled(fs.readFileSync(COMPILED_TXT, 'utf8'));
  const sec = sections[SECTION_NAMES[folder]];
  if (!sec) throw new Error('no copy in the compiled doc');

  // Photos: same collection + perceptual dedup as generate-from-pack.
  const collected = collectPhotos(folder);
  const ahash = async (file) => {
    const px = await sharp(file).rotate().grayscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
    const avg = px.reduce((a, b) => a + b, 0) / px.length;
    let bits = 0n;
    for (let i = 0; i < 64; i++) bits = (bits << 1n) | (px[i] > avg ? 1n : 0n);
    return bits;
  };
  const hamming = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
  const seen = [];
  const photos = [];
  for (const p of collected) {
    const h = await ahash(p.file);
    if (seen.some(s => hamming(s, h) <= 6)) continue;
    seen.push(h);
    const buf = await sharp(p.file).rotate().resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    const meta = await sharp(buf).metadata();
    photos.push({ base: p.base, captioned: p.captioned, base64: buf.toString('base64'), aspectRatio: meta.width / meta.height });
  }
  console.log(`${folder}: ${photos.length} photos, template ${tplN}${mirror ? ' (mirrored)' : ''}`);

  // Existing crop overrides show as the starting crop.
  const priorFocus = {};
  for (const [file, key] of [['_focus.json', null], ['_layout_edit.json', 'focus']]) {
    const fp = path.join(PACK_DIR, folder, file);
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    Object.assign(priorFocus, key ? (data[key] || {}) : data);
  }
  photos.forEach(p => { if (priorFocus[p.base]) p.objectPosition = priorFocus[p.base]; });

  const capMap = manifestCaptions(folder);
  const seenCapText = new Set();
  const photoCaptions = photos.map((p, i) => {
    const cap = capMap[p.base] || '';
    if (!cap) return null;
    const norm = cap.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenCapText.has(norm)) return null;
    seenCapText.add(norm);
    return { photoIndex: i, caption: cap, people: '' };
  }).filter(Boolean);

  const baseContent = {
    pageTitle: sec.title.toUpperCase(),
    section: SECTION_NAMES[folder],
    subheadline: sec.subheadline,
    bodyCopy: sec.bodyCopy,
    quotes: sec.quotes,
    highlights: sec.highlights,
    photoCaptions,
  };

  // Recover the aspect-repair slot assignment by diffing an automatic
  // render against a locked identity render: DOM img position j shows
  // photo p_j (auto) / slot index q_j (locked identity), so slot q_j
  // holds photo p_j. Template-agnostic — no slot tables needed.
  const srcKey = (s) => `${s.length}:${s.slice(-48)}`;
  const imgSrcs = (html) => [...html.matchAll(/<img[^>]*src="(data:image\/[^"]+)"/g)].map(m => m[1]);
  const keyToIdx = new Map(photos.map((p, i) => [srcKey(`data:image/jpeg;base64,${p.base64}`), i]));

  const autoHtml = renderHandTemplate(styleId, { ...baseContent }, photos, { dpi: 100, variant });
  const identHtml = renderHandTemplate(styleId, { ...baseContent, _lockOrder: true }, photos, { dpi: 100, variant });
  const autoIdx = imgSrcs(autoHtml).map(s => keyToIdx.get(srcKey(s)));
  const identIdx = imgSrcs(identHtml).map(s => keyToIdx.get(srcKey(s)));

  const order = photos.map((_, i) => i);  // slot -> photo index
  if (autoIdx.length === identIdx.length) {
    identIdx.forEach((slot, j) => {
      if (slot != null && autoIdx[j] != null) order[slot] = autoIdx[j];
    });
  }
  // Fill any photo lost by the mapping (shouldn't happen) and dedupe.
  const used = new Set();
  const finalOrder = [];
  for (const i of order) if (i != null && !used.has(i)) { used.add(i); finalOrder.push(i); }
  photos.forEach((_, i) => { if (!used.has(i)) finalOrder.push(i); });

  const photosOrdered = finalOrder.map(i => photos[i]);
  // Remap captions to the new indexes so the preview pairs them correctly.
  const capByOld = new Map(photoCaptions.map(c => [c.photoIndex, c.caption]));
  const orderedContent = {
    ...baseContent,
    photoCaptions: photosOrdered
      .map((p, i) => (capByOld.has(finalOrder[i]) ? { photoIndex: i, caption: capByOld.get(finalOrder[i]), people: '' } : null))
      .filter(Boolean),
    _lockOrder: true,
  };
  let html = renderHandTemplate(styleId, orderedContent, photosOrdered, { dpi: 100, variant });

  // ---- Editor chrome ----
  const photoMeta = photosOrdered.map(p => ({
    key: srcKey(`data:image/jpeg;base64,${p.base64}`),
    base: p.base,
    pos: p.objectPosition || '',
  }));
  const editorJs = editorChrome(folder, navList, photoMeta, null);

  html = html.replace('</body>', editorJs + '\n</body>');
  const outPath = path.join(PACK_DIR, '_review', `edit_${folder}.html`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`Editor: ${outPath}`);
  return outPath;
}

function editorChrome(label, navList, photoMeta, pair) {
  return `
<style>
  html { background: #2b2733; }
  body { width: auto !important; height: auto !important; overflow: auto !important; margin: 0; }
  #edbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #1d1926; color: #eee; font: 14px -apple-system, sans-serif;
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,.5);
  }
  #edbar select {
    font-size: 13px; padding: 5px 8px; border-radius: 6px; border: 1px solid #555;
    background: #35304a; color: #eee;
  }
  #edbar button {
    font-size: 13px; padding: 6px 14px; border-radius: 6px; border: 1px solid #555;
    background: #35304a; color: #eee; cursor: pointer;
  }
  #edbar button.active { background: #7c5cd6; border-color: #7c5cd6; }
  #edbar button#save { background: #2e7d32; border-color: #2e7d32; margin-left: auto; }
  #edbar .hint { color: #aaa; font-size: 12.5px; }
  #edwrap { margin: 58px auto 30px; transform-origin: top left; }
  .spread { box-shadow: 0 4px 24px rgba(0,0,0,.6); background: white; }
  img.ed-target { cursor: grab; }
  img.ed-changed { outline: 3px solid #2e7d32; outline-offset: -3px; }
  img.ed-selected { outline: 3px solid #ffb300 !important; outline-offset: -3px; }
  body.swapmode img.ed-target { cursor: pointer; }
</style>
<div id="edbar">
  <button id="prevBtn" title="Previous spread">&#8249;</button>
  <select id="navSel">${navList.map(f => `<option value="edit_${f}.html"${f === label ? ' selected' : ''}>${f}</option>`).join('')}</select>
  <button id="nextBtn" title="Next spread">&#8250;</button>
  <button id="cropBtn" class="active">Crop (drag inside a photo)</button>
  <button id="swapBtn">Swap (click two photos)</button>
  <button id="resetBtn">Reset</button>
  <span class="hint">Green outline = edited. Captions &amp; badges follow their photos when you regenerate.</span>
  <button id="save">Save layout file</button>
</div>
<script>
const FOLDER = ${JSON.stringify(label)};
const PAIR = ${JSON.stringify(pair)};          // {split, folderA} for academic pairs
const PHOTOS = ${JSON.stringify(photoMeta)};   // slot order
let ORDER = PHOTOS.map(p => p.base);           // slot index -> basename
const FOCUS = {};                              // basename -> "x% y%"
PHOTOS.forEach(p => { if (p.pos) FOCUS[p.base] = p.pos; });

const srcKey = s => s.length + ':' + s.slice(-48);
const keyToSlot = new Map(PHOTOS.map((p, i) => [p.key, i]));

// Scale the spread to the window.
const spread = document.querySelector('.spread');
const wrap = document.createElement('div');
wrap.id = 'edwrap';
spread.parentNode.insertBefore(wrap, spread);
wrap.appendChild(spread);
function rescale() {
  const s = Math.min(1, (window.innerWidth - 40) / spread.offsetWidth);
  wrap.style.transform = 'scale(' + s + ')';
  wrap.style.width = (spread.offsetWidth * s) + 'px';
  wrap.style.height = (spread.offsetHeight * s) + 'px';
}
window.addEventListener('resize', rescale);

// Tag images with their slot.
const imgs = [...document.querySelectorAll('.spread img')].filter(im => im.src.startsWith('data:image/'));
imgs.forEach(im => {
  const slot = keyToSlot.get(srcKey(im.getAttribute('src')));
  if (slot != null) { im.dataset.slot = slot; im.classList.add('ed-target'); }
});

let mode = 'crop';
const cropBtn = document.getElementById('cropBtn');
const swapBtn = document.getElementById('swapBtn');
function setMode(m) {
  mode = m;
  cropBtn.classList.toggle('active', m === 'crop');
  swapBtn.classList.toggle('active', m === 'swap');
  document.body.classList.toggle('swapmode', m === 'swap');
  if (selected) { selected.classList.remove('ed-selected'); selected = null; }
}
cropBtn.onclick = () => setMode('crop');
swapBtn.onclick = () => setMode('swap');

const baseOf = im => ORDER[+im.dataset.slot];

function parsePos(im) {
  const raw = im.style.objectPosition || getComputedStyle(im).objectPosition || '50% 35%';
  const norm = raw.replace('left', '0%').replace('right', '100%')
                  .replace('top', '0%').replace('bottom', '100%').replace(/center/g, '50%');
  const m = norm.match(/([\\d.]+)%\\s+([\\d.]+)%/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 35];
}

// Crop drag.
let drag = null;
document.addEventListener('pointerdown', e => {
  const im = e.target.closest('img.ed-target');
  if (!im) return;
  if (mode === 'swap') { handleSwapClick(im); e.preventDefault(); return; }
  const [x, y] = parsePos(im);
  drag = { im, sx: e.clientX, sy: e.clientY, x, y, rect: im.getBoundingClientRect() };
  im.style.cursor = 'grabbing';
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = (e.clientX - drag.sx) / drag.rect.width * 130;
  const dy = (e.clientY - drag.sy) / drag.rect.height * 130;
  const nx = Math.max(0, Math.min(100, drag.x - dx));
  const ny = Math.max(0, Math.min(100, drag.y - dy));
  drag.im.style.objectPosition = nx.toFixed(1) + '% ' + ny.toFixed(1) + '%';
});
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const im = drag.im;
  im.style.cursor = 'grab';
  FOCUS[baseOf(im)] = im.style.objectPosition;
  im.classList.add('ed-changed');
  drag = null;
});

// Swap.
let selected = null;
function handleSwapClick(im) {
  if (!selected) { selected = im; im.classList.add('ed-selected'); return; }
  if (selected === im) { im.classList.remove('ed-selected'); selected = null; return; }
  const a = selected, b = im;
  const sa = +a.dataset.slot, sb = +b.dataset.slot;
  if (PAIR && (sa < PAIR.split) !== (sb < PAIR.split)) {
    alert('Photos stay within their class — swap within the same half of the spread.');
    a.classList.remove('ed-selected'); selected = null; return;
  }
  [ORDER[sa], ORDER[sb]] = [ORDER[sb], ORDER[sa]];
  const tmpSrc = a.getAttribute('src');
  a.setAttribute('src', b.getAttribute('src'));
  b.setAttribute('src', tmpSrc);
  const posA = FOCUS[ORDER[sa]] || '', posB = FOCUS[ORDER[sb]] || '';
  a.style.objectPosition = posA; b.style.objectPosition = posB;
  a.classList.add('ed-changed'); b.classList.add('ed-changed');
  a.classList.remove('ed-selected');
  selected = null;
}

document.getElementById('resetBtn').onclick = () => location.reload();

// Spread navigation. Warn if there are unsaved edits.
let dirty = false;
document.addEventListener('pointerup', () => { setTimeout(() => { dirty = document.querySelectorAll('img.ed-changed').length > 0; }, 0); });
function go(href) {
  if (dirty && !confirm('Unsaved edits on this spread — leave anyway?')) return;
  location.href = href;
}
const navSel = document.getElementById('navSel');
navSel.onchange = () => go(navSel.value);
document.getElementById('prevBtn').onclick = () => { if (navSel.selectedIndex > 0) { navSel.selectedIndex--; go(navSel.value); } };
document.getElementById('nextBtn').onclick = () => { if (navSel.selectedIndex < navSel.options.length - 1) { navSel.selectedIndex++; go(navSel.value); } };

document.getElementById('save').onclick = () => {
  const out = PAIR
    ? { orderA: ORDER.slice(0, PAIR.split), orderB: ORDER.slice(PAIR.split), focus: FOCUS }
    : { order: ORDER, focus: FOCUS };
  const destFolder = PAIR ? PAIR.folderA : FOLDER;
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const aEl = document.createElement('a');
  aEl.href = URL.createObjectURL(blob);
  aEl.download = '_layout_edit.json';
  aEl.click();
  alert('Saved _layout_edit.json to Downloads.\\n\\nMove it into yearbook_import_pack/' + destFolder + '/ (replacing any old one) and regenerate the spread.');
};

rescale();
</script>`;

}

// Academic pair spreads (Tpl6): identity slot order (no aspect repair),
// two halves, photos never cross the class boundary.
async function buildPair(pairSpec, navList) {
  const [fa, fb] = pairSpec.split('+');
  ensureCompiledTxt();
  const sections = parseCompiled(fs.readFileSync(COMPILED_TXT, 'utf8'));
  const halves = [];
  const photosOrdered = [];
  for (const folder of [fa, fb]) {
    const sec = sections[SECTION_NAMES[folder]];
    if (!sec) throw new Error(folder + ': no copy in the compiled doc');
    const collected = collectPhotos(folder, 6);
    const seen = [];
    const unique = [];
    for (const p of collected) {
      const px = await sharp(p.file).rotate().grayscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
      const avg = px.reduce((a, b) => a + b, 0) / px.length;
      let bits = 0n;
      for (let i = 0; i < 64; i++) bits = (bits << 1n) | (px[i] > avg ? 1n : 0n);
      const ham = (x, y) => { let v = x ^ y, n = 0; while (v) { n += Number(v & 1n); v >>= 1n; } return n; };
      if (seen.some(sb => ham(sb, bits) <= 6)) continue;
      seen.push(bits);
      unique.push(p);
      if (unique.length === 5) break;
    }
    // Existing pair edits (stored in folder A) shape the starting state.
    let pe = null;
    const pePath = path.join(PACK_DIR, fa, '_layout_edit.json');
    if (fs.existsSync(pePath)) pe = JSON.parse(fs.readFileSync(pePath, 'utf8'));
    const halfOrder = pe && (folder === fa ? pe.orderA : pe.orderB);
    if (Array.isArray(halfOrder)) {
      const byBase = new Map(unique.map(p => [p.base, p]));
      const ordered = halfOrder.map(b => byBase.get(b)).filter(Boolean);
      const rest = unique.filter(p => !halfOrder.includes(p.base));
      unique.length = 0;
      unique.push(...ordered, ...rest);
    }
    const capMap = manifestCaptions(folder);
    const seenCap = new Set();
    const photoCaptions = [];
    const halfPhotos = [];
    for (const [i, p] of unique.entries()) {
      const buf = await sharp(p.file).rotate().resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
      const meta = await sharp(buf).metadata();
      const ph = { base: p.base, captioned: p.captioned, base64: buf.toString('base64'), aspectRatio: meta.width / meta.height };
      if (pe && pe.focus && pe.focus[p.base]) ph.objectPosition = pe.focus[p.base];
      halfPhotos.push(ph);
      const cap = capMap[p.base] || '';
      const norm = cap.toLowerCase().replace(/\s+/g, ' ').trim();
      if (cap && !seenCap.has(norm)) { seenCap.add(norm); photoCaptions.push({ photoIndex: i, caption: cap, people: '' }); }
    }
    photosOrdered.push(...halfPhotos);
    halves.push({
      title: sec.title.toUpperCase(),
      section: SECTION_NAMES[folder],
      bodyCopy: sec.bodyCopy,
      quotes: sec.quotes,
      photoCaptions,
      _photoCount: halfPhotos.length,
    });
  }
  console.log(`${pairSpec}: ${photosOrdered.length} photos, split-academic`);
  const pageContent = { split: halves, photoSplit: halves[0]._photoCount };
  let html = renderHandTemplate('split-academic', pageContent, photosOrdered, { dpi: 100, variant: 0 });
  const srcKey = (str) => `${str.length}:${str.slice(-48)}`;
  const photoMeta = photosOrdered.map(p => ({
    key: srcKey(`data:image/jpeg;base64,${p.base64}`),
    base: p.base,
    pos: p.objectPosition || '',
  }));
  const editorJs = editorChrome(pairSpec, navList, photoMeta, { split: halves[0]._photoCount, folderA: fa });
  html = html.replace('</body>', editorJs + '\n</body>');
  const outPath = path.join(PACK_DIR, '_review', `edit_${pairSpec}.html`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`Editor: ${outPath}`);
  return outPath;
}

async function main() {
  const arg = process.argv[2];
  const nonAcademic = Object.keys(SECTION_NAMES).filter(f => !/^0[1-8]_/.test(f));
  const navList = [...PAIRS, ...nonAcademic];
  const valid = arg === 'all' || navList.includes(arg) || SECTION_NAMES[arg];
  if (!arg || !valid) {
    console.error('Usage: node scripts/edit-spread.js <spreadFolder|pairA+pairB>|all');
    console.error('Spreads:', navList.join(', '));
    process.exit(1);
  }
  const specs = arg === 'all' ? navList : [arg];
  const built = [];
  for (const f of specs) {
    try {
      built.push(f.includes('+') ? await buildPair(f, navList) : await buildOne(f, navList));
    } catch (e) {
      console.log(`${f}: skipped (${e.message.split('\n')[0]})`);
    }
  }
  if (built.length) require('child_process').execFileSync('open', [built[0]]);
}

main().catch(e => { console.error(e); process.exit(1); });
