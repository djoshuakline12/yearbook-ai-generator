const fs = require('fs');
const { PAGE } = require('../utils/constants');

/**
 * Convert layout JSON + processed photos into an HTML string
 * suitable for Puppeteer rendering.
 *
 * @param {object} layout - Layout JSON with elements array
 * @param {array} photos - Photo objects (with processedPath or base64)
 * @param {object} options - Optional overrides
 * @param {number} options.dpi - DPI override (default: PAGE.DPI)
 */
function renderLayoutToHtml(layout, photos, { dpi: dpiOverride } = {}) {
  const isSpread = layout.pageType === 'spread';
  const dpi = dpiOverride || PAGE.DPI;
  const widthPx = Math.round((isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN) * dpi);
  const heightPx = Math.round(PAGE.HEIGHT_IN * dpi);

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
  const fontFamilies = [...fonts].map(f =>
    `family=${f.replace(/ /g, '+')}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700`
  ).join('&');
  const fontLink = fonts.size > 0
    ? `<link href="https://fonts.googleapis.com/css2?${fontFamilies}&display=swap" rel="stylesheet">`
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
  .multi-column {
    column-gap: ${inToPx(0.2, dpi)}px;
  }
  .roster-list {
    column-gap: ${inToPx(0.15, dpi)}px;
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
    case 'sectionHeader': return renderSectionHeader(el, dpi);
    case 'schoolName': return renderSchoolName(el, dpi);
    case 'headline': return renderHeadline(el, dpi);
    case 'subheadline': return renderSubheadline(el, dpi);
    case 'date': return renderDate(el, dpi);
    case 'record': return renderRecord(el, dpi);
    case 'highlights': return renderHighlights(el, dpi);
    case 'roster': return renderRoster(el, dpi);
    case 'bodyCopy': return renderBodyCopy(el, dpi);
    case 'quote': return renderQuote(el, dpi);
    case 'caption': return renderCaption(el, dpi);
    case 'captionNumber': return renderCaptionNumber(el, dpi);
    case 'decorative': return renderDecorative(el, dpi);
    case 'folio': return renderFolio(el, dpi);
    case 'pageNumber': return renderFolio(el, dpi); // alias
    default: return '';
  }
}

function inToPx(inches, dpi) {
  return Math.round(inches * dpi);
}

function ptToPx(pts, dpi) {
  return Math.round(pts * (dpi / 72));
}

function getShadowCss(el, dpi) {
  if (!el.shadow) return '';
  const intensity = el.shadowIntensity || 'subtle';
  const shadows = {
    subtle: `box-shadow: ${inToPx(0.01, dpi)}px ${inToPx(0.015, dpi)}px ${inToPx(0.04, dpi)}px rgba(0,0,0,0.15);`,
    medium: `box-shadow: ${inToPx(0.02, dpi)}px ${inToPx(0.03, dpi)}px ${inToPx(0.06, dpi)}px rgba(0,0,0,0.25);`,
    dramatic: `box-shadow: ${inToPx(0.03, dpi)}px ${inToPx(0.05, dpi)}px ${inToPx(0.12, dpi)}px rgba(0,0,0,0.35);`,
  };
  return shadows[intensity] || shadows.subtle;
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
  const borderWidth = el.borderWidth ? inToPx(el.borderWidth, dpi) : 0;
  const borderColor = el.borderColor || '#ffffff';
  const opacity = el.opacity != null ? el.opacity : 1;
  const zIndex = el.zIndex || 1;
  const shadow = getShadowCss(el, dpi);
  const border = borderWidth > 0 ? `border: ${borderWidth}px solid ${borderColor};` : '';

  // Black and white filter for dramatic effect (DCHS style)
  const bwFilter = el.blackAndWhite ? 'filter: grayscale(100%) contrast(1.1);' : '';

  // Smart crop - use focal point for object-position if available
  // This keeps the subject (face/person) in frame when cropping
  // Default to center 30% which balances keeping faces visible without extreme cropping
  let objectPosition = 'center 30%';
  if (photo.focalPoint) {
    const focalX = Math.round(photo.focalPoint.focalX * 100);
    const focalY = Math.round(photo.focalPoint.focalY * 100);
    objectPosition = `${focalX}% ${focalY}%`;
  } else if (photo.objectPosition) {
    objectPosition = photo.objectPosition;
  }

  // Support both file-based photos (processedPath) and session-stored photos (base64)
  let base64;
  if (photo.base64) {
    base64 = photo.base64;
  } else {
    const imgData = fs.readFileSync(photo.processedPath);
    base64 = imgData.toString('base64');
  }

  // Caption styling - appears BELOW the photo (not overlaid) for readability
  // Allow up to 2 lines for captions
  const captionFontSize = ptToPx(6.5, dpi);
  const captionLineHeight = 1.3;
  const captionHeight = el.caption ? inToPx(0.45, dpi) : 0;  // Space for ~2 lines of caption
  const photoHeight = h - captionHeight;  // Reduce photo height to make room

  const captionHtml = el.caption ? `
    <div style="
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: ${captionHeight}px;
      padding-top: ${inToPx(0.05, dpi)}px;
      color: #333333;
      font-family: 'Source Sans Pro', sans-serif;
      font-size: ${captionFontSize}px;
      font-style: italic;
      line-height: ${captionLineHeight};
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    ">${escapeHtml(el.caption)}</div>
  ` : '';

  return `<div class="element photo-container" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px; height: ${h}px;
    transform: rotate(${rotation}deg);
    opacity: ${opacity};
    z-index: ${zIndex};
    ${shadow}
  ">
    <div style="
      width: 100%;
      height: ${photoHeight}px;
      border-radius: ${borderRadius}px;
      overflow: hidden;
      ${border}
    ">
      <img src="data:image/jpeg;base64,${base64}"
           style="width: 100%; height: 100%; object-fit: ${el.cropFit || 'cover'}; object-position: ${objectPosition}; ${bwFilter}"
           alt="Photo ${el.photoIndex}">
    </div>
    ${captionHtml}
  </div>`;
}

function renderSectionHeader(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 28, dpi);
  const letterSpacing = el.letterSpacing ? `${el.letterSpacing * (dpi / 96)}px` : '0';
  const fontStyle = el.fontStyle || 'normal';  // Don't force italic

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Playfair Display'}', serif;
    font-size: ${fontSize}px;
    font-weight: ${el.fontWeight || '700'};
    font-style: ${fontStyle};
    color: ${el.color || '#1A1A1A'};
    text-transform: ${el.textTransform || 'none'};
    letter-spacing: ${letterSpacing};
    z-index: ${el.zIndex || 10};
  ">${escapeHtml(el.text)}</div>`;
}

function renderSchoolName(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 60, dpi);
  const letterSpacing = el.letterSpacing ? `${el.letterSpacing * (dpi / 96)}px` : '0';

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Oswald'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: ${el.fontWeight || '700'};
    color: ${el.color || '#1a1a1a'};
    letter-spacing: ${letterSpacing};
    line-height: 0.9;
    z-index: ${el.zIndex || 10};
  ">${escapeHtml(el.text)}</div>`;
}

function renderHeadline(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 18, dpi);
  const bgColor = el.backgroundColor
    ? `background-color: ${el.backgroundColor}; padding: ${inToPx(0.05, dpi)}px ${inToPx(0.1, dpi)}px; display: inline-block;`
    : '';

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Oswald'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: ${el.fontWeight || '700'};
    color: ${el.color || '#1a1a1a'};
    text-align: ${el.textAlign || 'left'};
    z-index: ${el.zIndex || 10};
    ${bgColor}
  ">${escapeHtml(el.text)}</div>`;
}

function renderSubheadline(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 14, dpi);

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: ${el.fontWeight || '400'};
    font-style: ${el.fontStyle || 'italic'};
    color: ${el.color || '#555555'};
    text-align: ${el.textAlign || 'left'};
    line-height: 1.3;
    z-index: ${el.zIndex || 10};
  ">${escapeHtml(el.text)}</div>`;
}

function renderDate(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 12, dpi);
  const bgColor = el.backgroundColor
    ? `background-color: ${el.backgroundColor}; padding: ${inToPx(0.03, dpi)}px ${inToPx(0.08, dpi)}px; display: inline-block;`
    : '';

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: ${el.fontWeight || '600'};
    color: ${el.color || '#666666'};
    text-transform: ${el.textTransform || 'uppercase'};
    letter-spacing: 1px;
    z-index: ${el.zIndex || 10};
    ${bgColor}
  ">${escapeHtml(el.text)}</div>`;
}

function renderRecord(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 16, dpi);
  const bgColor = el.backgroundColor
    ? `background-color: ${el.backgroundColor}; padding: ${inToPx(0.03, dpi)}px ${inToPx(0.08, dpi)}px; display: inline-block;`
    : '';

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Oswald'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: ${el.fontWeight || '700'};
    color: ${el.color || '#ffffff'};
    z-index: ${el.zIndex || 10};
    ${bgColor}
  ">${escapeHtml(el.text)}</div>`;
}

function renderHighlights(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const titleFontSize = ptToPx(el.titleFontSize || 11, dpi);
  const itemFontSize = ptToPx(el.itemFontSize || 9, dpi);

  const itemsHtml = (el.items || []).map(item =>
    `<li style="margin-bottom: ${inToPx(0.03, dpi)}px;">${escapeHtml(item)}</li>`
  ).join('');

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    z-index: ${el.zIndex || 10};
  ">
    ${el.title ? `<div style="
      font-family: '${el.fontFamily || 'Oswald'}', sans-serif;
      font-size: ${titleFontSize}px;
      font-weight: 700;
      color: ${el.titleColor || '#1a1a1a'};
      margin-bottom: ${inToPx(0.06, dpi)}px;
      text-transform: uppercase;
    ">${escapeHtml(el.title)}</div>` : ''}
    <ul style="
      font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
      font-size: ${itemFontSize}px;
      font-weight: 400;
      color: ${el.itemColor || '#333333'};
      line-height: 1.4;
      list-style: ${el.bulletStyle || 'disc'};
      padding-left: ${inToPx(0.15, dpi)}px;
      margin: 0;
    ">${itemsHtml}</ul>
  </div>`;
}

function renderRoster(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const titleFontSize = ptToPx(el.titleFontSize || 11, dpi);
  const nameFontSize = ptToPx(el.nameFontSize || 8, dpi);
  const columns = el.columns || 1;
  const nameFontWeight = el.fontWeight || '400';

  const namesHtml = (el.names || []).map(name =>
    `<span style="display: inline;">${escapeHtml(name)}</span>`
  ).join(', ');

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    z-index: ${el.zIndex || 10};
  ">
    <div style="
      font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
      font-size: ${titleFontSize}px;
      font-weight: 700;
      color: ${el.titleColor || '#1a1a1a'};
      margin-bottom: ${inToPx(0.05, dpi)}px;
    ">${escapeHtml(el.title || 'Roster:')}</div>
    <div style="
      font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
      font-size: ${nameFontSize}px;
      font-weight: ${nameFontWeight};
      color: ${el.nameColor || '#333333'};
      line-height: 1.3;
      column-count: ${columns};
      column-gap: ${inToPx(0.15, dpi)}px;
    ">${namesHtml}</div>
  </div>`;
}

function renderBodyCopy(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const h = el.height ? inToPx(el.height, dpi) : 'auto';
  const fontSize = ptToPx(el.fontSize || 10, dpi);
  const lineHeight = el.lineHeight || 1.4;
  const columns = el.columns || 1;

  // Convert newlines to paragraphs
  const paragraphs = (el.text || '').split('\n').filter(p => p.trim());
  const textHtml = paragraphs.map(p =>
    `<p style="margin-bottom: ${inToPx(0.08, dpi)}px;">${escapeHtml(p)}</p>`
  ).join('');

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    ${typeof h === 'number' ? `height: ${h}px;` : ''}
    font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: ${el.fontWeight || '400'};
    color: ${el.color || '#1a1a1a'};
    line-height: ${lineHeight};
    column-count: ${columns};
    column-gap: ${inToPx(0.2, dpi)}px;
    text-align: justify;
    z-index: ${el.zIndex || 10};
  ">${textHtml}</div>`;
}

function renderQuote(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 16, dpi);

  // DCHS Style: Purple background with white text
  const hasBgColor = el.backgroundColor;
  const bgStyle = hasBgColor
    ? `background-color: ${el.backgroundColor}; padding: ${inToPx(0.12, dpi)}px ${inToPx(0.15, dpi)}px;`
    : '';
  const textColor = hasBgColor ? (el.color || '#FFFFFF') : (el.color || '#1a1a1a');
  const quoteMarkColor = hasBgColor ? '#FFFFFF' : (el.accentColor || '#523D73');

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    z-index: ${el.zIndex || 10};
    ${bgStyle}
  ">
    <div style="
      font-family: '${el.fontFamily || 'Playfair Display'}', serif;
      font-size: ${fontSize}px;
      font-style: ${el.fontStyle || 'italic'};
      font-weight: ${el.fontWeight || '700'};
      color: ${textColor};
      line-height: 1.3;
    ">
      <span style="color: ${quoteMarkColor}; font-size: ${Math.round(fontSize * 1.5)}px;">"</span>${escapeHtml(el.text)}<span style="color: ${quoteMarkColor}; font-size: ${Math.round(fontSize * 1.5)}px;">"</span>
    </div>
    ${el.attribution ? `<div style="
      font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
      font-size: ${Math.round(fontSize * 0.75)}px;
      font-style: normal;
      font-weight: 700;
      color: ${textColor};
      margin-top: ${inToPx(0.08, dpi)}px;
    ">— ${escapeHtml(el.attribution)}</div>` : ''}
  </div>`;
}

function renderCaption(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const fontSize = ptToPx(el.fontSize || 8, dpi);

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px;
    font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
    font-size: ${fontSize}px;
    font-style: ${el.fontStyle || 'italic'};
    font-weight: ${el.fontWeight || '400'};
    color: ${el.color || '#333333'};
    line-height: 1.3;
    z-index: ${el.zIndex || 10};
  ">${escapeHtml(el.text)}</div>`;
}

function renderCaptionNumber(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const fontSize = ptToPx(el.fontSize || 9, dpi);
  const size = Math.round(fontSize * 1.5);

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${size}px; height: ${size}px;
    font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: 700;
    color: ${el.color || '#ffffff'};
    background-color: ${el.backgroundColor || '#1a1a1a'};
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: ${el.zIndex || 15};
  ">${escapeHtml(el.number)}</div>`;
}

function renderDecorative(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const w = inToPx(el.width, dpi);
  const h = inToPx(el.height || 0.02, dpi);
  const rotation = el.rotation || 0;
  const opacity = el.opacity != null ? el.opacity : 1;
  const borderRadius = el.shape === 'circle' ? '50%' : '0';

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    width: ${w}px; height: ${h}px;
    background: ${el.color || '#8b5cf6'};
    opacity: ${opacity};
    transform: rotate(${rotation}deg);
    border-radius: ${borderRadius};
    z-index: ${el.zIndex || 5};
  "></div>`;
}

function renderFolio(el, dpi) {
  const x = inToPx(el.x, dpi);
  const y = inToPx(el.y, dpi);
  const fontSize = ptToPx(el.fontSize || 10, dpi);

  return `<div class="element" style="
    left: ${x}px; top: ${y}px;
    font-family: '${el.fontFamily || 'Source Sans Pro'}', sans-serif;
    font-size: ${fontSize}px;
    font-weight: 400;
    color: ${el.color || '#666666'};
    z-index: ${el.zIndex || 100};
  ">${escapeHtml(el.text)}</div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderLayoutToHtml };
