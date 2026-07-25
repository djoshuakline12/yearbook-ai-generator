#!/usr/bin/env node
// Generate the athletics-directory spreads (team photos + rosters) from
// data scraped off royalssports.com. One sport per page, two per spread,
// rendered locally through the team-directory template + exporter.
//
// Usage:
//   node scripts/generate-team-pages.js [outDir]
//
// Reads:
//   ~/Downloads/yearbook_import_pack/_royalssports/data.json
//   ~/Downloads/yearbook_import_pack/_royalssports/photos/*.jpg
//
// Outputs teams_p1..pN.jpg into outDir (default ~/Downloads/finished
// spreads). Book placement: these follow the sport spreads (after
// 23_field_hockey) — slotting is Josh's call, so files stay unnumbered.

const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), 'Downloads', 'yearbook_import_pack', '_royalssports');
const SEASON = '2025-2026';

// Seasonal order, two sports per spread. Last spread's open half gets the
// closing verse card (echoes last year's directory: 2 Timothy 4:7).
const PAIRS = [
  ['Girls Volleyball', 'Field Hockey'],
  ['Boys Soccer', 'Cross Country'],
  ['Boys Basketball', 'Girls Basketball'],
  ['Swimming', 'Cheerleading'],
  ['Baseball', 'Softball'],
  ['Girls Soccer', 'Golf'],
  ['Boys Volleyball', null],
];

const FILLER = {
  filler: true,
  season: SEASON,
  verse: 'I have fought the good fight, I have finished the race, I have kept the faith.',
  attribution: '2 TIMOTHY 4:7',
};

function coachLine(coaches, squadLabel) {
  if (!coaches || !coaches.length) return '';
  // Squad-specific coaches when titles distinguish (JV Head Coach etc.);
  // otherwise the whole staff on the first squad only.
  const norm = (t) => (t || '').toLowerCase();
  const isJv = norm(squadLabel) === 'jv';
  let picks = coaches.filter(c => isJv ? norm(c.title).includes('jv') : !norm(c.title).includes('jv'));
  if (!picks.length) picks = isJv ? [] : coaches;
  return picks.map(c => `${c.title ? c.title + ' ' : ''}${c.name}`).join(' · ');
}

async function loadPhoto(file) {
  if (!file || !fs.existsSync(file)) return null;
  const sharp = require('sharp');
  const buf = await sharp(file).rotate().jpeg({ quality: 92 }).toBuffer();
  const meta = await sharp(buf).metadata();
  return { base64: buf.toString('base64'), aspectRatio: meta.width / meta.height };
}

async function buildSport(name, entry, photos) {
  if (!name) return FILLER;
  const rosterKeys = Object.keys(entry.rosters).filter(k => entry.rosters[k].length);
  const photoFiles = (entry.photos || []).map(p => p.file);
  const isBG = rosterKeys.includes('Boys') || rosterKeys.includes('Girls');
  const squads = [];

  const addSquad = async (label, roster, photoFile) => {
    let photoIndex = null;
    const ph = await loadPhoto(photoFile);
    if (ph) { photos.push(ph); photoIndex = photos.length - 1; }
    squads.push({ label, roster, coachLine: coachLine(entry.coaches, label), photoIndex });
  };

  if (isBG) {
    // Combined team photo (if any) shows above Boys/Girls roster cards.
    await addSquad('BOYS', entry.rosters.Boys || [], photoFiles[0]);
    await addSquad('GIRLS', entry.rosters.Girls || [], null);
    return { sport: name, season: SEASON, mode: 'bg', squads };
  }
  const hasJV = (entry.rosters.JV || []).length > 0;
  if (hasJV) {
    await addSquad('VARSITY', entry.rosters.V || [], photoFiles[0]);
    await addSquad('JUNIOR VARSITY', entry.rosters.JV, photoFiles[1]);
    return { sport: name, season: SEASON, mode: 'dual', squads };
  }
  await addSquad('VARSITY', entry.rosters.V || entry.rosters[rosterKeys[0]] || [], photoFiles[0]);
  return { sport: name, season: SEASON, mode: 'single', squads };
}

async function main() {
  const outDir = (process.argv[2] || path.join(os.homedir(), 'Downloads', 'finished spreads')).replace(/^~/, os.homedir());
  fs.mkdirSync(outDir, { recursive: true });
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'data.json'), 'utf8'));
  const { renderHandTemplate } = require('../src/services/templates');
  const { exportToFile } = require('../src/services/exporter');

  for (let i = 0; i < PAIRS.length; i++) {
    const [aName, bName] = PAIRS[i];
    const photos = [];
    const halfA = await buildSport(aName, aName ? data[aName] : null, photos);
    const halfB = bName === null ? FILLER : await buildSport(bName, data[bName], photos);
    const html = renderHandTemplate('team-directory', { split: [halfA, halfB] }, photos, { dpi: 450 });
    process.stdout.write(`teams_p${i + 1} (${aName}${bName ? ' + ' + bName : ' + verse card'}) … `);
    const t0 = Date.now();
    const out = await exportToFile(html, 'png', 'spread');
    const outPath = path.join(outDir, `teams_p${i + 1}.${out.extension}`);
    fs.writeFileSync(outPath, out.buffer);
    console.log(`ok (${Math.round((Date.now() - t0) / 1000)}s) -> ${outPath}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
