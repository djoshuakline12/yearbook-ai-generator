// ImportYearbook.jsx — main entry point for the AI Yearbook → InDesign importer.
//
// HOW TO RUN:
//   1. In InDesign 2024+, open Window → Utilities → Scripts.
//   2. Right-click the Scripts panel → Reveal in Finder → drop this folder
//      (the whole `indesign/` directory) into your User Scripts folder, OR
//      just double-click this file from a Finder window.
//   3. The script will prompt you to select an export bundle folder.
//
// REQUIRED FILE STRUCTURE in the bundle:
//   manifest.json
//   spreads/{NNN}-{slug}.json
//   links/{NNN}-photo-{i}.jpg (and _bw.jpg variants)
//
// Generate bundles with: `npm run export:indesign -- --all --batch "my-yearbook"`.

#target indesign

#include "lib/json2.js"
#include "lib/utils.jsx"
#include "lib/colors.jsx"
#include "lib/doc.jsx"
#include "lib/styles.jsx"
#include "lib/photo.jsx"
#include "lib/elements.jsx"

(function () {
    'use strict';

    function main() {
        // 1. Pick the bundle folder.
        var folder = Folder.selectDialog('Choose yearbook export bundle folder');
        if (!folder) return;

        // 2. Read manifest.
        var manifestFile = new File(folder.fsName + '/manifest.json');
        if (!manifestFile.exists) {
            alert('manifest.json not found in:\n' + folder.fsName +
                  '\n\nMake sure you picked the bundle folder (not its parent).');
            return;
        }
        var manifest = readJsonFile(manifestFile);
        if (!manifest) {
            alert('Could not parse manifest.json. See log for details.');
            return;
        }

        // 3. Check fonts.
        var missingFonts = checkFonts(manifest.fontsRequired || []);
        if (missingFonts.length > 0) {
            var proceed = confirm(
                'Missing fonts: ' + missingFonts.join(', ') +
                '\n\nInDesign will substitute. You can install the fonts and ' +
                'refresh styles afterward. Continue?'
            );
            if (!proceed) return;
        }

        // 4. Create the document.
        var doc;
        try {
            doc = createDocument(manifest.documentSetup);
        } catch (e) {
            alert('Failed to create document: ' + e.message);
            ybLog('createDocument error: ' + e.message);
            ybLogFlush(folder);
            return;
        }

        // 5. Set up swatches + styles.
        $.global.YB_SWATCH_CACHE = {};
        setupSwatches(doc, manifest.theme);
        setupParagraphStyles(doc, manifest.theme);
        setupCharacterStyles(doc, manifest.theme);

        // 6. For each spread, place elements.
        var spreads = manifest.spreads || [];
        var errors = [];
        var placedCount = 0;

        for (var i = 0; i < spreads.length; i++) {
            var meta = spreads[i];
            try {
                var spreadFile = new File(folder.fsName + '/' + meta.layoutFile);
                if (!spreadFile.exists) {
                    errors.push('Spread ' + meta.index + ': layout file missing - ' + meta.layoutFile);
                    continue;
                }
                var spreadJson = readJsonFile(spreadFile);
                if (!spreadJson) {
                    errors.push('Spread ' + meta.index + ': layout JSON unreadable');
                    continue;
                }

                var pages = addPagesForSpread(doc, meta.pageType, i);
                var layer = ensureLayer(doc, makeLayerName(meta.index, meta.section));

                // Sort elements by zIndex (back-to-front).
                var elements = (spreadJson.layout && spreadJson.layout.elements) || [];
                var sorted = elements.slice();
                sorted.sort(function (a, b) {
                    return (a.zIndex || 0) - (b.zIndex || 0);
                });

                for (var j = 0; j < sorted.length; j++) {
                    var el = sorted[j];
                    var renderer = ELEMENT_RENDERERS[el.type];
                    if (!renderer) {
                        ybLog('Spread ' + meta.index + ': unknown element type "' + el.type + '"');
                        continue;
                    }
                    try {
                        renderer(doc, pages, el, meta.index, folder, layer, j);
                        placedCount++;
                    } catch (e) {
                        ybLog('Spread ' + meta.index + ' element ' + j + ' [' + el.type + '] error: ' + e.message);
                    }
                }
            } catch (e) {
                errors.push('Spread ' + meta.index + ' fatal: ' + e.message);
            }
        }

        // 7. Save.
        var savePath = folder.fsName + '/yearbook-import.indd';
        try {
            doc.save(new File(savePath));
        } catch (e) {
            ybLog('save failed: ' + e.message);
        }

        // 8. Report results.
        ybLogFlush(folder);
        var summary = 'Yearbook import complete.\n\n' +
            'Spreads: ' + spreads.length + '\n' +
            'Elements placed: ' + placedCount + '\n' +
            'Errors: ' + errors.length + '\n' +
            'Missing fonts: ' + missingFonts.length + '\n\n' +
            'Document saved to:\n' + savePath + '\n\n' +
            'Log file: ' + folder.fsName + '/indesign-import-log.txt';
        alert(summary);
    }

    // Wrap in a try/catch so we surface any unexpected error.
    try {
        main();
    } catch (e) {
        alert('Importer crashed: ' + e.message);
        ybLog('FATAL: ' + e.message);
    }
})();
