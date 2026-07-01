// TEMPLATE 5 — CROSS-GUTTER MOSAIC (Freshman Retreat style)
//
// Hand-authored layout. Every box, every dimension, every font size is
// placed by hand at the exact coordinates from the reference. Nothing
// here is algorithmically derived.
//
// Spread: 16" wide × 10.5" tall.
// Left page: x=0 to x=8. Right page: x=8 to x=16.
// Colors: DCHS purple #523D73.

const {
  inToPx, ptToPx, escapeHtml, photoDataUri,
  isPlaceholder, pickCaption, splitQuoteIntoLines,
} = require('./utils');

function renderCrossGutterMosaic(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const PURPLE = '#523D73';
  const DARK = '#1A1A1A';
  const MUTED = '#666666';
  const spreadWpx = inToPx(16, dpi);
  const spreadHpx = inToPx(10.5, dpi);

  // Content pulls
  const title = escapeHtml(pageContent.pageTitle || '');
  const bodyParagraphs = (pageContent.bodyCopy || '')
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');

  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  const attrQuote = quotes[0] || null;
  const overlayQuote = quotes[1] || quotes[0] || null;

  // Photo slots (fallback gracefully)
  const heroSrc = photoDataUri(photos[0]);
  const mosaicSrcs = [1, 2, 3, 4].map(i => photoDataUri(photos[i]));
  const miniSrcs = [5, 6].map(i => photoDataUri(photos[i]));
  const smallPreviewIdx = Math.min(photos.length - 1, 7);
  const smallSrc = photos.length > 1 ? photoDataUri(photos[smallPreviewIdx]) : '';

  const smallCap = pickCaption(pageContent.photoCaptions, smallPreviewIdx);
  const mosaicCaps = [1, 2, 3, 4].map(i => pickCaption(pageContent.photoCaptions, i));
  const miniCaps = [5, 6].map(i => pickCaption(pageContent.photoCaptions, i));

  // Featured moments block content
  const featuredHeadline = escapeHtml(pageContent.headline || pageContent.section || 'THE MOMENTS');
  const featuredTagline = escapeHtml(pageContent.subheadline || pageContent.record || '');

  // Split overlay quote into fitted lines (bar is 3.8" wide, minus padding)
  const quoteFontPt = 12;
  const quoteLines = overlayQuote
    ? splitQuoteIntoLines(overlayQuote.text, 3.5, quoteFontPt)
    : [];

  // === POSITIONING (all in inches, converted to px for CSS) ===
  const px = (n) => `${inToPx(n, dpi)}px`;
  const pt = (n) => `${ptToPx(n, dpi)}px`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;0,700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${spreadWpx}px;
    height: ${spreadHpx}px;
    background: white;
    font-family: 'Source Sans Pro', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: hidden;
  }
  .spread { position: relative; width: ${spreadWpx}px; height: ${spreadHpx}px; }

  /* T1 — Outlined title box */
  .title-box {
    position: absolute;
    left: ${px(0.5)}; top: ${px(0.4)};
    width: ${px(2.5)}; height: ${px(1.35)};
    border: ${px(0.03)} solid ${PURPLE};
    padding: ${px(0.15)} ${px(0.2)};
    display: flex; align-items: center;
  }
  .title-box .title-text {
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-size: ${pt(26)};
    line-height: 1.05;
    color: ${DARK};
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }

  /* T2 — Body copy, single column */
  .body-copy {
    position: absolute;
    left: ${px(0.5)}; top: ${px(2.0)};
    width: ${px(2.5)}; height: ${px(4.5)};
    font-family: 'Source Sans Pro', sans-serif;
    font-size: ${pt(10)};
    line-height: 1.42;
    color: ${DARK};
    text-align: left;
    overflow: hidden;
  }
  .body-copy p { margin-bottom: ${px(0.09)}; }

  /* T3 — Italic attribution quote */
  .attr-quote {
    position: absolute;
    left: ${px(0.5)}; top: ${px(6.75)};
    width: ${px(2.5)}; height: ${px(1.0)};
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: ${pt(9.5)};
    line-height: 1.35;
    color: ${DARK};
  }
  .attr-quote .attr-name {
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: ${pt(8.5)};
    color: ${MUTED};
    margin-top: ${px(0.06)};
  }

  /* P_small — small preview photo bottom-left */
  .small-photo {
    position: absolute;
    left: ${px(0.5)}; top: ${px(8.15)};
    width: ${px(2.5)}; height: ${px(1.6)};
    object-fit: cover;
    object-position: center center;
  }

  /* T4 — Caption for P_small */
  .small-caption {
    position: absolute;
    left: ${px(0.5)}; top: ${px(9.85)};
    width: ${px(2.5)}; height: ${px(0.55)};
    font-family: 'Source Sans Pro', sans-serif;
    font-size: ${pt(7.5)};
    line-height: 1.3;
    color: ${DARK};
    overflow: hidden;
  }
  .small-caption .cap-title {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${DARK};
  }

  /* P_hero — massive cross-gutter hero */
  .hero-photo {
    position: absolute;
    left: ${px(3.15)}; top: ${px(0.25)};
    width: ${px(6.6)}; height: ${px(10.0)};
    object-fit: cover;
    object-position: center 60%;
    filter: grayscale(1) contrast(1.05);
  }
  .hero-num {
    position: absolute;
    left: ${px(3.25)}; top: ${px(9.9)};
    color: white;
    font-family: 'Source Sans Pro', sans-serif;
    font-size: ${pt(10)};
    font-weight: 700;
    padding: ${px(0.03)} ${px(0.09)};
    background: rgba(0, 0, 0, 0.55);
    z-index: 2;
  }

  /* Q_overlay — 4-bar purple pull quote over lower hero */
  .quote-overlay {
    position: absolute;
    left: ${px(3.4)}; top: ${px(7.7)};
    width: ${px(3.8)};
    z-index: 3;
  }
  .quote-overlay .quote-line {
    display: block;
    background: ${PURPLE};
    color: white;
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 700;
    font-size: ${pt(quoteFontPt)};
    text-transform: uppercase;
    letter-spacing: 0.02em;
    padding: ${px(0.09)} ${px(0.16)};
    margin-bottom: ${px(0.05)};
    white-space: nowrap;
    overflow: hidden;
    opacity: 0.95;
  }
  .quote-overlay .quote-attr {
    color: white;
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: ${pt(10)};
    padding-left: ${px(0.16)};
    margin-top: ${px(0.08)};
  }

  /* 2x2 photo mosaic top-right */
  .mosaic {
    position: absolute;
    left: ${px(10.0)}; top: ${px(0.4)};
    width: ${px(5.5)}; height: ${px(5.0)};
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: ${px(0.12)};
  }
  .mosaic-cell { position: relative; overflow: hidden; }
  .mosaic-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .mosaic-cell .num-badge {
    position: absolute;
    right: ${px(0.08)}; bottom: ${px(0.08)};
    color: white;
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 700;
    font-size: ${pt(9)};
    padding: 0 ${px(0.06)};
    background: rgba(0, 0, 0, 0.55);
  }

  /* Featured moments title block (2 stacked purple bars) */
  .featured {
    position: absolute;
    left: ${px(13.2)}; top: ${px(5.9)};
    width: ${px(2.55)};
  }
  .featured .headline-bar {
    display: block;
    background: ${PURPLE};
    color: white;
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: ${pt(13)};
    padding: ${px(0.09)} ${px(0.14)};
    text-transform: uppercase;
    margin-bottom: ${px(0.05)};
    letter-spacing: 0.02em;
  }
  .featured .headline-bar .accent {
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-weight: 900;
  }
  .featured .tagline-bar {
    display: block;
    background: ${PURPLE};
    color: white;
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 700;
    font-size: ${pt(10)};
    padding: ${px(0.07)} ${px(0.14)};
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  /* Bottom-right vertical mini stack (2 small photos with left-side captions) */
  .mini-1, .mini-2 {
    position: absolute;
    width: ${px(2.55)};
    display: flex;
    gap: ${px(0.1)};
  }
  .mini-1 { left: ${px(13.2)}; top: ${px(7.5)}; height: ${px(1.4)}; }
  .mini-2 { left: ${px(13.2)}; top: ${px(9.05)}; height: ${px(1.2)}; }
  .mini-1 .cap, .mini-2 .cap {
    width: ${px(0.75)};
    font-family: 'Source Sans Pro', sans-serif;
    font-size: ${pt(7.5)};
    line-height: 1.3;
    color: ${DARK};
    overflow: hidden;
  }
  .mini-1 .cap .name, .mini-2 .cap .name { font-weight: 700; display: block; }
  .mini-1 img, .mini-2 img {
    flex: 1;
    object-fit: cover;
    display: block;
  }
</style>
</head>
<body>
<div class="spread">

  <!-- ============ LEFT PAGE ============ -->

  ${title ? `<div class="title-box"><div class="title-text">${title}</div></div>` : ''}

  <div class="body-copy">${bodyParagraphs}</div>

  ${attrQuote ? `
  <div class="attr-quote">
    <div>'${escapeHtml(attrQuote.text.replace(/^["']|["']$/g, ''))}'</div>
    ${attrQuote.attribution && !isPlaceholder(attrQuote.attribution) ? `<div class="attr-name">— ${escapeHtml(attrQuote.attribution)}</div>` : ''}
  </div>` : ''}

  ${smallSrc ? `<img class="small-photo" src="${smallSrc}" alt="">` : ''}
  ${smallCap && (smallCap.title || smallCap.body || smallCap.people) ? `
  <div class="small-caption">
    ${smallCap.title ? `<span class="cap-title">${escapeHtml(smallCap.title.toUpperCase())}</span> ` : ''}${escapeHtml([smallCap.people, smallCap.body].filter(Boolean).join(' '))}
  </div>` : ''}

  <!-- ============ CENTER HERO ============ -->

  ${heroSrc ? `<img class="hero-photo" src="${heroSrc}" alt="">` : ''}
  ${heroSrc ? `<div class="hero-num">1</div>` : ''}

  <!-- ============ QUOTE OVERLAY ON HERO ============ -->

  ${quoteLines.length > 0 ? `
  <div class="quote-overlay">
    ${quoteLines.map(l => `<span class="quote-line">${escapeHtml(l)}</span>`).join('\n')}
    ${overlayQuote.attribution && !isPlaceholder(overlayQuote.attribution) ? `<div class="quote-attr">${escapeHtml(overlayQuote.attribution)}</div>` : ''}
  </div>` : ''}

  <!-- ============ RIGHT PAGE — 2x2 MOSAIC ============ -->

  <div class="mosaic">
    ${[0, 1, 2, 3].map(i => {
      const src = mosaicSrcs[i];
      const badge = i + 2;
      return src
        ? `<div class="mosaic-cell"><img src="${src}" alt=""><span class="num-badge">${badge}</span></div>`
        : `<div class="mosaic-cell"></div>`;
    }).join('\n')}
  </div>

  <!-- ============ FEATURED MOMENTS TITLE ============ -->

  <div class="featured">
    <span class="headline-bar">${featuredHeadline}</span>
    ${featuredTagline ? `<span class="tagline-bar">${featuredTagline}</span>` : ''}
  </div>

  <!-- ============ RIGHT-COLUMN MINI STACK ============ -->

  <div class="mini-1">
    <div class="cap">
      ${miniCaps[0] && miniCaps[0].people ? `<span class="name">${escapeHtml(miniCaps[0].people)}</span>` : ''}
      ${miniCaps[0] && miniCaps[0].body ? escapeHtml(miniCaps[0].body) : ''}
    </div>
    ${miniSrcs[0] ? `<img src="${miniSrcs[0]}" alt="">` : ''}
  </div>
  <div class="mini-2">
    <div class="cap">
      ${miniCaps[1] && miniCaps[1].people ? `<span class="name">${escapeHtml(miniCaps[1].people)}</span>` : ''}
      ${miniCaps[1] && miniCaps[1].body ? escapeHtml(miniCaps[1].body) : ''}
    </div>
    ${miniSrcs[1] ? `<img src="${miniSrcs[1]}" alt="">` : ''}
  </div>

</div>
</body>
</html>`;
}

module.exports = { renderCrossGutterMosaic };
