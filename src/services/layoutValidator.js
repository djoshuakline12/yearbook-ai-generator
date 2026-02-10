/**
 * Layout Validator & Corrector
 *
 * This module validates AI-generated layouts against the style guide
 * and automatically corrects any violations. This ensures consistent
 * output regardless of what the AI generates.
 */

const { DCHS_STYLE_GUIDE } = require('../themes/dchs-style-guide');

// DCHS approved colors - anything else gets replaced
const DCHS_COLORS = {
  purple: '#523D73',
  black: '#000000',
  white: '#FFFFFF',
  offWhite: '#F5F5F5',
  textDark: '#1A1A1A',
  textMedium: '#333333',
  textLight: '#666666',
};

// Colors that are definitely wrong and need replacement with purple
// CONFIRMED FROM EDESIGN: Only 3 colors allowed - C0M0Y0K0 (white), C0M0Y0K100 (black), C43M68Y0K43 (purple)
const FORBIDDEN_COLOR_PATTERNS = [
  /^#(?:FF|E9|F0|D5)[0-9A-F]{4}$/i,  // Pinks/magentas
  /^#(?:00|1E|0D)[0-9A-F]{2}(?:FF|BF|8B)/i,  // Bright blues
  /^#(?:FF|E5)[0-9A-F]{2}(?:00|1E|3E)/i,  // Reds/oranges
  /^#(?:F7|FA|FF)(?:F0|E6|D7|89)/i,  // Yellows/golds
  /^#(?:00|10|22|38)[A-F][0-9A-F]{3}$/i,  // Teals/greens
  /^#D4A84B$/i,  // Gold accent - replace with purple
  /^#D69E2E$/i,  // Another gold
  /^#(?:D[0-9A-F]|E[0-9A-F]|C[0-9A-F]|B[89A-F])[0-9A-F]{2}(?:2E|3E|4[0-9A-F]|5[0-9A-F]|6[0-9A-F]|7[0-9A-F]|8[0-9A-F])$/i,  // Various gold/amber shades
  /^#(?:FFD|FFC|FFB|FFA|FF9|F[0-9A-F][0-9A-F]|E[0-9A-F][0-9A-F]|D[0-9A-F][0-9A-F])[0-9A-F]{3}$/i,  // Warm yellows/oranges/golds
];

/**
 * Validate and correct a layout for DCHS compliance
 * @param {object} layout - The AI-generated layout JSON
 * @param {object} theme - The theme configuration
 * @returns {object} - Corrected layout
 */
function validateAndCorrectLayout(layout, theme) {
  // Check multiple ways the DCHS theme might be identified
  const isDCHS = theme.styleGuide ||
                 theme.preset === 'dchs-official' ||
                 (theme.name && theme.name.toLowerCase().includes('dchs')) ||
                 (theme.primaryColor === '#523D73');

  // Log for debugging
  console.log('Layout Validator - Theme check:', {
    preset: theme.preset,
    name: theme.name,
    hasStyleGuide: !!theme.styleGuide,
    primaryColor: theme.primaryColor,
    isDCHS: isDCHS
  });

  if (!isDCHS) {
    console.log('Layout Validator - Skipping (not DCHS theme)');
    return layout; // Return unchanged for other themes
  }

  console.log('Layout Validator - Applying DCHS corrections');

  const correctedLayout = JSON.parse(JSON.stringify(layout)); // Deep clone

  // 1. Fix background
  correctedLayout.background = correctBackground(correctedLayout.background);

  // 2. Process all elements
  if (correctedLayout.elements && Array.isArray(correctedLayout.elements)) {
    correctedLayout.elements = correctedLayout.elements.map((el, index) => {
      return correctElement(el, correctedLayout.elements, index);
    });

    // 3. Ensure at least one photo is B&W (the largest one)
    ensureDominantPhotoBW(correctedLayout.elements);

    // 4. Ensure headlines/records have purple background
    ensurePurpleBars(correctedLayout.elements);

    // 5. Remove any forbidden decorative elements
    correctedLayout.elements = removeInvalidDecorative(correctedLayout.elements);
  }

  return correctedLayout;
}

/**
 * Correct background to be white only
 */
function correctBackground(bg) {
  return {
    type: 'solid',
    color: DCHS_COLORS.white,
  };
}

/**
 * Correct a single element
 * AGGRESSIVE: Force correct colors and styles on EVERY element
 */
function correctElement(el, allElements, index) {
  if (!el) return null;

  const corrected = { ...el };

  console.log(`Layout Validator - Processing element: ${el.type}`);

  // Element-specific corrections - FORCE correct values
  switch (el.type) {
    case 'photo':
      corrected.borderRadius = 0; // Force sharp corners
      corrected.shadow = false;   // No shadows
      corrected.borderWidth = 0;  // No borders
      // borderColor doesn't matter since no border
      break;

    case 'sectionHeader':
      corrected.fontFamily = 'Dancing Script';
      corrected.color = DCHS_COLORS.textDark;
      corrected.textTransform = 'lowercase';
      corrected.fontStyle = 'italic';
      // Remove any background color
      delete corrected.backgroundColor;
      break;

    case 'schoolName':
      corrected.fontFamily = 'Playfair Display';
      corrected.color = DCHS_COLORS.textDark;
      corrected.fontWeight = '700';
      delete corrected.backgroundColor;
      break;

    case 'headline':
      // FORCE purple background with white text
      corrected.backgroundColor = DCHS_COLORS.purple;
      corrected.color = DCHS_COLORS.white;
      corrected.fontFamily = 'Playfair Display';
      corrected.fontWeight = '700';
      console.log(`Layout Validator - Forced headline to purple bg: ${corrected.text}`);
      break;

    case 'subheadline':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.color = DCHS_COLORS.textMedium;
      delete corrected.backgroundColor;
      break;

    case 'date':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.color = DCHS_COLORS.textMedium;
      delete corrected.backgroundColor;
      break;

    case 'record':
      // FORCE purple background with white text
      corrected.backgroundColor = DCHS_COLORS.purple;
      corrected.color = DCHS_COLORS.white;
      corrected.fontFamily = 'Playfair Display';
      corrected.fontWeight = '700';
      console.log(`Layout Validator - Forced record to purple bg: ${corrected.text}`);
      break;

    case 'quote':
      // FORCE purple background with white text
      corrected.backgroundColor = DCHS_COLORS.purple;
      corrected.color = DCHS_COLORS.white;
      corrected.accentColor = DCHS_COLORS.white;
      corrected.fontFamily = 'Playfair Display';
      corrected.fontWeight = '700';
      console.log(`Layout Validator - Forced quote to purple bg`);
      break;

    case 'captionNumber':
      corrected.backgroundColor = DCHS_COLORS.black;
      corrected.color = DCHS_COLORS.white;
      break;

    case 'decorative':
      // Only allow simple rectangles, no diagonals or circles
      if (corrected.shape === 'circle' || Math.abs(corrected.rotation || 0) > 5) {
        console.log(`Layout Validator - Removing invalid decorative element`);
        return null; // Mark for removal
      }
      // Force purple color on all decorative elements
      corrected.color = DCHS_COLORS.purple;
      break;

    case 'bodyCopy':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.color = DCHS_COLORS.textDark;
      delete corrected.backgroundColor;
      break;

    case 'caption':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.color = DCHS_COLORS.textDark;
      delete corrected.backgroundColor;
      break;

    case 'roster':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.titleColor = DCHS_COLORS.textDark;
      corrected.nameColor = DCHS_COLORS.textMedium;
      delete corrected.backgroundColor;
      break;

    case 'highlights':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.titleColor = DCHS_COLORS.textDark;
      corrected.itemColor = DCHS_COLORS.textMedium;
      delete corrected.backgroundColor;
      break;

    case 'folio':
    case 'pageNumber':
      corrected.color = DCHS_COLORS.textDark;
      corrected.fontFamily = 'Source Sans Pro';
      delete corrected.backgroundColor;
      break;

    default:
      // For any unknown element, still fix colors
      if (corrected.color) {
        corrected.color = correctColor(corrected.color, 'text');
      }
      if (corrected.backgroundColor) {
        corrected.backgroundColor = correctColor(corrected.backgroundColor, 'background');
      }
  }

  // Final pass: ensure no forbidden colors snuck through
  if (corrected.accentColor) {
    corrected.accentColor = DCHS_COLORS.purple;
  }
  if (corrected.borderColor && corrected.borderWidth > 0) {
    corrected.borderColor = DCHS_COLORS.purple;
  }

  return corrected;
}

/**
 * Correct a color to be DCHS-compliant
 * AGGRESSIVE: Any color not in our exact whitelist gets replaced
 */
function correctColor(color, context) {
  if (!color) return DCHS_COLORS.textDark;

  const upperColor = color.toUpperCase().trim();

  // Exact whitelist of allowed colors
  const ALLOWED_COLORS = [
    '#523D73', // Purple
    '#000000', // Black
    '#FFFFFF', // White
    '#F5F5F5', // Off-white
    '#1A1A1A', // Text dark
    '#333333', // Text medium
    '#666666', // Text light
  ];

  // Check if it's already an approved color
  if (ALLOWED_COLORS.includes(upperColor)) {
    return color;
  }

  // ANY other color gets replaced based on context
  console.log(`Layout Validator - Replacing forbidden color: ${color} (context: ${context})`);

  // Determine replacement based on context
  if (context === 'background' || context === 'accent') {
    // Any accent/highlight background should be purple
    return DCHS_COLORS.purple;
  }

  // For text colors, analyze brightness
  const hex = color.replace('#', '');
  if (hex.length >= 6) {
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    if (brightness > 200) {
      // Very light color - probably meant to be white
      return DCHS_COLORS.white;
    } else if (brightness > 128) {
      // Medium-light - use light text
      return DCHS_COLORS.textLight;
    } else if (brightness > 50) {
      // Medium-dark - use medium text
      return DCHS_COLORS.textMedium;
    } else {
      // Dark - use dark text
      return DCHS_COLORS.textDark;
    }
  }

  return DCHS_COLORS.textDark;
}

/**
 * Ensure the dominant (largest) photo has B&W treatment
 */
function ensureDominantPhotoBW(elements) {
  const photos = elements.filter(el => el && el.type === 'photo');

  if (photos.length === 0) return;

  // Find the largest photo by area
  let largestPhoto = null;
  let largestArea = 0;

  for (const photo of photos) {
    const area = (photo.width || 0) * (photo.height || 0);
    if (area > largestArea) {
      largestArea = area;
      largestPhoto = photo;
    }
  }

  // Apply B&W to the largest photo
  if (largestPhoto) {
    largestPhoto.blackAndWhite = true;
  }

  // Also check if any photo was already marked as primary
  const primaryPhoto = photos.find(p => p.isPrimary);
  if (primaryPhoto && primaryPhoto !== largestPhoto) {
    primaryPhoto.blackAndWhite = true;
  }
}

/**
 * Ensure headline and record elements have purple background
 */
function ensurePurpleBars(elements) {
  for (const el of elements) {
    if (!el) continue;

    if (el.type === 'headline' || el.type === 'record') {
      el.backgroundColor = DCHS_COLORS.purple;
      el.color = DCHS_COLORS.white;
    }
  }
}

/**
 * Remove invalid decorative elements (diagonal lines, circles)
 */
function removeInvalidDecorative(elements) {
  return elements.filter(el => {
    if (!el) return false;

    if (el.type === 'decorative') {
      // Remove circles
      if (el.shape === 'circle') return false;
      // Remove diagonal lines (rotation > 10 degrees)
      if (Math.abs(el.rotation || 0) > 10) return false;
    }

    return true;
  });
}

/**
 * Log validation changes for debugging
 */
function logValidationChanges(original, corrected) {
  const changes = [];

  // Compare backgrounds
  if (JSON.stringify(original.background) !== JSON.stringify(corrected.background)) {
    changes.push(`Background: ${JSON.stringify(original.background)} → ${JSON.stringify(corrected.background)}`);
  }

  // Compare element counts
  const origCount = (original.elements || []).length;
  const corrCount = (corrected.elements || []).length;
  if (origCount !== corrCount) {
    changes.push(`Elements: ${origCount} → ${corrCount} (removed invalid)`);
  }

  if (changes.length > 0) {
    console.log('Layout validation corrections:', changes);
  }

  return changes;
}

module.exports = {
  validateAndCorrectLayout,
  DCHS_COLORS,
};
