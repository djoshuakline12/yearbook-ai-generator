// photo.jsx — photo placement and cropping for the yearbook importer.
//
// Schema field reference (from src/services/htmlRenderer.js renderPhoto):
//   el.cropX / el.cropY   : 0-100 percentages — CSS object-position semantics
//                           (50% = centered, 0% = left/top edge, 100% = right/bottom edge)
//   el.cropFit            : "cover" (default — fill frame, may clip)
//   el.blackAndWhite      : true → use bwLinkPath instead of linkPath
//   el.linkPath / bwLinkPath : relative to bundle root
//   el.rotation, el.opacity, el.borderWidth, el.borderColor, el.borderRadius
//   el.shadow, el.shadowIntensity

function placePhoto(doc, parentSpread, page, el, bundleFolder, layer, spreadIdx, idx) {
    // Pick the file (B&W if applicable + available, else color).
    var useBw = el.blackAndWhite && el.bwLinkPath;
    var rel = useBw ? el.bwLinkPath : el.linkPath;
    if (!rel) {
        ybLog('Photo ' + idx + ' has no link path; placing placeholder.');
        return placeMissingPhotoPlaceholder(page, el, layer, spreadIdx, idx);
    }

    var imgFile = new File(bundleFolder.fsName + '/' + rel);
    if (!imgFile.exists) {
        ybLog('Photo file missing: ' + imgFile.fsName);
        return placeMissingPhotoPlaceholder(page, el, layer, spreadIdx, idx, rel);
    }

    // Frame bounds — page-local coordinates.
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    // Create empty rectangle, then place the image into it.
    var frame = page.rectangles.add({
        geometricBounds: bounds,
        itemLayer: layer,
        strokeWeight: 0,
        strokeColor: doc.swatches.itemByName('None'),
        fillColor: doc.swatches.itemByName('None'),
        label: makeItemLabel(spreadIdx, 'photo', idx)
    });

    try {
        frame.place(imgFile, false);
    } catch (e) {
        ybLog('place() failed for ' + imgFile.fsName + ': ' + e.message);
        return frame;
    }

    // Fill-frame proportionally (matches CSS object-fit: cover).
    try {
        frame.fit(FitOptions.FILL_PROPORTIONALLY);
    } catch (e) {
        ybLog('FILL_PROPORTIONALLY fit failed: ' + e.message);
    }

    // Apply cropX / cropY by sliding the image inside its frame.
    try {
        applyCropPosition(frame, el);
    } catch (e) {
        ybLog('crop position failed: ' + e.message);
    }

    // Border (stroke) on the FRAME — schema has borderWidth + borderColor.
    if (el.borderWidth && el.borderWidth > 0) {
        try {
            frame.strokeWeight = inToPt(el.borderWidth);
            if (el.borderColor) {
                var brush = getSwatchByHex(doc, el.borderColor, $.global.YB_SWATCH_CACHE);
                if (brush) frame.strokeColor = brush;
            }
        } catch (e) {}
    }

    // Opacity
    if (el.opacity != null && el.opacity < 1) {
        try { frame.transparencySettings.blendingSettings.opacity = el.opacity * 100; } catch (e) {}
    }

    // Rotation
    if (el.rotation && el.rotation !== 0) {
        try { frame.rotationAngle = -el.rotation; } catch (e) {}
    }

    return frame;
}

// Apply cropX / cropY (0-100) to slide the placed image inside its frame.
// Mirrors CSS object-position semantics.
function applyCropPosition(frame, el) {
    var graphics = frame.graphics;
    if (!graphics || graphics.length === 0) return;
    var img = graphics[0];

    // Convert defaults: cropX=50, cropY=20 (matches default object-position 'center 20%')
    var cropX = (el.cropX != null) ? el.cropX : 50;
    var cropY = (el.cropY != null) ? el.cropY : 20;

    // Get frame bounds + image bounds (both in current measurement units).
    var fBounds = frame.geometricBounds;    // [y1, x1, y2, x2]
    var iBounds = img.geometricBounds;       // [y1, x1, y2, x2]

    var fW = fBounds[3] - fBounds[1];
    var fH = fBounds[2] - fBounds[0];
    var iW = iBounds[3] - iBounds[1];
    var iH = iBounds[2] - iBounds[0];

    // Overflow we can slide the image by.
    var extraW = iW - fW;
    var extraH = iH - fH;

    // Target image top-left so that the cropX/cropY % of the image
    // aligns with the same % of the frame.
    var targetX1 = fBounds[1] - (extraW * cropX / 100);
    var targetY1 = fBounds[0] - (extraH * cropY / 100);

    var deltaX = targetX1 - iBounds[1];
    var deltaY = targetY1 - iBounds[0];

    if (deltaX !== 0 || deltaY !== 0) {
        // Move the image (delta in current units — inches).
        img.move(undefined, [deltaX, deltaY]);
    }
}

// Convert an element's spread-coordinate position (relative to spread origin
// 0,0 at left of left page) to page-local coordinates for the given Page.
//
// On a spread, elements with x >= pageWidth live on the right page.
function pageLocalBounds(page, el) {
    if (typeof el.x !== 'number' || typeof el.y !== 'number') return null;
    if (typeof el.width !== 'number' || typeof el.height !== 'number') return null;

    var docPrefs = page.parent.parent.documentPreferences;
    var pageWidth = parseFloat(docPrefs.pageWidth);

    // Determine if this page is the right page of a spread.
    var spreadPages = page.parent.pages;
    var isRightPage = false;
    if (spreadPages.length > 1 && spreadPages[1] === page) {
        isRightPage = true;
    }

    var localX = isRightPage ? el.x - pageWidth : el.x;
    return [el.y, localX, el.y + el.height, localX + el.width];
}

function placeMissingPhotoPlaceholder(page, el, layer, spreadIdx, idx, missingPath) {
    var bounds = pageLocalBounds(page, el);
    if (!bounds) return null;

    var doc = page.parent.parent;
    var grey = ensureSwatch(doc, 'YB Missing Photo', [0, 0, 0, 20]);
    var rect = page.rectangles.add({
        geometricBounds: bounds,
        itemLayer: layer,
        fillColor: grey,
        strokeColor: doc.swatches.itemByName('None'),
        label: makeItemLabel(spreadIdx, 'missing_photo', idx)
    });

    try {
        var tf = page.textFrames.add({
            geometricBounds: bounds,
            itemLayer: layer,
            contents: 'MISSING: ' + (missingPath || 'no link path'),
            label: makeItemLabel(spreadIdx, 'missing_label', idx)
        });
    } catch (e) {}

    return rect;
}
