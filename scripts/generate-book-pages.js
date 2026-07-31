#!/usr/bin/env node
// Structural book pages: section dividers (with mini-TOCs), signature
// spread, and back page. Rendered locally through the exporter.
//
// Usage: node scripts/generate-book-pages.js
//
// Page numbers come from the PROVISIONAL ladder below — edit it as the
// final order settles and re-run; every divider regenerates in seconds.
// Outputs land in ~/Downloads/finished spreads/_book_pages/.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exportToFile } = require('../src/services/exporter');
const { BRAND, inToPx, ptToPx, escapeHtml } = require('../src/services/templates/utils');

const OUT = path.join(os.homedir(), 'Downloads', 'finished spreads', '_book_pages');

// ---------------------------------------------------------------------------
// PROVISIONAL LADDER (2026-07-30) — spreads in book order per block.
// Front matter: pp 1-4 theme (Josh's pages), pp 5-26 portraits (11 spreads).
// ---------------------------------------------------------------------------
const LADDER = [
  { divider: 'STUDENT LIFE', tagline: 'the moments between the milestones', sections: [
    'Chapel & Community Groups', 'See You At The Pole', 'Freshman Retreat',
    'Senior Retreat', 'Spirit Week', 'Artist Showcase', 'Christmas Show',
    'Spring Production', 'Royal Ball', 'Fall Fest', 'Scholarship Banquet',
    "Grandparents' Day", 'Community Service', 'Spiritual Emphasis Day',
    'JTerm', 'Collage',
  ] },
  { divider: 'ACADEMICS', tagline: 'learning that lasts', sections: [
    'Bible & English', 'Math & Science', 'History & Spanish', 'Art & Media',
    'Consumer Science & Industrial Arts', 'Gym / Health',
    'Praise and Worship', 'Senior Thesis Project',
  ] },
  { divider: 'SPORTS', tagline: 'one team, one family', sections: [
    'Boys Soccer', 'Girls Soccer', 'Boys Basketball', 'Girls Basketball',
    'Baseball', 'Softball', 'Girls Volleyball', 'Boys Volleyball', 'Cheer',
    'Cross Country', 'Field Hockey', 'Swim', 'Golf', 'Team Photos',
  ] },
  { divider: 'ROYAL FINISH', tagline: 'leading, graduating, remembering', sections: [
    'Student Leadership Council', 'Graduation', 'Baccalaureate',
    'Senior Recognition', 'Signatures',
  ] },
];
const FIRST_CONTENT_PAGE = 27;  // after theme (4) + portraits (22)
const TEAM_PHOTO_SPREADS = 7;   // Team Photos block is 7 spreads wide

// Assign provisional page numbers: each divider takes a spread, then each
// section one spread (Team Photos takes 7).
function paginate() {
  let page = FIRST_CONTENT_PAGE;
  for (const block of LADDER) {
    block.page = page;
    page += 2;
    block.entries = block.sections.map(name => {
      const e = { name, page };
      page += name === 'Team Photos' ? TEAM_PHOTO_SPREADS * 2 : 2;
      return e;
    });
  }
  return page; // next free page
}

// ---------------------------------------------------------------------------
const DPI = 450;
const px = (n) => `${inToPx(n, DPI)}px`;
const pt = (n) => `${ptToPx(n, DPI)}px`;
const PURPLE = BRAND.purple;

function pageShell(bodyHtml, widthIn) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${BRAND.fontLink}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${inToPx(widthIn, DPI)}px; height: ${inToPx(10.5, DPI)}px;
    background: white; font-family: ${BRAND.body};
    -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: hidden; }
</style></head><body>${bodyHtml}</body></html>`;
}

function dividerHtml(block, idx) {
  const rows = block.entries.map(e =>
    `<div class="row"><span class="nm">${escapeHtml(e.name)}</span><span class="dots"></span><span class="pg">${e.page}</span></div>`).join('\n');
  return pageShell(`
<style>
  .left { position: absolute; left: 0; top: 0; width: ${px(8)}; height: ${px(10.5)}; background: ${PURPLE}; }
  .num { position: absolute; left: ${px(0.6)}; top: ${px(0.55)};
    font-family: ${BRAND.body}; font-weight: 800; font-size: ${pt(11)};
    color: rgba(255,255,255,.75); letter-spacing: ${px(0.03)}; }
  .word { position: absolute; left: ${px(0.6)}; top: ${px(3.2)}; width: ${px(6.9)};
    font-family: ${BRAND.serif}; font-optical-sizing: none; font-variation-settings: 'opsz' 9;
    font-weight: 900; font-size: ${pt(52)}; line-height: 1.02; color: white; text-transform: uppercase; }
  .tag { position: absolute; left: ${px(0.62)}; top: ${px(7.6)};
    font-family: ${BRAND.script}; font-size: ${pt(22)}; color: rgba(255,255,255,.92);
    transform: rotate(-2deg); }
  .rule { position: absolute; left: ${px(0.62)}; top: ${px(7.3)}; width: ${px(2.2)};
    height: ${px(0.045)}; background: rgba(255,255,255,.6); }
  .toc { position: absolute; left: ${px(8.9)}; top: ${px(1.5)}; width: ${px(6.3)}; }
  .toc-head { font-family: ${BRAND.body}; font-weight: 800; font-size: ${pt(10.5)};
    color: ${PURPLE}; letter-spacing: ${px(0.03)}; margin-bottom: ${px(0.3)};
    text-transform: uppercase; }
  .row { display: flex; align-items: baseline; gap: ${px(0.12)};
    font-size: ${pt(11.5)}; color: #1A1A1A; line-height: 2.05; }
  .nm { flex: none; }
  .dots { flex: 1; border-bottom: ${px(0.014)} dotted #999; transform: translateY(${px(-0.05)}); }
  .pg { flex: none; font-weight: 700; color: ${PURPLE}; }
  .foot { position: absolute; left: ${px(8.9)}; bottom: ${px(0.55)};
    font-size: ${pt(8.5)}; color: #999; }
</style>
<div class="left">
  <div class="num">SECTION ${String(idx + 1).padStart(2, '0')}</div>
  <div class="word">${escapeHtml(block.divider)}</div>
  <div class="rule"></div>
  <div class="tag">${escapeHtml(block.tagline)}</div>
</div>
<div class="toc">
  <div class="toc-head">In this section</div>
${rows}
</div>
<div class="foot">Delmarva Christian High School &middot; 2025&ndash;2026</div>`, 16);
}

function signatureHtml() {
  const corner = (x, y, flipX, flipY) => `
  <div style="position:absolute; left:${px(x)}; top:${px(y)}; width:${px(1.1)}; height:${px(1.1)};
    border-left:${px(0.05)} solid ${PURPLE}; border-top:${px(0.05)} solid ${PURPLE};
    transform: scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1});"></div>`;
  return pageShell(`
<style>
  .script { position: absolute; left: 0; right: 0; top: ${px(4.1)}; text-align: center;
    font-family: ${BRAND.script}; font-size: ${pt(64)}; color: ${PURPLE}; }
  .sub { position: absolute; left: 0; right: 0; top: ${px(6.1)}; text-align: center;
    font-family: ${BRAND.body}; font-weight: 700; font-size: ${pt(11)};
    letter-spacing: ${px(0.06)}; color: #1A1A1A; text-transform: uppercase; }
</style>
${corner(0.5, 0.5, false, false)}${corner(14.4, 0.5, true, false)}
${corner(0.5, 8.9, false, true)}${corner(14.4, 8.9, true, true)}
<div class="script">signatures</div>
<div class="sub">Leave your mark &middot; 2025&ndash;2026</div>`, 16);
}

function backPageHtml() {
  return pageShell(`
<style>
  .field { position: absolute; inset: 0; background: ${PURPLE}; }
  .cross-v { position: absolute; left: ${px(3.85)}; top: ${px(3.0)}; width: ${px(0.3)}; height: ${px(3.4)}; background: white; }
  .cross-h { position: absolute; left: ${px(2.95)}; top: ${px(3.95)}; width: ${px(2.1)}; height: ${px(0.3)}; background: white; }
  .school { position: absolute; left: 0; right: 0; top: ${px(7.1)}; text-align: center;
    font-family: ${BRAND.serif}; font-optical-sizing: none; font-variation-settings: 'opsz' 9;
    font-weight: 900; font-size: ${pt(16)}; color: white; letter-spacing: ${px(0.02)}; }
  .yr { position: absolute; left: 0; right: 0; top: ${px(7.9)}; text-align: center;
    font-family: ${BRAND.body}; font-weight: 700; font-size: ${pt(11)};
    color: rgba(255,255,255,.85); letter-spacing: ${px(0.08)}; }
</style>
<div class="field"></div>
<div class="cross-v"></div><div class="cross-h"></div>
<div class="school">DELMARVA CHRISTIAN</div>
<div class="yr">ROYALS &middot; 2025&ndash;2026</div>`, 8);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const nextPage = paginate();
  console.log(`Provisional ladder ends at page ${nextPage - 1} (before ads padding).`);
  for (const [i, block] of LADDER.entries()) {
    const out = await exportToFile(dividerHtml(block, i), 'png', 'spread');
    const fp = path.join(OUT, `divider_${i + 1}_${block.divider.toLowerCase().replace(/\s+/g, '_')}.${out.extension}`);
    fs.writeFileSync(fp, out.buffer);
    console.log(`✓ ${block.divider} (pp ${block.page}-${block.page + 1})  -> ${fp}`);
  }
  const sig = await exportToFile(signatureHtml(), 'png', 'spread');
  fs.writeFileSync(path.join(OUT, `signatures.${sig.extension}`), sig.buffer);
  console.log('✓ signatures spread');
  const back = await exportToFile(backPageHtml(), 'png', 'page');
  fs.writeFileSync(path.join(OUT, `back_page.${back.extension}`), back.buffer);
  console.log('✓ back page');
}

main().catch(e => { console.error(e); process.exit(1); });
