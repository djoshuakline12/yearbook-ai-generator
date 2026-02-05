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

    // Resize to max 3000px on longest side for rendering (keeps quality high for 300 DPI)
    const maxDim = 3000;
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
