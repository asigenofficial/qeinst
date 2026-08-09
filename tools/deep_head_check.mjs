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

console.log(`Inspecting ${files.length} public HTML pages...\n`);
let allValid = true;

for (const f of files) {
  const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const title = (c.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  const hasDesc = /<meta\s+[^>]*name=["']description["']/i.test(c) || /<meta\s+[^>]*content=["'][^"']*["']\s+name=["']description["']/i.test(c);
  const hasFavicon = /<link\s+[^>]*rel=["'](?:shortcut )?icon["']/i.test(c) || /<link\s+[^>]*href=["'][^"']*["']\s+rel=["'](?:shortcut )?icon["']/i.test(c);
  const hasAppCss = /app\.css/i.test(c);
  const hasUiRuntime = /ui-runtime\.js/i.test(c);
  const hasApiClient = /api-client\.js/i.test(c);
  const hasAppJs = /app\.js/i.test(c);
  const hasI18n = /i18n-dict\.js/i.test(c);

  const status = {
    title: !!title.trim(),
    desc: hasDesc,
    favicon: hasFavicon,
    css: hasAppCss,
    uiRuntime: hasUiRuntime,
    apiClient: hasApiClient,
    appJs: hasAppJs,
    i18n: hasI18n
  };

  const missing = Object.entries(status).filter(([_, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.log(`❌ ${f} missing: ${missing.join(', ')}`);
    allValid = false;
  } else {
    console.log(`✓ ${f} -> Title: "${title.trim()}" | All assets & scripts present`);
  }
}

if (allValid) {
  console.log(`\n🎉 All ${files.length} public HTML pages have complete, valid title, description, favicon, CSS bundle, and core JS runtimes!`);
} else {
  console.log(`\n⚠️ Some pages are missing head elements.`);
}
