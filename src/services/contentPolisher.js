/**
 * Content Polishing Service
 *
 * Uses Claude AI to intelligently polish and enhance user-submitted content
 * before layout generation. This ensures professional-quality text and
 * smart content curation.
 */

const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Polish and enhance all page content before layout generation
 *
 * @param {object} rawContent - Raw user input from form
 * @param {array} photoDescriptions - Metadata about uploaded photos
 * @param {string} pageCategory - Detected category (sports, events, etc.)
 * @returns {object} - Polished content ready for layout generation
 */
async function polishContent(rawContent, photoDescriptions = [], pageCategory = 'general') {
  const prompt = buildPolishingPrompt(rawContent, photoDescriptions, pageCategory);

  try {
    console.log('Content Polisher - Starting content enhancement...');

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const polishedContent = JSON.parse(jsonMatch[1].trim());

    console.log('Content Polisher - Enhancement complete');
    console.log('Content Polisher - Changes made:', polishedContent.changesApplied || []);

    return {
      ...polishedContent.content,
      _polishingMetadata: {
        changesApplied: polishedContent.changesApplied || [],
        suggestedEmphasis: polishedContent.suggestedEmphasis || [],
        contentQualityScore: polishedContent.contentQualityScore || 0,
      }
    };
  } catch (error) {
    console.error('Content Polisher - Error:', error.message);
    // Return original content if polishing fails
    return rawContent;
  }
}

/**
 * Build the prompt for content polishing
 */
function buildPolishingPrompt(rawContent, photoDescriptions, pageCategory) {
  const photoInfo = photoDescriptions.length > 0
    ? `\nPHOTOS PROVIDED (${photoDescriptions.length} total):\n${photoDescriptions.map((p, i) =>
        `  ${i + 1}. ${p.orientation || 'unknown'} orientation, ${p.people || 'subjects unknown'}${p.caption ? `: "${p.caption}"` : ''}`
      ).join('\n')}`
    : '\nNo photo descriptions provided.';

  return `You are a professional yearbook editor. Your job is to polish and enhance the following raw content submitted by a yearbook staff member.

PAGE CATEGORY: ${pageCategory.toUpperCase()}
${photoInfo}

RAW CONTENT SUBMITTED:
${JSON.stringify(rawContent, null, 2)}

YOUR TASKS:

1. **POLISH TEXT** - Fix grammar, spelling, punctuation. Improve clarity and flow.
   - Body copy should be well-written, appropriate length for yearbook
   - Quotes should feel authentic but be grammatically correct

2. **PAGE TITLE (pageTitle)** - Create a creative themed title for the page
   - The yearbook theme is "Building Our Futures"
   - Create a short, impactful title that ties into this theme using words like: Building, Creating, Constructing, Forging, Crafting, Laying the Foundation, Blueprint, etc.
   - Examples: "BUILDING A LEGACY" for a sports team, "CRAFTING HARMONY" for choir, "FORGING BONDS" for a club, "CONSTRUCTING VICTORY" for a championship
   - The theme word (building, creating, etc.) should be the FIRST word
   - Keep it 2-4 words max
   - This is separate from the section name — the section name stays as-is (e.g., "Boy's Soccer")

3. **CAPTION TITLES AND GRADES**
   - Only add a "captionTitle" if the photo already has a caption or people identified — do NOT create captions for photos with no caption info
   - captionTitle is a short, bold, ALL-CAPS action title (2-4 words)
   - Examples: "MAKING THE PASS", "BLOCKING THE SHOT", "SENIOR SPOTLIGHT", "GAME DAY ENERGY", "THE SAVE", "EYES ON THE BALL"
   - captionTitle should describe what's happening in the photo or highlight the moment
   - Include the player's grade in parentheses after their name: "Jay Parrish (11)" or "Blake Dale (10)"
   - If grades aren't provided, omit them (don't use placeholders)
   - For group photos use titles like "SENIOR SPOTLIGHT", "SQUAD GOALS", "TEAM HUDDLE"
   - If a photo has NO caption and NO people info, set captionTitle to null and caption to null

4. **SMART CURATION** - Decide what to emphasize
   - If body copy is too long (>300 words), trim to key moments
   - If body copy is too short or generic, expand with relevant details
   - Identify which photo should be the "dominant/primary" based on descriptions

5. **YEARBOOK BEST PRACTICES**
   - PRESERVE the user's section name capitalization EXACTLY as they typed it
   - Do NOT include schoolName in the output — it's not needed on the page
   - Dates should be consistent format
   - Roster names should be formatted consistently (First Last)
   - Stats/records should be formatted clearly (e.g., "12-5" or "Record: 12-5")

6. **CONTENT GAPS** - If critical content is missing:
   - Suggest what's missing (don't fabricate facts)
   - Provide placeholder text marked with [NEEDS INFO]

Return ONLY valid JSON in this exact format:

\`\`\`json
{
  "content": {
    "section": "polished section name",
    "pageTitle": "BUILDING A LEGACY",
    "pageTitleThemeWord": "BUILDING",
    "schoolName": "ABBREVIATED",
    "headline": "Polished, Engaging Headline",
    "subheadline": "Optional polished subheadline or null",
    "dateOrYear": "Formatted date/year",
    "record": "Formatted stats or null",
    "roster": ["First Last", "First Last"],
    "rosterTitle": "Team Roster:" or appropriate title,
    "bodyCopy": "Polished body copy text...",
    "quotes": [
      {"text": "Polished quote text", "attribution": "First Last, Title/Grade"}
    ],
    "highlights": ["Achievement 1", "Achievement 2"],
    "photoCaptions": [
      {"photoIndex": 0, "captionTitle": "MAKING THE PASS", "caption": "Descriptive caption with Name (grade)", "people": "Jay Parrish (11)", "isPrimary": true},
      {"photoIndex": 1, "captionTitle": "THE SAVE", "caption": "Another caption", "people": "Isaiah McCluskey (12)", "isPrimary": false}
    ],
    "folio": "page numbers or null",
    "pageCategory": "${pageCategory}"
  },
  "changesApplied": [
    "Generated themed page title: BUILDING A LEGACY",
    "Added caption titles for all photos",
    "Added grade numbers to player names"
  ],
  "suggestedEmphasis": [
    {"element": "pageTitle", "reason": "Themed title ties to yearbook theme"},
    {"element": "photo_0", "reason": "Best action shot, should be dominant"}
  ],
  "contentQualityScore": 85
}
\`\`\`

IMPORTANT:
- Preserve the user's voice and intent - polish, don't rewrite completely
- NEVER change the capitalization of the section name - use it EXACTLY as provided
- Don't invent facts, names, or statistics not provided
- Every photo caption MUST have a captionTitle (ALL CAPS, 2-4 words)
- The pageTitle MUST tie into the "Building Our Futures" theme
- If something is clearly wrong (misspelled name, wrong date), fix it
- Mark uncertain content with [VERIFY] or [NEEDS INFO]
- The contentQualityScore is 0-100 based on completeness and quality`;
}

/**
 * Quick validation to check if content needs polishing
 * Returns true if content appears to need enhancement
 */
function needsPolishing(rawContent) {
  const issues = [];

  // Check for common issues
  if (rawContent.headline && rawContent.headline === rawContent.headline.toUpperCase()) {
    issues.push('Headline is all caps');
  }

  if (rawContent.bodyCopy && rawContent.bodyCopy.length < 50) {
    issues.push('Body copy very short');
  }

  if (rawContent.bodyCopy && rawContent.bodyCopy.length > 1000) {
    issues.push('Body copy very long');
  }

  if (rawContent.roster && rawContent.roster.some(name => !name.includes(' '))) {
    issues.push('Some roster names may be incomplete');
  }

  // Check for obvious typos (very basic)
  const allText = [
    rawContent.headline,
    rawContent.subheadline,
    rawContent.bodyCopy,
  ].filter(Boolean).join(' ');

  if (/\s{2,}/.test(allText)) {
    issues.push('Multiple spaces detected');
  }

  return {
    needsPolishing: issues.length > 0,
    issues,
  };
}

/**
 * Enhance photo captions based on photo analysis
 * Can be called separately if photos have AI-generated descriptions
 */
async function enhanceCaptions(photoCaptions, photoAnalysis = []) {
  if (!photoCaptions || photoCaptions.length === 0) {
    return photoCaptions;
  }

  const prompt = `You are a yearbook caption editor. Enhance these photo captions to be more descriptive and engaging while maintaining accuracy.

CURRENT CAPTIONS:
${JSON.stringify(photoCaptions, null, 2)}

${photoAnalysis.length > 0 ? `PHOTO ANALYSIS:\n${JSON.stringify(photoAnalysis, null, 2)}` : ''}

For each caption:
1. Make it more descriptive and engaging
2. Ensure people are identified left-to-right when possible
3. Include action verbs for action shots
4. Keep captions concise (1-2 sentences max)
5. Don't fabricate names or details not provided

Return ONLY a JSON array of enhanced captions:
\`\`\`json
[
  {"photoIndex": 0, "caption": "Enhanced caption", "people": "Names, left to right", "isPrimary": true/false}
]
\`\`\``;

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    return JSON.parse(jsonMatch[1].trim());
  } catch (error) {
    console.error('Caption enhancement failed:', error.message);
    return photoCaptions;
  }
}

module.exports = {
  polishContent,
  needsPolishing,
  enhanceCaptions,
};
