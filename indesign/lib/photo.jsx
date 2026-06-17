// photo.jsx — photo placement and cropping for the yearbook importer.
//
// Schema field reference (from src/services/htmlRenderer.js renderPhoto):
//   el.cropX / el.cropY   : 0-100 percentages — CSS object-position semantics
//   el.cropFit            : "cover" (default)
//   el.blackAndWhite      : true → use bwLinkPath instead of linkPath
//   el.linkPath / bwLinkPath : relative to bundle root
//   el.rotation, el.opacity, el.borderWidth, el.borderColor

function safeNone(doc) {
    try { return doc.swatches.itemByName('None'); }
    catch (e) {
        try { return doc.swatches.item('None'); }
        catch (e2) { return null; }
    }
}

function placePhoto(doc, parentSpread, page, el, bundleFolder, layer, spreadIdx, idx) {
    // Pick the file (B&W if applicable + available, else color).
    var useBw = el.blackAndWhite && el.bwLinkPath;
    var rel = useBw ? el.bwLinkPath : el.linkPath;
    if (!rel) {
        ybLog('Photo ' + idx + ' has no link path; placing placeholder.');
        return placeMissingPhotoPlaceholder(doc, page, el, layer, spreadIdx, idx);
    }

    var imgFile = new File(bundleFolder.fsName + '/' + rel);
    if (!imgFile.exists) {
        ybLog('Photo file missing: ' + imgFile.fsName);
        return placeMissingPhotoPlaceholder(doc, page, el, layer, spreadIdx, idx, rel);
    }

    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    // Create empty rectangle with minimal properties then configure.
    var frame;
    try {
        frame = page.rectangles.add();
    } catch (e) {
        ybLog('rectangles.add() failed: ' + e.message);
        return null;
    }

    try { frame.itemLayer = layer; } catch (e) {}
    try { frame.geometricBounds = bounds; } catch (e) { ybLog('set geometricBounds failed: ' + e.message); }

    var none = safeNone(doc);
    if (none) {
        try { frame.strokeColor = none; } catch (e) {}
        try { frame.fillColor = none; } catch (e) {}
    }
    try { frame.strokeWeight = 0; } catch (e) {}
    try { frame.label = makeItemLabel(spreadIdx, 'photo', idx); } catch (e) {}

    // Place the image.
    var placed = false;
    try {
        frame.place(imgFile);
        placed = true;
    } catch (e) {
        ybLog('place() failed for ' + imgFile.fsName + ': ' + e.message);
    }

    if (placed) {
        // Set frame fitting via frameFittingOptions (modern API).
        try {
            frame.frameFittingOptions.fittingOnEmptyFrame = EmptyFrameFittingOptions.FILL_PROPORTIONALLY;
        } catch (e) {}
        try {
            frame.frameFittingOptions.autoFit = true;
        } catch (e) {}

        // Fall back to .fit() if available — wrap because some 2026 builds
        // drop this method.
        try {
            if (typeof frame.fit === 'function') {
                frame.fit(FitOptions.FILL_PROPORTIONALLY);
            }
        } catch (e) {}

        // Apply cropX / cropY by sliding the image inside its frame.
        try {
            applyCropPosition(frame, el);
        } catch (e) {
            ybLog('crop position failed: ' + e.message);
        }
    }

    // Border on the FRAME.
    if (el.borderWidth && el.borderWidth > 0) {
        try { frame.strokeWeight = inToPt(el.borderWidth); } catch (e) {}
        if (el.borderColor) {
            try {
                var brush = getSwatchByHex(doc, el.borderColor, $.global.YB_SWATCH_CACHE);
                if (brush) frame.strokeColor = brush;
            } catch (e) {}
        }
    }

    if (el.opacity != null && el.opacity < 1) {
        try { frame.transparencySettings.blendingSettings.opacity = el.opacity * 100; } catch (e) {}
    }

    if (el.rotation && el.rotation !== 0) {
        try { frame.rotationAngle = -el.rotation; } catch (e) {}
    }

    return frame;
}

function applyCropPosition(frame, el) {
    var graphics;
    try { graphics = frame.graphics; } catch (e) { return; }
    if (!graphics || graphics.length === 0) return;

    var img;
    try { img = graphics[0]; } catch (e) { return; }

    var cropX = (el.cropX != null) ? el.cropX : 50;
    var cropY = (el.cropY != null) ? el.cropY : 20;

    var fBounds, iBounds;
    try { fBounds = frame.geometricBounds; iBounds = img.geometricBounds; }
    catch (e) { return; }

    var fW = fBounds[3] - fBounds[1];
    var fH = fBounds[2] - fBounds[0];
    var iW = iBounds[3] - iBounds[1];
    var iH = iBounds[2] - iBounds[0];

    var extraW = iW - fW;
    var extraH = iH - fH;

    var targetX1 = fBounds[1] - (extraW * cropX / 100);
    var targetY1 = fBounds[0] - (extraH * cropY / 100);

    var deltaX = targetX1 - iBounds[1];
    var deltaY = targetY1 - iBounds[0];

    if (deltaX === 0 && deltaY === 0) return;

    // Move the image. Try multiple signatures because InDesign 2026 changed the API.
    try {
        // Newer signature: move(to, by)
        img.move(undefined, [deltaX, deltaY]);
        return;
    } catch (e) {}
    try {
        // Older signature: move(by)
        img.move([deltaX, deltaY]);
        return;
    } catch (e) {}
    try {
        // Alternative: directly set geometric bounds
        var newBounds = [
            iBounds[0] + deltaY,
            iBounds[1] + deltaX,
            iBounds[2] + deltaY,
            iBounds[3] + deltaX
        ];
        img.geometricBounds = newBounds;
    } catch (e) {}
}

function pageLocalBounds(page, el) {
    if (typeof el.x !== 'number' || typeof el.y !== 'number') return null;
    if (typeof el.width !== 'number' || typeof el.height !== 'number') return null;

    var docPrefs;
    try { docPrefs = page.parent.parent.documentPreferences; }
    catch (e) { return null; }

    var pageWidth;
    try { pageWidth = parseFloat(docPrefs.pageWidth); }
    catch (e) { pageWidth = 8.0; }

    var spreadPages = page.parent.pages;
    var isRightPage = false;
    try {
        if (spreadPages.length > 1 && spreadPages[1] === page) {
            isRightPage = true;
        }
    } catch (e) {}

    var localX = isRightPage ? el.x - pageWidth : el.x;
    return [el.y, localX, el.y + el.height, localX + el.width];
}

function placeMissingPhotoPlaceholder(doc, page, el, layer, spreadIdx, idx, missingPath) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    var grey;
    try { grey = ensureSwatch(doc, 'YB Missing Photo', [0, 0, 0, 20]); }
    catch (e) {}

    var rect;
    try {
        rect = page.rectangles.add();
        try { rect.itemLayer = layer; } catch (e) {}
        try { rect.geometricBounds = bounds; } catch (e) {}
        if (grey) try { rect.fillColor = grey; } catch (e) {}
        var none = safeNone(doc);
        if (none) try { rect.strokeColor = none; } catch (e) {}
    } catch (e) {
        ybLog('placeholder rect failed: ' + e.message);
    }

    try {
        var tf = page.textFrames.add();
        try { tf.itemLayer = layer; } catch (e) {}
        try { tf.geometricBounds = bounds; } catch (e) {}
        try { tf.contents = 'MISSING: ' + (missingPath || 'no link'); } catch (e) {}
    } catch (e) {}

    return rect;
}
