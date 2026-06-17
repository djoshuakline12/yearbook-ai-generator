#!/usr/bin/env node
/**
 * InDesign Bundle Export CLI
 *
 * Usage:
 *   node scripts/export-indesign.js --all --batch "fall-2024"
 *   node scripts/export-indesign.js --sessions <uuid1>,<uuid2> --batch "test"
 *   node scripts/export-indesign.js --list
 *
 * Output: exports/{batch}-{timestamp}/  (bundle folder)
 */

const path = require('path');

// Load env so sessionStore picks up the right SESSIONS_DIR if configured
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { buildBundle, listExportableSessions } = require('../src/services/indesignExporter');

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
Yearbook → InDesign Bundle Exporter

Usage:
  node scripts/export-indesign.js [options]

Options:
  --all                          Export every available session
  --sessions <id1,id2,...>       Comma-separated session IDs to export
  --batch <name>                 Name for the bundle (default: "bundle")
  --out <path>                   Custom output directory (default: exports/)
  --list                         List available sessions and exit
  --help                         Show this help

Examples:
  node scripts/export-indesign.js --list
  node scripts/export-indesign.js --all --batch "fall-2025-yearbook"
  node scripts/export-indesign.js --sessions abc-123,def-456 --batch "athletics"
`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    return;
  }

  if (args.list) {
    const list = listExportableSessions();
    if (list.length === 0) {
      console.log('No sessions found in sessions/.');
      console.log('Generate one first via the web UI or POST /api/generate-spread.');
      return;
    }
    console.log(`${list.length} session(s) available:\n`);
    for (const s of list) {
      const created = new Date(s.createdAt).toLocaleString();
      console.log(`  ${s.sessionId}`);
      console.log(`    Type:     ${s.pageType}`);
      console.log(`    Section:  ${s.section || '(none)'}`);
      console.log(`    Title:    ${s.pageTitle || '(none)'}`);
      console.log(`    Photos:   ${s.photoCount}`);
      console.log(`    Created:  ${created}`);
      console.log('');
    }
    return;
  }

  // Determine which sessions to export
  let sessionIds = [];
  if (args.all) {
    sessionIds = listExportableSessions().map(s => s.sessionId);
    if (sessionIds.length === 0) {
      console.error('No sessions found. Generate one first.');
      process.exit(1);
    }
  } else if (args.sessions) {
    sessionIds = String(args.sessions).split(',').map(s => s.trim()).filter(Boolean);
  } else {
    console.error('Must specify --all or --sessions <ids>.');
    printHelp();
    process.exit(1);
  }

  const batchName = args.batch || 'bundle';
  const outputDir = args.out ? path.resolve(args.out) : undefined;

  console.log(`Exporting ${sessionIds.length} session(s) as bundle "${batchName}"...`);

  const result = await buildBundle({ sessionIds, outputDir, batchName });

  console.log('');
  console.log('✓ Bundle created successfully');
  console.log('');
  console.log(`  Location:     ${result.bundlePath}`);
  console.log(`  Manifest:     ${result.manifestPath}`);
  console.log(`  Spreads:      ${result.spreadCount}`);
  console.log(`  Photos:       ${result.totalPhotos}`);
  if (result.warnings && result.warnings.length > 0) {
    console.log('');
    console.log(`  Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) console.log(`    - ${w}`);
  }
  console.log('');
  console.log('Next:');
  console.log('  1. Open Adobe InDesign 2024+');
  console.log('  2. Window → Utilities → Scripts');
  console.log('  3. Run "ImportYearbook.jsx" from the indesign/ folder');
  console.log(`  4. When prompted, choose: ${result.bundlePath}`);
}

main().catch(err => {
  console.error('Export failed:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
