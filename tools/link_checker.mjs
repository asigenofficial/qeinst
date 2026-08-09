import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const htmlFiles = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (['.git', 'node_modules', 'vendor', '.review-backup'].includes(f)) continue;
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (f.endsWith('.html')) htmlFiles.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
}
walk(ROOT);

console.log(`Checking internal links and navigation across ${htmlFiles.length} HTML files...\n`);

const brokenLinks = [];
const externalLinks = [];
const mailTelLinks = [];
const javascriptLinks = [];

const hrefRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["']/gi;

for (const htmlFile of htmlFiles) {
  const fullPath = path.join(ROOT, htmlFile);
  const content = fs.readFileSync(fullPath, 'utf8');

  let match;
  hrefRegex.lastIndex = 0;
  while ((match = hrefRegex.exec(content)) !== null) {
    const rawHref = match[1].trim();
    if (!rawHref || rawHref === '#') continue;
    if (rawHref.startsWith('#')) continue; // in-page anchor
    if (rawHref.startsWith('javascript:')) {
      javascriptLinks.push({ file: htmlFile, href: rawHref });
      continue;
    }
    if (rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      mailTelLinks.push({ file: htmlFile, href: rawHref });
      continue;
    }
    if (rawHref.startsWith('http://') || rawHref.startsWith('https://') || rawHref.startsWith('//')) {
      externalLinks.push({ file: htmlFile, href: rawHref });
      continue;
    }

    const cleanPath = rawHref.split('?')[0].split('#')[0];
    if (!cleanPath) continue;

    let targetPath;
    if (cleanPath.startsWith('/')) {
      targetPath = path.join(ROOT, cleanPath.slice(1));
    } else {
      targetPath = path.join(path.dirname(fullPath), cleanPath);
    }

    if (!fs.existsSync(targetPath)) {
      brokenLinks.push({
        file: htmlFile,
        href: rawHref,
        target: path.relative(ROOT, targetPath).replace(/\\/g, '/')
      });
    }
  }
}

console.log(`Audited internal links.`);
console.log(`Total External Links: ${externalLinks.length}`);
console.log(`Total Mailto/Tel Links: ${mailTelLinks.length}`);
console.log(`Total Javascript Void Links: ${javascriptLinks.length}`);
console.log(`Total Broken Internal Links: ${brokenLinks.length}`);

if (brokenLinks.length > 0) {
  console.log('\n--- BROKEN INTERNAL LINKS FOUND ---');
  brokenLinks.forEach(b => console.log(`[${b.file}] href="${b.href}" -> target not found: "${b.target}"`));
} else {
  console.log('\n✓ ALL internal page links across all HTML files resolve successfully!');
}
