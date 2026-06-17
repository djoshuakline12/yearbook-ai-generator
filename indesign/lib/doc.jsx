// doc.jsx — document and page setup for the yearbook importer.

function createDocument(setup) {
    var s = setup || {};
    var pageWidth = s.pageWidthIn || 8.0;
    var pageHeight = s.pageHeightIn || 10.5;
    var bleed = (s.bleedIn != null) ? s.bleedIn : 0.125;
    var safeMargin = s.safeMarginIn || 0.75;
    var gutterMargin = s.gutterMarginIn || 0.75;

    // Set unit to inches before creating the doc so all subsequent
    // measurement props are interpreted as inches.
    app.scriptPreferences.measurementUnit = MeasurementUnits.INCHES;

    var doc = app.documents.add();

    // Save current ruler/unit, set to inches.
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.rulerOrigin = RulerOrigin.SPREAD_ORIGIN;

    // Document basics
    doc.documentPreferences.facingPages = true;
    doc.documentPreferences.pageWidth = pageWidth + ' in';
    doc.documentPreferences.pageHeight = pageHeight + ' in';

    // Bleed
    doc.documentPreferences.documentBleedTopOffset = bleed + ' in';
    doc.documentPreferences.documentBleedBottomOffset = bleed + ' in';
    doc.documentPreferences.documentBleedInsideOrLeftOffset = bleed + ' in';
    doc.documentPreferences.documentBleedOutsideOrRightOffset = bleed + ' in';

    // Margins on the master spread.
    try {
        var master = doc.masterSpreads.item(0);
        for (var i = 0; i < master.pages.length; i++) {
            var p = master.pages[i];
            p.marginPreferences.top = safeMargin + ' in';
            p.marginPreferences.bottom = safeMargin + ' in';
            // For facing pages: inside (gutter side) vs outside.
            p.marginPreferences.left = gutterMargin + ' in';
            p.marginPreferences.right = safeMargin + ' in';
        }
    } catch (e) {
        ybLog('Master margin setup error: ' + e.message);
    }

    // Apply same margins on the existing first page so element coords land correctly.
    try {
        var first = doc.pages.item(0);
        first.marginPreferences.top = safeMargin + ' in';
        first.marginPreferences.bottom = safeMargin + ' in';
        first.marginPreferences.left = gutterMargin + ' in';
        first.marginPreferences.right = safeMargin + ' in';
    } catch (e) {}

    return doc;
}

// Ensure a layer named X exists, returns it.
function ensureLayer(doc, name) {
    try {
        var existing = doc.layers.itemByName(name);
        if (existing.isValid) return existing;
    } catch (e) {}
    return doc.layers.add({ name: name });
}

// Add the required pages for a spread (1 page for single-page, 2 for spread).
// Returns an array of Page references in left-to-right order.
//
// InDesign starts every doc with one page (page 1, which is a right-hand page).
// We treat spread index 0 as occupying the first physical pages required.
function addPagesForSpread(doc, pageType, spreadIndex) {
    var pages = [];
    var firstUsed = false;

    // If this is the very first spread, reuse page 1 (and add page 0 for spreads).
    if (spreadIndex === 0) {
        var existing = doc.pages.item(0);
        if (pageType === 'spread') {
            // Add a page BEFORE page 1 so the spread becomes [left, right].
            var newLeft = doc.pages.add(LocationOptions.BEFORE, existing);
            pages.push(newLeft);
            pages.push(existing);
        } else {
            pages.push(existing);
        }
        firstUsed = true;
    } else {
        // Append to the end.
        var pagesNeeded = (pageType === 'spread') ? 2 : 1;
        for (var i = 0; i < pagesNeeded; i++) {
            pages.push(doc.pages.add(LocationOptions.AT_END));
        }
    }

    return pages;
}
