// Hand-crafted template registry.
//
// If a layoutStyle matches a key here, buildSpreadLayout returns a
// { isHandTemplate: true, templateId } layout and renderLayoutToHtml
// routes to the matching renderer instead of the algorithmic path.

const { renderCrossGutterMosaic } = require('./tpl-cross-gutter-mosaic');

const TEMPLATES = {
  'cross-gutter-mosaic': renderCrossGutterMosaic,
};

function hasHandTemplate(styleId) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, styleId);
}

function renderHandTemplate(templateId, pageContent, photos, options) {
  const fn = TEMPLATES[templateId];
  if (!fn) throw new Error(`Unknown hand template: ${templateId}`);
  return fn(pageContent, photos, options);
}

module.exports = { hasHandTemplate, renderHandTemplate };
