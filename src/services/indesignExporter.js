/**
 * InDesign Bundle Exporter
 *
 * Builds a self-contained "export bundle" from one or more sessions that
 * an InDesign JSX script can read to generate an editable .indd document.
 *
 * Bundle structure:
 *   exports/{batchName}-{timestamp}/
 *     manifest.json                # Master index — doc setup + spread list
 *     spreads/                     # One JSON file per spread
 *       001-{slug}.json
 *       002-{slug}.json
 *     links/                       # Decoded JPEG photos that InDesign links
 *       001-photo-0.jpg            # Color version
 *       001-photo-0_bw.jpg         # B&W variant (only if needed)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const { PAGE } = require('../utils/constants');
const sessionStore = require('./sessionStore');

const EXPORTS_DIR = path.join(__dirname, '..', '..', 'exports');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function slugify(s) {
  return (s || 'untitled')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function pad(n, width = 3) {
  return String(n).padStart(width, '0');
}

/**
 * Strip "data:image/jpeg;base64," prefix if present and return raw base64.
 */
function cleanBase64(b64) {
  if (!b64) return null;
  const idx = b64.indexOf('base64,');
  return idx >= 0 ? b64.slice(idx + 7) : b64;
}

/**
 * Walk a session's layout and find which photoIndexes are flagged blackAndWhite
 * by at least one element. Returns a Set of indexes.
 */
function findBwPhotoIndexes(layout) {
  const bw = new Set();
  if (!layout || !Array.isArray(layout.elements)) return bw;
  for (const el of layout.elements) {
    if (el.type === 'photo' && el.blackAndWhite && typeof el.photoIndex === 'number') {
      bw.add(el.photoIndex);
    }
  }
  return bw;
}

/**
 * Walk a session's elements and remove huge base64 strings if present
 * (we never expect them on elements, but just in case).
 */
function stripBase64FromElements(elements) {
  if (!Array.isArray(elements)) return elements;
  return elements.map(el => {
    const copy = { ...el };
    if (copy.base64) delete copy.base64;
    return copy;
  });
}

/**
 * Build a single bundle from a list of session IDs.
 *
 * Returns: { bundlePath, manifestPath, spreadCount, totalPhotos, warnings }
 */
async function buildBundle({ sessionIds, outputDir, batchName }) {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    throw new Error('sessionIds must be a non-empty array');
  }

  const baseDir = outputDir || EXPORTS_DIR;
  ensureDir(baseDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeBatch = slugify(batchName || 'bundle');
  const bundleFolder = `${safeBatch}-${timestamp}`;
  const bundlePath = path.join(baseDir, bundleFolder);

  ensureDir(bundlePath);
  ensureDir(path.join(bundlePath, 'spreads'));
  ensureDir(path.join(bundlePath, 'links'));

  const warnings = [];
  const spreads = [];
  let totalPhotos = 0;

  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];
    const session = sessionStore.getSession(sessionId);

    if (!session) {
      warnings.push(`Session ${sessionId} not found, skipping`);
      continue;
    }

    const spreadNum = i + 1;
    const numPrefix = pad(spreadNum);
    const sectionName = session.pageContent?.section || session.pageContent?.pageTitle || 'untitled';
    const slug = slugify(sectionName);

    // ----- 1. Write photos as JPEG files (and B&W variants where needed) -----
    const bwIndexes = findBwPhotoIndexes(session.layout);
    const photoLinkPaths = []; // index -> relative path (color) for layout to reference
    const bwLinkPaths = {};    // index -> relative path (B&W) when applicable

    for (let pIdx = 0; pIdx < session.photos.length; pIdx++) {
      const photo = session.photos[pIdx];
      const colorB64 = cleanBase64(photo.base64);

      if (!colorB64) {
        warnings.push(`Spread ${spreadNum}: photo ${pIdx} has no base64 data`);
        photoLinkPaths.push(null);
        continue;
      }

      const colorBuffer = Buffer.from(colorB64, 'base64');
      const colorName = `${numPrefix}-photo-${pIdx}.jpg`;
      const colorPath = path.join(bundlePath, 'links', colorName);

      try {
        fs.writeFileSync(colorPath, colorBuffer);
      } catch (err) {
        warnings.push(`Spread ${spreadNum}: failed to write photo ${pIdx}: ${err.message}`);
        photoLinkPaths.push(null);
        continue;
      }

      photoLinkPaths.push(`links/${colorName}`);
      totalPhotos++;

      // B&W variant if any element uses this photo as blackAndWhite
      if (bwIndexes.has(pIdx)) {
        const bwName = `${numPrefix}-photo-${pIdx}_bw.jpg`;
        const bwPath = path.join(bundlePath, 'links', bwName);
        try {
          await sharp(colorBuffer).grayscale().jpeg({ quality: 95 }).toFile(bwPath);
          bwLinkPaths[pIdx] = `links/${bwName}`;
        } catch (err) {
          warnings.push(`Spread ${spreadNum}: failed to write B&W variant for photo ${pIdx}: ${err.message}`);
        }
      }
    }

    // ----- 2. Rewrite layout to reference linkPath (and bwLinkPath where applicable) -----
    const rewrittenElements = stripBase64FromElements(session.layout.elements).map(el => {
      if (el.type === 'photo' && typeof el.photoIndex === 'number') {
        const link = photoLinkPaths[el.photoIndex];
        const bwLink = bwLinkPaths[el.photoIndex];
        return {
          ...el,
          linkPath: link || null,
          bwLinkPath: bwLink || null,
        };
      }
      return el;
    });

    const exportedLayout = {
      ...session.layout,
      elements: rewrittenElements,
    };

    // ----- 3. Write per-spread JSON -----
    const spreadFile = `${numPrefix}-${slug}.json`;
    const spreadPath = path.join(bundlePath, 'spreads', spreadFile);
    const spreadDoc = {
      sessionId: session.id,
      sourceCreatedAt: session.createdAt,
      sourceUpdatedAt: session.updatedAt,
      pageType: session.pageType,
      pageContent: session.pageContent,
      theme: session.theme,
      photos: session.photos.map((p, idx) => ({
        index: p.index,
        linkPath: photoLinkPaths[idx] || null,
        bwLinkPath: bwLinkPaths[idx] || null,
        width: p.width,
        height: p.height,
        aspectRatio: p.aspectRatio,
        orientation: p.orientation,
        focalPoint: p.focalPoint,
      })),
      layout: exportedLayout,
    };

    fs.writeFileSync(spreadPath, JSON.stringify(spreadDoc, null, 2));

    // ----- 4. Add to manifest -----
    spreads.push({
      index: spreadNum,
      sessionId: session.id,
      pageType: session.pageType,
      layoutFile: `spreads/${spreadFile}`,
      section: session.pageContent?.section || null,
      pageTitle: session.pageContent?.pageTitle || null,
      folio: session.pageContent?.folio || null,
      photoFiles: photoLinkPaths.filter(Boolean),
      bwPhotoFiles: Object.values(bwLinkPaths),
    });
  }

  // ----- 5. Write manifest.json -----
  const theme = sessions(sessionIds)?.theme || {};
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    batchName: safeBatch,
    documentSetup: {
      pageWidthIn: PAGE.WIDTH_IN,
      pageHeightIn: PAGE.HEIGHT_IN,
      spreadWidthIn: PAGE.SPREAD_WIDTH_IN,
      bleedIn: PAGE.BLEED_IN,
      safeMarginIn: PAGE.SAFE_MARGIN_IN,
      gutterMarginIn: PAGE.GUTTER_MARGIN_IN,
      facingPages: true,
      colorSpace: 'CMYK',
    },
    theme: {
      primaryColor: '#523D73',
      primaryCMYK: { c: 43, m: 68, y: 0, k: 43 },
      headlineFont: 'Playfair Display',
      bodyFont: 'Source Sans Pro',
      scriptFont: 'Dancing Script',
      displayFont: 'Oswald',
    },
    fontsRequired: ['Playfair Display', 'Source Sans Pro', 'Dancing Script', 'Oswald'],
    spreadCount: spreads.length,
    totalPhotos,
    spreads,
    warnings,
  };

  const manifestPath = path.join(bundlePath, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    bundlePath,
    manifestPath,
    spreadCount: spreads.length,
    totalPhotos,
    warnings,
  };
}

// Helper that returns the first session it can find (used to grab a theme).
// Falls through gracefully if none of the IDs resolve.
function sessions(sessionIds) {
  for (const id of sessionIds) {
    const s = sessionStore.getSession(id);
    if (s) return s;
  }
  return null;
}

/**
 * List all sessions in a format friendly for an export picker.
 */
function listExportableSessions() {
  return sessionStore.listSessions();
}

module.exports = {
  buildBundle,
  listExportableSessions,
  EXPORTS_DIR,
};
