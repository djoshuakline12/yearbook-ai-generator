// Spread quality score (0-100) with a per-dimension breakdown.
// Shared by the spread editor (toolbar badge) and quality-check.js.
//
// input: {
//   photoCount, captionedCount,
//   aspects: [w/h...], minLongSide,   // smallest photo's long side in px
//   bodyLen, quoteCount, hasTagline, statsCount,
//   holdFlags: [..]                   // audit flags that block/degrade
// }

function scoreSpread(x) {
  const parts = {};

  // Photos — 35: count 15, shape mix 10, resolution 10
  parts.photoCount = x.photoCount >= 5 && x.photoCount <= 13 ? 15
    : x.photoCount >= 3 ? 8 : 0;
  const hasPortrait = x.aspects.some(a => a < 0.95);
  const hasLandscape = x.aspects.some(a => a > 1.15);
  parts.shapeMix = x.photoCount === 0 ? 0 : (hasPortrait && hasLandscape ? 10 : 4);
  parts.resolution = x.photoCount === 0 ? 0
    : x.minLongSide >= 1200 ? 10 : x.minLongSide >= 800 ? 6 : 2;

  // Captions — 25 (coverage of the photos that print)
  parts.captions = x.photoCount === 0 ? 0
    : Math.round((x.captionedCount / x.photoCount) * 25);

  // Copy — 25: body 10, quotes 10, tagline 5
  parts.body = x.bodyLen >= 400 ? 10 : x.bodyLen >= 200 ? 6 : 2;
  parts.quotes = x.quoteCount >= 2 ? 10 : x.quoteCount === 1 ? 5 : 0;
  parts.tagline = x.hasTagline ? 5 : 0;

  // Extras — 15: stats 5, clean audit 10
  parts.stats = x.statsCount > 0 ? 5 : 0;
  const holds = (x.holdFlags || []).filter(f => /NO PHOTOS|NEEDS|NO COPY/.test(f)).length;
  const minor = (x.holdFlags || []).length - holds;
  parts.clean = holds > 0 ? 0 : Math.max(0, 10 - minor * 3);

  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { score, parts };
}

// Human-readable one-liners for the weakest dimensions.
function adviceFor(parts, x) {
  const tips = [];
  if (parts.photoCount < 15) tips.push(`photo count ${x.photoCount} (5-13 ideal)`);
  if (parts.shapeMix <= 4 && x.photoCount > 0) tips.push('all photos one shape — add portrait/landscape variety');
  if (parts.resolution <= 6 && x.photoCount > 0) tips.push(`smallest photo ${x.minLongSide}px — low for print`);
  if (parts.captions < 25 && x.photoCount > 0) tips.push(`${x.photoCount - x.captionedCount} photo(s) uncaptioned`);
  if (parts.body < 10) tips.push(`body copy ${x.bodyLen} chars (400+ reads best)`);
  if (parts.quotes < 10) tips.push(`${x.quoteCount} quote(s) (2-3 ideal)`);
  if (!x.hasTagline) tips.push('no tagline under the title');
  if (parts.stats === 0) tips.push('no Stats & Facts');
  if (parts.clean < 10) tips.push('audit flags open');
  return tips;
}

module.exports = { scoreSpread, adviceFor };
