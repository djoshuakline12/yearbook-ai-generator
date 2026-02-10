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
 * Students use this to create custom presets from pages they like.
 */
const themeUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `theme-${unique}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
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

    // Extract theme using Claude vision
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
    // Clean up uploaded image
    if (imagePath) {
      try {
        await fs.unlink(imagePath);
      } catch {}
    }
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

// Accept any field name for photos
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
 * Full pipeline: upload photos → AI layout → render → export PDF/PNG
 *
 * Form fields:
 * - photos[] / photos: Image files (required)
 * - topic: Page topic string (required)
 * - headline: Main headline text (required)
 * - pageType: "page" (single) or "spread" (double) - default "page"
 * - photoDetails: JSON array of {who, whatIsHappening, caption, isPrimary} for each photo
 * - quotes: JSON array of {text, attribution}
 * - theme: Theme preset key or JSON object
 * - format: "pdf" or "png" - default "pdf"
 */
router.post('/generate-spread', uploadAny.any(), async (req, res) => {
  let photoResults = [];

  try {
    // Validate inputs
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required.' });
    }

    const { topic, headline, format = 'pdf', pageType = 'page' } = req.body;
    if (!topic || !headline) {
      return res.status(400).json({ error: 'Topic and headline are required.' });
    }

    // Parse arrays and objects from form data
    const photoDetails = parsePhotoDetails(req.body);
    const quotes = parseQuotes(req.body);
    const theme = parseTheme(req.body);

    // 1. Process photos
    photoResults = await processPhotos(req.files);

    // 2. Generate AI layout
    const layout = await generateLayout({
      photos: photoResults,
      topic,
      headline,
      photoDetails,
      quotes,
      theme,
      pageType,
    });

    // 3. Render to HTML
    const html = renderLayoutToHtml(layout, photoResults);

    // 4. Export to PDF/PNG
    const result = await exportToFile(html, format, pageType);

    // 5. Send the file
    const filename = `${slugify(topic)}-yearbook.${result.extension}`;
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
    // Clean up uploaded/processed files
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

    const { topic, headline, pageType = 'page' } = req.body;
    if (!topic || !headline) {
      return res.status(400).json({ error: 'Topic and headline are required.' });
    }

    const photoDetails = parsePhotoDetails(req.body);
    const quotes = parseQuotes(req.body);
    const theme = parseTheme(req.body);

    // Process photos (to get orientation/aspect ratio metadata)
    photoResults = await processPhotos(req.files);

    // Generate AI layout
    const layout = await generateLayout({
      photos: photoResults,
      topic,
      headline,
      photoDetails,
      quotes,
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
 * Parse photoDetails from form data
 * Supports: JSON string array, or indexed fields like photoDetails[0][who]
 */
function parsePhotoDetails(body) {
  // Try JSON string first
  if (typeof body.photoDetails === 'string') {
    try {
      return JSON.parse(body.photoDetails);
    } catch {}
  }

  // Try indexed fields
  const details = [];
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const who = body[`photoDetails[${i}][who]`] || body[`photoDetails[${i}].who`];
    const whatIsHappening = body[`photoDetails[${i}][whatIsHappening]`] || body[`photoDetails[${i}].whatIsHappening`];
    const caption = body[`photoDetails[${i}][caption]`] || body[`photoDetails[${i}].caption`];
    const isPrimary = body[`photoDetails[${i}][isPrimary]`] || body[`photoDetails[${i}].isPrimary`];

    if (who || whatIsHappening || caption) {
      details[i] = {
        who: who || '',
        whatIsHappening: whatIsHappening || '',
        caption: caption || '',
        isPrimary: isPrimary === 'true' || isPrimary === true,
      };
    }
  }

  return details;
}

/**
 * Parse quotes from form data
 * Supports: JSON string array, or indexed fields like quotes[0][text]
 */
function parseQuotes(body) {
  // Try JSON string first
  if (typeof body.quotes === 'string') {
    try {
      return JSON.parse(body.quotes);
    } catch {}
  }

  // Try indexed fields
  const quotes = [];
  for (let i = 0; i < 10; i++) {
    const text = body[`quotes[${i}][text]`] || body[`quotes[${i}].text`];
    const attribution = body[`quotes[${i}][attribution]`] || body[`quotes[${i}].attribution`];

    if (text) {
      quotes.push({
        text,
        attribution: attribution || 'Anonymous',
      });
    }
  }

  return quotes;
}

/**
 * Parse theme from form data
 * Supports: theme preset key (string), JSON string, or object
 */
function parseTheme(body) {
  let themeInput = body.theme;

  // If it's a JSON string, parse it
  if (typeof themeInput === 'string') {
    // Check if it's a preset key (no braces) or JSON
    if (!themeInput.startsWith('{')) {
      // It's a preset key like "classic-navy"
      return getTheme(themeInput);
    }
    try {
      themeInput = JSON.parse(themeInput);
    } catch {
      // Failed to parse, treat as preset key
      return getTheme(themeInput);
    }
  }

  // Now themeInput is an object (or null/undefined)
  return getTheme(themeInput);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

module.exports = router;
