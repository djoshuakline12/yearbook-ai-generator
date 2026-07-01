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

  // Pick a fundamentally different LAYOUT STYLE for variety
  // - 'horizontal-split': photos top, text bottom (current default)
  // - 'sidebar-text-left': text column left, photos column right
  // - 'sidebar-text-right': photos column left, text column right
  // - 'interleaved': photos and text interspersed top-to-bottom
  // - 'magazine-spread': hero photo one page, text-heavy other page
  const layoutStyles = [
    'horizontal-split',
    'sidebar-text-left',
    'sidebar-text-right',
    'interleaved',
    'magazine-spread',
    // Herff Jones-style templates
    'hero-top-bleed',           // Tpl 1: dominant photo bleeds top
    'hero-left-magazine',       // Tpl 2: big hero left, text + small photos right
    'hero-dominant-sidebar',    // Tpl 3: massive bleed hero left, text + talking heads right
    'sidebar-mods-bleed',       // Tpl 4: mod sidebar left, body middle, bleed group photo right
    'cross-gutter-mosaic',      // Tpl 5: left-col text + cross-gutter hero + right 2x2 mosaic + bottom-right mini stack
  ];
  // Honor an explicit user pick from the frontend if it matches a real style.
  const requested = (pageContent.layoutStyle || '').toString().trim();
  const layoutStyle = layoutStyles.includes(requested)
    ? requested
    : layoutStyles[h1 % layoutStyles.length];

  const params = {
    layoutStyle,
    titlePage: h1 % 2 === 0 ? 'left' : 'right',
    titleAlign: ['left', 'center', 'right'][h2 % 3],
    titlePagePhotoRatio: 0.25 + (h2 % 7) * 0.05,
    titleZoneSize: 0.15 + (h3 % 6) * 0.035,
    titlePagePhotoEnd: 0.60 + (h4 % 6) * 0.05,
    photoPagePhotoEnd: 0.72 + (h5 % 5) * 0.05,
    staggerOffset: (h6 % 8) * 0.3,
    useStaggeredColumns: h3 % 3 === 0,
    bodyPosition: ['bottom-title', 'bottom-photo', 'bottom-title', 'split'][h4 % 4],
    photoGridStyle: ['dominant-left', 'dominant-right', 'dominant-top', 'balanced', 'mosaic'][h5 % 5],
    titleVerticalPos: ['top', 'middle', 'bottom'][h6 % 3],
    useHorizontalHero: h1 % 5 === 0,
    heroBandPosition: ['top', 'middle', 'bottom'][h2 % 3],
    gapStyle: ['tight', 'normal', 'loose'][h3 % 3],
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
      // Default: activity spread — dispatch to one of several layout styles
      const layoutParams = chooseLayoutTemplate(pageContent, photoCount);
      console.log(`Layout style: ${layoutParams.layoutStyle}`);

      if (layoutParams.layoutStyle === 'sidebar-text-left') {
        buildSidebarTextLayout(elements, photos, pageContent, bounds, layoutParams, 'left');
      } else if (layoutParams.layoutStyle === 'sidebar-text-right') {
        buildSidebarTextLayout(elements, photos, pageContent, bounds, layoutParams, 'right');
      } else if (layoutParams.layoutStyle === 'interleaved') {
        buildInterleavedLayout(elements, photos, pageContent, bounds, layoutParams);
      } else if (layoutParams.layoutStyle === 'magazine-spread') {
        buildMagazineSpreadLayout(elements, photos, pageContent, bounds, layoutParams);
      } else if (layoutParams.layoutStyle === 'hero-top-bleed') {
        buildHeroTopBleedLayout(elements, photos, pageContent, bounds, layoutParams);
      } else if (layoutParams.layoutStyle === 'hero-left-magazine') {
        buildHeroLeftMagazineLayout(elements, photos, pageContent, bounds, layoutParams);
      } else if (layoutParams.layoutStyle === 'hero-dominant-sidebar') {
        buildHeroDominantSidebarLayout(elements, photos, pageContent, bounds, layoutParams);
      } else if (layoutParams.layoutStyle === 'sidebar-mods-bleed') {
        buildSidebarModsBleedLayout(elements, photos, pageContent, bounds, layoutParams);
      } else if (layoutParams.layoutStyle === 'cross-gutter-mosaic') {
        buildCrossGutterMosaicLayout(elements, photos, pageContent, bounds, layoutParams);
      } else {
        // horizontal-split (default)
        buildParameterizedLayout(elements, photos, pageContent, bounds, layoutParams);
      }
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
  // Title zone is tighter — only enough for actual title + meta lines
  // (title block: ~1.5", headline + record + date: ~1.2" max = ~2.0" total)
  // This frees up space for photos to fill the page.
  const titleBlockHeight = 1.6; // inches needed for title + section
  const metaBlockHeight = (pageContent.headline ? 0.5 : 0)
                       + (pageContent.record ? 0.4 : 0)
                       + (pageContent.dateOrYear ? 0.3 : 0);
  var titleZoneEnd = MARGIN + titleBlockHeight + metaBlockHeight;

  // Photo zones expand to fill page when body/quotes/highlights are small
  // Estimate space needed by secondary content
  const bodyCharCount = (pageContent.bodyCopy || '').length;
  const quoteCountEst = (pageContent.quotes || []).filter(q => q && q.text).length;
  const highlightCountEst = (pageContent.highlights || []).filter(h => h).length;
  const hasRosterEst = (pageContent.roster && pageContent.roster.length > 0);

  // Rough vertical demand for secondary content (inches)
  // Body: ~0.5" + chars/300 (2 col body at 9pt fits ~300 chars/inch)
  const bodyDemand = bodyCharCount > 50 ? (0.4 + bodyCharCount / 300) : 0;
  const quoteDemand = quoteCountEst * 0.9; // ~0.9" per quote
  const highlightDemand = highlightCountEst > 0 ? (0.4 + highlightCountEst * 0.22) : 0;
  const rosterDemand = hasRosterEst ? 1.0 : 0;

  // Split secondary demand between the two pages
  const bottomDemandPerPage = Math.max(
    1.2, // minimum bottom area on each page
    (bodyDemand + quoteDemand + highlightDemand + rosterDemand) / 2
  );

  // Photo zones extend as far down as possible, leaving just enough for
  // the secondary content slot.
  var titlePhotoEnd = pageHeight - MARGIN - bottomDemandPerPage;
  var photoPagePhotoEnd = pageHeight - MARGIN - bottomDemandPerPage;

  // Clamp so photos don't crowd into the title or run too short
  titlePhotoEnd = Math.max(titleZoneEnd + 1.5, Math.min(titlePhotoEnd, pageHeight - MARGIN - 0.5));
  photoPagePhotoEnd = Math.max(MARGIN + 3.5, Math.min(photoPagePhotoEnd, pageHeight - MARGIN - 0.5));

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
    // Body copy: estimate actual height needed based on word count
    // 9pt font, 2 columns, ~3.5" wide column = ~65 chars/line, ~6 lines/inch
    const bodyChars = (pageContent.bodyCopy || '').length;
    const charsPerInch = 65 * 6 * 2;  // 2 columns × 65 chars × 6 lines/inch
    const estimatedHeight = Math.ceil((bodyChars / charsPerInch) * 10) / 10;
    elementsToPlace.push({
      kind: 'bodyCopy',
      minHeight: Math.max(1.2, estimatedHeight),  // Don't squash below what text needs
      maxHeight: Math.max(2.5, estimatedHeight + 0.3),
    });
  }
  // EACH quote — height scales with actual text length, NEVER smaller than needed
  quotes.forEach((q, idx) => {
    const charsPerLine = 46;  // Slightly more conservative
    const estLines = Math.ceil((q.text || '').length / charsPerLine);
    const textHeight = estLines * 0.22;  // 0.22"/line at 11-12pt italic with line-height 1.3
    const attrHeight = q.attribution ? 0.25 : 0;  // Attribution + margin
    const padding = 0.15;
    const naturalHeight = textHeight + attrHeight + padding;
    elementsToPlace.push({
      kind: 'quote',
      minHeight: naturalHeight,  // NEVER less than actual text needs
      maxHeight: naturalHeight + 0.2,
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
      case 'bodyCopy': {
        // Auto-shrink font size if space is tight to ensure text fits
        const bodyChars = (pageContent.bodyCopy || '').length;
        const charsPer9pt = 65 * 6 * 2;  // 2 cols × 65 chars × 6 lines/inch at 9pt
        const heightNeededAt9pt = bodyChars / charsPer9pt;
        let bodyFontSize = 9;
        let bodyLineHeight = 1.5;
        if (h < heightNeededAt9pt) {
          // Text won't fit at 9pt — shrink font proportionally
          const shrinkFactor = h / heightNeededAt9pt;
          bodyFontSize = Math.max(7, Math.round(9 * Math.sqrt(shrinkFactor)));
          bodyLineHeight = 1.35;
        }
        elements.push({
          type: 'bodyCopy', text: pageContent.bodyCopy,
          x: slot.x, y, width: slot.width, height: h,
          fontSize: bodyFontSize, fontFamily: 'Source Sans Pro', fontWeight: '400',
          color: '#1A1A1A', lineHeight: bodyLineHeight, columns: 2, textAlign: 'justify', zIndex: 10,
        });
        break;
      }

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
        // Quote text — auto-shrink font so all text fits without clipping
        // Calculate actual lines needed at the available width
        const quoteWidth = slot.width - 0.18;
        const charsPerLine12pt = Math.floor(quoteWidth * 13);  // ~13 chars/inch at 12pt italic
        const quoteLines = Math.ceil((item.data.text || '').length / charsPerLine12pt);
        const attrSpace = item.data.attribution ? 0.25 : 0;
        const padding = 0.1;
        const heightNeededAt12pt = quoteLines * 0.22 + attrSpace + padding;

        let quoteFontSize;
        if (h >= heightNeededAt12pt) {
          quoteFontSize = 12;
        } else if (h >= heightNeededAt12pt * 0.85) {
          quoteFontSize = 11;
        } else if (h >= heightNeededAt12pt * 0.75) {
          quoteFontSize = 10;
        } else {
          // Last resort — shrink further to fit
          quoteFontSize = Math.max(8, Math.round(12 * (h / heightNeededAt12pt)));
        }

        elements.push({
          type: 'quote',
          text: item.data.text,
          attribution: item.data.attribution || '',
          x: slot.x + 0.18, y, width: quoteWidth,
          height: h,
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
// LAYOUT: SIDEBAR TEXT (Text in column on one side, photos column on other)
// Text and photos sit SIDE BY SIDE on each page — not stacked top/bottom
// =============================================================================
function buildSidebarTextLayout(elements, photos, pageContent, bounds, params, textSide) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;
  const usableHeight = pageHeight - 2 * MARGIN;
  const photoCount = photos.length;

  // Text takes ~40% width, photos take ~60% on each page
  // textSide='left' means text column is left half of each page
  const textColRatio = 0.42;
  const photoColRatio = 0.55;
  const colGap = 0.15;

  // === LEFT PAGE: split into text-col + photo-col ===
  const leftTextX = textSide === 'left' ? leftPageStart : leftPageStart + leftPageWidth * photoColRatio + colGap;
  const leftPhotoX = textSide === 'left' ? leftPageStart + leftPageWidth * textColRatio + colGap : leftPageStart;
  const leftTextW = leftPageWidth * textColRatio;
  const leftPhotoW = leftPageWidth * photoColRatio;

  // === RIGHT PAGE: same split (or flipped) ===
  const rightTextX = textSide === 'left' ? rightPageStart : rightPageStart + rightPageWidth * photoColRatio + colGap;
  const rightPhotoX = textSide === 'left' ? rightPageStart + rightPageWidth * textColRatio + colGap : rightPageStart;
  const rightTextW = rightPageWidth * textColRatio;
  const rightPhotoW = rightPageWidth * photoColRatio;

  // Title goes in the text column of the title page
  const titlePage = params.titlePage; // 'left' or 'right'
  const titleX = titlePage === 'left' ? leftTextX : rightTextX;
  const titleW = titlePage === 'left' ? leftTextW : rightTextW;

  addTitleBlock(elements, pageContent, {
    x: titleX, y: MARGIN, width: titleW,
    align: 'left', compact: true,
  });

  let titleColY = MARGIN + usableHeight * 0.22;  // After title block
  let otherColY = MARGIN;  // The non-title text column

  // Headline + record + date below title
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: titleX, y: titleColY, width: titleW * 0.85,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    titleColY += 0.4;
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: titleX, y: titleColY, width: 1.5,
      fontSize: 10, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    titleColY += 0.32;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: titleX, y: titleColY, width: 2,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    titleColY += 0.3;
  }

  // Body copy in the title-page text column (under the meta info)
  if (pageContent.bodyCopy) {
    const bodyH = pageHeight - MARGIN - titleColY - 0.1;
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: titleX, y: titleColY + 0.1, width: titleW,
      height: bodyH,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 1, textAlign: 'left', zIndex: 10,
    });
  }

  // Photos: 50/50 split across pages
  const leftPhotoCount = Math.ceil(photoCount / 2);
  const leftPhotos = photos.slice(0, leftPhotoCount);
  const rightPhotos = photos.slice(leftPhotoCount);

  if (leftPhotos.length > 0) {
    const lp = buildPhotoGrid(leftPhotos, {
      startX: leftPhotoX, startY: MARGIN,
      maxX: leftPhotoX + leftPhotoW, maxY: pageHeight - MARGIN, GAP
    }, 0, photoCaptions);
    elements.push(...lp);
  }
  if (rightPhotos.length > 0) {
    const rp = buildPhotoGrid(rightPhotos, {
      startX: rightPhotoX, startY: MARGIN,
      maxX: rightPhotoX + rightPhotoW, maxY: pageHeight - MARGIN, GAP
    }, leftPhotos.length, photoCaptions);
    elements.push(...rp);
  }

  // Quotes + roster in the OTHER page's text column (non-title page)
  const otherTextX = titlePage === 'left' ? rightTextX : leftTextX;
  const otherTextW = titlePage === 'left' ? rightTextW : leftTextW;
  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  const highlights = (pageContent.highlights || []).filter(h => h && !h.includes('['));
  const { coaches, rosterNames } = extractCoaches(pageContent);

  let y = MARGIN;
  // Section subtitle at top
  if (titlePage !== 'left' && pageContent.section) {
    // section header already in title — skip
  }

  // Quotes
  quotes.forEach((q, idx) => {
    const lines = Math.ceil((q.text || '').length / 35);
    const h = Math.max(0.7, lines * 0.22 + (q.attribution ? 0.25 : 0) + 0.15);
    if (y + h > pageHeight - MARGIN) return;
    elements.push({
      type: 'decorative', shape: 'rectangle',
      x: otherTextX, y: y + 0.05, width: 0.04, height: h - 0.1,
      color: '#523D73', opacity: 1, zIndex: 9,
    });
    elements.push({
      type: 'quote',
      text: q.text, attribution: q.attribution || '',
      x: otherTextX + 0.18, y, width: otherTextW - 0.18, height: h,
      fontSize: 11, fontFamily: 'Playfair Display', fontStyle: 'italic',
      fontWeight: '400', color: '#1A1A1A',
      backgroundColor: null, accentColor: '#523D73', zIndex: 10,
    });
    y += h + 0.2;
  });

  // Highlights
  if (highlights.length > 0) {
    const h = 0.4 + highlights.length * 0.18;
    if (y + h <= pageHeight - MARGIN) {
      elements.push({
        type: 'highlights', title: 'Highlights',
        items: highlights,
        x: otherTextX, y, width: otherTextW,
        titleFontSize: 11, itemFontSize: 9,
        fontFamily: 'Source Sans Pro',
        titleColor: '#523D73', itemColor: '#1A1A1A',
        bulletStyle: 'disc', zIndex: 10,
      });
      y += h + 0.15;
    }
  }

  // Roster
  if (rosterNames.length > 0 && y < pageHeight - MARGIN - 0.5) {
    elements.push({
      type: 'roster',
      title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames,
      x: otherTextX, y, width: otherTextW,
      columns: 2, titleFontSize: 10, nameFontSize: 7,
      fontFamily: 'Source Sans Pro',
      titleColor: '#1A1A1A', nameColor: '#333333', zIndex: 10,
    });
  }
}

// =============================================================================
// LAYOUT: INTERLEAVED (Photos and text alternate top-to-bottom on each page)
// =============================================================================
function buildInterleavedLayout(elements, photos, pageContent, bounds, params) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;
  const usableHeight = pageHeight - 2 * MARGIN;

  // Title page: title at top, then text+photo+text interleaved
  // Other page: photos top, body in middle, more photos bottom
  const titlePage = params.titlePage;
  const photoCount = photos.length;

  // === TITLE PAGE LAYOUT ===
  const titleX = titlePage === 'left' ? leftPageStart : rightPageStart;
  const titleW = titlePage === 'left' ? leftPageWidth : rightPageWidth;

  addTitleBlock(elements, pageContent, {
    x: titleX, y: MARGIN, width: titleW,
    align: titlePage === 'left' ? 'left' : 'right',
    compact: true,
  });

  // Photo band #1 on title page
  const band1Start = MARGIN + usableHeight * 0.22;
  const band1End = MARGIN + usableHeight * 0.50;
  const titleSidePhotos = Math.min(2, Math.ceil(photoCount * 0.3));
  if (titleSidePhotos > 0) {
    const tp = buildPhotoGrid(photos.slice(0, titleSidePhotos), {
      startX: titleX, startY: band1Start,
      maxX: titleX + titleW, maxY: band1End, GAP
    }, 0, photoCaptions);
    elements.push(...tp);
  }

  // Body copy band on title page
  const bodyStart = band1End + 0.15;
  const bodyEnd = MARGIN + usableHeight * 0.78;
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: titleX, y: bodyStart, width: titleW, height: bodyEnd - bodyStart,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
  }

  // Roster at bottom of title page
  const { coaches, rosterNames } = extractCoaches(pageContent);
  let titleBottomY = bodyEnd + 0.15;
  if (rosterNames.length > 0) {
    elements.push({
      type: 'roster',
      title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames,
      x: titleX, y: titleBottomY, width: titleW,
      columns: 4, titleFontSize: 10, nameFontSize: 7,
      fontFamily: 'Source Sans Pro',
      titleColor: '#1A1A1A', nameColor: '#333333', zIndex: 10,
    });
  }

  // === PHOTO PAGE: photos top, quotes/highlights interleaved ===
  const photoX = titlePage === 'left' ? rightPageStart : leftPageStart;
  const photoW = titlePage === 'left' ? rightPageWidth : leftPageWidth;
  const remainingPhotos = photos.slice(titleSidePhotos);

  // Big photo band at top of photo page
  const bigBandEnd = MARGIN + usableHeight * 0.55;
  if (remainingPhotos.length > 0) {
    const bigPhotos = remainingPhotos.slice(0, Math.ceil(remainingPhotos.length * 0.6));
    const bp = buildPhotoGrid(bigPhotos, {
      startX: photoX, startY: MARGIN,
      maxX: photoX + photoW, maxY: bigBandEnd, GAP
    }, titleSidePhotos, photoCaptions);
    elements.push(...bp);
  }

  // Quotes in middle
  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  const highlights = (pageContent.highlights || []).filter(h => h && !h.includes('['));
  let midY = bigBandEnd + 0.15;
  const midEnd = MARGIN + usableHeight * 0.85;

  quotes.forEach((q, idx) => {
    const lines = Math.ceil((q.text || '').length / 48);
    const h = Math.max(0.7, lines * 0.22 + (q.attribution ? 0.25 : 0) + 0.15);
    if (midY + h > midEnd) return;
    elements.push({
      type: 'decorative', shape: 'rectangle',
      x: photoX, y: midY + 0.05, width: 0.04, height: h - 0.1,
      color: '#523D73', opacity: 1, zIndex: 9,
    });
    elements.push({
      type: 'quote',
      text: q.text, attribution: q.attribution || '',
      x: photoX + 0.18, y: midY, width: photoW - 0.18, height: h,
      fontSize: 12, fontFamily: 'Playfair Display', fontStyle: 'italic',
      fontWeight: '400', color: '#1A1A1A',
      backgroundColor: null, accentColor: '#523D73', zIndex: 10,
    });
    midY += h + 0.2;
  });

  // Remaining photos at bottom
  const bottomBandStart = Math.max(midY + 0.15, midEnd);
  const remainingBottomPhotos = remainingPhotos.slice(Math.ceil(remainingPhotos.length * 0.6));
  if (remainingBottomPhotos.length > 0 && bottomBandStart < pageHeight - MARGIN - 0.5) {
    const bp = buildPhotoGrid(remainingBottomPhotos, {
      startX: photoX, startY: bottomBandStart,
      maxX: photoX + photoW, maxY: pageHeight - MARGIN, GAP
    }, titleSidePhotos + Math.ceil(remainingPhotos.length * 0.6), photoCaptions);
    elements.push(...bp);
  }
}

// =============================================================================
// LAYOUT: MAGAZINE SPREAD (Big hero photo one page, text-heavy other page)
// =============================================================================
function buildMagazineSpreadLayout(elements, photos, pageContent, bounds, params) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, MARGIN, GAP, photoCaptions = [] } = bounds;
  const usableHeight = pageHeight - 2 * MARGIN;
  const photoCount = photos.length;

  // Photo side: one big hero photo + smaller supporting photos below
  // Text side: title at top, then quotes, body, roster — all text-focused
  const photoSide = params.titlePage === 'left' ? 'right' : 'left';
  const photoPageX = photoSide === 'left' ? leftPageStart : rightPageStart;
  const photoPageW = photoSide === 'left' ? leftPageWidth : rightPageWidth;
  const textPageX = photoSide === 'left' ? rightPageStart : leftPageStart;
  const textPageW = photoSide === 'left' ? rightPageWidth : leftPageWidth;

  // === PHOTO PAGE: hero + supporting ===
  // Hero photo takes top 65% of page width-wise full
  const heroHeight = usableHeight * 0.62;
  if (photos.length > 0) {
    elements.push({
      type: 'photo', photoIndex: 0,
      x: photoPageX, y: MARGIN,
      width: photoPageW, height: heroHeight,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
  }
  // Supporting photos below hero
  const supportingPhotos = photos.slice(1, Math.min(photos.length, 4));
  if (supportingPhotos.length > 0) {
    const supportingY = MARGIN + heroHeight + GAP;
    const supportingH = pageHeight - MARGIN - supportingY;
    if (supportingH > 0.5) {
      const sp = buildPhotoGrid(supportingPhotos, {
        startX: photoPageX, startY: supportingY,
        maxX: photoPageX + photoPageW, maxY: pageHeight - MARGIN, GAP
      }, 1, photoCaptions);
      elements.push(...sp);
    }
  }

  // Remaining photos (if more than 4) go on text page bottom as small thumbnails
  const extraPhotos = photos.slice(4);

  // === TEXT PAGE: title + body + quotes ===
  addTitleBlock(elements, pageContent, {
    x: textPageX, y: MARGIN, width: textPageW,
    align: photoSide === 'left' ? 'left' : 'right',
    compact: true,
  });

  let y = MARGIN + usableHeight * 0.22;

  // Headline + record
  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: textPageX, y, width: textPageW * 0.75,
      fontSize: 13, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    y += 0.45;
  }
  if (pageContent.record) {
    elements.push({
      type: 'record', text: pageContent.record,
      x: textPageX, y, width: 1.5,
      fontSize: 11, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    y += 0.35;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: textPageX, y, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    y += 0.3;
  }

  y += 0.15;

  // Body copy (2 columns)
  if (pageContent.bodyCopy) {
    const bodyH = Math.min(3.2, pageHeight - MARGIN - y - 1.5);
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: textPageX, y, width: textPageW, height: bodyH,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'justify', zIndex: 10,
    });
    y += bodyH + 0.2;
  }

  // Quotes
  const quotes = (pageContent.quotes || []).filter(q => q && q.text && !q.text.includes('['));
  quotes.forEach((q, idx) => {
    const lines = Math.ceil((q.text || '').length / 50);
    const h = Math.max(0.7, lines * 0.22 + (q.attribution ? 0.25 : 0) + 0.15);
    if (y + h > pageHeight - MARGIN - 0.5) return;
    elements.push({
      type: 'decorative', shape: 'rectangle',
      x: textPageX, y: y + 0.05, width: 0.04, height: h - 0.1,
      color: '#523D73', opacity: 1, zIndex: 9,
    });
    elements.push({
      type: 'quote',
      text: q.text, attribution: q.attribution || '',
      x: textPageX + 0.18, y, width: textPageW - 0.18, height: h,
      fontSize: 12, fontFamily: 'Playfair Display', fontStyle: 'italic',
      fontWeight: '400', color: '#1A1A1A',
      backgroundColor: null, accentColor: '#523D73', zIndex: 10,
    });
    y += h + 0.2;
  });

  // Roster at bottom
  const { coaches, rosterNames } = extractCoaches(pageContent);
  if (rosterNames.length > 0 && y < pageHeight - MARGIN - 0.4) {
    elements.push({
      type: 'roster',
      title: pageContent.rosterTitle || 'Team Roster:',
      names: rosterNames,
      x: textPageX, y, width: textPageW,
      columns: 3, titleFontSize: 10, nameFontSize: 7,
      fontFamily: 'Source Sans Pro',
      titleColor: '#1A1A1A', nameColor: '#333333', zIndex: 10,
    });
  }
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

// =============================================================================
// HERFF JONES-STYLE LAYOUTS
// =============================================================================

// Build a single "grouped numbered captions" text block — produces text like
//   "1 CAPTION TITLE — caption body.   2 CAPTION TITLE — caption body."
// Returns null if no captions are present.
function buildGroupedCaptionsText(photoCaptions, startIndex, count) {
  if (!photoCaptions || photoCaptions.length === 0) return null;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const cap = photoCaptions.find(c => c.photoIndex === idx) || photoCaptions[idx];
    if (!cap) continue;
    const people = (cap.people || '').trim();
    const text = (cap.caption || '').trim();
    const title = (cap.captionTitle || '').trim();
    const isPlaceholder = (s) => !s || s.toLowerCase().includes('needs info') || s.toLowerCase().includes('names needed') || s.includes('[') || s.toLowerCase().includes('tbd');
    let combined = '';
    if (!isPlaceholder(title)) combined += title.toUpperCase();
    if (!isPlaceholder(people) && combined) combined += ' — ';
    if (!isPlaceholder(people)) combined += people;
    if (!isPlaceholder(text)) {
      if (combined) combined += ': ';
      combined += text;
    }
    if (combined) parts.push(`${i + 1}  ${combined}`);
  }
  return parts.length ? parts.join('   ') : null;
}

// =============================================================================
// LAYOUT: HERO TOP BLEED (Tpl 1)
// Dominant photo bleeds across the top half of the spread.
// Big pull quote overlays a colored block top-right corner of the hero.
// Bottom: row of 3-5 small photos with grouped numbered captions below.
// Title and body copy live in the lower portion left side.
// =============================================================================
function buildHeroTopBleedLayout(elements, photos, pageContent, bounds, params) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;

  // Hero photo across the top — bleeds to the spread edges (x=0, width=pageWidth)
  // Heights as ratio of page height
  const heroH = pageHeight * 0.5;
  if (photos.length > 0) {
    elements.push({
      type: 'photo', photoIndex: 0,
      x: 0, y: 0,
      width: pageWidth, height: heroH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
  }

  // Pull quote overlay on top-right of hero
  const pulled = (pageContent.quotes || []).find(q => q && q.text && !q.text.includes('['));
  if (pulled) {
    const qBoxW = Math.min(rightPageWidth * 0.9, 5.0);
    const qBoxH = 1.6;
    const qBoxX = pageWidth - MARGIN - qBoxW;
    const qBoxY = heroH - qBoxH - 0.4;
    // Colored block background
    elements.push({
      type: 'decorative', shape: 'rectangle',
      x: qBoxX, y: qBoxY,
      width: qBoxW, height: qBoxH,
      color: '#523D73', opacity: 0.92, zIndex: 8,
    });
    elements.push({
      type: 'quote',
      text: pulled.text, attribution: pulled.attribution || '',
      x: qBoxX + 0.25, y: qBoxY + 0.15,
      width: qBoxW - 0.5, height: qBoxH - 0.3,
      fontSize: 18, fontFamily: 'Playfair Display', fontStyle: 'italic',
      fontWeight: '400', color: '#FFFFFF',
      backgroundColor: null, accentColor: '#FFFFFF',
      zIndex: 10,
    });
  }

  // Bottom half: title + section + body on left, photo row + grouped captions on right
  const bottomY = heroH + 0.2;
  const bottomH = pageHeight - bottomY - MARGIN;

  // LEFT page bottom: title block + body copy
  let textY = bottomY;
  textY = addTitleBlock(elements, pageContent, {
    x: leftPageStart, y: textY, width: leftPageWidth,
    align: 'left', compact: true,
  });

  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: leftPageStart, y: textY, width: leftPageWidth * 0.85,
      fontSize: 13, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    textY += 0.45;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: leftPageStart, y: textY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    textY += 0.3;
  }
  if (pageContent.bodyCopy) {
    const bodyH = pageHeight - MARGIN - textY - 0.1;
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftPageStart, y: textY + 0.1, width: leftPageWidth,
      height: bodyH,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.45, columns: 1, textAlign: 'left', zIndex: 10,
    });
  }

  // RIGHT page bottom: small numbered photo row + grouped captions block
  const supportingPhotos = photos.slice(1, Math.min(photos.length, 6));
  if (supportingPhotos.length > 0) {
    const captionsH = 1.3;
    const photosH = bottomH - captionsH - 0.15;
    const colCount = supportingPhotos.length;
    const colW = (rightPageWidth - GAP * (colCount - 1)) / colCount;

    supportingPhotos.forEach((_, i) => {
      const idx = i + 1;
      elements.push({
        type: 'photo', photoIndex: idx,
        x: rightPageStart + i * (colW + GAP), y: bottomY,
        width: colW, height: photosH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
      // Number badge over each photo (top-left)
      elements.push({
        type: 'captionNumber', text: String(idx),
        x: rightPageStart + i * (colW + GAP) + 0.1, y: bottomY + 0.1,
        width: 0.35, height: 0.35,
        fontSize: 14, fontFamily: 'Playfair Display', fontWeight: '700',
        color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 11,
      });
    });

    const groupedText = buildGroupedCaptionsText(photoCaptions, 1, supportingPhotos.length);
    if (groupedText) {
      elements.push({
        type: 'bodyCopy', text: groupedText,
        x: rightPageStart, y: bottomY + photosH + 0.15,
        width: rightPageWidth, height: captionsH,
        fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '400',
        color: '#1A1A1A', lineHeight: 1.4, columns: 2, textAlign: 'left', zIndex: 10,
      });
    }
  }
}

// =============================================================================
// LAYOUT: HERO LEFT MAGAZINE (Tpl 2)
// Big hero photo fills the entire left page (bleeds to outer edge).
// Right page: title at top, body copy middle, small photo grid + grouped
// numbered captions, and a colored pull-quote box at the bottom right.
// =============================================================================
function buildHeroLeftMagazineLayout(elements, photos, pageContent, bounds, params) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;

  // Hero photo: bleed to the outer (left) edge — x=0, width = half page + bleed
  const heroSide = params.titlePage === 'left' ? 'right' : 'left';
  if (photos.length > 0) {
    if (heroSide === 'left') {
      elements.push({
        type: 'photo', photoIndex: 0,
        x: 0, y: 0,
        width: pageWidth / 2, height: pageHeight,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
    } else {
      elements.push({
        type: 'photo', photoIndex: 0,
        x: pageWidth / 2, y: 0,
        width: pageWidth / 2, height: pageHeight,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
    }
  }

  // Text page = opposite side
  const textX = heroSide === 'left' ? rightPageStart : leftPageStart;
  const textW = heroSide === 'left' ? rightPageWidth : leftPageWidth;

  // Title block at top
  let textY = MARGIN;
  textY = addTitleBlock(elements, pageContent, {
    x: textX, y: textY, width: textW, align: 'left', compact: true,
  });

  if (pageContent.headline) {
    elements.push({
      type: 'headline', text: pageContent.headline,
      x: textX, y: textY, width: textW * 0.85,
      fontSize: 13, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
    textY += 0.45;
  }
  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: textX, y: textY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    textY += 0.3;
  }

  // Reserve bottom area for photo grid + pull quote
  const bottomReserveH = 4.0;
  const bodyAreaH = (pageHeight - MARGIN - bottomReserveH) - textY - 0.1;
  if (pageContent.bodyCopy && bodyAreaH > 0.8) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: textX, y: textY + 0.1, width: textW,
      height: bodyAreaH,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'left', zIndex: 10,
    });
  }

  // Bottom area: small photo grid (left half of text page) + pull quote box (right half)
  const supportingPhotos = photos.slice(1, Math.min(photos.length, 5));
  const bottomY = pageHeight - MARGIN - bottomReserveH;
  const halfW = (textW - GAP) / 2;

  // Photo grid - 2x2 or row
  if (supportingPhotos.length > 0) {
    const gridW = halfW;
    const gridH = bottomReserveH * 0.7;
    const cols = supportingPhotos.length >= 3 ? 2 : supportingPhotos.length;
    const rows = Math.ceil(supportingPhotos.length / cols);
    const cellW = (gridW - GAP * (cols - 1)) / cols;
    const cellH = (gridH - GAP * (rows - 1)) / rows;

    supportingPhotos.forEach((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      elements.push({
        type: 'photo', photoIndex: i + 1,
        x: textX + col * (cellW + GAP),
        y: bottomY + row * (cellH + GAP),
        width: cellW, height: cellH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
      elements.push({
        type: 'captionNumber', text: String(i + 1),
        x: textX + col * (cellW + GAP) + 0.08,
        y: bottomY + row * (cellH + GAP) + 0.08,
        width: 0.32, height: 0.32,
        fontSize: 12, fontFamily: 'Playfair Display', fontWeight: '700',
        color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 11,
      });
    });

    const groupedText = buildGroupedCaptionsText(photoCaptions, 1, supportingPhotos.length);
    if (groupedText) {
      elements.push({
        type: 'bodyCopy', text: groupedText,
        x: textX, y: bottomY + gridH + 0.1,
        width: gridW, height: bottomReserveH - gridH - 0.15,
        fontSize: 7.5, fontFamily: 'Source Sans Pro', fontWeight: '400',
        color: '#1A1A1A', lineHeight: 1.35, columns: 1, textAlign: 'left', zIndex: 10,
      });
    }
  }

  // Pull quote in colored box, bottom right
  const pulled = (pageContent.quotes || []).find(q => q && q.text && !q.text.includes('['));
  if (pulled) {
    const qX = textX + halfW + GAP;
    const qY = bottomY;
    const qW = halfW;
    const qH = bottomReserveH;
    elements.push({
      type: 'decorative', shape: 'rectangle',
      x: qX, y: qY, width: qW, height: qH,
      color: '#523D73', opacity: 1, zIndex: 8,
    });
    elements.push({
      type: 'quote',
      text: pulled.text, attribution: pulled.attribution || '',
      x: qX + 0.25, y: qY + 0.3,
      width: qW - 0.5, height: qH - 0.5,
      fontSize: 16, fontFamily: 'Playfair Display', fontStyle: 'italic',
      fontWeight: '400', color: '#FFFFFF',
      backgroundColor: null, accentColor: '#FFFFFF',
      zIndex: 10,
    });
  }
}

// =============================================================================
// LAYOUT: HERO DOMINANT SIDEBAR (Tpl 3)
// Massive bleed hero photo fills left page entirely + extends across gutter.
// Right page: section header + headline + body copy with a colored panel
// behind. Bottom of right page: row of small "talking heads" portraits with
// inline quotes.
// =============================================================================
function buildHeroDominantSidebarLayout(elements, photos, pageContent, bounds, params) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;

  // Massive hero — fills left page entirely with full bleed
  if (photos.length > 0) {
    elements.push({
      type: 'photo', photoIndex: 0,
      x: 0, y: 0,
      width: pageWidth / 2 + 0.6, height: pageHeight,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
  }

  // Caption strip on the hero (small white text near bottom-left)
  const heroCap = photoCaptions.find(c => c.photoIndex === 0) || photoCaptions[0];
  if (heroCap) {
    const heroCapText = (heroCap.captionTitle ? heroCap.captionTitle.toUpperCase() + ' — ' : '') +
                       (heroCap.people || '') +
                       (heroCap.caption ? ': ' + heroCap.caption : '');
    if (heroCapText.trim()) {
      elements.push({
        type: 'caption', text: heroCapText.trim(),
        x: MARGIN, y: pageHeight - MARGIN - 0.5,
        width: leftPageWidth * 0.8, height: 0.4,
        fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '400',
        color: '#FFFFFF', italic: true, zIndex: 11,
      });
    }
  }

  // Right page: colored panel + headline + body
  const talkingHeadsH = 2.2;
  const rightContentH = pageHeight - 2 * MARGIN - talkingHeadsH - 0.3;

  // Section header at top
  let textY = MARGIN;
  if (pageContent.section) {
    elements.push({
      type: 'sectionHeader', text: pageContent.section,
      x: rightPageStart, y: textY, width: rightPageWidth,
      fontSize: 14, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textAlign: 'left', textTransform: 'uppercase',
      letterSpacing: 3, zIndex: 10,
    });
    textY += 0.4;
  }

  // Big page title
  if (pageContent.pageTitle) {
    elements.push({
      type: 'pageTitle', text: pageContent.pageTitle,
      themeWord: pageContent.pageTitleThemeWord || null,
      x: rightPageStart, y: textY, width: rightPageWidth,
      fontSize: 48, fontFamily: 'Playfair Display', fontWeight: '900',
      color: '#1A1A1A', textAlign: 'left', letterSpacing: 1, zIndex: 10,
    });
    textY += (pageContent.pageTitle.length > 15 ? 1.4 : 1.0);
  }

  if (pageContent.dateOrYear) {
    elements.push({
      type: 'date', text: pageContent.dateOrYear,
      x: rightPageStart, y: textY, width: 2,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '600',
      color: '#523D73', textTransform: 'uppercase', letterSpacing: 1, zIndex: 10,
    });
    textY += 0.3;
  }

  // Body copy block
  const bodyEnd = MARGIN + rightContentH;
  if (pageContent.bodyCopy && (bodyEnd - textY) > 1.0) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: rightPageStart, y: textY + 0.1, width: rightPageWidth,
      height: bodyEnd - textY - 0.1,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.5, columns: 2, textAlign: 'left', zIndex: 10,
    });
  }

  // Talking heads row at bottom of right page
  const talkingPhotos = photos.slice(1, Math.min(photos.length, 5));
  if (talkingPhotos.length > 0) {
    const headsY = pageHeight - MARGIN - talkingHeadsH;
    const headW = (rightPageWidth - GAP * (talkingPhotos.length - 1)) / talkingPhotos.length;
    const headSize = Math.min(headW, talkingHeadsH * 0.55);
    const quoteH = talkingHeadsH - headSize - 0.1;

    talkingPhotos.forEach((_, i) => {
      const colX = rightPageStart + i * (headW + GAP);
      // portrait
      elements.push({
        type: 'photo', photoIndex: i + 1,
        x: colX + (headW - headSize) / 2, y: headsY,
        width: headSize, height: headSize,
        borderRadius: headSize / 2, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
      // mini quote / caption below
      const cap = photoCaptions.find(c => c.photoIndex === i + 1) || photoCaptions[i + 1];
      let micro = '';
      if (cap) {
        if (cap.people) micro += cap.people.split(',')[0];
        if (cap.caption && !cap.caption.includes('[')) {
          if (micro) micro += '\n';
          micro += '"' + cap.caption + '"';
        }
      }
      if (micro) {
        elements.push({
          type: 'caption', text: micro,
          x: colX + 0.05, y: headsY + headSize + 0.08,
          width: headW - 0.1, height: quoteH,
          fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '400',
          color: '#1A1A1A', textAlign: 'center', zIndex: 10,
        });
      }
    });
  }
}

// =============================================================================
// LAYOUT: MAIN HEADLINE BLEED (Tpl 4 — Herff Jones style, purple)
// Left page: 2 small photos + grouped numbered captions top; main headline +
// purple mod bar + 2-col body middle; 2 support photos bottom-left.
// Right page: 3 numbered photos across top with grouped captions column;
// big hero photo bleeds bottom-right with multi-line purple pull quote overlay.
// =============================================================================
function buildSidebarModsBleedLayout(elements, photos, pageContent, bounds, params) {
  const { pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;
  const PURPLE = '#523D73';

  // ================ LEFT PAGE (0 - 8) ================

  // A. Top-left small photo column (2 stacked, ~1.5x1.75 each)
  const topX = 0.5;
  const topW = 1.5;
  const topH = 1.75;
  const topGap = 0.15;
  if (photos.length > 0) {
    elements.push({
      type: 'photo', photoIndex: 0,
      x: topX, y: 0.5, width: topW, height: topH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
  }
  if (photos.length > 1) {
    elements.push({
      type: 'photo', photoIndex: 1,
      x: topX, y: 0.5 + topH + topGap, width: topW, height: topH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
  }
  // number badges (small, in corner)
  elements.push({
    type: 'captionNumber', text: '1',
    x: topX + 0.05, y: 0.5 + topH - 0.28,
    width: 0.24, height: 0.24,
    fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '700',
    color: '#333333', backgroundColor: null, zIndex: 11,
  });
  elements.push({
    type: 'captionNumber', text: '2',
    x: topX + 0.05, y: 0.5 + 2 * topH + topGap - 0.28,
    width: 0.24, height: 0.24,
    fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '700',
    color: '#333333', backgroundColor: null, zIndex: 11,
  });

  // B. Grouped captions block right of top-left photos
  const groupedTopCaps = buildGroupedCaptionsText(photoCaptions, 0, Math.min(2, photos.length));
  if (groupedTopCaps) {
    elements.push({
      type: 'bodyCopy', text: groupedTopCaps,
      x: topX + topW + 0.15, y: 0.5,
      width: 1.7, height: 2 * topH + topGap,
      fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.4, columns: 1, textAlign: 'left', zIndex: 10,
    });
  }

  // C. Main headline (huge serif) — from pageTitle
  const titleY = 4.5;
  if (pageContent.pageTitle) {
    elements.push({
      type: 'pageTitle', text: pageContent.pageTitle,
      themeWord: pageContent.pageTitleThemeWord || null,
      x: 0.5, y: titleY, width: 4.4,
      fontSize: 36, fontFamily: 'Playfair Display', fontWeight: '900',
      color: '#1A1A1A', textAlign: 'left', letterSpacing: 1, zIndex: 10,
    });
  }

  // D. Purple MOD HEADLINE / SUBHEAD bar
  const modBarY = titleY + 1.2;
  const modBarText = (pageContent.subheadline || pageContent.section || '').toUpperCase() || 'MOD HEADLINE / SUBHEAD';
  elements.push({
    type: 'headline', text: modBarText,
    x: 0.5, y: modBarY, width: 3.4,
    fontSize: 11, fontFamily: 'Source Sans Pro', fontWeight: '700',
    color: '#FFFFFF', backgroundColor: PURPLE, zIndex: 10,
  });

  // E. Body copy — 2 columns
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: 0.5, y: modBarY + 0.55, width: 3.8, height: 3.2,
      fontSize: 9, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.45, columns: 2, textAlign: 'left', zIndex: 10,
    });
  }

  // F. Middle-left support photo (B&W crowd shot area)
  if (photos.length > 2) {
    elements.push({
      type: 'photo', photoIndex: 2,
      x: 4.7, y: 4.5, width: 3.0, height: 3.5,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
    // number badge
    elements.push({
      type: 'captionNumber', text: '3',
      x: 4.75, y: 7.7,
      width: 0.24, height: 0.24,
      fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: null, zIndex: 11,
    });
  }

  // G. Two bottom photos (below crowd shot)
  const botY = 8.2;
  const botW = 1.6;
  const botH = 1.6;
  if (photos.length > 3) {
    elements.push({
      type: 'photo', photoIndex: 3,
      x: 4.7, y: botY, width: botW, height: botH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
  }
  if (photos.length > 4) {
    elements.push({
      type: 'photo', photoIndex: 4,
      x: 4.7 + botW + 0.1, y: botY, width: botW, height: botH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
  }

  // ================ RIGHT PAGE (8 - 16) ================

  // H. Top row of 3 numbered photos + right caption column
  const rightTopY = 0.4;
  const rightTopW = 1.9;
  const rightTopH = 1.9;
  const rightTopX = 8.25;
  const rightTopGap = 0.1;
  for (let i = 0; i < 3; i++) {
    const idx = 5 + i;
    if (photos.length > idx) {
      const px = rightTopX + i * (rightTopW + rightTopGap);
      elements.push({
        type: 'photo', photoIndex: idx,
        x: px, y: rightTopY, width: rightTopW, height: rightTopH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
      elements.push({
        type: 'captionNumber', text: String(i + 1),
        x: px + rightTopW - 0.28, y: rightTopY + rightTopH - 0.28,
        width: 0.24, height: 0.24,
        fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '700',
        color: '#FFFFFF', backgroundColor: null, zIndex: 11,
      });
    }
  }

  // I. Right column caption block (top-right corner)
  const rightCapText = buildGroupedCaptionsText(photoCaptions, 5, Math.min(3, Math.max(0, photos.length - 5)));
  if (rightCapText) {
    elements.push({
      type: 'bodyCopy', text: rightCapText,
      x: 14.35, y: rightTopY,
      width: 1.4, height: rightTopH,
      fontSize: 7, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.35, columns: 1, textAlign: 'left', zIndex: 10,
    });
  }

  // J. Big hero photo bottom-right — bleeds off right + bottom edges
  const heroX = 8.3;
  const heroY = 3.2;
  const heroW = pageWidth - heroX;
  const heroH = pageHeight - heroY;
  const heroIdx = Math.max(0, Math.min(photos.length - 1, 8));
  if (photos.length > 0) {
    elements.push({
      type: 'photo', photoIndex: heroIdx,
      x: heroX, y: heroY, width: heroW, height: heroH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
    elements.push({
      type: 'captionNumber', text: '4',
      x: heroX + 0.1, y: heroY + heroH - 0.4,
      width: 0.24, height: 0.24,
      fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: null, zIndex: 11,
    });
  }

  // K. Multi-line purple pull-quote overlay on hero (top-left of hero)
  const pulled = (pageContent.quotes || []).find(q => q && q.text && !q.text.includes('['));
  if (pulled) {
    const words = pulled.text.replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '').split(/\s+/);
    const targetLines = 5;
    const perLine = Math.max(2, Math.ceil(words.length / targetLines));
    const lines = [];
    for (let i = 0; i < words.length; i += perLine) {
      lines.push(words.slice(i, i + perLine).join(' ').toUpperCase());
    }
    if (lines.length > 0) {
      lines[0] = '"' + lines[0];
      lines[lines.length - 1] = lines[lines.length - 1] + '"';
    }
    const qX = heroX + 0.3;
    const qY = heroY + 0.4;
    const qW = 3.2;
    const barH = 0.4;
    const lineGap = 0.05;
    lines.forEach((line, i) => {
      const y = qY + i * (barH + lineGap);
      elements.push({
        type: 'decorative', shape: 'rectangle',
        x: qX, y, width: qW, height: barH,
        color: PURPLE, opacity: 0.95, zIndex: 8,
      });
      elements.push({
        type: 'headline', text: line,
        x: qX + 0.18, y: y + 0.05,
        width: qW - 0.36,
        fontSize: 13, fontFamily: 'Source Sans Pro', fontWeight: '700',
        color: '#FFFFFF', backgroundColor: null, zIndex: 10,
      });
    });
    if (pulled.attribution) {
      elements.push({
        type: 'caption',
        text: '—' + pulled.attribution,
        x: qX + 0.18, y: qY + lines.length * (barH + lineGap) + 0.05,
        width: qW - 0.36, height: 0.3,
        fontSize: 9, fontFamily: 'Playfair Display', fontStyle: 'italic',
        color: '#FFFFFF', textAlign: 'left', zIndex: 10,
      });
    }
  }
}

// =============================================================================
// LAYOUT: CROSS-GUTTER MOSAIC (Tpl 5 — "Freshman Retreat" style)
// Left page: narrow left column with title in an outlined box, body copy,
// pull-quote attribution, one small preview photo with caption.
// Center: big cross-gutter hero photo, purple line-block pull quote overlay.
// Right page: 2x2 mosaic of numbered supporting photos; bottom-right vertical
// stack of two small photos with left-side captions, and a two-bar "featured
// moments" title block above them.
// =============================================================================
function buildCrossGutterMosaicLayout(elements, photos, pageContent, bounds, params) {
  const { leftPageStart, leftPageEnd, leftPageWidth,
          rightPageStart, rightPageEnd, rightPageWidth,
          pageHeight, pageWidth, MARGIN, GAP, photoCaptions = [] } = bounds;

  // === LEFT PAGE narrow column (T1..T4, P_small) ===
  const leftColW = 2.4;
  const leftColX = leftPageStart;

  // T1 — Title in a thin outlined box
  const titleBoxH = 1.2;
  if (pageContent.pageTitle) {
    elements.push({
      type: 'decorative', shape: 'rectangle',
      x: leftColX, y: MARGIN - 0.1,
      width: leftColW, height: titleBoxH,
      color: null,
      strokeColor: '#523D73',
      strokeWidth: 0.02,
      opacity: 1, zIndex: 8,
    });
    elements.push({
      type: 'pageTitle', text: pageContent.pageTitle,
      themeWord: pageContent.pageTitleThemeWord || null,
      x: leftColX + 0.15, y: MARGIN,
      width: leftColW - 0.3,
      fontSize: 26, fontFamily: 'Playfair Display', fontWeight: '900',
      color: '#1A1A1A', textAlign: 'left', letterSpacing: 1, zIndex: 10,
    });
  }

  // T2 — Body copy, single column
  let leftY = MARGIN + titleBoxH + 0.25;
  const bodyEndY = 6.7;
  if (pageContent.bodyCopy) {
    elements.push({
      type: 'bodyCopy', text: pageContent.bodyCopy,
      x: leftColX, y: leftY, width: leftColW,
      height: bodyEndY - leftY,
      fontSize: 9.5, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#1A1A1A', lineHeight: 1.45, columns: 1, textAlign: 'left', zIndex: 10,
    });
  }

  // T3 — Italic attribution/pull-quote
  const attrY = 6.85;
  const attributedQuote = (pageContent.quotes || []).find(q => q && q.text && !q.text.includes('['));
  if (attributedQuote) {
    elements.push({
      type: 'quote',
      text: `'${attributedQuote.text}'`,
      attribution: attributedQuote.attribution || '',
      x: leftColX, y: attrY, width: leftColW, height: 0.9,
      fontSize: 9, fontFamily: 'Playfair Display', fontStyle: 'italic',
      fontWeight: '400', color: '#1A1A1A',
      backgroundColor: null, accentColor: '#523D73', zIndex: 10,
    });
  }

  // P_small — bottom-left preview photo (uses last photo so it's distinct from hero)
  const smallPreviewIdx = Math.min(photos.length - 1, 5);
  const smallPreviewY = 8.3;
  const smallPreviewH = 1.6;
  if (photos.length > 1) {
    elements.push({
      type: 'photo', photoIndex: smallPreviewIdx,
      x: leftColX, y: smallPreviewY,
      width: leftColW, height: smallPreviewH,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });

    // T4 — Caption for P_small
    const cap = photoCaptions.find(c => c.photoIndex === smallPreviewIdx) || photoCaptions[smallPreviewIdx];
    if (cap) {
      const title = (cap.captionTitle || '').trim();
      const people = (cap.people || '').trim();
      const text = (cap.caption || '').trim();
      const isPlaceholder = (s) => !s || s.toLowerCase().includes('needs info') || s.includes('[') || s.toLowerCase().includes('tbd');
      let combined = '';
      if (!isPlaceholder(title)) combined += title.toUpperCase() + '  ';
      if (!isPlaceholder(people)) combined += people;
      if (!isPlaceholder(text)) combined += (combined ? ' ' : '') + text;
      if (combined) {
        elements.push({
          type: 'caption', text: combined,
          x: leftColX, y: smallPreviewY + smallPreviewH + 0.08,
          width: leftColW, height: 0.45,
          fontSize: 7.5, fontFamily: 'Source Sans Pro', fontWeight: '400',
          color: '#1A1A1A', textAlign: 'left', zIndex: 10,
        });
      }
    }
  }

  // === CENTER: cross-gutter hero photo ===
  // Starts on left page at ~x=3.0, extends across gutter to right page x~9.7
  const heroX = 3.0;
  const heroEndX = 9.7;
  const heroY = 0.25;
  const heroH = pageHeight - 0.55;  // bleeds top and bottom
  if (photos.length > 0) {
    elements.push({
      type: 'photo', photoIndex: 0,
      x: heroX, y: heroY,
      width: heroEndX - heroX, height: heroH,
      borderRadius: 0, shadow: false, blackAndWhite: true,
      zIndex: 1, cropFit: 'cover',
    });
    // Small "1" number badge in bottom-left corner of hero
    elements.push({
      type: 'captionNumber', text: '1',
      x: heroX + 0.05, y: heroY + heroH - 0.35,
      width: 0.3, height: 0.3,
      fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '400',
      color: '#FFFFFF', backgroundColor: null, zIndex: 11,
    });
  }

  // Q_overlay — purple line-block quote lower-left area of hero
  const overlayQuote = attributedQuote
    ? (pageContent.quotes || []).find(q => q && q !== attributedQuote && q.text && !q.text.includes('['))
    : (pageContent.quotes || []).find(q => q && q.text && !q.text.includes('['));
  if (overlayQuote) {
    // Break the quote text into ~3-4 short lines by word count.
    const words = overlayQuote.text.replace(/[.!?]+$/, '').split(/\s+/);
    const perLine = Math.ceil(words.length / 4);
    const lines = [];
    for (let i = 0; i < words.length; i += perLine) {
      lines.push(words.slice(i, i + perLine).join(' ').toUpperCase());
    }
    const oX = 3.4;
    const oW = 3.8;
    const barH = 0.32;
    const lineGap = 0.06;
    const startY = 6.9;
    lines.forEach((line, i) => {
      const y = startY + i * (barH + lineGap);
      elements.push({
        type: 'decorative', shape: 'rectangle',
        x: oX, y, width: oW, height: barH,
        color: '#523D73', opacity: 0.92, zIndex: 8,
      });
      elements.push({
        type: 'headline', text: line,
        x: oX + 0.15, y: y + 0.03,
        width: oW - 0.3,
        fontSize: 13, fontFamily: 'Source Sans Pro', fontWeight: '700',
        color: '#FFFFFF', backgroundColor: null, zIndex: 10,
      });
    });
    if (overlayQuote.attribution) {
      elements.push({
        type: 'caption',
        text: overlayQuote.attribution,
        x: oX, y: startY + lines.length * (barH + lineGap) + 0.05,
        width: oW, height: 0.3,
        fontSize: 9, fontFamily: 'Playfair Display', fontStyle: 'italic',
        color: '#FFFFFF', textAlign: 'left', zIndex: 10,
      });
    }
  }

  // === RIGHT PAGE 2x2 photo mosaic (P2..P5) ===
  const mosaicPhotos = photos.slice(1, Math.min(photos.length, 5));
  const mosaicX = 10.0;
  const mosaicY = MARGIN - 0.35;
  const mosaicW = pageWidth - mosaicX - MARGIN;
  const mosaicH = 4.9;
  if (mosaicPhotos.length > 0) {
    const cellW = (mosaicW - GAP) / 2;
    const cellH = (mosaicH - GAP) / 2;
    mosaicPhotos.forEach((_, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const px = mosaicX + col * (cellW + GAP);
      const py = mosaicY + row * (cellH + GAP);
      elements.push({
        type: 'photo', photoIndex: i + 1,
        x: px, y: py, width: cellW, height: cellH,
        borderRadius: 0, shadow: false, blackAndWhite: false,
        zIndex: 1, cropFit: 'cover',
      });
      elements.push({
        type: 'captionNumber', text: String(i + 2),
        x: px + cellW - 0.35, y: py + cellH - 0.35,
        width: 0.3, height: 0.3,
        fontSize: 10, fontFamily: 'Source Sans Pro', fontWeight: '700',
        color: '#FFFFFF', backgroundColor: null, zIndex: 11,
      });
    });
  }

  // === RIGHT PAGE bottom: "featured moments" title bars + 2 vertical mini photos with left captions ===
  const featuredHeadline = pageContent.headline || pageContent.subheadline || null;
  const featuredTagline = pageContent.subheadline && pageContent.headline
    ? pageContent.subheadline
    : (pageContent.record || null);

  const hbX = 13.2;
  const hbY = 5.9;
  const hbW = pageWidth - hbX - MARGIN;
  const barH = 0.55;
  if (featuredHeadline) {
    elements.push({
      type: 'headline',
      text: featuredHeadline,
      x: hbX, y: hbY, width: hbW,
      fontSize: 14, fontFamily: 'Playfair Display', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
  }
  if (featuredTagline) {
    elements.push({
      type: 'headline',
      text: featuredTagline,
      x: hbX, y: hbY + barH + 0.05, width: hbW,
      fontSize: 12, fontFamily: 'Source Sans Pro', fontWeight: '700',
      color: '#FFFFFF', backgroundColor: '#523D73', zIndex: 10,
    });
  }

  // Two vertical mini photos with captions on their LEFT side
  const miniPhotoStartIdx = 5;
  const miniPhotos = photos.slice(miniPhotoStartIdx, Math.min(photos.length, miniPhotoStartIdx + 2));
  const miniW = 1.7;
  const miniX = pageWidth - MARGIN - miniW;
  const miniCapX = hbX;
  const miniCapW = miniX - hbX - 0.1;

  if (miniPhotos[0]) {
    const y1 = 7.4;
    const h1 = 1.4;
    elements.push({
      type: 'photo', photoIndex: miniPhotoStartIdx,
      x: miniX, y: y1, width: miniW, height: h1,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
    const cap = photoCaptions.find(c => c.photoIndex === miniPhotoStartIdx) || photoCaptions[miniPhotoStartIdx];
    const capText = cap && !((cap.caption || '').includes('['))
      ? ((cap.people ? cap.people + '\n' : '') + (cap.caption || ''))
      : null;
    if (capText) {
      elements.push({
        type: 'caption', text: capText.trim(),
        x: miniCapX, y: y1, width: miniCapW, height: h1,
        fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '400',
        color: '#1A1A1A', textAlign: 'left', zIndex: 10,
      });
    }
  }

  if (miniPhotos[1]) {
    const y2 = 9.05;
    const h2 = 1.2;
    elements.push({
      type: 'photo', photoIndex: miniPhotoStartIdx + 1,
      x: miniX, y: y2, width: miniW, height: h2,
      borderRadius: 0, shadow: false, blackAndWhite: false,
      zIndex: 1, cropFit: 'cover',
    });
    const cap = photoCaptions.find(c => c.photoIndex === miniPhotoStartIdx + 1) || photoCaptions[miniPhotoStartIdx + 1];
    const capText = cap && !((cap.caption || '').includes('['))
      ? ((cap.people ? cap.people + '\n' : '') + (cap.caption || ''))
      : null;
    if (capText) {
      elements.push({
        type: 'caption', text: capText.trim(),
        x: miniCapX, y: y2, width: miniCapW, height: h2,
        fontSize: 8, fontFamily: 'Source Sans Pro', fontWeight: '400',
        color: '#1A1A1A', textAlign: 'left', zIndex: 10,
      });
    }
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
