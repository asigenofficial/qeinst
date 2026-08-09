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

console.log(`Checking script inclusions across ${files.length} HTML files...\n`);

let updatedCount = 0;

for (const f of files) {
  const fullPath = path.join(ROOT, f);
  let content = fs.readFileSync(fullPath, 'utf8');
  const isRoot = !f.includes('/');
  const prefix = isRoot ? 'assets/js/' : '../assets/js/';

  const hasApiClient = content.includes('api-client.js');
  const hasAppJs = content.includes('app.js');
  const hasI18n = content.includes('i18n-dict.js');
  const hasUiRuntime = content.includes('ui-runtime.js');

  if (!hasApiClient && hasAppJs) {
    // Insert api-client.js right before app.js
    const appJsTag = content.match(new RegExp(`<script[^>]*src=["'][^"']*app\\.js[^"']*["'][^>]*>\\s*<\\/script>`, 'i'));
    if (appJsTag) {
      const apiTag = `<script src="${prefix}api-client.js"></script>\n\t`;
      content = content.replace(appJsTag[0], apiTag + appJsTag[0]);
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✓ Added api-client.js to: ${f}`);
      updatedCount++;
    }
  }
}

console.log(`\nUpdated ${updatedCount} HTML files.`);
