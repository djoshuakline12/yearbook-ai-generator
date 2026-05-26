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
  // _shuffleSalt changes on each shuffle to force different params
  const contentHash = hashString(
    (pageContent.section || '') +
    (pageContent.headline || '') +
    (pageContent.bodyCopy || '').slice(0, 50) +
    (pageContent._shuffleSalt || '') +
    photoCount
  );

  const hasLongBody = pageContent.bodyCopy && pageContent.bodyCopy.length > 500;
  const fewPhotos = photoCount <= 4;

  // Use multiple hash derivations for independent randomization of each parameter
  // This vastly increases combinatorial variety (up to 30+ distinct styles)
  const h1 = contentHash;
  const h2 = hashString(contentHash.toString() + 'salt2');
  const h3 = hashString(contentHash.toString() + 'salt3');
  const h4 = hashString(contentHash.toString() + 'salt4');
  const h5 = hashString(contentHash.toString() + 'salt5');
  const h6 = hashString(contentHash.toString() + 'salt6');

  const params = {
    // Which page gets the title: 'left' or 'right'
    titlePage: h1 % 2 === 0 ? 'left' : 'right',
    // Title alignment: 'left', 'center', 'right'
    titleAlign: ['left', 'center', 'right'][h2 % 3],
    // Photo split: fraction on title page (0.25 to 0.55 in 7 steps)
    titlePagePhotoRatio: 0.25 + (h2 % 7) * 0.05,
    // Title zone size: 0.15 to 0.32 in 6 steps
    titleZoneSize: 0.15 + (h3 % 6) * 0.035,
    // Photo zone end on title page: 0.60 to 0.85 in 6 steps
    titlePagePhotoEnd: 0.60 + (h4 % 6) * 0.05,
    // Photo zone end on photo page: 0.72 to 0.92 in 5 steps
    photoPagePhotoEnd: 0.72 + (h5 % 5) * 0.05,
    // Stagger offset for column 2: 0 to 2.1 in 8 steps
    staggerOffset: (h6 % 8) * 0.3,
    // Use staggered columns on photo page
    useStaggeredColumns: h3 % 3 === 0,
    // Body copy position: split across 4 options
    bodyPosition: ['bottom-title', 'bottom-photo', 'bottom-title', 'split'][h4 % 4],
    // Photo grid style: dominant left, dominant right, dominant top, balanced grid
    photoGridStyle: ['dominant-left', 'dominant-right', 'dominant-top', 'balanced', 'mosaic'][h5 % 5],
    // Title vertical position within title zone (top, middle, bottom)
    titleVerticalPos: ['top', 'middle', 'bottom'][h6 % 3],
    // Should the page use a horizontal hero band?
    useHorizontalHero: h1 % 5 === 0,
    // Hero band position (if enabled)
    heroBandPosition: ['top', 'middle', 'bottom'][h2 % 3],
    // Gap size between photos (tight, normal, loose)
    gapStyle: ['tight', 'normal', 'loose'][h3 % 3],
    // Whether to use asymmetric photo sizes
    asymmetric: h4 % 2 === 0,
  };

  console.log(`Layout params: title=${params.titlePage}/${params.titleAlign}, split=${params.titlePagePhotoRatio.toFixed(2)}, gridStyle=${params.photoGridStyle}, hero=${params.useHorizontalHero}`);

  return params;
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

    const bounds = {
      leftPageStart, leftPageEnd, leftPageWidth,
      rightPageStart, rightPageEnd, rightPageWidth,
      pageHeight, pageWidth, MARGIN, GAP,
      photoCaptions
    };

    // Dispatch based on pageCategory (activity is default)
    const category = pageContent.pageCategory || 'activity';

    if (category === 'collage') {
      buildCollageLayout(elements, photos, pageContent, bounds);
    } else if (category === 'divider') {
      buildDividerLayout(elements, photos, pageContent, bounds);
    } else if (category === 'index') {
      buildIndexLayout(elements, photos, pageContent, bounds);
    } else {
      // Default: activity spread with parameterized variety
      const layoutParams = chooseLayoutTemplate(pageContent, photoCount);
      buildParameterizedLayout(elements, photos, pageContent, bounds, layoutParams);
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
// PARAMETERIZED LAYOUT BUILDER — generates infinite variety from params
// =============================================================================
function buildParameterizedLayout(elements, photos, pageContent, bounds, params) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP: baseGap, photoCaptions = [] } = bounds;

  const photoCount = photos.length;
  const usableHeight = pageHeight - 2 * MARGIN;

  // Apply gap style variation
  const GAP = params.gapStyle === 'tight' ? baseGap * 0.5
    : params.gapStyle === 'loose' ? baseGap * 2
    : baseGap;

  // Determine which page is "title page" and which is "photo page"
  const isLeftTitle = params.titlePage === 'left';
  const titleX = isLeftTitle ? leftPageStart : rightPageStart;
  const titleW = isLeftTitle ? leftPageWidth : rightPageWidth;
  const titleEnd = isLeftTitle ? leftPageEnd : rightPageEnd;
  const photoX = isLeftTitle ? rightPageStart : leftPageStart;
  const photoW = isLeftTitle ? rightPageWidth : leftPageWidth;
  const photoEnd = isLeftTitle ? rightPageEnd : leftPageEnd;

  // Zone boundaries
  const titleZoneEnd = MARGIN + usableHeight * params.titleZoneSize;
  const titlePhotoEnd = MARGIN + usableHeight * params.titlePagePhotoEnd;
  const photoPagePhotoEnd = MARGIN + usableHeight * params.photoPagePhotoEnd;

  // Title vertical position within title zone
  let titleStartY = MARGIN;
  if (params.titleVerticalPos === 'middle') {
    titleStartY = MARGIN + (titleZoneEnd - MARGIN) * 0.3;
  } else if (params.titleVerticalPos === 'bottom') {
    titleStartY = MARGIN + (titleZoneEnd - MARGIN) * 0.5;
  }

  // === TITLE PAGE: Title at top ===
  addTitleBlock(elements, pageContent, {
    x: titleX, y: titleStartY, width: titleW, compact: true,
    align: params.titleAlign || (isLeftTitle ? 'left' : 'right'),
  });

  // Headline + record + date in title zone
  let metaY = titleZoneEnd - 0.6;
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: titleX, y: metaY, width: titleW * 0.65,
      fontSize: 12, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    metaY += 0.35;
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: titleX, y: metaY, width: 1.5,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    metaY += 0.3;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: titleX, y: metaY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
  }

  // === SPLIT PHOTOS BETWEEN BOTH PAGES ===
  // Always put photos on both pages, regardless of count
  const titlePageCount = Math.max(1, Math.min(
    Math.round(photoCount * params.titlePagePhotoRatio),
    photoCount - 1  // Leave at least 1 for the other page
  ));
  const photoPageCount = photoCount - titlePageCount;

  // Title page photos: between title zone and body zone
  const titlePagePhotos = photos.slice(0, titlePageCount);
  if (titlePagePhotos.length > 0) {
    const tpElements = buildPhotoGrid(titlePagePhotos, {
      startX: titleX, startY: titleZoneEnd,
      maxX: titleEnd, maxY: titlePhotoEnd, GAP
    }, 0, photoCaptions);
    elements.push(...tpElements);
  }

  // Photo page photos: fill most of the page
  const photoPagePhotos = photos.slice(titlePageCount);
  if (photoPagePhotos.length > 0) {
    if (params.useStaggeredColumns && photoPagePhotos.length >= 3) {
      // Staggered columns for variety
      const colW = (photoW - GAP) / 2;
      const col1 = [], col2 = [];
      photoPagePhotos.forEach((_, i) => (i % 2 === 0 ? col1 : col2).push(i));

      let y1 = MARGIN;
      for (const i of col1) {
        const h = (photoPagePhotoEnd - MARGIN) / col1.length - GAP;
        elements.push({
          type: 'photo', photoIndex: titlePageCount + i,
          x: photoX, y: y1, width: colW, height: h,
          borderRadius: 0, shadow: false, blackAndWhite: i === 0,
          zIndex: 1, cropFit: 'cover',
        });
        y1 += h + GAP;
      }
      let y2 = MARGIN + params.staggerOffset;
      for (const i of col2) {
        const h = (photoPagePhotoEnd - MARGIN - params.staggerOffset) / Math.max(col2.length, 1) - GAP;
        elements.push({
          type: 'photo', photoIndex: titlePageCount + i,
          x: photoX + colW + GAP, y: y2, width: colW, height: h,
          borderRadius: 0, shadow: false, blackAndWhite: false,
          zIndex: 1, cropFit: 'cover',
        });
        y2 += h + GAP;
      }
    } else {
      // Standard grid
      const ppElements = buildPhotoGrid(photoPagePhotos, {
        startX: photoX, startY: MARGIN,
        maxX: photoEnd, maxY: photoPagePhotoEnd, GAP
      }, titlePageCount, photoCaptions);
      elements.push(...ppElements);
    }
  }

  // === ADAPT TO ALL CONTENT THE USER PROVIDED ===
  // Build a list of secondary elements to place in the body area:
  // - bodyCopy
  // - quotes (pull-quote style)
  // - highlights
  // - roster + coaches
  // Each gets its own slot, sized to fit available space

  const hasBody = !!pageContent.bodyCopy;
  const quotes = (pageContent.quotes || []).filter(q => q && q.text && q.text.trim() && !q.text.includes('['));
  const hasQuotes = quotes.length > 0;
  const highlights = (pageContent.highlights || []).filter(h => h && typeof h === 'string' && h.trim() && !h.includes('['));
  const hasHighlights = highlights.length > 0;

  const { coaches, rosterNames } = extractCoaches(pageContent);
  const hasCoaches = coaches.length > 0;
  const hasRoster = rosterNames.length > 0;

  // Build list of all items first so we know how much vertical space they need
  const elementsToPlace = [];

  if (hasBody) {
    // Body copy is flexible — can shrink to 1.2" or expand to 3.5"
    elementsToPlace.push({ kind: 'bodyCopy', minHeight: 1.2, maxHeight: 3.5 });
  }
  // EACH quote becomes its own item — height scales with text length
  quotes.forEach((q, idx) => {
    const charsPerLine = 48;
    const estLines = Math.ceil((q.text || '').length / charsPerLine);
    const textHeight = estLines * 0.20;
    const attrHeight = q.attribution ? 0.22 : 0;
    const padding = 0.15;
    const naturalHeight = textHeight + attrHeight + padding;
    elementsToPlace.push({
      kind: 'quote',
      minHeight: Math.max(0.65, naturalHeight * 0.85),
      maxHeight: Math.max(1.0, naturalHeight + 0.15),
      data: q,
      idx,
    });
  });
  if (hasHighlights) {
    const itemsCount = highlights.length;
    elementsToPlace.push({
      kind: 'highlights',
      minHeight: 0.35 + itemsCount * 0.15,
      maxHeight: 0.45 + itemsCount * 0.20,
    });
  }
  if (hasCoaches) {
    elementsToPlace.push({
      kind: 'coaches',
      minHeight: 0.3 + coaches.length * 0.15,
      maxHeight: 0.35 + coaches.length * 0.2,
    });
  }
  if (hasRoster) {
    const rows = Math.ceil(rosterNames.length / 4);
    elementsToPlace.push({
      kind: 'roster',
      minHeight: 0.35 + rows * 0.14,
      maxHeight: 0.5 + rows * 0.2,
    });
  }

  // Calculate how much space the content needs (sum of min heights + gaps)
  const totalMinHeightNeeded = elementsToPlace.reduce((s, i) => s + i.minHeight, 0)
    + 0.15 * Math.max(0, elementsToPlace.length - 1);

  // Available bottom-zone height assuming default photo zones
  const defaultBottomSpace = (pageHeight - MARGIN - titlePhotoEnd - 0.1)
    + (pageHeight - MARGIN - photoPagePhotoEnd - 0.1);

  // If content needs more space than the default zones provide, shrink photos
  let adjustedTitlePhotoEnd = titlePhotoEnd;
  let adjustedPhotoPageEnd = photoPagePhotoEnd;
  if (totalMinHeightNeeded > defaultBottomSpace) {
    const shortfall = totalMinHeightNeeded - defaultBottomSpace;
    // Reduce each photo zone to make room — minimum photo height stays at 50% of page
    const minPhotoEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.50;
    const titleReduction = Math.min(adjustedTitlePhotoEnd - minPhotoEnd, shortfall / 2);
    const photoReduction = Math.min(adjustedPhotoPageEnd - minPhotoEnd, shortfall / 2);
    adjustedTitlePhotoEnd = Math.max(minPhotoEnd, adjustedTitlePhotoEnd - titleReduction);
    adjustedPhotoPageEnd = Math.max(minPhotoEnd, adjustedPhotoPageEnd - photoReduction);
  }

  // Two slots: under-title-page-photos AND under-photo-page-photos
  const titlePageBottom = {
    x: titleX,
    width: titleW,
    startY: adjustedTitlePhotoEnd + 0.1,
    endY: pageHeight - MARGIN - 0.1,
  };
  const photoPageBottom = {
    x: photoX,
    width: photoW,
    startY: adjustedPhotoPageEnd + 0.1,
    endY: pageHeight - MARGIN - 0.1,
  };

  // Update photo zone boundaries that were used earlier in this function
  // (rebuild photo grids with adjusted zones if needed)
  if (adjustedTitlePhotoEnd !== titlePhotoEnd || adjustedPhotoPageEnd !== photoPagePhotoEnd) {
    // Remove previously-placed photo elements and rebuild with adjusted zones
    const photoIndices = [];
    for (let i = elements.length - 1; i >= 0; i--) {
      if (elements[i].type === 'photo') photoIndices.push(i);
    }
    photoIndices.forEach(i => elements.splice(i, 1));

    // Rebuild photo grids with shrunk zones
    const titlePagePhotos = photos.slice(0, titlePageCount);
    if (titlePagePhotos.length > 0) {
      const tpElements = buildPhotoGrid(titlePagePhotos, {
        startX: titleX, startY: titleZoneEnd,
        maxX: titleEnd, maxY: adjustedTitlePhotoEnd, GAP
      }, 0, photoCaptions);
      elements.push(...tpElements);
    }
    const photoPagePhotos = photos.slice(titlePageCount);
    if (photoPagePhotos.length > 0) {
      if (params.useStaggeredColumns && photoPagePhotos.length >= 3) {
        const colW = (photoW - GAP) / 2;
        const col1 = [], col2 = [];
        photoPagePhotos.forEach((_, i) => (i % 2 === 0 ? col1 : col2).push(i));
        let y1 = MARGIN;
        for (const i of col1) {
          const h = (adjustedPhotoPageEnd - MARGIN) / col1.length - GAP;
          elements.push({
            type: 'photo', photoIndex: titlePageCount + i,
            x: photoX, y: y1, width: colW, height: h,
            borderRadius: 0, shadow: false, blackAndWhite: i === 0,
            zIndex: 1, cropFit: 'cover',
          });
          y1 += h + GAP;
        }
        let y2 = MARGIN + params.staggerOffset;
        for (const i of col2) {
          const h = (adjustedPhotoPageEnd - MARGIN - params.staggerOffset) / Math.max(col2.length, 1) - GAP;
          elements.push({
            type: 'photo', photoIndex: titlePageCount + i,
            x: photoX + colW + GAP, y: y2, width: colW, height: h,
            borderRadius: 0, shadow: false, blackAndWhite: false,
            zIndex: 1, cropFit: 'cover',
          });
          y2 += h + GAP;
        }
      } else {
        const ppElements = buildPhotoGrid(photoPagePhotos, {
          startX: photoX, startY: MARGIN,
          maxX: photoEnd, maxY: adjustedPhotoPageEnd, GAP
        }, titlePageCount, photoCaptions);
        elements.push(...ppElements);
      }
    }
  }

  // Distribute across two slots, balancing heights
  const bodyOnTitlePage = params.bodyPosition === 'bottom-title';
  const titleSlotItems = [];
  const photoSlotItems = [];

  // Quote distribution strategy varies per layout for visual variety:
  //   'cluster' — all quotes together on one page
  //   'split'   — alternate quotes between pages
  //   'balance' — fill smaller slot first (current behavior)
  const quoteStrategies = ['cluster', 'split', 'balance', 'cluster-photo'];
  const quoteStrategy = quoteStrategies[(params.titlePagePhotoRatio * 100) % quoteStrategies.length | 0];
  let quoteIdx = 0;

  for (const item of elementsToPlace) {
    if (item.kind === 'bodyCopy') {
      (bodyOnTitlePage ? titleSlotItems : photoSlotItems).push(item);
    } else if (item.kind === 'roster' || item.kind === 'coaches') {
      // Roster/coaches prefer the page WITHOUT body copy (more space)
      (bodyOnTitlePage ? photoSlotItems : titleSlotItems).push(item);
    } else if (item.kind === 'quote') {
      // Quote placement varies by strategy
      if (quoteStrategy === 'cluster') {
        // All quotes on title page
        titleSlotItems.push(item);
      } else if (quoteStrategy === 'cluster-photo') {
        // All quotes on photo page
        photoSlotItems.push(item);
      } else if (quoteStrategy === 'split') {
        // Alternate: even-indexed on title page, odd on photo page
        (quoteIdx % 2 === 0 ? titleSlotItems : photoSlotItems).push(item);
      } else {
        // 'balance' — fill smaller slot first
        const titleFill = titleSlotItems.reduce((s, i) => s + i.minHeight, 0);
        const photoFill = photoSlotItems.reduce((s, i) => s + i.minHeight, 0);
        (titleFill <= photoFill ? titleSlotItems : photoSlotItems).push(item);
      }
      quoteIdx++;
    } else {
      // Highlights: fill smaller slot
      const titleFill = titleSlotItems.reduce((s, i) => s + i.minHeight, 0);
      const photoFill = photoSlotItems.reduce((s, i) => s + i.minHeight, 0);
      (titleFill <= photoFill ? titleSlotItems : photoSlotItems).push(item);
    }
  }

  renderSecondarySlot(elements, titleSlotItems, titlePageBottom, pageContent);
  renderSecondarySlot(elements, photoSlotItems, photoPageBottom, pageContent);
}

/**
 * Render items into a bottom slot, sizing them to fit available space.
 * Items render in order, each getting a fair share of space.
 */
function renderSecondarySlot(elements, items, slot, pageContent) {
  if (items.length === 0) return;

  const totalHeight = slot.endY - slot.startY;
  if (totalHeight < 0.5) return;  // Not enough room

  // Scale heights to fit available space
  const totalMin = items.reduce((s, i) => s + i.minHeight, 0);
  const totalMax = items.reduce((s, i) => s + i.maxHeight, 0);
  const GAP_BETWEEN = 0.15;
  const totalGaps = GAP_BETWEEN * (items.length - 1);
  const usableHeight = totalHeight - totalGaps;

  // Determine actual heights
  let heights;
  if (totalMax <= usableHeight) {
    // Everything fits at max — use max
    heights = items.map(i => i.maxHeight);
  } else if (totalMin <= usableHeight) {
    // Scale between min and max
    const scale = (usableHeight - totalMin) / (totalMax - totalMin);
    heights = items.map(i => i.minHeight + (i.maxHeight - i.minHeight) * scale);
  } else {
    // Even min doesn't fit — proportionally shrink
    const scale = usableHeight / totalMin;
    heights = items.map(i => i.minHeight * scale);
  }

  let y = slot.startY;
  items.forEach((item, idx) => {
    const h = heights[idx];

    switch (item.kind) {
      case 'bodyCopy':
        elements.push({
          type: 'bodyCopy', text: pageContent.bodyCopy,
          x: slot.x, y, width: slot.width, height: h,
          fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
          color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
        });
        break;

      case 'quote': {
        // Small purple vertical accent bar to the left of the quote
        elements.push({
          type: 'decorative',
          shape: 'rectangle',
          x: slot.x, y: y + 0.05,
          width: 0.04, height: h - 0.1,
          color: '#523D73',
          opacity: 1,
          zIndex: 9,
        });
        // Quote text — italic, dark, on white (no purple block)
        // Smaller font when slot is tight; pass height to enforce clipping
        const quoteFontSize = h < 1.0 ? 10 : (h < 1.4 ? 11 : 12);
        elements.push({
          type: 'quote',
          text: item.data.text,
          attribution: item.data.attribution || '',
          x: slot.x + 0.18, y, width: slot.width - 0.18,
          height: h,  // Pass height so renderer can clip overflow
          fontSize: quoteFontSize,
          fontFamily: 'Playfair Display',
          fontStyle: 'italic',
          fontWeight: '400',
          color: '#1A1A1A',
          backgroundColor: null,
          accentColor: '#523D73',
          zIndex: 10,
        });
        break;
      }

      case 'highlights':
        elements.push({
          type: 'highlights',
          title: 'Season Highlights',
          items: (pageContent.highlights || []).filter(x => x && x.trim() && !x.includes('[')),
          x: slot.x, y, width: slot.width,
          titleFontSize: 11, itemFontSize: 9,
          fontFamily: 'Source Sans Pro',
          titleColor: '#523D73', itemColor: '#1A1A1A',
          bulletStyle: 'disc',
          zIndex: 10,
        });
        break;

      case 'coaches': {
        const { coaches } = extractCoaches(pageContent);
        elements.push({
          type: 'roster',
          title: pageContent.coachesTitle || 'Coaches:',
          names: coaches,
          x: slot.x, y, width: slot.width,
          columns: 1, titleFontSize: 10, nameFontSize: 8,
          fontFamily: 'Source Sans Pro',
          titleColor: '#523D73', nameColor: '#1A1A1A',
          fontWeight: '600', zIndex: 10,
        });
        break;
      }

      case 'roster': {
        const { rosterNames } = extractCoaches(pageContent);
        elements.push({
          type: 'roster',
          title: pageContent.rosterTitle || 'Team Roster:',
          names: rosterNames,
          x: slot.x, y, width: slot.width,
          columns: 4, titleFontSize: 10, nameFontSize: 7,
          fontFamily: 'Source Sans Pro',
          titleColor: '#1A1A1A', nameColor: '#333333',
          zIndex: 10,
        });
        break;
      }
    }

    y += h + GAP_BETWEEN;
  });
}

// =============================================================================
// LAYOUT: COLLAGE (Many photos, no hero, organic arrangement)
// =============================================================================
function buildCollageLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // Small title strip at top spanning both pages
  const titleHeight = 0.9;
  if (pageContent.pageTitle) {
    elements.push({
      type: 'pageTitle',
      text: pageContent.pageTitle,
      themeWord: pageContent.pageTitleThemeWord || null,
      x: leftPageStart, y: MARGIN, width: 16 - 2 * MARGIN,
      fontSize: 36, fontFamily: 'Playfair Display', fontWeight: '900',
      color: '#1A1A1A', letterSpacing: 1, zIndex: 10,
    });
  }
  if (pageContent.section) {
    elements.push({
      type: 'sectionHeader', text: pageContent.section,
      x: leftPageStart, y: MARGIN + 0.65, width: 16 - 2 * MARGIN,
      fontSize: 14, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 3, zIndex: 10,
    });
  }

  // Photos fill both pages below title — mixed sizes for organic feel
  const photoZoneStart = MARGIN + titleHeight + 0.3;
  const photoZoneEnd = pageHeight - MARGIN;

  // Split photos ~50/50 between pages
  const leftCount = Math.ceil(photoCount / 2);
  const leftPhotos = photos.slice(0, leftCount);
  const rightPhotos = photos.slice(leftCount);

  // Use varied grid on each page with small-font captions
  const leftElements = buildCollageGrid(leftPhotos, {
    startX: leftPageStart, startY: photoZoneStart,
    maxX: leftPageEnd, maxY: photoZoneEnd, GAP
  }, 0, photoCaptions);
  elements.push(...leftElements);

  if (rightPhotos.length > 0) {
    const rightElements = buildCollageGrid(rightPhotos, {
      startX: rightPageStart, startY: photoZoneStart,
      maxX: rightPageEnd, maxY: photoZoneEnd, GAP
    }, leftCount, photoCaptions);
    elements.push(...rightElements);
  }
}

/**
 * Collage grid: asymmetric mix of sizes, more photos packed in
 */
function buildCollageGrid(photos, bounds, startIndex, photoCaptions) {
  const elements = [];
  const { startX, startY, maxX, maxY, GAP } = bounds;
  const W = maxX - startX;
  const H = maxY - startY;
  const n = photos.length;

  if (n === 0) return elements;

  // Different arrangements based on count
  if (n <= 2) {
    // 2 photos stacked or side by side
    const isWide = W > H;
    photos.forEach((_, i) => {
      elements.push({
        type: 'photo', photoIndex: startIndex + i,
        x: isWide ? startX + i * (W / 2 + GAP / 2) : startX,
        y: isWide ? startY : startY + i * (H / 2 + GAP / 2),
        width: isWide ? (W - GAP) / 2 : W,
        height: isWide ? H : (H - GAP) / 2,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
    });
  } else if (n <= 4) {
    // 2x2 grid with varied sizes (one dominant)
    const bigW = W * 0.6, bigH = H * 0.55;
    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY, width: bigW, height: bigH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
    // 3 small photos
    const smW = W - bigW - GAP;
    const smH1 = (bigH - GAP) / 2;
    for (let i = 1; i < Math.min(n, 3); i++) {
      elements.push({
        type: 'photo', photoIndex: startIndex + i,
        x: startX + bigW + GAP,
        y: startY + (i - 1) * (smH1 + GAP),
        width: smW, height: smH1,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
    }
    // 4th photo along bottom
    if (n >= 4) {
      elements.push({
        type: 'photo', photoIndex: startIndex + 3,
        x: startX, y: startY + bigH + GAP,
        width: W, height: H - bigH - GAP,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
    }
  } else {
    // 5+ photos: mosaic arrangement
    // Row-based with varying row heights
    const rows = Math.ceil(n / 3);
    const rowH = (H - (rows - 1) * GAP) / rows;
    let placedIdx = 0;

    for (let r = 0; r < rows && placedIdx < n; r++) {
      const remaining = n - placedIdx;
      const photosInRow = Math.min(3, remaining);

      // Vary widths in row for visual interest (odd rows = wide-narrow-narrow, even = narrow-wide-narrow)
      let widths;
      if (photosInRow === 3) {
        widths = (r % 2 === 0) ? [0.5, 0.25, 0.25] : [0.25, 0.5, 0.25];
      } else if (photosInRow === 2) {
        widths = [0.6, 0.4];
      } else {
        widths = [1];
      }

      let x = startX;
      for (let c = 0; c < photosInRow; c++) {
        const w = widths[c] * W - (c === photosInRow - 1 ? 0 : GAP * widths[c]);
        elements.push({
          type: 'photo', photoIndex: startIndex + placedIdx,
          x, y: startY + r * (rowH + GAP),
          width: w, height: rowH,
          borderRadius: 0, shadow: false, blackAndWhite: r === 0 && c === 0,
          zIndex: 1, cropFit: 'cover',
        });
        x += w + GAP;
        placedIdx++;
      }
    }
  }

  // Add captions (short ones only for collage — just names)
  return elements.map(el => {
    if (el.type === 'photo') {
      const cap = photoCaptions.find(c => c.photoIndex === el.photoIndex) || photoCaptions[el.photoIndex];
      if (cap && cap.people && !cap.people.includes('[')) {
        el.caption = cap.people.trim();
      }
    }
    return el;
  });
}

// =============================================================================
// LAYOUT: CHAPTER DIVIDER (Minimal text-only section divider)
// =============================================================================
function buildDividerLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, rightPageEnd, pageHeight, pageWidth, MARGIN } = bounds;

  // Full width for the spread
  const contentWidth = (rightPageEnd - leftPageStart);
  const centerX = (leftPageStart + rightPageEnd) / 2;
  const centerY = pageHeight / 2;

  // Main chapter title — VERY BIG, centered
  if (pageContent.pageTitle) {
    elements.push({
      type: 'pageTitle',
      text: pageContent.pageTitle,
      themeWord: pageContent.pageTitleThemeWord || null,
      x: leftPageStart, y: centerY - 1.2, width: contentWidth,
      fontSize: 96,
      fontFamily: 'Playfair Display', fontWeight: '900',
      color: '#1A1A1A',
      textAlign: 'center',
      letterSpacing: 2,
      zIndex: 10,
    });
  }

  // Subtitle / section description
  if (pageContent.section) {
    elements.push({
      type: 'sectionHeader', text: pageContent.section,
      x: leftPageStart, y: centerY + 0.5, width: contentWidth,
      fontSize: 18, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textAlign: 'center',
      textTransform: 'uppercase', letterSpacing: 6,
      zIndex: 10,
    });
  }

  // Optional intro paragraph (bodyCopy)
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftPageStart + contentWidth * 0.25,
      y: centerY + 1.3,
      width: contentWidth * 0.5,
      height: 2.0,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#333333', lineHeight: 1.6,
      columns: 1, textAlign: 'center', zIndex: 10,
    });
  }

  // Decorative horizontal line above and below title
  elements.push({
    type: 'decorative', shape: 'line',
    x: centerX - 1.5, y: centerY - 1.6,
    width: 3.0, height: 0.02,
    color: '#523D73', opacity: 1, zIndex: 5,
  });
  elements.push({
    type: 'decorative', shape: 'line',
    x: centerX - 1.5, y: centerY + 1.1,
    width: 3.0, height: 0.02,
    color: '#523D73', opacity: 1, zIndex: 5,
  });
}

// =============================================================================
// LAYOUT: BOOK INDEX (Alphabetical topic listing with page numbers)
// =============================================================================
function buildIndexLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN } = bounds;

  // Page title at top
  if (pageContent.pageTitle) {
    elements.push({
      type: 'pageTitle', text: pageContent.pageTitle,
      x: leftPageStart, y: MARGIN, width: 16 - 2 * MARGIN,
      fontSize: 42, fontFamily: 'Playfair Display', fontWeight: '900',
      color: '#1A1A1A', letterSpacing: 1, zIndex: 10,
    });
  }
  const sectionText = pageContent.section || 'Index';
  elements.push({
    type: 'sectionHeader', text: sectionText,
    x: leftPageStart, y: MARGIN + 0.85, width: 16 - 2 * MARGIN,
    fontSize: 16, fontFamily: 'Source Sans Pro', fontWeight: '600',
    color: '#523D73', textTransform: 'uppercase', letterSpacing: 3, zIndex: 10,
  });

  // Parse index entries — expected format in pageContent.indexEntries:
  // [{ topic: "Soccer", pages: "45, 67" }, { topic: "Spanish Club", pages: "92" }]
  // Or as a formatted string: "Soccer ... 45, 67\nSpanish Club ... 92"
  let entries = pageContent.indexEntries || [];

  // Fallback: parse from bodyCopy if no structured entries
  if (entries.length === 0 && pageContent.bodyCopy) {
    entries = pageContent.bodyCopy.split('\n').filter(l => l.trim()).map(line => {
      const match = line.match(/^(.+?)\s*[\.…\s]+(.+)$/);
      if (match) return { topic: match[1].trim(), pages: match[2].trim() };
      return { topic: line.trim(), pages: '' };
    });
  }

  // Sort alphabetically
  entries.sort((a, b) => (a.topic || '').localeCompare(b.topic || ''));

  // Group by first letter for section headers
  const sections = {};
  for (const entry of entries) {
    const letter = (entry.topic || '?')[0].toUpperCase();
    if (!sections[letter]) sections[letter] = [];
    sections[letter].push(entry);
  }

  // Distribute alphabetically across 4 columns (2 per page)
  const allLetters = Object.keys(sections).sort();
  const totalEntries = entries.length;
  const columnsPerPage = 2;
  const entriesPerColumn = Math.ceil(totalEntries / (columnsPerPage * 2));

  const columnWidth = (leftPageWidth - 0.3) / 2;
  const startY = MARGIN + 1.6;
  const maxY = pageHeight - MARGIN - 0.3;
  const lineHeight = 0.2;
  const sectionHeaderHeight = 0.35;

  let currentCol = 0; // 0-3: left-page-left, left-page-right, right-page-left, right-page-right
  let currentY = startY;

  for (const letter of allLetters) {
    const columnX = currentCol < 2
      ? leftPageStart + currentCol * (columnWidth + 0.3)
      : rightPageStart + (currentCol - 2) * (columnWidth + 0.3);

    // Check if section header fits
    if (currentY + sectionHeaderHeight + lineHeight > maxY) {
      currentCol++;
      currentY = startY;
      if (currentCol > 3) break;
    }

    // Section letter header
    elements.push({
      type: 'sectionHeader', text: letter,
      x: columnX, y: currentY, width: columnWidth,
      fontSize: 18, fontFamily: 'Playfair Display', fontWeight: '900',
      color: '#523D73', textTransform: 'none', letterSpacing: 0,
      zIndex: 10,
    });
    currentY += sectionHeaderHeight;

    // Entries under this letter
    for (const entry of sections[letter]) {
      if (currentY + lineHeight > maxY) {
        currentCol++;
        currentY = startY;
        if (currentCol > 3) break;
        // Re-calculate columnX
        const newColX = currentCol < 2
          ? leftPageStart + currentCol * (columnWidth + 0.3)
          : rightPageStart + (currentCol - 2) * (columnWidth + 0.3);

        // Repeat letter header at top of new column
        elements.push({
          type: 'sectionHeader', text: letter + ' (cont.)',
          x: newColX, y: currentY, width: columnWidth,
          fontSize: 12, fontFamily: 'Playfair Display', fontWeight: '700',
          color: '#523D73', textTransform: 'none',
          zIndex: 10,
        });
        currentY += sectionHeaderHeight;
      }

      const entryColX = currentCol < 2
        ? leftPageStart + currentCol * (columnWidth + 0.3)
        : rightPageStart + (currentCol - 2) * (columnWidth + 0.3);

      // Topic text + dots + page number
      const displayText = entry.pages
        ? `${entry.topic} ........ ${entry.pages}`
        : entry.topic;

      elements.push({
        type: 'bodyCopy', text: displayText,
        x: entryColX, y: currentY, width: columnWidth,
        fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
        color: '#1A1A1A', lineHeight: 1.2, columns: 1,
        textAlign: 'left', zIndex: 10,
      });
      currentY += lineHeight;
    }
    currentY += 0.15; // Gap after each letter section
  }
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

  // FIXED ZONES - no dynamic calculations that can fail
  // Left page: title zone (top 30%), photo zone (middle 40%), text zone (bottom 30%)
  const leftTitleZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.30;
  const leftPhotoZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.70;

  // Right page: photo zone (top 70%), roster zone (bottom 30%)
  const rightPhotoZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.75;

  // === LEFT PAGE TOP: Title block ===
  let leftY = addTitleBlock(elements, pageContent, {
    x: leftPageStart, y: MARGIN, width: leftPageWidth, compact: true,
  });

  // Headline + record + date (compact)
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: leftPageStart, y: Math.min(leftY, leftTitleZoneEnd - 0.7), width: leftPageWidth * 0.7,
      fontSize: 13, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: leftPageStart, y: Math.min(leftY + 0.35, leftTitleZoneEnd - 0.35), width: 1.5,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: leftPageStart, y: Math.min(leftY + 0.65, leftTitleZoneEnd - 0.1), width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
  }

  // === LEFT PAGE MIDDLE: Photos (ALWAYS placed here) ===
  const leftPhotoCount = Math.max(2, Math.ceil(photoCount * 0.4));
  const actualLeftCount = Math.min(leftPhotoCount, photoCount - 1);
  const leftPhotos = photos.slice(0, actualLeftCount);

  const leftPhotoElements = buildPhotoGrid(leftPhotos, {
    startX: leftPageStart,
    startY: leftTitleZoneEnd,
    maxX: leftPageEnd,
    maxY: leftPhotoZoneEnd,
    GAP
  }, 0, photoCaptions);
  elements.push(...leftPhotoElements);

  // === LEFT PAGE BOTTOM: Body copy ===
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftPageStart, y: leftPhotoZoneEnd + 0.1,
      width: leftPageWidth, height: pageHeight - MARGIN - leftPhotoZoneEnd - 0.2,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
  }

  // === RIGHT PAGE: Photos filling most of the page ===
  const rightPhotos = photos.slice(actualLeftCount);
  const rosterHeight = (pageContent.roster?.length > 0) ? 1.2 : 0;

  if (rightPhotos.length > 0) {
    const rightPhotoElements = buildPhotoGrid(rightPhotos, {
      startX: rightPageStart,
      startY: MARGIN,
      maxX: rightPageEnd,
      maxY: rightPhotoZoneEnd - rosterHeight,
      GAP
    }, actualLeftCount, photoCaptions);
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

  // FIXED ZONES — mirror of mixed-left
  const rightTitleZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.30;
  const rightPhotoZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.70;
  const leftPhotoZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.75;

  // Split photos: 40% left, 60% right (right has title taking space)
  const leftPhotoCount = Math.max(2, Math.ceil(photoCount * 0.5));
  const actualLeftCount = Math.min(leftPhotoCount, photoCount - 1);

  // === LEFT PAGE: Photos top, body+roster bottom ===
  const leftPhotos = photos.slice(0, actualLeftCount);
  const leftPhotoElements = buildPhotoGrid(leftPhotos, {
    startX: leftPageStart, startY: MARGIN,
    maxX: leftPageEnd, maxY: leftPhotoZoneEnd, GAP
  }, 0, photoCaptions);
  elements.push(...leftPhotoElements);

  // Body copy below photos on left
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftPageStart, y: leftPhotoZoneEnd + 0.1,
      width: leftPageWidth, height: pageHeight - MARGIN - leftPhotoZoneEnd - 0.2,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
  }

  // === RIGHT PAGE TOP: Title block ===
  let rightY = addTitleBlock(elements, pageContent, {
    x: rightPageStart, y: MARGIN, width: rightPageWidth, align: 'right',
  });

  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: rightPageStart + rightPageWidth * 0.3, y: Math.min(rightY, rightTitleZoneEnd - 0.7),
      width: rightPageWidth * 0.7, fontSize: 13, fontFamily: 'Playfair Display',
      fontWeight: '700', color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: rightPageEnd - 1.5, y: Math.min(rightY + 0.35, rightTitleZoneEnd - 0.35),
      width: 1.5, fontSize: 11, fontFamily: 'Playfair Display',
      fontWeight: '700', color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: rightPageEnd - 2, y: Math.min(rightY + 0.65, rightTitleZoneEnd - 0.1),
      width: 2, fontSize: 10, fontFamily: 'Source Sans Pro',
      fontWeight: '600', color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
  }

  // === RIGHT PAGE MIDDLE: Photos (ALWAYS placed here) ===
  const rightPhotos = photos.slice(actualLeftCount);
  if (rightPhotos.length > 0) {
    const rightPhotoElements = buildPhotoGrid(rightPhotos, {
      startX: rightPageStart, startY: rightTitleZoneEnd,
      maxX: rightPageEnd, maxY: rightPhotoZoneEnd, GAP
    }, actualLeftCount, photoCaptions);
    elements.push(...rightPhotoElements);
  }

  // === RIGHT PAGE BOTTOM: Roster ===
  const { coaches, rosterNames } = extractCoaches(pageContent);
  let rosterY = rightPhotoZoneEnd + 0.1;
  if (coaches.length > 0) {
    elements.push({
      type: 'roster', title: pageContent.coachesTitle || 'Coaches:',
      names: coaches, x: rightPageStart, y: rosterY, width: rightPageWidth,
      columns: 1, titleFontSize: 10, nameFontSize: 8,
      fontFamily: 'Source Sans Pro', titleColor: '#523D73',
      nameColor: '#1A1A1A', fontWeight: '600', zIndex: 10,
    });
    rosterY += 0.3 + (coaches.length * 0.16);
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
// LAYOUT: TOP HEAVY (Title + big photos across top, text + small photos bottom)
// =============================================================================
function buildTopHeavyLayout(elements, photos, pageContent, bounds) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;

  const photoCount = photos.length;

  // FIXED ZONES — maximize photo space
  const leftTitleZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.22;
  const leftPhotoZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.78;  // 56% for photos
  const rightPhotoZoneEnd = MARGIN + (pageHeight - 2 * MARGIN) * 0.82;

  // === LEFT PAGE TOP: Title (compact) ===
  addTitleBlock(elements, pageContent, {
    x: leftPageStart, y: MARGIN, width: leftPageWidth, compact: true,
  });

  // Headline + record + date squeezed into title zone
  let metaY = leftTitleZoneEnd - 0.6;
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: leftPageStart, y: metaY, width: leftPageWidth * 0.65,
      fontSize: 12, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    metaY += 0.4;  // Gap so purple bars don't touch
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: leftPageStart, y: metaY, width: 1.5,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    metaY += 0.35;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: leftPageStart, y: metaY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
  }

  // === LEFT PAGE MIDDLE: Photos ===
  const leftPhotoCount = Math.max(2, Math.ceil(photoCount * 0.4));
  const actualLeftCount = Math.min(leftPhotoCount, photoCount - 1);
  const leftPhotos = photos.slice(0, actualLeftCount);
  const leftPhotoElements = buildPhotoGrid(leftPhotos, {
    startX: leftPageStart, startY: leftTitleZoneEnd,
    maxX: leftPageEnd, maxY: leftPhotoZoneEnd, GAP
  }, 0, photoCaptions);
  elements.push(...leftPhotoElements);

  // === LEFT PAGE BOTTOM: Body copy ===
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftPageStart, y: leftPhotoZoneEnd + 0.1,
      width: leftPageWidth, height: pageHeight - MARGIN - leftPhotoZoneEnd - 0.15,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
  }

  // === RIGHT PAGE: Photos filling most of the page ===
  const rightPhotos = photos.slice(actualLeftCount);
  if (rightPhotos.length > 0) {
    const rightPhotoElements = buildPhotoGrid(rightPhotos, {
      startX: rightPageStart, startY: MARGIN,
      maxX: rightPageEnd, maxY: rightPhotoZoneEnd, GAP
    }, actualLeftCount, photoCaptions);
    elements.push(...rightPhotoElements);
  }

  // === RIGHT PAGE BOTTOM: Roster ===
  const { coaches, rosterNames } = extractCoaches(pageContent);
  let rosterY = rightPhotoZoneEnd + 0.1;
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
  // Reserve space for captions below photos
  const captionReserve = photoCaptions.length > 0 ? 0.45 : 0;
  const availableHeight = maxY - startY - captionReserve;

  console.log(`buildPhotoGrid: ${photoCount} photos, startIdx=${startIndex}, x=${startX.toFixed(2)}-${maxX.toFixed(2)}, y=${startY.toFixed(2)}-${maxY.toFixed(2)}, availW=${availableWidth.toFixed(2)}, availH=${availableHeight.toFixed(2)}`);

  // Safety check — if available space is too small, skip
  if (availableHeight < 0.5 || availableWidth < 0.5) {
    console.log('buildPhotoGrid: SKIPPING — not enough space');
    return elements;
  }

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
    // Two photos side by side (equal width)
    const colW = (availableWidth - GAP) / 2;
    elements.push({
      type: 'photo', photoIndex: startIndex + primaryIdx,
      x: startX, y: startY,
      width: colW, height: availableHeight,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + (primaryIdx === 0 ? 1 : 0),
      x: startX + colW + GAP, y: startY,
      width: colW, height: availableHeight,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 2, cropFit: 'cover',
    });
  } else if (photoCount === 3) {
    // Three photos: large left, two stacked right (50/50 split)
    const leftW = availableWidth * 0.55;
    const rightW = availableWidth - leftW - GAP;
    const rightH = (availableHeight - GAP) / 2;
    // Large photo on left, two stacked on right
    elements.push({
      type: 'photo', photoIndex: startIndex,
      x: startX, y: startY,
      width: leftW, height: availableHeight,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + 1,
      x: startX + leftW + GAP, y: startY,
      width: rightW, height: rightH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 2, cropFit: 'cover',
    });
    elements.push({
      type: 'photo', photoIndex: startIndex + 2,
      x: startX + leftW + GAP, y: startY + rightH + GAP,
      width: rightW, height: rightH,
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

  // Add captions to all photo elements, filter out impossibly small photos
  const MIN_PHOTO_HEIGHT = 1.0;  // Minimum 1" tall
  const MIN_PHOTO_WIDTH = 1.0;   // Minimum 1" wide
  return elements
    .filter(el => {
      if (el.type === 'photo' && (el.height < MIN_PHOTO_HEIGHT || el.width < MIN_PHOTO_WIDTH)) {
        console.log(`buildPhotoGrid: REMOVING photo ${el.photoIndex} — too small (${el.width.toFixed(2)}"x${el.height.toFixed(2)}")`);
        return false;
      }
      return true;
    })
    .map(el => {
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
