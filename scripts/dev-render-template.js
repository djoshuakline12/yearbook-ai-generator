#!/usr/bin/env node
/**
 * Dev tool: render a session through a hand-crafted template and save a PNG.
 * For fast local iteration on template layout without the full export pipeline.
 *
 * Usage:
 *   node scripts/dev-render-template.js <sessionIdPrefix> [templateId] [outPath] [dpi] [variant]
 *   node scripts/dev-render-template.js 257ed9e5 cross-gutter-mosaic /tmp/out.png 120 3
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const store = require('../src/services/sessionStore');
const { renderHandTemplate, hasHandTemplate } = require('../src/services/templates');
const puppeteer = require('puppeteer');

const SESSION_ID = process.argv[2];
const TEMPLATE_ID = process.argv[3] || 'cross-gutter-mosaic';
const OUT = process.argv[4] || '/tmp/template-render.png';
const DPI = parseInt(process.argv[5], 10) || 120;
const VARIANT = parseInt(process.argv[6], 10) || 0;

async function main() {
  if (!SESSION_ID) {
    console.error('Usage: node scripts/dev-render-template.js <sessionIdPrefix> [templateId] [outPath] [dpi]');
    process.exit(1);
  }
  if (!hasHandTemplate(TEMPLATE_ID)) {
    console.error(`Unknown template: ${TEMPLATE_ID}`);
    process.exit(1);
  }

  const list = store.listSessions();
  const match = list.find(s => s.sessionId.startsWith(SESSION_ID));
  if (!match) {
    console.error(`Session not found: ${SESSION_ID}`);
    process.exit(1);
  }
  const session = store.getSession(match.sessionId);
  console.log(`Session: ${match.sessionId.slice(0, 8)} (${session.pageContent?.section || 'untitled'}), ${session.photos?.length || 0} photos`);

  const html = renderHandTemplate(TEMPLATE_ID, session.pageContent, session.photos, { dpi: DPI, variant: VARIANT });

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const w = Math.round(16 * DPI);
  const h = Math.round(10.5 * DPI);
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: w, height: h } });
  await browser.close();
  console.log(`Wrote ${OUT} (${w}x${h})`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
