const fs = require('fs');

function inToPx(inches, dpi) {
  return Math.round(inches * dpi);
}

function ptToPx(pt, dpi) {
  return Math.round((pt / 72) * dpi);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function photoDataUri(photo) {
  if (!photo) return '';
  if (photo.base64) return `data:image/jpeg;base64,${photo.base64}`;
  if (photo.processedPath) {
    try {
      const buf = fs.readFileSync(photo.processedPath);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch (e) {
      return '';
    }
  }
  return '';
}

function cleanCaption(str) {
  return (str || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^[\s:]+|[\s:]+$/g, '')
    .trim();
}

function isPlaceholder(str) {
  if (!str) return true;
  const lower = str.toLowerCase();
  return lower.includes('needs info') ||
    lower.includes('names needed') ||
    lower.includes('tbd') ||
    lower.includes('placeholder') ||
    str.includes('[');
}

function pickCaption(photoCaptions, idx) {
  if (!photoCaptions || photoCaptions.length === 0) return null;
  const cap = photoCaptions.find(c => c.photoIndex === idx) || photoCaptions[idx];
  if (!cap) return null;
  return {
    title: cleanCaption(cap.captionTitle),
    people: cleanCaption(cap.people),
    body: cleanCaption(cap.caption),
  };
}

function splitQuoteIntoLines(quoteText, barInWidth, fontSizePt) {
  const clean = (quoteText || '')
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .replace(/[.!?]+$/, '')
    .trim()
    .toUpperCase();
  if (!clean) return [];
  const charsPerInch = Math.max(2.5, (120 / fontSizePt) - 0.3);
  const budget = Math.max(8, Math.floor(barInWidth * charsPerInch));
  const words = clean.split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    if (!current) current = w;
    else if ((current.length + 1 + w.length) <= budget) current += ' ' + w;
    else { lines.push(current); current = w; }
  }
  if (current) lines.push(current);
  if (lines.length > 0) {
    lines[0] = '"' + lines[0];
    lines[lines.length - 1] = lines[lines.length - 1] + '"';
  }
  return lines;
}

module.exports = {
  inToPx, ptToPx, escapeHtml, photoDataUri,
  cleanCaption, isPlaceholder, pickCaption,
  splitQuoteIntoLines,
};
