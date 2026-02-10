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

// Colors that are definitely wrong and need replacement
const FORBIDDEN_COLOR_PATTERNS = [
  /^#(?:FF|E9|F0|D5)[0-9A-F]{4}$/i,  // Pinks/magentas
  /^#(?:00|1E|0D)[0-9A-F]{2}(?:FF|BF|8B)/i,  // Bright blues
  /^#(?:FF|E5)[0-9A-F]{2}(?:00|1E|3E)/i,  // Reds/oranges
  /^#(?:F7|FA|FF)(?:F0|E6|D7|89)/i,  // Yellows/golds (except our approved ones)
  /^#(?:00|10|22|38)[A-F][0-9A-F]{3}$/i,  // Teals/greens
  /^#D4A84B$/i,  // Gold accent - replace with purple
  /^#D69E2E$/i,  // Another gold
];

/**
 * Validate and correct a layout for DCHS compliance
 * @param {object} layout - The AI-generated layout JSON
 * @param {object} theme - The theme configuration
 * @returns {object} - Corrected layout
 */
function validateAndCorrectLayout(layout, theme) {
  // Only apply strict validation for DCHS theme
  const isDCHS = theme.styleGuide || theme.preset === 'dchs-official';

  if (!isDCHS) {
    return layout; // Return unchanged for other themes
  }

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
 */
function correctElement(el, allElements, index) {
  const corrected = { ...el };

  // Fix colors on all elements
  if (corrected.color) {
    corrected.color = correctColor(corrected.color, 'text');
  }
  if (corrected.backgroundColor) {
    corrected.backgroundColor = correctColor(corrected.backgroundColor, 'background');
  }
  if (corrected.borderColor) {
    corrected.borderColor = correctColor(corrected.borderColor, 'border');
  }
  if (corrected.accentColor) {
    corrected.accentColor = DCHS_COLORS.purple;
  }
  if (corrected.titleColor) {
    corrected.titleColor = correctColor(corrected.titleColor, 'text');
  }
  if (corrected.nameColor) {
    corrected.nameColor = correctColor(corrected.nameColor, 'text');
  }
  if (corrected.itemColor) {
    corrected.itemColor = correctColor(corrected.itemColor, 'text');
  }

  // Element-specific corrections
  switch (el.type) {
    case 'photo':
      corrected.borderRadius = 0; // Force sharp corners
      corrected.shadow = false;   // No shadows
      corrected.borderWidth = 0;  // No borders
      break;

    case 'sectionHeader':
      corrected.fontFamily = 'Dancing Script';
      corrected.color = DCHS_COLORS.textDark;
      corrected.textTransform = 'lowercase';
      corrected.fontStyle = 'italic';
      break;

    case 'schoolName':
      corrected.fontFamily = 'Playfair Display';
      corrected.color = DCHS_COLORS.textDark;
      corrected.fontWeight = '700';
      break;

    case 'headline':
      // Headlines should have purple background with white text
      corrected.backgroundColor = DCHS_COLORS.purple;
      corrected.color = DCHS_COLORS.white;
      corrected.fontFamily = 'Playfair Display';
      corrected.fontWeight = '700';
      break;

    case 'record':
      // Records should have purple background with white text
      corrected.backgroundColor = DCHS_COLORS.purple;
      corrected.color = DCHS_COLORS.white;
      corrected.fontFamily = 'Playfair Display';
      corrected.fontWeight = '700';
      break;

    case 'quote':
      // Quotes should have purple background
      corrected.backgroundColor = DCHS_COLORS.purple;
      corrected.color = DCHS_COLORS.white;
      corrected.accentColor = DCHS_COLORS.white;
      corrected.fontFamily = 'Playfair Display';
      break;

    case 'captionNumber':
      corrected.backgroundColor = DCHS_COLORS.black;
      corrected.color = DCHS_COLORS.white;
      break;

    case 'decorative':
      // Only allow simple rectangles, no diagonals or circles
      if (corrected.shape === 'circle' || corrected.rotation > 5) {
        return null; // Mark for removal
      }
      corrected.color = DCHS_COLORS.purple;
      break;

    case 'bodyCopy':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.color = DCHS_COLORS.textDark;
      break;

    case 'caption':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.color = DCHS_COLORS.textDark;
      break;

    case 'roster':
      corrected.fontFamily = 'Source Sans Pro';
      corrected.titleColor = DCHS_COLORS.textDark;
      corrected.nameColor = DCHS_COLORS.textMedium;
      break;

    case 'folio':
      corrected.color = DCHS_COLORS.textDark;
      corrected.fontFamily = 'Source Sans Pro';
      break;
  }

  return corrected;
}

/**
 * Correct a color to be DCHS-compliant
 */
function correctColor(color, context) {
  if (!color) return DCHS_COLORS.textDark;

  const upperColor = color.toUpperCase();

  // Check if it's already an approved color
  if (Object.values(DCHS_COLORS).map(c => c.toUpperCase()).includes(upperColor)) {
    return color;
  }

  // Check if it's a forbidden color
  for (const pattern of FORBIDDEN_COLOR_PATTERNS) {
    if (pattern.test(color)) {
      // Replace with appropriate DCHS color based on context
      if (context === 'background') {
        return DCHS_COLORS.purple; // Accent backgrounds become purple
      }
      return DCHS_COLORS.textDark;
    }
  }

  // For any other color, try to map it
  // If it's light (high value), assume it was meant to be white
  // If it's dark, assume it was meant to be black/text
  const hex = color.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    if (brightness > 200) {
      return context === 'text' ? DCHS_COLORS.textLight : DCHS_COLORS.white;
    } else if (brightness > 100) {
      return context === 'background' ? DCHS_COLORS.purple : DCHS_COLORS.textMedium;
    } else {
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
