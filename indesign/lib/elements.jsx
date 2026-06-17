// elements.jsx — per-element-type renderers.
//
// Each renderer takes:
//   doc, page (or spread), el (layout element), spreadIdx, idx, layer
// and creates one or more InDesign objects.

function addTextElement(doc, page, el, spreadIdx, idx, layer, styleName) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    var tf = page.textFrames.add({
        geometricBounds: bounds,
        itemLayer: layer,
        contents: String(el.text != null ? el.text : ''),
        label: makeItemLabel(spreadIdx, el.type, idx)
    });

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
        var brush = getSwatchByHex(doc, el.color, doc.__ybSwatchCache);
        if (brush) {
            try { tf.parentStory.fillColor = brush; } catch (e) {}
        }
    }
    if (el.backgroundColor) {
        var bg = getSwatchByHex(doc, el.backgroundColor, doc.__ybSwatchCache);
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
    var tf = addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Page Title');
    if (!tf || !el.themeWord) return tf;
    var text = String(el.text || '');
    var themeWord = String(el.themeWord);
    var pos = text.toLowerCase().indexOf(themeWord.toLowerCase());
    if (pos >= 0) {
        applyCharacterStyleToRange(tf, doc, '[Yearbook] Theme Word', pos, pos + themeWord.length);
    }
    return tf;
}

function renderSectionHeader(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Section Header');
}

function renderSchoolName(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] School Name');
}

function renderHeadline(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Headline');
}

function renderSubheadline(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Subheadline');
}

function renderDate(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Date');
}

function renderRecord(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Record');
}

function renderBodyCopy(doc, page, el, spreadIdx, idx, layer) {
    var tf = addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Body Copy');
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

    var tf = page.textFrames.add({
        geometricBounds: bounds,
        itemLayer: layer,
        contents: contents,
        label: makeItemLabel(spreadIdx, 'roster', idx)
    });

    // Title paragraph
    try {
        tf.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.itemByName('[Yearbook] Roster Title');
    } catch (e) {}
    // Names paragraph(s)
    try {
        if (tf.paragraphs.length > 1) {
            tf.paragraphs.itemByRange(1, tf.paragraphs.length - 1).appliedParagraphStyle =
                doc.paragraphStyles.itemByName('[Yearbook] Roster Names');
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

    var tf = page.textFrames.add({
        geometricBounds: bounds,
        itemLayer: layer,
        contents: contents,
        label: makeItemLabel(spreadIdx, 'quote', idx)
    });

    // Apply quote style to first paragraph.
    try {
        tf.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.itemByName('[Yearbook] Quote');
    } catch (e) {}
    try {
        if (tf.paragraphs.length > 1) {
            tf.paragraphs[1].appliedParagraphStyle = doc.paragraphStyles.itemByName('[Yearbook] Quote Attribution');
        }
    } catch (e) {}

    if (hasBg) {
        var bg = getSwatchByHex(doc, el.backgroundColor, doc.__ybSwatchCache);
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

    var tf = page.textFrames.add({
        geometricBounds: bounds,
        itemLayer: layer,
        contents: contents,
        label: makeItemLabel(spreadIdx, 'highlights', idx)
    });

    try {
        tf.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.itemByName('[Yearbook] Highlights Title');
    } catch (e) {}
    try {
        if (tf.paragraphs.length > 1) {
            tf.paragraphs.itemByRange(1, tf.paragraphs.length - 1).appliedParagraphStyle =
                doc.paragraphStyles.itemByName('[Yearbook] Highlights Item');
        }
    } catch (e) {}

    return tf;
}

function renderCaption(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Caption');
}

function renderCaptionNumber(doc, page, el, spreadIdx, idx, layer) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;
    var fillHex = el.backgroundColor || '#1A1A1A';
    var brush = getSwatchByHex(doc, fillHex, doc.__ybSwatchCache);

    var rect = page.rectangles.add({
        geometricBounds: bounds,
        itemLayer: layer,
        fillColor: brush || doc.swatches.itemByName('Black'),
        strokeColor: doc.swatches.itemByName('None'),
        label: makeItemLabel(spreadIdx, 'capnum_bg', idx)
    });
    var tf = page.textFrames.add({
        geometricBounds: bounds,
        itemLayer: layer,
        contents: String(el.number != null ? el.number : ''),
        label: makeItemLabel(spreadIdx, 'capnum', idx)
    });
    try {
        tf.parentStory.justification = Justification.CENTER_ALIGN;
        tf.parentStory.fillColor = doc.swatches.itemByName('Paper');
    } catch (e) {}
    return [rect, tf];
}

function renderDecorative(doc, page, el, spreadIdx, idx, layer) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;
    var brush = getSwatchByHex(doc, el.color || '#523D73', doc.__ybSwatchCache);

    var obj;
    if (el.shape === 'circle') {
        obj = page.ovals.add({
            geometricBounds: bounds,
            itemLayer: layer,
            fillColor: brush || doc.swatches.itemByName('Black'),
            strokeColor: doc.swatches.itemByName('None'),
            label: makeItemLabel(spreadIdx, 'decorative', idx)
        });
    } else {
        obj = page.rectangles.add({
            geometricBounds: bounds,
            itemLayer: layer,
            fillColor: brush || doc.swatches.itemByName('Black'),
            strokeColor: doc.swatches.itemByName('None'),
            label: makeItemLabel(spreadIdx, 'decorative', idx)
        });
    }
    if (el.rotation && el.rotation !== 0) {
        try { obj.rotationAngle = -el.rotation; } catch (e) {}
    }
    if (el.opacity != null && el.opacity < 1) {
        try { obj.transparencySettings.blendingSettings.opacity = el.opacity * 100; } catch (e) {}
    }
    return obj;
}

function renderFolio(doc, page, el, spreadIdx, idx, layer) {
    return addTextElement(doc, page, el, spreadIdx, idx, layer, '[Yearbook] Folio');
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
