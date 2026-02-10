const express = require('express');
const multer = require('multer');
const path = require('path');
const { processPhotos, cleanupFiles } = require('../services/imageProcessor');
const { generateLayout } = require('../services/layoutGenerator');
const { renderLayoutToHtml } = require('../services/htmlRenderer');
const { exportToFile } = require('../services/exporter');
const { MAX_PHOTOS, MAX_FILE_SIZE } = require('../utils/constants');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

// Accept any field name for photos (photos, photos[], images, files, etc.)
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
 */
router.post('/generate-spread', uploadAny.any(), async (req, res) => {
  let photoResults = [];

  try {
    // Validate inputs
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required.' });
    }

    const { topic, headline, format = 'pdf' } = req.body;
    if (!topic || !headline) {
      return res.status(400).json({ error: 'Topic and headline are required.' });
    }

    // Parse arrays and objects from form data
    const captions = parseCaptions(req.body);
    const theme = parseTheme(req.body);

    // 1. Process photos
    photoResults = await processPhotos(req.files);

    // 2. Generate AI layout
    const layout = await generateLayout({
      photos: photoResults,
      topic,
      headline,
      captions,
      theme,
    });

    // 3. Render to HTML
    const html = renderLayoutToHtml(layout, photoResults);

    // 4. Export to PDF/PNG
    const result = await exportToFile(html, format);

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

    const { topic, headline } = req.body;
    if (!topic || !headline) {
      return res.status(400).json({ error: 'Topic and headline are required.' });
    }

    const captions = parseCaptions(req.body);
    const theme = parseTheme(req.body);

    // Process photos (to get orientation/aspect ratio metadata)
    photoResults = await processPhotos(req.files);

    // Generate AI layout
    const layout = await generateLayout({
      photos: photoResults,
      topic,
      headline,
      captions,
      theme,
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

// Helper: parse captions from form data (supports captions[] or captions as JSON string)
function parseCaptions(body) {
  if (Array.isArray(body.captions)) return body.captions;
  if (typeof body.captions === 'string') {
    try { return JSON.parse(body.captions); } catch { return [body.captions]; }
  }
  // Also handle captions[0], captions[1], etc.
  const captions = [];
  for (let i = 0; i < MAX_PHOTOS; i++) {
    if (body[`captions[${i}]`]) captions.push(body[`captions[${i}]`]);
  }
  return captions;
}

// Helper: parse theme from form data
function parseTheme(body) {
  if (typeof body.theme === 'string') {
    try { return JSON.parse(body.theme); } catch { return {}; }
  }
  if (typeof body.theme === 'object' && body.theme !== null) return body.theme;
  return {};
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

module.exports = router;
