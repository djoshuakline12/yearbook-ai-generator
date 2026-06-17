// styles.jsx — paragraph and character style setup.
// All YB_X styles are created at the start of an import run.
// Element renderers then apply these styles, so a user can globally
// tweak typography via the Paragraph Styles panel.

function ensureParagraphStyle(doc, name, props) {
    try {
        var existing = doc.paragraphStyles.itemByName(name);
        if (existing.isValid) return existing;
    } catch (e) {}
    return doc.paragraphStyles.add({ name: name });
}

function ensureCharacterStyle(doc, name, props) {
    try {
        var existing = doc.characterStyles.itemByName(name);
        if (existing.isValid) return existing;
    } catch (e) {}
    return doc.characterStyles.add({ name: name });
}

function trySetProp(obj, prop, value) {
    try { obj[prop] = value; } catch (e) {}
}

function setupParagraphStyles(doc, theme) {
    var headlineFont = (theme && theme.headlineFont) || 'Playfair Display';
    var bodyFont     = (theme && theme.bodyFont) || 'Source Sans Pro';
    var displayFont  = (theme && theme.displayFont) || 'Oswald';
    var scriptFont   = (theme && theme.scriptFont) || 'Dancing Script';

    var purple = doc.colors.itemByName('YB Primary Purple');
    var dark   = doc.colors.itemByName('YB Text Dark');
    var medium = doc.colors.itemByName('YB Text Medium');
    var paper  = doc.swatches.itemByName('Paper');

    function p(name, opts) {
        var ps = ensureParagraphStyle(doc, name);
        trySetProp(ps, 'appliedFont', resolveFontName(opts.font, opts.weight));
        trySetProp(ps, 'pointSize', opts.size);
        if (opts.leading != null) trySetProp(ps, 'leading', opts.leading);
        if (opts.color) trySetProp(ps, 'fillColor', opts.color);
        if (opts.tracking != null) trySetProp(ps, 'tracking', opts.tracking);
        if (opts.capital) trySetProp(ps, 'capitalization', opts.capital);
        if (opts.justification != null) trySetProp(ps, 'justification', opts.justification);
        if (opts.italic) trySetProp(ps, 'fontStyle', 'Italic');
        return ps;
    }

    p('YB_Page Title',       { font: headlineFont, weight: '900', size: 42, leading: 44, color: dark, tracking: 0 });
    p('YB_Section Header',   { font: bodyFont,     weight: '600', size: 14, color: purple, tracking: 300, capital: Capitalization.ALL_CAPS });
    p('YB_School Name',      { font: displayFont,  weight: '700', size: 60, color: dark, tracking: 200, capital: Capitalization.ALL_CAPS });
    p('YB_Headline',         { font: displayFont,  weight: '700', size: 18, color: paper });
    p('YB_Subheadline',      { font: bodyFont,     weight: '400', size: 14, color: medium, italic: true });
    p('YB_Date',             { font: bodyFont,     weight: '600', size: 12, color: medium, tracking: 100, capital: Capitalization.ALL_CAPS });
    p('YB_Record',           { font: displayFont,  weight: '700', size: 16, color: paper });
    p('YB_Body Copy',        { font: bodyFont,     weight: '400', size: 10, leading: 14, color: dark, justification: Justification.LEFT_JUSTIFIED });
    p('YB_Roster Title',     { font: bodyFont,     weight: '700', size: 11, color: dark });
    p('YB_Roster Names',     { font: bodyFont,     weight: '400', size: 8, leading: 10.4, color: medium });
    p('YB_Quote',            { font: headlineFont, weight: '400', size: 14, color: dark, italic: true });
    p('YB_Quote Attribution',{ font: bodyFont,     weight: '700', size: 11, color: dark });
    p('YB_Caption',          { font: bodyFont,     weight: '400', size: 8, color: medium, italic: true });
    p('YB_Caption Title',    { font: bodyFont,     weight: '700', size: 8, color: dark, tracking: 50, capital: Capitalization.ALL_CAPS });
    p('YB_Folio',            { font: bodyFont,     weight: '400', size: 10, color: dark });
    p('YB_Highlights Title', { font: displayFont,  weight: '700', size: 11, color: dark, tracking: 100, capital: Capitalization.ALL_CAPS });
    p('YB_Highlights Item',  { font: bodyFont,     weight: '400', size: 9, leading: 12, color: dark });
}

function setupCharacterStyles(doc, theme) {
    var headlineFont = (theme && theme.headlineFont) || 'Playfair Display';
    var bodyFont     = (theme && theme.bodyFont) || 'Source Sans Pro';
    var purple = doc.colors.itemByName('YB Primary Purple');

    function c(name, opts) {
        var cs = ensureCharacterStyle(doc, name);
        if (opts.font) trySetProp(cs, 'appliedFont', resolveFontName(opts.font, opts.weight));
        if (opts.color) trySetProp(cs, 'fillColor', opts.color);
        if (opts.italic) trySetProp(cs, 'fontStyle', 'Italic');
        if (opts.weight === '700') trySetProp(cs, 'fontStyle', 'Bold');
        return cs;
    }

    c('YB_Theme Word',   { font: headlineFont, weight: '900', italic: true, color: purple });
    c('YB_Body Emphasis',{ font: bodyFont,     weight: '700' });
}

// Apply a paragraph style to all paragraphs in a text frame.
function applyParagraphStyle(textFrame, doc, styleName) {
    try {
        var ps = doc.paragraphStyles.itemByName(styleName);
        if (ps.isValid) {
            textFrame.parentStory.appliedParagraphStyle = ps;
        }
    } catch (e) {
        ybLog('applyParagraphStyle failed for ' + styleName + ': ' + e.message);
    }
}

// Apply a character style to a substring of text in a text frame.
function applyCharacterStyleToRange(textFrame, doc, styleName, startChar, endChar) {
    try {
        var cs = doc.characterStyles.itemByName(styleName);
        if (!cs.isValid) return;
        var story = textFrame.parentStory;
        if (endChar > story.characters.length) endChar = story.characters.length;
        var range = story.characters.itemByRange(startChar, endChar - 1);
        range.appliedCharacterStyle = cs;
    } catch (e) {
        ybLog('applyCharacterStyleToRange failed: ' + e.message);
    }
}
