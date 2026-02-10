/**
 * Preset yearbook themes for consistent styling across pages.
 * Students select a theme by name; the backend applies the full configuration.
 */

const { DCHS_STYLE_GUIDE, DCHS_THEME } = require('../themes/dchs-style-guide');

const THEMES = {
  // ============================================================
  // DCHS OFFICIAL THEME (Default)
  // ============================================================
  'dchs-official': {
    name: 'DCHS Official',
    description: 'Official Delmarva Christian style - purple, black & white',
    primaryColor: '#523D73',           // DCHS Purple (C43 M68 Y0 K43)
    secondaryColor: '#000000',
    accentColor: '#523D73',            // SAME AS PRIMARY - NO GOLD (confirmed from eDesign)
    backgroundColor: '#FFFFFF',
    textColor: '#1A1A1A',
    headlineFont: 'Playfair Display',  // Web fallback for AHJ Bodoni Display
    scriptFont: 'Dancing Script',       // Web fallback for AHJ Bungalow Script
    bodyFont: 'Source Sans Pro',
    style: 'editorial',
    // Include full style guide reference
    styleGuide: DCHS_STYLE_GUIDE,
    // Specific DCHS rules
    rules: {
      photoBlackAndWhite: 'selective',  // Select photos in B&W for drama
      purpleBars: true,                 // Use purple background bars for headlines
      captionNumbering: true,           // Number captions with black badges
      rosterFormat: 'inline-comma',     // Roster as flowing comma-separated text
    },
  },

  // ============================================================
  // Classic & Traditional
  // ============================================================
  // Classic & Traditional
  'classic-navy': {
    name: 'Classic Navy',
    description: 'Traditional yearbook feel with navy and gold',
    primaryColor: '#1a365d',
    secondaryColor: '#2c5282',
    accentColor: '#d69e2e',
    headlineFont: 'Playfair Display',
    bodyFont: 'Merriweather',
    style: 'elegant',
  },
  'maroon-gold': {
    name: 'Maroon & Gold',
    description: 'School spirit classic with warm tones',
    primaryColor: '#742a2a',
    secondaryColor: '#9b2c2c',
    accentColor: '#d69e2e',
    headlineFont: 'Oswald',
    bodyFont: 'Open Sans',
    style: 'bold',
  },
  'forest-cream': {
    name: 'Forest & Cream',
    description: 'Earthy, sophisticated palette',
    primaryColor: '#22543d',
    secondaryColor: '#276749',
    accentColor: '#f7e6c4',
    headlineFont: 'Playfair Display',
    bodyFont: 'Lato',
    style: 'elegant',
  },

  // Modern & Bold
  'midnight-electric': {
    name: 'Midnight Electric',
    description: 'Dark and energetic for sports/events',
    primaryColor: '#1a202c',
    secondaryColor: '#2d3748',
    accentColor: '#38b2ac',
    headlineFont: 'Montserrat',
    bodyFont: 'Open Sans',
    style: 'dynamic',
  },
  'coral-sunset': {
    name: 'Coral Sunset',
    description: 'Warm, vibrant, and inviting',
    primaryColor: '#c05621',
    secondaryColor: '#dd6b20',
    accentColor: '#faf089',
    headlineFont: 'Poppins',
    bodyFont: 'Nunito',
    style: 'bold',
  },
  'royal-purple': {
    name: 'Royal Purple',
    description: 'Regal and dramatic',
    primaryColor: '#44337a',
    secondaryColor: '#553c9a',
    accentColor: '#faf089',
    headlineFont: 'Oswald',
    bodyFont: 'Roboto',
    style: 'dynamic',
  },

  // Clean & Minimal
  'clean-slate': {
    name: 'Clean Slate',
    description: 'Minimalist black and white with a pop',
    primaryColor: '#1a202c',
    secondaryColor: '#4a5568',
    accentColor: '#e53e3e',
    headlineFont: 'Inter',
    bodyFont: 'Inter',
    style: 'minimal',
  },
  'soft-sage': {
    name: 'Soft Sage',
    description: 'Gentle, calming greens',
    primaryColor: '#68d391',
    secondaryColor: '#9ae6b4',
    accentColor: '#2d3748',
    headlineFont: 'Quicksand',
    bodyFont: 'Nunito',
    style: 'minimal',
  },
  'blush-rose': {
    name: 'Blush Rose',
    description: 'Soft pinks for a warm feel',
    primaryColor: '#d53f8c',
    secondaryColor: '#ed64a6',
    accentColor: '#1a202c',
    headlineFont: 'Playfair Display',
    bodyFont: 'Lato',
    style: 'elegant',
  },

  // Fun & Creative
  'retro-pop': {
    name: 'Retro Pop',
    description: 'Bold 70s-inspired colors',
    primaryColor: '#dd6b20',
    secondaryColor: '#d69e2e',
    accentColor: '#319795',
    headlineFont: 'Bebas Neue',
    bodyFont: 'Open Sans',
    style: 'collage',
  },
  'ocean-breeze': {
    name: 'Ocean Breeze',
    description: 'Cool blues and teals',
    primaryColor: '#2b6cb0',
    secondaryColor: '#3182ce',
    accentColor: '#81e6d9',
    headlineFont: 'Montserrat',
    bodyFont: 'Roboto',
    style: 'dynamic',
  },
  'magazine-modern': {
    name: 'Magazine Modern',
    description: 'Editorial style with strong typography',
    primaryColor: '#1a202c',
    secondaryColor: '#e2e8f0',
    accentColor: '#e53e3e',
    headlineFont: 'DM Serif Display',
    bodyFont: 'Source Sans Pro',
    style: 'editorial',
  },
};

/**
 * Get a theme by its key, or return custom theme if provided.
 * @param {string|object} themeInput - Theme key (e.g., 'classic-navy') or custom theme object
 * @returns {object} Complete theme configuration
 */
function getTheme(themeInput) {
  // If it's a string, look up the preset
  if (typeof themeInput === 'string') {
    const preset = THEMES[themeInput];
    if (preset) {
      return { ...preset, preset: themeInput };
    }
    // Default to DCHS Official if unknown
    return { ...THEMES['dchs-official'], preset: 'dchs-official' };
  }

  // If it's an object, check if it has a preset key
  if (typeof themeInput === 'object' && themeInput !== null) {
    if (themeInput.preset && THEMES[themeInput.preset]) {
      // Merge preset with any overrides
      return { ...THEMES[themeInput.preset], ...themeInput };
    }
    // Custom theme - fill in defaults for missing fields
    return {
      primaryColor: themeInput.primaryColor || '#1a365d',
      secondaryColor: themeInput.secondaryColor || '#2c5282',
      accentColor: themeInput.accentColor || '#d69e2e',
      headlineFont: themeInput.headlineFont || 'Oswald',
      bodyFont: themeInput.bodyFont || 'Open Sans',
      style: themeInput.style || 'dynamic',
      ...themeInput,
    };
  }

  // Fallback
  return { ...THEMES['dchs-official'], preset: 'dchs-official' };
}

/**
 * Get all available theme presets (for frontend dropdown)
 */
function getAllThemes() {
  return Object.entries(THEMES).map(([key, theme]) => ({
    key,
    name: theme.name,
    description: theme.description,
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
    style: theme.style,
  }));
}

module.exports = { THEMES, getTheme, getAllThemes };
