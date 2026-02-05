const path = require('path');
const fs = require('fs');
const { PAGE } = require('../utils/constants');

/**
 * Convert layout JSON + processed photos into an HTML string
 * suitable for Puppeteer rendering at 300 DPI.
 */
function renderLayoutToHtml(layout, photos) {
  const widthPx = PAGE.WIDTH_PX;
  const heightPx = PAGE.HEIGHT_PX;
  const dpi = PAGE.DPI;

  const backgroundCss = buildBackgroundCss(layout.background);
  const elementHtmls = layout.elements
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map(el => renderElement(el, photos, dpi))
    .join('\n');

  // Collect unique Google Fonts
  const fonts = new Set();
  for (const el of layout.elements) {
    if (el.fontFamily) fonts.add(el.fontFamily);
  }
  const fontLink = fonts.size > 0
    ? `<link href="https://fonts.googleapis.com/css2?${[...fonts].map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;700;900`).join('&')}&display=swap" rel="stylesheet">`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${fontLink}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${widthPx}px;
    height: ${heightPx}px;
    overflow: hidden;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    width: ${widthPx}px;
    height: ${heightPx}px;
    ${backgroundCss}
    overflow: hidden;
  }
  .element {
    position: absolute;
  }
  .photo-container img {
    display: block;
  }
</style>
</head>
<body>
<div class="page">
${elementHtmls}
</div>
</body>
</html>`;
}

function buildBackgroundCss(bg) {
  if (!bg) return 'background: #ffffff;';

  if (bg.type === 'gradient' && bg.gradientStops) {
    const angle = bg.gradientAngle || 135;
    const stops = bg.gradientStops.join(', ');
    return `background: linear-gradient(${angle}deg, ${stops});`;
  }

  return `background: ${bg.color || '#ffffff'};`;
}

function renderElement(el, photos, dpi) {
  switch (el.type) {
    case 'photo': return renderPhoto(el, photos, dpi);
    case 'headline': return renderHeadline(el, dpi);
    case 'caption': return renderCaption(el, dpi);
    case 'decorative': return renderDecorative(el, dpi);
    case 'pageNumber': return renderPageNumber(el, dpi);
    default: return '';
  }
}

function inToPx(inches, dpi) {
  return Math.round(inches * dpi);
}

function ptToPx(pts, dpi) {
  // At 300 DPI, 1 CSS px = 1/96 inch, 1 pt = 1/72 inch
  // We need to scale pts for our 300 DPI canvas
  // 1 pt = 1/72 inch = 300/72 px at 300 DPI ≈ 4.167px
  return Math.round(pts * (dpi / 72));
}

function renderPhoto(el, photos, dpi) {
  const photo = photos[el.photoIndex];
  if (!photo) return '';

  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const h = inToPx(el.height, dpi);
  const rotation = el.rotation || 0;
  const borderRadius = el.borderRadius ? inToPx(el.borderRadius, dpi) : 0;
  const opacity = el.opacity != null ? el.opacity : 1;
  const zIndex = el.zIndex || 1;
  const shadow = el.shadow ? `box-shadow: ${inToPx(0.02, dpi)}px ${inToPx(0.03, dpi)}px ${inToPx(0.08, dpi)}px rgba(0,0,0,0.3);` : '';

  // Read the image as base64 for embedding
  const imgData = fs.readFileSync(photo.processedPath);
  const base64 = imgData.toString('base64');
  const mimeType = 'image/jpeg';

  return `<div class="element photo-container" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px; height: ${h}px;
    transform: rotate(${rotation}deg);
    border-radius: ${borderRadius}px;
    opacity: ${opacity};
    z-index: ${zIndex};
    overflow: hidden;
    ${shadow}
  ">
    <img src="data:${mimeType};base64,${base64}"
         style="width: 100%; height: 100%; object-fit: ${el.cropFit || 'cover'};"
         alt="Photo ${el.photoIndex}">
  </div>`;
}

function renderHeadline(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 48, dpi);
  const letterSpacing = el.letterSpacing ? `${el.letterSpacing * (dpi / 96)}px` : '0';
  const zIndex = el.zIndex || 10;

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Oswald'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: ${el.fontWeight || 'bold'};
    color: ${el.color || '#000000'};
    text-align: ${el.textAlign || 'left'};
    letter-spacing: ${letterSpacing};
    text-transform: ${el.textTransform || 'none'};
    line-height: 1.1;
    z-index: ${zIndex};
  ">${escapeHtml(el.text)}</div>`;
}

function renderCaption(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 11, dpi);
  const lineHeight = el.lineHeight || 1.4;
  const zIndex = el.zIndex || 10;

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Open Sans'}', sans-serif;
    font-size: ${fontSize}px;
    color: ${el.color || '#333333'};
    line-height: ${lineHeight};
    z-index: ${zIndex};
  ">${escapeHtml(el.text)}</div>`;
}

function renderDecorative(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const h = inToPx(el.height || 0.02, dpi);
  const rotation = el.rotation || 0;
  const opacity = el.opacity != null ? el.opacity : 1;
  const zIndex = el.zIndex || 5;
  const borderRadius = el.shape === 'circle' ? '50%' : '0';

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px; height: ${h}px;
    background: ${el.color || '#e94560'};
    opacity: ${opacity};
    transform: rotate(${rotation}deg);
    border-radius: ${borderRadius};
    z-index: ${zIndex};
  "></div>`;
}

function renderPageNumber(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const fontSize = ptToPx(el.fontSize || 9, dpi);

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    font-family: '${el.fontFamily || 'Open Sans'}', sans-serif;
    font-size: ${fontSize}px;
    color: ${el.color || '#999999'};
    z-index: 100;
  ">${escapeHtml(el.text)}</div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderLayoutToHtml };
