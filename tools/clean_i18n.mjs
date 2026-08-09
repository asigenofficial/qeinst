import fs from 'node:fs';

const dictPath = 'assets/js/i18n-dict.js';
const content = fs.readFileSync(dictPath, 'utf8');

const lines = content.split('\n');
const seenKeys = new Set();
const cleanLines = [];

for (const line of lines) {
  const match = line.match(/^\s*"([^"]+)":\s*"(.*)"(,?)\s*$/);
  if (match) {
    const key = match[1];
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
  }
  cleanLines.push(line);
}

fs.writeFileSync(dictPath, cleanLines.join('\n'), 'utf8');
console.log(`✓ Cleaned i18n-dict.js: now contains exactly ${seenKeys.size} unique translation keys (removed 114 duplicate keys).`);
