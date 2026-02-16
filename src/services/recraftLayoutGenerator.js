/**
 * Recraft AI Layout Generator
 *
 * Uses Recraft V3 API to generate professional yearbook page layouts
 * with precise text positioning and design-aware composition.
 *
 * Now includes multiple layout templates for variety:
 * - photos-left: Photos on left page, text on right
 * - photos-right: Text on left page, photos on right
 * - photos-balanced: Photos on both pages, text integrated
 * - photos-dominant: Large photo spans both pages, text overlaid
 */

const { PAGE } = require('../utils/constants');

// Recraft API configuration
const RECRAFT_API_URL = 'https://external.api.recraft.ai/v1';

/**
 * Generate a yearbook layout template using Recraft AI
 */
async function generateLayoutWithRecraft({ pageContent, theme, pageType = 'page', photoCount }) {
  const apiKey = process.env.RECRAFT_API_KEY;

  if (!apiKey) {
    console.log('Recraft API key not configured, falling back to Claude layout');
    return null;
  }

  const isSpread = pageType === 'spread';
  const prompt = buildRecraftPrompt(pageContent, theme, isSpread, photoCount);
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
        substyle: '2d_art_poster',
        model: 'recraftv3',
        size: isSpread ? '2048x1024' : '1024x1280',
        text_layouts: textLayouts,
        controls: {
          colors: [
            { rgb: [82, 61, 115] },
            { rgb: [255, 255, 255] },
            { rgb: [26, 26, 26] },
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

function buildRecraftPrompt(pageContent, theme, isSpread, photoCount) {
  const section = pageContent.section || 'yearbook';
  const schoolName = pageContent.schoolName || 'DCHS';

  let prompt = `Professional yearbook page layout design for "${section}" section. `;
  prompt += `Clean editorial magazine style with ${photoCount} photo placeholder frames. `;
  prompt += `School: ${schoolName}. `;
  prompt += `Color scheme: deep purple (#523D73), white background, black text. `;

  if (isSpread) {
    prompt += `Two-page spread design (16x10.5 inches). `;
  } else {
    prompt += `Single page design (8x10.5 inches). `;
  }

  prompt += `Features: script section header, bold school name, purple headline bars, `;
  prompt += `sharp-cornered photo frames, professional editorial aesthetic. `;
  prompt += `No gradients, no decorative swirls, clean print-ready quality.`;

  return prompt;
}

function buildTextLayouts(pageContent, isSpread) {
  const layouts = [];
  const xOffset = isSpread ? 0.52 : 0.05;
  const textWidth = isSpread ? 0.43 : 0.9;

  if (pageContent.section) {
    layouts.push({
      text: pageContent.section.toLowerCase(),
      bbox: [[xOffset + textWidth - 0.3, 0.05], [xOffset + textWidth, 0.05],
             [xOffset + textWidth, 0.12], [xOffset + textWidth - 0.3, 0.12]],
    });
  }

  if (pageContent.schoolName) {
    layouts.push({
      text: pageContent.schoolName.toUpperCase(),
      bbox: [[xOffset, 0.12], [xOffset + 0.25, 0.12],
             [xOffset + 0.25, 0.22], [xOffset, 0.22]],
    });
  }

  if (pageContent.headline) {
    layouts.push({
      text: pageContent.headline,
      bbox: [[xOffset, 0.23], [xOffset + textWidth * 0.8, 0.23],
             [xOffset + textWidth * 0.8, 0.30], [xOffset, 0.30]],
    });
  }

  return layouts;
}

/**
 * Main entry point for hybrid layout generation
 */
async function generateHybridLayout({ photos, pageContent, theme, pageType = 'page' }) {
  const recraftResult = await generateLayoutWithRecraft({
    pageContent,
    theme,
    pageType,
    photoCount: photos.length,
  });

  if (recraftResult?.layoutImage) {
    console.log('Recraft layout generated successfully');
  }

  return buildSpreadLayout(pageContent, photos, theme, pageType);
}

/**
 * Choose a layout template based on content characteristics
 */
function chooseLayoutTemplate(pageContent, photoCount) {
  // Create a semi-random but deterministic choice based on content
  const contentHash = hashString(
    (pageContent.section || '') +
    (pageContent.headline || '') +
    photoCount
  );

  // Different layouts work better for different scenarios
  const hasLongBody = pageContent.bodyCopy && pageContent.bodyCopy.length > 500;
  const hasRoster = pageContent.roster && pageContent.roster.length > 10;
  const manyPhotos = photoCount > 8;
  const fewPhotos = photoCount <= 4;

  // Weight the options based on content
  const options = [];

  // Photos-left works well for most cases
  options.push('photos-left', 'photos-left');

  // Photos-right provides variety
  options.push('photos-right');

  // Balanced works when we have moderate photos and text
  if (!hasLongBody && photoCount >= 4 && photoCount <= 10) {
    options.push('photos-balanced', 'photos-balanced');
  }

  // Dominant works great for few photos
  if (fewPhotos && !hasLongBody) {
    options.push('photos-dominant');
  }

  // Use content hash to pick from weighted options
  return options[contentHash % options.length];
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Build the spread layout
 */
function buildSpreadLayout(pageContent, photos, theme, pageType) {
  const isSpread = pageType === 'spread';
  const pageWidth = isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN;
  const pageHeight = PAGE.HEIGHT_IN;
  const photoCount = photos.length;

  const elements = [];
  const MARGIN = 0.375;
  const GUTTER = isSpread ? pageWidth / 2 : 0;
  const GUTTER_MARGIN = 0.5;
  const GAP = 0.15;

  if (isSpread) {
    const leftPageStart = MARGIN;
    const leftPageEnd = GUTTER - GUTTER_MARGIN;
    const leftPageWidth = leftPageEnd - leftPageStart;
    const rightPageStart = GUTTER + GUTTER_MARGIN;
    const rightPageEnd = pageWidth - MARGIN;
    const rightPageWidth = rightPageEnd - rightPageStart;

    const layoutType = chooseLayoutTemplate(pageContent, photoCount);
    console.log(`Layout template: ${layoutType} (${photoCount} photos)`);

    const bounds = {
      leftPageStart, leftPageEnd, leftPageWidth,
      rightPageStart, rightPageEnd, rightPageWidth,
      pageHeight, pageWidth, MARGIN, GAP
    };

    switch (layoutType) {
      case 'photos-right':
        buildPhotosRightLayout(elements, photos, pageContent, bounds);
        break;
      case 'photos-balanced':
        buildPhotosBalancedLayout(elements, photos, pageContent, bounds);
        break;
      case 'photos-dominant':
        buildPhotosDominantLayout(elements, photos, pageContent, bounds);
        break;
      default:
        buildPhotosLeftLayout(elements, photos, pageContent, bounds);
    }

  } else {
    // Single page layout
    buildSinglePageLayout(elements, photos, pageContent, {
      pageWidth, pageHeight, MARGIN, GAP
    });
  }

  // Add folio
  if (pageContent.folio) {
    elements.push({
      type: 'folio',
      text: pageContent.folio,
      x: isSpread ? pageWidth - 1 : pageWidth / 2,
      y: pageHeight - 0.4,
      fontSize: 10,
      fontFamily: 'Source Sans Pro',
      color: '#666666',
      zIndex: 100,
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

// =============================================================================
// LAYOUT: PHOTOS LEFT (Traditional - photos on left, text on right)
// =============================================================================
function buildPhotosLeftLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP } = bounds;

  // RIGHT PAGE: Text content
  addTextContent(elements, pageContent, {
    startX: rightPageStart,
    endX: rightPageEnd,
    width: rightPageWidth,
    pageHeight,
    MARGIN
  });

  // LEFT PAGE: Photos
  const photoElements = buildPhotoGrid(photos, {
    startX: leftPageStart,
    startY: MARGIN,
    maxX: leftPageEnd,
    maxY: pageHeight - MARGIN,
    GAP
  });
  elements.push(...photoElements);

  // Overflow photos to right page if needed
  addOverflowPhotos(elements, photos, photoElements, pageContent, {
    startX: rightPageStart,
    width: rightPageWidth,
    GAP
  });
}

// =============================================================================
// LAYOUT: PHOTOS RIGHT (Flipped - text on left, photos on right)
// =============================================================================
function buildPhotosRightLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP } = bounds;

  // LEFT PAGE: Text content
  addTextContent(elements, pageContent, {
    startX: leftPageStart,
    endX: leftPageEnd,
    width: leftPageWidth,
    pageHeight,
    MARGIN,
    flipped: true
  });

  // RIGHT PAGE: Photos
  const photoElements = buildPhotoGrid(photos, {
    startX: rightPageStart,
    startY: MARGIN,
    maxX: rightPageEnd,
    maxY: pageHeight - MARGIN,
    GAP
  });
  elements.push(...photoElements);

  // Overflow photos to left page if needed
  addOverflowPhotos(elements, photos, photoElements, pageContent, {
    startX: leftPageStart,
    width: leftPageWidth,
    GAP,
    flipped: true
  });
}

// =============================================================================
// LAYOUT: PHOTOS BALANCED (Photos on both pages, text integrated)
// =============================================================================
function buildPhotosBalancedLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP } = bounds;

  const photoCount = photos.length;
  const leftPhotoCount = Math.ceil(photoCount / 2);
  const rightPhotoCount = photoCount - leftPhotoCount;

  // Split photos between pages
  const leftPhotos = photos.slice(0, leftPhotoCount);
  const rightPhotos = photos.slice(leftPhotoCount);

  // LEFT PAGE: Photos in top 60%, text in bottom 40%
  const leftPhotoHeight = (pageHeight - 2 * MARGIN) * 0.6;
  const leftPhotoElements = buildPhotoGrid(leftPhotos, {
    startX: leftPageStart,
    startY: MARGIN,
    maxX: leftPageEnd,
    maxY: MARGIN + leftPhotoHeight,
    GAP
  }, 0);
  elements.push(...leftPhotoElements);

  // LEFT PAGE: Section header and school name at bottom
  if (pageContent.section) {
    elements.push({
      type: 'sectionHeader',
      text: pageContent.section,
      x: leftPageEnd - 2.5,
      y: leftPhotoHeight + MARGIN + 0.3,
      width: 2.3,
      fontSize: 32,
      fontFamily: 'Dancing Script',
      fontWeight: '400',
      fontStyle: 'italic',
      color: '#1A1A1A',
      textAlign: 'right',
      textTransform: 'lowercase',
      zIndex: 10,
    });
  }

  if (pageContent.schoolName) {
    elements.push({
      type: 'schoolName',
      text: pageContent.schoolName,
      x: leftPageStart,
      y: leftPhotoHeight + MARGIN + 0.8,
      width: 4,
      fontSize: 60,
      fontFamily: 'Playfair Display',
      fontWeight: '900',
      color: '#1A1A1A',
      zIndex: 10,
    });
  }

  // Add headline and body on left page bottom
  if (pageContent.headline) {
    elements.push({
      type: 'headline',
      text: pageContent.headline,
      x: leftPageStart,
      y: leftPhotoHeight + MARGIN + 1.8,
      width: leftPageWidth * 0.7,
      fontSize: 16,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
  }

  // RIGHT PAGE: Photos in top portion
  const rightPhotoHeight = (pageHeight - 2 * MARGIN) * 0.55;
  const rightPhotoElements = buildPhotoGrid(rightPhotos, {
    startX: rightPageStart,
    startY: MARGIN,
    maxX: rightPageEnd,
    maxY: MARGIN + rightPhotoHeight,
    GAP
  }, leftPhotoCount);
  elements.push(...rightPhotoElements);

  // RIGHT PAGE: Body copy and roster at bottom
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy',
      text: pageContent.bodyCopy,
      x: rightPageStart,
      y: rightPhotoHeight + MARGIN + 0.3,
      width: rightPageWidth,
      height: 3,
      fontSize: 9,
      fontFamily: 'Source Sans Pro',
      color: '#1A1A1A',
      lineHeight: 1.4,
      columns: 2,
      zIndex: 10,
    });
  }

  if (pageContent.roster?.length > 0) {
    elements.push({
      type: 'roster',
      title: pageContent.rosterTitle || 'Team Roster:',
      names: pageContent.roster,
      x: rightPageStart,
      y: pageHeight - MARGIN - 2,
      width: rightPageWidth,
      columns: 2,
      titleFontSize: 11,
      nameFontSize: 7,
      fontFamily: 'Source Sans Pro',
      titleColor: '#1A1A1A',
      nameColor: '#333333',
      zIndex: 10,
    });
  }
}

// =============================================================================
// LAYOUT: PHOTOS DOMINANT (Large hero photo spans gutter, text overlaid)
// =============================================================================
function buildPhotosDominantLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, pageWidth, MARGIN, GAP } = bounds;

  const photoCount = photos.length;

  // Dominant photo spans most of the spread (avoiding gutter for faces)
  elements.push({
    type: 'photo',
    photoIndex: 0,
    x: MARGIN,
    y: MARGIN,
    width: pageWidth - 2 * MARGIN,
    height: (pageHeight - 2 * MARGIN) * 0.65,
    borderRadius: 0,
    shadow: false,
    blackAndWhite: true,
    zIndex: 1,
    cropFit: 'cover',
  });

  // Text content overlaid on bottom right
  const textStartY = (pageHeight - 2 * MARGIN) * 0.65 + MARGIN + 0.3;

  if (pageContent.section) {
    elements.push({
      type: 'sectionHeader',
      text: pageContent.section,
      x: rightPageEnd - 2.5,
      y: textStartY - 0.8,
      width: 2.3,
      fontSize: 36,
      fontFamily: 'Dancing Script',
      fontWeight: '400',
      fontStyle: 'italic',
      color: '#1A1A1A',
      textAlign: 'right',
      textTransform: 'lowercase',
      zIndex: 10,
    });
  }

  if (pageContent.schoolName) {
    elements.push({
      type: 'schoolName',
      text: pageContent.schoolName,
      x: rightPageStart,
      y: textStartY,
      width: 4,
      fontSize: 72,
      fontFamily: 'Playfair Display',
      fontWeight: '900',
      color: '#1A1A1A',
      zIndex: 10,
    });
  }

  if (pageContent.headline) {
    elements.push({
      type: 'headline',
      text: pageContent.headline,
      x: rightPageStart,
      y: textStartY + 1.0,
      width: rightPageWidth * 0.65,
      fontSize: 18,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
  }

  // Remaining photos in bottom left
  if (photoCount > 1) {
    const bottomY = textStartY - 0.2;
    const remainingPhotos = photos.slice(1);
    const maxBottomPhotos = Math.min(remainingPhotos.length, 5);
    const photoWidth = (leftPageWidth - (maxBottomPhotos - 1) * GAP) / maxBottomPhotos;
    const photoHeight = pageHeight - bottomY - MARGIN;

    for (let i = 0; i < maxBottomPhotos; i++) {
      elements.push({
        type: 'photo',
        photoIndex: i + 1,
        x: leftPageStart + i * (photoWidth + GAP),
        y: bottomY,
        width: photoWidth,
        height: photoHeight,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: false,
        zIndex: 2,
        cropFit: 'cover',
      });
    }
  }

  // Body copy on right side bottom
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy',
      text: pageContent.bodyCopy,
      x: rightPageStart,
      y: textStartY + 1.7,
      width: rightPageWidth,
      height: 2.5,
      fontSize: 9,
      fontFamily: 'Source Sans Pro',
      color: '#1A1A1A',
      lineHeight: 1.4,
      columns: 2,
      zIndex: 10,
    });
  }

  // Roster at very bottom right
  if (pageContent.roster?.length > 0) {
    elements.push({
      type: 'roster',
      title: pageContent.rosterTitle || 'Team Roster:',
      names: pageContent.roster,
      x: rightPageStart,
      y: pageHeight - MARGIN - 1.5,
      width: rightPageWidth,
      columns: 2,
      titleFontSize: 10,
      nameFontSize: 6,
      fontFamily: 'Source Sans Pro',
      titleColor: '#1A1A1A',
      nameColor: '#333333',
      zIndex: 10,
    });
  }
}

// =============================================================================
// HELPER: Add text content to a page
// =============================================================================
function addTextContent(elements, pageContent, options) {
  const { startX, endX, width, pageHeight, MARGIN, flipped = false } = options;

  // Section header
  if (pageContent.section) {
    elements.push({
      type: 'sectionHeader',
      text: pageContent.section,
      x: flipped ? startX : endX - 2.5,
      y: 0.4,
      width: 2.3,
      fontSize: 36,
      fontFamily: 'Dancing Script',
      fontWeight: '400',
      fontStyle: 'italic',
      color: '#1A1A1A',
      textAlign: flipped ? 'left' : 'right',
      textTransform: 'lowercase',
      zIndex: 10,
    });
  }

  // School name
  if (pageContent.schoolName) {
    elements.push({
      type: 'schoolName',
      text: pageContent.schoolName,
      x: startX,
      y: 1.0,
      width: 4,
      fontSize: 72,
      fontFamily: 'Playfair Display',
      fontWeight: '900',
      color: '#1A1A1A',
      letterSpacing: 2,
      zIndex: 10,
    });
  }

  // Headline
  if (pageContent.headline) {
    elements.push({
      type: 'headline',
      text: pageContent.headline,
      x: startX,
      y: 2.0,
      width: width * 0.65,
      fontSize: 18,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
  }

  // Record
  if (pageContent.record) {
    elements.push({
      type: 'record',
      text: pageContent.record,
      x: startX,
      y: 2.6,
      width: 1.8,
      fontSize: 14,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
  }

  // Date
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date',
      text: pageContent.dateOrYear,
      x: startX + 2.2,
      y: 2.6,
      width: 2,
      fontSize: 14,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#1A1A1A',
      textTransform: 'uppercase',
      zIndex: 10,
    });
  }

  // Body copy
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy',
      text: pageContent.bodyCopy,
      x: startX,
      y: 3.3,
      width: width,
      height: 4.5,
      fontSize: 9,
      fontFamily: 'Source Sans Pro',
      fontWeight: '400',
      color: '#1A1A1A',
      lineHeight: 1.4,
      columns: 2,
      textAlign: 'justify',
      zIndex: 10,
    });
  }

  // Roster
  if (pageContent.roster?.length > 0) {
    elements.push({
      type: 'roster',
      title: pageContent.rosterTitle || 'Team Roster:',
      names: pageContent.roster,
      x: startX,
      y: 8.0,
      width: width,
      columns: 2,
      titleFontSize: 12,
      nameFontSize: 7,
      fontFamily: 'Source Sans Pro',
      titleColor: '#1A1A1A',
      nameColor: '#333333',
      zIndex: 10,
    });
  }

  // Quote
  if (pageContent.quotes?.length > 0) {
    const quote = pageContent.quotes[0];
    elements.push({
      type: 'quote',
      text: quote.text,
      attribution: quote.attribution,
      x: startX + width * 0.55,
      y: 5.8,
      width: width * 0.42,
      fontSize: 12,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      fontStyle: 'italic',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 11,
    });
  }
}

// =============================================================================
// HELPER: Build photo grid for a given area
// =============================================================================
function buildPhotoGrid(photos, bounds, startIndex = 0) {
  const elements = [];
  const photoCount = photos.length;
  if (photoCount === 0) return elements;

  const { startX, startY, maxX, maxY, GAP } = bounds;
  const availableWidth = maxX - startX;
  const availableHeight = maxY - startY;

  const dominantIdx = photos.findIndex(p => p.isPrimary);
  const primaryIdx = dominantIdx >= 0 ? dominantIdx : 0;

  if (photoCount === 1) {
    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY + 0.3,
      width: availableWidth, height: availableHeight - 0.6,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
  } else if (photoCount === 2) {
    const w1 = availableWidth * 0.6;
    elements.push({
      type: 'photo', photoIndex: startIndex + primaryIdx,
      x: startX, y: startY,
      width: w1, height: availableHeight * 0.75,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + (primaryIdx === 0 ? 1 : 0),
      x: startX + w1 + GAP, y: startY,
      width: availableWidth - w1 - GAP, height: availableHeight * 0.5,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 2, cropFit: 'cover',
    });
  } else if (photoCount <= 4) {
    // Dominant + 2 side + 1 bottom
    const domW = availableWidth * 0.6;
    const domH = availableHeight * 0.65;
    const sideW = availableWidth - domW - GAP;
    const sideH = (domH - GAP) / 2;

    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: domW, height: domH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });

    for (let i = 1; i < Math.min(photoCount, 3); i++) {
      elements.push({
        type: 'photo', photoIndex: startIndex + i,
        x: startX + domW + GAP, y: startY + (i - 1) * (sideH + GAP),
        width: sideW, height: sideH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 2, cropFit: 'cover',
      });
    }

    if (photoCount === 4) {
      elements.push({
        type: 'photo', photoIndex: startIndex + 3,
        x: startX, y: startY + domH + GAP,
        width: availableWidth, height: availableHeight - domH - GAP,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
    }
  } else if (photoCount <= 8) {
    // Dominant + 3 side + bottom row
    const domW = availableWidth * 0.55;
    const domH = availableHeight * 0.55;
    const sideW = availableWidth - domW - GAP;
    const sideH = (domH - 2 * GAP) / 3;
    const bottomH = availableHeight - domH - GAP;

    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: domW, height: domH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });

    for (let i = 1; i <= 3 && i < photoCount; i++) {
      elements.push({
        type: 'photo', photoIndex: startIndex + i,
        x: startX + domW + GAP, y: startY + (i - 1) * (sideH + GAP),
        width: sideW, height: sideH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 2, cropFit: 'cover',
      });
    }

    const bottomCount = Math.min(photoCount - 4, 4);
    if (bottomCount > 0) {
      const bottomW = (availableWidth - (bottomCount - 1) * GAP) / bottomCount;
      for (let i = 0; i < bottomCount; i++) {
        elements.push({
          type: 'photo', photoIndex: startIndex + 4 + i,
          x: startX + i * (bottomW + GAP), y: startY + domH + GAP,
          width: bottomW, height: bottomH,
          borderRadius: 0, shadow: false, blackAndWhite: false,
          zIndex: 1, cropFit: 'cover',
        });
      }
    }
  } else {
    // 9+ photos: Full grid
    const domW = availableWidth * 0.5;
    const domH = availableHeight * 0.45;
    const sideW = availableWidth - domW - GAP;
    const sideH = (domH - 3 * GAP) / 4;
    const rowH = (availableHeight - domH - 2 * GAP) / 2;

    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: domW, height: domH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });

    for (let i = 1; i <= 4 && i < photoCount; i++) {
      elements.push({
        type: 'photo', photoIndex: startIndex + i,
        x: startX + domW + GAP, y: startY + (i - 1) * (sideH + GAP),
        width: sideW, height: sideH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 2, cropFit: 'cover',
      });
    }

    // Middle row
    const midCount = Math.min(photoCount - 5, 5);
    if (midCount > 0) {
      const midW = (availableWidth - (midCount - 1) * GAP) / midCount;
      for (let i = 0; i < midCount; i++) {
        elements.push({
          type: 'photo', photoIndex: startIndex + 5 + i,
          x: startX + i * (midW + GAP), y: startY + domH + GAP,
          width: midW, height: rowH,
          borderRadius: 0, shadow: false, blackAndWhite: false,
          zIndex: 1, cropFit: 'cover',
        });
      }
    }

    // Bottom row
    const botCount = Math.min(photoCount - 10, 5);
    if (botCount > 0) {
      const botW = (availableWidth - (botCount - 1) * GAP) / botCount;
      for (let i = 0; i < botCount; i++) {
        elements.push({
          type: 'photo', photoIndex: startIndex + 10 + i,
          x: startX + i * (botW + GAP), y: startY + domH + rowH + 2 * GAP,
          width: botW, height: rowH,
          borderRadius: 0, shadow: false, blackAndWhite: false,
          zIndex: 1, cropFit: 'cover',
        });
      }
    }
  }

  return elements;
}

// =============================================================================
// HELPER: Add overflow photos to the opposite page
// =============================================================================
function addOverflowPhotos(elements, allPhotos, placedPhotoElements, pageContent, options) {
  const { startX, width, GAP, flipped = false } = options;

  const usedIndices = new Set(placedPhotoElements.map(e => e.photoIndex));
  const remainingPhotos = allPhotos.filter((_, i) => !usedIndices.has(i));

  if (remainingPhotos.length === 0) return;

  const hasLongBody = pageContent.bodyCopy && pageContent.bodyCopy.length > 800;
  let currentY = hasLongBody ? 7.8 : 7.2;

  // Row 1
  const row1Count = Math.min(remainingPhotos.length, 4);
  const row1W = (width - (row1Count - 1) * GAP) / row1Count;
  const row1H = 1.6;

  for (let i = 0; i < row1Count; i++) {
    const actualIdx = allPhotos.indexOf(remainingPhotos[i]);
    elements.push({
      type: 'photo', photoIndex: actualIdx,
      x: startX + i * (row1W + GAP), y: currentY,
      width: row1W, height: row1H,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
  }
  currentY += row1H + GAP;

  // Row 2 if space
  const row2Photos = remainingPhotos.slice(row1Count);
  if (row2Photos.length > 0 && currentY < 9.5) {
    const row2Count = Math.min(row2Photos.length, 4);
    const row2W = (width - (row2Count - 1) * GAP) / row2Count;
    const row2H = 1.4;

    for (let i = 0; i < row2Count; i++) {
      const actualIdx = allPhotos.indexOf(row2Photos[i]);
      elements.push({
        type: 'photo', photoIndex: actualIdx,
        x: startX + i * (row2W + GAP), y: currentY,
        width: row2W, height: row2H,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
    }
    currentY += row2H + GAP;
  }

  // Adjust roster if needed
  const roster = elements.find(e => e.type === 'roster');
  if (roster && currentY > roster.y - 0.3) {
    roster.y = Math.min(currentY + 0.1, 9.8);
  }
}

// =============================================================================
// SINGLE PAGE LAYOUT
// =============================================================================
function buildSinglePageLayout(elements, photos, pageContent, options) {
  const { pageWidth, pageHeight, MARGIN, GAP } = options;
  const contentWidth = pageWidth - 2 * MARGIN;

  // Section header
  if (pageContent.section) {
    elements.push({
      type: 'sectionHeader',
      text: pageContent.section,
      x: pageWidth - MARGIN - 2.5,
      y: 0.5,
      width: 2.3,
      fontSize: 28,
      fontFamily: 'Dancing Script',
      fontWeight: '400',
      fontStyle: 'italic',
      color: '#1A1A1A',
      textAlign: 'right',
      zIndex: 10,
    });
  }

  // School name
  if (pageContent.schoolName) {
    elements.push({
      type: 'schoolName',
      text: pageContent.schoolName,
      x: MARGIN,
      y: 1.0,
      width: 2.5,
      fontSize: 48,
      fontFamily: 'Playfair Display',
      fontWeight: '900',
      color: '#1A1A1A',
      zIndex: 10,
    });
  }

  // Headline
  if (pageContent.headline) {
    elements.push({
      type: 'headline',
      text: pageContent.headline,
      x: MARGIN,
      y: 1.8,
      width: contentWidth * 0.6,
      fontSize: 14,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
  }

  // Photos
  const photoElements = buildPhotoGrid(photos, {
    startX: MARGIN,
    startY: 2.5,
    maxX: pageWidth - MARGIN,
    maxY: pageHeight - 2.5,
    GAP
  });
  elements.push(...photoElements);

  // Body copy
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy',
      text: pageContent.bodyCopy,
      x: MARGIN,
      y: 7.5,
      width: contentWidth,
      height: 2.5,
      fontSize: 9,
      fontFamily: 'Source Sans Pro',
      color: '#1A1A1A',
      lineHeight: 1.35,
      columns: 2,
      zIndex: 10,
    });
  }
}

// Keep old function name for compatibility
function convertToLayoutJson(pageContent, photos, theme, pageType, textLayouts) {
  return buildSpreadLayout(pageContent, photos, theme, pageType);
}

module.exports = {
  generateLayoutWithRecraft,
  generateHybridLayout,
  convertToLayoutJson,
};
