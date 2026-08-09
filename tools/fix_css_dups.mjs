/**
 * fix_css_dups.mjs - Removes exact-duplicate CSS selector blocks
 * A "duplicate" here means the same top-level selector appears MORE THAN ONCE
 * in a flat section of the same file. We keep the LAST occurrence (so later
 * overrides win, consistent with the existing CSS cascade intent).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CSS_SRC = 'assets/css/src';

function walk(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else if (f.endsWith('.css')) out.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

// Simple line-by-line parser: track selector line numbers and their blocks
function removeDuplicateSelectors(content, filePath) {
  const lines = content.split('\n');
  // Map: selector string -> array of {startLine, endLine}
  const blocks = {}; // selector -> [{start,end}]
  let i = 0;
  let changes = 0;

  // First pass: identify all top-level selector blocks
  // We only remove plain top-level duplicates (not inside @media, @keyframes etc.)
  const selectorBlocks = []; // {selector, start, end}

  while (i < lines.length) {
    const line = lines[i];
    // Skip lines inside @media / @keyframes / @supports blocks (they start with @)
    const trimmed = line.trim();

    // Detect a selector line: ends with { but doesn't start with @ or }
    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*') &&
        !trimmed.startsWith('@') && !trimmed.startsWith('}') &&
        !trimmed.startsWith('/*') &&
        trimmed.endsWith('{')) {
      const selector = trimmed.slice(0, -1).trim();
      const start = i;
      // Find matching closing brace
      let depth = 1;
      let j = i + 1;
      while (j < lines.length && depth > 0) {
        const l = lines[j].trim();
        if (l.endsWith('{') && !l.startsWith('//')) depth++;
        if (l === '}' || l.startsWith('} ') || l === '};') depth--;
        j++;
      }
      selectorBlocks.push({ selector, start, end: j - 1 });
      i = j;
      continue;
    }
    i++;
  }

  // Find selectors that appear more than once
  const seen = {};
  for (const b of selectorBlocks) {
    if (!seen[b.selector]) seen[b.selector] = [];
    seen[b.selector].push(b);
  }

  // Lines to remove (keep last occurrence, remove earlier ones)
  const linesToRemove = new Set();
  for (const [sel, occurrences] of Object.entries(seen)) {
    if (occurrences.length < 2) continue;
    // Only remove if they have IDENTICAL content (true duplication, not intentional override)
    const contents = occurrences.map(o =>
      lines.slice(o.start, o.end + 1).join('\n').replace(/\s+/g, ' ').trim()
    );
    const allSame = contents.every(c => c === contents[0]);
    if (allSame) {
      // Remove all but the last
      for (const o of occurrences.slice(0, -1)) {
        for (let k = o.start; k <= o.end; k++) linesToRemove.add(k);
        changes++;
        console.log(`  Removed exact duplicate selector "${sel}" (lines ${o.start+1}-${o.end+1}) in ${filePath}`);
      }
    }
  }

  if (linesToRemove.size === 0) return { content, changes: 0 };

  const cleaned = lines.filter((_, idx) => !linesToRemove.has(idx)).join('\n');
  return { content: cleaned, changes };
}

const cssFiles = walk(CSS_SRC);
let totalFixed = 0;

for (const cf of cssFiles) {
  const original = fs.readFileSync(path.join(ROOT, cf), 'utf8');
  const { content, changes } = removeDuplicateSelectors(original, cf);
  if (changes > 0) {
    fs.writeFileSync(path.join(ROOT, cf), content, 'utf8');
    totalFixed += changes;
    console.log(`✓ Fixed ${changes} exact duplicate(s) in: ${cf}`);
  }
}

if (totalFixed === 0) {
  console.log('No exact duplicate CSS selectors found to remove.');
} else {
  console.log(`\nTotal exact duplicate blocks removed: ${totalFixed}`);
}
