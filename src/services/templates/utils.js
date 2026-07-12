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
// Fonts are SELF-HOSTED (src/services/templates/fonts/, OFL-licensed) and
// embedded as base64 @font-face — rendering never depends on Google Fonts
// being reachable from the server. Built once, cached for the process.
const path = require('path');
let _fontCssCache = null;
function fontFaceCss() {
  if (_fontCssCache) return _fontCssCache;
  const fontsDir = path.join(__dirname, 'fonts');
  const face = (file, family, style, weightRange) => {
    const b64 = fs.readFileSync(path.join(fontsDir, file)).toString('base64');
    return `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${b64}) format('truetype-variations');font-weight:${weightRange};font-style:${style};}`;
  };
  _fontCssCache = [
    face('BodoniModa.ttf', 'Bodoni Moda', 'normal', '400 900'),
    face('BodoniModa-Italic.ttf', 'Bodoni Moda', 'italic', '400 900'),
    face('SourceSans3.ttf', 'Source Sans 3', 'normal', '200 900'),
    face('SourceSans3-Italic.ttf', 'Source Sans 3', 'italic', '200 900'),
    face('Caveat.ttf', 'Caveat', 'normal', '400 700'),
  ].join('\n');
  return _fontCssCache;
}

const BRAND = {
  purple: '#563D82',
  dark: '#1A1A1A',
  // Display face only — headlines, pull-quote attributions, feature headers.
  // Didone hairlines are unreadable at body sizes; never use for body text.
  serif: "'Bodoni Moda', 'Playfair Display', serif",
  // Workhorse for body copy, captions, and colored bars.
  body: "'Source Sans 3', 'Source Sans Pro', sans-serif",
  script: "'Caveat', 'Dancing Script', cursive",
  // Kept the name "fontLink" — templates interpolate ${BRAND.fontLink} in
  // <head>; it now emits an inline <style> with the embedded fonts.
  get fontLink() { return `<style>\n${fontFaceCss()}\n</style>`; },
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
    // filename-ish date/batch tokens: "4.25.26js", "IMG_0234.JPG"
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}[a-z]*\b/gi, '')
    .replace(/\b[\w-]+\.(jpe?g|png|heic|gif|webp)\b/gi, '')
    // trailing frame counter "(92)" — grades run (9)–(12), leave those
    .replace(/\((\d+)\)\s*$/, (m, n) => (Number(n) >= 9 && Number(n) <= 12 ? m : ''))
    .replace(/^[\s:]+|[\s:]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Filenames and export artifacts masquerading as captions:
// "A7104110.JPG", "A7104079", "IMG_1234", "DSC01234 (2)".
function isFilenameLike(str) {
  const s = (str || '').trim();
  if (!s) return false;
  if (/\.(jpe?g|png|heic|gif|webp)\s*$/i.test(s)) return true;
  const words = s.split(/\s+/).filter(w => !/^\(\d+\)$/.test(w));
  return words.length > 0 && words.every(w => /^[A-Za-z_-]*\d{3,}[A-Za-z_-]*$/.test(w));
}

function isPlaceholder(str) {
  if (!str) return true;
  const lower = str.toLowerCase();
  return lower.includes('needs info') ||
    lower.includes('names needed') ||
    lower.includes('tbd') ||
    lower.includes('placeholder') ||
    str.includes('[') ||
    isFilenameLike(str);
}

function pickCaption(photoCaptions, idx) {
  if (!photoCaptions || photoCaptions.length === 0) return null;
  const cap = photoCaptions.find(c => c.photoIndex === idx) || photoCaptions[idx];
  if (!cap) return null;
  // A filename is worse than no caption at all — blank the field so the
  // template's fallback (hide caption / grow photo / use a quote) kicks in.
  const field = (v) => {
    const c = cleanCaption(v);
    return isFilenameLike(c) ? '' : c;
  };
  const out = { title: field(cap.captionTitle), people: field(cap.people), body: field(cap.caption) };
  if (!out.title && !out.people && !out.body) return null;
  return out;
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

// Pick the quote for a photo overlay. Overlay bars sit ON the photo, so a
// long quote walls off the subject — prefer the quote that needs the fewest
// bars at the base font size, dropping to minFontPt before giving up.
// Longer quotes stay available for text-zone mods where full length is fine.
// Returns { quote, lines, fontPt } or null.
function pickOverlayQuote(quotes, barWidthIn, fontPt, maxLines, minFontPt) {
  for (const pt of minFontPt && minFontPt !== fontPt ? [fontPt, minFontPt] : [fontPt]) {
    let best = null;
    for (const q of quotes || []) {
      if (!q || !q.text) continue;
      const lines = splitQuoteIntoLines(q.text, barWidthIn, pt);
      if (lines.length > 0 && lines.length <= maxLines) {
        if (!best || lines.length < best.lines.length) best = { quote: q, lines, fontPt: pt };
      }
    }
    if (best) return best;
  }
  return null;
}

// Per-photo crop anchor from smart-crop analysis; safe default keeps heads
// in frame when analysis is missing.
function photoObjectPosition(photo) {
  return (photo && photo.objectPosition) || 'center 35%';
}

// De-duplicate the three caption fields, which frequently repeat the
// subject's name (title = "NIKO DIAKOS", people = "Niko Diakos (10)",
// body = "Niko Diakos (10) worships on stage").
// Returns { lead, body }: lead is the bold intro (people if present, else
// title), body is the remaining text with any repeated name prefix removed.
// Remove a leading repetition of a name list from body text, tolerating
// separator drift: "A (11); B (11); C (11)" vs "A (11), B (11) and C (11)".
function stripLeadingNames(body, names) {
  if (!body || !names) return body;
  const tok = (w) => w.toLowerCase().replace(/[;,.]+$/g, '');
  const target = names.split(/\s+/).map(tok).filter(t => t && t !== 'and' && t !== '&');
  if (!target.length) return body;
  const words = body.split(/\s+/);
  let ti = 0, wi = 0;
  while (wi < words.length && ti < target.length) {
    const w = tok(words[wi]);
    if (!w || w === 'and' || w === '&') { wi++; continue; }
    if (w === target[ti]) { ti++; wi++; continue; }
    break;
  }
  if (ti < target.length) return body;
  return words.slice(wi).join(' ').replace(/^[\s,.:;—–-]+/, '');
}

function dedupCaption(cap) {
  if (!cap) return null;
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  let { title, people, body } = cap;

  // Strip a leading repetition of people from the body (exact or with
  // "; " vs ", "/"and" separator drift in name lists).
  if (people && body) body = stripLeadingNames(body, people);
  // Title that's just the person's name again adds nothing.
  if (title && people && (norm(people).startsWith(norm(title)) || norm(title).startsWith(norm(people)))) {
    title = '';
  }
  // Strip a leading repetition of title from the body.
  if (title && body) body = stripLeadingNames(body, title);

  let lead = people || title || '';
  // Collapse a doubled grade token: "Kate Dougherty (10) (10)"
  lead = lead.replace(/(\(\d+\))(\s+\1)+/g, '$1');
  if (/^\(\d+\)$/.test((body || '').trim())) body = '';
  return { lead, body: body || '' };
}

// Attributions sometimes arrive spliced: "— lasting memories. — Allie
// Bennett". Keep only the final "— Name" segment when one exists.
function cleanAttribution(attr) {
  const s = cleanCaption(attr);
  if (!s) return '';
  const parts = s.split(/\s*[—–]\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return s.replace(/^[\s—–-]+/, '').trim();
  const last = parts[parts.length - 1];
  // Only prefer the last segment if it looks like a name/credit, not a clause.
  return /^[A-Z][\w.'-]*(\s+[\w.'()-]+){0,5}$/.test(last) ? last : s;
}

// Exact line count for a greedy word-wrap at a given chars-per-line budget.
// Char-count estimates undercount when long words force early breaks
// ("CONSTRUCTING CHAMPIONS AT THE PLATE" wraps to 4 lines, not 3).
function wrapLineCount(text, charsPerLine) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let lines = 1;
  let cur = 0;
  for (const w of words) {
    if (cur === 0) cur = w.length;
    else if (cur + 1 + w.length <= charsPerLine) cur += 1 + w.length;
    else { lines++; cur = w.length; }
  }
  return lines;
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
  inToPx, ptToPx, escapeHtml, photoDataUri, photoObjectPosition,
  cleanCaption, isPlaceholder, isFilenameLike, pickCaption,
  splitQuoteIntoLines, wrapToLines, dedupCaption, cleanAttribution,
  pickOverlayQuote, estimateTextHeightIn, wrapLineCount,
};
