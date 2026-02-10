/**
 * DCHS Yearbook Master Style Guide
 *
 * This is the definitive template guideline for all yearbook pages.
 * Based on the Delmarva Christian High School design language.
 *
 * REFERENCE: Mens Soccer spread (pages 42-43)
 */

const DCHS_STYLE_GUIDE = {
  // ============================================================
  // BRAND IDENTITY
  // ============================================================
  identity: {
    schoolName: 'DCHS',
    fullName: 'Delmarva Christian High School',
    mascot: 'Royals',
    year: '2024-2025',
  },

  // ============================================================
  // COLOR PALETTE
  // ============================================================
  colors: {
    // Primary brand color - Purple
    // C=43 M=68 Y=0 K=43 (CMYK) = approximately #523D73 in RGB
    primary: '#523D73',
    primaryCMYK: { c: 43, m: 68, y: 0, k: 43 },

    // Core colors
    black: '#000000',
    white: '#FFFFFF',

    // Text colors
    textDark: '#1A1A1A',        // Primary body text
    textMedium: '#333333',       // Secondary text, captions
    textLight: '#666666',        // Tertiary text, subtle info

    // Background variations
    backgroundWhite: '#FFFFFF',
    backgroundLight: '#F5F5F5',  // Subtle off-white for contrast
    backgroundDark: '#1A1A1A',   // For reversed sections

    // Accent usage
    accentPurple: '#523D73',     // Headlines, special text, bars
    accentGold: '#D4A84B',       // Optional secondary accent (royalty theme)
  },

  // ============================================================
  // TYPOGRAPHY SYSTEM
  // ============================================================
  typography: {
    // Herff Jones specific fonts - AHJ font family
    fonts: {
      // Primary display font - for headlines, school name
      display: {
        family: 'AHJ Bodoni Display',
        fallback: 'Bodoni MT, Didot, Georgia, serif',
        webFallback: 'Playfair Display', // Google Fonts fallback for web
      },

      // Script font - for special/decorative text
      script: {
        family: 'AHJ Bungalow Script',
        fallback: 'Brush Script MT, cursive',
        webFallback: 'Dancing Script', // Google Fonts fallback
      },

      // Body font - for captions, body copy, roster
      body: {
        family: 'AHJ Bodoni Display',
        fallback: 'Bodoni MT, Georgia, serif',
        webFallback: 'Source Sans Pro', // Google Fonts fallback for readability
      },
    },

    // Type scale and usage
    scale: {
      // Section header - italic, elegant script style
      sectionHeader: {
        font: 'script',
        size: 28,
        weight: '400',
        style: 'normal',
        transform: 'none',
        letterSpacing: 0,
        color: 'textDark',
        example: 'mens soccer',
      },

      // School name - bold, commanding presence
      schoolName: {
        font: 'display',
        size: 60,
        weight: '700',
        style: 'normal',
        transform: 'uppercase',
        letterSpacing: 2,
        color: 'textDark',
        example: 'DCHS',
      },

      // Large headline - bold display
      headlineLarge: {
        font: 'display',
        size: 24,
        weight: '700',
        style: 'normal',
        transform: 'none',
        letterSpacing: 0,
        color: 'white',
        backgroundColor: 'primary',
        example: 'Delmarva Christian 3-12',
      },

      // Secondary headline/tagline
      headlineSecondary: {
        font: 'display',
        size: 18,
        weight: '700',
        style: 'normal',
        transform: 'none',
        letterSpacing: 0,
        color: 'white',
        backgroundColor: 'primary',
        example: '11 as 1 for an audience',
      },

      // Subheadline callouts - purple background bars
      subheadlineBar: {
        font: 'display',
        size: 14,
        weight: '700',
        style: 'normal',
        transform: 'none',
        letterSpacing: 0,
        color: 'white',
        backgroundColor: 'primary',
        paddingV: 0.03,
        paddingH: 0.08,
        example: 'rebuilding the team and new school',
      },

      // Body copy
      bodyCopy: {
        font: 'body',
        size: 10,
        weight: '400',
        style: 'normal',
        lineHeight: 1.4,
        color: 'textDark',
        columnWidth: { min: 2.5, max: 3.5 },
      },

      // Captions
      caption: {
        font: 'body',
        size: 10,
        weight: '400',
        style: 'normal',
        lineHeight: 1.3,
        color: 'textDark',
        maxWidth: 2.5,
      },

      // Roster title
      rosterTitle: {
        font: 'body',
        size: 11,
        weight: '700',
        style: 'normal',
        color: 'textDark',
        example: 'Roster:',
      },

      // Roster names
      rosterNames: {
        font: 'body',
        size: 8,
        weight: '400',
        style: 'normal',
        lineHeight: 1.3,
        color: 'textMedium',
        format: 'inline-comma', // Names separated by commas, flowing text
      },

      // Pull quote text
      quote: {
        font: 'display',
        size: 16,
        weight: '700',
        style: 'normal',
        lineHeight: 1.2,
        color: 'white',
        backgroundColor: 'primary',
        paddingV: 0.1,
        paddingH: 0.15,
      },

      // Quote attribution
      quoteAttribution: {
        font: 'body',
        size: 12,
        weight: '700',
        style: 'normal',
        color: 'white',
        backgroundColor: 'primary',
        prefix: '- ',
      },

      // Folio (page numbers)
      folio: {
        font: 'body',
        size: 10,
        weight: '400',
        style: 'normal',
        color: 'textDark',
        position: 'bottom-outer', // Left page: bottom-left, Right page: bottom-right
      },

      // Caption numbers (for numbered photo references)
      captionNumber: {
        font: 'body',
        size: 9,
        weight: '700',
        color: 'white',
        backgroundColor: 'black',
        shape: 'square', // Small square badge
        size: 0.15, // inches
      },
    },
  },

  // ============================================================
  // PHOTO TREATMENT RULES
  // ============================================================
  photos: {
    // Black and white treatment
    blackAndWhite: {
      usage: 'selective', // Not all photos, select main/hero images
      rules: [
        'Primary/dominant photo often in B&W for drama',
        'Creates visual hierarchy when mixed with color',
        'Action shots and emotional moments work well in B&W',
        'Group photos typically stay in color',
      ],
      application: {
        dominantPhoto: 'often-bw',    // 70% of time B&W
        secondaryPhotos: 'mixed',      // Some B&W, some color
        gridPhotos: 'color',           // Small grid photos usually color
        actionShots: 'prefer-bw',      // B&W for drama
        groupShots: 'prefer-color',    // Color to see uniforms/faces
      },
    },

    // Photo framing
    frames: {
      default: 'none',              // Most photos have no border
      accent: {
        color: 'white',
        width: 0.02,                // inches
        usage: 'occasional',        // For emphasis or collage effect
      },
    },

    // Corners
    corners: {
      default: 'sharp',             // 0 radius
      rounded: 0,                   // No rounded corners in this style
    },

    // Shadows
    shadows: {
      usage: 'minimal',
      intensity: 'subtle',
      application: 'layered-photos-only', // Only when photos overlap
    },

    // Sizing hierarchy
    hierarchy: {
      dominant: {
        areaPercent: { min: 30, max: 50 },
        description: 'One photo dominates the spread',
      },
      secondary: {
        areaPercent: { min: 15, max: 25 },
        description: 'Supporting photos, medium size',
      },
      tertiary: {
        areaPercent: { min: 8, max: 15 },
        description: 'Grid/detail photos',
      },
      thumbnail: {
        areaPercent: { min: 3, max: 8 },
        description: 'Small supporting images',
      },
    },

    // Rotation/angle
    rotation: {
      usage: 'minimal',
      maxAngle: 2,                   // degrees, very subtle if any
      application: 'never-dominant', // Dominant photo always straight
    },
  },

  // ============================================================
  // LAYOUT PRINCIPLES
  // ============================================================
  layout: {
    // Grid structure
    grid: {
      columns: 12,
      gutterWidth: 0.125,           // inches between columns
      useStrict: false,             // Allow breaking grid for dynamic layouts
    },

    // Margins and safe zones
    margins: {
      page: 0.375,                  // Safe margin from page edge
      gutter: 0.5,                  // Keep away from center binding
      bleed: 0.125,                 // Bleed area
    },

    // Spread composition
    spreadRules: [
      'Content should flow across both pages',
      'Dominant photo can span gutter (avoid faces in gutter)',
      'Balance visual weight between left and right',
      'Text blocks anchor to outer edges',
      'Photos create visual bridge across spread',
    ],

    // Text block placement
    textPlacement: {
      bodyCopy: {
        preferredPositions: ['top-right', 'bottom-right'],
        columnWidth: { min: 2.5, max: 3.5 },
        maxColumns: 1,              // Single column for readability
      },
      captions: {
        placement: 'below-or-beside', // Near the photo they describe
        maxWidth: 2.5,
        alignment: 'left',
      },
      quotes: {
        placement: 'integrated',     // Embedded within photo area or alongside
        style: 'purple-bar',         // Purple background bar treatment
      },
      roster: {
        placement: 'top-or-side',    // Usually top area or side column
        format: 'flowing-text',      // Names flow like paragraph
      },
    },

    // Visual hierarchy zones (for spread)
    zones: {
      headerZone: {
        y: { min: 0.375, max: 2.5 },
        content: ['sectionHeader', 'schoolName', 'headline', 'record'],
      },
      primaryPhotoZone: {
        description: 'Dominant photo area, typically 30-50% of spread',
      },
      contentZone: {
        description: 'Body copy, captions, secondary info',
      },
      footerZone: {
        y: { min: 9.5, max: 10.125 },
        content: ['folio', 'small captions'],
      },
    },
  },

  // ============================================================
  // DECORATIVE ELEMENTS
  // ============================================================
  decorative: {
    // Purple bars/blocks
    purpleBars: {
      color: '#523D73',
      usage: [
        'Behind headlines for emphasis',
        'Behind record/stats',
        'Behind quotes',
        'Section dividers',
      ],
      padding: {
        vertical: 0.03,
        horizontal: 0.08,
      },
    },

    // Lines
    lines: {
      usage: 'minimal',
      color: 'black',
      weight: 0.5,                  // pt
      style: 'solid',
    },

    // Shapes
    shapes: {
      usage: 'very-minimal',
      allowed: ['rectangle'],       // Simple geometric only
    },

    // Icons/graphics
    icons: {
      usage: 'sparingly',
      style: 'simple-line',
      examples: ['cross', 'plus-sign'],
    },
  },

  // ============================================================
  // ELEMENT-SPECIFIC STYLING
  // ============================================================
  elements: {
    // Pull quote styling (like the Josh Kline quote in reference)
    pullQuote: {
      container: {
        backgroundColor: '#523D73',
        padding: 0.15,
      },
      text: {
        font: 'display',
        size: 16,
        weight: '700',
        color: '#FFFFFF',
        openQuote: true,             // Show opening quote mark
        closeQuote: true,            // Show closing quote mark
      },
      attribution: {
        font: 'body',
        size: 12,
        weight: '700',
        color: '#FFFFFF',
        prefix: '- ',
      },
    },

    // Record/stats bar
    recordBar: {
      backgroundColor: '#523D73',
      padding: { v: 0.03, h: 0.1 },
      text: {
        font: 'display',
        size: 18,
        weight: '700',
        color: '#FFFFFF',
      },
      icon: {
        type: 'cross',              // Small cross/plus icon
        position: 'end',
        color: '#FFFFFF',
      },
    },

    // Caption with number badge
    numberedCaption: {
      number: {
        shape: 'square',
        size: 0.2,
        backgroundColor: '#000000',
        color: '#FFFFFF',
        font: 'body',
        fontSize: 9,
        fontWeight: '700',
      },
      text: {
        font: 'body',
        size: 10,
        color: '#1A1A1A',
        maxWidth: 2.2,
      },
    },

    // Section header treatment
    sectionHeader: {
      font: 'script',
      size: 28,
      style: 'italic',
      color: '#1A1A1A',
      placement: 'top-right',
      alignment: 'right',
    },

    // School name treatment
    schoolNameBlock: {
      font: 'display',
      size: 60,
      weight: '700',
      color: '#1A1A1A',
      letterSpacing: 2,
      lineHeight: 0.9,
    },
  },

  // ============================================================
  // PAGE TYPE VARIATIONS
  // ============================================================
  pageTypes: {
    sports: {
      photoTreatment: 'mixed-bw-color',
      dominantPhoto: 'action-shot-bw',
      layoutStyle: 'dynamic-grid',
      requiredElements: ['sectionHeader', 'schoolName', 'record', 'roster', 'bodyCopy'],
      optionalElements: ['quote', 'highlights'],
    },
    events: {
      photoTreatment: 'mostly-color',
      dominantPhoto: 'atmosphere-establishing',
      layoutStyle: 'varied-collage',
      requiredElements: ['sectionHeader', 'headline', 'bodyCopy'],
      optionalElements: ['date', 'quote'],
    },
    clubs: {
      photoTreatment: 'color',
      dominantPhoto: 'group-photo',
      layoutStyle: 'organized-grid',
      requiredElements: ['sectionHeader', 'headline', 'roster', 'bodyCopy'],
      optionalElements: ['highlights'],
    },
    academics: {
      photoTreatment: 'color',
      dominantPhoto: 'classroom-action',
      layoutStyle: 'editorial',
      requiredElements: ['sectionHeader', 'headline', 'bodyCopy'],
      optionalElements: ['quote', 'roster'],
    },
    people: {
      photoTreatment: 'color',
      dominantPhoto: 'portrait-grid',
      layoutStyle: 'structured-grid',
      requiredElements: ['sectionHeader', 'names'],
      optionalElements: ['quote', 'favorites'],
    },
    studentLife: {
      photoTreatment: 'mixed',
      dominantPhoto: 'candid-moment',
      layoutStyle: 'organic-collage',
      requiredElements: ['sectionHeader', 'headline'],
      optionalElements: ['captions', 'quote'],
    },
  },

  // ============================================================
  // CAPTION NUMBERING SYSTEM
  // ============================================================
  captionSystem: {
    style: 'numbered-badge',
    numberPlacement: 'corner-of-photo',  // Small number in corner
    captionPlacement: 'grouped-below',   // All captions grouped at bottom
    format: {
      number: 'bold',
      separator: '. ',
      personIdentification: 'left-to-right',
      actionDescription: 'present-tense',
    },
    example: '1. Ian Campbell is seen taking a cross in a heated match against the Delmar Bulldogs.',
  },
};

// ============================================================
// THEME EXPORT (for use in layout generator)
// ============================================================
const DCHS_THEME = {
  name: 'DCHS Official',
  style: 'editorial',

  colors: {
    primary: DCHS_STYLE_GUIDE.colors.primary,
    secondary: DCHS_STYLE_GUIDE.colors.black,
    accent: DCHS_STYLE_GUIDE.colors.accentGold,
    background: DCHS_STYLE_GUIDE.colors.white,
    text: DCHS_STYLE_GUIDE.colors.textDark,
    textLight: DCHS_STYLE_GUIDE.colors.textLight,
  },

  typography: {
    // Using web-safe fallbacks for the generator
    headlineFont: 'Playfair Display',    // Fallback for AHJ Bodoni Display
    scriptFont: 'Dancing Script',         // Fallback for AHJ Bungalow Script
    bodyFont: 'Source Sans Pro',          // Clean body font
  },

  layout: {
    photoTreatment: 'sharp-corners',
    photoShadows: 'minimal',
    photoBorders: 'none',
  },

  // Full style guide reference
  styleGuide: DCHS_STYLE_GUIDE,
};

module.exports = {
  DCHS_STYLE_GUIDE,
  DCHS_THEME,
};
