const puppeteer = require('puppeteer');
const { PAGE } = require('../utils/constants');

/**
 * Render HTML to a 300 DPI PNG or PDF using Puppeteer.
 */
async function exportToFile(html, format = 'pdf') {
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
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
      width: PAGE.WIDTH_PX,
      height: PAGE.HEIGHT_PX,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Small extra delay for rendering
    await new Promise(r => setTimeout(r, 500));

    if (format === 'png') {
      const buffer = await page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: PAGE.WIDTH_PX,
          height: PAGE.HEIGHT_PX,
        },
        omitBackground: false,
      });
      return { buffer, mimeType: 'image/png', extension: 'png' };
    }

    // PDF export
    // Puppeteer PDF uses inches; we set exact page dimensions
    const pdfBuffer = await page.pdf({
      width: `${PAGE.WIDTH_IN}in`,
      height: `${PAGE.HEIGHT_IN}in`,
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
