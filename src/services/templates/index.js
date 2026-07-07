// Hand-crafted template registry.
//
// If a layoutStyle matches a key here, buildSpreadLayout returns a
// { isHandTemplate: true, templateId } layout and renderLayoutToHtml
// routes to the matching renderer instead of the algorithmic path.

const { renderCrossGutterMosaic } = require('./tpl-cross-gutter-mosaic');
const { renderMainHeadlineBleed } = require('./tpl-main-headline-bleed');
const { renderShareAStory } = require('./tpl-share-a-story');
const { renderModSidebarGroup } = require('./tpl-mod-sidebar-group');
const { renderHeadlineHeroRail } = require('./tpl-headline-hero-rail');

const TEMPLATES = {
  'hero-top-bleed': renderShareAStory,          // Tpl 1 — editorial "share a story"
  'hero-left-magazine': renderModSidebarGroup,  // Tpl 2 — mod sidebar + group bleed
  'hero-dominant-sidebar': renderHeadlineHeroRail, // Tpl 3 — headline + hero + rail
  'sidebar-mods-bleed': renderMainHeadlineBleed,   // Tpl 4 — main headline bleed
  'cross-gutter-mosaic': renderCrossGutterMosaic,  // Tpl 5 — cross-gutter mosaic
};

// Old algorithmic style names → nearest hand-crafted template. Keeps
// previously saved picks and old picker values working.
const LEGACY_STYLE_MAP = {
  'horizontal-split': 'hero-top-bleed',
  'sidebar-text-left': 'hero-left-magazine',
  'sidebar-text-right': 'hero-dominant-sidebar',
  'interleaved': 'cross-gutter-mosaic',
  'magazine-spread': 'sidebar-mods-bleed',
};

function resolveTemplateId(styleId) {
  if (Object.prototype.hasOwnProperty.call(TEMPLATES, styleId)) return styleId;
  if (Object.prototype.hasOwnProperty.call(LEGACY_STYLE_MAP, styleId)) return LEGACY_STYLE_MAP[styleId];
  return null;
}

function hasHandTemplate(styleId) {
  return resolveTemplateId(styleId) !== null;
}

function renderHandTemplate(templateId, pageContent, photos, options) {
  const resolved = resolveTemplateId(templateId);
  const fn = resolved && TEMPLATES[resolved];
  if (!fn) throw new Error(`Unknown hand template: ${templateId}`);
  return fn(pageContent, photos, options);
}

module.exports = { hasHandTemplate, renderHandTemplate, resolveTemplateId };
