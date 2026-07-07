// TEMPLATE 1 — SHARE A STORY (Herff Jones "PANTHERS share a story here"
// reference, in DCHS purple)
//
// Editorial spread:
//   TOP-LEFT: script accent word over a big serif title + purple subtitle bar.
//   LEFT: two-column body copy; below it a big B&W photo (1) with two stacked
//     photos (2, 3) to its right and grouped captions beneath.
//   BOTTOM (spanning both pages): "THIS IS *MY* ANGLE" header + purple
//     question bar + a row of talking-head mods (photo + quote).
//   RIGHT PAGE: big photo (4) top with two photos (5, 6) below + grouped
//     captions.
//   RIGHT RAIL: stacked purple pull-quote bars, a photo, and a purple-bulleted
//     highlights mod.
//
// Spread: 16" x 10.5".

const {
  inToPx, ptToPx, escapeHtml, photoDataUri,
  isPlaceholder, pickCaption, splitQuoteIntoLines, dedupCaption,
  estimateTextHeightIn,
} = require('./utils');

function renderShareAStory(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const PURPLE = '#523D73';
  const DARK = '#1A1A1A';
  const spreadWpx = inToPx(16, dpi);
  const spreadHpx = inToPx(10.5, dpi);
  const px = (n) => `${inToPx(n, dpi)}px`;
  const pt = (n) => `${ptToPx(n, dpi)}px`;

  // ---- Photo slots ----
  // crowd=0 (B&W anchor), stacked=1,2, right big=3, right pair=4,5, rail=6,
  // talking heads=7,8,9
  const crowdSrc = photoDataUri(photos[0]);
  const stackSrcs = [1, 2].map(i => photoDataUri(photos[i]));
  const rightBigSrc = photoDataUri(photos[3]);
  const rightPairSrcs = [4, 5].map(i => photoDataUri(photos[i]));
  const railSrc = photoDataUri(photos[6]);
  const headSrcs = [7, 8, 9].map(i => photoDataUri(photos[i]));

  // ---- Text ----
  const scriptWord = (pageContent.pageTitleThemeWord || pageContent.section || '').trim();
  const titleRaw = (pageContent.pageTitle || pageContent.section || '').toUpperCase();
  const subtitleCandidates = [
    pageContent.subheadline,
    pageContent.record,
    ...(pageContent.highlights || []),
  ].filter(t => t && !t.includes('['));
  const subtitleText = (subtitleCandidates.find(t =>
    t.toUpperCase().trim() !== titleRaw.trim() && t.length <= 80) || '').toUpperCase();

  const bodyParagraphs = (pageContent.bodyCopy || '')
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');

  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  const quoteFontPt = 11;
  let railQuote = null;
  let railQuoteLines = [];
  for (const q of quotes) {
    const lines = splitQuoteIntoLines(q.text, 2.1, quoteFontPt);
    if (lines.length > 0 && lines.length <= 7) { railQuote = q; railQuoteLines = lines; break; }
  }
  // Talking heads pair remaining quotes with photos 7-9 (photo optional).
  const headQuotes = quotes.filter(q => q !== railQuote).slice(0, 3);

  const highlights = (pageContent.highlights || []).filter(h => h && !h.includes('[')).slice(0, 3);

  // ---- Captions ----
  const capText = (i) => {
    const c = dedupCaption(pickCaption(pageContent.photoCaptions, i));
    return c && (c.lead || c.body) ? [c.lead, c.body].filter(Boolean).join(' ') : null;
  };
  const groupCaps = (idxs) => idxs.map((photoIdx, i) => {
    const t = capText(photoIdx);
    return t ? `<span class="gcap"><b>${i + 1}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>` : null;
  }).filter(Boolean).join('\n');
  const leftCaps = groupCaps([0, 1, 2]);
  const rightCaps = [3, 4, 5].map((photoIdx, i) => {
    const t = capText(photoIdx);
    return t ? `<span class="gcap"><b>${i + 4}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>` : null;
  }).filter(Boolean).join('\n');

  // ---- Dynamic vertical layout (kills fixed-gap negative space) ----
  // Left block: photos start right below the measured body copy and stretch
  // down to the caption anchor (or further when there are no captions).
  const bodyEstH = estimateTextHeightIn(pageContent.bodyCopy, 3.08, 9, { columns: 2 });
  const crowdY = Math.min(4.0, Math.max(2.6, 2.0 + bodyEstH + 0.25));
  const leftBlockBottom = leftCaps ? 7.12 : 7.9;
  const crowdH = leftBlockBottom - 0.05 - crowdY;
  const stackH = (crowdH - 0.12) / 2;
  const stack2Y = crowdY + stackH + 0.12;
  // Right pair: taller when there are no captions to show beneath them.
  const rightPairH = rightCaps ? 2.2 : 3.55;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;0,700&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${spreadWpx}px; height: ${spreadHpx}px;
    background: white;
    font-family: 'Source Sans Pro', sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    overflow: hidden;
  }
  .spread { position: relative; width: ${spreadWpx}px; height: ${spreadHpx}px; }

  /* Title block */
  .script-accent {
    position: absolute;
    left: ${px(0.85)}; top: ${px(0.28)};
    font-family: 'Dancing Script', cursive;
    font-size: ${pt(22)};
    color: ${PURPLE};
    transform: rotate(-3deg);
    z-index: 3;
  }
  .big-title {
    position: absolute;
    left: ${px(0.75)}; top: ${px(0.78)};
    width: ${px(6.6)};
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-size: ${pt(26)};
    line-height: 1.05;
    color: ${DARK};
  }
  .subtitle-bar {
    position: absolute;
    left: ${px(0.75)}; top: ${px(1.42)};
    display: inline-block;
    background: ${PURPLE};
    color: white;
    font-weight: 700;
    font-size: ${pt(10.5)};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: ${px(0.05)} ${px(0.12)};
    max-width: ${px(6.6)};
  }

  /* Body copy 2-col */
  .body-copy {
    position: absolute;
    left: ${px(0.75)}; top: ${px(2.0)};
    width: ${px(6.4)}; height: ${px(1.85)};
    font-size: ${pt(9)};
    line-height: 1.42;
    color: ${DARK};
    column-count: 2;
    column-gap: ${px(0.25)};
    overflow: hidden;
  }
  .body-copy p { margin-bottom: ${px(0.08)}; }

  /* Left photo block */
  .crowd {
    position: absolute;
    left: ${px(0.75)}; top: ${px(crowdY)};
    width: ${px(4.3)}; height: ${px(crowdH)};
    object-fit: cover;
    filter: grayscale(1) contrast(1.05);
  }
  .stack-1, .stack-2 {
    position: absolute;
    left: ${px(5.2)};
    width: ${px(1.95)}; height: ${px(stackH)};
    object-fit: cover;
  }
  .stack-1 { top: ${px(crowdY)}; }
  .stack-2 { top: ${px(stack2Y)}; }
  .left-caps {
    position: absolute;
    left: ${px(0.75)}; top: ${px(7.12)};
    width: ${px(6.4)}; height: ${px(0.75)};
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

  /* Bottom talking-heads band */
  .angle-header {
    position: absolute;
    left: ${px(0.75)}; top: ${px(8.05)};
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-size: ${pt(14)};
    color: ${DARK};
    text-transform: uppercase;
  }
  .angle-header .accent { font-style: italic; font-weight: 700; }
  .angle-bar {
    position: absolute;
    left: ${px(2.9)}; top: ${px(8.02)};
    display: inline-block;
    background: ${PURPLE};
    color: white;
    font-weight: 700;
    font-size: ${pt(10)};
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: ${px(0.05)} ${px(0.12)};
    max-width: ${px(9.5)};
  }
  .head-mod {
    position: absolute;
    top: ${px(8.6)};
    width: ${px(3.6)}; height: ${px(1.7)};
    display: flex;
    gap: ${px(0.12)};
  }
  .head-mod img {
    width: ${px(1.45)}; height: 100%;
    object-fit: cover;
    flex: none;
  }
  .head-mod .quote {
    flex: 1;
    font-size: ${pt(8)};
    line-height: 1.35;
    color: ${DARK};
    overflow: hidden;
  }
  .head-mod .quote .attr {
    display: block;
    margin-top: ${px(0.04)};
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: ${pt(7.5)};
    color: ${PURPLE};
  }

  /* Right page photos */
  .right-big {
    position: absolute;
    left: ${px(8.2)}; top: ${px(0.4)};
    width: ${px(4.55)}; height: ${px(3.3)};
    object-fit: cover;
  }
  .right-pair-1, .right-pair-2 {
    position: absolute;
    top: ${px(3.84)};
    width: ${px(2.21)}; height: ${px(rightPairH)};
    object-fit: cover;
  }
  .right-pair-1 { left: ${px(8.2)}; }
  .right-pair-2 { left: ${px(10.54)}; }
  .right-caps {
    position: absolute;
    left: ${px(8.2)}; top: ${px(6.2)};
    width: ${px(4.55)}; height: ${px(1.4)};
    font-size: ${pt(7.5)};
    line-height: 1.35;
    color: ${DARK};
    column-count: 2;
    column-gap: ${px(0.2)};
    overflow: hidden;
  }

  /* Right rail */
  .rail-quote {
    position: absolute;
    left: ${px(13.1)}; top: ${px(0.4)};
    width: ${px(2.4)};
    z-index: 3;
  }
  .rail-quote .quote-line {
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
  .rail-quote .quote-attr {
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: ${pt(9)};
    color: ${DARK};
    margin-top: ${px(0.04)};
  }
  .rail-photo {
    position: absolute;
    left: ${px(13.1)};
    width: ${px(2.4)}; height: ${px(2.3)};
    object-fit: cover;
  }
  .rail-highlights {
    position: absolute;
    left: ${px(13.1)};
    width: ${px(2.4)};
  }
  .rail-highlights .hl-header {
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-size: ${pt(11)};
    color: ${DARK};
    text-transform: uppercase;
    margin-bottom: ${px(0.08)};
    line-height: 1.15;
  }
  .rail-highlights .hl-item {
    position: relative;
    font-size: ${pt(8)};
    line-height: 1.35;
    color: ${DARK};
    padding-left: ${px(0.18)};
    margin-bottom: ${px(0.07)};
  }
  .rail-highlights .hl-item::before {
    content: '';
    position: absolute;
    left: 0; top: ${px(0.035)};
    width: ${px(0.08)}; height: ${px(0.08)};
    background: ${PURPLE};
  }
</style>
</head>
<body>
<div class="spread">

  <!-- TITLE BLOCK -->
  ${scriptWord ? `<div class="script-accent">${escapeHtml(scriptWord)}</div>` : ''}
  ${titleRaw ? `<div class="big-title">${escapeHtml(titleRaw)}</div>` : ''}
  ${subtitleText ? `<div class="subtitle-bar">${escapeHtml(subtitleText)}</div>` : ''}

  <!-- BODY -->
  <div class="body-copy">${bodyParagraphs}</div>

  <!-- LEFT PHOTO BLOCK -->
  ${crowdSrc ? `<img class="crowd" src="${crowdSrc}" alt=""><span class="num-badge" style="left:${px(0.83)};top:${px(crowdY + crowdH - 0.32)}">1</span>` : ''}
  ${stackSrcs[0] ? `<img class="stack-1" src="${stackSrcs[0]}" alt=""><span class="num-badge" style="left:${px(5.28)};top:${px(crowdY + stackH - 0.32)}">2</span>` : ''}
  ${stackSrcs[1] ? `<img class="stack-2" src="${stackSrcs[1]}" alt=""><span class="num-badge" style="left:${px(5.28)};top:${px(stack2Y + stackH - 0.32)}">3</span>` : ''}
  ${leftCaps ? `<div class="left-caps">${leftCaps}</div>` : ''}

  <!-- BOTTOM TALKING-HEADS BAND -->
  <div class="angle-header">THIS IS <span class="accent">MY</span> ANGLE</div>
  ${subtitleText || pageContent.section ? `<div class="angle-bar">${escapeHtml(((pageContent.headline || pageContent.section || '')).toUpperCase())}</div>` : ''}
  ${headQuotes.map((q, i) => {
    const x = 0.75 + i * 3.85;
    const img = headSrcs[i] ? `<img src="${headSrcs[i]}" alt="">` : '';
    const attr = q.attribution && !isPlaceholder(q.attribution)
      ? `<span class="attr">— ${escapeHtml(q.attribution)}</span>` : '';
    return `<div class="head-mod" style="left:${px(x)}">${img}<div class="quote">"${escapeHtml(q.text.replace(/^["']|["']$/g, ''))}"${attr}</div></div>`;
  }).join('\n')}

  <!-- RIGHT PAGE PHOTOS -->
  ${rightBigSrc ? `<img class="right-big" src="${rightBigSrc}" alt=""><span class="num-badge" style="left:${px(8.28)};top:${px(3.38)}">4</span>` : ''}
  ${rightPairSrcs[0] ? `<img class="right-pair-1" src="${rightPairSrcs[0]}" alt=""><span class="num-badge" style="left:${px(8.28)};top:${px(3.84 + rightPairH - 0.32)}">5</span>` : ''}
  ${rightPairSrcs[1] ? `<img class="right-pair-2" src="${rightPairSrcs[1]}" alt=""><span class="num-badge" style="left:${px(10.62)};top:${px(3.84 + rightPairH - 0.32)}">6</span>` : ''}
  ${rightCaps ? `<div class="right-caps" style="top:${px(3.84 + rightPairH + 0.15)}">${rightCaps}</div>` : ''}

  <!-- RIGHT RAIL -->
  ${railQuoteLines.length > 0 ? `
  <div class="rail-quote">
    ${railQuoteLines.map(l => `<span class="quote-line">${escapeHtml(l)}</span>`).join('\n')}
    ${railQuote.attribution && !isPlaceholder(railQuote.attribution) ? `<div class="quote-attr">— ${escapeHtml(railQuote.attribution)}</div>` : ''}
  </div>` : ''}
  ${railSrc ? `<img class="rail-photo" src="${railSrc}" style="top:${px(0.4 + railQuoteLines.length * 0.31 + 0.45)}" alt="">` : ''}
  ${highlights.length > 0 ? `
  <div class="rail-highlights" style="top:${px(0.4 + railQuoteLines.length * 0.31 + 0.45 + (railSrc ? 2.5 : 0))}">
    <div class="hl-header">More to the story</div>
    ${highlights.map(h => `<div class="hl-item">${escapeHtml(h)}</div>`).join('\n')}
  </div>` : ''}

</div>
</body>
</html>`;
}

module.exports = { renderShareAStory };
