const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Process uploaded photos: resize for rendering while preserving quality.
 * Returns metadata about each photo (dimensions, orientation).
 */
async function processPhotos(files) {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const metadata = await sharp(file.path).metadata();

    const orientation = metadata.width >= metadata.height ? 'landscape' : 'portrait';
    const aspectRatio = metadata.width / metadata.height;

    // Resize to max 4400px on longest side — enough for a large photo
    // placement at the 600 DPI final export (a 7in-wide photo needs 4200px).
    const maxDim = 4400;
    let resizeOpts = {};
    if (metadata.width > maxDim || metadata.height > maxDim) {
      resizeOpts = metadata.width > metadata.height
        ? { width: maxDim }
        : { height: maxDim };
    }

    const processedPath = path.join(
      path.dirname(file.path),
      `processed_${i}_${path.basename(file.originalname)}`
    );

    await sharp(file.path)
      .resize(resizeOpts.width || null, resizeOpts.height || null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 95 })
      .toFile(processedPath);

    results.push({
      index: i,
      originalPath: file.path,
      processedPath,
      width: resizeOpts.width || metadata.width,
      height: resizeOpts.height || metadata.height,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      orientation,
      aspectRatio,
    });
  }

  return results;
}

/**
 * Clean up temporary files after rendering.
 */
async function cleanupFiles(photoResults) {
  for (const photo of photoResults) {
    try {
      await fs.unlink(photo.originalPath);
      await fs.unlink(photo.processedPath);
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

module.exports = { processPhotos, cleanupFiles };
