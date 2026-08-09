import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();

console.log('================================================================');
console.log('DEEP DUPLICATION ANALYSIS: FILES, CODE, LOGIC, AND ASSETS');
console.log('================================================================\n');

// 1. Scan All Files & Compute Hash Groups
const allFiles = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (['.git', 'node_modules', 'vendor'].includes(f)) continue;
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else allFiles.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
}
walk(ROOT);

const hashMap = {};
let totalBytes = 0;
for (const rel of allFiles) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  totalBytes += buf.length;
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  if (!hashMap[hash]) hashMap[hash] = [];
  hashMap[hash].push({ path: rel, size: buf.length });
}

const duplicateGroups = Object.values(hashMap).filter(list => list.length > 1);
let duplicateFilesCount = 0;
let wastedBytes = 0;

duplicateGroups.forEach(group => {
  duplicateFilesCount += (group.length - 1);
  wastedBytes += group[0].size * (group.length - 1);
});

console.log(`--- 1. File-Level Exact Duplicates ---`);
console.log(`Total Files in Repository: ${allFiles.length} (${(totalBytes / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`Duplicate File Groups: ${duplicateGroups.length}`);
console.log(`Redundant/Mirrored Duplicate Files: ${duplicateFilesCount} files`);
console.log(`Redundant Disk Space: ${(wastedBytes / (1024 * 1024)).toFixed(2)} MB\n`);

// Breakdown of duplicate categories:
const mediaMirrors = duplicateGroups.filter(g => g.some(f => f.path.startsWith('backend/storage') || f.path.startsWith('backend/public')));
console.log(`• Backend Storage & Public Mirror Duplicates: ${mediaMirrors.length} media groups`);

// 2. HTML Component Duplication Analysis
console.log(`\n--- 2. HTML Component & Boilerplate Duplication ---`);
const htmlFiles = allFiles.filter(f => f.endsWith('.html') && !f.startsWith('components/'));

let headerDups = 0;
let footerDups = 0;
let loginModalDups = 0;
let regModalDups = 0;
let skipLinkDups = 0;

for (const hf of htmlFiles) {
  const c = fs.readFileSync(path.join(ROOT, hf), 'utf8');
  if (c.includes('id="siteHeader"') || c.includes('class="site-header"')) headerDups++;
  if (c.includes('class="site-footer"') || c.includes('id="siteFooter"')) footerDups++;
  if (c.includes('id="modal-login"')) loginModalDups++;
  if (c.includes('id="modal-registration"')) regModalDups++;
  if (c.includes('class="qei-skip"')) skipLinkDups++;
}

console.log(`Across ${htmlFiles.length} standalone HTML pages:`);
console.log(`• Header Component: duplicated across ${headerDups} pages (100% self-contained static architecture)`);
console.log(`• Footer Component: duplicated across ${footerDups} pages`);
console.log(`• Login Modal (#modal-login): duplicated across ${loginModalDups} pages`);
console.log(`• Registration Modal (#modal-registration): present in ${regModalDups} pages`);
console.log(`• Accessibility Skip Link (.qei-skip): present in ${skipLinkDups} pages`);

// 3. JavaScript Helper & Logic Duplication Analysis
console.log(`\n--- 3. JavaScript Logic & Helper Duplication ---`);
const appJs = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
const uiRuntime = fs.readFileSync(path.join(ROOT, 'assets/js/ui-runtime.js'), 'utf8');
const apiClient = fs.readFileSync(path.join(ROOT, 'assets/js/api-client.js'), 'utf8');

const jsDuplications = [];
if (appJs.includes('QEI_ROOT') && uiRuntime.includes('const ROOT =')) {
  jsDuplications.push('Root Path Resolver: calculated independently in app.js (QEI_ROOT) and ui-runtime.js (ROOT) for modular encapsulation');
}
if (appJs.includes('qeiNormalizeText') && uiRuntime.includes('const norm =')) {
  jsDuplications.push('Arabic Text Normalization: implemented in app.js (qeiNormalizeText) and ui-runtime.js (norm)');
}
if (appJs.includes('qeiUrl') && uiRuntime.includes('const url =')) {
  jsDuplications.push('URL Resolution Helper: implemented in app.js (qeiUrl) and ui-runtime.js (url)');
}
if (appJs.includes('qeiEscapeHTML') && uiRuntime.includes('escapeHTML')) {
  jsDuplications.push('HTML Escaper: implemented in both files');
}

jsDuplications.forEach(d => console.log(`• ${d}`));

// 4. CSS Duplication (Source modules vs App bundle)
console.log(`\n--- 4. CSS Architecture Duplication ---`);
const cssSrcFiles = allFiles.filter(f => f.startsWith('assets/css/src/') && f.endsWith('.css'));
const appCss = fs.readFileSync(path.join(ROOT, 'assets/css/app.css'), 'utf8');
console.log(`• Source CSS Modules: ${cssSrcFiles.length} partial files in assets/css/src/`);
console.log(`• Compiled Production Bundle: assets/css/app.css (${(appCss.length / 1024).toFixed(1)} KB)`);
console.log(`  (Note: app.css is generated automatically via build-css.mjs to ensure 1 single network request in production)`);

// 5. i18n Dictionary Redundancy Check
console.log(`\n--- 5. i18n Dictionary Duplication & Redundancy ---`);
const i18nContent = fs.readFileSync(path.join(ROOT, 'assets/js/i18n-dict.js'), 'utf8');
const keyMatches = [...i18nContent.matchAll(/"([^"]+)":\s*"([^"]+)"/g)];
const keyCounts = {};
for (const km of keyMatches) {
  const k = km[1];
  keyCounts[k] = (keyCounts[k] || 0) + 1;
}
const duplicateKeys = Object.entries(keyCounts).filter(([_, count]) => count > 1);
console.log(`Total i18n Dictionary Entries: ${keyMatches.length}`);
console.log(`Duplicate Translation Keys in i18n-dict.js: ${duplicateKeys.length}`);
if (duplicateKeys.length > 0) {
  duplicateKeys.forEach(([k, c]) => console.log(`  - "${k}" (x${c})`));
} else {
  console.log(`✓ Zero duplicate translation keys in i18n-dict.js!`);
}

// 6. Backend / PHP / Seeders Duplication
console.log(`\n--- 6. Backend / Seeders Deprecated Duplication ---`);
const deprecatedSeeders = ['UpdateRealDataSeeder.php', 'UpgradeProgramsSeeder.php'];
deprecatedSeeders.forEach(s => {
  const p = path.join(ROOT, 'backend/database/seeders', s);
  if (fs.existsSync(p)) {
    console.log(`• Deprecated Compatibility Seeder: ${s} (wrapper calling WebsiteCatalogSeeder)`);
  }
});

// Leftover pycache
const pycacheFiles = allFiles.filter(f => f.includes('__pycache__') || f.endsWith('.pyc'));
if (pycacheFiles.length > 0) {
  console.log(`• Bytecode Cache Leftovers: ${pycacheFiles.join(', ')}`);
}
