/**
 * Smart Crop Service
 *
 * Uses Claude's vision capabilities to analyze photos and determine
 * optimal crop positions that keep subjects (especially faces) in frame.
 *
 * Sends ALL photos in a single API call for speed.
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Analyze all photos in a single API call and return focal points
 * @param {Array} photos - Array of photo objects with processedPath
 * @returns {Array} - Photos with added focalPoint and objectPosition data
 */
async function analyzePhotosForCropping(photos) {
  if (!photos || photos.length === 0) return photos;

  try {
    console.log(`Smart Crop - Analyzing ${photos.length} photos in single batch...`);
    const startTime = Date.now();

    // Build image content blocks for all photos
    const imageBlocks = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      let base64;

      if (photo.base64) {
        base64 = photo.base64;
      } else if (photo.processedPath) {
        const imgData = fs.readFileSync(photo.processedPath);
        base64 = imgData.toString('base64');
      } else {
        continue;
      }

      imageBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64,
        }
      });
      imageBlocks.push({
        type: 'text',
        text: `Photo ${i}:`
      });
    }

    // Add the analysis prompt
    imageBlocks.push({
      type: 'text',
      text: `For each photo above, identify WHERE THE PEOPLE ARE so we can crop without cutting them out.

These photos will be displayed in rectangular containers using CSS object-fit: cover, which CROPS the photo to fill the container. The object-position value determines which part of the image stays visible.

For each photo, tell me where to anchor the crop so ALL people/faces remain visible.

Return ONLY a JSON array with one object per photo, in order:
[
  {"focalX": 0.5, "focalY": 0.3, "subject": "face", "safeZone": "top-half"},
  {"focalX": 0.4, "focalY": 0.4, "subject": "group", "safeZone": "center"},
  ...
]

- focalX: 0.0 (left edge) to 1.0 (right edge) — horizontal center of all subjects
- focalY: 0.0 (top edge) to 1.0 (bottom edge) — vertical center of all subjects
- subject: "face", "person", "group", "action", or "scene"
- safeZone: where the subjects are concentrated: "top-third", "top-half", "center", "bottom-half", "full"

IMPORTANT RULES:
- For photos with people: focalY should be at the CENTER of where their heads/faces are
- If people are in the top portion, use focalY 0.15-0.3
- If people are centered, use focalY 0.35-0.5
- If people are at bottom, use focalY 0.6-0.8
- For group photos with people spread across: use focalX 0.5 and appropriate focalY
- NEVER default to 0.5/0.5 unless people truly are dead center
- Be PRECISE — wrong values will cut people's heads off`
    });

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',  // Fast + cheap for vision analysis
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: imageBlocks,
      }],
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const focalPoints = JSON.parse(jsonMatch[0]);

      const elapsed = Date.now() - startTime;
      console.log(`Smart Crop - Got ${focalPoints.length} focal points in ${elapsed}ms`);

      // Apply focal points to photos
      return photos.map((photo, i) => {
        const fp = focalPoints[i];
        if (!fp) return photo;

        const focalX = Math.max(0, Math.min(1, fp.focalX || 0.5));
        const focalY = Math.max(0, Math.min(1, fp.focalY || 0.35));

        return {
          ...photo,
          focalPoint: { focalX, focalY, subjectType: fp.subject || 'unknown' },
          objectPosition: `${Math.round(focalX * 100)}% ${Math.round(focalY * 100)}%`,
        };
      });
    }

    console.log('Smart Crop - Failed to parse response, using defaults');
  } catch (error) {
    console.error('Smart Crop - Error:', error.message);
  }

  // Return photos with default focal points if analysis fails
  return photos.map(photo => ({
    ...photo,
    focalPoint: { focalX: 0.5, focalY: 0.35, subjectType: 'unknown' },
    objectPosition: 'center 35%',
  }));
}

module.exports = {
  analyzePhotosForCropping,
};
