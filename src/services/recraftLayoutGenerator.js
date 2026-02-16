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
 */
async function generateLayoutWithRecraft({ pageContent, theme, pageType = 'page', photoCount }) {
  const apiKey = process.env.RECRAFT_API_KEY;

  if (!apiKey) {
    console.log('Recraft API key not configured, falling back to Claude layout');
    return null;
  }

  const isSpread = pageType === 'spread';

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
        substyle: '2d_art_poster',
        model: 'recraftv3',
        size: isSpread ? '2048x1024' : '1024x1280',
        text_layouts: textLayouts,
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

  let prompt = `Professional yearbook page layout design for "${section}" section. `;
  prompt += `Clean editorial magazine style with ${photoCount} photo placeholder frames. `;
  prompt += `School: ${schoolName}. `;
  prompt += `Color scheme: deep purple (#523D73), white background, black text. `;

  if (isSpread) {
    prompt += `Two-page spread design (16x10.5 inches). `;
    prompt += `Left page: dominant large photo area with smaller supporting photos. `;
    prompt += `Right page: text content area with headline bars and body copy space. `;
  } else {
    prompt += `Single page design (8x10.5 inches). `;
  }

  prompt += `Features: `;
  prompt += `- Script/cursive section header in elegant style `;
  prompt += `- Bold uppercase school name `;
  prompt += `- Purple rectangular bars behind headlines `;
  prompt += `- Clean sans-serif body text areas `;
  prompt += `- Sharp-cornered photo frames (no rounded corners) `;
  prompt += `- Mix of large dominant photo and smaller supporting photos `;
  prompt += `- Professional magazine editorial aesthetic `;
  prompt += `Photo placeholder areas shown as gray rectangles with photo icons. `;
  prompt += `No gradients, no decorative swirls, no diagonal lines, minimal decorations. `;
  prompt += `Clean, professional, print-ready yearbook quality.`;

  return prompt;
}

/**
 * Build text_layouts array for precise text positioning
 */
function buildTextLayouts(pageContent, isSpread) {
  const layouts = [];

  // For a spread, text is on the right page (0.5-1.0 x range)
  const xOffset = isSpread ? 0.52 : 0.05;
  const textWidth = isSpread ? 0.43 : 0.9;

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
 * with proper element positioning
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
  }

  // Step 2: Generate precise element placements with proper spacing
  return buildSpreadLayout(pageContent, photos, theme, pageType);
}

/**
 * Build a properly spaced spread layout
 * This function creates distinct zones for photos and text to prevent overlaps
 */
function buildSpreadLayout(pageContent, photos, theme, pageType) {
  const isSpread = pageType === 'spread';
  const pageWidth = isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN;
  const pageHeight = PAGE.HEIGHT_IN;
  const photoCount = photos.length;

  const elements = [];

  // Define margins and safe areas
  const MARGIN = 0.375; // Safe margin from page edge
  const GUTTER = isSpread ? pageWidth / 2 : 0; // Center fold at 8"
  const GUTTER_MARGIN = 0.5; // Keep content away from center fold

  if (isSpread) {
    // =====================================================
    // SPREAD LAYOUT - Left page for photos, right for text
    // =====================================================

    // LEFT PAGE: 0.375" to 7.5" (respecting gutter)
    const leftPageStart = MARGIN;
    const leftPageEnd = GUTTER - GUTTER_MARGIN;
    const leftPageWidth = leftPageEnd - leftPageStart;

    // RIGHT PAGE: 8.5" to 15.625" (respecting margins)
    const rightPageStart = GUTTER + GUTTER_MARGIN;
    const rightPageEnd = pageWidth - MARGIN;
    const rightPageWidth = rightPageEnd - rightPageStart;

    // ----- RIGHT PAGE: TEXT CONTENT -----

    // Section header (script font, top right corner)
    if (pageContent.section) {
      elements.push({
        type: 'sectionHeader',
        text: pageContent.section,
        x: rightPageEnd - 2.5,
        y: 0.4,
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

    // School name (large, bold)
    if (pageContent.schoolName) {
      elements.push({
        type: 'schoolName',
        text: pageContent.schoolName,
        x: rightPageStart,
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

    // Headline with purple background bar
    if (pageContent.headline) {
      elements.push({
        type: 'headline',
        text: pageContent.headline,
        x: rightPageStart,
        y: 2.0,
        width: rightPageWidth * 0.65,
        fontSize: 18,
        fontFamily: 'Playfair Display',
        fontWeight: '700',
        color: '#FFFFFF',
        backgroundColor: '#523D73',
        zIndex: 10,
      });
    }

    // Record/stats bar (purple)
    if (pageContent.record) {
      elements.push({
        type: 'record',
        text: pageContent.record,
        x: rightPageStart,
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

    // Date/Year (next to record)
    if (pageContent.dateOrYear) {
      elements.push({
        type: 'date',
        text: pageContent.dateOrYear,
        x: rightPageStart + 2.2,
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

    // Body copy (two columns)
    if (pageContent.bodyCopy) {
      elements.push({
        type: 'bodyCopy',
        text: pageContent.bodyCopy,
        x: rightPageStart,
        y: 3.3,
        width: rightPageWidth,
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

    // Roster (bottom of right page, full width)
    if (pageContent.roster?.length > 0) {
      elements.push({
        type: 'roster',
        title: pageContent.rosterTitle || 'Team Roster:',
        names: pageContent.roster,
        x: rightPageStart,
        y: 8.0,
        width: rightPageWidth,
        columns: 2,
        titleFontSize: 12,
        nameFontSize: 7,
        fontFamily: 'Source Sans Pro',
        titleColor: '#1A1A1A',
        nameColor: '#333333',
        zIndex: 10,
      });
    }

    // Quote (if present, positioned in body copy area)
    if (pageContent.quotes?.length > 0) {
      const quote = pageContent.quotes[0];
      elements.push({
        type: 'quote',
        text: quote.text,
        attribution: quote.attribution,
        x: rightPageStart + rightPageWidth * 0.55,
        y: 5.8,
        width: rightPageWidth * 0.42,
        fontSize: 12,
        fontFamily: 'Playfair Display',
        fontWeight: '700',
        fontStyle: 'italic',
        color: '#FFFFFF',
        backgroundColor: '#523D73',
        zIndex: 11,
      });
    }

    // ----- LEFT PAGE: PHOTOS -----
    const photoElements = buildPhotoLayout(photos, {
      startX: leftPageStart,
      startY: MARGIN,
      maxX: leftPageEnd,
      maxY: pageHeight - MARGIN,
      isSpread: true,
      pageContent,
    });
    elements.push(...photoElements);

    // ----- RIGHT PAGE: ADDITIONAL PHOTOS (if space available) -----
    // Place extra photos in the white space below body copy/above roster
    const usedPhotoIndices = new Set(photoElements.map(e => e.photoIndex));
    const remainingPhotos = photos.filter((_, i) => !usedPhotoIndices.has(i));

    if (remainingPhotos.length > 0) {
      // Add photos between body copy and roster (y: 7.2 to 7.9)
      const extraPhotoY = 7.2;
      const extraPhotoHeight = 1.8;
      const maxExtraPhotos = Math.min(remainingPhotos.length, 3);
      const extraPhotoWidth = (rightPageWidth - (maxExtraPhotos - 1) * 0.15) / maxExtraPhotos;

      for (let i = 0; i < maxExtraPhotos; i++) {
        const originalIndex = photos.findIndex((_, idx) => !usedPhotoIndices.has(idx) && !Array.from(usedPhotoIndices).slice(-i).includes(idx));
        const actualIndex = photos.indexOf(remainingPhotos[i]);

        elements.push({
          type: 'photo',
          photoIndex: actualIndex,
          x: rightPageStart + i * (extraPhotoWidth + 0.15),
          y: extraPhotoY,
          width: extraPhotoWidth,
          height: extraPhotoHeight,
          borderRadius: 0,
          shadow: false,
          blackAndWhite: false,
          zIndex: 1,
          cropFit: 'cover',
        });
        usedPhotoIndices.add(actualIndex);
      }

      // Adjust roster position down if we added photos
      const rosterElement = elements.find(e => e.type === 'roster');
      if (rosterElement) {
        rosterElement.y = 9.2;
      }
    }

  } else {
    // =====================================================
    // SINGLE PAGE LAYOUT
    // =====================================================

    const contentWidth = pageWidth - (MARGIN * 2);

    // Section header (top right)
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

    // Photos for single page
    const photoElements = buildPhotoLayout(photos, {
      startX: MARGIN,
      startY: 2.5,
      maxX: pageWidth - MARGIN,
      maxY: pageHeight - 2,
      isSpread: false,
    });
    elements.push(...photoElements);

    // Body copy (bottom portion)
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
        fontWeight: '400',
        color: '#1A1A1A',
        lineHeight: 1.35,
        columns: 2,
        zIndex: 10,
      });
    }
  }

  // Folio (page numbers)
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

/**
 * Build photo layout within specified bounds
 * Creates a clean, non-overlapping photo arrangement
 */
function buildPhotoLayout(photos, bounds) {
  const elements = [];
  const photoCount = photos.length;

  if (photoCount === 0) return elements;

  const { startX, startY, maxX, maxY, isSpread, pageContent } = bounds;
  const availableWidth = maxX - startX;
  const availableHeight = maxY - startY;

  // Find primary photo index
  const primaryIdx = photos.findIndex(p => p.isPrimary);
  const dominantIdx = primaryIdx >= 0 ? primaryIdx : 0;

  if (isSpread) {
    // ===========================================
    // SPREAD LAYOUT: Professional magazine style
    // ===========================================
    // Grid: Large dominant photo + 2-3 supporting photos
    // All photos stay within the left page bounds

    const GAP = 0.15; // Gap between photos

    if (photoCount === 1) {
      // Single photo - make it large and centered
      elements.push({
        type: 'photo',
        photoIndex: 0,
        x: startX,
        y: startY + 0.5,
        width: availableWidth,
        height: availableHeight - 1,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: true,
        zIndex: 1,
        cropFit: 'cover',
      });
    } else if (photoCount === 2) {
      // Two photos - large on left, medium on right
      const dominantWidth = availableWidth * 0.65;
      const secondaryWidth = availableWidth - dominantWidth - GAP;

      elements.push({
        type: 'photo',
        photoIndex: dominantIdx,
        x: startX,
        y: startY,
        width: dominantWidth,
        height: availableHeight * 0.75,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: true,
        zIndex: 1,
        cropFit: 'cover',
      });

      elements.push({
        type: 'photo',
        photoIndex: dominantIdx === 0 ? 1 : 0,
        x: startX + dominantWidth + GAP,
        y: startY,
        width: secondaryWidth,
        height: availableHeight * 0.5,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: false,
        zIndex: 2,
        cropFit: 'cover',
      });
    } else if (photoCount === 3) {
      // Three photos - large dominant + 2 stacked on right
      const dominantWidth = availableWidth * 0.6;
      const secondaryWidth = availableWidth - dominantWidth - GAP;
      const secondaryHeight = (availableHeight * 0.7 - GAP) / 2;

      // Dominant (large, B&W)
      elements.push({
        type: 'photo',
        photoIndex: dominantIdx,
        x: startX,
        y: startY,
        width: dominantWidth,
        height: availableHeight * 0.7,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: true,
        zIndex: 1,
        cropFit: 'cover',
      });

      // Two stacked photos on right
      let secondaryIdx = 0;
      for (let i = 0; i < photoCount && secondaryIdx < 2; i++) {
        if (i === dominantIdx) continue;

        elements.push({
          type: 'photo',
          photoIndex: i,
          x: startX + dominantWidth + GAP,
          y: startY + secondaryIdx * (secondaryHeight + GAP),
          width: secondaryWidth,
          height: secondaryHeight,
          borderRadius: 0,
          shadow: false,
          blackAndWhite: false,
          zIndex: 2,
          cropFit: 'cover',
        });
        secondaryIdx++;
      }
    } else if (photoCount <= 6) {
      // 4-6 photos - dominant + 2 on right + bottom row (up to 3)
      const dominantWidth = availableWidth * 0.58;
      const dominantHeight = availableHeight * 0.6;
      const secondaryWidth = availableWidth - dominantWidth - GAP;
      const secondaryHeight = (dominantHeight - GAP) / 2;
      const bottomHeight = availableHeight - dominantHeight - GAP;

      // Dominant photo (large, B&W)
      elements.push({
        type: 'photo',
        photoIndex: dominantIdx,
        x: startX,
        y: startY,
        width: dominantWidth,
        height: dominantHeight,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: true,
        zIndex: 1,
        cropFit: 'cover',
      });

      // Two stacked photos on right of dominant
      const usedPhotos = new Set([dominantIdx]);
      let sideIdx = 0;
      for (let i = 0; i < photoCount && sideIdx < 2; i++) {
        if (i === dominantIdx) continue;

        elements.push({
          type: 'photo',
          photoIndex: i,
          x: startX + dominantWidth + GAP,
          y: startY + sideIdx * (secondaryHeight + GAP),
          width: secondaryWidth,
          height: secondaryHeight,
          borderRadius: 0,
          shadow: false,
          blackAndWhite: false,
          zIndex: 2,
          cropFit: 'cover',
        });
        usedPhotos.add(i);
        sideIdx++;
      }

      // Bottom row - remaining photos (up to 3)
      const remainingPhotos = [];
      for (let i = 0; i < photoCount; i++) {
        if (!usedPhotos.has(i)) remainingPhotos.push(i);
      }

      if (remainingPhotos.length > 0) {
        const bottomPhotoCount = Math.min(remainingPhotos.length, 3);
        const bottomPhotoWidth = (availableWidth - (bottomPhotoCount - 1) * GAP) / bottomPhotoCount;

        for (let i = 0; i < bottomPhotoCount; i++) {
          elements.push({
            type: 'photo',
            photoIndex: remainingPhotos[i],
            x: startX + i * (bottomPhotoWidth + GAP),
            y: startY + dominantHeight + GAP,
            width: bottomPhotoWidth,
            height: bottomHeight,
            borderRadius: 0,
            shadow: false,
            blackAndWhite: false,
            zIndex: 1,
            cropFit: 'cover',
          });
        }
      }
    } else {
      // 7+ photos - maximize usage with grid layout
      // Top section: dominant + 3 stacked on right
      // Bottom section: row of 4 photos
      const dominantWidth = availableWidth * 0.55;
      const dominantHeight = availableHeight * 0.55;
      const secondaryWidth = availableWidth - dominantWidth - GAP;
      const secondaryHeight = (dominantHeight - 2 * GAP) / 3;
      const bottomHeight = availableHeight - dominantHeight - GAP;

      // Dominant photo (large, B&W)
      elements.push({
        type: 'photo',
        photoIndex: dominantIdx,
        x: startX,
        y: startY,
        width: dominantWidth,
        height: dominantHeight,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: true,
        zIndex: 1,
        cropFit: 'cover',
      });

      // Three stacked photos on right of dominant
      const usedPhotos = new Set([dominantIdx]);
      let sideIdx = 0;
      for (let i = 0; i < photoCount && sideIdx < 3; i++) {
        if (i === dominantIdx) continue;

        elements.push({
          type: 'photo',
          photoIndex: i,
          x: startX + dominantWidth + GAP,
          y: startY + sideIdx * (secondaryHeight + GAP),
          width: secondaryWidth,
          height: secondaryHeight,
          borderRadius: 0,
          shadow: false,
          blackAndWhite: false,
          zIndex: 2,
          cropFit: 'cover',
        });
        usedPhotos.add(i);
        sideIdx++;
      }

      // Bottom row - up to 4 photos
      const remainingPhotos = [];
      for (let i = 0; i < photoCount; i++) {
        if (!usedPhotos.has(i)) remainingPhotos.push(i);
      }

      if (remainingPhotos.length > 0) {
        const bottomPhotoCount = Math.min(remainingPhotos.length, 4);
        const bottomPhotoWidth = (availableWidth - (bottomPhotoCount - 1) * GAP) / bottomPhotoCount;

        for (let i = 0; i < bottomPhotoCount; i++) {
          elements.push({
            type: 'photo',
            photoIndex: remainingPhotos[i],
            x: startX + i * (bottomPhotoWidth + GAP),
            y: startY + dominantHeight + GAP,
            width: bottomPhotoWidth,
            height: bottomHeight,
            borderRadius: 0,
            shadow: false,
            blackAndWhite: false,
            zIndex: 1,
            cropFit: 'cover',
          });
        }
      }
    }

  } else {
    // SINGLE PAGE: Grid layout
    const gridCols = photoCount <= 2 ? 2 : photoCount <= 4 ? 2 : 3;
    const gridRows = Math.ceil(photoCount / gridCols);
    const cellWidth = (availableWidth - (gridCols - 1) * 0.15) / gridCols;
    const cellHeight = (availableHeight - (gridRows - 1) * 0.15) / gridRows;

    // Make first photo larger if we have multiple photos
    if (photoCount > 1) {
      // Large photo spans 2 cells
      elements.push({
        type: 'photo',
        photoIndex: 0,
        x: startX,
        y: startY,
        width: cellWidth * 1.5,
        height: cellHeight * 1.2,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: true,
        zIndex: 1,
        cropFit: 'cover',
      });

      // Remaining photos in grid
      let col = 0;
      let row = 0;
      const smallStartX = startX + cellWidth * 1.5 + 0.15;

      for (let i = 1; i < photoCount; i++) {
        const x = col === 0 ? smallStartX : startX + col * (cellWidth * 0.8 + 0.15);
        const y = startY + (i === 1 ? 0 : cellHeight * 1.2 + 0.15) + row * (cellHeight * 0.8 + 0.15);

        elements.push({
          type: 'photo',
          photoIndex: i,
          x,
          y,
          width: cellWidth * 0.8,
          height: cellHeight * 0.8,
          borderRadius: 0,
          shadow: false,
          blackAndWhite: false,
          zIndex: 2,
          cropFit: 'cover',
        });

        col++;
        if (col >= 2) {
          col = 0;
          row++;
        }
      }
    } else {
      // Single photo - center it
      elements.push({
        type: 'photo',
        photoIndex: 0,
        x: startX,
        y: startY,
        width: availableWidth,
        height: availableHeight * 0.7,
        borderRadius: 0,
        shadow: false,
        blackAndWhite: true,
        zIndex: 1,
        cropFit: 'cover',
      });
    }
  }

  return elements;
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
