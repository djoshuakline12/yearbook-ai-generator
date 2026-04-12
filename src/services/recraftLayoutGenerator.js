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
 * Choose a layout template based on content characteristics.
 * Uses content hash for deterministic but varied selection.
 */
function chooseLayoutTemplate(pageContent, photoCount) {
  // Hash includes all content for maximum variety between pages
  const contentHash = hashString(
    (pageContent.section || '') +
    (pageContent.headline || '') +
    (pageContent.bodyCopy || '').slice(0, 50) +
    (pageContent.schoolName || '') +
    photoCount
  );

  const hasLongBody = pageContent.bodyCopy && pageContent.bodyCopy.length > 500;
  const fewPhotos = photoCount <= 4;

  // Build list of ALL eligible templates — all use mixed text+photos on both pages
  const options = [];

  // Mixed layouts: text and photos on BOTH pages (no empty pages)
  options.push('mixed-left');
  options.push('mixed-right');
  options.push('top-heavy');

  // Need 3+ photos
  if (photoCount >= 3) {
    options.push('magazine');
    options.push('L-shape');
    options.push('staggered');
  }

  // Moderate photos
  if (!hasLongBody && photoCount >= 4 && photoCount <= 10) {
    options.push('photos-balanced');
  }

  // Few photos - hero style
  if (fewPhotos && !hasLongBody) {
    options.push('photos-dominant');
  }

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

  // Get photo captions from pageContent
  const photoCaptions = pageContent.photoCaptions || [];

  const elements = [];
  const MARGIN = 0.75;  // Increased margin for print safety - keeps content well away from bleed zone
  const GUTTER = isSpread ? pageWidth / 2 : 0;
  const GUTTER_MARGIN = 0.75;  // Extra space near gutter for binding
  const GAP = 0.125;  // Gaps between photos

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
      pageHeight, pageWidth, MARGIN, GAP,
      photoCaptions  // Pass captions to layout builders
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
      case 'mixed-left':
        buildMixedLeftLayout(elements, photos, pageContent, bounds);
        break;
      case 'mixed-right':
        buildMixedRightLayout(elements, photos, pageContent, bounds);
        break;
      case 'magazine':
        buildMagazineLayout(elements, photos, pageContent, bounds);
        break;
      case 'top-heavy':
        buildTopHeavyLayout(elements, photos, pageContent, bounds);
        break;
      case 'sidebar-left':
        buildSidebarLayout(elements, photos, pageContent, bounds, 'left');
        break;
      case 'sidebar-right':
        buildSidebarLayout(elements, photos, pageContent, bounds, 'right');
        break;
      case 'L-shape':
        buildLShapeLayout(elements, photos, pageContent, bounds);
        break;
      case 'staggered':
        buildStaggeredLayout(elements, photos, pageContent, bounds);
        break;
      default:
        buildMixedLeftLayout(elements, photos, pageContent, bounds);
    }

  } else {
    // Single page layout
    buildSinglePageLayout(elements, photos, pageContent, {
      pageWidth, pageHeight, MARGIN, GAP,
      photoCaptions
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
// LAYOUT: PHOTOS LEFT (Photos primarily left, but ALWAYS some on right too)
// =============================================================================
function buildPhotosLeftLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // First, calculate how much space text will take up
  const textEndY = addTextContent(elements, pageContent, {
    startX: rightPageStart,
    endX: rightPageEnd,
    width: rightPageWidth,
    pageHeight,
    MARGIN,
    compact: true
  });

  // Calculate available space for photos on right page
  const photoStartY = textEndY + 0.1;  // Small gap after text - let photos fill more space
  const rightPagePhotoSpace = pageHeight - MARGIN - photoStartY;
  const totalPhotoSpace = (pageHeight - 2 * MARGIN) + rightPagePhotoSpace;

  // Distribute photos - ensure at least 2 photos on the text page for balance
  const rightPageRatio = rightPagePhotoSpace / totalPhotoSpace;
  const minOnTextPage = Math.min(2, photoCount - 1);
  const rightPagePhotoCount = Math.max(minOnTextPage, Math.min(
    Math.round(photoCount * rightPageRatio),
    photoCount - 1
  ));
  const leftPagePhotoCount = photoCount - rightPagePhotoCount;

  const leftPhotos = photos.slice(0, leftPagePhotoCount);
  const rightPhotos = photos.slice(leftPagePhotoCount);

  // LEFT PAGE: Main photos (full page)
  const leftPhotoElements = buildPhotoGrid(leftPhotos, {
    startX: leftPageStart,
    startY: MARGIN,
    maxX: leftPageEnd,
    maxY: pageHeight - MARGIN,
    GAP
  }, 0, photoCaptions);
  elements.push(...leftPhotoElements);

  // RIGHT PAGE: Photos filling everything below text
  if (rightPhotos.length > 0) {
    const rightPhotoElements = buildPhotoGrid(rightPhotos, {
      startX: rightPageStart,
      startY: photoStartY,
      maxX: rightPageEnd,
      maxY: pageHeight - MARGIN,
      GAP
    }, leftPagePhotoCount, photoCaptions);
    elements.push(...rightPhotoElements);
  }
}

// =============================================================================
// LAYOUT: PHOTOS RIGHT (Photos primarily right, but ALWAYS some on left too)
// =============================================================================
function buildPhotosRightLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // First, calculate how much space text will take up on left page
  const textEndY = addTextContent(elements, pageContent, {
    startX: leftPageStart,
    endX: leftPageEnd,
    width: leftPageWidth,
    pageHeight,
    MARGIN,
    flipped: true,
    compact: true
  });

  // Calculate available space for photos on left page
  const photoStartY = textEndY + 0.1;  // Small gap after text - let photos fill more space
  const leftPagePhotoSpace = pageHeight - MARGIN - photoStartY;
  const totalPhotoSpace = leftPagePhotoSpace + (pageHeight - 2 * MARGIN);

  // Distribute photos - ensure at least 2 photos on the text page for balance
  const leftPageRatio = leftPagePhotoSpace / totalPhotoSpace;
  const minOnTextPage = Math.min(2, photoCount - 1);
  const leftPagePhotoCount = Math.max(minOnTextPage, Math.min(
    Math.round(photoCount * leftPageRatio),
    photoCount - 1
  ));
  const rightPagePhotoCount = photoCount - leftPagePhotoCount;

  const leftPhotos = photos.slice(0, leftPagePhotoCount);
  const rightPhotos = photos.slice(leftPagePhotoCount);

  // LEFT PAGE: Photos filling everything below text
  if (leftPhotos.length > 0) {
    const leftPhotoElements = buildPhotoGrid(leftPhotos, {
      startX: leftPageStart,
      startY: photoStartY,
      maxX: leftPageEnd,
      maxY: pageHeight - MARGIN,
      GAP
    }, 0, photoCaptions);
    elements.push(...leftPhotoElements);
  }

  // RIGHT PAGE: Main photos (full page)
  const rightPhotoElements = buildPhotoGrid(rightPhotos, {
    startX: rightPageStart,
    startY: MARGIN,
    maxX: rightPageEnd,
    maxY: pageHeight - MARGIN,
    GAP
  }, leftPagePhotoCount, photoCaptions);
  elements.push(...rightPhotoElements);
}

// =============================================================================
// LAYOUT: PHOTOS BALANCED (Photos on both pages, text integrated)
// =============================================================================
function buildPhotosBalancedLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

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
  }, 0, photoCaptions);
  elements.push(...leftPhotoElements);

  // LEFT PAGE: Title block at bottom of photos
  addTitleBlock(elements, pageContent, {
    x: leftPageStart, y: leftPhotoHeight + MARGIN + 0.3, width: leftPageWidth,
  });

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
  }, leftPhotoCount, photoCaptions);
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
          pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // Helper to get caption data for a photo (skip placeholders)
  const getDomCaptionData = (index) => {
    const caption = photoCaptions.find(c => c.photoIndex === index) || photoCaptions[index];
    if (caption) {
      let text = '';
      const people = caption.people || '';
      const captionText = caption.caption || '';
      const captionTitle = caption.captionTitle || null;

      const isPlaceholder = (str) => {
        if (!str) return true;
        const lower = str.toLowerCase();
        return lower.includes('needs info') ||
               lower.includes('names needed') ||
               lower.includes('[') ||
               lower.includes('tbd') ||
               lower.includes('placeholder') ||
               lower.includes('error') ||
               str.trim() === '';
      };

      // Avoid repeating name: if caption already starts with the person's name, just use caption
      const captionStartsWithName = !isPlaceholder(people) && !isPlaceholder(captionText) &&
        captionText.toLowerCase().startsWith(people.split(',')[0].trim().toLowerCase());

      if (captionStartsWithName) {
        text = captionText;
      } else {
        if (!isPlaceholder(people)) text += people;
        if (text && !isPlaceholder(captionText)) text += ' — ';
        if (!isPlaceholder(captionText)) text += captionText;
      }

      return { caption: text.trim() || null, captionTitle };
    }
    return { caption: null, captionTitle: null };
  };

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
    ...getDomCaptionData(0),
  });

  // Text content on bottom right
  const textStartY = (pageHeight - 2 * MARGIN) * 0.65 + MARGIN + 0.3;

  const afterTitle = addTitleBlock(elements, pageContent, {
    x: rightPageStart, y: textStartY, width: rightPageWidth,
  });

  if (pageContent.headline) {
    elements.push({
      type: 'headline',
      text: pageContent.headline,
      x: rightPageStart,
      y: afterTitle + 0.1,
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
        ...getDomCaptionData(i + 1),
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
// LAYOUT: MIXED LEFT (Title top-left, photos fill both pages, text bottom)
// =============================================================================
function buildMixedLeftLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // LEFT PAGE: Title at top, photos fill the rest
  let leftY = addTitleBlock(elements, pageContent, {
    x: leftPageStart, y: MARGIN, width: leftPageWidth, compact: true,
  });

  // Headline + record compact on left
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: leftPageStart, y: leftY, width: leftPageWidth * 0.7,
      fontSize: 13, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    leftY += 0.35;
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: leftPageStart, y: leftY, width: 1.5,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    leftY += 0.3;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: leftPageStart, y: leftY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    leftY += 0.25;
  }

  // LEFT PAGE: Photos fill from after title to bottom (reserve space for body at bottom)
  const leftBodyHeight = pageContent.bodyCopy ? 2.8 : 0;
  const leftPhotoCount = Math.max(2, Math.ceil(photoCount * 0.4));
  const leftPhotos = photos.slice(0, Math.min(leftPhotoCount, photoCount - 1));
  const leftPhotoStartY = leftY + 0.1;
  const leftPhotoMaxY = pageHeight - MARGIN - leftBodyHeight;
  console.log(`mixed-left: leftY=${leftY.toFixed(2)} photoStartY=${leftPhotoStartY.toFixed(2)} maxY=${leftPhotoMaxY.toFixed(2)} availH=${(leftPhotoMaxY - leftPhotoStartY).toFixed(2)} leftPhotos=${leftPhotos.length}`);
  if (leftPhotos.length > 0 && leftPhotoMaxY > leftPhotoStartY + 1.0) {
    const leftPhotoElements = buildPhotoGrid(leftPhotos, {
      startX: leftPageStart,
      startY: leftPhotoStartY,
      maxX: leftPageEnd,
      maxY: leftPhotoMaxY,
      GAP
    }, 0, photoCaptions);
    console.log(`mixed-left: generated ${leftPhotoElements.length} left photo elements`);
    elements.push(...leftPhotoElements);
  } else {
    console.log('mixed-left: NOT ENOUGH SPACE for left photos!');
  }

  // LEFT PAGE: Body copy at bottom
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftPageStart, y: pageHeight - MARGIN - leftBodyHeight + 0.15,
      width: leftPageWidth, height: leftBodyHeight - 0.3,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
  }

  // RIGHT PAGE: Photos filling most of the page, roster at bottom
  const rightPhotos = photos.slice(leftPhotos.length);
  const rosterHeight = (pageContent.roster?.length > 0) ? 1.2 : 0;

  if (rightPhotos.length > 0) {
    const rightPhotoElements = buildPhotoGrid(rightPhotos, {
      startX: rightPageStart,
      startY: MARGIN,
      maxX: rightPageEnd,
      maxY: pageHeight - MARGIN - rosterHeight,
      GAP
    }, leftPhotos.length, photoCaptions);
    elements.push(...rightPhotoElements);
  }

  let rightY = pageHeight - MARGIN - rosterHeight;

  // Coaches + Roster on right
  let coaches = pageContent.coaches || [];
  let rosterNames = pageContent.roster || [];
  if (coaches.length === 0 && rosterNames.length > 0) {
    const extracted = [];
    const filtered = [];
    for (const name of rosterNames) {
      if (/\(coach\)/i.test(name)) {
        extracted.push(name.replace(/\s*\(coach\)\s*/gi, '').trim());
      } else {
        filtered.push(name);
      }
    }
    if (extracted.length > 0) { coaches = extracted; rosterNames = filtered; }
  }

  if (coaches.length > 0) {
    rightY += 0.15;
    elements.push({
      type: 'roster', title: pageContent.coachesTitle || 'Coaches:',
      names: coaches, x: rightPageStart, y: rightY, width: rightPageWidth,
      columns: 1, titleFontSize: 10, nameFontSize: 8,
      fontFamily: 'Source Sans Pro', titleColor: '#523D73',
      nameColor: '#1A1A1A', fontWeight: '600', zIndex: 10,
    });
    rightY += 0.3 + (coaches.length * 0.16);
  }

  if (rosterNames.length > 0) {
    rightY += 0.15;
    elements.push({
      type: 'roster', title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames, x: rightPageStart, y: rightY, width: rightPageWidth,
      columns: 4, titleFontSize: 10, nameFontSize: 7,
      fontFamily: 'Source Sans Pro', titleColor: '#1A1A1A',
      nameColor: '#333333', zIndex: 10,
    });
  }
}

// =============================================================================
// LAYOUT: MAGAZINE (Title centered across spread, photos + text mixed)
// =============================================================================
function buildMagazineLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // BIG hero photo on left page (top 65%)
  const heroHeight = (pageHeight - 2 * MARGIN) * 0.65;
  if (photoCount > 0) {
    elements.push({
      type: 'photo', photoIndex: 0,
      x: leftPageStart, y: MARGIN,
      width: leftPageWidth, height: heroHeight,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
  }

  // Title overlapping bottom of hero photo (on left page)
  let leftY = addTitleBlock(elements, pageContent, {
    x: leftPageStart, y: MARGIN + heroHeight - 0.3, width: leftPageWidth,
  });

  // Headline + record on left below hero
  if (pageContent.headline) {
    elements.push({
      type: 'headline',
      text: pageContent.headline,
      x: leftPageStart,
      y: leftY,
      width: leftPageWidth * 0.65,
      fontSize: 12,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
    leftY += 0.35;
  }

  if (pageContent.record) {
    elements.push({
      type: 'record',
      text: pageContent.record,
      x: leftPageStart,
      y: leftY,
      width: 1.5,
      fontSize: 11,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
    leftY += 0.3;
  }

  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date',
      text: pageContent.dateOrYear,
      x: leftPageStart, y: leftY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro',
      fontWeight: '600', color: '#523D73',
      textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    leftY += 0.25;
  }

  // Small photos at bottom of left page
  const leftBottomPhotos = photos.slice(1, Math.min(4, photoCount));
  if (leftBottomPhotos.length > 0) {
    const botY = Math.max(leftY + 0.15, pageHeight - MARGIN - 2.2);
    const leftBotElements = buildPhotoGrid(leftBottomPhotos, {
      startX: leftPageStart, startY: botY,
      maxX: leftPageEnd, maxY: pageHeight - MARGIN, GAP
    }, 1, photoCaptions);
    elements.push(...leftBotElements);
  }

  // RIGHT PAGE: Body copy at top, photos below
  let rightY = MARGIN;

  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy',
      text: pageContent.bodyCopy,
      x: rightPageStart, y: rightY,
      width: rightPageWidth, height: 3.0,
      fontSize: 9, fontFamily: 'Source Sans Pro',
      fontWeight: '400', color: '#1A1A1A',
      lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
    rightY += 3.1;
  }

  // Remaining photos on right page
  const rightPhotos = photos.slice(Math.min(4, photoCount));
  if (rightPhotos.length > 0) {
    const rightPhotoElements = buildPhotoGrid(rightPhotos, {
      startX: rightPageStart, startY: rightY,
      maxX: rightPageEnd, maxY: pageHeight - MARGIN - 1.5,
      GAP
    }, Math.min(4, photoCount), photoCaptions);
    elements.push(...rightPhotoElements);
  }

  // Roster at bottom of right page
  let coaches = pageContent.coaches || [];
  let rosterNames = pageContent.roster || [];
  if (coaches.length === 0 && rosterNames.length > 0) {
    const extracted = [];
    const filtered = [];
    for (const name of rosterNames) {
      if (/\(coach\)/i.test(name)) {
        extracted.push(name.replace(/\s*\(coach\)\s*/gi, '').trim());
      } else {
        filtered.push(name);
      }
    }
    if (extracted.length > 0) { coaches = extracted; rosterNames = filtered; }
  }

  let rosterY = pageHeight - MARGIN - 1.3;
  if (coaches.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.coachesTitle || 'Coaches:',
      names: coaches, x: rightPageStart, y: rosterY, width: rightPageWidth,
      columns: 1, titleFontSize: 10, nameFontSize: 8,
      fontFamily: 'Source Sans Pro', titleColor: '#523D73',
      nameColor: '#1A1A1A', fontWeight: '600', zIndex: 10,
    });
    rosterY += 0.3 + (coaches.length * 0.14);
  }

  if (rosterNames.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames, x: rightPageStart, y: rosterY, width: rightPageWidth,
      columns: 4, titleFontSize: 10, nameFontSize: 7,
      fontFamily: 'Source Sans Pro', titleColor: '#1A1A1A',
      nameColor: '#333333', zIndex: 10,
    });
  }
}

// =============================================================================
// LAYOUT: MIXED RIGHT (Mirror of mixed-left: body+photos left, title+photos right)
// =============================================================================
function buildMixedRightLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // LEFT PAGE: Photos on top, body copy + roster below
  const leftPhotoCount = Math.ceil(photoCount * 0.5);
  const leftPhotos = photos.slice(0, leftPhotoCount);
  const leftPhotoHeight = (pageHeight - 2 * MARGIN) * 0.55;

  if (leftPhotos.length > 0) {
    const leftPhotoElements = buildPhotoGrid(leftPhotos, {
      startX: leftPageStart, startY: MARGIN,
      maxX: leftPageEnd, maxY: MARGIN + leftPhotoHeight, GAP
    }, 0, photoCaptions);
    elements.push(...leftPhotoElements);
  }

  let leftY = MARGIN + leftPhotoHeight + 0.2;
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftPageStart, y: leftY, width: leftPageWidth, height: 2.5,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
    leftY += 2.6;
  }

  const { coaches, rosterNames } = extractCoaches(pageContent);
  if (coaches.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.coachesTitle || 'Coaches:',
      names: coaches, x: leftPageStart, y: leftY, width: leftPageWidth,
      columns: 1, titleFontSize: 10, nameFontSize: 8,
      fontFamily: 'Source Sans Pro', titleColor: '#523D73',
      nameColor: '#1A1A1A', fontWeight: '600', zIndex: 10,
    });
    leftY += 0.3 + (coaches.length * 0.16);
  }
  if (rosterNames.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames, x: leftPageStart, y: leftY, width: leftPageWidth,
      columns: 4, titleFontSize: 10, nameFontSize: 7,
      fontFamily: 'Source Sans Pro', titleColor: '#1A1A1A', nameColor: '#333333', zIndex: 10,
    });
  }

  // RIGHT PAGE: Title block at top + photos below
  let rightY = addTitleBlock(elements, pageContent, {
    x: rightPageStart, y: MARGIN, width: rightPageWidth, align: 'right',
  });
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: rightPageStart + rightPageWidth * 0.3, y: rightY, width: rightPageWidth * 0.7,
      fontSize: 13, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    rightY += 0.4;
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: rightPageEnd - 1.5, y: rightY, width: 1.5,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    rightY += 0.35;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: rightPageEnd - 2, y: rightY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    rightY += 0.3;
  }
  rightY += 0.15;

  const rightPhotos = photos.slice(leftPhotoCount);
  if (rightPhotos.length > 0) {
    const rightPhotoElements = buildPhotoGrid(rightPhotos, {
      startX: rightPageStart, startY: rightY,
      maxX: rightPageEnd, maxY: pageHeight - MARGIN, GAP
    }, leftPhotoCount, photoCaptions);
    elements.push(...rightPhotoElements);
  }
}

// =============================================================================
// LAYOUT: TOP HEAVY (Title + big photos across top, text + small photos bottom)
// =============================================================================
function buildTopHeavyLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;
  const topHeight = (pageHeight - 2 * MARGIN) * 0.45;

  // Title block on left page top
  let leftY = addTitleBlock(elements, pageContent, {
    x: leftPageStart, y: MARGIN, width: leftPageWidth, compact: true,
  });
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: leftPageStart, y: leftY, width: leftPageWidth * 0.65,
      fontSize: 12, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    leftY += 0.35;
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: leftPageStart, y: leftY, width: 1.5,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    leftY += 0.3;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: leftPageStart, y: leftY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    leftY += 0.25;
  }

  // Big photos on right page top
  const topPhotoCount = Math.min(Math.ceil(photoCount * 0.4), photoCount);
  const topPhotos = photos.slice(0, topPhotoCount);
  if (topPhotos.length > 0) {
    const topElements = buildPhotoGrid(topPhotos, {
      startX: rightPageStart, startY: MARGIN,
      maxX: rightPageEnd, maxY: MARGIN + topHeight + 1.5, GAP
    }, 0, photoCaptions);
    elements.push(...topElements);
  }

  // Bottom half: body text on left, remaining photos on right
  const bottomY = MARGIN + topHeight + 1.8;

  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftPageStart, y: bottomY, width: leftPageWidth, height: 2.5,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
  }

  // Remaining photos on bottom right
  const bottomPhotos = photos.slice(topPhotoCount);
  if (bottomPhotos.length > 0) {
    const bottomElements = buildPhotoGrid(bottomPhotos, {
      startX: rightPageStart, startY: bottomY,
      maxX: rightPageEnd, maxY: pageHeight - MARGIN - 1.0, GAP
    }, topPhotoCount, photoCaptions);
    elements.push(...bottomElements);
  }

  // Roster at bottom spanning both pages
  const { coaches, rosterNames } = extractCoaches(pageContent);
  let rosterY = pageHeight - MARGIN - 1.0;
  if (coaches.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.coachesTitle || 'Coaches:',
      names: coaches, x: leftPageStart, y: rosterY, width: leftPageWidth,
      columns: 1, titleFontSize: 10, nameFontSize: 8,
      fontFamily: 'Source Sans Pro', titleColor: '#523D73',
      nameColor: '#1A1A1A', fontWeight: '600', zIndex: 10,
    });
    rosterY += 0.3 + (coaches.length * 0.14);
  }
  if (rosterNames.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames, x: leftPageStart, y: rosterY, width: leftPageWidth,
      columns: 4, titleFontSize: 10, nameFontSize: 7,
      fontFamily: 'Source Sans Pro', titleColor: '#1A1A1A', nameColor: '#333333', zIndex: 10,
    });
  }
}

// =============================================================================
// LAYOUT: SIDEBAR (Narrow photo strip on one side, main content + photos other)
// =============================================================================
function buildSidebarLayout(elements, photos, pageContent, bounds, side = 'left') {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;
  const sidebarCount = Math.min(Math.ceil(photoCount * 0.35), 4);
  const sidebarPhotos = photos.slice(0, sidebarCount);
  const mainPhotos = photos.slice(sidebarCount);

  if (side === 'left') {
    // LEFT: Vertical strip of photos
    const stripWidth = leftPageWidth * 0.4;
    const photoH = (pageHeight - 2 * MARGIN - (sidebarCount - 1) * GAP) / sidebarCount;
    for (let i = 0; i < sidebarPhotos.length; i++) {
      elements.push({
        type: 'photo', photoIndex: i,
        x: leftPageStart, y: MARGIN + i * (photoH + GAP),
        width: stripWidth, height: photoH,
        borderRadius: 0, shadow: false, blackAndWhite: i === 0,
        zIndex: 1, cropFit: 'cover',
      });
    }

    // LEFT: Text next to photo strip
    const textX = leftPageStart + stripWidth + GAP * 2;
    const textW = leftPageEnd - textX;
    addTextContent(elements, pageContent, {
      startX: textX, endX: leftPageEnd, width: textW,
      pageHeight, MARGIN, compact: true
    });

    // RIGHT: Main photo grid
    if (mainPhotos.length > 0) {
      const mainElements = buildPhotoGrid(mainPhotos, {
        startX: rightPageStart, startY: MARGIN,
        maxX: rightPageEnd, maxY: pageHeight - MARGIN, GAP
      }, sidebarCount, photoCaptions);
      elements.push(...mainElements);
    }
  } else {
    // LEFT: Main photo grid
    if (mainPhotos.length > 0) {
      const mainElements = buildPhotoGrid(mainPhotos, {
        startX: leftPageStart, startY: MARGIN,
        maxX: leftPageEnd, maxY: pageHeight - MARGIN, GAP
      }, sidebarCount, photoCaptions);
      elements.push(...mainElements);
    }

    // RIGHT: Text with photo strip on far right
    const stripWidth = rightPageWidth * 0.4;
    const textW = rightPageWidth - stripWidth - GAP * 2;
    addTextContent(elements, pageContent, {
      startX: rightPageStart, endX: rightPageStart + textW, width: textW,
      pageHeight, MARGIN, compact: true
    });

    // RIGHT: Vertical photo strip
    const stripX = rightPageEnd - stripWidth;
    const photoH = (pageHeight - 2 * MARGIN - (sidebarCount - 1) * GAP) / sidebarCount;
    for (let i = 0; i < sidebarPhotos.length; i++) {
      elements.push({
        type: 'photo', photoIndex: i,
        x: stripX, y: MARGIN + i * (photoH + GAP),
        width: stripWidth, height: photoH,
        borderRadius: 0, shadow: false, blackAndWhite: i === 0,
        zIndex: 1, cropFit: 'cover',
      });
    }
  }
}

// =============================================================================
// LAYOUT: L-SHAPE (Photos in L along left+bottom, text in top-right)
// =============================================================================
function buildLShapeLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // Left page: full column of photos
  const leftPhotoCount = Math.min(Math.ceil(photoCount * 0.45), photoCount - 1);
  const leftPhotos = photos.slice(0, leftPhotoCount);
  if (leftPhotos.length > 0) {
    const leftElements = buildPhotoGrid(leftPhotos, {
      startX: leftPageStart, startY: MARGIN,
      maxX: leftPageEnd, maxY: pageHeight - MARGIN, GAP
    }, 0, photoCaptions);
    elements.push(...leftElements);
  }

  // Right page top: text content
  const textEndY = addTextContent(elements, pageContent, {
    startX: rightPageStart, endX: rightPageEnd, width: rightPageWidth,
    pageHeight, MARGIN, compact: true
  });

  // Right page bottom: horizontal strip of remaining photos (the "L" bottom)
  const rightPhotos = photos.slice(leftPhotoCount);
  const bottomY = Math.max(textEndY + 0.1, pageHeight - MARGIN - 3.0);
  if (rightPhotos.length > 0) {
    const bottomElements = buildPhotoGrid(rightPhotos, {
      startX: rightPageStart, startY: bottomY,
      maxX: rightPageEnd, maxY: pageHeight - MARGIN, GAP
    }, leftPhotoCount, photoCaptions);
    elements.push(...bottomElements);
  }
}

// =============================================================================
// LAYOUT: STAGGERED (Photos at varying heights for dynamic feel)
// =============================================================================
function buildStaggeredLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // Title on right page (top)
  let rightY = addTitleBlock(elements, pageContent, {
    x: rightPageStart, y: MARGIN, width: rightPageWidth,
  });

  // Left page: staggered columns of photos
  const leftColW = (leftPageWidth - GAP) / 2;
  const col1Photos = [];
  const col2Photos = [];
  for (let i = 0; i < Math.min(photoCount, 6); i++) {
    if (i % 2 === 0) col1Photos.push(i);
    else col2Photos.push(i);
  }

  // Column 1 starts at top
  let col1Y = MARGIN;
  for (const idx of col1Photos) {
    const h = (pageHeight - 2 * MARGIN) / col1Photos.length - GAP;
    elements.push({
      type: 'photo', photoIndex: idx,
      x: leftPageStart, y: col1Y, width: leftColW, height: h,
      borderRadius: 0, shadow: false, blackAndWhite: idx === 0,
      zIndex: 1, cropFit: 'cover',
    });
    col1Y += h + GAP;
  }

  // Column 2 starts offset (staggered)
  let col2Y = MARGIN + 1.2;  // Offset for stagger effect
  for (const idx of col2Photos) {
    const h = (pageHeight - 2 * MARGIN - 1.2) / Math.max(col2Photos.length, 1) - GAP;
    elements.push({
      type: 'photo', photoIndex: idx,
      x: leftPageStart + leftColW + GAP, y: col2Y, width: leftColW, height: h,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
    col2Y += h + GAP;
  }

  // Right page: headline, body, remaining photos
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: rightPageStart, y: rightY, width: rightPageWidth * 0.65,
      fontSize: 13, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    rightY += 0.4;
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: rightPageStart, y: rightY, width: 1.5,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    rightY += 0.3;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: rightPageStart, y: rightY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    rightY += 0.3;
  }

  if (pageContent.bodyCopy) {
    rightY += 0.15;
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: rightPageStart, y: rightY, width: rightPageWidth, height: 2.5,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
    rightY += 2.6;
  }

  // Remaining photos on right page
  const remainingPhotos = photos.slice(Math.min(6, photoCount));
  if (remainingPhotos.length > 0) {
    const remElements = buildPhotoGrid(remainingPhotos, {
      startX: rightPageStart, startY: rightY,
      maxX: rightPageEnd, maxY: pageHeight - MARGIN - 1.0, GAP
    }, Math.min(6, photoCount), photoCaptions);
    elements.push(...remElements);
  }

  // Roster at bottom right
  const { coaches, rosterNames } = extractCoaches(pageContent);
  let rosterY = pageHeight - MARGIN - 0.9;
  if (coaches.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.coachesTitle || 'Coaches:',
      names: coaches, x: rightPageStart, y: rosterY, width: rightPageWidth,
      columns: 1, titleFontSize: 10, nameFontSize: 8,
      fontFamily: 'Source Sans Pro', titleColor: '#523D73',
      nameColor: '#1A1A1A', fontWeight: '600', zIndex: 10,
    });
    rosterY += 0.3 + (coaches.length * 0.14);
  }
  if (rosterNames.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames, x: rightPageStart, y: rosterY, width: rightPageWidth,
      columns: 4, titleFontSize: 10, nameFontSize: 7,
      fontFamily: 'Source Sans Pro', titleColor: '#1A1A1A', nameColor: '#333333', zIndex: 10,
    });
  }
}

// =============================================================================
// HELPER: Extract coaches from roster
// =============================================================================
function extractCoaches(pageContent) {
  let coaches = pageContent.coaches || [];
  let rosterNames = pageContent.roster || [];

  if (coaches.length === 0 && rosterNames.length > 0) {
    const extracted = [];
    const filtered = [];
    for (const name of rosterNames) {
      if (/\(coach\)/i.test(name)) {
        extracted.push(name.replace(/\s*\(coach\)\s*/gi, '').trim());
      } else {
        filtered.push(name);
      }
    }
    if (extracted.length > 0) { coaches = extracted; rosterNames = filtered; }
  }

  return { coaches, rosterNames };
}

// =============================================================================
// HELPER: Add title block (pageTitle + section name) - used by ALL templates
// =============================================================================
function addTitleBlock(elements, pageContent, { x, y, width, compact = false, align = 'left' }) {
  let currentY = y;

  // PAGE TITLE - Big themed title (e.g., "BUILDING A LEGACY")
  if (pageContent.pageTitle) {
    // Estimate if title will wrap based on character count vs available width
    const titleLen = (pageContent.pageTitle || '').length;
    const willWrap = titleLen > 15;  // Rough estimate for large font
    const fontSize = compact ? 36 : 42;

    elements.push({
      type: 'pageTitle',
      text: pageContent.pageTitle,
      themeWord: pageContent.pageTitleThemeWord || null,
      x, y: currentY, width,
      fontSize,
      fontFamily: 'Playfair Display',
      fontWeight: '900',
      color: '#1A1A1A',
      textAlign: align,
      letterSpacing: 1,
      zIndex: 10,
    });
    // More space if title wraps to multiple lines
    currentY += willWrap ? (compact ? 1.0 : 1.2) : (compact ? 0.7 : 0.85);
  }

  // SECTION NAME - Smaller subtitle (e.g., "BOY'S SOCCER")
  if (pageContent.section) {
    elements.push({
      type: 'sectionHeader',
      text: pageContent.section,
      x, y: currentY, width,
      fontSize: compact ? 14 : 16,
      fontFamily: 'Source Sans Pro',
      fontWeight: '600',
      color: '#523D73',
      textAlign: align,
      textTransform: 'uppercase',
      letterSpacing: 3,
      zIndex: 10,
    });
    currentY += compact ? 0.3 : 0.35;
  }

  return currentY;
}

// =============================================================================
// HELPER: Add text content to a page
// =============================================================================
function addTextContent(elements, pageContent, options) {
  const { startX, endX, width, pageHeight, MARGIN, flipped = false, compact = false } = options;

  // Use shared title block helper
  let currentY = addTitleBlock(elements, pageContent, {
    x: startX, y: compact ? 0.6 : 0.5, width, compact,
  });

  // Headline with purple bar
  if (pageContent.headline) {
    elements.push({
      type: 'headline',
      text: pageContent.headline,
      x: startX,
      y: currentY,
      width: width * 0.75,
      fontSize: compact ? 12 : 14,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
    currentY += compact ? 0.4 : 0.5;
  }

  // Record with purple bar
  if (pageContent.record) {
    currentY += 0.1;
    elements.push({
      type: 'record',
      text: pageContent.record,
      x: startX,
      y: currentY,
      width: 1.5,
      fontSize: compact ? 11 : 12,
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      color: '#FFFFFF',
      backgroundColor: '#523D73',
      zIndex: 10,
    });
    currentY += compact ? 0.35 : 0.4;
  }

  // Date on its own line (no purple bar, clean look)
  if (pageContent.dateOrYear) {
    currentY += 0.05;
    elements.push({
      type: 'date',
      text: pageContent.dateOrYear,
      x: startX,
      y: currentY,
      width: 2,
      fontSize: compact ? 10 : 11,
      fontFamily: 'Source Sans Pro',
      fontWeight: '600',
      color: '#523D73',
      textTransform: 'uppercase',
      letterSpacing: 1,
      zIndex: 10,
    });
    currentY += compact ? 0.25 : 0.3;
  }

  // Body copy - use larger font and more height to fill space
  if (pageContent.bodyCopy) {
    currentY += 0.15; // Small gap before body
    elements.push({
      type: 'bodyCopy',
      text: pageContent.bodyCopy,
      x: startX,
      y: currentY,
      width: width,
      height: compact ? 2.5 : 4.0,  // Fixed height with overflow hidden
      fontSize: compact ? 9 : 10,
      fontFamily: 'Source Sans Pro',
      fontWeight: '400',
      color: '#1A1A1A',
      lineHeight: 1.5,
      columns: 2,
      textAlign: 'justify',
      zIndex: 10,
    });
    currentY += compact ? 2.8 : 4.3;  // Body height + clear gap
  }

  // Auto-extract coaches from roster if they have "(Coach)" in their name
  let coaches = pageContent.coaches || [];
  let rosterNames = pageContent.roster || [];

  // If no explicit coaches list, extract from roster
  if (coaches.length === 0 && rosterNames.length > 0) {
    const extractedCoaches = [];
    const filteredRoster = [];

    for (const name of rosterNames) {
      if (/\(coach\)/i.test(name)) {
        // Remove "(Coach)" and clean up the name
        extractedCoaches.push(name.replace(/\s*\(coach\)\s*/gi, '').trim());
      } else {
        filteredRoster.push(name);
      }
    }

    if (extractedCoaches.length > 0) {
      coaches = extractedCoaches;
      rosterNames = filteredRoster;
    }
  }

  // Coaches section - separate from roster with bold styling
  if (coaches.length > 0) {
    currentY += 0.25;
    elements.push({
      type: 'roster',
      title: pageContent.coachesTitle || 'Coaches:',
      names: coaches,
      x: startX,
      y: currentY,
      width: width,
      columns: 1,  // Coaches in single column for prominence
      titleFontSize: compact ? 10 : 12,
      nameFontSize: compact ? 8 : 9,  // Slightly larger than roster
      fontFamily: 'Source Sans Pro',
      titleColor: '#523D73',  // Purple for coaches title
      nameColor: '#1A1A1A',   // Darker for coach names
      fontWeight: '600',      // Semi-bold
      zIndex: 10,
    });
    // Coaches take less space (fewer people, single column)
    const coachesHeight = 0.3 + (coaches.length * 0.16);
    currentY += Math.min(coachesHeight, compact ? 0.8 : 1.2);
  }

  // Roster - larger to fill space
  if (rosterNames.length > 0) {
    currentY += 0.2;
    elements.push({
      type: 'roster',
      title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames,
      x: startX,
      y: currentY,
      width: width,
      columns: compact ? 4 : 3,     // More columns to spread out
      titleFontSize: compact ? 10 : 12,  // Larger title
      nameFontSize: compact ? 7 : 8,     // Larger names
      fontFamily: 'Source Sans Pro',
      titleColor: '#1A1A1A',
      nameColor: '#333333',
      zIndex: 10,
    });
    // Estimate roster height based on number of names
    const namesPerColumn = Math.ceil(rosterNames.length / (compact ? 4 : 3));
    const rosterHeight = 0.3 + (namesPerColumn * 0.14); // title + names
    currentY += Math.min(rosterHeight, compact ? 2.0 : 3.0);
  }

  // Return the Y position where text content ends (for photo placement)
  return currentY;
}

// =============================================================================
// HELPER: Build photo grid for a given area
// =============================================================================
function buildPhotoGrid(photos, bounds, startIndex = 0, photoCaptions = []) {
  const elements = [];
  const photoCount = photos.length;
  if (photoCount === 0) return elements;

  const { startX, startY, maxX, maxY, GAP } = bounds;
  const availableWidth = maxX - startX;
  // Reserve space for captions below photos (0.55" per caption row)
  const captionReserve = photoCaptions.length > 0 ? 0.55 : 0;
  const availableHeight = maxY - startY - captionReserve;

  const dominantIdx = photos.findIndex(p => p.isPrimary);
  const primaryIdx = dominantIdx >= 0 ? dominantIdx : 0;

  // Helper to get caption for a photo
  const getCaptionData = (index) => {
    const caption = photoCaptions.find(c => c.photoIndex === index) || photoCaptions[index];
    if (caption) {
      let text = '';
      const people = caption.people || '';
      const captionText = caption.caption || '';
      const captionTitle = caption.captionTitle || null;

      const isPlaceholder = (str) => {
        if (!str) return true;
        const lower = str.toLowerCase();
        return lower.includes('needs info') ||
               lower.includes('names needed') ||
               lower.includes('[') ||
               lower.includes('tbd') ||
               lower.includes('placeholder') ||
               str.trim() === '';
      };

      // Avoid repeating name: if caption already starts with the person's name, just use caption
      const captionStartsWithName = !isPlaceholder(people) && !isPlaceholder(captionText) &&
        captionText.toLowerCase().startsWith(people.split(',')[0].trim().toLowerCase());

      if (captionStartsWithName) {
        text = captionText;
      } else {
        if (!isPlaceholder(people)) text += people;
        if (text && !isPlaceholder(captionText)) text += ' — ';
        if (!isPlaceholder(captionText)) text += captionText;
      }

      const finalCaption = text.trim() || null;
      return { caption: finalCaption, captionTitle: captionTitle || null };
    }
    return { caption: null, captionTitle: null };
  };

  if (photoCount === 1) {
    // Single photo fills the entire space
    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: availableWidth, height: availableHeight,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
      ...getCaptionData(startIndex),
    });
  } else if (photoCount === 2) {
    // Two photos: large one on top, smaller below (fills full height)
    const topH = availableHeight * 0.65;
    const botH = availableHeight - topH - GAP;
    elements.push({
      type: 'photo', photoIndex: startIndex + primaryIdx,
      x: startX, y: startY,
      width: availableWidth, height: topH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + (primaryIdx === 0 ? 1 : 0),
      x: startX, y: startY + topH + GAP,
      width: availableWidth, height: botH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 2, cropFit: 'cover',
    });
  } else if (photoCount === 3) {
    // Three photos: large one on top, two smaller below (fills full height)
    const topH = availableHeight * 0.6;
    const botH = availableHeight - topH - GAP;
    const botW = (availableWidth - GAP) / 2;
    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: availableWidth, height: topH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + 1,
      x: startX, y: startY + topH + GAP,
      width: botW, height: botH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 2, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + 2,
      x: startX + botW + GAP, y: startY + topH + GAP,
      width: botW, height: botH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 2, cropFit: 'cover',
    });
  } else if (photoCount === 4) {
    // 4 photos: 2x2 grid filling full space
    const cellW = (availableWidth - GAP) / 2;
    const cellH = (availableHeight - GAP) / 2;

    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: cellW, height: cellH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + 1,
      x: startX + cellW + GAP, y: startY,
      width: cellW, height: cellH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + 2,
      x: startX, y: startY + cellH + GAP,
      width: cellW, height: cellH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + 3,
      x: startX + cellW + GAP, y: startY + cellH + GAP,
      width: cellW, height: cellH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
  } else if (photoCount <= 6) {
    // 5-6 photos: large on top left, others fill rest
    const domW = availableWidth * 0.6;
    const domH = availableHeight * 0.6;
    const sideW = availableWidth - domW - GAP;
    const sideH = (domH - GAP) / 2;
    const botH = availableHeight - domH - GAP;

    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: domW, height: domH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });

    // Side photos (2)
    for (let i = 1; i <= 2 && i < photoCount; i++) {
      elements.push({
        type: 'photo', photoIndex: startIndex + i,
        x: startX + domW + GAP, y: startY + (i - 1) * (sideH + GAP),
        width: sideW, height: sideH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 2, cropFit: 'cover',
      });
    }

    // Bottom row (up to 3)
    const botCount = Math.min(photoCount - 3, 3);
    if (botCount > 0) {
      const botW = (availableWidth - (botCount - 1) * GAP) / botCount;
      for (let i = 0; i < botCount; i++) {
        elements.push({
          type: 'photo', photoIndex: startIndex + 3 + i,
          x: startX + i * (botW + GAP), y: startY + domH + GAP,
          width: botW, height: botH,
          borderRadius: 0, shadow: false, blackAndWhite: false,
          zIndex: 1, cropFit: 'cover',
        });
      }
    }
  } else if (photoCount <= 8) {
    // Dominant + 2 side + bottom row (reduced from 3 side to prevent thin strips)
    const domW = availableWidth * 0.55;
    const domH = availableHeight * 0.55;
    const sideW = availableWidth - domW - GAP;
    const sideH = (domH - GAP) / 2;  // 2 side photos instead of 3
    const bottomH = availableHeight - domH - GAP;

    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: domW, height: domH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });

    for (let i = 1; i <= 2 && i < photoCount; i++) {
      elements.push({
        type: 'photo', photoIndex: startIndex + i,
        x: startX + domW + GAP, y: startY + (i - 1) * (sideH + GAP),
        width: sideW, height: sideH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 2, cropFit: 'cover',
      });
    }

    const bottomCount = Math.min(photoCount - 3, 5);
    if (bottomCount > 0) {
      const bottomW = (availableWidth - (bottomCount - 1) * GAP) / bottomCount;
      for (let i = 0; i < bottomCount; i++) {
        elements.push({
          type: 'photo', photoIndex: startIndex + 3 + i,
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

  // Add captions to all photo elements
  return elements.map(el => {
    if (el.type === 'photo' && !el.caption && !el.captionTitle) {
      const data = getCaptionData(el.photoIndex);
      el.caption = data.caption;
      el.captionTitle = data.captionTitle;
    }
    return el;
  });
}

// =============================================================================
// SINGLE PAGE LAYOUT
// =============================================================================
function buildSinglePageLayout(elements, photos, pageContent, options) {
  const { pageWidth, pageHeight, MARGIN, GAP, photoCaptions = [] } = options;
  const contentWidth = pageWidth - 2 * MARGIN;

  // Title block
  const titleEndY = addTitleBlock(elements, pageContent, {
    x: MARGIN, y: 0.5, width: contentWidth,
  });

  // Headline
  if (pageContent.headline) {
    elements.push({
      type: 'headline',
      text: pageContent.headline,
      x: MARGIN,
      y: titleEndY + 0.1,
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
