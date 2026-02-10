const express = require('express');
const multer = require('multer');
const path = require('path');
const { processPhotos, cleanupFiles } = require('../services/imageProcessor');
const { generateLayout } = require('../services/layoutGenerator');
const { renderLayoutToHtml } = require('../services/htmlRenderer');
const { exportToFile } = require('../services/exporter');
const { MAX_PHOTOS, MAX_FILE_SIZE } = require('../utils/constants');
const { getTheme, getAllThemes } = require('../utils/themes');
const { extractThemeFromImage } = require('../services/themeExtractor');
const fs = require('fs').promises;

const router = express.Router();

/**
 * GET /api/themes
 * Returns all available preset themes for the frontend dropdown.
 */
router.get('/themes', (req, res) => {
  res.json({ themes: getAllThemes() });
});

/**
 * POST /api/extract-theme
 * Upload an example page image and AI extracts the visual theme.
 */
const themeUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `theme-${unique}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

router.post('/extract-theme', themeUpload.single('image'), async (req, res) => {
  let imagePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required.' });
    }

    imagePath = req.file.path;
    const theme = await extractThemeFromImage(imagePath);

    res.json({
      success: true,
      theme,
      message: 'Theme extracted successfully. Save this to your presets.',
    });
  } catch (err) {
    console.error('Extract theme error:', err);
    res.status(500).json({ error: 'Failed to extract theme.', details: err.message });
  } finally {
    if (imagePath) {
      try { await fs.unlink(imagePath); } catch {}
    }
  }
});

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const uploadAny = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

/**
 * POST /api/generate-spread
 * Generate a professional yearbook page or spread.
 *
 * Form fields:
 * - photos[]: Image files (required, 1-15)
 * - pageType: "page" (single 8x10.5") or "spread" (double 16x10.5")
 * - theme: Theme preset key or JSON object
 * - format: "pdf" or "png"
 *
 * Page content (all in pageContent JSON object or individual fields):
 * - section: Section name (e.g., "mens soccer", "fall dance", "robotics club")
 * - pageCategory: Optional - "sports", "events", "clubs", "academics", "people", "student-life"
 * - schoolName: School name/abbreviation (e.g., "DCHS")
 * - headline: Main headline
 * - subheadline: Optional subheadline
 * - dateOrYear: Date or year (e.g., "2024", "October 15, 2024")
 * - record: Record/stats line (e.g., "3-12" for sports, "15 members" for clubs)
 * - roster: Array of names for team/group roster
 * - rosterTitle: Custom roster title (e.g., "Team Roster:", "Members:", "Cast:")
 * - bodyCopy: Main body text (season recap, event description, etc.)
 * - quotes: Array of {text, attribution}
 * - highlights: Array of highlight items (e.g., achievements, awards, key moments)
 * - photoCaptions: Array of {photoIndex, caption, people, isPrimary}
 * - folio: Page numbers (e.g., "42-43")
 */
router.post('/generate-spread', uploadAny.any(), async (req, res) => {
  let photoResults = [];

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required.' });
    }

    const { pageType = 'page', format = 'pdf' } = req.body;

    // Parse page content
    const pageContent = parsePageContent(req.body);

    // Validate minimum content
    if (!pageContent.section && !pageContent.headline) {
      return res.status(400).json({ error: 'Section name or headline is required.' });
    }

    // Parse theme
    const theme = parseTheme(req.body);

    // 1. Process photos
    photoResults = await processPhotos(req.files);

    // 2. Generate AI layout
    const layout = await generateLayout({
      photos: photoResults,
      pageContent,
      theme,
      pageType,
    });

    // 3. Render to HTML
    const html = renderLayoutToHtml(layout, photoResults);

    // 4. Export to PDF/PNG
    const result = await exportToFile(html, format, pageType);

    // 5. Send the file
    const filename = `${slugify(pageContent.section || pageContent.headline || 'yearbook')}-page.${result.extension}`;
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': result.buffer.length,
    });
    res.send(result.buffer);
  } catch (err) {
    console.error('Generate spread error:', err);
    res.status(500).json({ error: 'Failed to generate spread.', details: err.message });
  } finally {
    if (photoResults.length > 0) {
      await cleanupFiles(photoResults);
    }
  }
});

/**
 * POST /api/preview-layout
 * Returns only the layout JSON (for frontend preview) without rendering.
 */
router.post('/preview-layout', uploadAny.any(), async (req, res) => {
  let photoResults = [];

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required.' });
    }

    const { pageType = 'page' } = req.body;
    const pageContent = parsePageContent(req.body);
    const theme = parseTheme(req.body);

    photoResults = await processPhotos(req.files);

    const layout = await generateLayout({
      photos: photoResults,
      pageContent,
      theme,
      pageType,
    });

    res.json({ layout });
  } catch (err) {
    console.error('Preview layout error:', err);
    res.status(500).json({ error: 'Failed to generate layout.', details: err.message });
  } finally {
    if (photoResults.length > 0) {
      await cleanupFiles(photoResults);
    }
  }
});

/**
 * Parse all page content from form data
 */
function parsePageContent(body) {
  // Try parsing as single JSON object first
  if (body.pageContent) {
    try {
      if (typeof body.pageContent === 'string') {
        return JSON.parse(body.pageContent);
      }
      return body.pageContent;
    } catch {}
  }

  // Parse individual fields
  return {
    section: body.section || '',
    schoolName: body.schoolName || '',
    headline: body.headline || '',
    subheadline: body.subheadline || '',
    dateOrYear: body.dateOrYear || '',
    record: body.record || '',
    roster: parseArray(body.roster),
    rosterTitle: body.rosterTitle || '',
    bodyCopy: body.bodyCopy || '',
    quotes: parseQuotes(body),
    highlights: parseArray(body.highlights),
    photoCaptions: parsePhotoCaptions(body),
    folio: body.folio || '',
    pageCategory: body.pageCategory || '',
  };
}

/**
 * Parse an array field (supports JSON string or indexed fields)
 */
function parseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return [value]; }
  }
  return [];
}

/**
 * Parse quotes from form data
 */
function parseQuotes(body) {
  if (body.quotes) {
    try {
      if (typeof body.quotes === 'string') {
        return JSON.parse(body.quotes);
      }
      if (Array.isArray(body.quotes)) return body.quotes;
    } catch {}
  }

  // Try indexed fields
  const quotes = [];
  for (let i = 0; i < 10; i++) {
    const text = body[`quotes[${i}][text]`] || body[`quotes[${i}].text`];
    const attribution = body[`quotes[${i}][attribution]`] || body[`quotes[${i}].attribution`];
    if (text) {
      quotes.push({ text, attribution: attribution || '' });
    }
  }
  return quotes;
}

/**
 * Parse photo captions from form data
 */
function parsePhotoCaptions(body) {
  if (body.photoCaptions) {
    try {
      if (typeof body.photoCaptions === 'string') {
        return JSON.parse(body.photoCaptions);
      }
      if (Array.isArray(body.photoCaptions)) return body.photoCaptions;
    } catch {}
  }

  // Try indexed fields
  const captions = [];
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const caption = body[`photoCaptions[${i}][caption]`] || body[`photoCaptions[${i}].caption`];
    const people = body[`photoCaptions[${i}][people]`] || body[`photoCaptions[${i}].people`];
    const isPrimary = body[`photoCaptions[${i}][isPrimary]`] || body[`photoCaptions[${i}].isPrimary`];

    if (caption || people) {
      captions[i] = {
        photoIndex: i,
        caption: caption || '',
        people: people || '',
        isPrimary: isPrimary === 'true' || isPrimary === true,
      };
    }
  }
  return captions;
}

/**
 * Parse theme from form data
 */
function parseTheme(body) {
  let themeInput = body.theme;

  console.log('parseTheme - Raw input:', themeInput);
  console.log('parseTheme - Type:', typeof themeInput);

  if (typeof themeInput === 'string') {
    if (!themeInput.startsWith('{')) {
      const theme = getTheme(themeInput);
      console.log('parseTheme - Resolved from string key:', themeInput, '→', theme.preset || theme.name);
      return theme;
    }
    try {
      themeInput = JSON.parse(themeInput);
      console.log('parseTheme - Parsed JSON:', themeInput);
    } catch {
      const theme = getTheme(themeInput);
      console.log('parseTheme - JSON parse failed, using as key:', themeInput);
      return theme;
    }
  }

  const theme = getTheme(themeInput);
  console.log('parseTheme - Final theme:', { preset: theme.preset, name: theme.name, hasStyleGuide: !!theme.styleGuide });
  return theme;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

module.exports = router;
