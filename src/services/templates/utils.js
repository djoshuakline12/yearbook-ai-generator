const fs = require('fs');

// ---------------------------------------------------------------------------
// BRAND — single source of truth for every template.
//
// purple: DCHS spot color C=43 M=68 Y=0 K=43 (screen-converted).
// Fonts: print uses AHJ Bodoni Display + AHJ Bungalow Script (Herff Jones
// fonts, not web-licensed). Web-safe stand-ins with matching metrics:
//   Bodoni Moda  ≈ AHJ Bodoni Display   (serif — headlines AND body)
//   Caveat       ≈ AHJ Bungalow Script  (script accents)
// InDesign will substitute the real AHJ fonts at print time.
// ---------------------------------------------------------------------------
const BRAND = {
  purple: '#563D82',
  dark: '#1A1A1A',
  // Display face only — headlines, pull-quote attributions, feature headers.
  // Didone hairlines are unreadable at body sizes; never use for body text.
  serif: "'Bodoni Moda', 'Playfair Display', serif",
  // Workhorse for body copy, captions, and colored bars.
  body: "'Source Sans 3', 'Source Sans Pro', sans-serif",
  script: "'Caveat', 'Dancing Script', cursive",
  fontLink: '<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=Caveat:wght@400..700&display=swap" rel="stylesheet">',
};

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
  BRAND,
  inToPx, ptToPx, escapeHtml, photoDataUri,
  cleanCaption, isPlaceholder, pickCaption,
  splitQuoteIntoLines, wrapToLines, dedupCaption,
  estimateTextHeightIn,
};
