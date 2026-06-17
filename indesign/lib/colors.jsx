// colors.jsx — swatch creation + hex → CMYK conversion for InDesign.

// Convert "#RRGGBB" → [c, m, y, k] (0-100 each).
// Simple percentage approximation; for purple, callers should override
// using canonical CMYK from the theme.
function hexToCmyk(hex) {
    if (!hex) return [0, 0, 0, 100];
    hex = String(hex).replace('#', '');
    if (hex.length === 3) {
        hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }
    var r = parseInt(hex.substr(0, 2), 16) / 255;
    var g = parseInt(hex.substr(2, 2), 16) / 255;
    var b = parseInt(hex.substr(4, 2), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b)) return [0, 0, 0, 100];

    var k = 1 - Math.max(r, g, b);
    if (k === 1) return [0, 0, 0, 100];
    var c = (1 - r - k) / (1 - k);
    var m = (1 - g - k) / (1 - k);
    var y = (1 - b - k) / (1 - k);
    return [
        Math.round(c * 100),
        Math.round(m * 100),
        Math.round(y * 100),
        Math.round(k * 100)
    ];
}

// Find or create a CMYK swatch with the given name and values.
function ensureSwatch(doc, name, cmyk) {
    try {
        var existing = doc.colors.itemByName(name);
        if (existing.isValid) return existing;
    } catch (e) {}
    return doc.colors.add({
        name: name,
        model: ColorModel.PROCESS,
        space: ColorSpace.CMYK,
        colorValue: cmyk
    });
}

// Find or create a swatch from a hex string. Cached by hex on the doc's
// extendedProperties via a per-run dict (passed in).
function ensureHexSwatch(doc, hex, cache) {
    if (!hex) return null;
    var key = String(hex).toUpperCase();
    if (cache && cache[key]) return cache[key];

    var cmyk = hexToCmyk(hex);
    var name = 'YB ' + key;
    var swatch = ensureSwatch(doc, name, cmyk);
    if (cache) cache[key] = swatch;
    return swatch;
}

// Set up the canonical DCHS swatches once.
function setupSwatches(doc, theme) {
    var purple = (theme && theme.primaryCMYK)
        ? [theme.primaryCMYK.c, theme.primaryCMYK.m, theme.primaryCMYK.y, theme.primaryCMYK.k]
        : [43, 68, 0, 43];

    ensureSwatch(doc, 'YB Primary Purple', purple);
    ensureSwatch(doc, 'YB Text Dark',   [0, 0, 0, 90]);
    ensureSwatch(doc, 'YB Text Medium', [0, 0, 0, 70]);
    ensureSwatch(doc, 'YB Text Light',  [0, 0, 0, 40]);
}

// Resolve "named" theme colors (the most common values) to swatches.
function getSwatchByHex(doc, hex, cache) {
    if (!hex) return null;
    var key = String(hex).toUpperCase();
    if (key === '#523D73') return doc.colors.itemByName('YB Primary Purple');
    if (key === '#1A1A1A') return doc.colors.itemByName('YB Text Dark');
    if (key === '#333333') return doc.colors.itemByName('YB Text Medium');
    if (key === '#666666') return doc.colors.itemByName('YB Text Light');
    if (key === '#FFFFFF' || key === '#FFF') {
        return doc.swatches.itemByName('Paper');
    }
    if (key === '#000000') return doc.swatches.itemByName('Black');
    return ensureHexSwatch(doc, hex, cache);
}
