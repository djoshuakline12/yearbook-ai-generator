#!/usr/bin/env node
/**
 * Import from yearbook_import_pack
 *
 * Takes a folder produced by your photo pipeline (numbered subfolders +
 * final_manifest.csv) and a compiled .docx with one page per section
 * and produces:
 *
 *   <pack>/pages.csv               # Used by bulk-generate
 *   <pack>/{folder}/captions.csv   # Per-photo captions per folder
 *
 * After running this, run:
 *
 *   npm run bulk-generate -- --input <pack>
 *   npm run export:indesign -- --all --batch "fall-2025"
 *
 * The docx is expected to have one Heading1 per page (section title),
 * followed by an italic tagline paragraph, then Heading3 sections for
 * Summary, Quotes, Stats & Facts, and Photos.
 *
 * The pack must contain final_manifest.csv with columns:
 *   spread_num, spread_title, caption, final_path
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------- args ----------

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
Yearbook Import Pack → pages.csv Converter

Reads a yearbook_import_pack folder (numbered subfolders + final_manifest.csv)
and a compiled .docx of page content, then writes a pages.csv ready for
bulk-generate.js plus per-folder captions.csv.

Usage:
  node scripts/import-from-pack.js --pack <folder> --doc <docx>

Options:
  --pack <folder>     Path to yearbook_import_pack folder (required)
  --doc <docx>        Path to compiled .docx (required)
  --dry-run           Show what would be written without modifying files
  --help              Show this help

Example:
  node scripts/import-from-pack.js \\
    --pack ~/Desktop/yearbook_import_pack \\
    --doc "/Volumes/joshdrive/2Yearbook_2025-2026_Compiled.docx"
`);
}

// ---------- CSV ----------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i++; continue; }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cur); cur = ''; i++; continue; }
    if (ch === '\n' || ch === '\r') {
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

function csvEscape(s) {
  if (s == null) return '';
  s = String(s);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowToCsv(values) {
  return values.map(csvEscape).join(',');
}

function loadCsv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const rec = {};
    for (let j = 0; j < headers.length; j++) {
      rec[headers[j]] = row[j] != null ? row[j].trim() : '';
    }
    return rec;
  });
}

// ---------- docx extraction ----------

function extractDocxXml(docxPath) {
  // unzip the document.xml out of the docx; works without extra deps
  // because docx is just a zip.
  const tmpFile = path.join(require('os').tmpdir(), 'yb-extract-' + Date.now() + '.xml');
  try {
    execSync(`unzip -p "${docxPath}" word/document.xml > "${tmpFile}"`);
    return fs.readFileSync(tmpFile, 'utf8');
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * Parse the docx XML into an array of paragraph descriptors:
 *   [{ style, text, runs: [{bold, italic, text}] }, ...]
 */
function parseDocxParagraphs(xml) {
  const paragraphs = [];
  // Split on <w:p> ... </w:p>. The opening tag may have attrs.
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m;
  while ((m = pRegex.exec(xml)) !== null) {
    const inner = m[1];

    // Extract paragraph style
    const styleMatch = inner.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
    const style = styleMatch ? styleMatch[1] : '';

    // Extract list info (numPr + ilvl + numId)
    const listMatch = inner.match(/<w:numPr>/);
    const isList = !!listMatch;

    // Extract runs. Each <w:r> ... </w:r> may contain <w:rPr>...</w:rPr>
    // and one or more <w:t>...</w:t> elements.
    const runs = [];
    const rRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    let rm;
    while ((rm = rRegex.exec(inner)) !== null) {
      const runInner = rm[1];
      const rpr = (runInner.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [])[1] || '';
      const bold = /<w:b\s*\/>/.test(rpr) || /<w:b\b[^>]*\/>/.test(rpr);
      const italic = /<w:i\s*\/>/.test(rpr) || /<w:i\b[^>]*\/>/.test(rpr);
      const tMatches = runInner.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const text = tMatches
        .map(t => decodeXmlEntities(t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')))
        .join('');
      if (text) runs.push({ bold, italic, text });
    }

    const text = runs.map(r => r.text).join('').trim();
    paragraphs.push({ style, isList, text, runs });
  }
  return paragraphs;
}

/**
 * Group parsed paragraphs by Heading1 → page.
 * Within each page, identify subsections by Heading3.
 *
 * Returns array of:
 *   {
 *     title,         // Heading1 text
 *     tagline,       // first italic-styled paragraph after title
 *     summary,       // paragraphs after "Summary" heading until next heading
 *     quotes,        // bullets after "Quotes" heading: { name, text }
 *     stats,         // bullets after "Stats & Facts" heading
 *     photos,        // bullets after "Photos" heading: caption strings
 *   }
 */
function groupIntoPages(paragraphs) {
  const pages = [];
  let current = null;
  let subsection = null;

  for (const p of paragraphs) {
    if (p.style === 'Heading1') {
      if (current) pages.push(current);
      current = {
        title: p.text,
        tagline: '',
        summary: '',
        quotes: [],
        stats: [],
        photos: [],
      };
      subsection = 'tagline'; // next italic paragraph likely the tagline
      continue;
    }
    if (!current) continue;

    if (p.style === 'Heading3') {
      const sec = p.text.toLowerCase();
      if (sec.indexOf('summary') >= 0) subsection = 'summary';
      else if (sec.indexOf('quote') >= 0) subsection = 'quotes';
      else if (sec.indexOf('stat') >= 0 || sec.indexOf('fact') >= 0) subsection = 'stats';
      else if (sec.indexOf('photo') >= 0) subsection = 'photos';
      else subsection = null;
      continue;
    }

    if (!p.text) continue;

    if (subsection === 'tagline') {
      // First non-empty paragraph after title; usually italic
      if (!current.tagline) current.tagline = p.text;
      subsection = null;
      continue;
    }

    if (subsection === 'summary') {
      current.summary = current.summary
        ? current.summary + '\n\n' + p.text
        : p.text;
      continue;
    }

    if (subsection === 'quotes' && p.isList) {
      // Format: bold "Name (grade):" then italic "text"
      const boldRun = p.runs.find(r => r.bold);
      const italicRun = p.runs.find(r => r.italic);
      let name = boldRun ? boldRun.text : '';
      let text = italicRun ? italicRun.text : '';
      name = name.replace(/[:\s]+$/, '').trim();
      // Remove surrounding quotes from quote text
      text = text.replace(/^["“]|["”]$/g, '').trim();
      if (text) current.quotes.push({ name, text });
      continue;
    }

    if (subsection === 'stats' && p.isList) {
      current.stats.push(p.text);
      continue;
    }

    if (subsection === 'photos' && p.isList) {
      // Format: "Caption text - https://drive..." — strip URL portion.
      let cap = p.text;
      const dashIdx = cap.lastIndexOf(' - ');
      if (dashIdx > 0 && /https?:\/\//.test(cap.slice(dashIdx))) {
        cap = cap.slice(0, dashIdx);
      }
      current.photos.push(cap.trim());
      continue;
    }
  }
  if (current) pages.push(current);
  return pages;
}

// ---------- mapping pages.csv ----------

function slugFolderMatch(packDir, sectionTitle) {
  // pages in the pack use names like "14_boys_soccer".
  // Match by normalized form of sectionTitle.
  const norm = sectionTitle.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const entries = fs.readdirSync(packDir).filter(f =>
    fs.statSync(path.join(packDir, f)).isDirectory()
  );
  // Exact match after stripping leading digits + underscore
  for (const entry of entries) {
    const stripped = entry.replace(/^\d+_+/, '');
    if (stripped === norm) return entry;
  }
  // Loose match (substring)
  for (const entry of entries) {
    const stripped = entry.replace(/^\d+_+/, '');
    if (stripped.indexOf(norm) >= 0 || norm.indexOf(stripped) >= 0) return entry;
  }
  return null;
}

function listImagesInFolder(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  return fs.readdirSync(folderPath)
    .filter(name => /\.(jpe?g|png|webp)$/i.test(name))
    .sort();
}

/**
 * Try to match a caption string (from docx photos section) to a file in the
 * folder, using the manifest if available (caption → final_path).
 *
 * Returns the filename (basename) or null.
 */
function captionToFile(caption, manifestForSpread, availableFiles) {
  if (!caption) return null;
  // 1. Exact-ish manifest match.
  for (const row of manifestForSpread) {
    if (!row.caption || !row.final_path) continue;
    const normMan = row.caption.toLowerCase().replace(/\s+/g, ' ').trim();
    const normCap = caption.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normMan === normCap || normMan.indexOf(normCap) >= 0 || normCap.indexOf(normMan) >= 0) {
      const base = path.basename(row.final_path);
      if (availableFiles.indexOf(base) >= 0) return base;
    }
  }
  return null;
}

function deriveCaptionFromFilename(filename) {
  // boys_soccer_05_team_meeting_halftime_tough.jpg
  //   → spread tokens are first few words, then a number, then descriptors
  // Strip extension and split.
  const base = filename.replace(/\.(jpe?g|png|webp)$/i, '');
  const parts = base.split('_');
  // Drop the spread-name prefix and any leading sequence number.
  const idx = parts.findIndex(p => /^\d+$/.test(p));
  const after = idx >= 0 ? parts.slice(idx + 1) : parts;
  return after.join(' ').replace(/\s+/g, ' ').trim();
}

function extractCaptionTitle(caption) {
  // Use first 2-3 strong words, ALL CAPS.
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'his', 'her', 'their', 'on', 'in', 'to', 'of', 'at', 'by']);
  const words = caption.split(/\s+/).filter(w => w.length && !stop.has(w.toLowerCase()));
  return words.slice(0, 2).join(' ').toUpperCase();
}

function extractPeople(caption) {
  // Find patterns like "Name Lastname (10)" — return joined.
  const matches = caption.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*\(\d+\)/g) || [];
  return matches.join('; ');
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.pack && !args.doc)) {
    printHelp();
    return;
  }
  if (!args.pack || !args.doc) {
    console.error('Both --pack and --doc are required.\n');
    printHelp();
    process.exit(1);
  }

  const packDir = path.resolve(args.pack);
  const docPath = path.resolve(args.doc);

  if (!fs.existsSync(packDir)) {
    console.error('Pack folder not found:', packDir);
    process.exit(1);
  }
  if (!fs.existsSync(docPath)) {
    console.error('Docx not found:', docPath);
    process.exit(1);
  }

  console.log('Parsing docx...');
  const xml = extractDocxXml(docPath);
  const paragraphs = parseDocxParagraphs(xml);
  const pages = groupIntoPages(paragraphs);
  console.log('  Found ' + pages.length + ' pages in document.');

  // Load manifest
  const manifestPath = path.join(packDir, 'final_manifest.csv');
  const manifest = fs.existsSync(manifestPath) ? loadCsv(manifestPath) : [];
  console.log('  Loaded ' + manifest.length + ' manifest rows.');

  // Build pages.csv
  const pagesRows = [];
  pagesRows.push([
    'folder', 'pageType', 'pageCategory', 'section', 'pageTitle',
    'pageTitleThemeWord', 'headline', 'record', 'dateOrYear',
    'bodyCopy', 'roster', 'coaches', 'rosterTitle', 'coachesTitle',
    'quotes', 'highlights', 'folio'
  ]);

  const captionsByFolder = {};
  const unmatched = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const folder = slugFolderMatch(packDir, page.title);
    if (!folder) {
      console.log('  ! No folder match for: ' + page.title);
      unmatched.push(page.title);
      continue;
    }

    const folderPath = path.join(packDir, folder);
    const availableFiles = listImagesInFolder(folderPath);

    // Manifest rows for this spread
    // Spread num is the leading number on the folder name
    const folderNum = folder.match(/^(\d+)_/);
    const spreadNum = folderNum ? folderNum[1] : '';
    const manifestRows = manifest.filter(r => r.spread_num === spreadNum);

    // Build quote string
    const quoteString = page.quotes
      .map(q => q.name ? (q.text + ' — ' + q.name) : q.text)
      .join('; ');

    // Build highlights string
    const highlightsString = page.stats.join('; ');

    // Determine page category — for now everything is 'activity' unless
    // it's the collage spread.
    let pageCategory = 'activity';
    if (/collage/i.test(folder)) pageCategory = 'collage';

    // Derive page title from tagline if present
    const titleSource = page.tagline || page.title;
    const pageTitleUpper = titleSource.toUpperCase();
    const themeWord = (pageTitleUpper.split(' ')[0] || '').replace(/[^A-Z]/g, '');

    pagesRows.push([
      folder,
      'spread',
      pageCategory,
      page.title,
      pageTitleUpper,
      themeWord,
      '', // headline — not in docx
      '', // record
      '', // dateOrYear
      page.summary,
      '', // roster — not consistently in docx
      '', // coaches
      '', '',
      quoteString,
      highlightsString,
      '', // folio
    ]);

    // Build per-folder captions.csv
    const captionsRows = [];
    captionsRows.push(['filename', 'captionTitle', 'caption', 'people', 'isPrimary']);

    let captionedCount = 0;
    const usedFiles = new Set();

    // First pass: use docx photo captions matched to manifest files
    for (let pi = 0; pi < page.photos.length; pi++) {
      const cap = page.photos[pi];
      const matchedFile = captionToFile(cap, manifestRows, availableFiles);
      if (matchedFile && !usedFiles.has(matchedFile)) {
        usedFiles.add(matchedFile);
        captionsRows.push([
          matchedFile,
          extractCaptionTitle(cap),
          cap,
          extractPeople(cap),
          pi === 0 ? 'true' : 'false',
        ]);
        captionedCount++;
      }
    }

    // Second pass: remaining files get filename-derived captions
    for (const file of availableFiles) {
      if (usedFiles.has(file)) continue;
      const derived = deriveCaptionFromFilename(file);
      if (!derived) continue;
      captionsRows.push([
        file,
        extractCaptionTitle(derived),
        derived,
        extractPeople(derived),
        usedFiles.size === 0 ? 'true' : 'false',
      ]);
      usedFiles.add(file);
    }

    captionsByFolder[folder] = captionsRows;
    console.log('  ✓ ' + folder + ' (' + page.photos.length + ' docx photos, ' + availableFiles.length + ' files, ' + captionedCount + ' matched)');
  }

  // Write outputs
  if (args['dry-run']) {
    console.log('\nDry run — no files written.');
    console.log('Would write: ' + path.join(packDir, 'pages.csv'));
    console.log('Would write per-folder captions.csv for ' + Object.keys(captionsByFolder).length + ' folders.');
    if (unmatched.length > 0) {
      console.log('\nUnmatched pages: ' + unmatched.join(', '));
    }
    return;
  }

  const pagesCsvPath = path.join(packDir, 'pages.csv');
  fs.writeFileSync(pagesCsvPath, pagesRows.map(rowToCsv).join('\n'));
  console.log('\n✓ Wrote: ' + pagesCsvPath);

  for (const folder of Object.keys(captionsByFolder)) {
    const captionsPath = path.join(packDir, folder, 'captions.csv');
    fs.writeFileSync(captionsPath, captionsByFolder[folder].map(rowToCsv).join('\n'));
  }
  console.log('✓ Wrote captions.csv in ' + Object.keys(captionsByFolder).length + ' folders.');

  if (unmatched.length > 0) {
    console.log('\nUnmatched docx pages (no folder found):');
    for (const t of unmatched) console.log('  - ' + t);
  }

  console.log('\nNext steps:');
  console.log('  npm run bulk-generate -- --input "' + packDir + '" --dry-run');
  console.log('  npm run bulk-generate -- --input "' + packDir + '"');
  console.log('  npm run export:indesign -- --all --batch "fall-2025"');
}

main().catch(err => {
  console.error('Import-from-pack failed:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
