import { chromium } from 'playwright';

const BASE = process.env.FRONTEND || 'http://127.0.0.1:8085';
const pages = process.argv.slice(2);
const targets = pages.length ? pages : [
  'about/about.html',
  'about/clients.html',
  'solutions/solutions.html',
  'policies/policies.html',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
for (const pagePath of targets) {
  const page = await context.newPage();
  await page.goto(`${BASE}/${pagePath}`, { waitUntil: 'networkidle' });
  const report = await page.evaluate(() => {
    const viewport = window.innerWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const offenders = [...document.querySelectorAll('body *')]
      .map(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id,
          classes: [...el.classList].slice(0, 4).join('.'),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 64),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          display: style.display,
          position: style.position,
        };
      })
      .filter(item => item.display !== 'none' && item.width > 0 && (item.left < -1 || item.right > viewport + 1))
      .sort((a, b) => Math.max(b.right - viewport, -b.left) - Math.max(a.right - viewport, -a.left))
      .slice(0, 20);
    return { viewport, documentWidth, horizontalOverflow: documentWidth > viewport + 1, offenders };
  });
  console.log(`\n${pagePath}`);
  console.log(JSON.stringify(report, null, 2));
  await page.close();
}
await browser.close();
