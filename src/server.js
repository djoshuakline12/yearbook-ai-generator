require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const spreadRoutes = require('./routes/spread');
const { errorMiddleware, getRecentErrors, logInfo } = require('./services/errorLogger');
const { getQueueStatus } = require('./services/exporter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Informational landing page (helps filter services categorize as educational)
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yearbook 101 API - Educational Yearbook Design Tool</title>
  <meta name="description" content="Yearbook 101 is an educational web application that helps high school yearbook staff and student journalism programs design professional yearbook page spreads. Used by middle schools, high schools, and journalism classes.">
  <meta name="keywords" content="yearbook, education, school, high school, journalism, student publications, yearbook design, educational software, classroom tool">
  <meta name="robots" content="index, follow">
  <meta name="rating" content="general">
  <meta name="audience" content="students, teachers, schools">
  <meta name="classification" content="Education, Reference">
  <meta name="category" content="Education">
  <meta property="og:title" content="Yearbook 101 - Educational Yearbook Design Tool">
  <meta property="og:description" content="Educational web application for high school yearbook staff and student journalism programs.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Yearbook 101">
  <link rel="canonical" href="https://yearbook101.com/">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      max-width: 720px;
      margin: 40px auto;
      padding: 0 20px;
      color: #1a1a1a;
      line-height: 1.6;
    }
    h1 { color: #523D73; margin-bottom: 8px; }
    h2 { color: #333; margin-top: 32px; }
    .badge {
      display: inline-block;
      background: #523D73;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      letter-spacing: 1px;
      margin-bottom: 24px;
    }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <span class="badge">EDUCATIONAL TOOL</span>
  <h1>Yearbook 101</h1>
  <p><strong>An educational web application for high school yearbook staff and student journalism programs.</strong></p>

  <h2>About</h2>
  <p>Yearbook 101 is a web-based design tool used by middle schools, high schools, and educational institutions to help yearbook editors, advisors, and student journalists create professional yearbook page spreads. The platform is used in classroom settings under teacher supervision as part of journalism, publications, and yearbook programs.</p>

  <h2>For Schools and Educators</h2>
  <p>Our service is used in classroom yearbook production for:</p>
  <ul>
    <li>High school yearbook clubs and publications classes</li>
    <li>Middle school journalism programs</li>
    <li>Student-run school newspapers and publications</li>
    <li>Journalism teachers and yearbook advisors</li>
    <li>Educational publishers including Herff Jones, Jostens, and Walsworth</li>
  </ul>

  <h2>Content Policy</h2>
  <p>This platform contains <strong>no advertising</strong>, <strong>no adult content</strong>, <strong>no public user-generated content</strong>, <strong>no chat or social features</strong>, <strong>no gambling</strong>, and <strong>no external links</strong>. All content is educational and intended for school-supervised use.</p>

  <h2>For Network Administrators</h2>
  <p>If you administer a school network and this site has been miscategorized, please categorize it as <strong>"Education"</strong> or <strong>"Educational Institutions"</strong>. The application is appropriate for student use during school hours and is part of standard journalism curriculum.</p>

  <h2>Privacy</h2>
  <p>Photos and content uploaded to design pages are stored temporarily for editing and automatically deleted after 30 days. No data is shared with third parties. No tracking. No analytics beyond basic error logging.</p>

  <div class="footer">
    <p>Yearbook 101 &middot; Educational yearbook design platform &middot; For school and classroom use</p>
    <p>API Status: <a href="/api/health">Operational</a></p>
  </div>
</body>
</html>`);
});

// Plain JSON health endpoint (for monitoring tools)
app.get('/status', (req, res) => {
  res.json({ status: 'ok' });
});

// SEO essentials — help filter crawlers and Google understand the site
app.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /api/admin/

Sitemap: https://yearbook101.com/sitemap.xml`);
});

app.get('/sitemap.xml', (req, res) => {
  res.set('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yearbook101.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://yearbook101.com/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`);
});

// About page (filter crawlers love this)
app.get('/about', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>About Yearbook 101 - Educational Yearbook Tool</title>
  <meta name="description" content="Yearbook 101 helps schools create yearbook pages. Designed for student journalism programs.">
  <meta name="category" content="Education">
  <link rel="canonical" href="https://yearbook101.com/about">
</head>
<body style="font-family: sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6;">
  <h1>About Yearbook 101</h1>
  <p>Yearbook 101 is an educational web platform designed specifically for student journalism programs and yearbook publications classes. We help students learn page layout, design principles, and publication production in a guided, supervised classroom environment.</p>
  <p>Our tools are used by yearbook staff at middle schools, high schools, and journalism programs across the United States to produce annual school yearbooks.</p>
  <p>The platform is COPPA-aware and intended for use under teacher and yearbook advisor supervision.</p>
  <p><a href="/">Back to home</a></p>
</body>
</html>`);
});

// Health check with queue + memory status
app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
    renderQueue: getQueueStatus(),
  });
});

// Admin endpoint to view recent errors (could be protected with auth in future)
app.get('/api/admin/errors', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json({ errors: getRecentErrors(limit) });
});

// Diagnostic: report the container's Chrome situation and try several
// launch variants, returning which (if any) works and the full stderr of
// each failure. Read-only; used to debug "Failed to launch browser" errors.
app.get('/api/admin/chrome-debug', async (req, res) => {
  const fs = require('fs');
  const { execSync } = require('child_process');
  const puppeteer = require('puppeteer');
  const report = { env: {}, binaries: {}, system: {}, variants: [] };

  report.env.PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || null;
  report.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD || null;

  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/nix', '/etc/debian_version']) {
    report.binaries[p] = fs.existsSync(p);
  }
  try { report.binaries.pathChromium = execSync('command -v chromium || true', { encoding: 'utf8' }).trim() || null; } catch (e) { report.binaries.pathChromium = null; }
  try { report.binaries.puppeteerBundled = puppeteer.executablePath(); } catch (e) { report.binaries.puppeteerBundled = `unavailable: ${e.message}`; }

  // Which binary would the exporter pick, and what version is it?
  let execPath = null;
  for (const p of [process.env.PUPPETEER_EXECUTABLE_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', report.binaries.pathChromium].filter(Boolean)) {
    if (fs.existsSync(p)) { execPath = p; break; }
  }
  report.system.resolvedExecutable = execPath;
  if (execPath) {
    try { report.system.chromeVersion = execSync(`"${execPath}" --version 2>&1`, { encoding: 'utf8', timeout: 15000 }).trim(); }
    catch (e) { report.system.chromeVersion = `FAILED: ${(e.stdout || '') + (e.stderr || '') || e.message}`; }
  }
  try { report.system.memCgroupMax = fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim(); } catch (e) {}
  try { report.system.memAvailable = (fs.readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s*(\d+ kB)/) || [])[1]; } catch (e) {}
  report.system.uid = process.getuid ? process.getuid() : null;

  const variants = [
    { name: 'minimal', opts: { headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] } },
    { name: 'container-set', opts: { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'] } },
    { name: 'old-headless', opts: { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] } },
  ];

  for (const v of variants) {
    const entry = { name: v.name };
    try {
      const opts = { ...v.opts, timeout: 30000 };
      if (execPath) opts.executablePath = execPath;
      const browser = await puppeteer.launch(opts);
      const version = await browser.version();
      await browser.close();
      entry.ok = true;
      entry.version = version;
    } catch (e) {
      entry.ok = false;
      entry.error = String(e.message).slice(0, 3000);
    }
    report.variants.push(entry);
    if (entry.ok) break; // first success is enough
  }

  res.json(report);
});

// Spread generation routes
app.use('/api', spreadRoutes);

// Error handler — must be LAST middleware
app.use(errorMiddleware);

app.listen(PORT, () => {
  logInfo(`Yearbook AI server running on port ${PORT}`);
});

module.exports = app;
