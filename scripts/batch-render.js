#!/usr/bin/env node
/**
 * Batch Render
 *
 * Renders every available session (or just the ones you specify) to PDF
 * and/or PNG using the existing renderLayoutToHtml + Puppeteer pipeline.
 *
 * Output: exports/rendered-{batchName}-{timestamp}/
 *   001-{section}.pdf
 *   001-{section}.png
 *   002-{section}.pdf
 *   002-{section}.png
 *
 * Then in InDesign, File → Place → pick the PDF or PNG and drop it on a page.
 *
 * USAGE:
 *   npm run batch-render -- --all --batch "fall-2025" --format pdf
 *   npm run batch-render -- --all --batch "fall-2025" --format png --quality final
 *   npm run batch-render -- --sessions abc,def --batch "test"
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sessionStore = require('../src/services/sessionStore');
const { renderLayoutToHtml } = require('../src/services/htmlRenderer');
const { exportToFile } = require('../src/services/exporter');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Batch Render

Renders all sessions to PDF or PNG files for placement in InDesign.

Usage:
  npm run batch-render -- [options]

Options:
  --all                       Render every available session
  --sessions <id1,id2,...>    Render specific sessions
  --batch <name>              Folder name (default: "rendered")
  --format <pdf|png>          Output format (default: pdf)
  --quality <draft|standard|final>
                              Render quality (default: standard)
  --out <path>                Output directory (default: exports/)
  --list                      List available sessions and exit
  --help                      Show this help

Examples:
  npm run batch-render -- --all --batch "fall-2025"          PDFs at standard quality
  npm run batch-render -- --all --format png --quality final Final-quality PNGs
`);
}

function slugify(s) {
  return (s || 'untitled')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function pad(n, w = 3) { return String(n).padStart(w, '0'); }

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) { printHelp(); return; }

  if (args.list) {
    const list = sessionStore.listSessions();
    console.log(`${list.length} session(s) available:\n`);
    for (const s of list) {
      console.log(`  ${s.sessionId}  ${s.pageType.padEnd(7)}  ${s.section || '(none)'}`);
    }
    return;
  }

  let sessionIds = [];
  if (args.all) {
    sessionIds = sessionStore.listSessions().map(s => s.sessionId);
  } else if (args.sessions) {
    sessionIds = String(args.sessions).split(',').map(s => s.trim()).filter(Boolean);
  } else {
    console.error('Must specify --all or --sessions <ids>.');
    printHelp();
    process.exit(1);
  }

  if (sessionIds.length === 0) {
    console.error('No sessions to render.');
    process.exit(1);
  }

  const format = args.format || 'pdf';
  const quality = args.quality || 'standard';
  const batchName = args.batch || 'rendered';
  const baseDir = args.out
    ? path.resolve(args.out)
    : path.join(__dirname, '..', 'exports');

  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const folder = path.join(baseDir, `rendered-${slugify(batchName)}-${ts}`);
  fs.mkdirSync(folder, { recursive: true });

  console.log(`Batch render`);
  console.log(`  Sessions:  ${sessionIds.length}`);
  console.log(`  Format:    ${format}`);
  console.log(`  Quality:   ${quality}`);
  console.log(`  Output:    ${folder}`);
  console.log('');

  const results = [];
  const failures = [];

  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];
    const session = sessionStore.getSession(sessionId);
    if (!session) {
      failures.push({ sessionId, error: 'not found' });
      console.log(`[${i + 1}/${sessionIds.length}] ${sessionId.slice(0, 8)}... ✗ session not found`);
      continue;
    }

    const num = pad(i + 1);
    const slug = slugify(session.pageContent?.section || session.pageContent?.pageTitle || 'untitled');
    const outName = `${num}-${slug}`;

    process.stdout.write(`[${i + 1}/${sessionIds.length}] ${outName}... `);

    try {
      const html = renderLayoutToHtml(session.layout, session.photos);
      const result = await exportToFile(html, format, session.pageType, { quality });
      const outPath = path.join(folder, `${outName}.${result.extension}`);
      fs.writeFileSync(outPath, result.buffer);
      results.push({ sessionId, path: outPath, size: result.buffer.length });
      console.log(`✓ (${(result.buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    } catch (err) {
      failures.push({ sessionId, error: err.message });
      console.log(`✗ ${err.message}`);
    }
  }

  console.log('');
  console.log(`Done. ${results.length} succeeded, ${failures.length} failed.`);
  console.log('');
  console.log(`Files in: ${folder}`);
  console.log('');
  console.log('Next:');
  console.log('  Open InDesign → File → Place → pick one of these files → click on a page.');
  console.log('  Or use File → Place and shift-click to pick multiple at once,');
  console.log('  then click on each page to drop them in order.');
}

main().catch(err => {
  console.error('Batch render failed:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
