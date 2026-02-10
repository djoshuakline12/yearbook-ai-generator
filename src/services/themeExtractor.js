const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Analyze an image and extract its visual theme using Claude's vision.
 * Returns a highly detailed theme configuration for consistent reproduction.
 * @param {string} imagePath - Path to the image file
 * @returns {object} Extracted theme configuration
 */
async function extractThemeFromImage(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');

  // Detect media type from file extension
  const ext = imagePath.toLowerCase().split('.').pop();
  const mediaTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  const mediaType = mediaTypes[ext] || 'image/jpeg';

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `You are a professional graphic designer analyzing this yearbook/magazine page to extract its exact visual theme. Be EXTREMELY specific with colors - use a color picker mentality.

Analyze the image carefully and return ONLY valid JSON with this exact structure:

{
  "name": "A descriptive name for this theme (2-4 words)",
  "description": "One detailed sentence describing the overall visual style and mood",

  "colors": {
    "background": "#hex - the main background color",
    "primary": "#hex - the dominant brand/accent color used for headlines or key elements",
    "secondary": "#hex - secondary color used for supporting elements",
    "accent": "#hex - pop color used sparingly for emphasis",
    "text": "#hex - main body text color",
    "textLight": "#hex - lighter text color for captions/secondary text",
    "overlay": "rgba(r,g,b,a) - if photos have color overlays, specify here, otherwise null"
  },

  "typography": {
    "headlineFont": "Exact Google Font name that best matches the headline style",
    "headlineFontWeight": "100-900 number",
    "headlineStyle": "uppercase | lowercase | capitalize | normal",
    "headlineLetterSpacing": "tight | normal | wide | extra-wide",
    "bodyFont": "Exact Google Font name that best matches body text",
    "bodyFontWeight": "100-900 number",
    "captionStyle": "italic | normal",
    "textAlignment": "left | center | right | mixed"
  },

  "layout": {
    "style": "dynamic | elegant | bold | minimal | collage | editorial",
    "photoTreatment": "sharp-corners | rounded-small | rounded-large | circular | polaroid",
    "photoShadows": "none | subtle | medium | dramatic",
    "photoBorders": "none | thin-white | thin-dark | thick-white",
    "photoOverlap": true | false,
    "photoRotation": "none | subtle | varied",
    "whitespaceAmount": "minimal | moderate | generous"
  },

  "decorativeElements": {
    "lineStyle": "none | thin | medium | thick",
    "lineColor": "#hex or null",
    "shapes": ["circle", "rectangle", "triangle", "abstract"] or [],
    "patterns": "none | dots | stripes | geometric | organic",
    "dividers": "none | lines | shapes | mixed"
  },

  "mood": {
    "energy": "calm | balanced | energetic | intense",
    "formality": "casual | balanced | formal | prestigious",
    "era": "modern | contemporary | retro | classic | timeless"
  }
}

IMPORTANT:
- Extract EXACT hex colors you observe, not approximations
- For fonts, choose the closest Google Font match from: Oswald, Playfair Display, Montserrat, Bebas Neue, DM Serif Display, Poppins, Inter, Quicksand, Roboto, Lato, Open Sans, Merriweather, Nunito, Source Sans Pro, Raleway, Work Sans, Libre Baskerville, Crimson Text, PT Serif, Archivo Black
- Be precise about font weights and styles
- Analyze the photo treatment carefully (borders, shadows, corners)
- Note any color overlays or filters on photos`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text;

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract theme from image');
  }

  const theme = JSON.parse(jsonMatch[0]);

  // Validate required top-level fields
  const required = ['name', 'colors', 'typography', 'layout'];
  for (const field of required) {
    if (!theme[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Flatten for backward compatibility with existing code
  const flatTheme = {
    // Core identifiers
    name: theme.name,
    description: theme.description,

    // Colors (both nested and flat for compatibility)
    colors: theme.colors,
    primaryColor: theme.colors.primary,
    secondaryColor: theme.colors.secondary,
    accentColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
    textColor: theme.colors.text,
    textLightColor: theme.colors.textLight,
    overlayColor: theme.colors.overlay,

    // Typography (both nested and flat)
    typography: theme.typography,
    headlineFont: theme.typography.headlineFont,
    headlineFontWeight: theme.typography.headlineFontWeight,
    headlineStyle: theme.typography.headlineStyle,
    headlineLetterSpacing: theme.typography.headlineLetterSpacing,
    bodyFont: theme.typography.bodyFont,
    bodyFontWeight: theme.typography.bodyFontWeight,
    captionStyle: theme.typography.captionStyle,
    textAlignment: theme.typography.textAlignment,

    // Layout
    layout: theme.layout,
    style: theme.layout.style,
    photoTreatment: theme.layout.photoTreatment,
    photoShadows: theme.layout.photoShadows,
    photoBorders: theme.layout.photoBorders,
    photoOverlap: theme.layout.photoOverlap,
    photoRotation: theme.layout.photoRotation,
    whitespaceAmount: theme.layout.whitespaceAmount,

    // Decorative
    decorativeElements: theme.decorativeElements,

    // Mood
    mood: theme.mood,
  };

  return flatTheme;
}

module.exports = { extractThemeFromImage };
