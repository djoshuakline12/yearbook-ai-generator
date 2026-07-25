// TEMPLATE 7 — TEAM DIRECTORY SPREAD
//
// Athletics directory: two sports share one 16" x 10.5" spread, one
// 8" x 10.5" page each. Official team photo(s) + full roster + coaches,
// data scraped from royalssports.com (see scripts/generate-team-pages.js).
// Invoked only explicitly (pageContent.split), never hash-assigned.
//
// Every page uses the SAME two-row geometry (Josh 2026-07-25): each row is
// one photo slot + one roster block. Squads that lack a photo or roster on
// the site render dashed placeholders / notes so proofs show exactly what
// content is still needed; slots fill on regeneration.
//
// pageContent contract:
//   { split: [sportA, sportB] }
// where each sport = {
//   sport, season,
//   squads: [ { label, roster: [{num,first,last,grade}], coachLine,
//               photoIndex, note, placeholderText }, x2 ],
// } or { filler: true, season, verse, attribution } for a closing card.
// photos = flat array of { base64, aspectRatio } indexed by photoIndex.
//
// Team photos are 800px sources — keep placements ≤ ~4.3in wide so print
// density stays near 190 DPI.

const {
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri,
} = require('./utils');

function renderTeamDirectory(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const PURPLE = BRAND.purple;
  const DARK = BRAND.dark;
  const spreadWpx = inToPx(16, dpi);
  const spreadHpx = inToPx(10.5, dpi);
  const px = (n) => `${inToPx(n, dpi)}px`;
  const pt = (n) => `${ptToPx(n, dpi)}px`;

  const rosterEntry = (p) => {
    const grade = p.grade ? ` (${p.grade})` : '';
    const num = p.num ? `<b>${escapeHtml(p.num)}</b>&nbsp;` : '';
    return `<span class="rent">${num}${escapeHtml(`${p.first} ${p.last}`.trim())}${grade}</span>`;
  };

  // One sport page. side 0 = left page, side 1 = right page. Photos sit
  // toward the gutter, rosters toward the outer edge; nothing crosses x=8.
  const renderHalf = (content, side) => {
    if (!content) return { css: '', html: '' };
    const id = side === 0 ? 'a' : 'b';
    const x0 = side === 0 ? 0.5 : 8.4;
    const pageW = 7.1;

    if (content.filler) {
      const css = `
  .fill-${id} {
    position: absolute; left: ${px(x0)}; top: ${px(0.5)};
    width: ${px(pageW)}; height: ${px(9.5)};
    background: ${PURPLE}; color: white;
    display: flex; flex-direction: column; justify-content: center;
    padding: ${px(0.9)}; text-align: center;
  }
  .fill-${id} .verse {
    font-family: ${BRAND.serif}; font-size: ${pt(20)}; line-height: 1.45;
    font-style: italic;
  }
  .fill-${id} .vattr {
    margin-top: ${px(0.45)}; font-family: ${BRAND.body};
    font-weight: 700; font-size: ${pt(11)}; letter-spacing: ${px(0.02)};
  }
  .fill-${id} .vhead {
    font-family: ${BRAND.body}; font-weight: 800; font-size: ${pt(12)};
    letter-spacing: ${px(0.03)}; margin-bottom: ${px(0.6)};
  }`;
      const html = `
  <div class="fill-${id}">
    <div class="vhead">ROYALS ATHLETICS &middot; ${escapeHtml(content.season || '')}</div>
    <div class="verse">&ldquo;${escapeHtml(content.verse || '')}&rdquo;</div>
    <div class="vattr">${escapeHtml(content.attribution || '')}</div>
  </div>`;
      return { css, html };
    }

    const title = (content.sport || '').toUpperCase();
    const squads = (content.squads || []).slice(0, 2);
    const chipY = 0.5;
    const titleY = chipY + 0.4;
    const titleFontPt = title.length > 16 ? 24 : 28;
    const contentY = titleY + 0.75;
    const rowH = (10.0 - contentY) / 2;   // identical rows on every page
    const photoH = 3.3;

    let rowsCss = '';
    let rowsHtml = '';
    squads.forEach((sq, i) => {
      const y = contentY + i * rowH;
      const ph = photos[sq.photoIndex];
      const ar = (ph && ph.aspectRatio) || 1.25;
      const photoW = Math.min(4.3, photoH * ar);
      const rosterW = pageW - photoW - 0.3;
      const photoX = side === 0 ? x0 + pageW - photoW : x0;
      const rosterX = side === 0 ? x0 : x0 + photoW + 0.3;
      const cols = sq.roster.length > 9 ? 2 : 1;
      rowsCss += `
  .r${i}-${id} .sphoto {
    position: absolute; left: ${px(photoX)}; top: ${px(y)};
    width: ${px(photoW)}; height: ${px(photoH)};
    ${ph ? 'object-fit: cover;' : `border: ${px(0.025)} dashed ${PURPLE}; background: white;
    display: flex; align-items: center; justify-content: center;
    color: ${PURPLE}; font-weight: 700; font-size: ${pt(9.5)};
    letter-spacing: ${px(0.02)}; text-align: center; padding: ${px(0.2)};`}
  }
  .r${i}-${id} .rblock {
    position: absolute; left: ${px(rosterX)}; top: ${px(y)};
    width: ${px(rosterW)}; height: ${px(rowH - 0.15)};
  }
  .r${i}-${id} .rlist { column-count: ${cols}; column-gap: ${px(0.22)}; }`;
      const photoEl = ph
        ? `<img class="sphoto" src="${photoDataUri(ph)}" alt="">`
        : `<div class="sphoto">${escapeHtml(sq.placeholderText || 'TEAM PHOTO')}</div>`;
      rowsHtml += `
  <div class="r${i}-${id}">
    ${photoEl}
    <div class="rblock">
      ${sq.label ? `<div class="slabel">${escapeHtml(sq.label)}</div>` : ''}
      ${sq.coachLine ? `<div class="coach">${escapeHtml(sq.coachLine)}</div>` : ''}
      ${sq.roster.length
        ? `<div class="rlist">${sq.roster.map(rosterEntry).join('')}</div>`
        : (sq.note ? `<div class="rnote">${escapeHtml(sq.note)}</div>` : '')}
    </div>
  </div>`;
    });

    const css = `
  .chip-${id} {
    position: absolute; left: ${px(x0)}; top: ${px(chipY)};
    background: ${PURPLE}; color: white;
    font-family: ${BRAND.body}; font-weight: 800;
    font-size: ${pt(8.5)}; letter-spacing: ${px(0.02)};
    padding: ${px(0.05)} ${px(0.14)};
  }
  .title-${id} {
    position: absolute; left: ${px(x0)}; top: ${px(titleY)};
    width: ${px(7.1)};
    font-family: ${BRAND.serif}; font-weight: 800;
    font-size: ${pt(titleFontPt)}; color: ${DARK};
    letter-spacing: ${px(0.01)};
  }
${rowsCss}`;

    const html = `
  <div class="chip-${id}">ROYALS ATHLETICS &middot; ${escapeHtml(content.season || '')}</div>
  <div class="title-${id}">${escapeHtml(title)}</div>
${rowsHtml}`;

    return { css, html };
  };

  const halves = pageContent.split || [];
  const a = renderHalf(halves[0], 0);
  const b = renderHalf(halves[1], 1);

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
  .slabel {
    font-weight: 800; color: ${BRAND.purple};
    font-size: ${pt(10.5)}; letter-spacing: ${px(0.015)};
    margin-bottom: ${px(0.06)};
  }
  .coach {
    font-style: italic; font-size: ${pt(8)}; color: ${BRAND.dark};
    margin-bottom: ${px(0.12)};
  }
  .rent {
    display: block; break-inside: avoid;
    font-size: ${pt(9)}; line-height: 1.55; color: ${BRAND.dark};
  }
  .rnote {
    font-style: italic; font-size: ${pt(8.5)}; color: ${BRAND.purple};
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

module.exports = { renderTeamDirectory };
