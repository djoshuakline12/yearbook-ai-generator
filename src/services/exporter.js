const puppeteer = require('puppeteer');
const { PAGE } = require('../utils/constants');

/**
 * Render HTML to PNG/JPEG or PDF using Puppeteer.
 *
 * @param {string} html - The HTML content to render
 * @param {string} format - 'pdf' or 'png'
 * @param {string} pageType - 'page' (single) or 'spread' (double)
 * @param {object} options - Quality options
 * @param {string} options.quality - 'standard' (fast JPEG) or 'final' (lossless PNG)
 * @param {number} options.dpi - DPI override for pixel dimensions
 */
async function exportToFile(html, format = 'pdf', pageType = 'page', options = {}) {
  const { quality = 'standard' } = options;
  const isFinal = quality === 'final';
  const isDraft = quality === 'draft';

  // Draft mode: low DPI for fast live preview (~1-2 seconds)
  // Standard mode: full DPI for good quality (~5-10 seconds)
  // Final mode: max DPI lossless PNG (~30-60 seconds)
  const effectiveDpi = isDraft ? 150 : (isFinal ? (options.dpi || PAGE.FINAL_DPI) : PAGE.DPI);

  const isSpread = pageType === 'spread';
  const widthPx = Math.round((isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN) * effectiveDpi);
  const heightPx = Math.round(PAGE.HEIGHT_IN * effectiveDpi);
  const widthIn = isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN;
  const heightIn = PAGE.HEIGHT_IN;

  const memoryMb = isFinal ? 2048 : (isDraft ? 512 : 1024);
  const contentTimeout = isFinal ? 300000 : (isDraft ? 30000 : 120000);
  const fontTimeout = isFinal ? 15000 : (isDraft ? 3000 : 10000);
  const renderDelay = isFinal ? 3000 : (isDraft ? 300 : 1500);

  console.log(`Export: ${quality} quality, ${effectiveDpi} DPI, ${widthPx}x${heightPx}px, format=${format}`);

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
      `--js-flags=--max-old-space-size=${memoryMb}`,
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
      waitUntil: 'domcontentloaded',
      timeout: contentTimeout,
    });

    // Wait for fonts to load (with timeout)
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise(r => setTimeout(r, fontTimeout))
    ]);

    // Delay for final rendering
    await new Promise(r => setTimeout(r, renderDelay));

    if (format === 'png') {
      if (isFinal) {
        // Final quality: true lossless PNG
        const buffer = await page.screenshot({
          type: 'png',
          clip: { x: 0, y: 0, width: widthPx, height: heightPx },
          omitBackground: false,
        });
        return { buffer, mimeType: 'image/png', extension: 'png' };
      }

      // Standard quality: fast JPEG
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: 98,
        clip: { x: 0, y: 0, width: widthPx, height: heightPx },
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
