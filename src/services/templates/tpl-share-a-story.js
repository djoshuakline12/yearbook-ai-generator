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
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri, photoObjectPosition,
  isPlaceholder, pickCaption, splitQuoteIntoLines, dedupCaption,
  cleanAttribution, repairAspects, estimateTextHeightIn, wrapLineCount,
  mirrorLeft,
} = require('./utils');

function renderShareAStory(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const variant = options.variant || 0;
  const anchorColor = !!(variant & 1);   // bit0: anchor photo color vs B&W
  const flipQuote = !!(variant & 2);     // bit1: quote-block position flip
  const mirror = !!(variant & 4);        // bit2: whole layout flipped left↔right
  const ML = mirrorLeft(mirror);
  const bwFilter = anchorColor ? '' : 'filter: grayscale(1) contrast(1.05);';
  const PURPLE = BRAND.purple;
  const DARK = '#1A1A1A';
  const spreadWpx = inToPx(16, dpi);
  const spreadHpx = inToPx(10.5, dpi);
  const px = (n) => `${inToPx(n, dpi)}px`;
  const pt = (n) => `${ptToPx(n, dpi)}px`;

  // ---- Photo slots ----
  // Full sessions: crowd=0 (B&W anchor), stacked=1,2, right big=3, right
  // pair=4,5, rail=6, talking heads=7,8,9.
  // Sparse sessions fill the two page-anchor slots FIRST (crowd, then right
  // big) so neither page ever goes photo-less while a secondary slot eats
  // the only spare photo.
  const N = Array.isArray(photos) ? photos.length : 0;
  let slotIdx;
  if (N >= 6) {
    slotIdx = { crowd: 0, stack1: 1, stack2: 2, rightBig: 3, rightPair1: 4, rightPair2: 5, rail: 6, heads: [7, 8, 9] };
  } else {
    slotIdx = { crowd: -1, stack1: -1, stack2: -1, rightBig: -1, rightPair1: -1, rightPair2: -1, rail: -1, heads: [] };
    ['crowd', 'rightBig', 'stack1', 'stack2', 'rightPair1'].forEach((s, i) => { if (i < N) slotIdx[s] = i; });
  }
  // Shape-match photos to slots: the rail is very tall, the right pair
  // leans portrait, everything else leans landscape. Group shots stay in
  // wide slots instead of cropping to slivers.
  {
    const flat = { crowd: slotIdx.crowd, stack1: slotIdx.stack1, stack2: slotIdx.stack2,
      rightBig: slotIdx.rightBig, rightPair1: slotIdx.rightPair1, rightPair2: slotIdx.rightPair2,
      rail: slotIdx.rail,
      head0: slotIdx.heads[0] != null ? slotIdx.heads[0] : -1,
      head1: slotIdx.heads[1] != null ? slotIdx.heads[1] : -1,
      head2: slotIdx.heads[2] != null ? slotIdx.heads[2] : -1 };
    repairAspects(photos, flat, {
      crowd: 1.2, stack1: 1.2, stack2: 1.2, rightBig: 1.14,
      rightPair1: 0.82, rightPair2: 0.82, rail: 0.48,
      head0: 0.74, head1: 0.74, head2: 0.74,
    });
    slotIdx = { ...flat, heads: [flat.head0, flat.head1, flat.head2].filter(i => i >= 0) };
  }
  const at = (i) => (i >= 0 ? photoDataUri(photos[i]) : '');
  const posAt = (i) => photoObjectPosition(i >= 0 ? photos[i] : null);
  const crowdSrc = at(slotIdx.crowd);
  const crowdPos = posAt(slotIdx.crowd);
  const stackSrcs = [at(slotIdx.stack1), at(slotIdx.stack2)];
  const stackPos = [posAt(slotIdx.stack1), posAt(slotIdx.stack2)];
  const rightBigSrc = at(slotIdx.rightBig);
  const rightBigPos = posAt(slotIdx.rightBig);
  const rightPairSrcs = [at(slotIdx.rightPair1), at(slotIdx.rightPair2)];
  const rightPairPos = [posAt(slotIdx.rightPair1), posAt(slotIdx.rightPair2)];
  const railSrc = at(slotIdx.rail);
  const railPos = posAt(slotIdx.rail);
  const headSrcs = [0, 1, 2].map(i => (slotIdx.heads[i] != null ? photoDataUri(photos[slotIdx.heads[i]]) : ''));
  const headPos = [0, 1, 2].map(i => photoObjectPosition(slotIdx.heads[i] != null ? photos[slotIdx.heads[i]] : null));
  // Badge numbers exist ONLY for photos that have a caption — an
  // uncaptioned photo gets no number (a bare badge is confusing), and
  // numbering runs sequentially over captioned photos.
  const badgeNums = {};

  // ---- Text ----
  const titleRaw = (pageContent.pageTitle || pageContent.section || '').toUpperCase();
  // Script accent only when it adds something — never echo the title.
  const scriptWordRaw = (pageContent.pageTitleThemeWord || pageContent.section || '').trim();
  const scriptWord = (scriptWordRaw && scriptWordRaw.toUpperCase() !== titleRaw.trim()
    && !titleRaw.startsWith(scriptWordRaw.toUpperCase())) ? scriptWordRaw : '';
  const subtitleCandidates = [
    pageContent.subheadline,
    pageContent.record,
    // Stats & Facts lines no longer fall through to the subhead bar
    // (Josh 2026-07-30) — no bar beats a random stat as the subheading.
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

  // Highlights feed both the subtitle bar and the rail list — never show the
  // same line in both places.
  const highlights = (pageContent.highlights || [])
    .filter(h => h && !h.includes('[') && h.toUpperCase().trim() !== subtitleText.trim())
    .slice(0, 3);

  // ---- Captions ----
  const capText = (i) => {
    const c = dedupCaption(pickCaption(pageContent.photoCaptions, i));
    return c && (c.lead || c.body) ? [c.lead, c.body].filter(Boolean).join(' ') : null;
  };
  let bn = 0;
  for (const s of ['crowd', 'stack1', 'stack2', 'rightBig', 'rightPair1', 'rightPair2']) {
    if (slotIdx[s] >= 0 && capText(slotIdx[s])) badgeNums[s] = ++bn;
  }
  const groupCaps = (slots) => slots.map((s) => {
    if (!badgeNums[s]) return null;
    const t = capText(slotIdx[s]);
    return `<span class="gcap"><b>${badgeNums[s]}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>`;
  }).filter(Boolean).join('\n');
  const leftCaps = groupCaps(['crowd', 'stack1', 'stack2']);
  const rightCaps = groupCaps(['rightBig', 'rightPair1', 'rightPair2']);

  // ---- Dynamic vertical layout (kills fixed-gap negative space) ----
  // Title block flows: script → title (measured) → subtitle bar → body.
  const titleY = scriptWord ? 0.78 : 0.55;
  const titleCharsPerLine = 28; // ~26pt serif in 6.6in
  const titleLineCount = wrapLineCount(titleRaw, titleCharsPerLine) || 1;
  const subtitleY = titleY + titleLineCount * 0.42 + 0.08;
  const subtitleLineCount = subtitleText ? wrapLineCount(subtitleText, Math.floor(6.35 * (120 / 10.5 - 0.3))) : 0;
  const bodyY = subtitleText ? subtitleY + 0.14 + subtitleLineCount * 0.29 : subtitleY + 0.08;
  // Left block: photos start right below the measured body copy and stretch
  // down to the caption anchor (or further when there are no captions).
  const bodyEstH = estimateTextHeightIn(pageContent.bodyCopy, 3.08, 9, { columns: 2 });
  const crowdY = Math.min(4.3, Math.max(2.4, bodyY + bodyEstH + 0.25));
  const leftBlockBottom = leftCaps ? 7.12 : 7.9;
  const crowdH = leftBlockBottom - 0.05 - crowdY;
  const stackH = (crowdH - 0.12) / 2;
  const stack2Y = crowdY + stackH + 0.12;
  // Rail: bars + photo + highlights fill the full column height. The
  // highlights block bottom-anchors at 10.4 and the photo stretches to meet
  // it — no dead space at the rail bottom. ~0.37in per Bodoni bar.
  const railBarsH = railQuoteLines.length * 0.37 + (railQuote && railQuote.attribution ? 0.35 : 0.1);
  const hlEstH = highlights.length
    ? 0.38 + highlights.reduce((a, h) => a + Math.ceil(h.length / 34) * 0.155 + 0.08, 0)
    : 0;
  const highlightsTop = 10.4 - hlEstH;
  const railContentBottom = highlightsTop - 0.25;
  // Never stretch the rail photo beyond ~2.2x its natural height at rail
  // width — past that the crop shows a sliver of the subject, not a photo.
  const railAspect = (slotIdx.rail >= 0 && photos[slotIdx.rail] && photos[slotIdx.rail].aspectRatio) || 1.5;
  const railMaxH = Math.min(10, (2.4 / railAspect) * 2.2);
  let railQuoteTop;
  let railPhotoTop;
  let railPhotoH;
  if (flipQuote && railSrc) {
    railPhotoTop = 0.4;
    railPhotoH = Math.max(1.2, Math.min(railMaxH, railContentBottom - railBarsH - 0.35 - 0.4));
    railQuoteTop = railPhotoTop + railPhotoH + 0.35;
  } else {
    railQuoteTop = 0.4;
    railPhotoH = Math.max(1.2, Math.min(railMaxH, railContentBottom - (0.4 + railBarsH + 0.35)));
    // Bottom-anchor after the cap so any spare space sits between the bars
    // and the photo, not as a stub below it.
    railPhotoTop = railContentBottom - railPhotoH;
  }
  // Right page photos fill the full column height down to the band. Hero (4)
  // top, pair (5,6) below, captions, ending just above the talking-heads
  // band. With no pair photos the hero takes the full column height.
  const hasRightPair = !!(rightPairSrcs[0] || rightPairSrcs[1]);
  const rightCapsY = rightCaps ? 7.55 : 7.85;
  const rightBigH = hasRightPair ? 4.0 : (rightCaps ? rightCapsY - 0.15 : 7.85) - 0.4;
  const rightPairY = 0.4 + rightBigH + 0.15;
  const rightPairH = (rightCaps ? rightCapsY - 0.15 : 7.85) - rightPairY;
  // With no stacked photos the crowd photo takes the full left-block width.
  const hasStack = !!(stackSrcs[0] || stackSrcs[1]);
  const crowdW = hasStack ? 4.3 : 6.4;
  // Bottom band: quotes first, then caption-based photo mods (photos 7-9),
  // distributed edge-to-edge across the band (stops before the rail) so the
  // bottom of the spread is always full.
  const headMods = [];
  headQuotes.forEach((q, i) => headMods.push({ quoteObj: q, src: headSrcs[i] }));
  for (let i = 0; i < 3 && headMods.length < 4; i++) {
    if (headSrcs[i] && !headMods.some(m => m.src === headSrcs[i])) {
      const t = slotIdx.heads[i] != null ? capText(slotIdx.heads[i]) : null;
      if (t) headMods.push({ capOnly: t, src: headSrcs[i] });
    }
  }
  // Band mods carry TEXT, so no mod may straddle the center fold (x=8).
  // Split the band into a left-page segment and a right-page segment and
  // distribute mods between them.
  const modCount = Math.max(1, headMods.length);
  const nRight = Math.floor(headMods.length / 2);
  const nLeft = Math.max(1, headMods.length - nRight);
  const segL = { x: mirror ? 8.25 : 0.75, w: 7.0 };  // ends 0.25in clear of the fold
  const segR = { x: mirror ? 3.4 : 8.25, w: 4.35 };   // both segments fold-safe mirrored
  const headModBoxes = headMods.map((_, i) => {
    if (i < nLeft) {
      const stride = segL.w / nLeft;
      return { x: segL.x + i * stride, w: Math.min(stride - 0.25, 5.4) };
    }
    const j = i - nLeft;
    const stride = segR.w / Math.max(1, nRight);
    return { x: segR.x + j * stride, w: Math.min(stride - 0.25, 4.6) };
  });
  const headImgW = modCount <= 2 ? 2.0 : 1.45;
  // Mirrored column anchors — text stays left-aligned, columns swap sides.
  const titleColX = ML(0.75, 6.6);
  const bodyColX = ML(0.75, 6.4);
  const crowdX = ML(0.75, crowdW);
  const stackX = ML(5.2, 1.95);
  const bandX = ML(0.75, 7.15);
  const rbX = ML(8.2, 4.55);
  const rp1X = ML(8.2, 2.21);
  const rp2X = ML(10.54, 2.21);
  const railX = ML(13.1, 2.4);
  // Angle bar: a distinct teaser — never repeats the title OR the subtitle.
  const angleBarRaw = [pageContent.headline, pageContent.record, pageContent.section]
    .find(t => t && t.toUpperCase().trim() !== titleRaw.trim()
      && t.toUpperCase().trim() !== subtitleText.trim()) || '';

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

  /* Title block */
  .script-accent {
    position: absolute;
    left: ${px(titleColX + 0.1)}; top: ${px(0.28)};
    font-family: 'Caveat', cursive;
    font-size: ${pt(22)};
    color: ${PURPLE};
    transform: rotate(-3deg);
    z-index: 3;
  }
  .big-title {
    position: absolute;
    left: ${px(titleColX)}; top: ${px(titleY)};
    width: ${px(6.6)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(26)};
    line-height: 1.05;
    color: ${DARK};
  }
  .subtitle-bar {
    position: absolute;
    left: ${px(titleColX)}; top: ${px(subtitleY)};
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
    left: ${px(bodyColX)}; top: ${px(bodyY)};
    width: ${px(6.4)}; height: ${px(crowdY - bodyY - 0.15)};
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
    left: ${px(crowdX)}; top: ${px(crowdY)};
    width: ${px(crowdW)}; height: ${px(crowdH)};
    object-fit: cover;
    ${bwFilter}
  }
  .stack-1, .stack-2 {
    position: absolute;
    left: ${px(stackX)};
    width: ${px(1.95)}; height: ${px(stackH)};
    object-fit: cover;
  }
  .stack-1 { top: ${px(crowdY)}; }
  .stack-2 { top: ${px(stack2Y)}; }
  .left-caps {
    position: absolute;
    left: ${px(bodyColX)}; top: ${px(7.12)};
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
    left: ${px(bandX)}; top: ${px(8.05)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(14)};
    color: ${DARK};
    text-transform: uppercase;
  }
  .angle-header .accent { font-style: italic; font-weight: 700; }
  .angle-bar {
    position: absolute;
    left: ${px(bandX + 2.15)}; top: ${px(8.02)};
    display: inline-block;
    background: ${PURPLE};
    color: white;
    font-weight: 700;
    font-size: ${pt(10)};
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: ${px(0.05)} ${px(0.12)};
    max-width: ${px(4.85)};
  }
  .head-mod {
    position: absolute;
    top: ${px(8.5)};
    height: ${px(1.95)};
    display: flex;
    gap: ${px(0.12)};
  }
  .head-mod img {
    width: ${px(headImgW)}; height: 100%;
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
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(7.5)};
    color: ${PURPLE};
  }

  /* Right page photos */
  .right-big {
    position: absolute;
    left: ${px(rbX)}; top: ${px(0.4)};
    width: ${px(4.55)}; height: ${px(rightBigH)};
    object-fit: cover;
  }
  .right-pair-1, .right-pair-2 {
    position: absolute;
    top: ${px(rightPairY)};
    width: ${px(2.21)}; height: ${px(rightPairH)};
    object-fit: cover;
  }
  .right-pair-1 { left: ${px(rp1X)}; }
  .right-pair-2 { left: ${px(rp2X)}; }
  .right-caps {
    position: absolute;
    left: ${px(rbX)}; top: ${px(rightCapsY)};
    width: ${px(4.55)}; height: ${px(0.7)};
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
    left: ${px(railX)}; top: ${px(railQuoteTop)};
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
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(9)};
    color: ${DARK};
    margin-top: ${px(0.04)};
  }
  .rail-photo {
    position: absolute;
    left: ${px(railX)};
    width: ${px(2.4)}; height: ${px(railPhotoH)};
    object-fit: cover;
  }
  .rail-highlights {
    position: absolute;
    left: ${px(railX)};
    width: ${px(2.4)};
  }
  .rail-highlights .hl-header {
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
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
  ${crowdSrc ? `<img class="crowd" src="${crowdSrc}" style="object-position:${crowdPos}" alt="">${badgeNums.crowd ? `<span class="num-badge" style="left:${px(crowdX + 0.08)};top:${px(crowdY + crowdH - 0.32)}">${badgeNums.crowd}</span>` : ''}` : ''}
  ${stackSrcs[0] ? `<img class="stack-1" src="${stackSrcs[0]}" style="object-position:${stackPos[0]}" alt="">${badgeNums.stack1 ? `<span class="num-badge" style="left:${px(stackX + 0.08)};top:${px(crowdY + stackH - 0.32)}">${badgeNums.stack1}</span>` : ''}` : ''}
  ${stackSrcs[1] ? `<img class="stack-2" src="${stackSrcs[1]}" style="object-position:${stackPos[1]}" alt="">${badgeNums.stack2 ? `<span class="num-badge" style="left:${px(stackX + 0.08)};top:${px(stack2Y + stackH - 0.32)}">${badgeNums.stack2}</span>` : ''}` : ''}
  ${leftCaps ? `<div class="left-caps">${leftCaps}</div>` : ''}

  <!-- BOTTOM TALKING-HEADS BAND -->
  <div class="angle-header">THIS IS <span class="accent">MY</span> ANGLE</div>
  ${angleBarRaw ? `<div class="angle-bar">${escapeHtml(angleBarRaw.toUpperCase())}</div>` : ''}
  ${headMods.map((m, i) => {
    const box = headModBoxes[i];
    const img = m.src ? `<img src="${m.src}" style="object-position:${headPos[headSrcs.indexOf(m.src)] || 'center 35%'}" alt="">` : '';
    let body;
    if (m.quoteObj) {
      let text = m.quoteObj.text.replace(/^["']|["']$/g, '');
      if (text.length > 260) text = text.slice(0, 257).replace(/\s+\S*$/, '') + '…';
      const attrName = cleanAttribution(m.quoteObj.attribution);
      const attr = attrName && !isPlaceholder(attrName)
        ? `<span class="attr">— ${escapeHtml(attrName)}</span>` : '';
      body = `"${escapeHtml(text)}"${attr}`;
    } else {
      body = escapeHtml(m.capOnly);
    }
    return `<div class="head-mod" style="left:${px(box.x)};width:${px(box.w)}">${img}<div class="quote">${body}</div></div>`;
  }).join('\n')}

  <!-- RIGHT PAGE PHOTOS -->
  ${rightBigSrc ? `<img class="right-big" src="${rightBigSrc}" style="object-position:${rightBigPos}" alt="">${badgeNums.rightBig ? `<span class="num-badge" style="left:${px(rbX + 0.08)};top:${px(0.4 + rightBigH - 0.32)}">${badgeNums.rightBig}</span>` : ''}` : ''}
  ${rightPairSrcs[0] ? `<img class="right-pair-1" src="${rightPairSrcs[0]}" style="object-position:${rightPairPos[0]}" alt="">${badgeNums.rightPair1 ? `<span class="num-badge" style="left:${px(rp1X + 0.08)};top:${px(rightPairY + rightPairH - 0.32)}">${badgeNums.rightPair1}</span>` : ''}` : ''}
  ${rightPairSrcs[1] ? `<img class="right-pair-2" src="${rightPairSrcs[1]}" style="object-position:${rightPairPos[1]}" alt="">${badgeNums.rightPair2 ? `<span class="num-badge" style="left:${px(rp2X + 0.08)};top:${px(rightPairY + rightPairH - 0.32)}">${badgeNums.rightPair2}</span>` : ''}` : ''}
  ${rightCaps ? `<div class="right-caps">${rightCaps}</div>` : ''}

  <!-- RIGHT RAIL -->
  ${railQuoteLines.length > 0 ? `
  <div class="rail-quote">
    ${railQuoteLines.map(l => `<span class="quote-line">${escapeHtml(l)}</span>`).join('\n')}
    ${cleanAttribution(railQuote.attribution) && !isPlaceholder(cleanAttribution(railQuote.attribution)) ? `<div class="quote-attr">— ${escapeHtml(cleanAttribution(railQuote.attribution))}</div>` : ''}
  </div>` : ''}
  ${railSrc ? `<img class="rail-photo" src="${railSrc}" style="top:${px(railPhotoTop)};object-position:${railPos}" alt="">` : ''}
  ${highlights.length > 0 ? `
  <div class="rail-highlights" style="top:${px(highlightsTop)}">
    <div class="hl-header">More to the story</div>
    ${highlights.map(h => `<div class="hl-item">${escapeHtml(h)}</div>`).join('\n')}
  </div>` : ''}

</div>
</body>
</html>`;
}

module.exports = { renderShareAStory };
