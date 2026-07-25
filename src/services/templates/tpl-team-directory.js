// TEMPLATE 7 — TEAM DIRECTORY SPREAD
//
// Athletics directory: two sports share one 16" x 10.5" spread, one
// 8" x 10.5" page each. Official team photo(s) + full roster + coaches,
// data scraped from royalssports.com (see scripts/generate-team-pages.js).
// Invoked only explicitly (pageContent.split), never hash-assigned.
//
// pageContent contract:
//   { split: [sportA, sportB] }
// where each sport = {
//   sport: 'Girls Volleyball', season: '2025-2026',
//   mode: 'dual' | 'single' | 'bg',      // dual = V+JV rows; bg = Boys/Girls
//   squads: [ { label, roster: [{first,last,grade}], coachLine, photoIndex } ],
// } or { filler: true, verse, attribution } for a closing card.
// photos = flat array of { base64, aspectRatio } indexed by photoIndex.
//
// Team photos are 800px sources — keep placements ≤ ~4.8in wide so print
// density stays near 170+ DPI.

const {
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri,
} = require('./utils');

function renderTeamDirectory(pageContent, photos, options = {}) {
  const dpi = options.dpi || 450;
  const PURPLE = BRAND.purple;
  const DARK = BRAND.dark;
  const LAVENDER = '#EFEAF6';
  const spreadWpx = inToPx(16, dpi);
  const spreadHpx = inToPx(10.5, dpi);
  const px = (n) => `${inToPx(n, dpi)}px`;
  const pt = (n) => `${ptToPx(n, dpi)}px`;

  const rosterEntry = (p) => {
    const grade = p.grade ? ` (${p.grade})` : '';
    const num = p.num ? `<b>${escapeHtml(p.num)}</b>&nbsp;` : '';
    return `<span class="rent">${num}${escapeHtml(`${p.first} ${p.last}`.trim())}${grade}</span>`;
  };

  const coachHtml = (line) => line
    ? `<div class="coach">${escapeHtml(line)}</div>` : '';

  // One sport page. side 0 = left page, side 1 = right page. Photos sit
  // toward the gutter, rosters toward the outer edge; nothing crosses x=8.
  const renderHalf = (content, side) => {
    if (!content) return { css: '', html: '' };
    const id = side === 0 ? 'a' : 'b';
    const x0 = side === 0 ? 0.5 : 8.4;   // page content origin
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
    const squads = content.squads || [];
    const chipY = 0.5;
    const titleY = chipY + 0.4;
    const titleFontPt = title.length > 16 ? 24 : 28;
    const contentY = titleY + 0.75;
    const contentH = 10.0 - contentY;

    let rowsCss = '';
    let rowsHtml = '';

    if (content.mode === 'dual') {
      // Two squads, each its own photo row: photo gutter-side, roster outer.
      const rowH = contentH / 2;
      const photoH = Math.min(3.05, rowH - 0.25);
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
  .sq${i}-${id} .sphoto {
    position: absolute; left: ${px(photoX)}; top: ${px(y)};
    width: ${px(photoW)}; height: ${px(photoH)}; object-fit: cover;
  }
  .sq${i}-${id} .rblock {
    position: absolute; left: ${px(rosterX)}; top: ${px(y)};
    width: ${px(rosterW)}; height: ${px(rowH - 0.15)};
  }
  .sq${i}-${id} .rlist { column-count: ${cols}; column-gap: ${px(0.22)}; }`;
        rowsHtml += `
  <div class="sq${i}-${id}">
    ${ph ? `<img class="sphoto" src="${photoDataUri(ph)}" alt="">` : ''}
    <div class="rblock">
      <div class="slabel">${escapeHtml(sq.label)}</div>
      ${coachHtml(sq.coachLine)}
      <div class="rlist">${sq.roster.map(rosterEntry).join('')}</div>
    </div>
  </div>`;
      });
    } else {
      // 'single' and 'bg': photo (if any) top, roster block(s) below.
      const withPhoto = squads.some(sq => photos[sq.photoIndex]);
      const ph = withPhoto ? photos[squads.find(sq => photos[sq.photoIndex]).photoIndex] : null;
      let rosterY = contentY;
      if (ph) {
        const ar = ph.aspectRatio || 1.25;
        const photoH = Math.min(3.9, 4.8 / ar);
        const photoW = Math.min(4.8, photoH * ar);
        const photoX = x0 + (pageW - photoW) / 2;
        rowsCss += `
  .tp-${id} {
    position: absolute; left: ${px(photoX)}; top: ${px(contentY)};
    width: ${px(photoW)}; height: ${px(photoH)}; object-fit: cover;
  }`;
        rowsHtml += `\n  <img class="tp-${id}" src="${photoDataUri(ph)}" alt="">`;
        rosterY = contentY + photoH + 0.3;
      }
      // No team photo on the site yet: dashed placeholder keeps the page
      // composed and marks where the photo drops in on regeneration.
      if (!ph) {
        const phW = 4.8, phH = 3.55;
        const phX = x0 + (pageW - phW) / 2;
        rowsCss += `
  .tph-${id} {
    position: absolute; left: ${px(phX)}; top: ${px(contentY)};
    width: ${px(phW)}; height: ${px(phH)};
    border: ${px(0.025)} dashed ${PURPLE}; background: white;
    display: flex; align-items: center; justify-content: center;
    color: ${PURPLE}; font-weight: 700; font-size: ${pt(10)};
    letter-spacing: ${px(0.02)};
  }`;
        rowsHtml += `\n  <div class="tph-${id}">TEAM PHOTO</div>`;
        rosterY = contentY + phH + 0.3;
      }
      if (content.mode === 'bg') {
        // Boys / Girls roster cards side by side, sized to their content.
        const cardW = (pageW - 0.3) / 2;
        squads.forEach((sq, i) => {
          const cx = x0 + i * (cardW + 0.3);
          rowsCss += `
  .bg${i}-${id} {
    position: absolute; left: ${px(cx)}; top: ${px(rosterY)};
    width: ${px(cardW)};
    background: ${LAVENDER}; padding: ${px(0.25)};
  }`;
          rowsHtml += `
  <div class="bg${i}-${id}">
    <div class="slabel">${escapeHtml(sq.label)}</div>
    ${i === 0 ? coachHtml(sq.coachLine) : ''}
    <div class="rlist-1">${sq.roster.map(rosterEntry).join('')}</div>
  </div>`;
        });
      } else {
        const sq = squads[0] || { roster: [] };
        const cols = sq.roster.length > 18 ? 3 : (sq.roster.length > 8 ? 2 : 1);
        const card = !ph;
        rowsCss += `
  .sr-${id} {
    position: absolute; left: ${px(x0)}; top: ${px(rosterY)};
    width: ${px(pageW)};
    ${card ? `background: ${LAVENDER}; padding: ${px(0.35)};` : ''}
  }
  .sr-${id} .rlist { column-count: ${card ? Math.max(cols, 2) : cols}; column-gap: ${px(0.3)}; }`;
        rowsHtml += `
  <div class="sr-${id}">
    <div class="slabel">${escapeHtml(sq.label)}</div>
    ${coachHtml(sq.coachLine)}
    <div class="rlist">${sq.roster.map(rosterEntry).join('')}</div>
  </div>`;
      }
    }

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
  ${['a', 'b'].includes(id) ? '' : ''}
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
  .rlist-1 .rent { font-size: ${pt(8.5)}; }
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
