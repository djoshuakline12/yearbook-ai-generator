/**
 * Body Copy Rewriter
 *
 * Takes raw user-submitted body text and rewrites it to be more professional,
 * while keeping it human-sounding (no em dashes, no AI-isms).
 *
 * Used as a pre-generate step so users can review and accept/reject the
 * rewritten version before committing to generating the page.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { logError } = require('./errorLogger');

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Rewrite body copy to be more professional and concise.
 *
 * @param {string} originalText - The raw body copy from the user
 * @param {object} context - Optional context for better rewriting
 * @param {string} context.section - e.g., "Boy's Soccer"
 * @param {string} context.pageCategory - sports, events, clubs, etc.
 * @param {number} context.targetWordCount - approximate target length (default: condense by 20%)
 * @returns {object} { original, rewritten, wordCountOriginal, wordCountRewritten, changes }
 */
async function rewriteBodyCopy(originalText, context = {}) {
  if (!originalText || originalText.trim().length < 20) {
    return {
      original: originalText,
      rewritten: originalText,
      wordCountOriginal: 0,
      wordCountRewritten: 0,
      changes: [],
      reason: 'Text too short to rewrite',
    };
  }

  const wordCount = originalText.split(/\s+/).filter(Boolean).length;
  const targetWords = context.targetWordCount || Math.max(60, Math.round(wordCount * 0.85));

  const sectionContext = context.section
    ? `Section: ${context.section}${context.pageCategory ? ` (${context.pageCategory})` : ''}\n`
    : '';

  const prompt = `You are editing body copy for a high school yearbook page. The student writer submitted draft text and needs a professional but natural-sounding rewrite.

${sectionContext}ORIGINAL TEXT (${wordCount} words):
"${originalText}"

REWRITE RULES (strict — readers will notice violations):

1. NO em dashes (—). Use commas, periods, or rewrite the sentence instead.
2. NO en dashes (–). Use a hyphen or rewrite.
3. NO "delve", "tapestry", "navigate the journey", "showcased their", "demonstrated unwavering", or other AI-cliche phrases.
4. NO "Despite the challenges" or "In conclusion" type filler.
5. Write like a high school student would naturally write after one revision pass — clear, direct, with personality. NOT like a corporate press release.
6. Keep it factual. Don't invent stats, names, or events not in the original.
7. Aim for ~${targetWords} words (about ${targetWords < wordCount ? 'condensed' : 'similar length'}).
8. Vary sentence length. Mix short punchy sentences with longer ones.
9. Use active voice. "Parrish scored a hat trick" not "A hat trick was scored by Parrish".
10. Keep specific details: dates, scores, names, numbers. Cut filler words.
11. If the original has typos or grammar errors, fix them silently.
12. Don't add quotes that weren't there.
13. Don't add "the team showed resilience" type cliches.
14. End with a real ending, not a generic "looking forward to next year" wrap-up unless the original had one.

VOICE TO AIM FOR:
- Confident but not corny
- Specific over general
- Active over passive
- Natural over polished
- A reader should not be able to tell an AI wrote it

Return ONLY valid JSON:

\`\`\`json
{
  "rewritten": "the rewritten text here",
  "changes": [
    "Brief summary of what you changed",
    "e.g., 'Cut intro sentence — went straight to the action'",
    "e.g., 'Replaced em dashes with commas'",
    "e.g., 'Condensed from 180 to 145 words'"
  ]
}
\`\`\``;

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const result = JSON.parse(jsonMatch[1].trim());

    let rewritten = result.rewritten || originalText;

    // Safety net: strip any em/en dashes the AI snuck in
    rewritten = rewritten.replace(/—/g, ',').replace(/–/g, '-');

    // Strip common AI cliches that escaped the prompt
    const aiCliches = [
      /\bdelve(s|d|ing)?\b/gi,
      /\btapestry\b/gi,
      /\bnavigate(s|d|ing)?\s+(the\s+)?(journey|landscape|challenges)\b/gi,
      /\bshowcased their\b/gi,
      /\bdemonstrated unwavering\b/gi,
      /\bthe team\'s resilience shone through\b/gi,
    ];
    aiCliches.forEach(re => {
      rewritten = rewritten.replace(re, (match) => {
        // Replace with neutral filler that the AI/user can refine
        if (/delve/i.test(match)) return 'go into';
        if (/tapestry/i.test(match)) return 'mix';
        if (/navigate/i.test(match)) return 'work through';
        return '';
      });
    });

    const rewrittenWordCount = rewritten.split(/\s+/).filter(Boolean).length;

    return {
      original: originalText,
      rewritten: rewritten.trim(),
      wordCountOriginal: wordCount,
      wordCountRewritten: rewrittenWordCount,
      changes: result.changes || [],
    };
  } catch (err) {
    logError('Body rewrite failed', err, { originalLength: originalText.length });
    // Return original if rewrite fails
    return {
      original: originalText,
      rewritten: originalText,
      wordCountOriginal: wordCount,
      wordCountRewritten: wordCount,
      changes: [],
      error: 'Rewrite service unavailable',
    };
  }
}

module.exports = { rewriteBodyCopy };
