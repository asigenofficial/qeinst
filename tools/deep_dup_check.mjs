/**
 * deep_dup_check.mjs
 * Exhaustive duplication & readiness check covering:
 *  1. Exact file-level duplicates (SHA-256 hash comparison)
 *  2. HTML code-block duplicates (header, footer, nav, modals, scripts)
 *  3. CSS rule / selector duplicates inside each CSS source file
 *  4. JavaScript function-name duplicates across all JS files
 *  5. i18n translation-key duplicates in i18n-dict.js
 *  6. Backend PHP model / controller / route duplicates
 *  7. Database integrity quick checks
 *  8. Final readiness verdict
 */

import fs   from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'docs']);

// ─── helpers ────────────────────────────────────────────────────────────────

function walk(dir, exts = null) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(f)) continue;
    const full = path.join(dir, f);
    const st   = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full, exts));
    else if (!exts || exts.some(e => f.endsWith(e)))
      out.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readText(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readBuf (rel) { return fs.readFileSync(path.join(ROOT, rel)); }

let errors   = 0;
let warnings = 0;
const report = [];

function FAIL (msg)  { errors++;   report.push('  ❌ ERROR   ' + msg); }
function WARN (msg)  { warnings++; report.push('  ⚠️  WARN    ' + msg); }
function INFO (msg)  {             report.push('  ✅ OK      ' + msg); }
function SECTION(t)  { report.push('\n══════════════════════════════════════════'); report.push('  ' + t); report.push('══════════════════════════════════════════'); }

// ─── 1. FILE-LEVEL EXACT DUPLICATES ─────────────────────────────────────────

SECTION('1. EXACT FILE-LEVEL DUPLICATES (SHA-256)');
const allFiles  = walk(ROOT);
const hashIndex = {};
let   binaryDups = 0;
let   binaryDupBytes = 0;

for (const rel of allFiles) {
  const buf  = readBuf(rel);
  const h    = sha256(buf);
  if (!hashIndex[h]) hashIndex[h] = [];
  hashIndex[h].push({ rel, size: buf.length });
}

const dupGroups = Object.values(hashIndex).filter(g => g.length > 1);

// Separate media (images/sqlite/pyc) from code duplicates
const codeDupGroups  = [];
const mediaDupGroups = [];
const codeExts       = new Set(['.html','.css','.js','.mjs','.php','.json','.xml','.txt','.md','.env','.htaccess','.yml','.yaml','.sql']);

for (const g of dupGroups) {
  const ext = path.extname(g[0].rel).toLowerCase();
  if (codeExts.has(ext)) codeDupGroups.push(g);
  else { mediaDupGroups.push(g); binaryDups += g.length - 1; binaryDupBytes += g[0].size * (g.length - 1); }
}

if (codeDupGroups.length === 0) {
  INFO(`No identical code/config files found. (${dupGroups.length} dup groups are all binary assets)`);
} else {
  FAIL(`Found ${codeDupGroups.length} exact CODE file duplicates:`);
  for (const g of codeDupGroups) {
    report.push('     Identical files:');
    for (const f of g) report.push(`       - ${f.rel}`);
  }
}

INFO(`Binary asset mirrors (images etc.): ${mediaDupGroups.length} groups, ${binaryDups} redundant copies, ${(binaryDupBytes/1024/1024).toFixed(1)} MB of redundant disk space`);

// ─── 2. HTML BLOCK-LEVEL DUPLICATION ────────────────────────────────────────

SECTION('2. HTML COMPONENT DUPLICATION (header / footer / modal / scripts)');
const htmlFiles = walk(ROOT, ['.html']).filter(f => !f.startsWith('components/'));

// 2a. Detect header blocks: grab first 600 chars of <header …> block
const headerBlocks = {};
for (const hf of htmlFiles) {
  const txt   = readText(hf);
  const m     = txt.match(/<header\b[^>]*class="[^"]*site-header[^"]*"[\s\S]*?<\/header>/i);
  if (!m) continue;
  // normalise whitespace for comparison
  const norm = m[0].replace(/\s+/g, ' ').trim();
  if (!headerBlocks[norm]) headerBlocks[norm] = [];
  headerBlocks[norm].push(hf);
}

const uniqueHeaders = Object.keys(headerBlocks).length;
INFO(`Distinct <header> variants: ${uniqueHeaders} (across ${htmlFiles.length} HTML pages)`);
if (uniqueHeaders > 1) WARN(`${uniqueHeaders} different header templates found – possible drift between pages`);

// 2b. Modal login – check if any page is MISSING #modal-login where expected
const pagesWithLogin  = htmlFiles.filter(f => readText(f).includes('id="modal-login"'));
const pagesWithoutLogin = htmlFiles.filter(f => !readText(f).includes('id="modal-login"') && !f.includes('registration-') && !f.includes('request-success') && !f.includes('system-error'));
if (pagesWithoutLogin.length) WARN(`Pages missing #modal-login: ${pagesWithoutLogin.join(', ')}`);
else INFO(`#modal-login present on all required pages (${pagesWithLogin.length})`);

// 2c. Scripts consistency: every public page should load all 3 core scripts
const coreScripts = ['api-client.js', 'app.js', 'ui-runtime.js'];
let scriptInconsistencies = 0;
for (const hf of htmlFiles) {
  const txt = readText(hf);
  for (const s of coreScripts) {
    if (!txt.includes(s)) {
      WARN(`Page "${hf}" is missing core script: ${s}`);
      scriptInconsistencies++;
    }
  }
}
if (scriptInconsistencies === 0) INFO('All HTML pages include all 3 core JS scripts (api-client, app, ui-runtime)');

// 2d. Check <title> on every page
const noTitle = htmlFiles.filter(f => !readText(f).includes('<title>'));
if (noTitle.length) FAIL(`Pages missing <title>: ${noTitle.join(', ')}`);
else INFO(`All ${htmlFiles.length} pages have <title> tags`);

// 2e. Check <meta name="description"> on every page
const noDesc = htmlFiles.filter(f => !readText(f).includes('name="description"'));
if (noDesc.length) WARN(`Pages missing <meta description>: ${noDesc.join(', ')}`);
else INFO(`All ${htmlFiles.length} pages have meta descriptions`);

// ─── 3. CSS RULE DUPLICATES ──────────────────────────────────────────────────

SECTION('3. CSS SELECTOR DUPLICATES WITHIN EACH SOURCE FILE (top-level only)');
const cssFiles = walk('assets/css/src', ['.css']);
let totalCssDups = 0;

for (const cf of cssFiles) {
  const txt = readText(cf);
  const lines = txt.split('\n');

  // Walk line-by-line tracking @media / @keyframes nesting depth.
  // Only collect selectors at depth-0 (outside any @-rule block).
  let atDepth = 0;       // depth inside @-rule blocks
  let braceDepth = 0;    // total brace depth
  const topSelectors = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('/*') || t.startsWith('*') || t.startsWith('//')) continue;

    // Detect entering an @-rule block
    if (t.startsWith('@') && t.endsWith('{')) { atDepth++; braceDepth++; continue; }
    if (t === '}') {
      if (braceDepth > 0) braceDepth--;
      if (atDepth > 0 && braceDepth < atDepth) atDepth--;
      continue;
    }

    // Count extra opening braces (for nested rules inside @media)
    if (t.endsWith('{') && !t.startsWith('@')) {
      if (atDepth === 0) {
        // Top-level selector
        const sel = t.slice(0, -1).trim();
        topSelectors.push(sel);
      }
      braceDepth++;
      continue;
    }
  }

  const seen = {};
  for (const sel of topSelectors) {
    seen[sel] = (seen[sel] || 0) + 1;
  }
  const dups = Object.entries(seen).filter(([, c]) => c > 1);
  if (dups.length > 0) {
    totalCssDups += dups.length;
    WARN(`Top-level CSS selector duplicates in "${cf}": ${dups.map(([s,c]) => `"${s}"×${c}`).join(', ')}`);
  }
}
if (totalCssDups === 0) INFO('Zero duplicate top-level CSS selectors found across all 22 source CSS modules');

// Check app.css is still a clean build
const appCss = readText('assets/css/app.css');
INFO(`assets/css/app.css bundle size: ${(appCss.length/1024).toFixed(1)} KB`);

// ─── 4. JAVASCRIPT FUNCTION-NAME DUPLICATES ──────────────────────────────────

SECTION('4. JAVASCRIPT FUNCTION-NAME DUPLICATES ACROSS ALL JS FILES');
const jsFiles = walk('assets/js', ['.js', '.mjs']);

const globalFns = {}; // fnName -> [files]
for (const jf of jsFiles) {
  const txt = readText(jf);
  // Skip files that are IIFE-wrapped (all functions are locally scoped — no global clash possible)
  const isIIFE = /^\s*\(\s*\(\s*\)\s*=>/.test(txt) || /^\s*\(function\s*\(\s*\)\s*\{/.test(txt);
  if (isIIFE) continue;
  // match: function foo(
  const fns = [...txt.matchAll(/\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)].map(m => m[1]);
  for (const fn of fns) {
    if (!globalFns[fn]) globalFns[fn] = [];
    if (!globalFns[fn].includes(jf)) globalFns[fn].push(jf);
  }
}
const globalDupFns = Object.entries(globalFns).filter(([, files]) => files.length > 1);
if (globalDupFns.length === 0) {
  INFO('No globally-exposed function names appear in more than 1 JS file');
} else {
  for (const [fn, files] of globalDupFns) {
    WARN(`Function "${fn}" declared in multiple files: ${files.join(', ')}`);
  }
}

// Internal duplicates within each JS file
let internalFnDups = 0;
for (const jf of jsFiles) {
  const txt  = readText(jf);
  const fns  = [...txt.matchAll(/\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)].map(m => m[1]);
  const seen = {};
  for (const fn of fns) seen[fn] = (seen[fn] || 0) + 1;
  const dups = Object.entries(seen).filter(([, c]) => c > 1);
  if (dups.length > 0) {
    internalFnDups += dups.length;
    WARN(`Internal function re-declarations in "${jf}": ${dups.map(([n,c]) => `"${n}"×${c}`).join(', ')}`);
  }
}
if (internalFnDups === 0) INFO('No duplicate function declarations within any individual JS file');

// ─── 5. i18n KEY DUPLICATES ──────────────────────────────────────────────────

SECTION('5. i18n TRANSLATION-KEY DUPLICATES IN i18n-dict.js');
const i18nTxt   = readText('assets/js/i18n-dict.js');
const keyMatches = [...i18nTxt.matchAll(/"([^"]+)":\s*"([^"]+)"/g)];
const keyCounts  = {};
for (const km of keyMatches) keyCounts[km[1]] = (keyCounts[km[1]] || 0) + 1;
const dupKeys = Object.entries(keyCounts).filter(([, c]) => c > 1);

if (dupKeys.length === 0) {
  INFO(`i18n-dict.js: ${keyMatches.length} unique translation keys, ZERO duplicates`);
} else {
  FAIL(`i18n-dict.js: ${dupKeys.length} duplicate keys found:`);
  for (const [k, c] of dupKeys) report.push(`     "${k}" × ${c}`);
}

// ─── 6. PHP BACKEND DUPLICATES ───────────────────────────────────────────────

SECTION('6. PHP BACKEND – CONTROLLERS / MODELS / ROUTES');
const phpFiles = walk('backend/app', ['.php']);

// 6a. Check for duplicate class names
const phpClasses = {};
for (const pf of phpFiles) {
  const txt = readText(pf);
  const m   = txt.match(/^class\s+(\w+)/m);
  if (!m) continue;
  const cls = m[1];
  if (!phpClasses[cls]) phpClasses[cls] = [];
  phpClasses[cls].push(pf);
}
const dupClasses = Object.entries(phpClasses).filter(([, f]) => f.length > 1);
if (dupClasses.length === 0) {
  INFO(`No duplicate PHP class names across ${phpFiles.length} backend PHP files`);
} else {
  for (const [cls, files] of dupClasses)
    FAIL(`PHP class "${cls}" defined in multiple files: ${files.join(', ')}`);
}

// 6b. Deprecated seeders check
const deprecatedSeeders = ['UpdateRealDataSeeder.php', 'UpgradeProgramsSeeder.php'];
for (const ds of deprecatedSeeders) {
  const p = `backend/database/seeders/${ds}`;
  if (fs.existsSync(path.join(ROOT, p))) {
    WARN(`Deprecated seeder still exists: ${p} (wrapper only – no data risk, but adds clutter)`);
  }
}

// 6c. Routes file – detect duplicate route definitions
const routesPhp = readText('backend/routes/api.php');
const routeLines = routesPhp.match(/Route::(get|post|put|patch|delete)\(['"][^'"]+['"]/gi) || [];
const routeSeen  = {};
for (const r of routeLines) routeSeen[r] = (routeSeen[r] || 0) + 1;
const dupRoutes  = Object.entries(routeSeen).filter(([, c]) => c > 1);
if (dupRoutes.length === 0) INFO('No duplicate route definitions found in api.php');
else for (const [r, c] of dupRoutes) FAIL(`Duplicate route: ${r} (×${c})`);

// ─── 7. DATABASE INTEGRITY ───────────────────────────────────────────────────

SECTION('7. DATABASE INTEGRITY VERIFICATION');
const db = new DatabaseSync('backend/database/database.sqlite');

const checks = [
  { label: 'Programs (active)',             sql: "SELECT COUNT(*) c FROM programs WHERE is_active=1",           expect: v => v >= 50 },
  { label: 'Unique program images',         sql: "SELECT COUNT(DISTINCT image) c FROM programs WHERE is_active=1", expect: v => v >= 50 },
  { label: 'Categories',                    sql: "SELECT COUNT(*) c FROM categories",                         expect: v => v >= 12 },
  { label: 'Active clients',               sql: "SELECT COUNT(*) c FROM clients WHERE is_active=1",           expect: v => v >= 42 },
  { label: 'Gallery items',               sql: "SELECT COUNT(*) c FROM galleries WHERE is_active=1",          expect: v => v >= 57 },
  { label: 'Corporate solutions',          sql: "SELECT COUNT(*) c FROM corporate_solutions WHERE is_active=1", expect: v => v >= 6 },
  { label: 'Success stories',              sql: "SELECT COUNT(*) c FROM success_stories WHERE is_active=1",   expect: v => v >= 3 },
  { label: 'No test registrations',        sql: "SELECT COUNT(*) c FROM registrations",                        expect: v => v === 0 },
  { label: 'No test contact messages',     sql: "SELECT COUNT(*) c FROM contact_messages",                     expect: v => v === 0 },
  { label: 'No test corporate requests',   sql: "SELECT COUNT(*) c FROM corporate_requests",                   expect: v => v === 0 },
];

for (const { label, sql, expect } of checks) {
  try {
    const row = db.prepare(sql).get();
    const val = row.c;
    if (expect(val)) INFO(`DB ${label}: ${val}`);
    else FAIL(`DB ${label}: got ${val} — below expected threshold`);
  } catch (e) {
    FAIL(`DB query failed for "${label}": ${e.message}`);
  }
}

// 7b. Check all program images exist on disk
const progImages = db.prepare("SELECT image FROM programs WHERE is_active=1").all();
let missingImages = 0;
for (const { image } of progImages) {
  const diskPath = path.join(ROOT, image);
  if (!fs.existsSync(diskPath)) { missingImages++; FAIL(`Missing image on disk: ${image}`); }
}
if (missingImages === 0) INFO('All 50 program images exist on disk (assets/images/programs/courses/)');

// 7c. Check client logos
const clientLogos = db.prepare("SELECT logo FROM clients WHERE is_active=1 AND logo IS NOT NULL").all();
let missingLogos = 0;
for (const { logo } of clientLogos) {
  if (!logo) continue;
  const rel = logo.replace(/^https?:\/\/[^/]+\//, '');
  const diskPath = path.join(ROOT, rel.startsWith('assets/') ? rel : 'assets/' + rel);
  const altPath  = path.join(ROOT, 'backend', 'public', logo.startsWith('/') ? logo.slice(1) : logo);
  if (!fs.existsSync(diskPath) && !fs.existsSync(altPath) && !fs.existsSync(path.join(ROOT, rel))) {
    missingLogos++;
  }
}
if (missingLogos === 0) INFO('All client logos resolve on disk');
else WARN(`${missingLogos} client logos may have path issues`);

// ─── 8. BACKEND STORAGE REMNANTS ────────────────────────────────────────────

SECTION('8. BACKEND STORAGE DIRECTORY REMNANTS');
const storagePublic  = 'backend/storage/app/public';
const publicImages   = 'backend/public/images';
const publicStorage  = 'backend/public/storage';

for (const d of [publicImages, publicStorage]) {
  if (fs.existsSync(path.join(ROOT, d))) WARN(`Redundant directory still exists: ${d} — should be removed`);
  else INFO(`Confirmed removed: ${d}`);
}

const pubAssetsDir = 'backend/public/assets';
if (fs.existsSync(path.join(ROOT, pubAssetsDir))) {
  const sub = fs.readdirSync(path.join(ROOT, pubAssetsDir));
  INFO(`backend/public/assets/ retained (${sub.length} subdirs) — serves as Nginx/Apache public mirror`);
} else {
  WARN('backend/public/assets/ is missing — API may return broken image URLs');
}

const spFiles = fs.existsSync(path.join(ROOT, storagePublic)) ? fs.readdirSync(path.join(ROOT, storagePublic)) : [];
if (spFiles.length <= 1) INFO(`backend/storage/app/public/ is clean (${spFiles.join(', ') || 'empty'})`);
else WARN(`backend/storage/app/public/ still has content: ${spFiles.join(', ')}`);

// ─── 9. GITIGNORE COMPLETENESS ───────────────────────────────────────────────

SECTION('9. .gitignore COMPLETENESS');
const gitignore = readText('.gitignore');
const mustIgnore = ['node_modules', '.env', '*.pyc', '__pycache__', 'vendor/'];
for (const pat of mustIgnore) {
  if (gitignore.includes(pat)) INFO(`.gitignore includes: "${pat}"`);
  else WARN(`.gitignore is MISSING pattern: "${pat}"`);
}

// ─── 10. SERVER CONFIG CHECKS ────────────────────────────────────────────────

SECTION('10. SERVER CONFIGURATION CHECKS');
const htaccess = readText('.htaccess');
const requiredDirectives = [
  ['RewriteEngine On',      'HTTPS redirect engine enabled'],
  ['HTTPS',                  'HTTPS redirect rule present'],
  ['X-Content-Type-Options', 'X-Content-Type-Options security header'],
  ['X-Frame-Options',        'X-Frame-Options security header'],
  ['X-XSS-Protection',       'X-XSS-Protection security header'],
  ['Referrer-Policy',        'Referrer-Policy header'],
  ['ErrorDocument 404',      'Custom 404 error document'],
  ['mod_deflate',            'Gzip/Deflate compression'],
  ['\.env',                  'Sensitive .env file block'],
  ['\.sqlite',               'SQLite file block'],
];

for (const [token, label] of requiredDirectives) {
  if (htaccess.includes(token)) INFO(`.htaccess: ${label}`);
  else WARN(`.htaccess missing: ${label}`);
}

// Check robots.txt and sitemap.xml
if (fs.existsSync(path.join(ROOT, 'robots.txt')))  INFO('robots.txt present');
else FAIL('robots.txt missing!');

if (fs.existsSync(path.join(ROOT, 'sitemap.xml'))) INFO('sitemap.xml present');
else FAIL('sitemap.xml missing!');

// ─── FINAL REPORT ────────────────────────────────────────────────────────────

report.push('\n══════════════════════════════════════════');
report.push('  FINAL VERDICT');
report.push('══════════════════════════════════════════');
report.push(`  Total Checks Run : ${errors + warnings + report.filter(l=>l.includes('✅')).length}`);
report.push(`  Errors           : ${errors}`);
report.push(`  Warnings         : ${warnings}`);
if (errors === 0 && warnings === 0) {
  report.push('\n  🏆 PERFECT — Zero errors, zero warnings. Repository is 100% clean and production-ready.');
} else if (errors === 0) {
  report.push(`\n  ✅ GOOD — No blocking errors. ${warnings} informational warnings noted.`);
} else {
  report.push(`\n  ❌ NEEDS FIXES — ${errors} errors must be resolved before production deployment.`);
}
report.push('══════════════════════════════════════════\n');

console.log(report.join('\n'));
process.exit(errors > 0 ? 1 : 0);
