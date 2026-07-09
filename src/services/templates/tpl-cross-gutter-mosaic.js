// TEMPLATE 5 — CROSS-GUTTER MOSAIC (Freshman Retreat style)
//
// Hand-authored layout. Every box, every dimension, every font size is
// placed by hand at the exact coordinates from the reference. Nothing
// here is algorithmically derived.
//
// Spread: 16" wide × 10.5" tall.
// Left page: x=0 to x=8. Right page: x=8 to x=16.
// Colors: DCHS purple #563D82.

const {
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri,
  isPlaceholder, pickCaption, splitQuoteIntoLines, wrapToLines, dedupCaption,
  estimateTextHeightIn, wrapLineCount,
} = require('./utils');

function renderCrossGutterMosaic(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const variant = options.variant || 0;
  const anchorColor = !!(variant & 1);   // bit0: anchor photo color vs B&W
  const flipQuote = !!(variant & 2);     // bit1: quote-block position flip
  const bwFilter = anchorColor ? '' : 'filter: grayscale(1) contrast(1.05);';
  const PURPLE = BRAND.purple;
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

  // Photo slots — fixed assignment matching the reference, no photo reuse:
  // hero=0, mosaic=1-4, small preview=5, minis=6-7. Slots without a photo
  // simply don't render.
  const heroSrc = photoDataUri(photos[0]);
  const mosaicSrcs = [1, 2, 3, 4].map(i => photoDataUri(photos[i]));
  const smallPreviewIdx = 5;
  const smallSrc = photoDataUri(photos[smallPreviewIdx]);
  const miniSrcs = [6, 7].map(i => photoDataUri(photos[i]));

  const smallCap = dedupCaption(pickCaption(pageContent.photoCaptions, smallPreviewIdx));
  const miniCaps = [6, 7].map(i => dedupCaption(pickCaption(pageContent.photoCaptions, i)));

  // Grouped numbered captions for the 2x2 mosaic (photos 2-5).
  const mosaicCapEntries = [1, 2, 3, 4].map((photoIdx, i) => {
    const c = dedupCaption(pickCaption(pageContent.photoCaptions, photoIdx));
    if (!c || (!c.lead && !c.body)) return null;
    const text = [c.lead, c.body].filter(Boolean).join(' ');
    return `<span class="mcap"><b>${i + 2}</b>&nbsp;&nbsp;${escapeHtml(text)}</span>`;
  }).filter(Boolean).join('\n');

  // Featured moments block: black serif headline (2nd word italic, matching
  // the reference's "THE *BEST* MOMENTS") + tagline split across purple bars.
  let featuredHeadlineRaw = (pageContent.headline || pageContent.section || 'The Best Moments').toUpperCase();
  if (featuredHeadlineRaw.trim() === (pageContent.pageTitle || '').toUpperCase().trim()) featuredHeadlineRaw = 'THE BEST MOMENTS';
  const headlineWords = featuredHeadlineRaw.split(/\s+/);
  const featuredHeadlineHtml = headlineWords
    .map((w, i) => (i === 1 && headlineWords.length >= 3)
      ? `<span class="accent">${escapeHtml(w)}</span>`
      : escapeHtml(w))
    .join(' ');
  // Tagline: pick the first candidate that fits in TWO purple bars (matching
  // the reference). A long highlight that would wrap into 4-5 bars overflows
  // onto the photos below — better to show no bars than a wall of them.
  const tagCandidates = [
    pageContent.subheadline,
    pageContent.record,
    ...(pageContent.highlights || []),
  ].filter(t => t && !t.includes('['));
  let taglineLines = [];
  for (const t of tagCandidates) {
    const lines = wrapToLines(t, 2.3, 10);
    if (lines.length >= 1 && lines.length <= 2) { taglineLines = lines; break; }
  }

  // Vertical layout of the right rail, computed so blocks can never overlap:
  // mosaic ends at 5.4; grouped captions (if any) 5.5-6.25; featured block
  // below that; mini stack below the featured block.
  const featuredTopMin = mosaicCapEntries ? 6.4 : 5.85;
  const headlineCharsPerLine = 19; // ~15pt Playfair in a 2.55in column
  const headlineLineCount = wrapLineCount(featuredHeadlineRaw, headlineCharsPerLine) || 1;
  const featuredHeight = headlineLineCount * 0.24 + 0.1 + taglineLines.length * 0.29;
  // Mini stack bottom-anchors at 10.4; the featured block sits directly
  // above it so the rail has no floating gaps.
  const mini2H = 1.2;
  const mini1H = 1.4;
  const mini2Top = 10.4 - mini2H;
  const mini1Top = mini2Top - 0.18 - mini1H;
  const showMini2 = !!miniSrcs[1];
  const railAnchor = miniSrcs[0] ? mini1Top : (showMini2 ? mini2Top : 10.4);
  const featuredTop = Math.max(featuredTopMin, railAnchor - featuredHeight - 0.25);

  // Split overlay quote into fitted lines (bar is 3.8" wide, minus padding)
  const quoteFontPt = 12;
  const quoteLines = overlayQuote
    ? splitQuoteIntoLines(overlayQuote.text, 3.5, quoteFontPt)
    : [];

  // Left column flows: body (measured) → attribution quote → small photo
  // that stretches down to its caption anchor at 9.85.
  const bodyEstH = estimateTextHeightIn(pageContent.bodyCopy, 2.5, 10, { columns: 1, lineHeight: 1.42 });
  const bodyH = Math.min(4.6, Math.max(1.2, bodyEstH + 0.1));
  const attrY = 2.0 + bodyH + 0.3;
  const attrEstH = attrQuote ? Math.min(1.3, estimateTextHeightIn(attrQuote.text, 2.5, 9.5, { columns: 1, lineHeight: 1.35 }) + 0.35) : 0;
  const smallY = Math.min(8.15, attrY + attrEstH + 0.3);
  const smallH = 9.79 - smallY;

  // === POSITIONING (all in inches, converted to px for CSS) ===
  const px = (n) => `${inToPx(n, dpi)}px`;
  const pt = (n) => `${ptToPx(n, dpi)}px`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${BRAND.fontLink}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${spreadWpx}px;
    height: ${spreadHpx}px;
    background: white;
    font-family: ${BRAND.body};
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
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
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
    width: ${px(2.5)}; height: ${px(bodyH)};
    font-family: ${BRAND.body};
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
    left: ${px(0.5)}; top: ${px(attrY)};
    width: ${px(2.5)}; height: ${px(1.0)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(9.5)};
    line-height: 1.35;
    color: ${DARK};
  }
  .attr-quote .attr-name {
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(8.5)};
    color: ${MUTED};
    margin-top: ${px(0.06)};
  }

  /* P_small — small preview photo bottom-left */
  .small-photo {
    position: absolute;
    left: ${px(0.5)}; top: ${px(smallY)};
    width: ${px(2.5)}; height: ${px(smallH)};
    object-fit: cover;
    object-position: center center;
  }

  /* T4 — Caption for P_small */
  .small-caption {
    position: absolute;
    left: ${px(0.5)}; top: ${px(9.85)};
    width: ${px(2.5)}; height: ${px(0.55)};
    font-family: ${BRAND.body};
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
    ${bwFilter}
  }
  .hero-num {
    position: absolute;
    left: ${px(3.25)}; top: ${px(9.9)};
    color: white;
    font-family: ${BRAND.body};
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
    font-family: ${BRAND.body};
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
    display: inline-block;
    color: white;
    background: rgba(26, 26, 26, 0.75);
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(10)};
    padding: ${px(0.03)} ${px(0.1)};
    margin-top: ${px(0.04)};
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
    left: ${px(0.08)}; bottom: ${px(0.08)};
    color: white;
    font-family: ${BRAND.body};
    font-weight: 700;
    font-size: ${pt(9)};
    padding: 0 ${px(0.06)};
    background: rgba(0, 0, 0, 0.55);
  }

  /* Grouped numbered captions for the mosaic */
  .mosaic-captions {
    position: absolute;
    left: ${px(10.0)}; top: ${px(5.52)};
    width: ${px(5.5)}; height: ${px(0.75)};
    font-family: ${BRAND.body};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    column-count: 2;
    column-gap: ${px(0.18)};
    overflow: hidden;
  }
  .mosaic-captions .mcap {
    display: block;
    margin-bottom: ${px(0.05)};
    break-inside: avoid;
  }
  .mosaic-captions .mcap b { font-weight: 700; }

  /* Featured moments title block: black serif headline + purple tagline bars */
  .featured {
    position: absolute;
    left: ${px(13.2)}; top: ${px(featuredTop)};
    width: ${px(2.55)};
  }
  .featured .headline-black {
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(15)};
    color: ${DARK};
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1.1;
    margin-bottom: ${px(0.07)};
  }
  .featured .headline-black .accent {
    font-style: italic;
    font-weight: 700;
  }
  .featured .tagline-bar {
    display: inline-block;
    background: ${PURPLE};
    color: white;
    font-family: ${BRAND.body};
    font-weight: 700;
    font-size: ${pt(10)};
    padding: ${px(0.05)} ${px(0.1)};
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: ${px(0.04)};
    white-space: nowrap;
  }

  /* Bottom-right vertical mini stack (photo left, caption right — matching
     the reference's alternating photo/caption arrangement) */
  .mini-1, .mini-2 {
    position: absolute;
    width: ${px(2.55)};
    display: flex;
    gap: ${px(0.12)};
  }
  .mini-1 { left: ${px(13.2)}; top: ${px(mini1Top)}; height: ${px(mini1H)}; }
  .mini-2 { left: ${px(13.2)}; top: ${px(mini2Top)}; height: ${px(mini2H)}; }
  .mini-1 img, .mini-2 img {
    width: ${px(1.5)};
    height: 100%;
    object-fit: cover;
    display: block;
    flex: none;
  }
  .mini-1 .cap, .mini-2 .cap {
    flex: 1;
    font-family: ${BRAND.body};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
    overflow-wrap: break-word;
  }
  .mini-1 .cap .name, .mini-2 .cap .name { font-weight: 700; }
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
  ${smallCap && (smallCap.lead || smallCap.body) ? `
  <div class="small-caption">
    ${smallCap.lead ? `<span class="cap-title">${escapeHtml(smallCap.lead.toUpperCase())}</span> ` : ''}${escapeHtml(smallCap.body)}
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

  <!-- ============ MOSAIC GROUPED CAPTIONS ============ -->

  ${mosaicCapEntries ? `<div class="mosaic-captions">\n${mosaicCapEntries}\n</div>` : ''}

  <!-- ============ FEATURED MOMENTS TITLE ============ -->

  <div class="featured">
    <div class="headline-black">${featuredHeadlineHtml}</div>
    ${taglineLines.map(l => `<span class="tagline-bar">${escapeHtml(l)}</span>`).join('\n')}
  </div>

  <!-- ============ RIGHT-COLUMN MINI STACK ============ -->

  <div class="mini-1">
    ${miniSrcs[0] ? `<img src="${miniSrcs[0]}" alt="">` : ''}
    <div class="cap">
      ${miniCaps[0] && miniCaps[0].lead ? `<span class="name">${escapeHtml(miniCaps[0].lead)}</span> ` : ''}${miniCaps[0] && miniCaps[0].body ? escapeHtml(miniCaps[0].body) : ''}
    </div>
  </div>
  ${showMini2 ? `<div class="mini-2">
    ${miniSrcs[1] ? `<img src="${miniSrcs[1]}" alt="">` : ''}
    <div class="cap">
      ${miniCaps[1] && miniCaps[1].lead ? `<span class="name">${escapeHtml(miniCaps[1].lead)}</span> ` : ''}${miniCaps[1] && miniCaps[1].body ? escapeHtml(miniCaps[1].body) : ''}
    </div>
  </div>` : ''}

</div>
</body>
</html>`;
}

module.exports = { renderCrossGutterMosaic };
