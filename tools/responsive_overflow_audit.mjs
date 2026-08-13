import { chromium } from 'playwright';

const BASE = process.env.FRONTEND || 'http://127.0.0.1:8085';
const pages = process.argv.slice(2).length ? process.argv.slice(2) : [
  'index.html',
  'about/clients.html',
  'support/faq.html',
  'about/methodology.html',
  'about/why-choose-us.html',
];
const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '360', width: 360, height: 800 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '414', width: 414, height: 896 },
  { name: '768', width: 768, height: 1024 },
  { name: '900', width: 900, height: 1200 },
  { name: '980', width: 980, height: 1200 },
  { name: '1024', width: 1024, height: 1200 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 992, hasTouch: viewport.width < 992, deviceScaleFactor: 1 });
  for (const path of pages) {
    const page = await context.newPage();
    await page.goto(`${BASE}/${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(120);
    const result = await page.evaluate(() => {
      const viewport = window.innerWidth;
      const rootWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const isVisible = (element, style) => {
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
      };
      const all = [...document.querySelectorAll('body *')]
        .filter(element => !element.closest('.partners-ticker, .partners-ticker-wrap, .ticker-viewport'))
        .map(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || '',
            classes: [...element.classList].slice(0, 4).join('.'),
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
            position: style.position,
            overflowX: style.overflowX,
            transform: style.transform,
            text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            visible: isVisible(element, style),
          };
        })
        .filter(item => item.visible && (item.left < -1 || item.right > viewport + 1))
        .filter(item => !['fixed', 'sticky'].includes(item.position))
        .sort((a, b) => Math.max(b.right - viewport, -b.left) - Math.max(a.right - viewport, -a.left));
      const focus = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { selector, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      };
      return {
        viewport,
        rootWidth,
        horizontalOverflow: rootWidth > viewport + 1,
        offenders: all.slice(0, 10),
        focus: {
          cta: focus('.cta-banner, .cta-blue, .contact-cta, [class*="cta"]'),
          footer: focus('footer'),
          logo: focus('footer .brand-logo, footer [class*="logo"]'),
          youtube: focus('footer a[aria-label="YouTube"]'),
          socials: focus('footer .socials, footer .g-social'),
        },
      };
    });
    if (result.horizontalOverflow || result.offenders.length) failures.push({ viewport: viewport.name, path, ...result });
    console.log(`${viewport.name} ${path}: root=${result.rootWidth}/${result.viewport}; offenders=${result.offenders.length}`);
    await page.close();
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
