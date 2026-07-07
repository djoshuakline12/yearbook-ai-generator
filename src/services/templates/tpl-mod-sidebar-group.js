// TEMPLATE 2 — MOD SIDEBAR + GROUP BLEED (Herff Jones "WRITE over your own
// title" reference, in DCHS purple)
//
//   LEFT RAIL (x 0.5-2.35): purple MOD QUESTION bar + stacked talking-head
//     mods (quote text left, small photo right), grouped captions at bottom.
//   CENTER COLUMN (x 2.8-7.5): script accent + serif title, purple subhead
//     bar, two-column body copy, 2x1 photo row below with numbers, grouped
//     captions.
//   RIGHT: caption column + two numbered photos across the top; giant group
//     photo (bleeds right + bottom) with purple pull-quote bars over its
//     lower-left and an attribution chip.
//
// Spread: 16" x 10.5".

const {
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri,
  isPlaceholder, pickCaption, splitQuoteIntoLines, dedupCaption,
  estimateTextHeightIn,
} = require('./utils');

function renderModSidebarGroup(pageContent, photos, options = {}) {
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
  // group hero=0, center row=1,2, right top=3,4, sidebar mods=5,6,7,8
  const heroSrc = photoDataUri(photos[0]);
  const centerSrcs = [1, 2].map(i => photoDataUri(photos[i]));
  const rightSrcs = [3, 4].map(i => photoDataUri(photos[i]));
  const modSrcs = [5, 6, 7, 8].map(i => photoDataUri(photos[i]));

  // ---- Text ----
  const scriptWord = (pageContent.pageTitleThemeWord || '').trim();
  const titleRaw = (pageContent.pageTitle || pageContent.section || '');
  const subheadCandidates = [
    pageContent.subheadline,
    pageContent.record,
    ...(pageContent.highlights || []),
  ].filter(t => t && !t.includes('['));
  const subheadText = (subheadCandidates.find(t =>
    t.toUpperCase().trim() !== titleRaw.toUpperCase().trim() && t.length <= 80) || '').toUpperCase();

  const bodyParagraphs = (pageContent.bodyCopy || '')
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');

  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  const quoteFontPt = 11.5;
  let heroQuote = null;
  let heroQuoteLines = [];
  for (const q of quotes) {
    const lines = splitQuoteIntoLines(q.text, 3.2, quoteFontPt);
    if (lines.length > 0 && lines.length <= 6) { heroQuote = q; heroQuoteLines = lines; break; }
  }
  const modQuotes = quotes.filter(q => q !== heroQuote).slice(0, 4);

  // Mod question bar: a question-ish framing of the section
  const modQuestion = (pageContent.headline && pageContent.headline.toUpperCase().trim() !== titleRaw.toUpperCase().trim()
    ? pageContent.headline
    : `Inside ${pageContent.section || 'the story'}`).toUpperCase();

  // ---- Captions ----
  const capText = (i) => {
    const c = dedupCaption(pickCaption(pageContent.photoCaptions, i));
    return c && (c.lead || c.body) ? [c.lead, c.body].filter(Boolean).join(' ') : null;
  };
  const centerCaps = [1, 2].map((photoIdx, i) => {
    const t = capText(photoIdx);
    return t ? `<span class="gcap"><b>${i + 1}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>` : null;
  }).filter(Boolean).join('\n');
  const rightCaps = [3, 4, 0].map((photoIdx, i) => {
    const t = capText(photoIdx);
    return t ? `<span class="gcap"><b>${i + 3}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>` : null;
  }).filter(Boolean).join('\n');

  // Sidebar mod stack: quotes first, then caption-based mods (photo +
  // caption) to fill remaining slots so the rail never runs dry.
  const modTop = 1.55;
  const modH = 1.75;
  const modGap = 0.22;
  const sideMods = [];
  for (let i = 0; i < 4; i++) {
    if (modQuotes[i]) {
      sideMods.push({ quoteObj: modQuotes[i], src: modSrcs[i] });
    } else if (modSrcs[i]) {
      const t = capText(5 + i);
      if (t) sideMods.push({ capOnly: t, src: modSrcs[i] });
    }
  }

  // Center column: photos start right below the measured body copy and
  // stretch down to the caption block.
  const bodyEstH = estimateTextHeightIn(pageContent.bodyCopy, 2.22, 9, { columns: 2 });
  const centerPhotosY = Math.min(6.0, Math.max(3.4, 2.5 + bodyEstH + 0.25));
  const centerCapsY = 8.9;
  const centerPhotoH = centerCapsY - 0.15 - centerPhotosY;

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
    font-family: 'Bodoni Moda', serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    overflow: hidden;
  }
  .spread { position: relative; width: ${spreadWpx}px; height: ${spreadHpx}px; }

  /* LEFT RAIL */
  .mod-question {
    position: absolute;
    left: ${px(0.5)}; top: ${px(0.5)};
    width: ${px(1.85)};
    background: ${PURPLE};
    color: white;
    font-weight: 700;
    font-size: ${pt(10.5)};
    line-height: 1.35;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: ${px(0.07)} ${px(0.1)};
  }
  .side-mod {
    position: absolute;
    left: ${px(0.5)};
    width: ${px(1.85)};
    display: flex;
    gap: ${px(0.1)};
  }
  .side-mod .quote {
    flex: 1;
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
  }
  .side-mod .quote .attr {
    display: block;
    margin-top: ${px(0.03)};
    font-family: 'Bodoni Moda', serif;
    font-style: italic;
    font-size: ${pt(7)};
    color: ${PURPLE};
  }
  .side-mod img {
    width: ${px(0.8)}; height: ${px(0.8)};
    object-fit: cover;
    flex: none;
  }

  /* CENTER COLUMN */
  .script-accent {
    position: absolute;
    left: ${px(2.95)}; top: ${px(0.3)};
    font-family: 'Caveat', cursive;
    font-size: ${pt(20)};
    color: ${PURPLE};
    transform: rotate(-3deg);
    z-index: 3;
  }
  .center-title {
    position: absolute;
    left: ${px(2.8)}; top: ${px(0.75)};
    width: ${px(4.7)};
    font-family: 'Bodoni Moda', serif;
    font-weight: 900;
    font-size: ${pt(24)};
    line-height: 1.08;
    color: ${DARK};
  }
  .subhead-bar {
    position: absolute;
    left: ${px(2.8)}; top: ${px(1.95)};
    display: inline-block;
    background: ${PURPLE};
    color: white;
    font-weight: 700;
    font-size: ${pt(10)};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: ${px(0.05)} ${px(0.12)};
    max-width: ${px(4.7)};
  }
  .center-body {
    position: absolute;
    left: ${px(2.8)}; top: ${px(2.5)};
    width: ${px(4.7)}; height: ${px(centerPhotosY - 2.5 - 0.15)};
    font-size: ${pt(9)};
    line-height: 1.45;
    color: ${DARK};
    column-count: 2;
    column-gap: ${px(0.25)};
    overflow: hidden;
  }
  .center-body p { margin-bottom: ${px(0.08)}; }
  .center-1, .center-2 {
    position: absolute;
    top: ${px(centerPhotosY)}; height: ${px(centerPhotoH)};
    object-fit: cover;
  }
  .center-1 { left: ${px(2.8)};  width: ${px(2.3)}; }
  .center-2 { left: ${px(5.22)}; width: ${px(2.28)}; }
  .center-caps {
    position: absolute;
    left: ${px(2.8)}; top: ${px(centerCapsY)};
    width: ${px(4.7)}; height: ${px(1.3)};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    column-count: 2;
    column-gap: ${px(0.2)};
    overflow: hidden;
  }
  .gcap { display: block; margin-bottom: ${px(0.05)}; break-inside: avoid; }
  .gcap b { font-weight: 700; }
  .num-badge {
    position: absolute;
    color: white;
    font-weight: 700;
    font-size: ${pt(9)};
    padding: 0 ${px(0.06)};
    background: rgba(0,0,0,0.55);
    z-index: 2;
  }

  /* RIGHT TOP */
  .right-caps {
    position: absolute;
    left: ${px(7.95)}; top: ${px(0.4)};
    width: ${px(1.45)}; height: ${px(2.2)};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
    text-align: right;
  }
  .right-1, .right-2 {
    position: absolute;
    top: ${px(0.4)}; height: ${px(2.2)};
    object-fit: cover;
  }
  .right-1 { left: ${px(9.55)};  width: ${px(2.4)}; }
  .right-2 { left: ${px(12.08)}; width: ${px(3.92)}; }

  /* GROUP HERO */
  .hero {
    position: absolute;
    left: ${px(7.95)}; top: ${px(2.85)};
    width: ${px(8.05)}; height: ${px(7.65)};
    object-fit: cover;
    ${bwFilter}
  }
  .quote-overlay {
    position: absolute;
    left: ${px(8.35)};
    width: ${px(3.6)};
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
    padding: ${px(0.08)} ${px(0.14)};
    margin-bottom: ${px(0.045)};
    white-space: nowrap;
    overflow: hidden;
    opacity: 0.95;
  }
  .quote-overlay .quote-attr {
    display: inline-block;
    color: white;
    background: rgba(26,26,26,0.75);
    font-family: 'Bodoni Moda', serif;
    font-style: italic;
    font-size: ${pt(9.5)};
    padding: ${px(0.03)} ${px(0.1)};
    margin-top: ${px(0.04)};
  }
</style>
</head>
<body>
<div class="spread">

  <!-- LEFT RAIL -->
  <div class="mod-question">${escapeHtml(modQuestion)}</div>
  ${sideMods.map((m, i) => {
    const top = modTop + i * (modH + modGap);
    const img = m.src ? `<img src="${m.src}" alt="">` : '';
    let body;
    if (m.quoteObj) {
      // Truncate so the quote + attribution always fit inside the mod box
      // (~170 chars at 7.5pt in a 0.95in column over ~11 lines).
      let text = m.quoteObj.text.replace(/^["']|["']$/g, '');
      if (text.length > 170) text = text.slice(0, 167).replace(/\s+\S*$/, '') + '…';
      const attr = m.quoteObj.attribution && !isPlaceholder(m.quoteObj.attribution)
        ? `<span class="attr">— ${escapeHtml(m.quoteObj.attribution)}</span>` : '';
      body = `"${escapeHtml(text)}"${attr}`;
    } else {
      let text = m.capOnly;
      if (text.length > 180) text = text.slice(0, 177).replace(/\s+\S*$/, '') + '…';
      body = escapeHtml(text);
    }
    return `<div class="side-mod" style="top:${px(top)};height:${px(modH)}"><div class="quote">${body}</div>${img}</div>`;
  }).join('\n')}

  <!-- CENTER COLUMN -->
  ${scriptWord ? `<div class="script-accent">${escapeHtml(scriptWord)}</div>` : ''}
  ${titleRaw ? `<div class="center-title">${escapeHtml(titleRaw)}</div>` : ''}
  ${subheadText ? `<div class="subhead-bar">${escapeHtml(subheadText)}</div>` : ''}
  <div class="center-body">${bodyParagraphs}</div>
  ${centerSrcs[0] ? `<img class="center-1" src="${centerSrcs[0]}" alt=""><span class="num-badge" style="left:${px(2.88)};top:${px(centerPhotosY + centerPhotoH - 0.32)}">1</span>` : ''}
  ${centerSrcs[1] ? `<img class="center-2" src="${centerSrcs[1]}" alt=""><span class="num-badge" style="left:${px(5.3)};top:${px(centerPhotosY + centerPhotoH - 0.32)}">2</span>` : ''}
  ${centerCaps ? `<div class="center-caps">${centerCaps}</div>` : ''}

  <!-- RIGHT TOP -->
  ${rightCaps ? `<div class="right-caps">${rightCaps}</div>` : ''}
  ${rightSrcs[0] ? `<img class="right-1" src="${rightSrcs[0]}" alt=""><span class="num-badge" style="left:${px(9.63)};top:${px(2.28)}">3</span>` : ''}
  ${rightSrcs[1] ? `<img class="right-2" src="${rightSrcs[1]}" alt=""><span class="num-badge" style="left:${px(12.16)};top:${px(2.28)}">4</span>` : ''}

  <!-- GROUP HERO -->
  ${heroSrc ? `<img class="hero" src="${heroSrc}" alt=""><span class="num-badge" style="left:${px(8.03)};top:${px(10.1)}">5</span>` : ''}
  ${heroQuoteLines.length > 0 ? `
  <div class="quote-overlay" style="top:${px(flipQuote ? 3.25 : 10.1 - heroQuoteLines.length * 0.32 - (heroQuote.attribution ? 0.35 : 0.1))}">
    ${heroQuoteLines.map(l => `<span class="quote-line">${escapeHtml(l)}</span>`).join('\n')}
    ${heroQuote.attribution && !isPlaceholder(heroQuote.attribution) ? `<div class="quote-attr">—${escapeHtml(heroQuote.attribution)}</div>` : ''}
  </div>` : ''}

</div>
</body>
</html>`;
}

module.exports = { renderModSidebarGroup };
