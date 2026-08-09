import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const files = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (['.git', 'node_modules', 'vendor', '.review-backup', 'components'].includes(f)) continue;
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (f.endsWith('.html')) files.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
}
walk(ROOT);

console.log(`Auditing SEO, OpenGraph, Canonical, Favicon across ${files.length} public HTML pages:\n`);

const summary = {
  total: files.length,
  missingTitle: [],
  missingDesc: [],
  missingCanonical: [],
  missingOgTitle: [],
  missingOgDesc: [],
  missingOgImage: [],
  missingTwitter: [],
  missingFavicon: [],
};

for (const f of files) {
  const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
  
  // Title
  const titleM = c.match(/<title>([^<]*)<\/title>/i);
  const title = titleM ? titleM[1].trim() : '';

  // Description (any attribute order)
  const descM = c.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                c.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const desc = descM ? descM[1].trim() : '';

  // Canonical
  const canonM = c.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ||
                 c.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);
  const canonical = canonM ? canonM[1].trim() : '';

  // OpenGraph
  const ogTitleM = c.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
                   c.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  const ogDescM = c.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
                  c.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
  const ogImgM = c.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) ||
                 c.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);

  // Twitter Card
  const twitterM = c.match(/<meta\s+[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i) ||
                   c.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:card["']/i);

  // Favicon
  const favM = c.match(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i) ||
               c.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i);

  if (!title) summary.missingTitle.push(f);
  if (!desc) summary.missingDesc.push(f);
  if (!canonical) summary.missingCanonical.push(f);
  if (!ogTitleM) summary.missingOgTitle.push(f);
  if (!ogDescM) summary.missingOgDesc.push(f);
  if (!ogImgM) summary.missingOgImage.push(f);
  if (!twitterM) summary.missingTwitter.push(f);
  if (!favM) summary.missingFavicon.push(f);
}

console.log('--- AUDIT SUMMARY ---');
console.log(`Total Pages: ${summary.total}`);
console.log(`Missing <title>: ${summary.missingTitle.length} pages ${summary.missingTitle.length ? `(${summary.missingTitle.join(', ')})` : '✓ (0 missing)'}`);
console.log(`Missing <meta name="description">: ${summary.missingDesc.length} pages ${summary.missingDesc.length ? `(${summary.missingDesc.join(', ')})` : '✓ (0 missing)'}`);
console.log(`Missing <link rel="icon">: ${summary.missingFavicon.length} pages ${summary.missingFavicon.length ? `(${summary.missingFavicon.join(', ')})` : '✓ (0 missing)'}`);
console.log(`Missing <link rel="canonical">: ${summary.missingCanonical.length} pages`);
console.log(`Missing OpenGraph tags (og:title / og:image / og:description): ${summary.missingOgTitle.length} pages missing`);
console.log(`Missing Twitter Card tags: ${summary.missingTwitter.length} pages missing`);
