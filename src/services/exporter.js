const puppeteer = require('puppeteer');
const { PAGE } = require('../utils/constants');

/**
 * Render HTML to a 300 DPI PNG or PDF using Puppeteer.
 * @param {string} html - The HTML content to render
 * @param {string} format - 'pdf' or 'png'
 * @param {string} pageType - 'page' (single) or 'spread' (double)
 */
async function exportToFile(html, format = 'pdf', pageType = 'page') {
  const isSpread = pageType === 'spread';
  const widthPx = isSpread ? PAGE.SPREAD_WIDTH_PX : PAGE.WIDTH_PX;
  const heightPx = PAGE.HEIGHT_PX;
  const widthIn = isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN;
  const heightIn = PAGE.HEIGHT_IN;

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      // Memory optimization for large renders
      '--js-flags=--max-old-space-size=512',
    ],
  };

  // Use system Chromium on Railway/Docker if available
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();

    // Set viewport to exact pixel dimensions
    await page.setViewport({
      width: widthPx,
      height: heightPx,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',  // Fastest - just wait for DOM, images are base64 embedded
      timeout: 60000,  // Increased for higher DPI rendering
    });

    // Wait for fonts to load (with timeout)
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise(r => setTimeout(r, 5000))  // 5s max for fonts
    ]);

    // Brief delay for final rendering
    await new Promise(r => setTimeout(r, 800));

    if (format === 'png') {
      // Use JPEG for faster encoding at high DPI, with high quality
      // PNG is slow for large images; JPEG at 95% quality is visually identical but much faster
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: 95,
        clip: {
          x: 0,
          y: 0,
          width: widthPx,
          height: heightPx,
        },
        omitBackground: false,
      });
      return { buffer, mimeType: 'image/jpeg', extension: 'jpg' };
    }

    // PDF export
    const pdfBuffer = await page.pdf({
      width: `${widthIn}in`,
      height: `${heightIn}in`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return { buffer: pdfBuffer, mimeType: 'application/pdf', extension: 'pdf' };
  } finally {
    await browser.close();
  }
}

module.exports = { exportToFile };
