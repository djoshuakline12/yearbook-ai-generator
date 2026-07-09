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

// Sessions sometimes contain the same file uploaded twice; showing one
// photo in two slots is an instant tell. Drop byte-identical duplicates
// (signature: base64 length + head/tail samples) before slotting, and
// remap photoCaptions so caption↔photo pairing survives the index shift.
function dedupePhotosAndCaptions(photos, photoCaptions) {
  if (!Array.isArray(photos)) return { photos, captions: photoCaptions };
  const seen = new Set();
  const kept = [];
  photos.forEach((p, origIdx) => {
    const b = p && p.base64;
    if (b) {
      const sig = `${b.length}:${b.slice(0, 256)}:${b.slice(-256)}`;
      if (seen.has(sig)) return;
      seen.add(sig);
    }
    kept.push({ photo: p, origIdx });
  });
  if (kept.length === photos.length) return { photos, captions: photoCaptions };
  let captions = photoCaptions;
  if (Array.isArray(photoCaptions)) {
    captions = kept.map(({ origIdx }, newIdx) => {
      const cap = photoCaptions.find(c => c && c.photoIndex === origIdx) || photoCaptions[origIdx];
      return cap ? { ...cap, photoIndex: newIdx } : null;
    }).filter(Boolean);
  }
  return { photos: kept.map(k => k.photo), captions };
}

function renderHandTemplate(templateId, pageContent, photos, options) {
  const resolved = resolveTemplateId(templateId);
  const fn = resolved && TEMPLATES[resolved];
  if (!fn) throw new Error(`Unknown hand template: ${templateId}`);
  const { photos: uniquePhotos, captions } = dedupePhotosAndCaptions(photos, pageContent && pageContent.photoCaptions);
  const content = (captions !== (pageContent && pageContent.photoCaptions))
    ? { ...pageContent, photoCaptions: captions }
    : pageContent;
  return fn(content, uniquePhotos, options);
}

module.exports = { hasHandTemplate, renderHandTemplate, resolveTemplateId };
