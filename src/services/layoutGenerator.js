const Anthropic = require('@anthropic-ai/sdk');
const { PAGE } = require('../utils/constants');

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Generate a professional yearbook layout using Claude AI.
 *
 * @param {object} options
 * @param {array} options.photos - Processed photo metadata
 * @param {object} options.pageContent - All page content
 * @param {string} options.pageContent.section - Section name (e.g., "mens soccer", "fall dance")
 * @param {string} options.pageContent.schoolName - School name/abbreviation
 * @param {string} options.pageContent.headline - Main headline
 * @param {string} options.pageContent.subheadline - Optional subheadline
 * @param {string} options.pageContent.record - Record/stats line (e.g., "3-12", "11 as 1 for an audience")
 * @param {array} options.pageContent.roster - Array of names for roster list
 * @param {string} options.pageContent.bodyCopy - Main body text (season recap, event description)
 * @param {array} options.pageContent.quotes - Array of {text, attribution}
 * @param {array} options.pageContent.photoCaptions - Array of {photoIndex, caption, people} for each photo
 * @param {string} options.pageContent.folio - Page numbers (e.g., "42" or "42-43")
 * @param {object} options.theme - Theme configuration
 * @param {string} options.pageType - "page" (single) or "spread" (double)
 */
async function generateLayout({ photos, pageContent, theme, pageType = 'page' }) {
  const isSpread = pageType === 'spread';
  const pageWidth = isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN;
  const pageHeight = PAGE.HEIGHT_IN;

  const photoDescriptions = photos.map((p, i) => {
    const captionInfo = (pageContent.photoCaptions || [])[i] || {};
    return {
      index: i,
      orientation: p.orientation,
      aspectRatio: parseFloat(p.aspectRatio.toFixed(2)),
      people: captionInfo.people || '',
      caption: captionInfo.caption || '',
      isPrimary: captionInfo.isPrimary || false,
    };
  });

  const prompt = buildPrompt({
    photoDescriptions,
    pageContent,
    theme,
    pageWidth,
    pageHeight,
    isSpread,
  });

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Extract JSON from the response
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const layoutJson = JSON.parse(jsonMatch[1].trim());

  // Add page dimensions to the response
  layoutJson.pageType = pageType;
  layoutJson.dimensions = {
    width: pageWidth,
    height: pageHeight,
    widthPx: isSpread ? PAGE.SPREAD_WIDTH_PX : PAGE.WIDTH_PX,
    heightPx: PAGE.HEIGHT_PX,
  };

  return layoutJson;
}

function buildPrompt({ photoDescriptions, pageContent, theme, pageWidth, pageHeight, isSpread }) {
  const style = theme.style || 'editorial';
  const photoCount = photoDescriptions.length;

  // Build theme details
  const themeDetails = buildThemeDetails(theme);

  // Find primary photo
  const primaryPhotoIndex = photoDescriptions.findIndex(p => p.isPrimary);

  // Content summary
  const hasRoster = pageContent.roster && pageContent.roster.length > 0;
  const hasBodyCopy = pageContent.bodyCopy && pageContent.bodyCopy.length > 50;
  const hasQuotes = pageContent.quotes && pageContent.quotes.length > 0;
  const hasRecord = pageContent.record && pageContent.record.length > 0;

  return `You are a professional yearbook designer creating a ${isSpread ? 'two-page spread (pages side by side)' : 'single page'} layout. Study professional yearbook designs — they have complex, magazine-quality layouts with multiple text blocks, varied photo sizes, and clear visual hierarchy.

PAGE SPECIFICATIONS:
- Total dimensions: ${pageWidth}" × ${pageHeight}"
- Safe margin: ${PAGE.SAFE_MARGIN_IN}" from all edges
${isSpread ? `- CENTER GUTTER: There is a binding fold at x=${pageWidth/2}" (${PAGE.WIDTH_IN}"). Avoid placing faces, important text, or key elements within 0.5" of the center (x: ${PAGE.WIDTH_IN - 0.5}" to ${PAGE.WIDTH_IN + 0.5}").
- LEFT PAGE: x: 0" to ${PAGE.WIDTH_IN}"
- RIGHT PAGE: x: ${PAGE.WIDTH_IN}" to ${pageWidth}"` : ''}
- All positions in INCHES from top-left corner

CONTENT TO INCLUDE:

SECTION HEADER: "${pageContent.section || ''}"
SCHOOL NAME: "${pageContent.schoolName || ''}"
HEADLINE: "${pageContent.headline || ''}"
${pageContent.subheadline ? `SUBHEADLINE: "${pageContent.subheadline}"` : ''}
${hasRecord ? `RECORD/STATS: "${pageContent.record}"` : ''}

${hasRoster ? `ROSTER (${pageContent.roster.length} names):
${pageContent.roster.slice(0, 10).join(', ')}${pageContent.roster.length > 10 ? `, ... (${pageContent.roster.length} total)` : ''}
Format as a compact list with "Roster:" header.` : ''}

${hasBodyCopy ? `BODY COPY (${pageContent.bodyCopy.length} chars):
"${pageContent.bodyCopy.substring(0, 300)}${pageContent.bodyCopy.length > 300 ? '...' : ''}"
This is the main story text. Place in readable columns (2.5-3.5" wide).` : ''}

${hasQuotes ? `QUOTES:
${pageContent.quotes.map((q, i) => `  ${i + 1}. "${q.text}" — ${q.attribution}`).join('\n')}
Style as prominent pull quotes with large quotation marks or accent styling.` : ''}

PHOTOS (${photoCount} total):
${photoDescriptions.map(p => `  Photo ${p.index}: ${p.orientation} (${p.aspectRatio}:1)
    - People: ${p.people || 'Not specified'}
    - Caption: ${p.caption || 'No caption'}`).join('\n')}

${primaryPhotoIndex >= 0 ? `Photo ${primaryPhotoIndex} is marked as PRIMARY — make it the dominant image (largest).` : 'Choose the most impactful photo as the dominant image.'}

FOLIO: "${pageContent.folio || ''}" (page numbers, bottom corners)

THEME:
${themeDetails}

DESIGN STYLE: "${style}"
${getStyleInstructions(style, isSpread)}

YEARBOOK DESIGN PRINCIPLES:
1. VISUAL HIERARCHY: One dominant photo (30-50% of page), medium supporting photos, small detail shots
2. PHOTO VARIETY: Mix sizes dramatically — large hero, medium action, small grid/strip
3. TEXT COLUMNS: Body copy in 2.5-3.5" columns, 9-11pt, good leading
4. CAPTIONS: Near photos, 8-9pt italic, identify people left-to-right
5. PULL QUOTES: Large, stylized, break up text blocks
6. SECTION HEADER: Top of page, distinctive typography
7. WHITE SPACE: Intentional breathing room, not cramped
8. PHOTO OVERLAP: Some photos can overlap for dynamic feel
9. NUMBERS/STATS: Make record/stats visually prominent with accent colors
10. ${isSpread ? 'SPREAD FLOW: Content should flow across both pages, but respect the gutter' : 'BALANCE: Distribute visual weight across the page'}

Return ONLY valid JSON:

{
  "background": {
    "type": "solid" | "gradient",
    "color": "#hex",
    "gradientAngle": number,
    "gradientStops": ["#hex1", "#hex2"]
  },
  "elements": [
    {
      "type": "photo",
      "photoIndex": number,
      "x": number, "y": number, "width": number, "height": number,
      "rotation": number (-3 to 3),
      "borderRadius": number (0-0.1),
      "borderWidth": number (0 or 0.02-0.05 for white border),
      "borderColor": "#hex",
      "shadow": boolean,
      "shadowIntensity": "subtle" | "medium" | "dramatic",
      "zIndex": number,
      "cropFit": "cover"
    },
    {
      "type": "sectionHeader",
      "text": "section name",
      "x": number, "y": number, "width": number,
      "fontSize": number (24-36pt),
      "fontFamily": "from theme",
      "fontWeight": "300" | "400" | "700",
      "color": "#hex",
      "textTransform": "lowercase" | "uppercase" | "none",
      "letterSpacing": number,
      "zIndex": number
    },
    {
      "type": "schoolName",
      "text": "SCHOOL",
      "x": number, "y": number, "width": number,
      "fontSize": number (48-72pt),
      "fontFamily": "from theme",
      "fontWeight": "700" | "900",
      "color": "#hex",
      "letterSpacing": number,
      "zIndex": number
    },
    {
      "type": "headline",
      "text": "headline text",
      "x": number, "y": number, "width": number,
      "fontSize": number (14-24pt),
      "fontFamily": "from theme",
      "fontWeight": "700",
      "color": "#hex",
      "backgroundColor": "#hex or null",
      "textAlign": "left" | "center" | "right",
      "zIndex": number
    },
    {
      "type": "record",
      "text": "3-12",
      "x": number, "y": number, "width": number,
      "fontSize": number (14-20pt),
      "fontFamily": "from theme",
      "fontWeight": "700",
      "color": "#hex",
      "backgroundColor": "#hex for highlight effect",
      "zIndex": number
    },
    {
      "type": "roster",
      "title": "Roster:",
      "names": ["name1", "name2", ...],
      "x": number, "y": number, "width": number,
      "columns": 1 | 2 | 3,
      "titleFontSize": number (10-12pt),
      "nameFontSize": number (7-9pt),
      "fontFamily": "from theme body font",
      "titleColor": "#hex",
      "nameColor": "#hex",
      "zIndex": number
    },
    {
      "type": "bodyCopy",
      "text": "full body text...",
      "x": number, "y": number, "width": number, "height": number,
      "fontSize": number (9-11pt),
      "fontFamily": "from theme body font",
      "color": "#hex",
      "lineHeight": 1.3-1.5,
      "columns": 1 | 2,
      "zIndex": number
    },
    {
      "type": "quote",
      "text": "quote text",
      "attribution": "— Person Name",
      "x": number, "y": number, "width": number,
      "fontSize": number (14-20pt),
      "fontFamily": "from theme",
      "fontStyle": "italic",
      "color": "#hex",
      "accentColor": "#hex for quotation marks",
      "zIndex": number
    },
    {
      "type": "caption",
      "text": "caption text identifying people",
      "photoIndex": number,
      "x": number, "y": number, "width": number,
      "fontSize": number (8-9pt),
      "fontFamily": "from theme body font",
      "fontStyle": "italic" | "normal",
      "color": "#hex",
      "zIndex": number
    },
    {
      "type": "captionNumber",
      "number": "1",
      "x": number, "y": number,
      "fontSize": number (8-10pt),
      "fontFamily": "from theme",
      "color": "#hex",
      "backgroundColor": "#hex",
      "zIndex": number
    },
    {
      "type": "decorative",
      "shape": "line" | "rectangle" | "circle",
      "x": number, "y": number, "width": number, "height": number,
      "color": "#hex",
      "opacity": 0-1,
      "zIndex": number
    },
    {
      "type": "folio",
      "text": "42",
      "x": number, "y": number,
      "fontSize": number (9-10pt),
      "fontFamily": "from theme",
      "color": "#hex",
      "zIndex": number
    }
  ]
}`;
}

function buildThemeDetails(theme) {
  const details = [];

  // Colors
  const colors = theme.colors || {};
  details.push(`Colors:
  - Background: ${colors.background || theme.backgroundColor || '#ffffff'}
  - Primary: ${colors.primary || theme.primaryColor || '#1a1a2e'}
  - Secondary: ${colors.secondary || theme.secondaryColor || '#4a4a4a'}
  - Accent: ${colors.accent || theme.accentColor || '#8b5cf6'}
  - Text: ${colors.text || theme.textColor || '#1a1a1a'}
  - Text Light: ${colors.textLight || theme.textLightColor || '#666666'}`);

  // Typography
  const typography = theme.typography || {};
  details.push(`Typography:
  - Headline Font: ${typography.headlineFont || theme.headlineFont || 'Playfair Display'}
  - Headline Weight: ${typography.headlineFontWeight || '700'}
  - Body Font: ${typography.bodyFont || theme.bodyFont || 'Source Sans Pro'}
  - Body Weight: ${typography.bodyFontWeight || '400'}`);

  // Layout
  const layout = theme.layout || {};
  details.push(`Photo Treatment:
  - Style: ${layout.photoTreatment || 'sharp-corners'}
  - Shadows: ${layout.photoShadows || 'subtle'}
  - Borders: ${layout.photoBorders || 'none'}`);

  return details.join('\n\n');
}

function getStyleInstructions(style, isSpread) {
  const baseInstructions = {
    editorial: `EDITORIAL/MAGAZINE STYLE:
- Clean, professional layout with clear grid structure
- Large dominant photo with smaller supporting images
- Text in defined columns with proper typography
- Pull quotes as design elements
- Minimal but intentional decorative elements
- Strong section headers with hierarchy`,

    dynamic: `DYNAMIC/SPORTS STYLE:
- High energy with angled photos (-2° to 3°)
- Overlapping images for depth
- Bold colors and strong contrasts
- Action-focused photo selection
- Energetic decorative lines/shapes
- Numbers and stats prominently displayed`,

    elegant: `ELEGANT/FORMAL STYLE:
- Refined typography with generous spacing
- Straight, aligned photos
- Subtle shadows and thin divider lines
- Sophisticated color palette
- Balanced white space
- Classic, timeless feel`,

    collage: `COLLAGE/SCRAPBOOK STYLE:
- Photos at various angles (-5° to 5°)
- Polaroid-style white borders on photos
- Overlapping, layered arrangement
- Handwritten-style fonts for accents
- Fun, casual energy
- Mixed photo sizes scattered organically`,

    minimal: `MINIMAL/MODERN STYLE:
- Maximum white space
- Clean grid alignment
- Limited color palette
- Simple typography
- Photos as focal points
- Restrained decorative elements`,

    bold: `BOLD/GRAPHIC STYLE:
- Strong color blocks
- Large typography
- High contrast
- Geometric shapes
- Impactful visual statements
- Minimal but large decorative elements`,
  };

  let instructions = baseInstructions[style] || baseInstructions.editorial;

  if (isSpread) {
    instructions += `\n\nSPREAD-SPECIFIC:
- Create visual flow across both pages
- Dominant photo can span the gutter (but not faces in gutter)
- Balance content between left and right pages
- Section header typically top-left or top-right
- Body copy can flow from left to right page`;
  }

  return instructions;
}

module.exports = { generateLayout };
