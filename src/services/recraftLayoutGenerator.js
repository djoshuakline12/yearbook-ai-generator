/**
 * Recraft AI Layout Generator
 *
 * Uses Recraft V3 API to generate professional yearbook page layouts
 * with precise text positioning and design-aware composition.
 *
 * Recraft excels at:
 * - Accurate text rendering in images
 * - Design-aware layouts (posters, magazines)
 * - Precise element positioning via text_layouts
 */

const { PAGE } = require('../utils/constants');

// Recraft API configuration
const RECRAFT_API_URL = 'https://external.api.recraft.ai/v1';

/**
 * Generate a yearbook layout template using Recraft AI
 *
 * @param {object} options
 * @param {object} options.pageContent - Content for the page
 * @param {object} options.theme - Theme configuration
 * @param {string} options.pageType - 'page' or 'spread'
 * @param {number} options.photoCount - Number of photos to place
 * @returns {object} - Layout specification with photo placeholders
 */
async function generateLayoutWithRecraft({ pageContent, theme, pageType = 'page', photoCount }) {
  const apiKey = process.env.RECRAFT_API_KEY;

  if (!apiKey) {
    console.log('Recraft API key not configured, falling back to Claude layout');
    return null;
  }

  const isSpread = pageType === 'spread';
  const width = isSpread ? 2048 : 1024; // Use larger sizes for quality
  const height = 1280; // ~8x10.5 aspect ratio

  // Build the prompt for yearbook design
  const prompt = buildRecraftPrompt(pageContent, theme, isSpread, photoCount);

  // Build text layouts for precise positioning
  const textLayouts = buildTextLayouts(pageContent, isSpread);

  try {
    const response = await fetch(`${RECRAFT_API_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        style: 'digital_illustration',
        substyle: '2d_art_poster', // Magazine/poster style
        model: 'recraftv3',
        size: isSpread ? '2048x1024' : '1024x1280',
        text_layouts: textLayouts,
        // Use DCHS color palette
        controls: {
          colors: [
            { rgb: [82, 61, 115] },  // Purple #523D73
            { rgb: [255, 255, 255] }, // White
            { rgb: [26, 26, 26] },    // Dark text
          ],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Recraft API error:', error);
      return null;
    }

    const result = await response.json();

    // Recraft returns an image - we need to parse it for layout info
    // or use it as a visual guide
    return {
      layoutImage: result.data?.[0]?.url || result.data?.[0]?.b64_json,
      prompt,
      textLayouts,
    };

  } catch (error) {
    console.error('Recraft layout generation failed:', error);
    return null;
  }
}

/**
 * Build an optimized prompt for yearbook layout generation
 */
function buildRecraftPrompt(pageContent, theme, isSpread, photoCount) {
  const section = pageContent.section || 'yearbook';
  const schoolName = pageContent.schoolName || 'DCHS';

  // Describe the layout we want
  let prompt = `Professional yearbook page layout design for "${section}" section. `;
  prompt += `Clean editorial magazine style with ${photoCount} photo placeholder frames. `;
  prompt += `School: ${schoolName}. `;

  // Color scheme
  prompt += `Color scheme: deep purple (#523D73), white background, black text. `;

  // Layout specifics
  if (isSpread) {
    prompt += `Two-page spread design (16x10.5 inches). `;
    prompt += `Left page: dominant large photo area with smaller supporting photos. `;
    prompt += `Right page: text content area with headline bars and body copy space. `;
  } else {
    prompt += `Single page design (8x10.5 inches). `;
  }

  // Style elements
  prompt += `Features: `;
  prompt += `- Script/cursive section header in elegant style `;
  prompt += `- Bold uppercase school name `;
  prompt += `- Purple rectangular bars behind headlines `;
  prompt += `- Clean sans-serif body text areas `;
  prompt += `- Sharp-cornered photo frames (no rounded corners) `;
  prompt += `- Mix of large dominant photo and smaller supporting photos `;
  prompt += `- Professional magazine editorial aesthetic `;

  // Photo placeholders
  prompt += `Photo placeholder areas shown as gray rectangles with photo icons. `;

  // Avoid
  prompt += `No gradients, no decorative swirls, no diagonal lines, minimal decorations. `;
  prompt += `Clean, professional, print-ready yearbook quality.`;

  return prompt;
}

/**
 * Build text_layouts array for precise text positioning
 * Each text element has: { text: string, bbox: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] }
 * Coordinates are 0-1 relative to image dimensions
 */
function buildTextLayouts(pageContent, isSpread) {
  const layouts = [];

  // For a spread, text is on the right page (0.5-1.0 x range)
  const xOffset = isSpread ? 0.52 : 0.05;
  const textWidth = isSpread ? 0.43 : 0.9;

  // Section header (script font, top right)
  if (pageContent.section) {
    layouts.push({
      text: pageContent.section.toLowerCase(),
      bbox: [
        [xOffset + textWidth - 0.3, 0.05],
        [xOffset + textWidth, 0.05],
        [xOffset + textWidth, 0.12],
        [xOffset + textWidth - 0.3, 0.12],
      ],
    });
  }

  // School name (bold, large)
  if (pageContent.schoolName) {
    layouts.push({
      text: pageContent.schoolName.toUpperCase(),
      bbox: [
        [xOffset, 0.12],
        [xOffset + 0.25, 0.12],
        [xOffset + 0.25, 0.22],
        [xOffset, 0.22],
      ],
    });
  }

  // Headline (purple bar)
  if (pageContent.headline) {
    layouts.push({
      text: pageContent.headline,
      bbox: [
        [xOffset, 0.23],
        [xOffset + textWidth * 0.8, 0.23],
        [xOffset + textWidth * 0.8, 0.30],
        [xOffset, 0.30],
      ],
    });
  }

  // Record/stats (purple bar)
  if (pageContent.record) {
    layouts.push({
      text: pageContent.record,
      bbox: [
        [xOffset, 0.31],
        [xOffset + 0.15, 0.31],
        [xOffset + 0.15, 0.36],
        [xOffset, 0.36],
      ],
    });
  }

  // Date
  if (pageContent.dateOrYear) {
    layouts.push({
      text: pageContent.dateOrYear,
      bbox: [
        [xOffset + 0.17, 0.31],
        [xOffset + 0.35, 0.31],
        [xOffset + 0.35, 0.36],
        [xOffset + 0.17, 0.36],
      ],
    });
  }

  return layouts;
}

/**
 * Generate a complete yearbook layout by combining Recraft design
 * with Claude's content placement intelligence
 */
async function generateHybridLayout({ photos, pageContent, theme, pageType = 'page' }) {
  // Step 1: Try to get a design template from Recraft
  const recraftResult = await generateLayoutWithRecraft({
    pageContent,
    theme,
    pageType,
    photoCount: photos.length,
  });

  if (recraftResult?.layoutImage) {
    console.log('Recraft layout generated successfully');
    // Could use this as visual reference or overlay
    // For now, we'll use the text_layouts to inform our HTML layout
  }

  // Step 2: Generate precise element placements
  // This converts the Recraft-style positioning to our layout format
  return convertToLayoutJson(pageContent, photos, theme, pageType, recraftResult?.textLayouts);
}

/**
 * Convert Recraft text_layouts to our internal layout JSON format
 */
function convertToLayoutJson(pageContent, photos, theme, pageType, textLayouts) {
  const isSpread = pageType === 'spread';
  const pageWidth = isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN;
  const pageHeight = PAGE.HEIGHT_IN;

  const elements = [];

  // Convert text layouts to our element format
  if (textLayouts) {
    for (const tl of textLayouts) {
      // Convert 0-1 coordinates to inches
      const x = tl.bbox[0][0] * pageWidth;
      const y = tl.bbox[0][1] * pageHeight;
      const width = (tl.bbox[1][0] - tl.bbox[0][0]) * pageWidth;

      // Determine element type based on content
      let type = 'headline';
      if (tl.text === pageContent.section?.toLowerCase()) {
        type = 'sectionHeader';
      } else if (tl.text === pageContent.schoolName?.toUpperCase()) {
        type = 'schoolName';
      } else if (tl.text === pageContent.record) {
        type = 'record';
      } else if (tl.text === pageContent.dateOrYear) {
        type = 'date';
      }

      elements.push({
        type,
        text: type === 'sectionHeader' ? pageContent.section :
              type === 'schoolName' ? pageContent.schoolName :
              tl.text,
        x,
        y,
        width,
        fontSize: type === 'schoolName' ? 48 : type === 'sectionHeader' ? 28 : 16,
        fontFamily: type === 'sectionHeader' ? 'Dancing Script' : 'Playfair Display',
        fontWeight: '700',
        color: type === 'headline' || type === 'record' ? '#FFFFFF' : '#1A1A1A',
        backgroundColor: type === 'headline' || type === 'record' ? '#523D73' : undefined,
        zIndex: 10,
      });
    }
  }

  // Add photo placements using a professional grid
  const photoLayouts = generatePhotoGrid(photos, isSpread, pageWidth, pageHeight);
  elements.push(...photoLayouts);

  // Add body copy if present
  if (pageContent.bodyCopy) {
    const bodyX = isSpread ? pageWidth * 0.52 : 0.5;
    elements.push({
      type: 'bodyCopy',
      text: pageContent.bodyCopy,
      x: bodyX,
      y: 4.5,
      width: 3,
      height: 3,
      fontSize: 10,
      fontFamily: 'Source Sans Pro',
      color: '#1A1A1A',
      lineHeight: 1.4,
      zIndex: 10,
    });
  }

  // Add roster if present
  if (pageContent.roster?.length > 0) {
    const rosterX = isSpread ? pageWidth * 0.52 : 0.5;
    elements.push({
      type: 'roster',
      title: pageContent.rosterTitle || 'Roster:',
      names: pageContent.roster,
      x: rosterX,
      y: 7.5,
      width: 3.5,
      titleFontSize: 11,
      nameFontSize: 8,
      fontFamily: 'Source Sans Pro',
      titleColor: '#1A1A1A',
      nameColor: '#333333',
      zIndex: 10,
    });
  }

  // Add quote if present
  if (pageContent.quotes?.length > 0) {
    const quote = pageContent.quotes[0];
    elements.push({
      type: 'quote',
      text: quote.text,
      attribution: quote.attribution,
      x: isSpread ? pageWidth * 0.55 : 4.5,
      y: isSpread ? 6 : 7,
      width: 3.5,
      fontSize: 14,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
  }

  return {
    background: { type: 'solid', color: '#FFFFFF' },
    elements,
    pageType,
    dimensions: {
      width: pageWidth,
      height: pageHeight,
      widthPx: isSpread ? PAGE.SPREAD_WIDTH_PX : PAGE.WIDTH_PX,
      heightPx: PAGE.HEIGHT_PX,
    },
  };
}

/**
 * Generate a professional photo grid layout
 */
function generatePhotoGrid(photos, isSpread, pageWidth, pageHeight) {
  const elements = [];
  const photoCount = photos.length;

  if (photoCount === 0) return elements;

  // Define photo zones based on spread type
  if (isSpread) {
    // Left page is primarily photos
    const leftPageWidth = pageWidth / 2 - 0.5; // Leave gutter margin

    // Dominant photo (largest, possibly B&W)
    const dominantIdx = photos.findIndex(p => p.isPrimary) ?? 0;
    elements.push({
      type: 'photo',
      photoIndex: dominantIdx,
      x: 0.5,
      y: 1.5,
      width: leftPageWidth * 0.65,
      height: 5,
      borderRadius: 0,
      shadow: false,
      blackAndWhite: true, // DCHS style - dominant in B&W
      zIndex: 1,
      cropFit: 'cover',
    });

    // Secondary photos on left page
    let secondaryIdx = 0;
    for (let i = 0; i < photoCount && secondaryIdx < 3; i++) {
      if (i === dominantIdx) continue;

      const col = secondaryIdx % 2;
      const row = Math.floor(secondaryIdx / 2);

      elements.push({
        type: 'photo',
        photoIndex: i,
        x: leftPageWidth * 0.7 + col * 2.2,
        y: 1.5 + row * 2.5,
        width: 2,
        height: 2.2,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: false,
        zIndex: 2,
        cropFit: 'cover',
      });
      secondaryIdx++;
    }

    // Bottom photos spanning both pages
    let bottomIdx = 0;
    for (let i = 0; i < photoCount && bottomIdx < 4; i++) {
      if (i === dominantIdx || elements.some(e => e.photoIndex === i)) continue;

      elements.push({
        type: 'photo',
        photoIndex: i,
        x: 0.5 + bottomIdx * 3.8,
        y: 7,
        width: 3.5,
        height: 2.8,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: false,
        zIndex: 1,
        cropFit: 'cover',
      });
      bottomIdx++;
    }

  } else {
    // Single page layout
    // Dominant photo at top
    elements.push({
      type: 'photo',
      photoIndex: 0,
      x: 0.5,
      y: 1.5,
      width: 4.5,
      height: 3.5,
      borderRadius: 0,
      shadow: false,
      blackAndWhite: true,
      zIndex: 1,
      cropFit: 'cover',
    });

    // Supporting photos
    for (let i = 1; i < Math.min(photoCount, 4); i++) {
      elements.push({
        type: 'photo',
        photoIndex: i,
        x: 5.2 + ((i - 1) % 2) * 1.4,
        y: 1.5 + Math.floor((i - 1) / 2) * 1.8,
        width: 1.3,
        height: 1.6,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: false,
        zIndex: 2,
        cropFit: 'cover',
      });
    }
  }

  return elements;
}

module.exports = {
  generateLayoutWithRecraft,
  generateHybridLayout,
  convertToLayoutJson,
};
