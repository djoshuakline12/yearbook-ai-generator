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
    .replace(/https?:\/\/\S+/gi, '')
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

// Wrap text into uppercase lines that fit a given width at a given font size.
function wrapToLines(text, barInWidth, fontSizePt) {
  const clean = (text || '')
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
  return lines;
}

function splitQuoteIntoLines(quoteText, barInWidth, fontSizePt) {
  const lines = wrapToLines(quoteText, barInWidth, fontSizePt);
  if (lines.length > 0) {
    lines[0] = '"' + lines[0];
    lines[lines.length - 1] = lines[lines.length - 1] + '"';
  }
  return lines;
}

// De-duplicate the three caption fields, which frequently repeat the
// subject's name (title = "NIKO DIAKOS", people = "Niko Diakos (10)",
// body = "Niko Diakos (10) worships on stage").
// Returns { lead, body }: lead is the bold intro (people if present, else
// title), body is the remaining text with any repeated name prefix removed.
function dedupCaption(cap) {
  if (!cap) return null;
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  let { title, people, body } = cap;

  // Strip a leading repetition of people from the body.
  if (people && body && norm(body).startsWith(norm(people))) {
    body = body.slice(people.length).replace(/^[\s,.:—–-]+/, '');
  }
  // Title that's just the person's name again adds nothing.
  if (title && people && (norm(people).startsWith(norm(title)) || norm(title).startsWith(norm(people)))) {
    title = '';
  }
  // Strip a leading repetition of title from the body.
  if (title && body && norm(body).startsWith(norm(title))) {
    body = body.slice(title.length).replace(/^[\s,.:—–-]+/, '');
  }

  const lead = people || title || '';
  return { lead, body: body || '' };
}

// Estimate rendered height (inches) of body text at a given column width,
// font size, and column count. Used to position blocks below text without
// leaving a fixed-layout gap when the text is short.
function estimateTextHeightIn(text, colWidthIn, fontPt, { lineHeight = 1.45, columns = 1, paragraphGapIn = 0.08 } = {}) {
  const clean = (text || '').trim();
  if (!clean) return 0;
  const charsPerLine = Math.max(10, Math.floor(colWidthIn * (120 / fontPt - 0.3) * 1.15)); // body text ~15% denser than bold caps
  const paragraphs = clean.split(/\n\s*\n/).filter(p => p.trim());
  let lines = 0;
  for (const p of paragraphs) {
    lines += Math.max(1, Math.ceil(p.trim().length / charsPerLine));
  }
  const linesPerCol = Math.ceil(lines / columns);
  const lineIn = (fontPt * lineHeight) / 72;
  return linesPerCol * lineIn + Math.max(0, paragraphs.length - 1) * paragraphGapIn / columns;
}

module.exports = {
  inToPx, ptToPx, escapeHtml, photoDataUri,
  cleanCaption, isPlaceholder, pickCaption,
  splitQuoteIntoLines, wrapToLines, dedupCaption,
  estimateTextHeightIn,
};
