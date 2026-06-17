// utils.jsx — shared helpers for the InDesign yearbook importer.
// All measurements assumed to be in inches; we convert to points where needed.

var YB_LOG = [];

function ybLog(msg) {
    YB_LOG.push(String(msg));
}

function ybLogFlush(folder) {
    if (!folder) return;
    try {
        var f = new File(folder.fsName + '/indesign-import-log.txt');
        f.encoding = 'UTF-8';
        f.open('w');
        f.write(YB_LOG.join('\n'));
        f.close();
    } catch (e) {
        // Last resort — write to user's desktop.
    }
}

function readJsonFile(file) {
    if (!file || !file.exists) return null;
    file.encoding = 'UTF-8';
    file.open('r');
    var content = file.read();
    file.close();
    try {
        return JSON.parse(content);
    } catch (e) {
        ybLog('JSON parse error in ' + file.fsName + ': ' + e.message);
        return null;
    }
}

// Convert inches → points (InDesign internal unit is points).
function inToPt(inches) {
    return inches * 72;
}

// Convert points → inches.
function ptToIn(pt) {
    return pt / 72;
}

// Clamp value between min and max.
function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

// Compute geometricBounds for InDesign: [y1, x1, y2, x2] in current measurement units.
// We use inches throughout because docs are configured that way.
function boundsInches(xIn, yIn, widthIn, heightIn) {
    return [yIn, xIn, yIn + heightIn, xIn + widthIn];
}

// Pretty layer name.
function makeLayerName(spreadIdx, section) {
    var label = section ? String(section) : '(untitled)';
    return 'Spread ' + spreadIdx + ' - ' + label;
}

// Item label format used inside layers.
function makeItemLabel(spreadIdx, type, idx) {
    return 's' + spreadIdx + '_' + type + '_' + idx;
}

// Best-effort font availability check.
function checkFonts(requiredFonts) {
    var missing = [];
    if (!requiredFonts || !requiredFonts.length) return missing;
    for (var i = 0; i < requiredFonts.length; i++) {
        var name = requiredFonts[i];
        var found = false;
        try {
            // Check by family — search across installed fonts.
            for (var f = 0; f < app.fonts.length; f++) {
                var font = app.fonts[f];
                if (String(font.fontFamily) === name && font.status === FontStatus.INSTALLED) {
                    found = true;
                    break;
                }
            }
        } catch (e) {
            // ignore
        }
        if (!found) missing.push(name);
    }
    return missing;
}

// Try to resolve a usable font name + style for a (family, weight) request.
// Returns string usable for textFrame.parentStory.appliedFont = X.
function resolveFontName(family, weight) {
    // Map weight → InDesign style names.
    var styles = ['Regular'];
    switch (String(weight)) {
        case '900': styles = ['Black', 'Heavy', 'ExtraBold', 'Bold']; break;
        case '800': styles = ['ExtraBold', 'Heavy', 'Bold']; break;
        case '700': styles = ['Bold']; break;
        case '600': styles = ['Semibold', 'SemiBold', 'DemiBold', 'Medium']; break;
        case '500': styles = ['Medium', 'Regular']; break;
        case '400': styles = ['Regular']; break;
        case '300': styles = ['Light', 'Regular']; break;
        default: styles = ['Regular'];
    }

    // Try each style until we find an installed font.
    for (var i = 0; i < styles.length; i++) {
        var attempt = family + '\t' + styles[i];
        try {
            var font = app.fonts.itemByName(attempt);
            if (font.isValid && font.status === FontStatus.INSTALLED) {
                return attempt;
            }
        } catch (e) {}
    }
    // Fallback: family + Regular even if not installed (InDesign will substitute).
    return family + '\tRegular';
}
