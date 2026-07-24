#!/usr/bin/env node
// Build the caption-review page: thumbnails + editable captions for EVERY
// photo in the import pack, with approve checkboxes and CSV export.
// Output: ~/Downloads/yearbook_import_pack/_review/review.html

const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

const PACK = path.join(os.homedir(), 'Downloads', 'yearbook_import_pack');
const OUT = path.join(PACK, '_review');
const THUMBS = path.join(OUT, 'thumbs');

// Reuse the generator's caption sources (manifest + confirmed).
const gen = fs.readFileSync(path.join(__dirname, 'generate-from-pack.js'), 'utf8')
  .replace(/async function main[\s\S]*$/, 'module.exports = { manifestCaptions, SECTION_NAMES };');
const tmp = path.join(os.tmpdir(), 'gfp-review-lib.js');
fs.writeFileSync(tmp, gen);
const { manifestCaptions, SECTION_NAMES } = require(tmp);

function walkPhotos(folder) {
  const dir = path.join(PACK, folder);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d).sort()) {
      if (e.startsWith('.') || e === '_raw_originals' || e === '_review') continue;
      const p = path.join(d, e);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p, rel ? rel + '/' + e : e);
      else if (/\.(jpe?g|png)$/i.test(e)) out.push({ abs: p, rel: rel ? rel + '/' + e : e });
    }
  };
  walk(dir, '');
  return out;
}

(async () => {
  fs.mkdirSync(THUMBS, { recursive: true });
  const rows = [];
  for (const folder of Object.keys(SECTION_NAMES)) {
    const photos = walkPhotos(folder);
    if (!photos.length) continue;
    const capMap = manifestCaptions(folder);
    for (const p of photos) {
      const base = path.basename(p.rel).replace(/\.\w+$/, '');
      const caption = capMap[base] || '';
      const thumbName = (folder + '__' + p.rel).replace(/[\/\s]/g, '_') + '.jpg';
      const thumbPath = path.join(THUMBS, thumbName);
      if (!fs.existsSync(thumbPath)) {
        try {
          await sharp(p.abs).rotate().resize(360, 240, { fit: 'cover' }).jpeg({ quality: 70 }).toFile(thumbPath);
        } catch (e) { continue; }
      }
      rows.push({
        folder,
        section: SECTION_NAMES[folder],
        file: p.rel,
        finalPath: folder + '/' + p.rel,
        thumb: 'thumbs/' + thumbName,
        caption,
        // Captions from the confirmed file are pre-approved.
        preApproved: false,
      });
    }
    console.log(folder, photos.length, 'photos');
  }

  // Mark rows from captions_confirmed.csv: caption rows pre-approve,
  // action=remove rows pre-mark as removed.
  const confirmedPath = path.join(PACK, 'captions_confirmed.csv');
  if (fs.existsSync(confirmedPath)) {
    const confirmed = new Set();
    const removed = new Set();
    for (const l of fs.readFileSync(confirmedPath, 'utf8').split('\n').slice(1)) {
      const fp = (l.match(/^"?([^,"]+)"?,/) || [])[1];
      if (!fp) continue;
      if (/,\s*"?remove"?\s*$/.test(l.trim())) removed.add(fp);
      else confirmed.add(fp);
    }
    for (const r of rows) {
      if (removed.has(r.finalPath)) r.preRemoved = true;
      else if (confirmed.has(r.finalPath)) r.preApproved = true;
    }
  }

  const DATA = JSON.stringify(rows);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>DCHS Yearbook — Caption Review</title>
<style>
  :root { --purple: #563D82; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, sans-serif; margin: 0; background: #f4f2f8; color: #1a1a1a; }
  header { position: sticky; top: 0; background: var(--purple); color: white; padding: 12px 20px; z-index: 10;
           display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  header h1 { font-size: 18px; margin: 0; }
  header .count { font-size: 14px; opacity: 0.9; }
  header button { background: white; color: var(--purple); border: none; border-radius: 6px;
                  padding: 8px 14px; font-weight: 700; font-size: 14px; cursor: pointer; }
  header button:hover { background: #eee; }
  .hint { font-size: 12px; opacity: 0.85; flex-basis: 100%; }
  h2 { margin: 28px 20px 4px; font-size: 16px; color: var(--purple); text-transform: uppercase; letter-spacing: 0.04em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(370px, 1fr)); gap: 14px; padding: 8px 20px; }
  .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
  .card.approved { outline: 3px solid #2e9e44; }
  .card img { width: 100%; height: 200px; object-fit: cover; display: block; cursor: zoom-in; }
  .card .body { padding: 10px 12px 12px; }
  .card .file { font-size: 11px; color: #888; margin-bottom: 6px; word-break: break-all; }
  .card textarea { width: 100%; min-height: 52px; font-size: 13px; padding: 6px 8px; border: 1px solid #ccc;
                   border-radius: 6px; resize: vertical; font-family: inherit; }
  .card textarea.empty { border-color: #d78f00; background: #fff8ec; }
  .card .row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .card label { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .card input[type=checkbox] { width: 18px; height: 18px; accent-color: #2e9e44; }
  .card .skip { font-size: 12px; color: #888; margin-left: auto; cursor: pointer; text-decoration: underline; }
  .card.removed { outline: 3px solid #c0392b; opacity: 0.55; }
  .card .btn { border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .card .btn.nocap { background: #eee; color: #333; margin-left: auto; }
  .card .btn.remove { background: #fdecea; color: #c0392b; }
  .card .btn.restore { background: #eafafit; background: #e8f8ee; color: #2e9e44; margin-left: auto; }
  #zoom { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: none;
          align-items: center; justify-content: center; z-index: 50; cursor: zoom-out; }
  #zoom img { max-width: 92vw; max-height: 92vh; }
</style>
</head>
<body>
<header>
  <h1>Caption Review</h1>
  <span class="count" id="count"></span>
  <button onclick="exportCsv()">⬇︎ Export captions_confirmed.csv</button>
  <span class="hint">Edit the caption, then check ✓ Approved. Orange box = no caption yet. "No caption" confirms a photo runs without one; "✕ Remove" pulls the photo from the book entirely (restorable). Progress saves in this browser automatically. When done, Export and send the file to Claude (it lands in your Downloads).</span>
</header>
<div id="app"></div>
<div id="zoom" onclick="this.style.display='none'"><img id="zoomimg"></div>
<script>
const DATA = ${DATA};
const store = JSON.parse(localStorage.getItem('dchs-captions') || '{}');
const state = {};
for (const r of DATA) {
  const s = store[r.finalPath] || {};
  state[r.finalPath] = {
    caption: s.caption !== undefined ? s.caption : r.caption,
    approved: s.approved !== undefined ? s.approved : r.preApproved,
    skipped: s.skipped || false,
    removed: s.removed !== undefined ? s.removed : (r.preRemoved || false),
  };
}
function save() {
  localStorage.setItem('dchs-captions', JSON.stringify(state));
  updateCount();
}
function updateCount() {
  const total = DATA.length;
  const done = DATA.filter(r => { const s = state[r.finalPath]; return s.approved || s.skipped || s.removed; }).length;
  document.getElementById('count').textContent = done + ' / ' + total + ' reviewed';
}
function render() {
  const app = document.getElementById('app');
  const bySection = {};
  for (const r of DATA) (bySection[r.section] = bySection[r.section] || []).push(r);
  app.innerHTML = Object.entries(bySection).map(([section, rows]) =>
    '<h2>' + section + '</h2><div class="grid">' + rows.map(r => {
      const s = state[r.finalPath];
      const cls = s.removed ? ' removed' : (s.approved ? ' approved' : '');
      return '<div class="card' + cls + '" id="card-' + cssId(r.finalPath) + '">' +
        '<img src="' + r.thumb + '" loading="lazy" onclick="zoom(\\'' + r.thumb + '\\')">' +
        '<div class="body">' +
        '<div class="file">' + r.finalPath +
          (s.removed ? ' — <b style="color:#c0392b">REMOVED — will not appear in the book</b>' : (s.skipped ? ' — <b>no caption (confirmed)</b>' : '')) + '</div>' +
        '<textarea class="' + (s.caption ? '' : 'empty') + '" placeholder="No caption — type one, or use the buttons" ' +
          (s.removed ? 'disabled ' : '') +
          'oninput="onEdit(\\'' + jsEsc(r.finalPath) + '\\', this)">' + escHtml(s.caption) + '</textarea>' +
        '<div class="row">' +
        '<label><input type="checkbox" ' + (s.approved ? 'checked' : '') + (s.removed ? ' disabled' : '') +
          ' onchange="onApprove(\\'' + jsEsc(r.finalPath) + '\\', this.checked)"> Approved</label>' +
        (s.removed
          ? '<button class="btn restore" onclick="onRestore(\\'' + jsEsc(r.finalPath) + '\\')">↩︎ Restore</button>'
          : '<button class="btn nocap" onclick="onSkip(\\'' + jsEsc(r.finalPath) + '\\')">No caption</button>' +
            '<button class="btn remove" onclick="onRemove(\\'' + jsEsc(r.finalPath) + '\\')">✕ Remove</button>') +
        '</div></div></div>';
    }).join('') + '</div>'
  ).join('');
  updateCount();
}
function cssId(p) { return p.replace(/[^a-z0-9]/gi, '_'); }
function jsEsc(p) { return p.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'"); }
function escHtml(t) { return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function onEdit(p, el) { state[p].caption = el.value; state[p].skipped = false; el.classList.toggle('empty', !el.value); save(); }
function onApprove(p, v) { state[p].approved = v; if (v) state[p].skipped = false; save();
  document.getElementById('card-' + cssId(p)).classList.toggle('approved', v); }
function onSkip(p) { state[p].skipped = true; state[p].approved = false; state[p].removed = false; state[p].caption = ''; save(); render(); }
function onRemove(p) { state[p].removed = true; state[p].approved = false; state[p].skipped = false; save(); render(); }
function onRestore(p) { state[p].removed = false; save(); render(); }
function zoom(src) { document.getElementById('zoomimg').src = src.replace('thumbs/', 'thumbs/'); document.getElementById('zoom').style.display = 'flex'; }
function exportCsv() {
  let csv = 'final_path,caption,action\\n';
  for (const r of DATA) {
    const s = state[r.finalPath];
    if (s.removed) {
      csv += '"' + r.finalPath.replace(/"/g, '""') + '","",remove\\n';
    } else if (s.approved && s.caption.trim()) {
      csv += '"' + r.finalPath.replace(/"/g, '""') + '","' + s.caption.trim().replace(/"/g, '""') + '",keep\\n';
    }
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'captions_confirmed.csv';
  a.click();
}
render();
</script>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT, 'review.html'), html);
  console.log('\nWrote ' + path.join(OUT, 'review.html') + ' — ' + rows.length + ' photos');
})().catch(e => { console.error(e); process.exit(1); });
