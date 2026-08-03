#!/usr/bin/env node
// Spread editor.
//
//   node scripts/edit-spread.js serve            <- the good way: local server,
//        saves write straight into the pack, print-quality downloads work,
//        face-crop warnings live. Opens http://localhost:4477
//   node scripts/edit-spread.js <spread|pair>    <- build one static page
//   node scripts/edit-spread.js all              <- build every static page
//
// In the editor: drag inside a photo to re-crop - click two photos (Swap
// mode) to trade blocks - double-click a caption (or a photo) to edit its
// caption - Save writes <folder>/_layout_edit.json (order + focus +
// captions), honored by generate-from-pack.js on every future render.
// Captions and number badges follow their photos when the spread
// regenerates. Face boxes come from scripts/detect_faces.py (detection
// only — no identification; names stay human-verified).

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const sharp = require(path.join(REPO, 'node_modules', 'sharp'));
const { renderHandTemplate } = require(path.join(REPO, 'src', 'services', 'templates'));
const { escapeHtml } = require(path.join(REPO, 'src', 'services', 'templates', 'utils'));
const { scoreSpread, adviceFor } = require('./lib-quality');

// Reuse the generator's parsing/collection logic.
const gen = fs.readFileSync(path.join(__dirname, 'generate-from-pack.js'), 'utf8')
  .replace(/async function main[\s\S]*$/,
    'module.exports = { SECTION_NAMES, parseCompiled, ensureCompiledTxt, manifestCaptions, collectPhotos, COMPILED_TXT, PACK_DIR };');
const tmp = path.join(os.tmpdir(), 'gfp-editor-lib.js');
fs.writeFileSync(tmp, gen);
const { SECTION_NAMES, parseCompiled, ensureCompiledTxt, manifestCaptions, collectPhotos, COMPILED_TXT, PACK_DIR } = require(tmp);

// Hash-assigned templates per spread (2026-07-29 variety audit);
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
  '15_girls_soccer': 4, '44_swim': 4, '45_golf': 5, '46_collage_2': 4,
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

const REVIEW_DIR = path.join(PACK_DIR, '_review');
const PHOTO_FILES = {};   // base -> absolute source file (for face detection)

const srcKey = (s) => `${s.length}:${s.slice(-48)}`;
const imgSrcs = (html) => [...html.matchAll(/<img[^>]*src="(data:image\/[^"]+)"/g)].map(m => m[1]);

async function dedupTop(collected, cap, pins) {
  const seen = [];
  const out = [];
  for (const p of collected) {
    const px = await sharp(p.file).rotate().grayscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
    const avg = px.reduce((a, b) => a + b, 0) / px.length;
    let bits = 0n;
    for (let i = 0; i < 64; i++) bits = (bits << 1n) | (px[i] > avg ? 1n : 0n);
    const ham = (x, y) => { let v = x ^ y, n = 0; while (v) { n += Number(v & 1n); v >>= 1n; } return n; };
    if (!(pins && pins.has(p.base)) && seen.some(s => ham(s, bits) <= 6)) continue;
    seen.push(bits);
    out.push(p);
    if (cap && out.length >= cap && !(pins && pins.size)) break;
  }
  return out;
}

async function loadBench(p, capMap) {
  const buf = await sharp(p.file).rotate().resize(480, 480, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 68 }).toBuffer();
  const meta = await sharp(buf).metadata();
  PHOTO_FILES[p.base] = p.file;
  return {
    base: p.base,
    src: `data:image/jpeg;base64,${buf.toString('base64')}`,
    ar: +(meta.width / meta.height).toFixed(4),
    cap: capMap[p.base] || '',
  };
}

async function loadPhoto(p) {
  const meta0 = await sharp(p.file).metadata();
  const rot = (meta0.orientation || 1) >= 5;
  const w0 = rot ? meta0.height : meta0.width;
  const h0 = rot ? meta0.width : meta0.height;
  const buf = await sharp(p.file).rotate().resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  const meta = await sharp(buf).metadata();
  PHOTO_FILES[p.base] = p.file;
  return {
    base: p.base, captioned: p.captioned,
    base64: buf.toString('base64'), aspectRatio: meta.width / meta.height,
    longSide: Math.max(w0 || 0, h0 || 0),
  };
}

// Apply saved text edits to a parsed section (prefix '' or 'a:'/'b:').
function applyTextEdits(sec, text, prefix) {
  const pick = (k) => text[prefix + k];
  if (pick('title')) sec.title = pick('title');
  if (pick('subheadline')) sec.subheadline = pick('subheadline');
  const paras = (sec.bodyCopy || '').split(/\n\s*\n/).filter(t => t.trim());
  let changed = false;
  paras.forEach((t, i) => { if (pick('body:' + i)) { paras[i] = pick('body:' + i); changed = true; } });
  if (changed) sec.bodyCopy = paras.join('\n\n');
  (sec.quotes || []).forEach((q, i) => { if (pick('quote:' + i)) q.text = pick('quote:' + i); });
}

function readEdit(folder) {
  const fp = path.join(PACK_DIR, folder, '_layout_edit.json');
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null;
}

function holdFlagsFor(spec) {
  try {
    const rep = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Downloads', 'finished spreads', '_content_report.json'), 'utf8'));
    const e = rep.find(r => r.spread === spec);
    return e ? e.flags : [];
  } catch { return []; }
}

// Wrap title/tagline/body/quote texts so they're double-click editable.
// Matching is exact-text (post-escape); split or truncated renders stay
// read-only. Keys: title, subheadline, body:N, quote:N (pairs prefix a:/b:).
function tagText(html, fields) {
  for (const [key, text] of Object.entries(fields)) {
    if (!text) continue;
    const esc = escapeHtml(text);
    if (html.includes(esc)) {
      html = html.replace(esc, `<span class="textline" data-textfield="${key}">${esc}</span>`);
    }
  }
  return html;
}

function textFieldsFor(sec, prefix) {
  const f = {};
  const pre = prefix || '';
  if (sec.title) f[pre + 'title'] = sec.title.toUpperCase();
  if (sec.subheadline) f[pre + 'subheadline'] = sec.subheadline.toUpperCase();
  (sec.bodyCopy || '').split(/\n\s*\n/).filter(t => t.trim()).forEach((t, i) => { f[pre + 'body:' + i] = t.trim(); });
  (sec.quotes || []).forEach((q, i) => { if (q && q.text) f[pre + 'quote:' + i] = q.text; });
  return f;
}

// Wrap caption texts so the client can live-update them on swaps/edits.
function tagCaptions(html, capByBase) {
  for (const [base, cap] of Object.entries(capByBase)) {
    if (!cap) continue;
    const esc = escapeHtml(cap);
    if (html.includes(esc)) {
      html = html.replace(esc, `<span class="capline" data-capbase="${base}">${esc}</span>`);
    }
  }
  return html;
}

// ---------------------------------------------------------------------------
// Single-spread build
// ---------------------------------------------------------------------------
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

  const edit = readEdit(folder);
  if (edit && edit.text) applyTextEdits(sec, edit.text, '');
  const pins = new Set(edit && Array.isArray(edit.order) ? edit.order : []);
  // Full pool: on-spread photos plus the bench for the Replace tray.
  const pool = await dedupTop(collectPhotos(folder, 60), 0, pins);
  const onCount = Math.max(13, pins.size ? [...pins].filter(b => pool.some(p => p.base === b)).length : 0);
  let poolOrdered = pool;
  if (pins.size) {
    const byBase = new Map(pool.map(p => [p.base, p]));
    const ordered = (edit.order || []).map(b => byBase.get(b)).filter(Boolean);
    poolOrdered = [...ordered, ...pool.filter(p => !pins.has(p.base))];
  }
  const spreadSet = poolOrdered.slice(0, Math.min(13, poolOrdered.length));
  const benchSet = poolOrdered.slice(spreadSet.length, spreadSet.length + 40);
  // Official team photos ride the bench unless a saved layout picked them.
  const dirFiles = fs.readdirSync(path.join(PACK_DIR, folder)).filter(f => f.startsWith('z_teamphoto') && /\.jpe?g$/i.test(f));
  for (const f of dirFiles) {
    const base = f.replace(/\.\w+$/, '');
    if (!spreadSet.some(p => p.base === base) && !benchSet.some(p => p.base === base)) {
      benchSet.push({ file: path.join(PACK_DIR, folder, f), base, captioned: true });
    }
  }
  const photos = [];
  for (const p of spreadSet) photos.push(await loadPhoto(p));
  console.log(`${folder}: ${photos.length} photos (+${benchSet.length} bench), template ${tplN}${mirror ? ' (mirrored)' : ''}`);
  const priorFocus = {};
  const fPath = path.join(PACK_DIR, folder, '_focus.json');
  if (fs.existsSync(fPath)) Object.assign(priorFocus, JSON.parse(fs.readFileSync(fPath, 'utf8')));
  if (edit && edit.focus) Object.assign(priorFocus, edit.focus);
  photos.forEach(p => { if (priorFocus[p.base]) p.objectPosition = priorFocus[p.base]; });

  const capMap = manifestCaptions(folder);
  if (edit && edit.captions) Object.assign(capMap, edit.captions);
  const capByBase = {};
  photos.forEach(p => { capByBase[p.base] = capMap[p.base] || ''; });
  const bench = [];
  for (const p of benchSet) bench.push(await loadBench(p, capMap));
  const seenCapText = new Set();
  const photoCaptions = photos.map((p, i) => {
    const cap = capByBase[p.base];
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

  // Recover the aspect-repair slot assignment (or honor a saved order) by
  // diffing an automatic render against a locked identity render.
  const keyToIdx = new Map(photos.map((p, i) => [srcKey(`data:image/jpeg;base64,${p.base64}`), i]));
  let finalOrder;
  if (edit && Array.isArray(edit.order)) {
    const idxByBase = new Map(photos.map((p, i) => [p.base, i]));
    finalOrder = edit.order.map(b => idxByBase.get(b)).filter(i => i != null);
    photos.forEach((_, i) => { if (!finalOrder.includes(i)) finalOrder.push(i); });
  } else {
    const autoHtml = renderHandTemplate(styleId, { ...baseContent }, photos, { dpi: 100, variant });
    const identHtml = renderHandTemplate(styleId, { ...baseContent, _lockOrder: true }, photos, { dpi: 100, variant });
    const autoIdx = imgSrcs(autoHtml).map(s => keyToIdx.get(srcKey(s)));
    const identIdx = imgSrcs(identHtml).map(s => keyToIdx.get(srcKey(s)));
    const order = photos.map((_, i) => i);
    if (autoIdx.length === identIdx.length) {
      identIdx.forEach((slot, j) => {
        if (slot != null && autoIdx[j] != null) order[slot] = autoIdx[j];
      });
    }
    const used = new Set();
    finalOrder = [];
    for (const i of order) if (i != null && !used.has(i)) { used.add(i); finalOrder.push(i); }
    photos.forEach((_, i) => { if (!used.has(i)) finalOrder.push(i); });
  }

  const photosOrdered = finalOrder.map(i => photos[i]);
  const capByOld = new Map(photoCaptions.map(c => [c.photoIndex, c.caption]));
  const orderedContent = {
    ...baseContent,
    photoCaptions: photosOrdered
      .map((p, i) => (capByOld.has(finalOrder[i]) ? { photoIndex: i, caption: capByOld.get(finalOrder[i]), people: '' } : null))
      .filter(Boolean),
    _lockOrder: true,
  };
  let html = renderHandTemplate(styleId, orderedContent, photosOrdered, { dpi: 100, variant });
  html = tagCaptions(html, capByBase);
  html = tagText(html, textFieldsFor(sec, ''));

  const quality = buildQuality(photosOrdered, capByBase, sec, holdFlagsFor(folder));
  return finishPage(html, folder, navList, photosOrdered, null, quality, bench);
}

// ---------------------------------------------------------------------------
// Academic pair build (Tpl6 — identity slot order, halves stay separate)
// ---------------------------------------------------------------------------
async function buildPair(pairSpec, navList) {
  const [fa, fb] = pairSpec.split('+');
  ensureCompiledTxt();
  const sections = parseCompiled(fs.readFileSync(COMPILED_TXT, 'utf8'));
  const pe = readEdit(fa);
  const halves = [];
  const photosOrdered = [];
  const capByBase = {};
  const benchAll = [];
  let bodyLen = 0, quoteCount = 0, statsCount = 0, hasTagline = false;
  for (const folder of [fa, fb]) {
    const sec = sections[SECTION_NAMES[folder]];
    if (!sec) throw new Error(folder + ': no copy in the compiled doc');
    if (pe && pe.text) applyTextEdits(sec, pe.text, folder === fa ? 'a:' : 'b:');
    bodyLen += (sec.bodyCopy || '').length;
    quoteCount += (sec.quotes || []).length;
    statsCount += (sec.highlights || []).length;
    hasTagline = hasTagline || !!sec.subheadline;
    const halfOrder = pe && (folder === fa ? pe.orderA : pe.orderB);
    const halfPins = new Set(Array.isArray(halfOrder) ? halfOrder : []);
    const halfPool = await dedupTop(collectPhotos(folder, 30), 0, halfPins);
    let poolOrdered = halfPool;
    if (halfPins.size) {
      const byBase = new Map(halfPool.map(p => [p.base, p]));
      const ordered = halfOrder.map(b => byBase.get(b)).filter(Boolean);
      poolOrdered = [...ordered, ...halfPool.filter(p => !halfPins.has(p.base))];
    }
    const unique = poolOrdered.slice(0, Math.min(5, poolOrdered.length));
    const halfBench = poolOrdered.slice(unique.length, unique.length + 20);
    const capMap = manifestCaptions(folder);
    if (pe && pe.captions) Object.assign(capMap, pe.captions);
    for (const bp of halfBench) {
      const be = await loadBench(bp, capMap);
      be.half = folder === fa ? 0 : 1;
      benchAll.push(be);
    }
    const seenCap = new Set();
    const photoCaptions = [];
    const halfPhotos = [];
    for (const [i, p] of unique.entries()) {
      const ph = await loadPhoto(p);
      if (pe && pe.focus && pe.focus[p.base]) ph.objectPosition = pe.focus[p.base];
      halfPhotos.push(ph);
      const cap = capMap[p.base] || '';
      capByBase[p.base] = cap;
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
  html = tagCaptions(html, capByBase);
  html = tagText(html, { ...textFieldsFor(sections[SECTION_NAMES[fa]], 'a:'), ...textFieldsFor(sections[SECTION_NAMES[fb]], 'b:') });

  const quality = buildQuality(photosOrdered, capByBase,
    { bodyCopy: 'x'.repeat(bodyLen), quotes: new Array(quoteCount), highlights: new Array(statsCount), subheadline: hasTagline ? 'x' : '' },
    holdFlagsFor(pairSpec));
  return finishPage(html, pairSpec, navList, photosOrdered,
    { split: halves[0]._photoCount, folderA: fa }, quality, benchAll);
}

function buildQuality(photos, capByBase, sec, holdFlags) {
  const input = {
    photoCount: photos.length,
    captionedCount: photos.filter(p => capByBase[p.base]).length,
    aspects: photos.map(p => p.aspectRatio),
    minLongSide: photos.length ? Math.min(...photos.map(p => p.longSide || 0)) : 0,
    bodyLen: (sec.bodyCopy || '').length,
    quoteCount: (sec.quotes || []).length,
    hasTagline: !!sec.subheadline,
    statsCount: (sec.highlights || []).length,
    holdFlags,
  };
  const { score, parts } = scoreSpread(input);
  return { score, parts, tips: adviceFor(parts, input) };
}

function finishPage(html, label, navList, photosOrdered, pair, quality, bench) {
  const photoMeta = photosOrdered.map(p => ({
    key: srcKey(`data:image/jpeg;base64,${p.base64}`),
    base: p.base,
    pos: p.objectPosition || '',
    ar: +p.aspectRatio.toFixed(4),
  }));
  const editorJs = editorChrome(label, navList, photoMeta, pair, quality, bench || []);
  html = html.replace('</body>', editorJs + '\n</body>');
  const outPath = path.join(REVIEW_DIR, `edit_${label}.html`);
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`Editor: ${outPath}  (quality ${quality.score}/100)`);
  return outPath;
}

// ---------------------------------------------------------------------------
// Editor chrome (toolbar + interactions), served or static
// ---------------------------------------------------------------------------
function editorChrome(label, navList, photoMeta, pair, quality, bench) {
  const qColor = quality.score >= 85 ? '#2e7d32' : quality.score >= 65 ? '#e08700' : '#c62828';
  return `
<style>
  html { background: #2b2733; }
  body { width: auto !important; height: auto !important; overflow: auto !important; margin: 0; }
  #edbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #1d1926; color: #eee; font: 14px -apple-system, sans-serif;
    display: flex; align-items: center; gap: 8px; padding: 10px 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,.5); flex-wrap: wrap;
  }
  #edbar select {
    font-size: 13px; padding: 5px 8px; border-radius: 6px; border: 1px solid #555;
    background: #35304a; color: #eee; max-width: 230px;
  }
  #edbar button {
    font-size: 13px; padding: 6px 12px; border-radius: 6px; border: 1px solid #555;
    background: #35304a; color: #eee; cursor: pointer;
  }
  #edbar button.active { background: #7c5cd6; border-color: #7c5cd6; }
  #edbar button#save { background: #2e7d32; border-color: #2e7d32; }
  #edbar button#print { background: #1565c0; border-color: #1565c0; }
  #edbar button:disabled { opacity: .5; cursor: wait; }
  #edbar .hint { color: #aaa; font-size: 12px; }
  #qbadge {
    background: ${qColor}; color: white; border-radius: 12px; padding: 4px 12px;
    font-weight: 700; cursor: help; font-size: 13px;
  }
  #edwrap { margin: 58px auto 30px; transform-origin: top left; position: relative; }
  .spread { box-shadow: 0 4px 24px rgba(0,0,0,.6); background: white; }
  img.ed-target { cursor: grab; }
  img.ed-changed { outline: 3px solid #2e7d32; outline-offset: -3px; }
  img.ed-selected { outline: 3px solid #ffb300 !important; outline-offset: -3px; }
  body.swapmode img.ed-target { cursor: pointer; }
  .capline { cursor: text; }
  .textline { cursor: text; }
  .textline.ed-changed-cap { background: rgba(46,125,50,.14); outline: 1px dashed #2e7d32; }
  #tmodal {
    display: none; position: fixed; inset: 0; z-index: 10000;
    background: rgba(0,0,0,.55); align-items: center; justify-content: center;
  }
  #tmodal.open { display: flex; }
  #tmodal .box {
    background: white; border-radius: 10px; padding: 18px; width: min(680px, 90vw);
    font: 14px -apple-system, sans-serif;
  }
  #tmodal textarea {
    width: 100%; min-height: 140px; font: 14px -apple-system, sans-serif;
    padding: 10px; border: 1px solid #bbb; border-radius: 6px; box-sizing: border-box;
  }
  #tmodal .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
  #tmodal button { padding: 7px 16px; border-radius: 6px; border: 1px solid #999; cursor: pointer; }
  #tmodal button.primary { background: #2e7d32; border-color: #2e7d32; color: white; }
  .capline.ed-changed-cap { background: rgba(46,125,50,.18); outline: 1px dashed #2e7d32; }
  .facebox { position: absolute; border: 2px solid #00e5ff; border-radius: 3px; pointer-events: none; z-index: 5; }
  .facebox.out { border-color: #ff1744; border-style: dashed; }
  .facewarn {
    position: absolute; z-index: 6; background: #c62828; color: white;
    font: 700 11px -apple-system, sans-serif; padding: 2px 7px; border-radius: 10px;
    pointer-events: none;
  }
  #tray {
    display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 9998;
    background: #1d1926; padding: 10px 14px; box-shadow: 0 -2px 12px rgba(0,0,0,.5);
    max-height: 200px; overflow-x: auto; white-space: nowrap;
  }
  #tray.open { display: block; }
  #tray .thead { color: #ccc; font: 13px -apple-system, sans-serif; margin-bottom: 8px; }
  #tray img {
    height: 120px; width: auto; margin-right: 8px; border-radius: 4px;
    cursor: pointer; border: 2px solid transparent; display: inline-block; vertical-align: top;
  }
  #tray img:hover { border-color: #7c5cd6; }
  #tray .empty { color: #888; font: 13px -apple-system, sans-serif; }
</style>
<div id="tmodal"><div class="box"><div id="tmTitle" style="font-weight:700;margin-bottom:8px;"></div><textarea id="tmText"></textarea><div class="row"><button id="tmCancel">Cancel</button><button id="tmSave" class="primary">Apply</button></div><div style="color:#777;font-size:12px;margin-top:8px;">Edited text is locked verbatim — the AI copy polisher will not rewrite it.</div></div></div>
<div id="tray"><div class="thead">Pick a replacement — captions &amp; crops follow the photo. <span id="trayClose" style="float:right;cursor:pointer;color:#aaa;">✕ close</span></div><div id="trayItems"></div></div>
<div id="edbar">
  <button id="prevBtn" title="Previous spread">&#8249;</button>
  <select id="navSel">${navList.map(f => `<option value="edit_${f}.html"${f === label ? ' selected' : ''}>${f}</option>`).join('')}</select>
  <button id="nextBtn" title="Next spread">&#8250;</button>
  <span id="qbadge" title="${escapeHtml(quality.tips.length ? 'To improve: ' + quality.tips.join(' | ') : 'No issues found')}">${quality.score}</span>
  <button id="cropBtn" class="active">Crop</button>
  <button id="swapBtn">Swap</button>
  <button id="replBtn">Replace</button>
  <button id="facesBtn">Faces</button>
  <button id="resetBtn">Reset</button>
  <span class="hint">Drag = crop &middot; Replace = pick from unused photos &middot; dbl-click = edit caption</span>
  <button id="save">Save</button>
  <button id="print" title="Render at print quality via the production pipeline">Print PNG 600 DPI</button>
</div>
<script>
const FOLDER = ${JSON.stringify(label)};
const PAIR = ${JSON.stringify(pair)};
const PHOTOS = ${JSON.stringify(photoMeta)};   // slot order
const SERVED = location.protocol.startsWith('http');
let ORDER = PHOTOS.map(function(p) { return p.base; });
const FOCUS = {};
const CAP_EDITS = {};
const TEXT_EDITS = {};
PHOTOS.forEach(function(p) { if (p.pos) FOCUS[p.base] = p.pos; });
const AR = {}; PHOTOS.forEach(function(p) { AR[p.base] = p.ar; });
const BENCH = ${JSON.stringify(bench)};   // replacement pool (off-spread)
const CAPS = {};
BENCH.forEach(function(b) { AR[b.base] = b.ar; if (b.cap) CAPS[b.base] = b.cap; });
document.querySelectorAll('.capline').forEach(function(n) { CAPS[n.getAttribute('data-capbase')] = n.textContent; });
let FACES = null;

const srcKey = function(s) { return s.length + ':' + s.slice(-48); };
const keyToSlot = new Map(PHOTOS.map(function(p, i) { return [p.key, i]; }));

const spread = document.querySelector('.spread');
const wrap = document.createElement('div');
wrap.id = 'edwrap';
spread.parentNode.insertBefore(wrap, spread);
wrap.appendChild(spread);
let SCALE = 1;
function rescale() {
  SCALE = Math.min(1, (window.innerWidth - 40) / spread.offsetWidth);
  wrap.style.transform = 'scale(' + SCALE + ')';
  wrap.style.width = (spread.offsetWidth * SCALE) + 'px';
  wrap.style.height = (spread.offsetHeight * SCALE) + 'px';
}
window.addEventListener('resize', function() { rescale(); refreshFaces(); });

const imgs = Array.from(document.querySelectorAll('.spread img')).filter(function(im) { return im.src.startsWith('data:image/'); });
imgs.forEach(function(im) {
  const slot = keyToSlot.get(srcKey(im.getAttribute('src')));
  if (slot != null) { im.dataset.slot = slot; im.classList.add('ed-target'); }
});

let mode = 'crop';
const cropBtn = document.getElementById('cropBtn');
const swapBtn = document.getElementById('swapBtn');
const replBtn = document.getElementById('replBtn');
function setMode(m) {
  mode = m;
  cropBtn.classList.toggle('active', m === 'crop');
  swapBtn.classList.toggle('active', m === 'swap');
  replBtn.classList.toggle('active', m === 'replace');
  document.body.classList.toggle('swapmode', m !== 'crop');
  if (m !== 'replace') closeTray();
  if (selected) { selected.classList.remove('ed-selected'); selected = null; }
}
cropBtn.onclick = function() { setMode('crop'); };
swapBtn.onclick = function() { setMode('swap'); };
replBtn.onclick = function() { setMode('replace'); };

// ---- replace (bench tray) ----
const tray = document.getElementById('tray');
const trayItems = document.getElementById('trayItems');
let replaceTarget = null;
document.getElementById('trayClose').onclick = closeTray;
function closeTray() {
  tray.classList.remove('open');
  if (replaceTarget) { replaceTarget.classList.remove('ed-selected'); replaceTarget = null; }
}
function openTray(im) {
  replaceTarget = im;
  im.classList.add('ed-selected');
  const slot = +im.dataset.slot;
  const half = PAIR ? (slot < PAIR.split ? 0 : 1) : null;
  const usable = BENCH.filter(function(b) { return half == null || b.half === half; });
  trayItems.innerHTML = usable.length
    ? usable.map(function(b, i) { return '<img src="' + b.src + '" data-bi="' + BENCH.indexOf(b) + '" title="' + (b.cap || b.base) + '">'; }).join('')
    : '<span class="empty">No unused photos left in this folder' + (half != null ? ' half' : '') + '.</span>';
  tray.classList.add('open');
}
trayItems.addEventListener('click', function(e) {
  const t = e.target.closest('img[data-bi]');
  if (!t || !replaceTarget) return;
  const b = BENCH[+t.dataset.bi];
  const im = replaceTarget;
  const slot = +im.dataset.slot;
  const oldBase = ORDER[slot];
  // displaced photo goes back to the bench (keep its full-res src)
  BENCH.push({ base: oldBase, src: im.getAttribute('src'), ar: AR[oldBase] || 1.5, cap: CAPS[oldBase] || '', half: b.half });
  BENCH.splice(BENCH.indexOf(b), 1);
  ORDER[slot] = b.base;
  im.setAttribute('src', b.src);
  im.style.objectPosition = FOCUS[b.base] || '';
  // caption follows the photo
  const node = capNodeFor(oldBase);
  if (node) {
    if (b.cap || CAPS[b.base]) {
      node.textContent = CAPS[b.base] || b.cap;
      node.setAttribute('data-capbase', b.base);
    } else {
      node.textContent = '(caption needed — dbl-click to write one)';
      node.setAttribute('data-capbase', b.base);
      node.classList.add('ed-changed-cap');
    }
  }
  im.classList.add('ed-changed');
  markDirty();
  closeTray();
  refreshFaces();
});

const baseOf = function(im) { return ORDER[+im.dataset.slot]; };

function parsePos(im) {
  const raw = im.style.objectPosition || getComputedStyle(im).objectPosition || '50% 35%';
  const norm = raw.replace('left', '0%').replace('right', '100%')
                  .replace('top', '0%').replace('bottom', '100%').replace(/center/g, '50%');
  const m = norm.match(/([\\d.]+)%\\s+([\\d.]+)%/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 35];
}

// ---- crop drag ----
let drag = null;
document.addEventListener('pointerdown', function(e) {
  const im = e.target.closest('img.ed-target');
  if (!im) return;
  if (mode !== 'crop') { handleSwapClick(im); e.preventDefault(); return; }
  const p = parsePos(im);
  drag = { im: im, sx: e.clientX, sy: e.clientY, x: p[0], y: p[1], rect: im.getBoundingClientRect() };
  im.style.cursor = 'grabbing';
  e.preventDefault();
});
document.addEventListener('pointermove', function(e) {
  if (!drag) return;
  const dx = (e.clientX - drag.sx) / drag.rect.width * 130;
  const dy = (e.clientY - drag.sy) / drag.rect.height * 130;
  const nx = Math.max(0, Math.min(100, drag.x - dx));
  const ny = Math.max(0, Math.min(100, drag.y - dy));
  drag.im.style.objectPosition = nx.toFixed(1) + '% ' + ny.toFixed(1) + '%';
});
document.addEventListener('pointerup', function() {
  if (!drag) return;
  const im = drag.im;
  im.style.cursor = 'grab';
  FOCUS[baseOf(im)] = im.style.objectPosition;
  im.classList.add('ed-changed');
  drag = null;
  refreshFaces();
});

// ---- swap (captions follow their photos live) ----
let selected = null;
function capNodeFor(base) {
  return document.querySelector('.capline[data-capbase="' + base + '"]');
}
function handleSwapClick(im) {
  if (mode === 'replace') { openTray(im); return; }
  if (!selected) { selected = im; im.classList.add('ed-selected'); return; }
  if (selected === im) { im.classList.remove('ed-selected'); selected = null; return; }
  const a = selected, b = im;
  const sa = +a.dataset.slot, sb = +b.dataset.slot;
  if (PAIR && (sa < PAIR.split) !== (sb < PAIR.split)) {
    alert('Photos stay within their class — swap within the same half of the spread.');
    a.classList.remove('ed-selected'); selected = null; return;
  }
  const baseA = ORDER[sa], baseB = ORDER[sb];
  ORDER[sa] = baseB; ORDER[sb] = baseA;
  const t = a.getAttribute('src');
  a.setAttribute('src', b.getAttribute('src'));
  b.setAttribute('src', t);
  a.style.objectPosition = FOCUS[ORDER[sa]] || '';
  b.style.objectPosition = FOCUS[ORDER[sb]] || '';
  // Captions travel with their photos; badge numbers stay with the layout.
  const na = capNodeFor(baseA), nb = capNodeFor(baseB);
  if (na && nb) {
    const ta = na.textContent;
    na.textContent = nb.textContent;
    nb.textContent = ta;
    na.setAttribute('data-capbase', baseB);
    nb.setAttribute('data-capbase', baseA);
  } else if (na || nb) {
    (na || nb).style.opacity = .5;
    (na || nb).title = 'caption placement updates when the spread regenerates';
  }
  a.classList.add('ed-changed'); b.classList.add('ed-changed');
  a.classList.remove('ed-selected');
  selected = null;
  refreshFaces();
}

// ---- caption editing ----
function editCaption(base) {
  const node = capNodeFor(base);
  const current = CAP_EDITS[base] != null ? CAP_EDITS[base] : (node ? node.textContent : '');
  const next = prompt('Caption for ' + base + ':', current);
  if (next == null || next === current) return;
  CAP_EDITS[base] = next;
  if (node) { node.textContent = next; node.classList.add('ed-changed-cap'); }
  else alert('This photo has no caption line in the preview — the new caption appears when the spread regenerates.');
  markDirty();
}
document.addEventListener('dblclick', function(e) {
  const tx = e.target.closest('.textline');
  if (tx) { editText(tx); return; }
  const cap = e.target.closest('.capline');
  if (cap) { editCaption(cap.getAttribute('data-capbase')); return; }
  const im = e.target.closest('img.ed-target');
  if (im) editCaption(baseOf(im));
});

// ---- text editing (title / tagline / body / quotes) ----
const tmodal = document.getElementById('tmodal');
let tmTarget = null;
function editText(node) {
  tmTarget = node;
  const field = node.getAttribute('data-textfield');
  document.getElementById('tmTitle').textContent = 'Edit ' + field.replace(/^\w:/, '').replace(':', ' paragraph ');
  document.getElementById('tmText').value = TEXT_EDITS[field] != null ? TEXT_EDITS[field] : node.textContent;
  tmodal.classList.add('open');
  document.getElementById('tmText').focus();
}
document.getElementById('tmCancel').onclick = function() { tmodal.classList.remove('open'); tmTarget = null; };
document.getElementById('tmSave').onclick = function() {
  if (!tmTarget) return;
  const field = tmTarget.getAttribute('data-textfield');
  const val = document.getElementById('tmText').value.trim();
  if (val && val !== tmTarget.textContent) {
    TEXT_EDITS[field] = val;
    tmTarget.textContent = val;
    tmTarget.classList.add('ed-changed-cap');
    markDirty();
  }
  tmodal.classList.remove('open');
  tmTarget = null;
};

// ---- face boxes + crop-out warnings ----
function visibleWindow(base, rect) {
  const pa = AR[base] || 1.5, sa = rect.width / rect.height;
  const pos = FOCUS[base] || '50% 35%';
  const m = pos.match(/([\\d.]+)%\\s+([\\d.]+)%/) || [0, 50, 35];
  const px = parseFloat(m[1]) / 100, py = parseFloat(m[2]) / 100;
  if (pa > sa) {
    const w = sa / pa;
    return { x0: px * (1 - w), y0: 0, w: w, h: 1 };
  }
  const h = pa / sa;
  return { x0: 0, y0: py * (1 - h), w: 1, h: h };
}
let facesOn = false;
document.getElementById('facesBtn').onclick = function() {
  facesOn = !facesOn;
  document.getElementById('facesBtn').classList.toggle('active', facesOn);
  refreshFaces();
};
function refreshFaces() {
  document.querySelectorAll('.facebox, .facewarn').forEach(function(el) { el.remove(); });
  if (!FACES) return;
  const spreadRect = spread.getBoundingClientRect();
  imgs.forEach(function(im) {
    const base = baseOf(im);
    const faces = FACES[base];
    if (!faces || !faces.length) return;
    const rect = im.getBoundingClientRect();
    const win = visibleWindow(base, rect);
    let out = 0;
    faces.forEach(function(f) {
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      const inside = cx >= win.x0 && cx <= win.x0 + win.w && cy >= win.y0 && cy <= win.y0 + win.h;
      if (!inside) out++;
      if (facesOn) {
        const bx = (f.x - win.x0) / win.w, by = (f.y - win.y0) / win.h;
        if (bx + f.w / win.w < 0 || bx > 1 || by + f.h / win.h < 0 || by > 1) return;
        const div = document.createElement('div');
        div.className = 'facebox' + (inside ? '' : ' out');
        div.style.left = ((rect.left - spreadRect.left) / SCALE + bx * rect.width / SCALE) + 'px';
        div.style.top = ((rect.top - spreadRect.top) / SCALE + by * rect.height / SCALE) + 'px';
        div.style.width = (f.w / win.w * rect.width / SCALE) + 'px';
        div.style.height = (f.h / win.h * rect.height / SCALE) + 'px';
        spread.appendChild(div);
      }
    });
    if (out > 0) {
      const warn = document.createElement('div');
      warn.className = 'facewarn';
      warn.textContent = out + ' face' + (out > 1 ? 's' : '') + ' cropped out';
      warn.style.left = ((rect.left - spreadRect.left) / SCALE + 6) + 'px';
      warn.style.top = ((rect.top - spreadRect.top) / SCALE + 6) + 'px';
      spread.appendChild(warn);
    }
  });
}
fetch('face_boxes.json').then(function(r) { return r.ok ? r.json() : null; })
  .then(function(d) { FACES = d; refreshFaces(); })
  .catch(function() {});

// ---- navigation ----
document.getElementById('resetBtn').onclick = function() { location.reload(); };
let dirty = false;
function markDirty() { dirty = document.querySelectorAll('img.ed-changed, .ed-changed-cap').length > 0 || Object.keys(CAP_EDITS).length > 0 || Object.keys(TEXT_EDITS).length > 0; }
document.addEventListener('pointerup', function() { setTimeout(markDirty, 0); });
function go(href) {
  if (dirty && !confirm('Unsaved edits on this spread — leave anyway?')) return;
  location.href = href;
}
const navSel = document.getElementById('navSel');
navSel.onchange = function() { go(navSel.value); };
document.getElementById('prevBtn').onclick = function() { if (navSel.selectedIndex > 0) { navSel.selectedIndex--; go(navSel.value); } };
document.getElementById('nextBtn').onclick = function() { if (navSel.selectedIndex < navSel.options.length - 1) { navSel.selectedIndex++; go(navSel.value); } };

// ---- save / print ----
function layoutPayload() {
  const out = PAIR
    ? { orderA: ORDER.slice(0, PAIR.split), orderB: ORDER.slice(PAIR.split), focus: FOCUS }
    : { order: ORDER, focus: FOCUS };
  if (Object.keys(CAP_EDITS).length) out.captions = CAP_EDITS;
  if (Object.keys(TEXT_EDITS).length) out.text = TEXT_EDITS;
  return out;
}
document.getElementById('save').onclick = async function() {
  const payload = layoutPayload();
  if (SERVED) {
    const r = await fetch('/api/save/' + encodeURIComponent(FOLDER), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      dirty = false;
      document.getElementById('save').textContent = 'Saved \\u2713';
      setTimeout(function() { document.getElementById('save').textContent = 'Save'; }, 1500);
    } else alert('Save failed: ' + (await r.text()));
  } else {
    const destFolder = PAIR ? PAIR.folderA : FOLDER;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = '_layout_edit.json';
    aEl.click();
    alert('Saved _layout_edit.json to Downloads.\\n\\nMove it into yearbook_import_pack/' + destFolder + '/ and regenerate — or run the editor with "serve" to skip this step.');
  }
};
document.getElementById('print').onclick = async function() {
  if (!SERVED) { alert('Print export needs the server:\\n\\nnode scripts/edit-spread.js serve'); return; }
  const btn = document.getElementById('print');
  btn.disabled = true; btn.textContent = 'Rendering\\u2026 (1-3 min)';
  try {
    await fetch('/api/save/' + encodeURIComponent(FOLDER), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layoutPayload()),
    });
    const r = await fetch('/api/print/' + encodeURIComponent(FOLDER), { method: 'POST' });
    if (!r.ok) throw new Error(await r.text());
    const blob = await r.blob();
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = FOLDER + '_print_600dpi.png';
    aEl.click();
    dirty = false;
  } catch (e) { alert('Print render failed: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Print PNG 600 DPI';
};

rescale();
</script>`;
}

// ---------------------------------------------------------------------------
// Serve mode: save-in-place + print rendering
// ---------------------------------------------------------------------------
function navListAll() {
  const nonAcademic = Object.keys(SECTION_NAMES).filter(f => !/^0[1-8]_/.test(f));
  return [...PAIRS, ...nonAcademic];
}

async function buildSpec(spec, navList) {
  return spec.includes('+') ? buildPair(spec, navList) : buildOne(spec, navList);
}

async function serve(port) {
  const express = require(path.join(REPO, 'node_modules', 'express'));
  const { execFile } = require('child_process');
  const navList = navListAll();

  console.log('Building editor pages…');
  const built = [];
  for (const f of navList) {
    try { built.push(await buildSpec(f, navList)); }
    catch (e) { console.log(`${f}: skipped (${e.message.split('\n')[0]})`); }
  }
  fs.writeFileSync(path.join(REVIEW_DIR, 'editor_photos.json'), JSON.stringify(PHOTO_FILES, null, 1));

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.static(REVIEW_DIR));

  app.post('/api/save/:spec', async (req, res) => {
    try {
      const spec = req.params.spec;
      const destFolder = spec.includes('+') ? spec.split('+')[0] : spec;
      if (!SECTION_NAMES[destFolder]) return res.status(400).send('unknown spread');
      const fp = path.join(PACK_DIR, destFolder, '_layout_edit.json');
      fs.writeFileSync(fp, JSON.stringify(req.body, null, 2));
      console.log(`saved ${fp}`);
      // Rebuild the page so a reload reflects the saved state.
      await buildSpec(spec, navList);
      res.send('ok');
    } catch (e) { res.status(500).send(e.message); }
  });

  app.post('/api/print/:spec', (req, res) => {
    const spec = req.params.spec;
    const isPair = spec.includes('+');
    const folder = isPair ? spec.split('+')[0] : spec;
    if (!SECTION_NAMES[folder]) return res.status(400).send('unknown spread');
    const args = isPair
      ? ['scripts/generate-from-pack.js', 'pair', spec]
      : ['scripts/generate-from-pack.js', spec];
    console.log(`print render: ${spec}`);
    execFile('node', args, {
      cwd: REPO, timeout: 8 * 60 * 1000,
      env: { ...process.env, HIRES: '1' },
    }, (err, stdout) => {
      if (err) { console.error(stdout); return res.status(500).send('render failed: ' + err.message); }
      const outDir = path.join(os.homedir(), 'Downloads', 'finished spreads');
      const printPath = path.join(outDir, `${spec}_print_600dpi.png`);
      if (!fs.existsSync(printPath)) return res.status(500).send('render succeeded but no print file — check flags:\n' + stdout);
      console.log(stdout.trim().split('\n').pop());
      res.set('Content-Type', 'image/png');
      fs.createReadStream(printPath).pipe(res);
    });
  });

  app.listen(port, () => {
    const first = built.length ? path.basename(built[0]) : '';
    const url = `http://localhost:${port}/${first}`;
    console.log(`\nSpread editor: ${url}`);
    require('child_process').execFileSync('open', [url]);
  });
}

// ---------------------------------------------------------------------------
async function main() {
  const arg = process.argv[2];
  const navList = navListAll();
  if (arg === 'serve') return serve(parseInt(process.argv[3], 10) || 4477);
  const valid = arg === 'all' || navList.includes(arg) || SECTION_NAMES[arg];
  if (!arg || !valid) {
    console.error('Usage: node scripts/edit-spread.js serve | <spread|pairA+pairB> | all');
    console.error('Spreads:', navList.join(', '));
    process.exit(1);
  }
  const specs = arg === 'all' ? navList : [arg];
  const built = [];
  for (const f of specs) {
    try { built.push(await buildSpec(f, navList)); }
    catch (e) { console.log(`${f}: skipped (${e.message.split('\n')[0]})`); }
  }
  fs.writeFileSync(path.join(REVIEW_DIR, 'editor_photos.json'), JSON.stringify(PHOTO_FILES, null, 1));
  if (built.length) require('child_process').execFileSync('open', [built[0]]);
}

main().catch(e => { console.error(e); process.exit(1); });
