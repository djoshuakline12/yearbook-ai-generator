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
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1024,
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
            text: `Analyze this yearbook/magazine page and extract its visual theme. Return ONLY valid JSON with this exact structure (no explanation):

{
  "name": "A short descriptive name for this theme (2-4 words)",
  "description": "One sentence describing the visual style",
  "primaryColor": "#hex (the dominant/background color)",
  "secondaryColor": "#hex (secondary/supporting color)",
  "accentColor": "#hex (accent/highlight color used for emphasis)",
  "headlineFont": "Best matching Google Font name for headlines",
  "bodyFont": "Best matching Google Font name for body text",
  "style": "one of: dynamic, elegant, bold, minimal, collage, editorial"
}

For fonts, choose from these Google Fonts based on what you see:
Headlines: Oswald, Playfair Display, Montserrat, Bebas Neue, DM Serif Display, Poppins, Inter, Quicksand
Body: Open Sans, Roboto, Lato, Merriweather, Nunito, Source Sans Pro, Inter

Analyze the colors carefully - extract the actual hex values you observe.`,
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

  // Validate required fields
  const required = ['primaryColor', 'secondaryColor', 'accentColor', 'headlineFont', 'bodyFont', 'style'];
  for (const field of required) {
    if (!theme[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return theme;
}

module.exports = { extractThemeFromImage };
