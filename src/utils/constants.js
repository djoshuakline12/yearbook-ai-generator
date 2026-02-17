// Herff Jones Size 8 specifications
const PAGE = {
  WIDTH_IN: 8.0,
  HEIGHT_IN: 10.5,
  SPREAD_WIDTH_IN: 16.0,
  DPI: 400,  // High quality for scaling in yearbook editor (6400x4200 spread)
  BLEED_IN: 0.125,
  SAFE_MARGIN_IN: 0.75,  // Increased for more print safety (keeps content well away from bleed)
  GUTTER_MARGIN_IN: 0.75,  // Extra space near binding
};

// Pixel dimensions (without bleed)
PAGE.WIDTH_PX = PAGE.WIDTH_IN * PAGE.DPI;           // 2400
PAGE.HEIGHT_PX = PAGE.HEIGHT_IN * PAGE.DPI;          // 3150
PAGE.SPREAD_WIDTH_PX = PAGE.SPREAD_WIDTH_IN * PAGE.DPI; // 4800

// With bleed
PAGE.BLEED_WIDTH_PX = (PAGE.WIDTH_IN + PAGE.BLEED_IN * 2) * PAGE.DPI;
PAGE.BLEED_HEIGHT_PX = (PAGE.HEIGHT_IN + PAGE.BLEED_IN * 2) * PAGE.DPI;
PAGE.BLEED_SPREAD_WIDTH_PX = (PAGE.SPREAD_WIDTH_IN + PAGE.BLEED_IN * 2) * PAGE.DPI;

const STYLES = ['dynamic', 'elegant', 'bold', 'minimal', 'collage', 'editorial'];

const MAX_PHOTOS = 15;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per photo

module.exports = { PAGE, STYLES, MAX_PHOTOS, MAX_FILE_SIZE };
