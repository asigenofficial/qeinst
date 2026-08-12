import { chromium } from 'playwright';

const BASE = process.env.FRONTEND || 'http://127.0.0.1:8085';
const pages = [
  'about/about.html',
  'about/clients.html',
  'gallery/gallery.html',
  'policies/policies.html',
  'registration/registration-success.html',
];
const viewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '768x1024', width: 768, height: 1024 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  for (const pagePath of pages) {
    const page = await context.newPage();
    await page.goto(`${BASE}/${pagePath}`, { waitUntil: 'networkidle' });

    const closed = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      socialWidth: Math.max(...[...document.querySelectorAll('.socials, .g-social')].map(el => el.getBoundingClientRect().width), 0),
    }));
    if (closed.documentWidth > closed.viewport + 1) failures.push(`${viewport.name} ${pagePath}: closed document width ${closed.documentWidth}/${closed.viewport}`);
    if (closed.socialWidth > closed.viewport + 1) failures.push(`${viewport.name} ${pagePath}: social container width ${closed.socialWidth}/${closed.viewport}`);

    const menu = page.locator('#mobileMenuBtn');
    if (viewport.width < 992 && await menu.count()) {
      await menu.click();
      const open = await page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        isOpen: document.querySelector('#mainNav')?.classList.contains('open') || false,
      }));
      if (!open.isOpen) failures.push(`${viewport.name} ${pagePath}: mobile drawer did not open`);
      if (open.documentWidth > open.viewport + 1) failures.push(`${viewport.name} ${pagePath}: open drawer width ${open.documentWidth}/${open.viewport}`);
      await page.locator('.qei-drawer-close').click();
      const afterClose = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
      if (afterClose > viewport.width + 1) failures.push(`${viewport.name} ${pagePath}: close drawer width ${afterClose}/${viewport.width}`);
    }
    await page.close();
  }
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`PASS mobile footer + drawer regression: ${pages.length} pages × ${viewports.length} viewports`);
