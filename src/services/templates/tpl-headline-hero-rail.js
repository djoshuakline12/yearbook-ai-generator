// TEMPLATE 3 — HEADLINE + HERO + RAIL (Herff Jones pink "MAIN HEADLINE CAN
// GO HERE" reference, in DCHS purple)
//
//   LEFT (x 0.75-6.3): serif headline + purple MOD HEADLINE bar, two-column
//     body copy, purple pull-quote bars mid-left, two inset photos.
//   CENTER (x 6.6-12.0): dominant hero photo (1) with a vertical caption
//     column and a wide photo (2) below it.
//   RIGHT RAIL (x 12.4-15.5): bold "behind the scenes" header + stacked
//     talking-head mods (photo above, quote/caption below).
//
// Spread: 16" x 10.5".

const {
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri, photoObjectPosition,
  isPlaceholder, pickCaption, splitQuoteIntoLines, dedupCaption,
  cleanAttribution, repairAspects, estimateTextHeightIn, wrapLineCount,
} = require('./utils');

function renderHeadlineHeroRail(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const variant = options.variant || 0;
  const anchorColor = !!(variant & 1);   // bit0: anchor photo color vs B&W
  const flipQuote = !!(variant & 2);     // bit1: quote-block position flip
  const bwFilter = anchorColor ? '' : 'filter: grayscale(1) contrast(1.05);';
  const PURPLE = BRAND.purple;
  const DARK = '#1A1A1A';
  const spreadWpx = inToPx(16, dpi);
  const spreadHpx = inToPx(10.5, dpi);
  const px = (n) => `${inToPx(n, dpi)}px`;
  const pt = (n) => `${ptToPx(n, dpi)}px`;

  // ---- Photo slots ----
  // Full sessions: hero=0, under-hero wide=1, rail heads=2,3,4, left
  // insets=5,6, quote-column filler=7.
  // Sparse sessions route the spare photos to the left-column inset (which
  // stretches to the page bottom) before the rail, so the left page never
  // ends in a half-page of white.
  const N = Array.isArray(photos) ? photos.length : 0;
  const idx = {};
  const slotNames = N >= 8
    ? ['hero', 'under', 'rail0', 'rail1', 'rail2', 'inset1', 'inset2', 'quoteCol']
    : ['hero', 'inset2', 'under', 'inset1', 'rail0', 'rail1', 'rail2', 'quoteCol'];
  slotNames.forEach((k, i) => { idx[k] = i < N ? i : -1; });
  // Shape-match photos to slots (hero is portrait-ish, rail cards and the
  // under-hero band are wide) so group shots never get slivered.
  repairAspects(photos, idx, {
    hero: 0.86, under: 1.14, rail0: 1.8, rail1: 1.8, rail2: 1.8,
    inset1: 1.18, inset2: 0.93, quoteCol: 0.9,
  });
  const at = (i) => (i >= 0 ? photoDataUri(photos[i]) : '');
  const posAt = (i) => photoObjectPosition(i >= 0 ? photos[i] : null);
  const heroSrc = at(idx.hero);
  const heroPos = posAt(idx.hero);
  const underSrc = at(idx.under);
  const underPos = posAt(idx.under);
  const railSrcs = [at(idx.rail0), at(idx.rail1), at(idx.rail2)];
  const railPos = [posAt(idx.rail0), posAt(idx.rail1), posAt(idx.rail2)];
  const insetSrcs = [at(idx.inset1), at(idx.inset2)];
  const insetPos = [posAt(idx.inset1), posAt(idx.inset2)];
  const quoteColSrc = at(idx.quoteCol);
  const quoteColPos = posAt(idx.quoteCol);

  // ---- Text ----
  const titleRaw = (pageContent.pageTitle || pageContent.section || '');
  const modCandidates = [
    pageContent.subheadline,
    pageContent.record,
    ...(pageContent.highlights || []),
  ].filter(t => t && !t.includes('['));
  const modBarText = (modCandidates.find(t =>
    t.toUpperCase().trim() !== titleRaw.toUpperCase().trim() && t.length <= 70) || '').toUpperCase();

  const bodyParagraphs = (pageContent.bodyCopy || '')
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');

  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  const quoteFontPt = 11;
  let pullQuote = null;
  let pullQuoteLines = [];
  for (const q of quotes) {
    const lines = splitQuoteIntoLines(q.text, 2.5, quoteFontPt);
    if (lines.length > 0 && lines.length <= 6) { pullQuote = q; pullQuoteLines = lines; break; }
  }
  const railQuotes = quotes.filter(q => q !== pullQuote).slice(0, 3);

  // Rail header: prefer headline (if distinct), else a framing line.
  const railHeader = (pageContent.headline && pageContent.headline.toUpperCase().trim() !== titleRaw.toUpperCase().trim())
    ? pageContent.headline
    : `What was going on behind the scenes?`;

  // ---- Captions ----
  const capText = (i) => {
    const c = dedupCaption(pickCaption(pageContent.photoCaptions, i));
    return c && (c.lead || c.body) ? [c.lead, c.body].filter(Boolean).join(' ') : null;
  };
  const heroCaps = [idx.hero, idx.under].map((photoIdx, i) => {
    if (photoIdx < 0) return null;
    const t = capText(photoIdx);
    return t ? `<span class="gcap"><b>${i + 1}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>` : null;
  }).filter(Boolean).join('\n');
  const railCapTexts = [idx.rail0, idx.rail1, idx.rail2].map(i => (i >= 0 ? capText(i) : null));

  // Title height drives the left column flow. The pull-quote/inset row
  // starts right below the measured body copy — no fixed-position gap.
  const titleCharsPerLine = 16; // ~26pt serif in 5.5in
  const titleLineCount = wrapLineCount(titleRaw, titleCharsPerLine) || 1;
  const modBarY = 0.5 + titleLineCount * 0.42 + 0.1;
  const bodyY = modBarText ? modBarY + 0.42 : modBarY + 0.08;
  const bodyEstH = estimateTextHeightIn(pageContent.bodyCopy, 2.62, 9, { columns: 2 });
  const bodyH = Math.min(Math.max(1.2, bodyEstH + 0.1), 6.5 - bodyY);
  const rowY = bodyY + bodyH + 0.25;
  const inset1H = Math.min(2.6, (10.05 - rowY - 0.15) * 0.52);
  // Without an inset-1 photo, inset-2 starts at the row top and takes the
  // full remaining column height.
  const inset2Y = insetSrcs[0] ? rowY + inset1H + 0.15 : rowY;
  const inset2H = 10.05 - inset2Y;

  // Hero grows into the under-hero band when that photo is missing; the
  // caption column becomes a wide band directly beneath it.
  const heroH = underSrc ? 6.3 : (heroCaps ? 8.5 : 9.65);
  const heroCapsTop = underSrc ? 6.85 : 0.4 + heroH + 0.2;
  const heroCapsW = underSrc ? 1.5 : 5.4;
  const heroCapsH = Math.max(0.4, 10.05 - heroCapsTop);

  // bit1 swaps the pull-quote column and the inset-photo column.
  const pullX = flipQuote ? 0.75 : 3.5;
  const insetX = flipQuote ? 3.5 : 0.75;
  // The quote column fills below its bars with a photo (or the inset-2
  // caption) so it never runs empty to the page bottom.
  const pullBarsH = pullQuoteLines.length * 0.34 + (pullQuote && pullQuote.attribution ? 0.35 : 0.1);
  const quoteColPhotoY = rowY + pullBarsH + 0.2;
  const quoteColPhotoH = Math.max(0, 10.05 - quoteColPhotoY);
  const showQuoteColPhoto = quoteColSrc && quoteColPhotoH >= 1.2;
  // Inset-2 caption lives in the quote column; when inset-2 starts at the
  // row top (no inset-1) the caption must clear the pull-quote bars.
  const inset2CapY = insetSrcs[0] ? inset2Y : Math.min(9.65, rowY + pullBarsH + 0.35);
  // Under-hero photo spans the full hero width when there are no captions
  // to fill the column beside it.
  const underX = heroCaps ? 8.25 : 6.6;
  const underW = 12.0 - underX;
  // Rail mods: quotes first, then caption fallbacks so the rail fills.
  const railMods = [];
  for (let i = 0; i < 3; i++) {
    if (railQuotes[i]) railMods.push({ quoteObj: railQuotes[i], src: railSrcs[i] });
    else if (railSrcs[i] && railCapTexts[i]) railMods.push({ capOnly: railCapTexts[i], src: railSrcs[i] });
  }
  // Distribute the mods over the rail height — text-only mods are short and
  // would otherwise bunch at the top with a dead zone below.
  const anyRailImg = railMods.some(m => m.src);
  const railUnit = anyRailImg ? 2.95 : 1.5;
  const railGap = railMods.length > 1
    ? Math.min(2.6, Math.max(0, (9.9 - 1.15 - railMods.length * railUnit) / (railMods.length - 1)))
    : 0;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${BRAND.fontLink}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${spreadWpx}px; height: ${spreadHpx}px;
    background: white;
    font-family: ${BRAND.body};
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    overflow: hidden;
  }
  .spread { position: relative; width: ${spreadWpx}px; height: ${spreadHpx}px; }

  /* LEFT */
  .headline {
    position: absolute;
    left: ${px(0.75)}; top: ${px(0.5)};
    width: ${px(5.5)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(26)};
    line-height: 1.08;
    color: ${DARK};
  }
  .mod-bar {
    position: absolute;
    left: ${px(0.75)}; top: ${px(modBarY)};
    display: inline-block;
    background: ${PURPLE};
    color: white;
    font-weight: 700;
    font-size: ${pt(10)};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: ${px(0.05)} ${px(0.12)};
    max-width: ${px(5.5)};
  }
  .body-copy {
    position: absolute;
    left: ${px(0.75)}; top: ${px(bodyY)};
    width: ${px(5.5)}; height: ${px(bodyH)};
    font-size: ${pt(9)};
    line-height: 1.45;
    color: ${DARK};
    column-count: 2;
    column-gap: ${px(0.25)};
    overflow: hidden;
  }
  .body-copy p { margin-bottom: ${px(0.08)}; }

  .pull-quote {
    position: absolute;
    left: ${px(pullX)}; top: ${px(rowY)};
    width: ${px(2.75)};
    z-index: 3;
  }
  .pull-quote .quote-line {
    display: block;
    background: ${PURPLE};
    color: white;
    font-weight: 700;
    font-size: ${pt(quoteFontPt)};
    text-transform: uppercase;
    letter-spacing: 0.02em;
    padding: ${px(0.07)} ${px(0.12)};
    margin-bottom: ${px(0.045)};
    white-space: nowrap;
    overflow: hidden;
  }
  .pull-quote .quote-attr {
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(9)};
    color: ${DARK};
    margin-top: ${px(0.04)};
  }

  .inset-1, .inset-2 {
    position: absolute;
    left: ${px(insetX)};
    width: ${px(2.6)};
    object-fit: cover;
  }
  .inset-1 { top: ${px(rowY)}; height: ${px(inset1H)}; }
  .inset-2 { top: ${px(inset2Y)}; height: ${px(inset2H)}; }
  .inset-2-cap {
    position: absolute;
    left: ${px(pullX)}; top: ${px(inset2CapY)};
    width: ${px(2.75)};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
  }

  .quote-col-photo {
    position: absolute;
    left: ${px(pullX)}; top: ${px(quoteColPhotoY)};
    width: ${px(2.75)}; height: ${px(quoteColPhotoH)};
    object-fit: cover;
  }

  /* CENTER HERO */
  .hero {
    position: absolute;
    left: ${px(6.6)}; top: ${px(0.4)};
    width: ${px(5.4)}; height: ${px(heroH)};
    object-fit: cover;
  }
  .hero-caps {
    position: absolute;
    left: ${px(6.6)}; top: ${px(heroCapsTop)};
    width: ${px(heroCapsW)}; height: ${px(heroCapsH)};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
  }
  .gcap { display: block; margin-bottom: ${px(0.06)}; break-inside: avoid; }
  .gcap b { font-weight: 700; }
  .under-hero {
    position: absolute;
    left: ${px(underX)}; top: ${px(6.85)};
    width: ${px(underW)}; height: ${px(3.3)};
    object-fit: cover;
    ${bwFilter}
  }
  .num-badge {
    position: absolute;
    color: white;
    font-weight: 700;
    font-size: ${pt(9)};
    padding: 0 ${px(0.06)};
    background: rgba(0,0,0,0.55);
    z-index: 2;
  }

  /* RIGHT RAIL */
  .rail-header {
    position: absolute;
    left: ${px(12.4)}; top: ${px(0.4)};
    width: ${px(3.1)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(12)};
    line-height: 1.2;
    color: ${DARK};
    text-transform: uppercase;
  }
  .rail-mod {
    position: absolute;
    left: ${px(12.4)};
    width: ${px(3.1)};
  }
  .rail-mod img {
    width: 100%; height: ${px(1.7)};
    object-fit: cover;
    display: block;
    margin-bottom: ${px(0.06)};
  }
  .rail-mod .quote {
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
  }
  .rail-mod .quote .attr {
    display: block;
    margin-top: ${px(0.03)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(7)};
    color: ${PURPLE};
  }
</style>
</head>
<body>
<div class="spread">

  <!-- LEFT -->
  ${titleRaw ? `<div class="headline">${escapeHtml(titleRaw)}</div>` : ''}
  ${modBarText ? `<div class="mod-bar">${escapeHtml(modBarText)}</div>` : ''}
  <div class="body-copy">${bodyParagraphs}</div>

  ${pullQuoteLines.length > 0 ? `
  <div class="pull-quote">
    ${pullQuoteLines.map(l => `<span class="quote-line">${escapeHtml(l)}</span>`).join('\n')}
    ${cleanAttribution(pullQuote.attribution) && !isPlaceholder(cleanAttribution(pullQuote.attribution)) ? `<div class="quote-attr">— ${escapeHtml(cleanAttribution(pullQuote.attribution))}</div>` : ''}
  </div>` : ''}
  ${insetSrcs[0] ? `<img class="inset-1" src="${insetSrcs[0]}" style="object-position:${insetPos[0]}" alt="">` : ''}
  ${insetSrcs[1] ? `<img class="inset-2" src="${insetSrcs[1]}" style="object-position:${insetPos[1]}" alt="">` : ''}
  ${insetSrcs[1] && idx.inset2 >= 0 && capText(idx.inset2) ? `<div class="inset-2-cap">${escapeHtml(capText(idx.inset2))}</div>` : ''}

  ${showQuoteColPhoto ? `<img class="quote-col-photo" src="${quoteColSrc}" style="object-position:${quoteColPos}" alt="">` : ''}

  <!-- CENTER HERO -->
  ${heroSrc ? `<img class="hero" src="${heroSrc}" style="object-position:${heroPos}" alt="">${heroCaps ? `<span class="num-badge" style="left:${px(6.68)};top:${px(0.4 + heroH - 0.32)}">1</span>` : ''}` : ''}
  ${heroCaps ? `<div class="hero-caps">${heroCaps}</div>` : ''}
  ${underSrc ? `<img class="under-hero" src="${underSrc}" style="object-position:${underPos}" alt="">${heroCaps ? `<span class="num-badge" style="left:${px(underX + 0.08)};top:${px(9.83)}">2</span>` : ''}` : ''}

  <!-- RIGHT RAIL -->
  ${railMods.length > 0 ? `<div class="rail-header">${escapeHtml(railHeader)}</div>` : ''}
  ${railMods.map((m, i) => {
    const top = 1.15 + i * (railUnit + railGap);
    const img = m.src ? `<img src="${m.src}" style="object-position:${railPos[railSrcs.indexOf(m.src)] || 'center 35%'}" alt="">` : '';
    let body;
    if (m.quoteObj) {
      const attrName = cleanAttribution(m.quoteObj.attribution);
      const attr = attrName && !isPlaceholder(attrName)
        ? `<span class="attr">— ${escapeHtml(attrName)}</span>` : '';
      body = `"${escapeHtml(m.quoteObj.text.replace(/^["']|["']$/g, ''))}"${attr}`;
    } else {
      body = escapeHtml(m.capOnly);
    }
    return `<div class="rail-mod" style="top:${px(top)}">${img}<div class="quote">${body}</div></div>`;
  }).join('\n')}

</div>
</body>
</html>`;
}

module.exports = { renderHeadlineHeroRail };
