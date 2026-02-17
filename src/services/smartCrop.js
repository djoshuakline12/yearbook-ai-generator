/**
 * Smart Crop Service
 *
 * Uses Claude's vision capabilities to analyze photos and determine
 * optimal crop positions that keep subjects (especially faces) in frame.
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

/**
 * Analyze a photo and return the optimal focal point for cropping
 * @param {string} imageUrl - URL or base64 of the image
 * @returns {Object} - { focalX: 0-1, focalY: 0-1, hasSubject: boolean, subjectType: string }
 */
async function analyzeFocalPoint(imageUrl) {
  try {
    // Determine if it's a URL or base64
    const isBase64 = imageUrl.startsWith('data:') || !imageUrl.startsWith('http');

    const imageContent = isBase64
      ? {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageUrl.startsWith('data:')
              ? imageUrl.split(';')[0].split(':')[1]
              : 'image/jpeg',
            data: imageUrl.startsWith('data:')
              ? imageUrl.split(',')[1]
              : imageUrl,
          }
        }
      : {
          type: 'image',
          source: {
            type: 'url',
            url: imageUrl,
          }
        };

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: `Analyze this photo for cropping. Where is the main subject/focal point?

Return ONLY a JSON object with these fields:
- focalX: horizontal position 0.0 (left) to 1.0 (right) where the main subject is
- focalY: vertical position 0.0 (top) to 1.0 (bottom) where the main subject is
- subjectType: "face", "person", "group", "action", or "other"

Focus on faces first, then people, then the main action/subject.

Example: {"focalX": 0.5, "focalY": 0.3, "subjectType": "face"}`
            }
          ]
        }
      ]
    });

    const text = response.content[0].text.trim();
    // Extract JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        focalX: Math.max(0, Math.min(1, result.focalX || 0.5)),
        focalY: Math.max(0, Math.min(1, result.focalY || 0.5)),
        subjectType: result.subjectType || 'other',
        hasSubject: true,
      };
    }
  } catch (error) {
    console.error('Smart crop analysis failed:', error.message);
  }

  // Default to center-top if analysis fails
  // Most yearbook photos have faces/subjects in the upper-center area
  return {
    focalX: 0.5,
    focalY: 0.35, // Upper third - keeps faces in frame for most photos
    subjectType: 'unknown',
    hasSubject: false,
  };
}

/**
 * Batch analyze multiple photos for focal points
 * @param {Array} photos - Array of photo objects with url property
 * @returns {Array} - Photos with added focalPoint data
 */
async function analyzePhotosForCropping(photos) {
  if (!photos || photos.length === 0) return photos;

  // Process in parallel with a concurrency limit
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (photo) => {
        if (photo.focalPoint) {
          // Already analyzed
          return photo;
        }

        const focalPoint = await analyzeFocalPoint(photo.url || photo.src);
        return {
          ...photo,
          focalPoint,
          cropFit: 'cover',
          objectPosition: `${focalPoint.focalX * 100}% ${focalPoint.focalY * 100}%`,
        };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Quick focal point detection without AI (fallback)
 * Uses simple heuristics based on common photo compositions
 */
function quickFocalPointEstimate(photo) {
  // Default to rule of thirds, slightly above center
  // Most portraits and action shots have subjects in upper third
  return {
    focalX: 0.5,
    focalY: 0.35,
    subjectType: 'estimated',
    hasSubject: true,
  };
}

module.exports = {
  analyzeFocalPoint,
  analyzePhotosForCropping,
  quickFocalPointEstimate,
};
