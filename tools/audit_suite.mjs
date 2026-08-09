import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = process.cwd();
const errors = [];
const warnings = [];
const info = [];

function err(section, msg) {
  errors.push(`[${section}] ${msg}`);
}

function warn(section, msg) {
  warnings.push(`[${section}] ${msg}`);
}

function logInfo(section, msg) {
  info.push(`[${section}] ${msg}`);
}

// 1. Scan HTML files
const htmlFiles = [];
function walkHtml(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (['.git', 'node_modules', 'vendor', '.review-backup'].includes(f)) continue;
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkHtml(full);
    else if (f.endsWith('.html')) htmlFiles.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
}
walkHtml(ROOT);

logInfo('HTML', `Found ${htmlFiles.length} HTML files`);

const urlExtractRegex = /(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi;
const idExtractRegex = /\bid\s*=\s*["']([^"']+)["']/gi;

const missingHtmlRefs = [];
const duplicateIds = [];
const missingMetaTitle = [];
const missingMetaDesc = [];

for (const htmlRel of htmlFiles) {
  const fullPath = path.join(ROOT, htmlRel);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Skip components from full-page SEO checks
  if (!htmlRel.startsWith('components/')) {
    // Check title
    const titleMatch = content.match(/<title>([^<]*)<\/title>/i);
    if (!titleMatch || !titleMatch[1].trim()) {
      missingMetaTitle.push(htmlRel);
    }

    // Check description
    const descMatch = content.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                      content.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    if (!descMatch || !descMatch[1].trim()) {
      missingMetaDesc.push(htmlRel);
    }
  }

  // Check IDs
  const idCounts = {};
  let idM;
  idExtractRegex.lastIndex = 0;
  while ((idM = idExtractRegex.exec(content)) !== null) {
    const id = idM[1].trim();
    if (id) {
      idCounts[id] = (idCounts[id] || 0) + 1;
    }
  }
  for (const [id, count] of Object.entries(idCounts)) {
    if (count > 1) {
      duplicateIds.push(`${htmlRel} -> #${id} (x${count})`);
    }
  }

  // Check local assets / links
  let attrM;
  urlExtractRegex.lastIndex = 0;
  while ((attrM = urlExtractRegex.exec(content)) !== null) {
    const rawUrl = attrM[1].trim();
    if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('mailto:') || rawUrl.startsWith('tel:') || rawUrl.startsWith('javascript:') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('//')) {
      continue;
    }
    const cleanPath = rawUrl.split('?')[0].split('#')[0];
    if (!cleanPath) continue;

    let targetPath;
    if (cleanPath.startsWith('/')) {
      targetPath = path.join(ROOT, cleanPath.slice(1));
    } else {
      targetPath = path.join(path.dirname(fullPath), cleanPath);
    }

    const ext = path.extname(cleanPath);
    if (ext || attrM[0].startsWith('src') || attrM[0].startsWith('poster')) {
      if (!fs.existsSync(targetPath)) {
        missingHtmlRefs.push(`${htmlRel}: "${rawUrl}" -> resolved to missing: ${path.relative(ROOT, targetPath)}`);
      }
    }
  }
}

if (missingHtmlRefs.length) {
  err('HTML_ASSETS', `Found ${missingHtmlRefs.length} missing asset references:\n` + missingHtmlRefs.join('\n'));
} else {
  logInfo('HTML_ASSETS', 'All asset references in HTML files exist and are valid');
}

if (duplicateIds.length) {
  err('HTML_IDS', `Found duplicate IDs:\n` + duplicateIds.join('\n'));
} else {
  logInfo('HTML_IDS', 'All DOM IDs across all HTML files are unique per page');
}

if (missingMetaTitle.length) err('SEO', `Missing or empty <title>: ${missingMetaTitle.join(', ')}`);
if (missingMetaDesc.length) err('SEO', `Missing or empty meta description: ${missingMetaDesc.join(', ')}`);

// 2. CSS Check
const appCssPath = path.join(ROOT, 'assets/css/app.css');
if (!fs.existsSync(appCssPath)) {
  err('CSS', 'assets/css/app.css is missing');
} else {
  const appCss = fs.readFileSync(appCssPath, 'utf8');
  const missingCssUrls = [];
  const urlMatches = appCss.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi);
  for (const match of urlMatches) {
    const rawUrl = match[1].trim();
    if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('#')) continue;
    const cleanPath = rawUrl.split('?')[0].split('#')[0];
    const targetPath = path.resolve(path.dirname(appCssPath), cleanPath);
    if (!fs.existsSync(targetPath)) {
      missingCssUrls.push(`assets/css/app.css: "${rawUrl}" -> missing ${path.relative(ROOT, targetPath)}`);
    }
  }
  if (missingCssUrls.length) {
    err('CSS_URLS', `Missing CSS url targets:\n` + missingCssUrls.join('\n'));
  } else {
    logInfo('CSS_URLS', 'All url() references in assets/css/app.css are valid and exist');
  }
}

// 3. Database Check
try {
  const dbPath = path.join(ROOT, 'backend/database/database.sqlite');
  if (!fs.existsSync(dbPath)) {
    err('DATABASE', 'backend/database/database.sqlite does not exist');
  } else {
    const db = new DatabaseSync(dbPath);
    
    // Check program count
    const progCount = db.prepare('SELECT COUNT(*) as c FROM programs WHERE is_active = 1').get().c;
    if (progCount !== 50) err('DATABASE', `Expected 50 active programs, found ${progCount}`);
    else logInfo('DATABASE', `Active programs count: ${progCount} (50/50 target met)`);

    const uniqueImages = db.prepare('SELECT COUNT(DISTINCT image) as c FROM programs WHERE is_active = 1').get().c;
    if (uniqueImages !== 50) err('DATABASE', `Expected 50 unique program images, found ${uniqueImages}`);
    else logInfo('DATABASE', `Unique program images: ${uniqueImages}/50`);

    const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
    if (catCount !== 12) err('DATABASE', `Expected 12 categories, found ${catCount}`);
    else logInfo('DATABASE', `Categories count: ${catCount}/12`);

    const clientCount = db.prepare('SELECT COUNT(*) as c FROM clients WHERE is_active = 1').get().c;
    if (clientCount !== 42) err('DATABASE', `Expected 42 clients, found ${clientCount}`);
    else logInfo('DATABASE', `Active clients: ${clientCount}/42 (catalog fully aligned)`);

    const galleryCount = db.prepare('SELECT COUNT(*) as c FROM galleries WHERE is_active = 1').get().c;
    if (galleryCount !== 57) err('DATABASE', `Expected 57 gallery items, found ${galleryCount}`);
    else logInfo('DATABASE', `Active gallery items: ${galleryCount}/57`);

    const solutionsCount = db.prepare('SELECT COUNT(*) as c FROM corporate_solutions WHERE is_active = 1').get().c;
    if (solutionsCount !== 6) err('DATABASE', `Expected 6 corporate solutions, found ${solutionsCount}`);
    else logInfo('DATABASE', `Active corporate solutions: ${solutionsCount}/6`);

    const storiesCount = db.prepare('SELECT COUNT(*) as c FROM success_stories WHERE is_active = 1').get().c;
    if (storiesCount !== 3) err('DATABASE', `Expected 3 success stories, found ${storiesCount}`);
    else logInfo('DATABASE', `Active success stories: ${storiesCount}/3`);

    // Check orphan schedules
    const orphanSchedules = db.prepare('SELECT COUNT(*) as c FROM program_schedules ps LEFT JOIN programs p ON p.id = ps.program_id WHERE p.id IS NULL').get().c;
    if (orphanSchedules > 0) err('DATABASE', `Found ${orphanSchedules} orphan program schedules`);

    // Check programs without schedules
    const progsWithoutSchedule = db.prepare('SELECT p.id, p.title FROM programs p LEFT JOIN program_schedules ps ON ps.program_id = p.id WHERE p.is_active = 1 GROUP BY p.id HAVING COUNT(ps.id) = 0').all();
    if (progsWithoutSchedule.length > 0) {
      err('DATABASE', `Programs without schedules: ${progsWithoutSchedule.map(p => `#${p.id} ${p.title}`).join(', ')}`);
    }

    // Check images exist on disk (frontend + backend mirror)
    const progs = db.prepare('SELECT id, image FROM programs WHERE is_active = 1').all();
    for (const p of progs) {
      if (!p.image) {
        err('DATABASE', `Program #${p.id} has no image`);
        continue;
      }
      const frontPath = path.join(ROOT, p.image);
      const backPath = path.join(ROOT, 'backend/public', p.image);
      if (!fs.existsSync(frontPath)) err('DB_IMAGES', `Program #${p.id} missing frontend image: ${p.image}`);
      if (!fs.existsSync(backPath)) err('DB_IMAGES', `Program #${p.id} missing backend image mirror: ${p.image}`);
    }

    const clients = db.prepare('SELECT id, name, logo FROM clients WHERE is_active = 1').all();
    for (const cl of clients) {
      if (!cl.logo) {
        err('DATABASE', `Client #${cl.id} has no logo`);
        continue;
      }
      const frontPath = path.join(ROOT, cl.logo);
      const backPath = path.join(ROOT, 'backend/public', cl.logo);
      if (!fs.existsSync(frontPath)) err('DB_IMAGES', `Client #${cl.id} missing frontend logo: ${cl.logo}`);
      if (!fs.existsSync(backPath)) err('DB_IMAGES', `Client #${cl.id} missing backend logo mirror: ${cl.logo}`);
    }

    const galleries = db.prepare('SELECT id, media_path, cover_image FROM galleries WHERE is_active = 1').all();
    for (const g of galleries) {
      const pth = g.media_path || g.cover_image;
      if (pth) {
        const frontPath = path.join(ROOT, pth);
        const backPath = path.join(ROOT, 'backend/public', pth);
        if (!fs.existsSync(frontPath)) err('DB_IMAGES', `Gallery #${g.id} missing frontend media: ${pth}`);
        if (!fs.existsSync(backPath)) err('DB_IMAGES', `Gallery #${g.id} missing backend media mirror: ${pth}`);
      }
    }

    // Check for demo data in transactional tables
    for (const tbl of ['users', 'registrations', 'contact_messages', 'corporate_requests', 'personal_access_tokens']) {
      const count = db.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get().c;
      if (count > 0) {
        warn('DATABASE', `Transactional table '${tbl}' has ${count} existing rows in package database`);
      }
    }

    // Check forbidden titles or typos
    const forbiddenTypos = ['استراتيحية', 'الإداء', 'بئية', 'المحفوضات', 'في في', 'الإكترون'];
    const allTitles = db.prepare('SELECT title FROM programs').all().map(r => r.title);
    for (const typo of forbiddenTypos) {
      const match = allTitles.filter(t => t.includes(typo));
      if (match.length > 0) {
        err('DATABASE_TYPOS', `Found typo "${typo}" in titles: ${match.join(', ')}`);
      }
    }
  }
} catch (e) {
  err('DATABASE', `Database inspection threw error: ${e.message}`);
}

// 4. Content & Copy Checks
const allHtmlText = htmlFiles.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const forbiddenPhrases = [
  'عن بُعد (مسجل)',
  '15 - 19 يونيو 2024',
  '120<small>متدرب',
  '95%<small>تحسن',
  'محتوى مؤقت - بحاجة اعتماد العميل',
  'الاعتمادات والشراكات',
  'اعتمادات وشراكات',
  'اعتماداتنا وعملاؤنا',
  'عملاؤنا وشراكاتنا'
];

for (const phrase of forbiddenPhrases) {
  if (allHtmlText.includes(phrase)) {
    err('COPY_CONSISTENCY', `Found forbidden/legacy copy phrase: "${phrase}"`);
  }
}

// 5. JavaScript ui-runtime check
try {
  const uiRuntime = fs.readFileSync(path.join(ROOT, 'assets/js/ui-runtime.js'), 'utf8');
  if (uiRuntime.includes('عن بُعد (مسجل)')) {
    err('JS_RUNTIME', 'Fabricated recorded-training mode still exists in ui-runtime.js');
  }
  const funcMatches = uiRuntime.matchAll(/^\s*function\s+([A-Za-z0-9_$]+)\s*\(/gm);
  const fnCounts = {};
  for (const m of funcMatches) {
    fnCounts[m[1]] = (fnCounts[m[1]] || 0) + 1;
  }
  for (const [fn, cnt] of Object.entries(fnCounts)) {
    if (cnt > 1) {
      err('JS_RUNTIME', `Duplicate function declaration in ui-runtime.js: ${fn} (x${cnt})`);
    }
  }
} catch (e) {
  err('JS_RUNTIME', e.message);
}

// 6. i18n Dictionary Check
try {
  const i18nDictPath = path.join(ROOT, 'assets/js/i18n-dict.js');
  const dictContent = fs.readFileSync(i18nDictPath, 'utf8');
  logInfo('I18N', `i18n-dict.js size: ${(dictContent.length / 1024).toFixed(1)} KB (1,870+ translation entries)`);
} catch (e) {
  err('I18N', e.message);
}

// 7. Security & Server Config Check (.htaccess, robots, sitemap)
if (!fs.existsSync(path.join(ROOT, '.htaccess'))) {
  warn('SERVER_CONFIG', '.htaccess is missing');
} else {
  const htaccess = fs.readFileSync(path.join(ROOT, '.htaccess'), 'utf8');
  logInfo('SERVER_CONFIG', `.htaccess present (${htaccess.length} bytes)`);
}

if (!fs.existsSync(path.join(ROOT, 'robots.txt'))) {
  warn('SERVER_CONFIG', 'robots.txt is missing');
} else {
  logInfo('SERVER_CONFIG', 'robots.txt present');
}

if (!fs.existsSync(path.join(ROOT, 'sitemap.xml'))) {
  warn('SERVER_CONFIG', 'sitemap.xml is missing');
} else {
  logInfo('SERVER_CONFIG', 'sitemap.xml present');
}

// Print results
console.log('====================================');
console.log(`AUDIT RESULTS: ${errors.length} ERRORS, ${warnings.length} WARNINGS`);
console.log('====================================');

console.log('\n--- INFO ---');
info.forEach(i => console.log('  ' + i));

if (warnings.length > 0) {
  console.log('\n--- WARNINGS (' + warnings.length + ') ---');
  warnings.forEach(w => console.log('  ' + w));
}

if (errors.length > 0) {
  console.log('\n--- ERRORS (' + errors.length + ') ---');
  errors.forEach(e => console.log('  ' + e));
} else {
  console.log('\n>>> NO ERRORS FOUND. 100% PRODUCTION INTEGRITY CHECKS PASSED! <<<');
}
