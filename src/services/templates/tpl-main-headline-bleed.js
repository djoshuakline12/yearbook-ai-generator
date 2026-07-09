// TEMPLATE 4 — MAIN HEADLINE BLEED (volleyball reference, in DCHS purple)
//
// Hand-authored layout, box-by-box from the Herff Jones reference:
//   LEFT COLUMN (x 0.5-3.2): small photo + side caption, taller photo below,
//     MAIN HEADLINE serif, purple MOD HEADLINE bar, single-column body copy.
//   TOP STRIP (x 3.5-13.75): three numbered photos + grouped caption column
//     on the far right.
//   MIDDLE-LEFT (x 3.5-7.2): tall B&W crowd photo (1), two small photos
//     below (2, 3), grouped captions beneath covering 1-4.
//   RIGHT: big hero photo (4) bleeding off the right and bottom edges with
//     stacked purple pull-quote bars over its upper-left.
//
// Spread: 16" x 10.5". Left page x=0-8, right page x=8-16.

const {
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri,
  isPlaceholder, pickCaption, splitQuoteIntoLines, wrapToLines, dedupCaption,
  cleanAttribution, estimateTextHeightIn, wrapLineCount,
} = require('./utils');

function renderMainHeadlineBleed(pageContent, photos, options = {}) {
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
  // Full sessions: hero=0, top strip=1-3, crowd=4, under-crowd=5-6, left
  // column=7-8. Sparse sessions fill the two anchor slots (hero, crowd)
  // first so the spread's structure survives with few photos.
  const N = Array.isArray(photos) ? photos.length : 0;
  const assign = {};
  const slotNames = N >= 9
    ? ['hero', 'strip0', 'strip1', 'strip2', 'crowd', 'under0', 'under1', 'leftA', 'leftB']
    : ['hero', 'crowd', 'strip0', 'strip1', 'strip2', 'under0', 'under1', 'leftA', 'leftB'];
  slotNames.forEach((k, i) => { assign[k] = i < N ? i : -1; });
  const at = (i) => (i >= 0 ? photoDataUri(photos[i]) : '');
  const heroSrc = at(assign.hero);
  const stripSrcs = [at(assign.strip0), at(assign.strip1), at(assign.strip2)];
  const crowdSrc = at(assign.crowd);
  const underSrcs = [at(assign.under0), at(assign.under1)];
  const leftASrc = at(assign.leftA);
  const leftBSrc = at(assign.leftB);

  // ---- Text content ----
  const titleRaw = (pageContent.pageTitle || pageContent.section || '').toUpperCase();
  // Mod bar: first short candidate that isn't just the title again.
  const modCandidates = [
    pageContent.subheadline,
    pageContent.record,
    ...(pageContent.highlights || []),
  ].filter(t => t && !t.includes('['));
  const modBarText = (modCandidates.find(t =>
    t.toUpperCase().trim() !== titleRaw.trim() && t.length <= 70) || '').toUpperCase();
  const bodyParagraphs = (pageContent.bodyCopy || '')
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');

  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  const quoteFontPt = 12;
  // Hero quote: first quote that fits in <= 9 bars (so bars never overrun
  // the hero). Filler quote: any other quote, shown italic bottom-left.
  let heroQuote = null;
  let quoteLines = [];
  for (const q of quotes) {
    const lines = splitQuoteIntoLines(q.text, 3.3, quoteFontPt);
    if (lines.length > 0 && lines.length <= 9) { heroQuote = q; quoteLines = lines; break; }
  }
  const fillerQuote = quotes.find(q => q !== heroQuote) || null;

  // ---- Captions ----
  const capText = (c) => c && (c.lead || c.body)
    ? [c.lead, c.body].filter(Boolean).join(' ')
    : null;

  const capAt = (i) => (i >= 0 ? capText(dedupCaption(pickCaption(pageContent.photoCaptions, i))) : null);

  // Top strip grouped captions, numbered by visual order over present photos
  const stripCapEntries = ['strip0', 'strip1', 'strip2'].map((k, i) => {
    if (!stripSrcs[i]) return null;
    const t = capAt(assign[k]);
    return t ? `<span class="gcap"><b>${i + 1}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>` : null;
  }).filter(Boolean).join('\n');

  // Middle group: crowd, under-crowd pair, hero — numbered over the photos
  // that actually rendered so a lone hero is "1", not a floating "4".
  const midSlots = [
    { key: 'crowd', src: crowdSrc },
    { key: 'under0', src: underSrcs[0] },
    { key: 'under1', src: underSrcs[1] },
    { key: 'hero', src: heroSrc },
  ];
  const midNums = {};
  let midN = 0;
  midSlots.forEach(s => { if (s.src) midNums[s.key] = ++midN; });
  const midCapEntries = midSlots.map(({ key, src }) => {
    if (!src) return null;
    const t = capAt(assign[key]);
    return t ? `<span class="gcap"><b>${midNums[key]}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>` : null;
  }).filter(Boolean).join('\n');

  // Left column captions
  const leftACap = capAt(assign.leftA);
  const leftBCap = capAt(assign.leftB);

  // ---- Left column vertical layout (computed so nothing collides) ----
  const leftColX = 0.5;
  const leftColW = 2.7;
  // photo A + side caption
  const leftAY = 0.4;
  const leftAH = 1.5;
  // photo B
  const leftBY = leftASrc ? leftAY + leftAH + 0.15 : leftAY;
  const leftBH = 2.1;
  // headline
  const titleY = (leftBSrc ? leftBY + leftBH : (leftASrc ? leftBY : 0.4)) + 0.3;
  // Title font shrinks so the longest word always fits the 2.7in column
  // (Bodoni ~(120/pt - 0.4) chars per inch, with margin). Floor at 20pt.
  const longestWord = titleRaw.split(/\s+/).reduce((a, w) => Math.max(a, w.length), 1);
  const titleFontPt = Math.max(20, Math.min(30, Math.floor(120 / (longestWord / 2.7 + 0.4))));
  const titleCharsPerLine = Math.max(6, Math.floor(2.7 * (120 / titleFontPt - 0.4)));
  const titleLineCount = wrapLineCount(titleRaw, titleCharsPerLine) || 1;
  const titleLineIn = titleFontPt * 1.15 / 72;
  const modBarY = titleY + titleLineCount * titleLineIn + 0.12;
  // Mod bar can wrap — count its lines exactly so the body never overlaps.
  const modBarLines = modBarText ? wrapLineCount(modBarText, 27) : 0;
  const bodyY = modBarText ? modBarY + modBarLines * 0.24 + 0.18 : modBarY + 0.05;
  // Filler quote follows the measured body copy instead of bottom-anchoring
  // (a short body would otherwise leave a stranded quote below a long gap).
  const fillerH = fillerQuote ? 1.15 : 0;
  const bodyEstH = estimateTextHeightIn(pageContent.bodyCopy, 2.7, 9.5, { columns: 1, lineHeight: 1.5 });
  const fillerY = fillerQuote ? Math.min(10.1 - fillerH, bodyY + Math.max(0.9, bodyEstH) + 0.2) : 10.1;
  const bodyH = Math.max(1.0, fillerY - bodyY - 0.12);
  // Truncate the filler so it never clips mid-sentence inside its box
  // (~6 lines at 9.5pt italic in a 2.7in column).
  let fillerText = fillerQuote ? fillerQuote.text.replace(/^["']|["']$/g, '') : '';
  if (fillerText.length > 185) fillerText = fillerText.slice(0, 182).replace(/\s+\S*$/, '') + '…';
  const fillerAttr = fillerQuote ? cleanAttribution(fillerQuote.attribution) : '';

  // ---- Adaptive photo geometry (sparse sessions) ----
  // No top strip → hero and crowd rise to the top margin. No crowd → the
  // hero bleeds left across the empty middle column.
  const stripAny = !!(stripSrcs[0] || stripSrcs[1] || stripSrcs[2]);
  const underAny = !!(underSrcs[0] || underSrcs[1]);
  const heroTop = stripAny ? 3.1 : 0.4;
  const heroX = crowdSrc ? 8.0 : 3.5;
  const heroW = 16 - heroX;
  const heroH = 10.5 - heroTop;
  const crowdTop = stripAny ? 3.1 : 0.4;
  const crowdH = (underAny ? 7.1 : 8.95) - crowdTop;
  // With no crowd column the grouped captions would sit on the widened
  // hero — render them as a white chip over its bottom-left instead.
  const midCapsOverlay = !crowdSrc;

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

  /* ---------- LEFT COLUMN ---------- */
  .left-a {
    position: absolute;
    left: ${px(leftColX)}; top: ${px(leftAY)};
    width: ${px(1.5)}; height: ${px(leftAH)};
    object-fit: cover;
  }
  .left-a-cap {
    position: absolute;
    left: ${px(leftColX + 1.62)}; top: ${px(leftAY)};
    width: ${px(leftColW - 1.62)}; height: ${px(leftAH)};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
  }
  .left-b {
    position: absolute;
    left: ${px(leftColX)}; top: ${px(leftBY)};
    width: ${px(leftColW)}; height: ${px(leftBH)};
    object-fit: cover;
  }
  .left-b-cap {
    position: absolute;
    left: ${px(leftColX)}; top: ${px(leftBY + leftBH + 0.06)};
    width: ${px(leftColW)};
    font-size: ${pt(7.5)};
    line-height: 1.3;
    color: ${DARK};
  }
  .main-headline {
    position: absolute;
    left: ${px(leftColX)}; top: ${px(titleY)};
    width: ${px(leftColW)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(titleFontPt)};
    line-height: 1.08;
    color: ${DARK};
    letter-spacing: 0.01em;
  }
  .mod-bar {
    position: absolute;
    left: ${px(leftColX)}; top: ${px(modBarY)};
    display: inline-block;
    background: ${PURPLE};
    color: white;
    font-weight: 700;
    font-size: ${pt(10.5)};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: ${px(0.05)} ${px(0.12)};
    max-width: ${px(leftColW)};
  }
  .left-body {
    position: absolute;
    left: ${px(leftColX)}; top: ${px(bodyY)};
    width: ${px(leftColW)}; height: ${px(bodyH)};
    font-size: ${pt(9.5)};
    line-height: 1.5;
    color: ${DARK};
    overflow: hidden;
  }
  .left-body p { margin-bottom: ${px(0.1)}; }
  .left-quote {
    position: absolute;
    left: ${px(leftColX)}; top: ${px(fillerY)};
    width: ${px(leftColW)}; height: ${px(1.1)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(9.5)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
  }
  .left-quote .attr {
    font-size: ${pt(8.5)};
    color: #666666;
    margin-top: ${px(0.05)};
  }

  /* ---------- TOP STRIP ---------- */
  .strip-1, .strip-2, .strip-3 {
    position: absolute;
    top: ${px(0.4)}; height: ${px(2.2)};
    object-fit: cover;
  }
  .strip-1 { left: ${px(3.5)};  width: ${px(3.6)}; }
  .strip-2 { left: ${px(7.22)}; width: ${px(2.9)}; }
  .strip-3 { left: ${px(10.24)}; width: ${px(3.4)}; }
  .strip-num {
    position: absolute;
    top: ${px(2.28)};
    color: white;
    font-weight: 700;
    font-size: ${pt(9)};
    padding: 0 ${px(0.06)};
    background: rgba(0,0,0,0.55);
    z-index: 2;
  }
  .strip-caps {
    position: absolute;
    left: ${px(13.85)}; top: ${px(0.4)};
    width: ${px(1.75)}; height: ${px(2.6)};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
  }
  .gcap { display: block; margin-bottom: ${px(0.06)}; break-inside: avoid; }
  .gcap b { font-weight: 700; }

  /* ---------- MIDDLE-LEFT BLOCK ---------- */
  .crowd {
    position: absolute;
    left: ${px(3.5)}; top: ${px(crowdTop)};
    width: ${px(3.7)}; height: ${px(crowdH)};
    object-fit: cover;
    filter: grayscale(1) contrast(1.05);
  }
  .under-1, .under-2 {
    position: absolute;
    top: ${px(7.25)}; height: ${px(1.7)};
    width: ${px(1.8)};
    object-fit: cover;
  }
  .under-1 { left: ${px(3.5)}; }
  .under-2 { left: ${px(5.4)}; }
  .mid-caps {
    position: absolute;
    ${midCapsOverlay
      ? `left: ${px(heroX + 0.35)}; bottom: ${px(0.75)};
    width: ${px(3.7)};
    background: rgba(255,255,255,0.92);
    padding: ${px(0.08)} ${px(0.12)};
    z-index: 3;`
      : `left: ${px(3.5)}; top: ${px(9.1)};
    width: ${px(3.7)}; height: ${px(1.1)};
    column-count: 2;
    column-gap: ${px(0.15)};
    overflow: hidden;`}
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
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

  /* ---------- HERO ---------- */
  .hero {
    position: absolute;
    left: ${px(heroX)}; top: ${px(heroTop)};
    width: ${px(heroW)}; height: ${px(heroH)};
    object-fit: cover;
    ${bwFilter}
  }
  .quote-overlay {
    position: absolute;
    left: ${px(8.4)}; top: ${px(flipQuote ? Math.max(heroTop + 0.4, 10.0 - quoteLines.length * 0.41 - 0.6) : heroTop + 0.4)};
    width: ${px(3.7)};
    z-index: 3;
  }
  .quote-overlay .quote-line {
    display: block;
    background: ${PURPLE};
    color: white;
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
    background: rgba(26,26,26,0.75);
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(10)};
    padding: ${px(0.03)} ${px(0.1)};
    margin-top: ${px(0.04)};
  }
</style>
</head>
<body>
<div class="spread">

  <!-- LEFT COLUMN -->
  ${leftASrc ? `<img class="left-a" src="${leftASrc}" alt="">` : ''}
  ${leftASrc && leftACap ? `<div class="left-a-cap">${escapeHtml(leftACap)}</div>` : ''}
  ${leftBSrc ? `<img class="left-b" src="${leftBSrc}" alt="">` : ''}
  ${leftBSrc && leftBCap ? `<div class="left-b-cap">${escapeHtml(leftBCap)}</div>` : ''}

  ${titleRaw ? `<div class="main-headline">${escapeHtml(titleRaw)}</div>` : ''}
  ${modBarText ? `<div class="mod-bar">${escapeHtml(modBarText)}</div>` : ''}
  <div class="left-body">${bodyParagraphs}</div>
  ${fillerQuote ? `
  <div class="left-quote">
    <div>'${escapeHtml(fillerText)}'</div>
    ${fillerAttr && !isPlaceholder(fillerAttr) ? `<div class="attr">— ${escapeHtml(fillerAttr)}</div>` : ''}
  </div>` : ''}

  <!-- TOP STRIP -->
  ${stripSrcs[0] ? `<img class="strip-1" src="${stripSrcs[0]}" alt="">${stripCapEntries ? `<span class="strip-num" style="left:${px(3.58)}">1</span>` : ''}` : ''}
  ${stripSrcs[1] ? `<img class="strip-2" src="${stripSrcs[1]}" alt="">${stripCapEntries ? `<span class="strip-num" style="left:${px(7.3)}">2</span>` : ''}` : ''}
  ${stripSrcs[2] ? `<img class="strip-3" src="${stripSrcs[2]}" alt="">${stripCapEntries ? `<span class="strip-num" style="left:${px(10.32)}">3</span>` : ''}` : ''}
  ${stripCapEntries ? `<div class="strip-caps">${stripCapEntries}</div>` : ''}

  <!-- MIDDLE-LEFT BLOCK -->
  ${crowdSrc ? `<img class="crowd" src="${crowdSrc}" alt="">${midCapEntries ? `<span class="num-badge" style="left:${px(3.58)};top:${px(crowdTop + crowdH - 0.32)}">${midNums.crowd}</span>` : ''}` : ''}
  ${underSrcs[0] ? `<img class="under-1" src="${underSrcs[0]}" alt="">${midCapEntries ? `<span class="num-badge" style="left:${px(3.58)};top:${px(8.63)}">${midNums.under0}</span>` : ''}` : ''}
  ${underSrcs[1] ? `<img class="under-2" src="${underSrcs[1]}" alt="">${midCapEntries ? `<span class="num-badge" style="left:${px(5.48)};top:${px(8.63)}">${midNums.under1}</span>` : ''}` : ''}
  ${midCapEntries ? `<div class="mid-caps">${midCapEntries}</div>` : ''}

  <!-- HERO -->
  ${heroSrc ? `<img class="hero" src="${heroSrc}" alt="">${midCapEntries ? `<span class="num-badge" style="left:${px(heroX + 0.15)};top:${px(10.05)}">${midNums.hero}</span>` : ''}` : ''}
  ${quoteLines.length > 0 ? `
  <div class="quote-overlay">
    ${quoteLines.map(l => `<span class="quote-line">${escapeHtml(l)}</span>`).join('\n')}
    ${cleanAttribution(heroQuote.attribution) && !isPlaceholder(cleanAttribution(heroQuote.attribution)) ? `<div class="quote-attr">—${escapeHtml(cleanAttribution(heroQuote.attribution))}</div>` : ''}
  </div>` : ''}

</div>
</body>
</html>`;
}

module.exports = { renderMainHeadlineBleed };
