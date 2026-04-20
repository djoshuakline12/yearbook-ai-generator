const express = require('express');
const multer = require('multer');
const path = require('path');
const { processPhotos, cleanupFiles } = require('../services/imageProcessor');
const { generateLayout } = require('../services/layoutGenerator');
const { renderLayoutToHtml } = require('../services/htmlRenderer');
const { exportToFile } = require('../services/exporter');
const { MAX_PHOTOS, MAX_FILE_SIZE, PAGE } = require('../utils/constants');
const { getTheme, getAllThemes } = require('../utils/themes');
const { extractThemeFromImage } = require('../services/themeExtractor');
const { polishContent, needsPolishing } = require('../services/contentPolisher');
const { analyzePhotosForCropping } = require('../services/smartCrop');
const { createSession, getSession, updateLayout, getActiveCount, getLayout, getPhotos, setLayout, listSessions, deleteSession } = require('../services/sessionStore');
const { modifyLayout } = require('../services/layoutModifier');
const fs = require('fs').promises;

// Feature flags
const USE_CONTENT_POLISHING = process.env.USE_CONTENT_POLISHING !== 'false'; // Default ON
const USE_SMART_CROP = process.env.USE_SMART_CROP !== 'false'; // Default ON - single batch call via Haiku is fast

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
    const { pageType = 'page', format = 'pdf' } = req.body;

    // Parse page content
    let pageContent = parsePageContent(req.body);
    const category = pageContent.pageCategory || 'activity';
    const photosRequired = category !== 'divider' && category !== 'index';

    if (photosRequired && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'At least one photo is required.' });
    }

    // Validate minimum content
    if (!pageContent.section && !pageContent.headline && !pageContent.pageTitle) {
      return res.status(400).json({ error: 'Section name, headline, or page title is required.' });
    }

    // Parse theme
    const theme = parseTheme(req.body);

    // 1. Process photos (if any)
    photoResults = (req.files && req.files.length > 0) ? await processPhotos(req.files) : [];

    // 1b. SMART CROP - Analyze photos for optimal focal points
    // Skip for divider/index pages that don't use photos
    if (USE_SMART_CROP && photoResults.length > 0 && category !== 'divider' && category !== 'index') {
      console.log('Smart Crop - Analyzing', photoResults.length, 'photos for focal points...');
      photoResults = await analyzePhotosForCropping(photoResults);
      console.log('Smart Crop - Analysis complete');
    }

    // 2. CONTENT POLISHING - AI enhances all text before layout
    // Skip for index pages that just have topic/page lists
    if (USE_CONTENT_POLISHING && category !== 'index') {
      console.log('Content Polishing - Starting...');
      const polishCheck = needsPolishing(pageContent);
      console.log('Content Polishing - Needs polish:', polishCheck.needsPolishing, polishCheck.issues);

      // Build photo descriptions for context
      const photoDescriptions = photoResults.map((p, i) => {
        const captionInfo = (pageContent.photoCaptions || [])[i] || {};
        return {
          index: i,
          orientation: p.orientation,
          people: captionInfo.people || '',
          caption: captionInfo.caption || '',
          isPrimary: captionInfo.isPrimary || false,
        };
      });

      // Detect page category
      const pageCategory = detectPageCategory(pageContent);

      // Polish content with AI
      pageContent = await polishContent(pageContent, photoDescriptions, pageCategory);
      console.log('Content Polishing - Complete');

      // Log quality score if available
      if (pageContent._polishingMetadata) {
        console.log('Content Polishing - Quality score:', pageContent._polishingMetadata.contentQualityScore);
        console.log('Content Polishing - Changes:', pageContent._polishingMetadata.changesApplied);
      }
    }

    // 3. Generate AI layout
    const layout = await generateLayout({
      photos: photoResults,
      pageContent,
      theme,
      pageType,
    });

    // 4. Create session (stores photos as base64 before cleanup)
    const sessionId = createSession(photoResults, layout, pageContent, theme, pageType);

    // 5. Render to HTML
    const html = renderLayoutToHtml(layout, photoResults);

    // 6. Export to PDF/PNG
    const result = await exportToFile(html, format, pageType);

    // 7. Send the file with session ID for chatbot modifications
    const filename = `${slugify(pageContent.section || pageContent.headline || 'yearbook')}-page.${result.extension}`;
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': result.buffer.length,
      'X-Session-Id': sessionId,
      'Access-Control-Expose-Headers': 'X-Session-Id',
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
    let pageContent = parsePageContent(req.body);
    const theme = parseTheme(req.body);

    photoResults = await processPhotos(req.files);

    // Apply content polishing if enabled
    if (USE_CONTENT_POLISHING) {
      const photoDescriptions = photoResults.map((p, i) => {
        const captionInfo = (pageContent.photoCaptions || [])[i] || {};
        return {
          index: i,
          orientation: p.orientation,
          people: captionInfo.people || '',
          caption: captionInfo.caption || '',
          isPrimary: captionInfo.isPrimary || false,
        };
      });

      const pageCategory = detectPageCategory(pageContent);
      pageContent = await polishContent(pageContent, photoDescriptions, pageCategory);
    }

    const layout = await generateLayout({
      photos: photoResults,
      pageContent,
      theme,
      pageType,
    });

    // Include polishing metadata in response
    res.json({
      layout,
      polishedContent: USE_CONTENT_POLISHING ? pageContent : null,
      polishingMetadata: pageContent._polishingMetadata || null,
    });
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
    coaches: parseArray(body.coaches),
    coachesTitle: body.coachesTitle || '',
    bodyCopy: body.bodyCopy || '',
    quotes: parseQuotes(body),
    highlights: parseArray(body.highlights),
    photoCaptions: parsePhotoCaptions(body),
    folio: body.folio || '',
    pageCategory: body.pageCategory || '',
    indexEntries: parseIndexEntries(body),
    pageTitle: body.pageTitle || '',
    pageTitleThemeWord: body.pageTitleThemeWord || '',
  };
}

/**
 * Parse index entries — accepts JSON array or newline-separated "Topic ... pages"
 */
function parseIndexEntries(body) {
  if (!body.indexEntries) return [];
  if (Array.isArray(body.indexEntries)) return body.indexEntries;
  if (typeof body.indexEntries === 'string') {
    try {
      const parsed = JSON.parse(body.indexEntries);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    // Parse newline-separated format: "Soccer ... 45, 67"
    return body.indexEntries.split('\n').filter(l => l.trim()).map(line => {
      const match = line.match(/^(.+?)\s*[\.…]+\s*(.+)$/);
      if (match) return { topic: match[1].trim(), pages: match[2].trim() };
      return { topic: line.trim(), pages: '' };
    });
  }
  return [];
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

/**
 * Detect page category from content
 */
function detectPageCategory(pageContent) {
  // Explicit category
  if (pageContent.pageCategory) return pageContent.pageCategory;

  const section = (pageContent.section || '').toLowerCase();
  const headline = (pageContent.headline || '').toLowerCase();
  const combined = `${section} ${headline}`;

  // Sports keywords
  if (/soccer|football|basketball|baseball|softball|volleyball|tennis|golf|track|cross country|swimming|wrestling|cheer|lacrosse|hockey|team|varsity|jv|junior varsity|coach/i.test(combined)) {
    return 'sports';
  }

  // Events keywords
  if (/dance|prom|homecoming|formal|spirit week|rally|assembly|concert|play|musical|performance|show|festival|fair|carnival|celebration|ceremony|graduation|commencement/i.test(combined)) {
    return 'events';
  }

  // Clubs/Organizations keywords
  if (/club|society|council|organization|nhs|national honor|student government|ffa|fbla|deca|key club|interact|rotary|volunteer|community service|debate|forensics|model un|robotics|stem|science olympiad/i.test(combined)) {
    return 'clubs';
  }

  // Academics keywords
  if (/class|course|department|english|math|science|history|social studies|art|music|band|choir|orchestra|drama|theatre|language|spanish|french|german|latin|ap |honors|gifted|special ed|faculty|teacher|professor/i.test(combined)) {
    return 'academics';
  }

  // People/Portraits keywords
  if (/senior|junior|sophomore|freshman|class of|portrait|headshot|staff|faculty|administration|principal|counselor/i.test(combined)) {
    return 'people';
  }

  // Student life keywords
  if (/lunch|cafeteria|hallway|locker|campus|student life|day in the life|candid|around school|moments|memories|friends|hangout/i.test(combined)) {
    return 'student-life';
  }

  // Default
  return 'general';
}

// =============================================================================
// CHATBOT: Modify layout via natural language
// =============================================================================

/**
 * POST /api/modify-layout
 * Modify an existing layout using natural language instructions.
 *
 * Request body (JSON):
 * - sessionId: Session ID from generate-spread response header
 * - message: Natural language modification (e.g., "make the title bigger")
 * - format: "png" or "pdf" (default: "png")
 */
router.post('/modify-layout', express.json(), async (req, res) => {
  try {
    const { sessionId, message, format = 'png' } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }
    if (!message) {
      return res.status(400).json({ error: 'message is required.' });
    }

    // Load session
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired. Generate a new spread first.' });
    }

    console.log(`Modify layout [${sessionId}]: "${message}"`);

    // Modify layout with AI
    const modifiedLayout = await modifyLayout(
      session.layout,
      message,
      session.theme,
      session.pageType
    );

    // Update session with new layout
    updateLayout(sessionId, modifiedLayout);

    // Re-render with session photos
    const html = renderLayoutToHtml(modifiedLayout, session.photos);
    const result = await exportToFile(html, format, session.pageType);

    // Return JSON with image data and updated layout
    res.json({
      sessionId,
      layout: modifiedLayout,
      imageBase64: result.buffer.toString('base64'),
      mimeType: result.mimeType,
      message: 'Layout modified successfully.',
    });
  } catch (err) {
    console.error('Modify layout error:', err);
    res.status(500).json({ error: 'Failed to modify layout.', details: err.message });
  }
});

// =============================================================================
// FINAL EXPORT: Ultra-high quality download
// =============================================================================

/**
 * POST /api/export-final
 * Export the current session layout at maximum quality.
 *
 * Request body (JSON):
 * - sessionId: Session ID
 * - format: "png" or "pdf" (default: "png")
 * - dpi: DPI override (default: 600, max: 1200)
 */
router.post('/export-final', express.json(), async (req, res) => {
  try {
    const { sessionId, format = 'png', dpi: requestedDpi } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired. Generate a new spread first.' });
    }

    // Validate and clamp DPI
    const dpi = Math.min(
      Math.max(requestedDpi || PAGE.FINAL_DPI, PAGE.DPI),
      PAGE.MAX_DPI
    );

    console.log(`Final export [${sessionId}]: ${dpi} DPI, format=${format}`);

    // Re-render HTML at final DPI
    const html = renderLayoutToHtml(session.layout, session.photos, { dpi });

    // Export at final quality (true PNG, higher DPI)
    const result = await exportToFile(html, format, session.pageType, {
      quality: 'final',
      dpi,
    });

    // Send as file download
    const section = session.pageContent?.section || session.pageContent?.headline || 'yearbook';
    const filename = `${slugify(section)}-final.${result.extension}`;
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': result.buffer.length,
    });
    res.send(result.buffer);
  } catch (err) {
    console.error('Final export error:', err);
    res.status(500).json({ error: 'Failed to export final quality.', details: err.message });
  }
});

// =============================================================================
// SESSION: Check session status
// =============================================================================

/**
 * GET /api/session/:id
 * Check if a session is still active and get its metadata.
 */
router.get('/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }

  res.json({
    sessionId: session.id,
    createdAt: session.createdAt,
    expiresAt: session.createdAt + 30 * 60 * 1000,
    photoCount: session.photos.length,
    pageType: session.pageType,
    section: session.pageContent?.section || null,
    activeSessions: getActiveCount(),
  });
});

// =============================================================================
// EDITOR: Live editing API endpoints
// =============================================================================

/**
 * GET /api/session/:id/layout
 * Get the current layout JSON for the editor.
 */
router.get('/session/:id/layout', (req, res) => {
  const data = getLayout(req.params.id);
  if (!data) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  res.json({ sessionId: req.params.id, ...data });
});

/**
 * GET /api/session/:id/photos
 * Get photo data for the editor (base64 + metadata).
 */
router.get('/session/:id/photos', (req, res) => {
  const photos = getPhotos(req.params.id);
  if (!photos) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  res.json({ sessionId: req.params.id, photos });
});

/**
 * PUT /api/session/:id/layout
 * Replace the layout elements and get a re-rendered preview.
 */
router.put('/session/:id/layout', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const { elements, quality = 'draft' } = req.body;
    if (!elements || !Array.isArray(elements)) {
      return res.status(400).json({ error: 'elements array is required.' });
    }

    const session = getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired.' });
    }

    // Update layout elements
    setLayout(req.params.id, elements);

    // Re-render with updated layout
    // Draft mode (default for editor): 150 DPI, fast (~1-2s)
    // Standard mode: full 450 DPI (~5-10s)
    const dpi = quality === 'draft' ? 150 : PAGE.DPI;
    const html = renderLayoutToHtml(session.layout, session.photos, { dpi });
    const result = await exportToFile(html, 'png', session.pageType, { quality });

    res.json({
      sessionId: req.params.id,
      layout: session.layout,
      imageBase64: result.buffer.toString('base64'),
      mimeType: result.mimeType,
    });
  } catch (err) {
    console.error('Update layout error:', err);
    res.status(500).json({ error: 'Failed to update layout.', details: err.message });
  }
});

/**
 * POST /api/session/:id/render-preview
 * Re-render the current layout without modifications.
 */
router.post('/session/:id/render-preview', express.json(), async (req, res) => {
  try {
    const { quality = 'draft' } = req.body || {};

    const session = getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired.' });
    }

    const dpi = quality === 'draft' ? 150 : PAGE.DPI;
    const html = renderLayoutToHtml(session.layout, session.photos, { dpi });
    const result = await exportToFile(html, 'png', session.pageType, { quality });

    res.json({
      sessionId: req.params.id,
      imageBase64: result.buffer.toString('base64'),
      mimeType: result.mimeType,
    });
  } catch (err) {
    console.error('Render preview error:', err);
    res.status(500).json({ error: 'Failed to render preview.', details: err.message });
  }
});

/**
 * POST /api/session/:id/shuffle
 * Re-generate layout with different random parameters (same content + photos).
 */
router.post('/session/:id/shuffle', express.json(), async (req, res) => {
  try {
    const session = getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired.' });
    }

    // Add random salt to force different layout params
    const shuffledContent = {
      ...session.pageContent,
      _shuffleSalt: Date.now().toString() + Math.random().toString(),
    };

    // Re-generate layout with new params
    const { generateLayout } = require('../services/layoutGenerator');
    const layout = await generateLayout({
      photos: session.photos,
      pageContent: shuffledContent,
      theme: session.theme,
      pageType: session.pageType,
    });

    // Update session with new layout
    session.layout = layout;

    // Render draft preview
    const dpi = 150;
    const html = renderLayoutToHtml(layout, session.photos, { dpi });
    const result = await exportToFile(html, 'png', session.pageType, { quality: 'draft' });

    res.json({
      sessionId: req.params.id,
      layout,
      imageBase64: result.buffer.toString('base64'),
      mimeType: result.mimeType,
    });
  } catch (err) {
    console.error('Shuffle layout error:', err);
    res.status(500).json({ error: 'Failed to shuffle layout.', details: err.message });
  }
});

/**
 * GET /api/sessions
 * List all active sessions (for "recent projects" UI).
 */
router.get('/sessions', (req, res) => {
  res.json({ sessions: listSessions() });
});

/**
 * DELETE /api/session/:id
 * Delete a session explicitly.
 */
router.delete('/session/:id', (req, res) => {
  deleteSession(req.params.id);
  res.json({ success: true });
});

module.exports = router;
