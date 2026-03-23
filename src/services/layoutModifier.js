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
      max_tokens: 16384,
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

  // Count photos and text elements for context
  const photos = currentLayout.elements.filter(e => e.type === 'photo');
  const textElements = currentLayout.elements.filter(e => e.type !== 'photo' && e.type !== 'folio');

  // Determine which page elements are currently on
  const leftPageElements = currentLayout.elements.filter(e => e.x < 7.25);
  const rightPageElements = currentLayout.elements.filter(e => e.x >= 8.75);

  return `You are a professional yearbook layout editor. The user wants to modify an existing two-page spread layout.

PAGE STRUCTURE:
- Full spread: ${pageWidth}" wide x ${pageHeight}" tall
- LEFT PAGE: x = 0" to 8" (safe area: x = 0.75" to 7.25")
- RIGHT PAGE: x = 8" to 16" (safe area: x = 8.75" to 15.25")
- GUTTER (binding fold): x = 7.25" to 8.75" — avoid placing content here
- TOP/BOTTOM margins: 0.75" from edges (safe y: 0.75" to 9.75")

CURRENT LAYOUT SUMMARY:
- ${photos.length} photos, ${textElements.length} text elements
- Left page has: ${leftPageElements.map(e => e.type).join(', ') || 'nothing'}
- Right page has: ${rightPageElements.map(e => e.type).join(', ') || 'nothing'}

CURRENT ELEMENTS (all coordinates in INCHES):
${JSON.stringify(currentLayout.elements, null, 2)}

USER REQUEST: "${message}"

CRITICAL RULES FOR MODIFICATIONS:
1. Make INCREMENTAL changes — don't flip or completely restructure the layout unless explicitly asked
2. If the user asks to "balance" or "spread out" photos, MOVE SOME photos to the other page — don't move ALL of them
3. Text elements (title, school name, headline, body) CAN be placed on EITHER page
4. Photos CAN be on BOTH pages simultaneously — this is preferred for balance
5. When moving elements to the other page, recalculate their x positions:
   - To move from left→right page: add ~8" to x (e.g., x=0.75 → x=8.75)
   - To move from right→left page: subtract ~8" from x (e.g., x=8.75 → x=0.75)
6. After moving elements, resize remaining elements to fill the available space (no large empty gaps)
7. Photos should fill their allocated space — adjust width/height to use available area
8. NEVER change text content (especially section name) — only change positions, sizes, and styles
9. Every photo element MUST keep its original photoIndex
10. Maintain the visual hierarchy: section header is largest, school name next, then headline

LAYOUT TIPS:
- A balanced spread has roughly equal visual weight on both pages
- Text elements take up less space than photos — they can share a page with photos
- The title/school name can go at the top of either page
- Body copy works well in 2 columns next to or below photos
- Roster goes at the bottom of whichever page has space
- Leave 0.125" gaps between adjacent photos

Return the COMPLETE elements array (ALL elements, including unchanged ones) as valid JSON:

\`\`\`json
{
  "elements": [
    // ALL elements with modifications applied
  ]
}
\`\`\``;
}

module.exports = { modifyLayout };
