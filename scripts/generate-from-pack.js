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
const COMPILED_TXT = process.env.COMPILED_TXT
  || '/private/tmp/claude-501/-Users-joshkline-Downloads-AI-Yearbook/4c21352d-b981-48ef-ba94-1b846a8ec450/scratchpad/compiled.txt';

// Folder slug → section name as it appears in the compiled doc.
const SECTION_NAMES = {
  '01_bible': 'Bible', '02_english': 'English', '03_math': 'Math',
  '04_science': 'Science', '05_history': 'History', '06_spanish': 'Spanish',
  '07_art': 'Art', '08_media': 'Media',
  '12_praise_and_worship': 'Praise and Worship', '13_gym_health': 'Gym / Health',
  '14_boys_soccer': 'Boys Soccer', '15_girls_soccer': 'Girls Soccer',
  '16_boys_basketball': 'Boys Basketball', '17_girls_basketball': 'Girls Basketball',
  '18_baseball': 'Baseball', '19_softball': 'Softball', '21_cheer': 'Cheer',
  '22_cross_country': 'Cross Country', '23_field_hockey': 'Field Hockey',
  '24_chapel_and_community_groups': 'Chapel and Community Groups',
  '25_see_you_at_the_pole': 'See You at the Pole',
  '26_freshman_retreat': 'Freshman Retreat', '27_senior_retreat': 'Senior Retreat',
  '28_spirit_week': 'Spirit Week', '29_artist_showcase': 'Artist Showcase',
  '30_christmas_show': 'Christmas Show',
  '31_spring_production_a_week_away': 'Spring Production: A Week Away',
  '32_royal_ball': 'Royal Ball', '33_fall_fest_harvest_party': 'Fall Fest / Harvest Party',
  '34_scholarship_banquet': 'Scholarship Banquet', '35_grandparents_day': 'Grandparents Day',
  '36_community_service': 'Community Service',
  '37_student_leadership_council_slc': 'Student Leadership Council (SLC)',
  '38_ambassadors': 'Ambassadors', '39_senior_thesis_project_stp': 'Senior Thesis Project (STP)',
  '40_graduation': 'Graduation', '42_collage_spread': 'Collage Spread',
};

// ---------------------------------------------------------------------------
// Parse the compiled copy into sections.
// Structure per section:  <Section Name>\n<Page Title>\n[<Tagline>]\nSummary\n
//   <body>\nQuotes\n<bullets>\n[Stats & Facts\n<bullets>]\nPhotos\n<bullets>
// ---------------------------------------------------------------------------
function parseCompiled(txt) {
  const lines = txt.split('\n').map(l => l.replace(/ /g, ' ').trimEnd());
  const names = Object.values(SECTION_NAMES);
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
      // Keyword blocks
      while (i < lines.length && !names.includes(lines[i].trim())) {
        const kw = lines[i].trim();
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
            if (m) sec.quotes.push({ attribution: m[1].trim(), text: m[2].replace(/^["""]|["""]$/g, '').trim() });
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
  const csv = parseCsv(fs.readFileSync(path.join(PACK_DIR, 'final_manifest.csv'), 'utf8'));
  const head = csv[0];
  const iPath = head.indexOf('final_path');
  const iCap = head.indexOf('caption');
  const map = {};
  for (const r of csv.slice(1)) {
    const p = r[iPath] || '';
    if (p.startsWith(spreadFolder + '/')) map[path.basename(p).replace(/\.\w+$/, '')] = r[iCap] || '';
  }
  return map;
}

async function main() {
  const [spreadFolder, outDirArg, apiBase = 'https://api.yearbook101.com'] = process.argv.slice(2);
  if (!spreadFolder || !SECTION_NAMES[spreadFolder]) {
    console.error('Usage: node scripts/generate-from-pack.js <spreadFolder> [outDir] [apiBase]');
    console.error('Known folders:', Object.keys(SECTION_NAMES).join(', '));
    process.exit(1);
  }
  const outDir = (outDirArg || path.join(os.homedir(), 'Downloads', 'finished spreads')).replace(/^~/, os.homedir());
  fs.mkdirSync(outDir, { recursive: true });

  const sectionName = SECTION_NAMES[spreadFolder];
  const sections = parseCompiled(fs.readFileSync(COMPILED_TXT, 'utf8'));
  const sec = sections[sectionName];
  if (!sec) { console.error(`Section "${sectionName}" not found in compiled copy`); process.exit(1); }

  // Photos: top-level jpg/png files, sorted (skips _raw_originals & folder_x subdirs)
  const dir = path.join(PACK_DIR, spreadFolder);
  const files = fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png)$/i.test(f) && fs.statSync(path.join(dir, f)).isFile())
    .sort();
  if (!files.length) { console.error(`No photos in ${dir}`); process.exit(1); }

  const capMap = manifestCaptions(spreadFolder);
  const photoCaptions = files.map((f, i) => {
    const cap = capMap[f.replace(/\.\w+$/, '')] || '';
    return cap ? { photoIndex: i, caption: cap, people: '' } : null;
  }).filter(Boolean);

  const pageContent = {
    pageTitle: sec.title.toUpperCase(),
    section: sectionName,
    subheadline: sec.subheadline,
    bodyCopy: sec.bodyCopy,
    quotes: sec.quotes,
    highlights: sec.highlights,
    photoCaptions,
  };

  console.log(`Spread: ${spreadFolder} — "${sec.title}" | ${files.length} photos, ${sec.quotes.length} quotes, ${sec.highlights.length} highlights`);

  // Pre-resize: pack photos are 20-35MB camera originals, over the API's
  // upload cap (the server resizes to ~2000px internally anyway).
  const sharp = require('sharp');
  const form = new FormData();
  for (const f of files) {
    const buf = await sharp(path.join(dir, f))
      .rotate()
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    form.append('photos', new Blob([buf], { type: 'image/jpeg' }), f.replace(/\.\w+$/, '.jpg'));
  }
  form.append('pageContent', JSON.stringify(pageContent));
  form.append('pageType', 'spread');
  form.append('format', 'png');

  const t0 = Date.now();
  const res = await fetch(`${apiBase}/api/generate-spread`, { method: 'POST', body: form });
  if (!res.ok || (res.headers.get('content-type') || '').includes('json')) {
    const body = await res.text();
    console.error(`FAILED (${res.status}): ${body.slice(0, 400)}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (res.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
  const outPath = path.join(outDir, `${spreadFolder}.${ext}`);
  fs.writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${(buf.length / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

main().catch(e => { console.error(e); process.exit(1); });
