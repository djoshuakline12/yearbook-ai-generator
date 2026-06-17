// elements.jsx — per-element-type renderers.
//
// Each renderer takes:
//   doc, page (or spread), el (layout element), spreadIdx, idx, layer
// and creates one or more InDesign objects.

function addTextElement(doc, page, el, spreadIdx, idx, layer, styleName) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    var tf;
    try { tf = page.textFrames.add(); }
    catch (e) { ybLog('textFrames.add() failed: ' + e.message); return null; }

    try { tf.itemLayer = layer; } catch (e) {}
    try { tf.geometricBounds = bounds; } catch (e) {}
    try { tf.contents = String(el.text != null ? el.text : ''); } catch (e) {}
    try { tf.label = makeItemLabel(spreadIdx, el.type, idx); } catch (e) {}

    if (styleName) applyParagraphStyle(tf, doc, styleName);

    // Override font size from element if specified.
    if (el.fontSize) {
        try { tf.parentStory.pointSize = el.fontSize; } catch (e) {}
    }
    if (el.textAlign) {
        try {
            var jmap = {
                left:    Justification.LEFT_ALIGN,
                center:  Justification.CENTER_ALIGN,
                right:   Justification.RIGHT_ALIGN,
                justify: Justification.LEFT_JUSTIFIED
            };
            if (jmap[el.textAlign]) tf.parentStory.justification = jmap[el.textAlign];
        } catch (e) {}
    }
    if (el.color) {
        var brush = getSwatchByHex(doc, el.color, $.global.YB_SWATCH_CACHE);
        if (brush) {
            try { tf.parentStory.fillColor = brush; } catch (e) {}
        }
    }
    if (el.backgroundColor) {
        var bg = getSwatchByHex(doc, el.backgroundColor, $.global.YB_SWATCH_CACHE);
        if (bg) {
            try {
                tf.fillColor = bg;
                // Padding for chip look.
                tf.textFramePreferences.insetSpacing = [
                    inToPt(0.05), inToPt(0.1), inToPt(0.05), inToPt(0.1)
                ];
            } catch (e) {}
        }
    }
    if (el.fontFamily) {
        try {
            tf.parentStory.appliedFont = resolveFontName(el.fontFamily, el.fontWeight || '400');
        } catch (e) {}
    }
    if (el.letterSpacing) {
        try { tf.parentStory.tracking = el.letterSpacing * 50; } catch (e) {}
    }
    if (el.textTransform) {
        try {
            if (el.textTransform === 'uppercase') tf.parentStory.capitalization = Capitalization.ALL_CAPS;
            else if (el.textTransform === 'lowercase') tf.parentStory.capitalization = Capitalization.NORMAL;
        } catch (e) {}
    }

    return tf;
}

// ----- Renderers ----------------------------------------------------------

function renderPageTitle(doc, page, el, spreadIdx, idx, layer) {
    var tf = addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Page Title');
    if (!tf || !el.themeWord) return tf;
    var text = String(el.text || '');
    var themeWord = String(el.themeWord);
    var pos = text.toLowerCase().indexOf(themeWord.toLowerCase());
    if (pos >= 0) {
        applyCharacterStyleToRange(tf, doc, 'YB_Theme Word', pos, pos + themeWord.length);
    }
    return tf;
}

function renderSectionHeader(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Section Header');
}

function renderSchoolName(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_School Name');
}

function renderHeadline(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Headline');
}

function renderSubheadline(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Subheadline');
}

function renderDate(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Date');
}

function renderRecord(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Record');
}

function renderBodyCopy(doc, page, el, spreadIdx, idx, layer) {
    var tf = addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Body Copy');
    if (!tf) return null;
    if (el.columns && el.columns > 1) {
        try {
            tf.textFramePreferences.textColumnCount = el.columns;
            tf.textFramePreferences.textColumnGutter = inToPt(0.15);
        } catch (e) {}
    }
    if (el.lineHeight && el.fontSize) {
        try { tf.parentStory.leading = el.fontSize * el.lineHeight; } catch (e) {}
    }
    return tf;
}

function renderRoster(doc, page, el, spreadIdx, idx, layer) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    var title = (el.title || 'Roster:') + '\r';
    var namesStr = (el.names && el.names.length ? el.names.join(', ') : '');
    var contents = title + namesStr;

    var tf;
    try { tf = page.textFrames.add(); }
    catch (e) { ybLog('roster textFrames.add() failed: ' + e.message); return null; }
    try { tf.itemLayer = layer; } catch (e) {}
    try { tf.geometricBounds = bounds; } catch (e) {}
    try { tf.contents = contents; } catch (e) {}
    try { tf.label = makeItemLabel(spreadIdx, 'roster', idx); } catch (e) {}

    // Title paragraph
    try {
        tf.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.itemByName('YB_Roster Title');
    } catch (e) {}
    // Names paragraph(s)
    try {
        if (tf.paragraphs.length > 1) {
            tf.paragraphs.itemByRange(1, tf.paragraphs.length - 1).appliedParagraphStyle =
                doc.paragraphStyles.itemByName('YB_Roster Names');
        }
    } catch (e) {}

    // Multi-column
    if (el.columns && el.columns > 1) {
        try {
            tf.textFramePreferences.textColumnCount = el.columns;
            tf.textFramePreferences.textColumnGutter = inToPt(0.15);
        } catch (e) {}
    }

    return tf;
}

function renderQuote(doc, page, el, spreadIdx, idx, layer) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    var hasBg = !!el.backgroundColor;
    var quoteText = '“' + String(el.text || '') + '”';
    var contents = quoteText;
    if (el.attribution) contents += '\r' + String(el.attribution);

    var tf;
    try { tf = page.textFrames.add(); }
    catch (e) { ybLog('quote textFrames.add() failed: ' + e.message); return null; }
    try { tf.itemLayer = layer; } catch (e) {}
    try { tf.geometricBounds = bounds; } catch (e) {}
    try { tf.contents = contents; } catch (e) {}
    try { tf.label = makeItemLabel(spreadIdx, 'quote', idx); } catch (e) {}

    // Apply quote style to first paragraph.
    try {
        tf.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.itemByName('YB_Quote');
    } catch (e) {}
    try {
        if (tf.paragraphs.length > 1) {
            tf.paragraphs[1].appliedParagraphStyle = doc.paragraphStyles.itemByName('YB_Quote Attribution');
        }
    } catch (e) {}

    if (hasBg) {
        var bg = getSwatchByHex(doc, el.backgroundColor, $.global.YB_SWATCH_CACHE);
        if (bg) {
            try {
                tf.fillColor = bg;
                tf.textFramePreferences.insetSpacing = [
                    inToPt(0.12), inToPt(0.15), inToPt(0.12), inToPt(0.15)
                ];
                // White text on purple
                var paper = doc.swatches.itemByName('Paper');
                if (paper) tf.parentStory.fillColor = paper;
            } catch (e) {}
        }
    }

    return tf;
}

function renderHighlights(doc, page, el, spreadIdx, idx, layer) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    var title = (el.title || 'Highlights') + '\r';
    var items = el.items && el.items.length ? el.items : [];
    var bullet = '• ';
    var lines = [];
    for (var i = 0; i < items.length; i++) {
        lines.push(bullet + String(items[i]));
    }
    var contents = title + lines.join('\r');

    var tf;
    try { tf = page.textFrames.add(); }
    catch (e) { ybLog('highlights textFrames.add() failed: ' + e.message); return null; }
    try { tf.itemLayer = layer; } catch (e) {}
    try { tf.geometricBounds = bounds; } catch (e) {}
    try { tf.contents = contents; } catch (e) {}
    try { tf.label = makeItemLabel(spreadIdx, 'highlights', idx); } catch (e) {}

    try {
        tf.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.itemByName('YB_Highlights Title');
    } catch (e) {}
    try {
        if (tf.paragraphs.length > 1) {
            tf.paragraphs.itemByRange(1, tf.paragraphs.length - 1).appliedParagraphStyle =
                doc.paragraphStyles.itemByName('YB_Highlights Item');
        }
    } catch (e) {}

    return tf;
}

function renderCaption(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Caption');
}

function renderCaptionNumber(doc, page, el, spreadIdx, idx, layer) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;
    var fillHex = el.backgroundColor || '#1A1A1A';
    var brush = getSwatchByHex(doc, fillHex, $.global.YB_SWATCH_CACHE);

    var rect;
    try { rect = page.rectangles.add(); }
    catch (e) { ybLog('capnum rect failed: ' + e.message); return null; }
    try { rect.itemLayer = layer; } catch (e) {}
    try { rect.geometricBounds = bounds; } catch (e) {}
    try { rect.fillColor = brush || doc.swatches.itemByName('Black'); } catch (e) {}
    try { rect.strokeColor = safeNone(doc); } catch (e) {}
    try { rect.label = makeItemLabel(spreadIdx, 'capnum_bg', idx); } catch (e) {}

    var tf;
    try { tf = page.textFrames.add(); }
    catch (e) { ybLog('capnum text failed: ' + e.message); return rect; }
    try { tf.itemLayer = layer; } catch (e) {}
    try { tf.geometricBounds = bounds; } catch (e) {}
    try { tf.contents = String(el.number != null ? el.number : ''); } catch (e) {}
    try { tf.label = makeItemLabel(spreadIdx, 'capnum', idx); } catch (e) {}
    try {
        tf.parentStory.justification = Justification.CENTER_ALIGN;
        tf.parentStory.fillColor = doc.swatches.itemByName('Paper');
    } catch (e) {}
    return [rect, tf];
}

function renderDecorative(doc, page, el, spreadIdx, idx, layer) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;
    var brush = getSwatchByHex(doc, el.color || '#523D73', $.global.YB_SWATCH_CACHE);

    var obj;
    try {
        obj = el.shape === 'circle' ? page.ovals.add() : page.rectangles.add();
    } catch (e) {
        ybLog('decorative add failed: ' + e.message);
        return null;
    }
    try { obj.itemLayer = layer; } catch (e) {}
    try { obj.geometricBounds = bounds; } catch (e) {}
    try { obj.fillColor = brush || doc.swatches.itemByName('Black'); } catch (e) {}
    try { obj.strokeColor = safeNone(doc); } catch (e) {}
    try { obj.label = makeItemLabel(spreadIdx, 'decorative', idx); } catch (e) {}
    if (el.rotation && el.rotation !== 0) {
        try { obj.rotationAngle = -el.rotation; } catch (e) {}
    }
    if (el.opacity != null && el.opacity < 1) {
        try { obj.transparencySettings.blendingSettings.opacity = el.opacity * 100; } catch (e) {}
    }
    return obj;
}

function renderFolio(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, 'YB_Folio');
}

// ----- Dispatch table -----------------------------------------------------

var ELEMENT_RENDERERS = {
    photo:         function (doc, pages, el, sp, meta, folder, layer, idx) {
                       var page = elementPageForX(pages, el);
                       return placePhoto(doc, page.parent, page, el, folder, layer, sp, idx);
                   },
    pageTitle:     function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderPageTitle(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    sectionHeader: function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderSectionHeader(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    schoolName:    function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderSchoolName(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    headline:      function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderHeadline(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    subheadline:   function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderSubheadline(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    date:          function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderDate(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    record:        function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderRecord(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    bodyCopy:      function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderBodyCopy(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    roster:        function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderRoster(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    quote:         function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderQuote(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    highlights:    function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderHighlights(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    caption:       function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderCaption(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    captionNumber: function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderCaptionNumber(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    decorative:    function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderDecorative(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    folio:         function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderFolio(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   },
    pageNumber:    function (doc, pages, el, sp, meta, folder, layer, idx) {
                       return renderFolio(doc, elementPageForX(pages, el), el, sp, idx, layer);
                   }
};

// Pick the page in pages[] that an element with x coordinate belongs to.
function elementPageForX(pages, el) {
    if (pages.length === 1) return pages[0];
    // Spread: anything with x >= page1.width belongs to page 2.
    var docPrefs = pages[0].parent.parent.documentPreferences;
    var pageWidth = parseFloat(docPrefs.pageWidth);
    return (el.x >= pageWidth) ? pages[1] : pages[0];
}
