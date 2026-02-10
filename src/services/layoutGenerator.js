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
 * Generate a unique layout composition using Claude AI.
 * @param {object} options
 * @param {array} options.photos - Processed photo metadata
 * @param {string} options.topic - Page topic (e.g., "Boys Soccer")
 * @param {string} options.headline - Main headline text
 * @param {array} options.photoDetails - Array of {who, whatIsHappening, caption} for each photo
 * @param {array} options.quotes - Array of {text, attribution} for quotes
 * @param {object} options.theme - Theme configuration
 * @param {string} options.pageType - "page" (single) or "spread" (double)
 */
async function generateLayout({ photos, topic, headline, photoDetails = [], quotes = [], theme, pageType = 'page' }) {
  const isSpread = pageType === 'spread';
  const pageWidth = isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN;
  const pageHeight = PAGE.HEIGHT_IN;

  const photoDescriptions = photos.map((p, i) => {
    const details = photoDetails[i] || {};
    return {
      index: i,
      orientation: p.orientation,
      aspectRatio: parseFloat(p.aspectRatio.toFixed(2)),
      who: details.who || 'Unknown',
      whatIsHappening: details.whatIsHappening || '',
      caption: details.caption || '',
      isPrimary: details.isPrimary || false,
    };
  });

  const prompt = buildPrompt({
    photoDescriptions,
    topic,
    headline,
    quotes,
    theme,
    pageWidth,
    pageHeight,
    isSpread,
  });

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Extract JSON from the response (may be wrapped in markdown code fence)
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

function buildPrompt({ photoDescriptions, topic, headline, quotes, theme, pageWidth, pageHeight, isSpread }) {
  const style = theme.style || 'dynamic';
  const photoCount = photoDescriptions.length;

  // Build detailed theme instructions from extracted theme
  const themeDetails = buildThemeDetails(theme);

  // Find primary photo if specified
  const primaryPhotoIndex = photoDescriptions.findIndex(p => p.isPrimary);
  const dominantPhotoNote = primaryPhotoIndex >= 0
    ? `Photo ${primaryPhotoIndex} should be the DOMINANT image (marked as primary).`
    : `Make the first photo or the most visually interesting one the DOMINANT image.`;

  return `You are a professional yearbook designer creating a ${isSpread ? 'two-page spread' : 'single page'} layout.

PAGE SPECIFICATIONS:
- Dimensions: ${pageWidth}" × ${pageHeight}" (${isSpread ? 'spread - two pages side by side' : 'single page'})
- Safe margin: ${PAGE.SAFE_MARGIN_IN}" from all edges
- ${isSpread ? `Gutter margin: ${PAGE.GUTTER_MARGIN_IN}" on each side of the center fold (avoid placing faces/text in center ${PAGE.GUTTER_MARGIN_IN * 2}" zone)` : ''}
- Bleed: ${PAGE.BLEED_IN}" on all edges (photos can extend beyond page edges)
- All positions in INCHES from top-left corner

CONTENT:
Topic: "${topic}"
Headline: "${headline}"
Photo Count: ${photoCount}

PHOTOS WITH CONTEXT:
${photoDescriptions.map(p => `  Photo ${p.index}: ${p.orientation} (${p.aspectRatio}:1)
    - Who: ${p.who}
    - What's happening: ${p.whatIsHappening || 'Not specified'}
    - Caption: ${p.caption || 'No caption'}`).join('\n')}

${quotes.length > 0 ? `QUOTES TO INCLUDE:
${quotes.map((q, i) => `  ${i + 1}. "${q.text}" — ${q.attribution}`).join('\n')}` : ''}

THEME SPECIFICATIONS:
${themeDetails}

DESIGN STYLE: "${style}"
${getStyleInstructions(style)}

CRITICAL RULES:
1. ${dominantPhotoNote} The dominant photo should be at least 40% of page area.
2. Vary photo sizes dramatically — create visual hierarchy.
3. Every photo (index 0 to ${photoCount - 1}) MUST appear exactly once.
4. Use the WHO information to ensure faces are not cropped awkwardly.
5. Place captions near their corresponding photos — use the photo context to make captions meaningful.
6. ${quotes.length > 0 ? 'Include all quotes with attribution, styled as pull quotes.' : 'Add 2-4 decorative elements using theme colors.'}
7. Ensure text is readable — no text over busy photo areas without a background.
8. All text must be within the safe margin area.
9. ${isSpread ? 'CRITICAL: Avoid placing important content (faces, text) in the center gutter zone (7.5" to 8.5" from left edge).' : ''}
10. Generate a UNIQUE composition — never use the same layout twice.

Return ONLY valid JSON matching this schema:

{
  "background": {
    "type": "solid" | "gradient",
    "color": "#hex",
    "gradientAngle": number (degrees),
    "gradientStops": ["#hex1", "#hex2"]
  },
  "elements": [
    {
      "type": "photo",
      "photoIndex": number,
      "x": number (inches from left),
      "y": number (inches from top),
      "width": number (inches),
      "height": number (inches),
      "rotation": number (degrees, -5 to 5),
      "borderRadius": number (inches, based on theme photoTreatment),
      "borderWidth": number (inches, 0 if none),
      "borderColor": "#hex",
      "shadow": boolean,
      "shadowIntensity": "subtle" | "medium" | "dramatic",
      "zIndex": number,
      "cropFit": "cover",
      "opacity": number (0.0 to 1.0)
    },
    {
      "type": "headline",
      "text": "${headline}",
      "x": number,
      "y": number,
      "width": number,
      "fontSize": number (pts, 32-72),
      "fontFamily": "from theme",
      "fontWeight": "from theme",
      "color": "#hex from theme",
      "textAlign": "left" | "center" | "right",
      "letterSpacing": number (px, based on theme),
      "textTransform": "uppercase" | "none" | "capitalize",
      "zIndex": number,
      "backgroundColor": "#hex or null (for text background block)"
    },
    {
      "type": "caption",
      "text": "caption text using photo context",
      "photoIndex": number (which photo this caption belongs to),
      "x": number,
      "y": number,
      "width": number,
      "fontSize": number (pts, 9-14),
      "fontFamily": "from theme bodyFont",
      "fontWeight": "from theme",
      "fontStyle": "normal" | "italic",
      "color": "#hex from theme",
      "lineHeight": number (1.2-1.6),
      "zIndex": number
    },
    {
      "type": "quote",
      "text": "quote text",
      "attribution": "— Person Name",
      "x": number,
      "y": number,
      "width": number,
      "fontSize": number (pts, 14-24),
      "fontFamily": "from theme",
      "fontStyle": "italic",
      "color": "#hex",
      "zIndex": number
    },
    {
      "type": "decorative",
      "shape": "line" | "rectangle" | "circle",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "color": "#hex from theme accent",
      "opacity": number (0.0 to 1.0),
      "rotation": number,
      "zIndex": number
    }
  ]
}`;
}

function buildThemeDetails(theme) {
  const details = [];

  // Colors
  if (theme.colors) {
    details.push(`Colors:
  - Background: ${theme.colors.background || theme.backgroundColor || '#ffffff'}
  - Primary: ${theme.colors.primary || theme.primaryColor || '#1a1a2e'}
  - Secondary: ${theme.colors.secondary || theme.secondaryColor || '#16213e'}
  - Accent: ${theme.colors.accent || theme.accentColor || '#e94560'}
  - Text: ${theme.colors.text || theme.textColor || '#1a1a1a'}
  - Text Light: ${theme.colors.textLight || theme.textLightColor || '#666666'}`);
  } else {
    details.push(`Colors:
  - Primary: ${theme.primaryColor || '#1a1a2e'}
  - Secondary: ${theme.secondaryColor || '#16213e'}
  - Accent: ${theme.accentColor || '#e94560'}`);
  }

  // Typography
  if (theme.typography) {
    details.push(`Typography:
  - Headline Font: ${theme.typography.headlineFont || theme.headlineFont || 'Oswald'} (weight: ${theme.typography.headlineFontWeight || 700})
  - Headline Style: ${theme.typography.headlineStyle || 'uppercase'}, letter-spacing: ${theme.typography.headlineLetterSpacing || 'normal'}
  - Body Font: ${theme.typography.bodyFont || theme.bodyFont || 'Open Sans'} (weight: ${theme.typography.bodyFontWeight || 400})
  - Caption Style: ${theme.typography.captionStyle || 'normal'}
  - Text Alignment: ${theme.typography.textAlignment || 'left'}`);
  } else {
    details.push(`Typography:
  - Headline Font: ${theme.headlineFont || 'Oswald'}
  - Body Font: ${theme.bodyFont || 'Open Sans'}`);
  }

  // Layout treatment
  if (theme.layout) {
    details.push(`Photo Treatment:
  - Corners: ${theme.layout.photoTreatment || 'sharp-corners'}
  - Shadows: ${theme.layout.photoShadows || 'subtle'}
  - Borders: ${theme.layout.photoBorders || 'none'}
  - Overlap: ${theme.layout.photoOverlap ? 'yes' : 'no'}
  - Rotation: ${theme.layout.photoRotation || 'none'}
  - Whitespace: ${theme.layout.whitespaceAmount || 'moderate'}`);
  }

  // Decorative elements
  if (theme.decorativeElements) {
    details.push(`Decorative Elements:
  - Lines: ${theme.decorativeElements.lineStyle || 'thin'} (${theme.decorativeElements.lineColor || 'accent color'})
  - Shapes: ${(theme.decorativeElements.shapes || []).join(', ') || 'none'}
  - Patterns: ${theme.decorativeElements.patterns || 'none'}
  - Dividers: ${theme.decorativeElements.dividers || 'lines'}`);
  }

  return details.join('\n\n');
}

function getStyleInstructions(style) {
  const instructions = {
    dynamic: `DYNAMIC STYLE:
- Use diagonal lines and slightly rotated photos (-3° to 3°)
- Overlap photos with shadows for depth
- Place headline at an angle or with a bold color block behind it
- High energy, movement-driven layout
- Consider placing the dominant photo at an angle spanning most of the page`,

    elegant: `ELEGANT STYLE:
- Clean lines, generous white space
- No rotation on photos — keep everything straight and aligned
- Use thin rule lines as dividers
- Headline should use elegant letter spacing (3-5px)
- Subtle drop shadows, muted decorative elements
- Refined, sophisticated composition`,

    bold: `BOLD STYLE:
- Large, impactful headline (60-72pt)
- Strong color blocks behind text
- High contrast between elements
- Minimal decorative elements but make them large
- Photos with sharp corners, no border radius
- Powerful, statement-making layout`,

    minimal: `MINIMAL STYLE:
- Maximum white space, minimal decorative elements
- Small, precise typography
- Photos arranged in a clean grid pattern
- Thin lines only for decoration
- Lots of breathing room between elements
- Less is more — only essential elements`,

    collage: `COLLAGE STYLE:
- Overlapping photos at various angles (-5° to 5°)
- Photos with white borders (simulate printed photo look)
- Scattered, organic arrangement
- Headline can be overlaid on photos
- Fun, casual, scrapbook-like feel
- Drop shadows on all photos`,

    editorial: `EDITORIAL STYLE:
- Magazine-style layout with clear visual hierarchy
- One very large dominant photo
- Text in clean columns beside photos
- Professional typography with varied sizes
- Strategic use of pull quotes
- Clean, publication-quality design`,
  };

  return instructions[style] || instructions.dynamic;
}

module.exports = { generateLayout };
