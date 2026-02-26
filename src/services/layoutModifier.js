/**
 * Layout Modifier Service
 *
 * Uses Claude AI to interpret natural language modification requests
 * and apply changes to an existing layout JSON.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { validateAndCorrectLayout } = require('./layoutValidator');

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Modify an existing layout based on a user's natural language request
 *
 * @param {object} currentLayout - The current layout JSON
 * @param {string} message - User's modification request
 * @param {object} theme - Current theme
 * @param {string} pageType - 'page' or 'spread'
 * @returns {object} - Modified layout JSON
 */
async function modifyLayout(currentLayout, message, theme, pageType) {
  const prompt = buildModificationPrompt(currentLayout, message, pageType);

  try {
    console.log('Layout Modifier - Processing request:', message);

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const modifiedLayout = JSON.parse(jsonMatch[1].trim());

    // Preserve non-element fields from original layout
    const result = {
      ...currentLayout,
      elements: modifiedLayout.elements || currentLayout.elements,
    };

    // Validate against style guide
    const validated = validateAndCorrectLayout(result, theme?.styleGuide);

    console.log('Layout Modifier - Modification complete');
    return validated;
  } catch (error) {
    console.error('Layout Modifier - Error:', error.message);
    // Return original layout if modification fails
    return currentLayout;
  }
}

function buildModificationPrompt(currentLayout, message, pageType) {
  const isSpread = pageType === 'spread';
  const pageWidth = isSpread ? 16.0 : 8.0;
  const pageHeight = 10.5;

  return `You are a yearbook layout editor. You have an existing layout and the user wants to make a modification.

PAGE DIMENSIONS: ${pageWidth}" x ${pageHeight}" (${isSpread ? 'two-page spread' : 'single page'})
SAFE MARGINS: 0.75" from outer edges, 0.75" from gutter (center fold)
${isSpread ? 'GUTTER (center fold): at x = 8.0"' : ''}

CURRENT LAYOUT (all coordinates in INCHES, not pixels):
${JSON.stringify(currentLayout.elements, null, 2)}

USER REQUEST: "${message}"

INSTRUCTIONS:
1. Modify ONLY the elements affected by the user's request
2. Keep all other elements in their exact current positions
3. All coordinates (x, y, width, height) are in INCHES
4. Respect margins: nothing should be placed within 0.75" of page edges
${isSpread ? '5. Respect gutter: avoid placing important content near x=8.0"' : ''}
6. Valid element types: photo, sectionHeader, schoolName, headline, subheadline, date, record, bodyCopy, roster, quote, caption, decorative, folio
7. For photos: photoIndex must reference valid photo indices, cropFit should be "cover"
8. For text sizing: fontSize is in points (typical ranges: section headers 36-60pt, body 8-11pt, headlines 12-18pt)
9. Preserve the existing style (colors, fonts, weights) unless the user specifically asks to change them
10. NEVER change the section name text - it must stay exactly as it is

MODIFICATION EXAMPLES:
- "make the title bigger" → increase fontSize of sectionHeader element
- "move photos to the right" → adjust x coordinates of photo elements
- "add more space between photos" → increase GAP between photo elements
- "make body text larger" → increase fontSize of bodyCopy element
- "change headline to ..." → update text property of headline element

Return the COMPLETE elements array (ALL elements, not just the changed ones) as valid JSON:

\`\`\`json
{
  "elements": [
    // all elements with modifications applied
  ]
}
\`\`\``;
}

module.exports = { modifyLayout };
