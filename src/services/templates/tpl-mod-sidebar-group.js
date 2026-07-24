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
  inToPx, ptToPx, escapeHtml, photoDataUri, photoObjectPosition,
  isPlaceholder, pickCaption, splitQuoteIntoLines, dedupCaption,
  cleanAttribution, pickOverlayQuote, repairAspects, estimateTextHeightIn, wrapLineCount,
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
  // group hero=0, center row=1,2, right top=3,4, sidebar mods=5,6,7,8 —
  // then shape-matched: the tall center pair takes portrait photos, the
  // wide right-2 takes a landscape, so nobody gets slivered.
  const N = Array.isArray(photos) ? photos.length : 0;
  const m = { hero: 0, center1: 1, center2: 2, right1: 3, right2: 4, mod0: 5, mod1: 6, mod2: 7, mod3: 8 };
  Object.keys(m).forEach(k => { if (m[k] >= N) m[k] = -1; });
  repairAspects(photos, m, {
    hero: 0.9, center1: 0.66, center2: 0.66, right1: 1.09, right2: 1.78,
    mod0: 1.5, mod1: 1.5, mod2: 1.5, mod3: 1.5,
  });
  const at = (i) => (i >= 0 ? photoDataUri(photos[i]) : '');
  const posAt = (i) => photoObjectPosition(i >= 0 ? photos[i] : null);
  const heroSrc = at(m.hero);
  const heroPos = posAt(m.hero);
  const centerSrcs = [at(m.center1), at(m.center2)];
  const centerPos = [posAt(m.center1), posAt(m.center2)];
  const rightSrcs = [at(m.right1), at(m.right2)];
  const rightPos = [posAt(m.right1), posAt(m.right2)];
  const modSrcs = [m.mod0, m.mod1, m.mod2, m.mod3].map(at);
  const modPos = [m.mod0, m.mod1, m.mod2, m.mod3].map(posAt);

  // ---- Text ----
  const titleRaw = (pageContent.pageTitle || pageContent.section || '');
  // Script accent only when it adds something — never echo the title.
  const scriptWordRaw = (pageContent.pageTitleThemeWord || '').trim();
  const scriptWord = (scriptWordRaw
    && scriptWordRaw.toUpperCase() !== titleRaw.toUpperCase().trim()
    && !titleRaw.toUpperCase().startsWith(scriptWordRaw.toUpperCase())) ? scriptWordRaw : '';
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
  // Hero overlay bars sit on the group photo — cap at 4 bars and favor the
  // shortest quote; longer quotes go to the sidebar mods in full.
  const heroPick = pickOverlayQuote(quotes, 3.2, 11.5, 4, 10);
  const heroQuote = heroPick ? heroPick.quote : null;
  const quoteFontPt = heroPick ? heroPick.fontPt : 11.5;
  const heroQuoteLines = heroPick ? heroPick.lines : [];
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
  // Numbers exist only for captioned photos, sequential across the spread's
  // two caption groups (center 1..n, then right continues the count).
  const capNums = {};
  let capN = 0;
  for (const [key, idx] of [['center1', m.center1], ['center2', m.center2], ['right1', m.right1], ['right2', m.right2], ['hero', m.hero]]) {
    if (idx >= 0 && capText(idx)) capNums[key] = ++capN;
  }
  const groupCaps2 = (entries) => entries.map(([key, idx]) => {
    if (!capNums[key]) return null;
    return `<span class="gcap"><b>${capNums[key]}</b>&nbsp;&nbsp;${escapeHtml(capText(idx))}</span>`;
  }).filter(Boolean).join('\n');
  const centerCaps = groupCaps2([['center1', m.center1], ['center2', m.center2]]);
  const rightCaps = groupCaps2([['right1', m.right1], ['right2', m.right2], ['hero', m.hero]]);

  // Sidebar mod stack: quotes first, then caption-based mods (photo +
  // caption) to fill remaining slots so the rail never runs dry.
  const modTop = 1.55;
  const modH = 1.75;
  const sideMods = [];
  for (let i = 0; i < 4; i++) {
    if (modQuotes[i]) {
      sideMods.push({ quoteObj: modQuotes[i], src: modSrcs[i] });
    } else if (modSrcs[i]) {
      // Caption text may be junk (suppressed); a photo-only mod still
      // fills the rail better than a blank column.
      const t = m['mod' + i] >= 0 ? capText(m['mod' + i]) : null;
      sideMods.push(t ? { capOnly: t, src: modSrcs[i] } : { photoOnly: true, src: modSrcs[i] });
    }
  }
  // Mods are photo-above-text now; size the boxes to the count so four
  // still fit, then distribute over the rail height instead of clustering
  // at the top with a dead zone below.
  const modCount = sideMods.length;
  const modBoxH = modCount > 0 ? Math.min(2.45, (9.9 - modTop - Math.max(0, modCount - 1) * 0.25) / modCount) : modH;
  const modImgH = Math.min(1.3, Math.max(0.9, modBoxH - 0.75));
  const modGap = modCount > 1
    ? Math.min(2.2, Math.max(0.22, (9.7 - modTop - modCount * modBoxH) / (modCount - 1)))
    : 0.22;

  // Center column flows: title (measured) → subhead bar → body → photos.
  const titleCharsPerLine = 15; // ~24pt serif in 4.7in
  const titleLineCount = wrapLineCount(titleRaw, titleCharsPerLine) || 1;
  const subheadY = 0.75 + titleLineCount * 0.4 + 0.1;
  // The subhead bar wraps inside its 4.7" max-width — measure it, a fixed
  // one-line offset runs the body copy into the bar's second line.
  const subheadLineCount = subheadText ? wrapLineCount(subheadText, Math.floor(4.4 * (120 / 10 - 0.3))) : 0;
  const centerBodyY = subheadText ? subheadY + 0.14 + subheadLineCount * 0.28 : subheadY + 0.08;
  const bodyEstH = estimateTextHeightIn(pageContent.bodyCopy, 2.22, 9, { columns: 2 });
  const centerPhotosY = Math.min(6.0, Math.max(centerBodyY + 0.9, centerBodyY + bodyEstH + 0.25));
  const centerCapsY = 8.9;
  const centerCapsPresent = !!centerCaps;
  // No captions → photos run to the bottom margin instead of the caption anchor.
  const centerPhotoH = (centerCapsPresent ? centerCapsY - 0.15 : 10.4) - centerPhotosY;

  // Sparse fallback: no center photos leaves a hole under the body copy.
  // Fill it with an unused quote (big italic serif) or leftover highlights.
  const hasCenterPhotos = !!(centerSrcs[0] || centerSrcs[1]);
  let centerFiller = '';
  if (!hasCenterPhotos) {
    const used = new Set([heroQuote, ...sideMods.map(m => m.quoteObj).filter(Boolean)]);
    const spare = quotes.find(q => !used.has(q));
    if (spare) {
      const attr = cleanAttribution(spare.attribution);
      centerFiller = `<div class="center-filler">
        <div class="cf-quote">'${escapeHtml(spare.text.replace(/^["']|["']$/g, ''))}'</div>
        ${attr && !isPlaceholder(attr) ? `<div class="cf-attr">— ${escapeHtml(attr)}</div>` : ''}
      </div>`;
    } else {
      const spareHl = (pageContent.highlights || [])
        .filter(h => h && !h.includes('[') && h.toUpperCase().trim() !== subheadText)
        .slice(0, 3);
      if (spareHl.length) {
        centerFiller = `<div class="center-filler">
          <div class="cf-head">MORE TO THE STORY</div>
          ${spareHl.map(h => `<div class="cf-item">${escapeHtml(h)}</div>`).join('\n')}
        </div>`;
      }
    }
  }

  // Right page: when the top photos are missing, the group hero grows upward
  // to fill the page; the stray caption column is dropped with them.
  const hasRightTop = !!(rightSrcs[0] || rightSrcs[1]);
  const heroTop = hasRightTop ? 2.85 : 0.4;
  const heroH = 10.5 - heroTop;
  const showRightCaps = hasRightTop && rightCaps;

  // Overlay bars dodge the group photo's subjects (faces sit high in most
  // shots, so bars default to the bottom; horizontal side away from focalX).
  const heroFocal = (m.hero >= 0 && photos[m.hero] && photos[m.hero].focalPoint) || { focalX: 0.5, focalY: 0.35 };
  const heroOverlayTop = heroQuote
    ? (heroFocal.focalY <= 0.5
        ? 10.05 - heroQuoteLines.length * 0.375 - (heroQuote.attribution ? 0.4 : 0.1)
        : heroTop + 0.45)
    : 0;
  const heroOverlayLeft = heroFocal.focalX >= 0.55 ? 8.35
    : heroFocal.focalX <= 0.45 ? 12.0
    : (flipQuote ? 12.0 : 8.35);

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
    flex-direction: column;
    gap: ${px(0.08)};
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
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(7)};
    color: ${PURPLE};
  }
  /* Talking-head photo spans the full rail width above the quote — tiny
     0.8" thumbnails read as clutter at print size. */
  .side-mod img {
    width: 100%; height: ${px(modImgH)};
    object-fit: cover;
    flex: none;
    display: block;
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
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(24)};
    line-height: 1.08;
    color: ${DARK};
  }
  .subhead-bar {
    position: absolute;
    left: ${px(2.8)}; top: ${px(subheadY)};
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
    left: ${px(2.8)}; top: ${px(centerBodyY)};
    width: ${px(4.7)}; height: ${px(centerPhotosY - centerBodyY - 0.15)};
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
  .center-filler {
    position: absolute;
    left: ${px(2.8)}; top: ${px(centerPhotosY + 0.2)};
    width: ${px(4.2)};
  }
  .center-filler .cf-quote {
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(13)};
    line-height: 1.45;
    color: ${DARK};
  }
  .center-filler .cf-attr {
    margin-top: ${px(0.1)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-style: italic;
    font-size: ${pt(10)};
    color: ${PURPLE};
  }
  .center-filler .cf-head {
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
    font-weight: 900;
    font-size: ${pt(13)};
    color: ${DARK};
    margin-bottom: ${px(0.12)};
  }
  .center-filler .cf-item {
    font-size: ${pt(9)};
    line-height: 1.4;
    color: ${DARK};
    padding-left: ${px(0.22)};
    position: relative;
    margin-bottom: ${px(0.09)};
  }
  .center-filler .cf-item::before {
    content: '';
    position: absolute;
    left: 0; top: ${px(0.045)};
    width: ${px(0.1)}; height: ${px(0.1)};
    background: ${PURPLE};
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

  /* RIGHT TOP */
  .right-caps {
    position: absolute;
    left: ${px(8.15)}; top: ${px(0.4)};
    width: ${px(1.3)}; height: ${px(2.2)};
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
    left: ${px(7.95)}; top: ${px(heroTop)};
    width: ${px(8.05)}; height: ${px(heroH)};
    object-fit: cover;
    ${bwFilter}
  }
  .quote-overlay {
    position: absolute;
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
    font-optical-sizing: none;
    font-variation-settings: 'opsz' 9;
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
    const top = modTop + i * (modBoxH + modGap);
    if (m.photoOnly) {
      return `<div class="side-mod" style="top:${px(top)};height:${px(modBoxH)}"><img src="${m.src}" alt="" style="width:100%;height:100%;object-fit:cover;flex:none;object-position:${modPos[i]};"></div>`;
    }
    const img = m.src ? `<img src="${m.src}" style="object-position:${modPos[i]}" alt="">` : '';
    let body;
    // Text budget shrinks when a photo shares the box.
    const maxChars = Math.max(60, Math.floor(((modBoxH - (m.src ? modImgH : 0) - 0.35) / 0.141) * 33));
    if (m.quoteObj) {
      let text = m.quoteObj.text.replace(/^["']|["']$/g, '');
      if (text.length > maxChars) text = text.slice(0, maxChars - 1).replace(/\s+\S*$/, '') + '…';
      const attrName = cleanAttribution(m.quoteObj.attribution);
      const attr = attrName && !isPlaceholder(attrName)
        ? `<span class="attr">— ${escapeHtml(attrName)}</span>` : '';
      body = `"${escapeHtml(text)}"${attr}`;
    } else {
      let text = m.capOnly;
      if (text.length > maxChars) text = text.slice(0, maxChars - 1).replace(/\s+\S*$/, '') + '…';
      body = escapeHtml(text);
    }
    return `<div class="side-mod" style="top:${px(top)};height:${px(modBoxH)}">${img}<div class="quote">${body}</div></div>`;
  }).join('\n')}

  <!-- CENTER COLUMN -->
  ${scriptWord ? `<div class="script-accent">${escapeHtml(scriptWord)}</div>` : ''}
  ${titleRaw ? `<div class="center-title">${escapeHtml(titleRaw)}</div>` : ''}
  ${subheadText ? `<div class="subhead-bar">${escapeHtml(subheadText)}</div>` : ''}
  <div class="center-body">${bodyParagraphs}</div>
  ${centerSrcs[0] ? `<img class="center-1" src="${centerSrcs[0]}" style="object-position:${centerPos[0]}" alt="">${capNums.center1 ? `<span class="num-badge" style="left:${px(2.88)};top:${px(centerPhotosY + centerPhotoH - 0.32)}">${capNums.center1}</span>` : ''}` : ''}
  ${centerSrcs[1] ? `<img class="center-2" src="${centerSrcs[1]}" style="object-position:${centerPos[1]}" alt="">${capNums.center2 ? `<span class="num-badge" style="left:${px(5.3)};top:${px(centerPhotosY + centerPhotoH - 0.32)}">${capNums.center2}</span>` : ''}` : ''}
  ${centerCaps ? `<div class="center-caps">${centerCaps}</div>` : ''}
  ${centerFiller}

  <!-- RIGHT TOP -->
  ${showRightCaps ? `<div class="right-caps">${rightCaps}</div>` : ''}
  ${rightSrcs[0] ? `<img class="right-1" src="${rightSrcs[0]}" style="object-position:${rightPos[0]}" alt="">${showRightCaps && capNums.right1 ? `<span class="num-badge" style="left:${px(9.63)};top:${px(2.28)}">${capNums.right1}</span>` : ''}` : ''}
  ${rightSrcs[1] ? `<img class="right-2" src="${rightSrcs[1]}" style="object-position:${rightPos[1]}" alt="">${showRightCaps && capNums.right2 ? `<span class="num-badge" style="left:${px(12.16)};top:${px(2.28)}">${capNums.right2}</span>` : ''}` : ''}

  <!-- GROUP HERO -->
  ${heroSrc ? `<img class="hero" src="${heroSrc}" style="object-position:${heroPos}" alt="">${showRightCaps && capNums.hero ? `<span class="num-badge" style="left:${px(8.03)};top:${px(10.1)}">${capNums.hero}</span>` : ''}` : ''}
  ${heroQuoteLines.length > 0 ? `
  <div class="quote-overlay" style="left:${px(heroOverlayLeft)};top:${px(heroOverlayTop)}">
    ${heroQuoteLines.map(l => `<span class="quote-line">${escapeHtml(l)}</span>`).join('\n')}
    ${cleanAttribution(heroQuote.attribution) && !isPlaceholder(cleanAttribution(heroQuote.attribution)) ? `<div class="quote-attr">—${escapeHtml(cleanAttribution(heroQuote.attribution))}</div>` : ''}
  </div>` : ''}

</div>
</body>
</html>`;
}

module.exports = { renderModSidebarGroup };
