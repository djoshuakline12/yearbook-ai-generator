// TEMPLATE 6 — SPLIT ACADEMIC SPREAD
//
// Two subjects share one 16" x 10.5" spread, one 8" x 10.5" page each —
// the classic academics-section treatment for classes that don't carry a
// full spread of photos. Mirrored composition: text columns sit on the
// OUTER edges, photo stacks face the gutter.
//
// Each half: purple section chip -> serif title (auto-shrink) -> body copy
// -> bottom-anchored italic quote | hero photo + two smalls + numbered
// grouped captions (numbering restarts per half — physically separate pages).
//
// pageContent contract (assembled by scripts/generate-from-pack.js pair mode):
//   { split: [contentA, contentB], photoSplit: <count of half-A photos> }
// where each content = { title, section, bodyCopy, quotes, photoCaptions }
// with photoCaptions indexed RELATIVE to that half's photo slice.

const {
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri, photoObjectPosition,
  isPlaceholder, pickCaption, dedupCaption, cleanAttribution,
  estimateTextHeightIn, wrapLineCount,
} = require('./utils');

function renderSplitAcademic(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const PURPLE = BRAND.purple;
  const DARK = '#1A1A1A';
  const spreadWpx = inToPx(16, dpi);
  const spreadHpx = inToPx(10.5, dpi);
  const px = (n) => `${inToPx(n, dpi)}px`;
  const pt = (n) => `${ptToPx(n, dpi)}px`;

  const halves = pageContent.split || [];
  const splitAt = Math.max(0, Math.min(photos.length, pageContent.photoSplit || 0));
  const photoSets = [photos.slice(0, splitAt), photos.slice(splitAt)];

  // Build one half. side 0 = left page (text outer-left, photos at gutter),
  // side 1 = right page (photos at gutter, text outer-right).
  const renderHalf = (content, halfPhotos, side) => {
    if (!content) return { css: '', html: '' };
    const id = side === 0 ? 'a' : 'b';
    const textX = side === 0 ? 0.5 : 12.9;
    const photoX = side === 0 ? 3.35 : 8.45;
    const textW = 2.6;
    const photoW = 4.2;

    const titleRaw = (content.title || content.section || '').toUpperCase();
    const longestWord = titleRaw.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
    const titleFontPt = Math.max(14, Math.min(24, Math.floor(120 / (longestWord / 2.35 + 0.4))));
    const titleCharsPerLine = Math.max(4, Math.floor(2.35 * (120 / titleFontPt - 0.4)));
    const titleLineCount = wrapLineCount(titleRaw, titleCharsPerLine) || 1;

    const chipText = (content.section || '').toUpperCase();
    const chipY = 0.5;
    const titleY = chipText ? chipY + 0.42 : chipY;
    const titleH = titleLineCount * (titleFontPt * 1.12) / 72;
    const bodyY = titleY + titleH + 0.22;
    const bodyEstH = estimateTextHeightIn(content.bodyCopy, textW, 9.5, { columns: 1, lineHeight: 1.5 });

    // Quote block bottom-anchors so the text column reads deliberately
    // composed even when the body copy runs short.
    const quotes = (content.quotes || []).filter(q => q && q.text && !q.text.includes('['));
    const quote = quotes[0] || null;
    const quoteAttr = quote ? cleanAttribution(quote.attribution) : '';
    const quoteEstH = quote
      ? estimateTextHeightIn(quote.text, textW - 0.2, 10.5, { columns: 1, lineHeight: 1.4 }) + (quoteAttr ? 0.35 : 0.1)
      : 0;
    const quoteY = quote ? Math.max(bodyY + Math.max(0.8, bodyEstH) + 0.3, 9.9 - quoteEstH) : 10.5;
    const bodyH = Math.max(0.8, (quote ? quoteY - 0.25 : 9.9) - bodyY);

    // Photos: hero + up to two smalls + grouped captions.
    const srcs = halfPhotos.map(p => photoDataUri(p));
    const poss = halfPhotos.map(p => photoObjectPosition(p));
    const caps = halfPhotos.map((p, i) => {
      if (!p.captioned && p.captioned !== undefined) return null;
      const c = dedupCaption(pickCaption(content.photoCaptions, i));
      return c && (c.lead || c.body) ? [c.lead, c.body].filter(Boolean).join(' ') : null;
    });
    const capEntries = caps
      .map((t, i) => (t && srcs[i] ? `<span class="gcap"><b>${i + 1}</b>&nbsp;&nbsp;${escapeHtml(t)}</span>` : null))
      .filter(Boolean).join('\n');

    const heroH = srcs.length === 1 ? (capEntries ? 8.1 : 9.4) : 5.55;
    const smallY = 0.5 + heroH + 0.15;
    const smallH = (capEntries ? 8.75 - 0.15 : 9.9) - smallY;
    const capsY = 8.75;

    const css = `
  .chip-${id} {
    position: absolute; left: ${px(textX)}; top: ${px(chipY)};
    display: inline-block; background: ${PURPLE}; color: white;
    font-weight: 700; font-size: ${pt(9.5)}; text-transform: uppercase;
    letter-spacing: 0.05em; padding: ${px(0.04)} ${px(0.1)};
    max-width: ${px(textW)};
  }
  .title-${id} {
    position: absolute; left: ${px(textX)}; top: ${px(titleY)};
    width: ${px(textW)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none; font-variation-settings: 'opsz' 9;
    font-weight: 900; font-size: ${pt(titleFontPt)};
    line-height: 1.12; color: ${DARK};
  }
  .body-${id} {
    position: absolute; left: ${px(textX)}; top: ${px(bodyY)};
    width: ${px(textW)}; height: ${px(bodyH)};
    font-size: ${pt(9.5)}; line-height: 1.5; color: ${DARK};
    overflow: hidden;
  }
  .body-${id} p { margin-bottom: ${px(0.09)}; }
  .quote-${id} {
    position: absolute; left: ${px(textX)}; top: ${px(quoteY)};
    width: ${px(textW)};
    border-left: ${px(0.035)} solid ${PURPLE};
    padding-left: ${px(0.16)};
    font-family: 'Bodoni Moda', serif;
    font-optical-sizing: none; font-variation-settings: 'opsz' 9;
    font-style: italic; font-size: ${pt(10.5)}; line-height: 1.4;
    color: ${DARK};
  }
  .quote-${id} .attr {
    display: block; margin-top: ${px(0.08)};
    font-size: ${pt(8.5)}; color: ${PURPLE};
  }
  .hero-${id} {
    position: absolute; left: ${px(photoX)}; top: ${px(0.5)};
    width: ${px(photoW)}; height: ${px(heroH)};
    object-fit: cover;
  }
  .small-${id}-1, .small-${id}-2 {
    position: absolute; top: ${px(smallY)}; height: ${px(smallH)};
    object-fit: cover;
  }
  .small-${id}-1 { left: ${px(photoX)}; width: ${px(srcs.length >= 3 ? 2.05 : photoW)}; }
  .small-${id}-2 { left: ${px(photoX + 2.15)}; width: ${px(2.05)}; }
  .caps-${id} {
    position: absolute; left: ${px(photoX)}; top: ${px(capsY)};
    width: ${px(photoW)}; height: ${px(1.15)};
    font-size: ${pt(7.5)}; line-height: 1.35; color: ${DARK};
    column-count: 2; column-gap: ${px(0.18)}; overflow: hidden;
  }`;

    const badge = (n, x, y) => capEntries
      ? `<span class="num-badge" style="left:${px(x)};top:${px(y)}">${n}</span>` : '';
    const html = `
  ${chipText ? `<div class="chip-${id}">${escapeHtml(chipText)}</div>` : ''}
  ${titleRaw ? `<div class="title-${id}">${escapeHtml(titleRaw)}</div>` : ''}
  <div class="body-${id}">${(content.bodyCopy || '').split(/\n\s*\n/).filter(p => p.trim()).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('')}</div>
  ${quote ? `<div class="quote-${id}">'${escapeHtml(quote.text.replace(/^["']|["']$/g, ''))}'${quoteAttr && !isPlaceholder(quoteAttr) ? `<span class="attr">— ${escapeHtml(quoteAttr)}</span>` : ''}</div>` : ''}
  ${srcs[0] ? `<img class="hero-${id}" src="${srcs[0]}" style="object-position:${poss[0]}" alt="">${badge(1, photoX + 0.08, 0.5 + heroH - 0.32)}` : ''}
  ${srcs[1] ? `<img class="small-${id}-1" src="${srcs[1]}" style="object-position:${poss[1]}" alt="">${badge(2, photoX + 0.08, smallY + smallH - 0.32)}` : ''}
  ${srcs[2] ? `<img class="small-${id}-2" src="${srcs[2]}" style="object-position:${poss[2]}" alt="">${badge(3, photoX + 2.23, smallY + smallH - 0.32)}` : ''}
  ${capEntries ? `<div class="caps-${id}">${capEntries}</div>` : ''}`;

    return { css, html };
  };

  const a = renderHalf(halves[0], photoSets[0], 0);
  const b = renderHalf(halves[1], photoSets[1], 1);

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
  .gcap { display: block; margin-bottom: ${px(0.05)}; break-inside: avoid; }
  .gcap b { font-weight: 700; }
  .num-badge {
    position: absolute; color: white; font-weight: 700;
    font-size: ${pt(9)}; padding: 0 ${px(0.06)};
    background: rgba(0,0,0,0.55); z-index: 2;
  }
${a.css}
${b.css}
</style>
</head>
<body>
<div class="spread">
${a.html}
${b.html}
</div>
</body>
</html>`;
}

module.exports = { renderSplitAcademic };
