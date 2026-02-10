const Anthropic = require('@anthropic-ai/sdk');
const { PAGE } = require('../utils/constants');
const { validateAndCorrectLayout } = require('./layoutValidator');

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
 * @param {string} options.pageContent.pageCategory - Type: "sports", "events", "clubs", "academics", "people", "student-life"
 * @param {string} options.pageContent.section - Section name (e.g., "mens soccer", "fall dance", "science club")
 * @param {string} options.pageContent.schoolName - School name/abbreviation
 * @param {string} options.pageContent.headline - Main headline
 * @param {string} options.pageContent.subheadline - Optional subheadline
 * @param {string} options.pageContent.dateOrYear - Date or year (e.g., "Fall 2024", "October 15, 2024")
 * @param {string} options.pageContent.record - Record/stats (sports) or attendance/participation numbers
 * @param {array} options.pageContent.roster - Array of names (team roster, club members, class list)
 * @param {string} options.pageContent.rosterTitle - Custom title for roster (e.g., "Team Roster:", "Club Members:", "Class of 2025:")
 * @param {string} options.pageContent.bodyCopy - Main body text
 * @param {array} options.pageContent.quotes - Array of {text, attribution}
 * @param {array} options.pageContent.highlights - Array of highlight/bullet points
 * @param {array} options.pageContent.photoCaptions - Array of {photoIndex, caption, people, isPrimary}
 * @param {string} options.pageContent.folio - Page numbers
 * @param {object} options.theme - Theme configuration
 * @param {string} options.pageType - "page" (single) or "spread" (double)
 */
async function generateLayout({ photos, pageContent, theme, pageType = 'page' }) {
  const isSpread = pageType === 'spread';
  const pageWidth = isSpread ? PAGE.SPREAD_WIDTH_IN : PAGE.WIDTH_IN;
  const pageHeight = PAGE.HEIGHT_IN;

  // Detect page category from content or explicit setting
  const pageCategory = detectPageCategory(pageContent);

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
    pageCategory,
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
  let layoutJson = JSON.parse(jsonMatch[1].trim());

  // CRITICAL: Validate and correct the layout for style guide compliance
  // This ensures DCHS colors, fonts, and styling are enforced regardless of AI output
  layoutJson = validateAndCorrectLayout(layoutJson, theme);

  // Add page dimensions to the response
  layoutJson.pageType = pageType;
  layoutJson.pageCategory = pageCategory;
  layoutJson.dimensions = {
    width: pageWidth,
    height: pageHeight,
    widthPx: isSpread ? PAGE.SPREAD_WIDTH_PX : PAGE.WIDTH_PX,
    heightPx: PAGE.HEIGHT_PX,
  };

  return layoutJson;
}

/**
 * Detect page category from content
 */
function detectPageCategory(pageContent) {
  // Explicit category
  if (pageContent.pageCategory) return pageContent.pageCategory;

  const section = (pageContent.section || '').toLowerCase();
  const headline = (pageContent.headline || '').toLowerCase();
  const combined = `${section} ${headline}`;

  // Sports keywords
  if (/soccer|football|basketball|baseball|softball|volleyball|tennis|golf|track|cross country|swimming|wrestling|cheer|lacrosse|hockey|team|varsity|jv|junior varsity|coach/i.test(combined)) {
    return 'sports';
  }

  // Events keywords
  if (/dance|prom|homecoming|formal|spirit week|rally|assembly|concert|play|musical|performance|show|festival|fair|carnival|celebration|ceremony|graduation|commencement/i.test(combined)) {
    return 'events';
  }

  // Clubs/Organizations keywords
  if (/club|society|council|organization|nhs|national honor|student government|ffa|fbla|deca|key club|interact|rotary|volunteer|community service|debate|forensics|model un|robotics|stem|science olympiad/i.test(combined)) {
    return 'clubs';
  }

  // Academics keywords
  if (/class|course|department|english|math|science|history|social studies|art|music|band|choir|orchestra|drama|theatre|language|spanish|french|german|latin|ap |honors|gifted|special ed|faculty|teacher|professor/i.test(combined)) {
    return 'academics';
  }

  // People/Portraits keywords
  if (/senior|junior|sophomore|freshman|class of|portrait|headshot|staff|faculty|administration|principal|counselor/i.test(combined)) {
    return 'people';
  }

  // Student life keywords
  if (/lunch|cafeteria|hallway|locker|campus|student life|day in the life|candid|around school|moments|memories|friends|hangout/i.test(combined)) {
    return 'student-life';
  }

  // Default
  return 'general';
}

function buildPrompt({ photoDescriptions, pageContent, pageCategory, theme, pageWidth, pageHeight, isSpread }) {
  const style = theme.style || 'editorial';
  const photoCount = photoDescriptions.length;

  // Check if using DCHS style guide
  const hasDCHSStyleGuide = theme.styleGuide || theme.preset === 'dchs-official';
  const dchsRules = theme.rules || {};

  // Build theme details
  const themeDetails = buildThemeDetails(theme);

  // Build DCHS-specific instructions if applicable
  const dchsInstructions = hasDCHSStyleGuide ? buildDCHSInstructions(theme, pageCategory) : '';

  // Find primary photo
  const primaryPhotoIndex = photoDescriptions.findIndex(p => p.isPrimary);

  // Content flags
  const hasRoster = pageContent.roster && pageContent.roster.length > 0;
  const hasBodyCopy = pageContent.bodyCopy && pageContent.bodyCopy.length > 50;
  const hasQuotes = pageContent.quotes && pageContent.quotes.length > 0;
  const hasRecord = pageContent.record && pageContent.record.length > 0;
  const hasHighlights = pageContent.highlights && pageContent.highlights.length > 0;
  const hasDate = pageContent.dateOrYear && pageContent.dateOrYear.length > 0;

  // Get category-specific guidance
  const categoryGuidance = getCategoryGuidance(pageCategory);

  return `You are a professional yearbook designer creating a ${isSpread ? 'two-page spread (pages side by side)' : 'single page'} layout.

PAGE TYPE: ${pageCategory.toUpperCase()} PAGE
${categoryGuidance}

PAGE SPECIFICATIONS:
- Total dimensions: ${pageWidth}" × ${pageHeight}"
- Safe margin: ${PAGE.SAFE_MARGIN_IN}" from all edges
${isSpread ? `- CENTER GUTTER: Binding fold at x=${pageWidth/2}" (${PAGE.WIDTH_IN}"). Avoid placing faces, important text within 0.5" of center.
- LEFT PAGE: x: 0" to ${PAGE.WIDTH_IN}"
- RIGHT PAGE: x: ${PAGE.WIDTH_IN}" to ${pageWidth}"` : ''}
- All positions in INCHES from top-left corner

CONTENT TO INCLUDE:

SECTION HEADER: "${pageContent.section || ''}"
${pageContent.schoolName ? `SCHOOL NAME: "${pageContent.schoolName}"` : ''}
${pageContent.headline ? `HEADLINE: "${pageContent.headline}"` : ''}
${pageContent.subheadline ? `SUBHEADLINE: "${pageContent.subheadline}"` : ''}
${hasDate ? `DATE/YEAR: "${pageContent.dateOrYear}"` : ''}
${hasRecord ? `STATS/NUMBERS: "${pageContent.record}"` : ''}

${hasRoster ? `${pageContent.rosterTitle || 'ROSTER/MEMBERS'} (${pageContent.roster.length} names):
${pageContent.roster.slice(0, 15).join(', ')}${pageContent.roster.length > 15 ? `, ... (${pageContent.roster.length} total)` : ''}
Format as a compact list.` : ''}

${hasBodyCopy ? `BODY COPY (${pageContent.bodyCopy.length} chars):
"${pageContent.bodyCopy.substring(0, 400)}${pageContent.bodyCopy.length > 400 ? '...' : ''}"
Place in readable columns (2.5-3.5" wide).` : ''}

${hasHighlights ? `HIGHLIGHTS/KEY POINTS:
${pageContent.highlights.map((h, i) => `  • ${h}`).join('\n')}` : ''}

${hasQuotes ? `QUOTES:
${pageContent.quotes.map((q, i) => `  ${i + 1}. "${q.text}" — ${q.attribution}`).join('\n')}
Style as prominent pull quotes.` : ''}

PHOTOS (${photoCount} total):
${photoDescriptions.map(p => `  Photo ${p.index}: ${p.orientation} (${p.aspectRatio}:1)
    - People/Subject: ${p.people || 'Not specified'}
    - Caption: ${p.caption || 'No caption'}`).join('\n')}

${primaryPhotoIndex >= 0 ? `Photo ${primaryPhotoIndex} is marked as PRIMARY — make it the dominant image.` : 'Choose the most impactful photo as the dominant image.'}

FOLIO: "${pageContent.folio || ''}" (page numbers, bottom corners)

THEME:
${themeDetails}

DESIGN STYLE: "${style}"
${getStyleInstructions(style, isSpread)}

${dchsInstructions}

YEARBOOK DESIGN PRINCIPLES:
1. VISUAL HIERARCHY: One dominant photo (30-50% of page area), varied supporting sizes
2. TEXT READABILITY: Body copy in 2.5-3.5" columns, 9-11pt font
3. CAPTIONS: Near photos, 8-9pt, identify people left-to-right
4. PULL QUOTES: Large, stylized, break up long text
5. WHITE SPACE: Intentional breathing room
6. FLOW: ${isSpread ? 'Content flows across both pages, respecting gutter' : 'Balanced visual weight'}

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
      "borderWidth": number,
      "borderColor": "#hex",
      "shadow": boolean,
      "shadowIntensity": "subtle" | "medium" | "dramatic",
      "blackAndWhite": boolean (true for dramatic B&W treatment),
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
      "fontSize": number (36-72pt),
      "fontFamily": "from theme",
      "fontWeight": "700" | "900",
      "color": "#hex",
      "zIndex": number
    },
    {
      "type": "headline",
      "text": "headline",
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
      "type": "subheadline",
      "text": "subheadline",
      "x": number, "y": number, "width": number,
      "fontSize": number (11-16pt),
      "fontFamily": "from theme",
      "color": "#hex",
      "zIndex": number
    },
    {
      "type": "date",
      "text": "Fall 2024",
      "x": number, "y": number, "width": number,
      "fontSize": number (10-14pt),
      "fontFamily": "from theme",
      "color": "#hex",
      "zIndex": number
    },
    {
      "type": "record",
      "text": "stats/numbers",
      "x": number, "y": number, "width": number,
      "fontSize": number (14-20pt),
      "fontFamily": "from theme",
      "fontWeight": "700",
      "color": "#hex",
      "backgroundColor": "#hex for highlight",
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
      "fontFamily": "from theme",
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
      "type": "highlights",
      "items": ["highlight 1", "highlight 2"],
      "x": number, "y": number, "width": number,
      "fontSize": number (9-11pt),
      "fontFamily": "from theme",
      "color": "#hex",
      "bulletColor": "#hex",
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
      "accentColor": "#hex",
      "zIndex": number
    },
    {
      "type": "caption",
      "text": "caption text",
      "photoIndex": number,
      "x": number, "y": number, "width": number,
      "fontSize": number (8-9pt),
      "fontFamily": "from theme",
      "fontStyle": "italic" | "normal",
      "color": "#hex",
      "zIndex": number
    },
    {
      "type": "captionNumber",
      "number": "1",
      "x": number, "y": number,
      "fontSize": number (8-10pt),
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
      "color": "#hex",
      "zIndex": number
    }
  ]
}`;
}

function getCategoryGuidance(category) {
  const guidance = {
    sports: `SPORTS PAGE GUIDANCE:
- Emphasize ACTION shots — players in motion, game moments
- Include team photo if available (usually dominant or secondary)
- Stats/record should be prominent with accent color highlight
- Roster formatted compactly, often with coach names at start
- Captions should identify jersey numbers and actions
- Dynamic, energetic layout with angled elements works well`,

    events: `EVENT PAGE GUIDANCE:
- Capture the ATMOSPHERE — decorations, crowds, emotions
- Mix wide establishing shots with detail/candid moments
- Date/year is important for context
- Quotes capture participant reactions
- Story flow: setup → highlights → conclusion
- Can be more playful with layout depending on event type`,

    clubs: `CLUB/ORGANIZATION PAGE GUIDANCE:
- Group photo often dominant (identify all members)
- Show ACTIVITIES — meetings, projects, competitions
- Member list with officers/leaders highlighted
- Include accomplishments, awards, community service hours
- Professional but approachable tone
- May include advisor/sponsor names`,

    academics: `ACADEMICS PAGE GUIDANCE:
- Show LEARNING in action — labs, discussions, projects
- Teacher/faculty featured appropriately
- Can include student work samples
- Class lists or department roster
- Educational, informative tone
- Balance candids with posed shots`,

    people: `PEOPLE/PORTRAITS PAGE GUIDANCE:
- Portrait photos are primary content
- Consistent sizing and alignment for portraits
- Names clearly associated with photos
- Can include quotes or "favorites" info
- Clean, organized grid layouts work well
- Minimal decorative elements — let faces shine`,

    'student-life': `STUDENT LIFE PAGE GUIDANCE:
- CANDID moments throughout the day
- Variety of locations — hallways, cafeteria, outdoor spaces
- Diverse representation of student body
- Casual, authentic feel
- Collage-style layouts can work well
- Light, fun captions`,

    general: `GENERAL PAGE GUIDANCE:
- Adapt layout to content provided
- Balance photos and text appropriately
- Maintain visual hierarchy
- Professional yearbook quality
- Clear, readable typography`,
  };

  return guidance[category] || guidance.general;
}

/**
 * Build DCHS-specific style instructions based on the comprehensive style guide
 */
function buildDCHSInstructions(theme, pageCategory) {
  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    MANDATORY DCHS STYLE GUIDE                                 ║
║           YOU MUST FOLLOW THESE RULES EXACTLY - NO EXCEPTIONS                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

⛔ FORBIDDEN COLORS - DO NOT USE:
- NO pink, magenta, hot pink (#FF69B4, #FF1493, #E91E8B, etc.)
- NO bright blue (#0000FF, #00BFFF, etc.)
- NO red (#FF0000, #E53E3E, etc.)
- NO orange, yellow, green, teal, cyan
- NO pastel colors of any kind
- NO neon or bright colors

✅ ONLY THESE COLORS ARE ALLOWED:
- Background: #FFFFFF (white) or #F5F5F5 (off-white)
- Primary accent: #523D73 (DCHS purple - the ONLY accent color)
- Text: #1A1A1A (dark), #333333 (medium), #666666 (light)
- Black: #000000
- White: #FFFFFF

⛔ FORBIDDEN STYLING - DO NOT USE:
- NO rounded corners on photos (borderRadius must be 0)
- NO decorative diagonal lines
- NO circles or dots as decorative elements
- NO gradients (background must be solid color)
- NO thick photo borders
- NO playful or whimsical layouts
- NO tilted/rotated photos beyond 2 degrees

✅ REQUIRED STYLING:
- ALL photo borderRadius: 0 (sharp corners)
- Headlines with purple background: backgroundColor: "#523D73", color: "#FFFFFF"
- Section header: fontFamily: "Dancing Script", lowercase, italic feel
- School name: fontFamily: "Playfair Display", uppercase, very large (48-60pt)
- Body text: fontFamily: "Source Sans Pro", 10pt
- Dominant photo: blackAndWhite: true (for dramatic effect)

✅ LAYOUT STRUCTURE (MUST FOLLOW):
For a SPREAD (two-page):
- LEFT PAGE: Dominant B&W photo (40-50% of left page), secondary color photos
- RIGHT PAGE: Section header (script font, right-aligned), school name (bold),
  headline bars (purple background), body copy, roster
- BOTTOM: Numbered captions with black square badges

For a SINGLE PAGE:
- Top area: Section header + school name
- Center: Dominant photo + supporting photos
- Right side: Body copy, record bars
- Bottom: Captions

✅ ELEMENT SPECIFICS:

1. HEADLINE/RECORD BARS (purple background):
   {
     "type": "headline" or "record",
     "backgroundColor": "#523D73",
     "color": "#FFFFFF",
     "fontWeight": "700"
   }

2. PHOTOS:
   {
     "type": "photo",
     "borderRadius": 0,
     "blackAndWhite": true/false,  // true for dominant/action photos
     "shadow": false
   }

3. SECTION HEADER:
   {
     "type": "sectionHeader",
     "fontFamily": "Dancing Script",
     "color": "#1A1A1A",
     "textTransform": "lowercase"
   }

4. PULL QUOTES:
   {
     "type": "quote",
     "backgroundColor": "#523D73",
     "color": "#FFFFFF",
     "fontWeight": "700"
   }

5. CAPTION NUMBERS:
   {
     "type": "captionNumber",
     "backgroundColor": "#000000",
     "color": "#FFFFFF"
   }

FINAL CHECK - Before outputting JSON, verify:
□ No pink/magenta colors anywhere
□ No rounded corners on photos
□ Purple (#523D73) is the ONLY accent color
□ Background is white (#FFFFFF)
□ At least one photo has blackAndWhite: true
□ No decorative diagonal lines or circles
`;
}

function buildThemeDetails(theme) {
  const details = [];

  // Check if DCHS theme - force specific colors
  const isDCHS = theme.styleGuide || theme.preset === 'dchs-official';

  if (isDCHS) {
    // Force DCHS colors - be very explicit
    details.push(`Colors (DCHS OFFICIAL - USE EXACTLY):
  - Background: #FFFFFF (white only)
  - Primary/Accent: #523D73 (purple - the ONLY accent color allowed)
  - Secondary: #000000 (black)
  - Text Dark: #1A1A1A
  - Text Medium: #333333
  - Text Light: #666666
  - DO NOT use any other colors!`);

    details.push(`Typography (DCHS OFFICIAL):
  - Section Header: Dancing Script (script/italic style)
  - School Name: Playfair Display (bold, uppercase)
  - Headlines: Playfair Display Bold
  - Body: Source Sans Pro`);

    details.push(`Photo Treatment (DCHS OFFICIAL):
  - Corners: SHARP (borderRadius: 0 always)
  - Shadows: NONE or very subtle
  - Borders: NONE
  - B&W: Apply to dominant/action photos`);
  } else {
    // Non-DCHS themes
    const colors = theme.colors || {};
    details.push(`Colors:
  - Background: ${colors.background || theme.backgroundColor || '#ffffff'}
  - Primary: ${colors.primary || theme.primaryColor || '#1a1a2e'}
  - Secondary: ${colors.secondary || theme.secondaryColor || '#4a4a4a'}
  - Accent: ${colors.accent || theme.accentColor || '#8b5cf6'}
  - Text: ${colors.text || theme.textColor || '#1a1a1a'}
  - Text Light: ${colors.textLight || theme.textLightColor || '#666666'}`);

    const typography = theme.typography || {};
    details.push(`Typography:
  - Headline Font: ${typography.headlineFont || theme.headlineFont || 'Playfair Display'}
  - Body Font: ${typography.bodyFont || theme.bodyFont || 'Source Sans Pro'}`);

    const layout = theme.layout || {};
    details.push(`Photo Treatment:
  - Corners: ${layout.photoTreatment || 'sharp-corners'}
  - Shadows: ${layout.photoShadows || 'subtle'}
  - Borders: ${layout.photoBorders || 'none'}`);
  }

  return details.join('\n\n');
}

function getStyleInstructions(style, isSpread) {
  const baseInstructions = {
    editorial: `EDITORIAL STYLE: Clean, magazine-quality with strong grid structure, defined columns, minimal but intentional decorative elements.`,
    dynamic: `DYNAMIC STYLE: High energy with angled photos, overlapping elements, bold colors, action-focused.`,
    elegant: `ELEGANT STYLE: Refined typography, straight aligned photos, subtle shadows, balanced white space, timeless feel.`,
    collage: `COLLAGE STYLE: Photos at various angles, polaroid-style borders, overlapping layers, fun scrapbook energy.`,
    minimal: `MINIMAL STYLE: Maximum white space, clean grid, limited color, photos as focal points.`,
    bold: `BOLD STYLE: Strong color blocks, large typography, high contrast, impactful visual statements.`,
  };

  let instructions = baseInstructions[style] || baseInstructions.editorial;

  if (isSpread) {
    instructions += ` SPREAD: Create flow across both pages, dominant photo can span gutter (not faces), balance content.`;
  }

  return instructions;
}

module.exports = { generateLayout };
