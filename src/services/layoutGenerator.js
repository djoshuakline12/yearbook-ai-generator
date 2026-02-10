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
 */
async function generateLayout({ photos, topic, headline, captions, theme }) {
  const photoDescriptions = photos.map((p, i) => ({
    index: i,
    orientation: p.orientation,
    aspectRatio: parseFloat(p.aspectRatio.toFixed(2)),
    caption: captions[i] || '',
  }));

  const prompt = buildPrompt({ photoDescriptions, topic, headline, captions, theme });

  const response = await getClient().messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Extract JSON from the response (may be wrapped in markdown code fence)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const layoutJson = JSON.parse(jsonMatch[1].trim());

  return layoutJson;
}

function buildPrompt({ photoDescriptions, topic, headline, captions, theme }) {
  const style = theme.style || 'dynamic';
  const photoCount = photoDescriptions.length;

  return `You are a professional yearbook designer. Generate a UNIQUE layout composition as JSON for a single yearbook page.

PAGE SPECIFICATIONS:
- Page size: ${PAGE.WIDTH_IN}" × ${PAGE.HEIGHT_IN}" (single page)
- Safe margin: ${PAGE.SAFE_MARGIN_IN}" from all edges (keep important content inside x: ${PAGE.SAFE_MARGIN_IN} to ${PAGE.WIDTH_IN - PAGE.SAFE_MARGIN_IN}, y: ${PAGE.SAFE_MARGIN_IN} to ${PAGE.HEIGHT_IN - PAGE.SAFE_MARGIN_IN})
- Bleed: ${PAGE.BLEED_IN}" on all edges (photos can extend to x: -${PAGE.BLEED_IN} to ${PAGE.WIDTH_IN + PAGE.BLEED_IN})
- All positions in INCHES from top-left corner

TOPIC: "${topic}"
HEADLINE: "${headline}"
STYLE: "${style}"
PHOTO COUNT: ${photoCount}

PHOTOS (with their orientations and aspect ratios):
${photoDescriptions.map(p => `  Photo ${p.index}: ${p.orientation} (${p.aspectRatio}:1)${p.caption ? ` — caption: "${p.caption}"` : ''}`).join('\n')}

THEME:
- Primary color: ${theme.primaryColor || '#1a1a2e'}
- Secondary color: ${theme.secondaryColor || '#16213e'}
- Accent color: ${theme.accentColor || '#e94560'}
- Headline font: ${theme.headlineFont || 'Oswald'}
- Body font: ${theme.bodyFont || 'Open Sans'}

DESIGN INSTRUCTIONS FOR "${style}" STYLE:
${getStyleInstructions(style)}

CRITICAL RULES:
1. Make ONE photo the DOMINANT image (at least 40% of page area). Pick the first photo unless another orientation fits better.
2. Vary photo sizes dramatically — never make all photos the same size.
3. Every photo from index 0 to ${photoCount - 1} MUST appear exactly once.
4. The headline must be prominent and visually striking.
5. Captions should be near their corresponding photos.
6. Add 2-4 decorative elements (lines, shapes, color blocks) that use the accent color.
7. Ensure no elements overlap in ways that make text unreadable.
8. All text must be within the safe margin area.
9. Generate a COMPLETELY UNIQUE composition — vary placement, sizes, and decorative treatments.

Return ONLY valid JSON matching this schema (no explanation):

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
      "x": number (inches),
      "y": number (inches),
      "width": number (inches),
      "height": number (inches),
      "rotation": number (degrees, -5 to 5),
      "borderRadius": number (inches, 0 to 0.25),
      "shadow": boolean,
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
      "fontFamily": "${theme.headlineFont || 'Oswald'}",
      "color": "#hex",
      "fontWeight": "bold" | "900" | "normal",
      "textAlign": "left" | "center" | "right",
      "letterSpacing": number (px),
      "textTransform": "uppercase" | "none" | "capitalize",
      "zIndex": number
    },
    {
      "type": "caption",
      "text": "caption text",
      "photoIndex": number,
      "x": number,
      "y": number,
      "width": number,
      "fontSize": number (pts, 9-14),
      "fontFamily": "${theme.bodyFont || 'Open Sans'}",
      "color": "#hex",
      "lineHeight": number (1.2-1.6),
      "zIndex": number
    },
    {
      "type": "decorative",
      "shape": "line" | "rectangle" | "circle",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "color": "#hex",
      "opacity": number (0.0 to 1.0),
      "rotation": number,
      "zIndex": number
    }
  ]
}`;
}

function getStyleInstructions(style) {
  const instructions = {
    dynamic: `- Use diagonal lines and slightly rotated photos (-3° to 3°)
- Overlap photos with shadows for depth
- Place headline at an angle or with a bold color block behind it
- High energy, movement-driven layout
- Consider placing the dominant photo at an angle spanning most of the page`,

    elegant: `- Clean lines, generous white space
- No rotation on photos — keep everything straight
- Use thin rule lines as dividers
- Headline should use elegant letter spacing (3-5px)
- Subtle drop shadows, muted decorative elements
- Refined, sophisticated composition`,

    bold: `- Large, impactful headline (60-72pt)
- Strong color blocks behind text
- High contrast between elements
- Minimal decorative elements but make them large
- Photos with sharp corners, no border radius
- Powerful, statement-making layout`,

    minimal: `- Maximum white space, minimal decorative elements
- Small, precise typography
- Photos arranged in a clean grid pattern
- Thin lines only for decoration
- Lots of breathing room between elements
- Less is more — only essential elements`,

    collage: `- Overlapping photos at various angles (-5° to 5°)
- Photos with white borders (simulate printed photo look)
- Scattered, organic arrangement
- Headline can be overlaid on photos
- Fun, casual, scrapbook-like feel
- Drop shadows on all photos`,

    editorial: `- Magazine-style layout with clear visual hierarchy
- One very large dominant photo
- Text wraps around or sits in clean columns beside photos
- Professional typography with varied sizes
- Strategic use of pull quotes or large captions
- Clean, publication-quality design`,
  };

  return instructions[style] || instructions.dynamic;
}

module.exports = { generateLayout };
