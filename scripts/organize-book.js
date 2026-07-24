#!/usr/bin/env node
// Organize finished spreads into book order.
// Builds ~/Downloads/finished spreads/_book/ with copies named so an
// alphabetical sort IS the book order (pack numbering = book order).
// Where both a full spread and a split-pair version exist, both are
// included with clear labels so Josh can pick per subject.

const fs = require('fs');
const path = require('path');
const os = require('os');

const gen = fs.readFileSync(path.join(__dirname, 'generate-from-pack.js'), 'utf8')
  .replace(/async function main[\s\S]*$/, 'module.exports = { SECTION_NAMES };');
const tmp = path.join(os.tmpdir(), 'gfp-organize-lib.js');
fs.writeFileSync(tmp, gen);
const { SECTION_NAMES } = require(tmp);

const SRC = path.join(os.homedir(), 'Downloads', 'finished spreads');
const OUT = path.join(SRC, '_book');

fs.mkdirSync(OUT, { recursive: true });
// Clear previous contents so removed/renamed spreads don't linger.
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const titleOf = (folder) => (SECTION_NAMES[folder] || folder).replace(/[\/:]/g, '-').replace(/\s+/g, ' ').trim();
const numOf = (folder) => folder.slice(0, 2);

const files = fs.readdirSync(SRC).filter(f => /\.(jpe?g|png)$/i.test(f));
const entries = [];
for (const f of files) {
  const base = f.replace(/\.\w+$/, '');
  const ext = f.match(/\.\w+$/)[0];
  const pair = base.match(/^(\d\d_[a-z0-9_]+)\+(\d\d_[a-z0-9_]+)$/);
  if (pair && SECTION_NAMES[pair[1]] && SECTION_NAMES[pair[2]]) {
    entries.push({
      sort: `${numOf(pair[1])}a`,
      name: `${numOf(pair[1])}-${numOf(pair[2])} ${titleOf(pair[1])} + ${titleOf(pair[2])} (split spread)${ext}`,
      src: f,
    });
  } else if (SECTION_NAMES[base]) {
    entries.push({
      sort: `${numOf(base)}b`,
      name: `${numOf(base)} ${titleOf(base)}${ext}`,
      src: f,
    });
  }
}

entries.sort((a, b) => a.sort.localeCompare(b.sort));
for (const e of entries) {
  fs.copyFileSync(path.join(SRC, e.src), path.join(OUT, e.name));
  console.log(e.name);
}
console.log(`\n${entries.length} spreads organized into ${OUT}`);
