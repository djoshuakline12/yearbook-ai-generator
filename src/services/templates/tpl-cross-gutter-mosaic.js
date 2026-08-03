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
  inToPx, ptToPx, escapeHtml, photoDataUri, photoObjectPosition,
  isPlaceholder, pickCaption, splitQuoteIntoLines, wrapToLines, dedupCaption,
  cleanAttribution, pickOverlayQuote, repairAspects, estimateTextHeightIn, wrapLineCount,
  mirrorLeft,
} = require('./utils');

function renderCrossGutterMosaic(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const variant = options.variant || 0;
  const anchorColor = !!(variant & 1);   // bit0: anchor photo color vs B&W
  const flipQuote = !!(variant & 2);     // bit1: quote-block position flip
  const mirror = !!(variant & 4);        // bit2: whole layout flipped left↔right
  const ML = mirrorLeft(mirror);
  const bwFilter = anchorColor ? '' : 'filter: grayscale(1) contrast(1.05);';
  const PURPLE = BRAND.purple;
  const DARK = '#1A1A1A';
  const MUTED = '#666666';
  const spreadWpx = inToPx(16, dpi);
  const spreadHpx = inToPx(10.5, dpi);

  // Content pulls
  const title = escapeHtml(pageContent.pageTitle || '');
  // Title auto-shrink: the outlined box is 2.5" wide (2.1" usable). A fixed
  // 26pt clips long words ("BROADCASTING", "FOUNDATION") at the border.
  const titleRaw = (pageContent.pageTitle || '').trim();
  const longestTitleWord = titleRaw.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
  // 1.9" effective width: 900-weight Bodoni caps run wider than the average
  // char estimate, so leave margin against the box border.
  const titleFontPt = Math.max(15, Math.min(26, Math.floor(120 / (longestTitleWord / 1.9 + 0.4))));
  const titleCharsPerLine = Math.max(4, Math.floor(1.9 * (120 / titleFontPt - 0.4)));
  const titleLineCount = wrapLineCount(titleRaw, titleCharsPerLine) || 1;
  const titleBoxH = Math.max(1.35, titleLineCount * (titleFontPt * 1.1) / 72 + 0.36);
  const bodyParagraphs = (pageContent.bodyCopy || '')
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');

  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  const attrQuote = quotes[0] || null;
  // Overlay bars sit on the hero — favor the quote needing the fewest bars
  // (max 5); longer quotes render in full in the left text column instead.
  const overlayCandidates = quotes.slice(1).concat(quotes[0] ? [quotes[0]] : []);

  // Photo slots — fixed assignment matching the reference, no photo reuse:
  // hero=0, mosaic=1-4, small preview=5, minis=6-7. Slots without a photo
  // simply don't render.
  // Shape-matched slots: the tall cross-gutter hero takes the most
  // portrait photo; the mosaic and minis lean landscape.
  const NP = Array.isArray(photos) ? photos.length : 0;
  const m5 = { hero: 0, m0: 1, m1: 2, m2: 3, m3: 4, small: 5, mini0: 6, mini1: 7 };
  Object.keys(m5).forEach(k => { if (m5[k] >= NP) m5[k] = -1; });
  repairAspects(photos, m5, {
    hero: 0.66, m0: 1.1, m1: 1.1, m2: 1.1, m3: 1.1,
    small: 1.25, mini0: 1.13, mini1: 1.13,
  });
  const at5 = (i) => (i >= 0 ? photoDataUri(photos[i]) : '');
  const posAt5 = (i) => photoObjectPosition(i >= 0 ? photos[i] : null);
  const heroSrc = at5(m5.hero);
  const heroPos = posAt5(m5.hero);
  const mosaicIdx = [m5.m0, m5.m1, m5.m2, m5.m3];
  const mosaicSrcs = mosaicIdx.map(at5);
  const mosaicPos = mosaicIdx.map(posAt5);
  const smallSrc = at5(m5.small);
  const smallPos = posAt5(m5.small);
  const miniSrcs = [m5.mini0, m5.mini1].map(at5);
  const miniPos = [m5.mini0, m5.mini1].map(posAt5);

  const smallCap = m5.small >= 0 ? dedupCaption(pickCaption(pageContent.photoCaptions, m5.small)) : null;
  const miniCaps = [m5.mini0, m5.mini1].map(i => (i >= 0 ? dedupCaption(pickCaption(pageContent.photoCaptions, i)) : null));
  // The mini caption column is ~0.75in wide; clip long captions at a word
  // boundary instead of letting overflow:hidden cut a name in half.
  const miniCapMax = [150, 130];
  miniCaps.forEach((c, i) => {
    if (!c) return;
    const budget = miniCapMax[i] - (c.lead ? c.lead.length : 0);
    if (c.body && c.body.length > budget) {
      c.body = c.body.slice(0, Math.max(0, budget - 1)).replace(/[,\s]+\S*$/, '') + '…';
    }
  });

  // Grouped numbered captions: numbers exist only for captioned photos —
  // hero first (when captioned), then mosaic cells, sequential with no gaps.
  const capTextOf = (photoIdx) => {
    if (photoIdx < 0) return null;
    const c = dedupCaption(pickCaption(pageContent.photoCaptions, photoIdx));
    if (!c || (!c.lead && !c.body)) return null;
    return [c.lead, c.body].filter(Boolean).join(' ');
  };
  const heroCapText = capTextOf(m5.hero);
  const mosaicNums = {};
  let heroNum = 0;
  {
    let mn = 0;
    if (heroCapText) heroNum = ++mn;
    mosaicIdx.forEach((photoIdx, i) => {
      if (mosaicSrcs[i] && capTextOf(photoIdx)) mosaicNums[i] = ++mn;
    });
  }
  const mosaicCapEntries = [
    heroCapText ? `<span class="mcap"><b>${heroNum}</b>&nbsp;&nbsp;${escapeHtml(heroCapText)}</span>` : null,
    ...mosaicIdx.map((photoIdx, i) => {
      if (!mosaicNums[i]) return null;
      return `<span class="mcap"><b>${mosaicNums[i]}</b>&nbsp;&nbsp;${escapeHtml(capTextOf(photoIdx))}</span>`;
    }),
  ].filter(Boolean).join('\n');
  const mosaicCount = mosaicSrcs.filter(Boolean).length;

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
  const mini2H = 1.45;
  const mini1H = 1.65;
  const mini2Top = 10.4 - mini2H;
  const mini1Top = mini2Top - 0.18 - mini1H;
  const showMini2 = !!miniSrcs[1];
  const railAnchor = miniSrcs[0] ? mini1Top : (showMini2 ? mini2Top : 10.4);
  const featuredTop = Math.max(featuredTopMin, railAnchor - featuredHeight - 0.25);

  // Sparse degradation: with 1-2 mosaic photos a fixed 2x2 grid leaves the
  // right page mostly white. Reshape the grid (1 col) and stretch it down
  // toward the featured block so the photos carry the page instead.
  let mosaicCols = 2, mosaicRows = 2;
  let mosaicH = 5.0;
  if (mosaicCount === 1) { mosaicCols = 1; mosaicRows = 1; }
  else if (mosaicCount === 2) { mosaicCols = 1; mosaicRows = 2; }
  if (mosaicCount >= 1 && mosaicCount <= 2) {
    mosaicH = Math.max(5.0, featuredTop - 0.7 - (mosaicCapEntries ? 0.87 : 0));
  }
  const mosaicCapsTop = 0.4 + mosaicH + 0.12;

  // Split overlay quote into fitted lines (bar is 3.8" wide, minus padding)
  const overlayPick = pickOverlayQuote(overlayCandidates, 3.5, 12, 5, 10.5);
  const overlayQuote = overlayPick ? overlayPick.quote : null;
  const quoteFontPt = overlayPick ? overlayPick.fontPt : 12;
  const quoteLines = overlayPick ? overlayPick.lines : [];
  const overlayAttr = overlayQuote ? cleanAttribution(overlayQuote.attribution) : '';
  // flipQuote variant moves the overlay to the top of the hero; otherwise it
  // bottom-anchors so a long quote never pushes the attribution chip off the
  // photo's bottom edge.
  const quoteBarH = 0.5; // rendered bar pitch: 12pt line + 2×0.09 padding + margin
  const quoteBlockH = quoteLines.length * quoteBarH + (overlayAttr ? 0.35 : 0);
  // Bars dodge the hero's subject: bottom placement when faces sit high
  // (the common case), top only when the subject is low in the frame.
  const heroFocal = (m5.hero >= 0 && photos[m5.hero] && photos[m5.hero].focalPoint) || { focalX: 0.5, focalY: 0.35 };
  const quoteTop = heroFocal.focalY > 0.5 ? 0.55 : Math.min(7.7, 9.95 - quoteBlockH);
  // Quote bars dodge the hero subject using the hero's ACTUAL (possibly
  // mirrored) geometry — a naive coordinate mirror would land the bars on
  // top of the subject it used to dodge. Text never straddles the fold.
  const heroW = mosaicCount === 0 ? 12.35 : 6.6;
  const heroL = ML(3.15, heroW);
  const inHeroLeft = heroL + 0.25;
  const inHeroRight = heroL + heroW - 0.25 - 3.8;
  const quoteSafe = (x) => x >= 0.4 && x + 3.8 <= 15.6 && (x + 3.8 <= 7.8 || x >= 8.2);
  const preferRight = heroFocal.focalX <= 0.45 || (flipQuote && !(heroFocal.focalX >= 0.55));
  const quoteCandidates = preferRight ? [inHeroRight, inHeroLeft] : [inHeroLeft, inHeroRight];
  const quoteLeft = quoteCandidates.find(quoteSafe)
    ?? (mirror ? 8.8 : 3.4);  // last resort: mid-hero on the fold-safe side

  // Left column flows: title box (measured) → body (measured) → attribution
  // quote → small photo that stretches down to its caption anchor at 9.85.
  const bodyTop = Math.max(2.0, 0.4 + titleBoxH + 0.25);
  const bodyEstH = estimateTextHeightIn(pageContent.bodyCopy, 2.5, 10, { columns: 1, lineHeight: 1.42 });
  const bodyH = Math.min(4.6, Math.max(1.2, bodyEstH + 0.1));
  const attrY = bodyTop + bodyH + 0.3;
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
    left: ${px(ML(0.5, 2.5))}; top: ${px(0.4)};
    width: ${px(2.5)}; height: ${px(titleBoxH)};
    border: ${px(0.03)} solid ${PURPLE};
    padding: ${px(0.15)} ${px(0.2)};
    display: flex; align-items: center;
  }
  .title-box .title-text {
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(titleFontPt)};
    line-height: 1.05;
    color: ${DARK};
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }

  /* T2 — Body copy, single column */
  .body-copy {
    position: absolute;
    left: ${px(ML(0.5, 2.5))}; top: ${px(bodyTop)};
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
    left: ${px(ML(0.5, 2.5))}; top: ${px(attrY)};
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
    left: ${px(ML(0.5, 2.5))}; top: ${px(smallY)};
    width: ${px(2.5)}; height: ${px(smallH)};
    object-fit: cover;
    object-position: center center;
  }

  /* T4 — Caption for P_small */
  .small-caption {
    position: absolute;
    left: ${px(ML(0.5, 2.5))}; top: ${px(9.85)};
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

  /* P_hero — massive cross-gutter hero. With no mosaic photos the right
     page would be blank, so the hero bleeds across it instead. */
  .hero-photo {
    position: absolute;
    left: ${px(heroL)}; top: ${px(0.25)};
    width: ${px(heroW)}; height: ${px(10.0)};
    object-fit: cover;
    object-position: center 60%;
    ${bwFilter}
  }
  .hero-num {
    position: absolute;
    left: ${px(heroL + 0.1)}; top: ${px(9.9)};
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
    left: ${px(quoteLeft)}; top: ${px(quoteTop)};
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
    left: ${px(ML(10.0, 5.5))}; top: ${px(0.4)};
    width: ${px(5.5)}; height: ${px(mosaicH)};
    display: grid;
    grid-template-columns: ${mosaicCols === 1 ? '1fr' : '1fr 1fr'};
    grid-template-rows: ${mosaicRows === 1 ? '1fr' : '1fr 1fr'};
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
    left: ${px(ML(10.0, 5.5))}; top: ${px(mosaicCapsTop)};
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
    left: ${px(ML(13.2, 2.55))}; top: ${px(featuredTop)};
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
  .mini-1 { left: ${px(ML(13.2, 2.55))}; top: ${px(mini1Top)}; height: ${px(mini1H)}; }
  .mini-2 { left: ${px(ML(13.2, 2.55))}; top: ${px(mini2Top)}; height: ${px(mini2H)}; }
  .mini-1 img, .mini-2 img {
    width: ${px(1.7)};
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
    ${cleanAttribution(attrQuote.attribution) && !isPlaceholder(cleanAttribution(attrQuote.attribution)) ? `<div class="attr-name">— ${escapeHtml(cleanAttribution(attrQuote.attribution))}</div>` : ''}
  </div>` : ''}

  ${smallSrc ? `<img class="small-photo" src="${smallSrc}" style="object-position:${smallPos}" alt="">` : ''}
  ${smallCap && (smallCap.lead || smallCap.body) ? `
  <div class="small-caption">
    ${smallCap.lead ? `<span class="cap-title">${escapeHtml(smallCap.lead.toUpperCase())}</span> ` : ''}${escapeHtml(smallCap.body)}
  </div>` : ''}

  <!-- ============ CENTER HERO ============ -->

  ${heroSrc ? `<img class="hero-photo" src="${heroSrc}" style="object-position:${heroPos}" alt="">` : ''}
  ${heroSrc && heroNum ? `<div class="hero-num">${heroNum}</div>` : ''}

  <!-- ============ QUOTE OVERLAY ON HERO ============ -->

  ${quoteLines.length > 0 ? `
  <div class="quote-overlay">
    ${quoteLines.map(l => `<span class="quote-line">${escapeHtml(l)}</span>`).join('\n')}
    ${overlayAttr && !isPlaceholder(overlayAttr) ? `<div class="quote-attr">—${escapeHtml(overlayAttr)}</div>` : ''}
  </div>` : ''}

  <!-- ============ RIGHT PAGE — 2x2 MOSAIC ============ -->

  ${mosaicCount > 0 ? `<div class="mosaic">
    ${[0, 1, 2, 3].filter(i => mosaicSrcs[i]).map((i, pos) => {
      // With 3 photos the last cell spans both columns so no dead cell shows.
      const span = (mosaicCount === 3 && pos === 2) ? ' style="grid-column: 1 / -1;"' : '';
      const badge = mosaicNums[i] ? `<span class="num-badge">${mosaicNums[i]}</span>` : '';
      return `<div class="mosaic-cell"${span}><img src="${mosaicSrcs[i]}" style="object-position:${mosaicPos[i]}" alt="">${badge}</div>`;
    }).join('\n')}
  </div>` : ''}

  <!-- ============ MOSAIC GROUPED CAPTIONS ============ -->

  ${mosaicCapEntries ? `<div class="mosaic-captions">\n${mosaicCapEntries}\n</div>` : ''}

  <!-- ============ FEATURED MOMENTS TITLE ============ -->

  ${mosaicCount > 0 ? `<div class="featured">
    <div class="headline-black">${featuredHeadlineHtml}</div>
    ${taglineLines.map(l => `<span class="tagline-bar">${escapeHtml(l)}</span>`).join('\n')}
  </div>` : ''}

  <!-- ============ RIGHT-COLUMN MINI STACK ============ -->

  ${miniSrcs[0] ? `<div class="mini-1">
    <img src="${miniSrcs[0]}" style="object-position:${miniPos[0]}" alt="">
    <div class="cap">
      ${miniCaps[0] && miniCaps[0].lead ? `<span class="name">${escapeHtml(miniCaps[0].lead)}</span> ` : ''}${miniCaps[0] && miniCaps[0].body ? escapeHtml(miniCaps[0].body) : ''}
    </div>
  </div>` : ''}
  ${showMini2 ? `<div class="mini-2">
    ${miniSrcs[1] ? `<img src="${miniSrcs[1]}" style="object-position:${miniPos[1]}" alt="">` : ''}
    <div class="cap">
      ${miniCaps[1] && miniCaps[1].lead ? `<span class="name">${escapeHtml(miniCaps[1].lead)}</span> ` : ''}${miniCaps[1] && miniCaps[1].body ? escapeHtml(miniCaps[1].body) : ''}
    </div>
  </div>` : ''}

</div>
</body>
</html>`;
}

module.exports = { renderCrossGutterMosaic };
