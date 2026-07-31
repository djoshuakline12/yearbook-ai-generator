#!/usr/bin/env node
// Book-wide quality report: score every spread (same rubric as the editor
// badge) and write _review/quality_report.md sorted worst-first.
//
// Usage: node scripts/quality-check.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// The editor already computes everything per spread — reuse it by building
// pages (cheap at 100dpi) and scraping its console output would be wasteful;
// instead require the same lib pieces directly.
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));
const { scoreSpread, adviceFor } = require('./lib-quality');

const gen = fs.readFileSync(path.join(__dirname, 'generate-from-pack.js'), 'utf8')
  .replace(/async function main[\s\S]*$/,
    'module.exports = { SECTION_NAMES, parseCompiled, ensureCompiledTxt, manifestCaptions, collectPhotos, COMPILED_TXT, PACK_DIR };');
const tmp = path.join(os.tmpdir(), 'gfp-quality-lib.js');
fs.writeFileSync(tmp, gen);
const { SECTION_NAMES, parseCompiled, ensureCompiledTxt, manifestCaptions, collectPhotos, COMPILED_TXT, PACK_DIR } = require(tmp);

const PAIRS = [
  '01_bible+02_english', '03_math+04_science',
  '05_history+06_spanish', '07_art+08_media',
];

function holdFlagsFor(spec, report) {
  const e = report.find(r => r.spread === spec);
  return e ? e.flags : [];
}

async function photoStats(folder, cap) {
  const collected = collectPhotos(folder, cap || 13);
  const aspects = [];
  let minLong = Infinity;
  for (const p of collected) {
    const m = await sharp(p.file).metadata();
    const rot = (m.orientation || 1) >= 5;
    const w = rot ? m.height : m.width;
    const h = rot ? m.width : m.height;
    if (w && h) { aspects.push(w / h); minLong = Math.min(minLong, Math.max(w, h)); }
  }
  const capMap = manifestCaptions(folder);
  const captioned = collected.filter(p => capMap[p.base]).length;
  return { count: collected.length, aspects, minLong: minLong === Infinity ? 0 : minLong, captioned };
}

async function main() {
  ensureCompiledTxt();
  const sections = parseCompiled(fs.readFileSync(COMPILED_TXT, 'utf8'));
  let report = [];
  try {
    report = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Downloads', 'finished spreads', '_content_report.json'), 'utf8'));
  } catch {}

  const specs = [...PAIRS, ...Object.keys(SECTION_NAMES).filter(f => !/^0[1-8]_/.test(f))];
  const rows = [];
  for (const spec of specs) {
    try {
      const folders = spec.includes('+') ? spec.split('+') : [spec];
      let count = 0, captioned = 0, minLong = Infinity, aspects = [];
      let bodyLen = 0, quoteCount = 0, statsCount = 0, hasTagline = false, missingCopy = false;
      for (const f of folders) {
        const sec = sections[SECTION_NAMES[f]];
        if (!sec) { missingCopy = true; continue; }
        bodyLen += (sec.bodyCopy || '').length;
        quoteCount += (sec.quotes || []).length;
        statsCount += (sec.highlights || []).length;
        hasTagline = hasTagline || !!sec.subheadline;
        const ps = await photoStats(f, spec.includes('+') ? 5 : 13);
        count += ps.count; captioned += ps.captioned;
        aspects.push(...ps.aspects);
        minLong = Math.min(minLong, ps.minLong || Infinity);
      }
      const holdFlags = [
        ...(missingCopy ? ['NO COPY found in compiled doc'] : []),
        ...folders.flatMap(f => holdFlagsFor(f, report)),
      ];
      const input = {
        photoCount: count, captionedCount: captioned, aspects,
        minLongSide: minLong === Infinity ? 0 : minLong,
        bodyLen, quoteCount, hasTagline, statsCount, holdFlags,
      };
      const { score, parts } = scoreSpread(input);
      rows.push({ spec, score, tips: adviceFor(parts, input) });
      console.log(`${String(score).padStart(3)}  ${spec}`);
    } catch (e) {
      rows.push({ spec, score: 0, tips: [e.message] });
      console.log(`  0  ${spec} (${e.message})`);
    }
  }

  rows.sort((a, b) => a.score - b.score);
  const md = [
    '# Spread quality report',
    `_${rows.length} spreads, scored 0-100 — worst first. Rubric: photos 35, captions 25, copy 25, extras 15._`,
    '',
    ...rows.map(r => `## ${r.score}/100 — ${r.spec}\n${r.tips.length ? r.tips.map(t => `- ${t}`).join('\n') : '- clean'}`),
  ].join('\n');
  const outPath = path.join(PACK_DIR, '_review', 'quality_report.md');
  fs.writeFileSync(outPath, md);
  console.log(`\nReport: ${outPath}`);
  const avg = Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length);
  console.log(`Average: ${avg}/100 - lowest: ${rows[0].spec} (${rows[0].score})`);
}

main().catch(e => { console.error(e); process.exit(1); });
