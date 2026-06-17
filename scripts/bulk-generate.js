#!/usr/bin/env node
/**
 * Bulk Yearbook Generator
 *
 * Reads a folder of page content + photos and generates sessions for every
 * spread/page described. Designed for producing a whole yearbook in one pass.
 *
 * INPUT FOLDER STRUCTURE:
 *
 *   MyYearbook/
 *     pages.csv                      # Master spreadsheet with one row per page
 *     boys-soccer/                   # One folder per page (name matches "folder" column)
 *       01-action-shot.jpg
 *       02-game-day.jpg
 *       captions.csv                 # Optional per-photo captions
 *     girls-soccer/
 *       ...
 *
 * pages.csv COLUMNS (all optional except "folder" and one of section/pageTitle/headline):
 *   folder, pageType, pageCategory, section, pageTitle, pageTitleThemeWord,
 *   headline, record, dateOrYear, bodyCopy,
 *   roster, coaches, rosterTitle, coachesTitle,
 *   quotes, highlights, folio
 *
 * Multi-value columns use ";" as separator:
 *   roster:    "Jane Smith; John Doe; Mary Jones"
 *   coaches:   "Coach Smith; Coach Jones"
 *   quotes:    "Best season ever — Jane; Loved it — John"
 *   highlights:"Won state; All-conference selections"
 *
 * captions.csv COLUMNS (in each photo folder):
 *   filename, captionTitle, caption, people, isPrimary
 *
 * USAGE:
 *   npm run bulk-generate -- --input "/path/to/MyYearbook"
 *   npm run bulk-generate -- --input "/path/to/MyYearbook" --no-polish
 *   npm run bulk-generate -- --input "/path/to/MyYearbook" --no-crop
 *   npm run bulk-generate -- --input "/path/to/MyYearbook" --only "boys-soccer,homecoming"
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { processPhotos } = require('../src/services/imageProcessor');
const { generateLayout } = require('../src/services/layoutGenerator');
const { polishContent } = require('../src/services/contentPolisher');
const { analyzePhotosForCropping } = require('../src/services/smartCrop');
const sessionStore = require('../src/services/sessionStore');
const { getTheme } = require('../src/utils/themes');

// ---------- Argument parsing ----------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Bulk Yearbook Generator

Usage:
  npm run bulk-generate -- --input <folder> [options]

Options:
  --input <folder>      Input folder containing pages.csv + page subfolders (required)
  --no-polish           Skip AI content polishing (faster, raw text used)
  --no-crop             Skip AI smart crop analysis (faster, default crop used)
  --only <list>         Only process specific folders (comma-separated)
  --theme <preset>      Theme preset name (default: dchs-official)
  --dry-run             Validate input without generating
  --help                Show this help

Example pages.csv:
  folder,pageType,section,pageTitle,headline,bodyCopy,roster
  boys-soccer,spread,Boy's Soccer,BUILDING RESILIENCE,11 as 1,The Royals had..., "John;Jane;Mary"
  homecoming,collage,Homecoming,BUILDING MEMORIES,,,
  chapel,spread,Chapel,BUILDING FAITH,,We gathered weekly...,

Each "folder" column value must match a subdirectory in the input folder
containing the photos for that page.
`);
}

// ---------- Minimal CSV parser (handles quotes, commas, newlines in quoted fields) ----------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      // End of row (skip \r\n combo)
      row.push(cur);
      cur = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

function loadCsv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rec = {};
    for (let j = 0; j < headers.length; j++) {
      rec[headers[j]] = row[j] != null ? row[j].trim() : '';
    }
    records.push(rec);
  }
  return records;
}

// ---------- Helpers ----------

function splitMulti(s) {
  if (!s) return [];
  return String(s).split(';').map(x => x.trim()).filter(Boolean);
}

function parseQuotes(s) {
  if (!s) return [];
  // Format: "text — Attribution; text2 — Attribution2"
  return splitMulti(s).map(item => {
    const m = item.match(/^(.+?)\s*[—-]\s*(.+)$/);
    if (m) return { text: m[1].trim(), attribution: m[2].trim() };
    return { text: item, attribution: '' };
  });
}

function isImage(filename) {
  return /\.(jpe?g|png|webp)$/i.test(filename);
}

function loadPageContent(row) {
  return {
    pageCategory: row.pageCategory || '',
    section: row.section || '',
    pageTitle: row.pageTitle || '',
    pageTitleThemeWord: row.pageTitleThemeWord || '',
    headline: row.headline || '',
    subheadline: row.subheadline || '',
    record: row.record || '',
    dateOrYear: row.dateOrYear || '',
    bodyCopy: row.bodyCopy || '',
    roster: splitMulti(row.roster),
    coaches: splitMulti(row.coaches),
    rosterTitle: row.rosterTitle || '',
    coachesTitle: row.coachesTitle || '',
    quotes: parseQuotes(row.quotes),
    highlights: splitMulti(row.highlights),
    folio: row.folio || '',
    photoCaptions: [], // populated from captions.csv
  };
}

/**
 * For a folder of photos, collect image files (sorted by filename) and
 * merge in captions.csv data if present.
 *
 * Returns { fakeMulterFiles, captions } where:
 *   fakeMulterFiles : [{ path, originalname }] usable with processPhotos()
 *   captions        : [{ photoIndex, caption, captionTitle, people, isPrimary }]
 */
function loadPhotosFromFolder(folderPath) {
  if (!fs.existsSync(folderPath)) return { fakeMulterFiles: [], captions: [] };

  const entries = fs.readdirSync(folderPath);
  const imageFiles = entries
    .filter(name => isImage(name))
    .sort()
    .map(name => path.join(folderPath, name));

  const captionsCsvPath = path.join(folderPath, 'captions.csv');
  const captionRecords = fs.existsSync(captionsCsvPath) ? loadCsv(captionsCsvPath) : [];
  const captionByName = {};
  for (const rec of captionRecords) {
    if (rec.filename) captionByName[rec.filename] = rec;
  }

  const captions = [];
  const fakeMulterFiles = imageFiles.map((fullPath, idx) => {
    const basename = path.basename(fullPath);
    const cap = captionByName[basename];
    if (cap) {
      captions.push({
        photoIndex: idx,
        captionTitle: cap.captionTitle || '',
        caption: cap.caption || '',
        people: cap.people || '',
        isPrimary: cap.isPrimary === 'true' || cap.isPrimary === '1',
      });
    }
    return { path: fullPath, originalname: basename };
  });

  return { fakeMulterFiles, captions };
}

// ---------- Main pipeline (mirrors POST /api/generate-spread, no Puppeteer) ----------

async function generateOnePage({ row, inputDir, theme, options }) {
  const folderName = row.folder;
  if (!folderName) throw new Error('row is missing "folder" column');

  const folderPath = path.join(inputDir, folderName);
  const pageType = row.pageType || 'spread';
  const category = row.pageCategory || 'activity';
  const photosRequired = category !== 'divider' && category !== 'index';

  const { fakeMulterFiles, captions } = loadPhotosFromFolder(folderPath);

  if (photosRequired && fakeMulterFiles.length === 0) {
    throw new Error(`No photos found in folder "${folderName}" (category=${category} requires photos)`);
  }

  // Build pageContent
  let pageContent = loadPageContent(row);
  pageContent.photoCaptions = captions;

  if (!pageContent.section && !pageContent.headline && !pageContent.pageTitle) {
    throw new Error('row needs at least one of: section, headline, pageTitle');
  }

  // 1. Process photos
  let photoResults = fakeMulterFiles.length > 0 ? await processPhotos(fakeMulterFiles) : [];

  // 2. Smart crop (optional)
  if (options.useCrop && photoResults.length > 0 && photosRequired) {
    try {
      photoResults = await analyzePhotosForCropping(photoResults);
    } catch (e) {
      console.warn('  Smart crop failed:', e.message);
    }
  }

  // 3. Content polish (optional)
  if (options.usePolish && category !== 'index') {
    try {
      const photoDescriptions = photoResults.map((p, i) => {
        const cap = captions.find(c => c.photoIndex === i) || {};
        return {
          index: i,
          orientation: p.orientation,
          people: cap.people || '',
          caption: cap.caption || '',
          isPrimary: !!cap.isPrimary,
        };
      });
      const detectedCat = category === 'activity' ? null : category;
      pageContent = await polishContent(pageContent, photoDescriptions, detectedCat || 'general');
    } catch (e) {
      console.warn('  Content polish failed:', e.message);
    }
  }

  // 4. Layout
  const layout = await generateLayout({
    photos: photoResults,
    pageContent,
    theme,
    pageType,
  });

  // 5. Save session (this also stores photos as base64 in the session JSON)
  const sessionId = sessionStore.createSession(photoResults, layout, pageContent, theme, pageType);

  return {
    sessionId,
    folder: folderName,
    section: pageContent.section || pageContent.pageTitle || '(untitled)',
    photoCount: photoResults.length,
    pageType,
  };
}

// ---------- Validation pass ----------

function validate(inputDir, records, options) {
  const errors = [];
  const warnings = [];

  if (!records || records.length === 0) {
    errors.push('pages.csv is empty');
    return { errors, warnings };
  }

  for (const row of records) {
    if (options.only && !options.only.includes(row.folder)) continue;
    if (!row.folder) {
      errors.push('Row missing "folder" column: ' + JSON.stringify(row));
      continue;
    }
    const folderPath = path.join(inputDir, row.folder);
    const exists = fs.existsSync(folderPath);

    const category = row.pageCategory || 'activity';
    const photosRequired = category !== 'divider' && category !== 'index';

    if (!exists && photosRequired) {
      errors.push(`Folder not found: ${row.folder} (required for category=${category})`);
      continue;
    }
    if (exists) {
      const imgs = fs.readdirSync(folderPath).filter(isImage);
      if (photosRequired && imgs.length === 0) {
        errors.push(`No photos in: ${row.folder}`);
      }
      if (imgs.length > 15) {
        warnings.push(`${row.folder}: ${imgs.length} photos (max 15 will be used)`);
      }
    }

    if (!row.section && !row.headline && !row.pageTitle) {
      errors.push(`${row.folder}: needs at least one of section, headline, pageTitle`);
    }
  }

  return { errors, warnings };
}

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    return;
  }
  if (!args.input) {
    console.error('Error: --input <folder> is required.\n');
    printHelp();
    process.exit(1);
  }

  const inputDir = path.resolve(args.input);
  if (!fs.existsSync(inputDir)) {
    console.error(`Input folder not found: ${inputDir}`);
    process.exit(1);
  }

  const pagesCsvPath = path.join(inputDir, 'pages.csv');
  const records = loadCsv(pagesCsvPath);
  if (!records) {
    console.error(`pages.csv not found in ${inputDir}`);
    process.exit(1);
  }

  const options = {
    usePolish: !args['no-polish'],
    useCrop: !args['no-crop'],
    only: args.only ? args.only.split(',').map(s => s.trim()) : null,
    dryRun: !!args['dry-run'],
    themeName: args.theme || 'dchs-official',
  };

  // Validate first
  const { errors, warnings } = validate(inputDir, records, options);
  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const w of warnings) console.log('  ! ' + w);
    console.log('');
  }
  if (errors.length > 0) {
    console.error('Errors (fix these before proceeding):');
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
  }

  // Filter rows by --only if set
  let rowsToProcess = records;
  if (options.only) {
    rowsToProcess = records.filter(r => options.only.includes(r.folder));
  }

  console.log(`Bulk generator`);
  console.log(`  Input:        ${inputDir}`);
  console.log(`  Pages:        ${rowsToProcess.length}`);
  console.log(`  Smart crop:   ${options.useCrop ? 'ON' : 'OFF'}`);
  console.log(`  Content polish: ${options.usePolish ? 'ON' : 'OFF'}`);
  console.log(`  Theme:        ${options.themeName}`);
  console.log('');

  if (options.dryRun) {
    console.log('Dry run — exiting without generating.');
    return;
  }

  const theme = getTheme(options.themeName);

  const results = [];
  const failures = [];

  for (let i = 0; i < rowsToProcess.length; i++) {
    const row = rowsToProcess[i];
    const num = `[${i + 1}/${rowsToProcess.length}]`;
    process.stdout.write(`${num} ${row.folder}... `);
    try {
      const result = await generateOnePage({ row, inputDir, theme, options });
      results.push(result);
      console.log(`✓ session ${result.sessionId.slice(0, 8)}... (${result.photoCount} photos)`);
    } catch (e) {
      failures.push({ folder: row.folder, error: e.message });
      console.log(`✗ ${e.message}`);
    }
  }

  console.log('');
  console.log(`Done. ${results.length} succeeded, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.log('');
    console.log('Failed pages:');
    for (const f of failures) console.log(`  ${f.folder}: ${f.error}`);
  }
  console.log('');
  console.log('Next step:');
  console.log('  npm run export:indesign -- --all --batch "my-yearbook"');
}

main().catch(err => {
  console.error('Bulk generate failed:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
