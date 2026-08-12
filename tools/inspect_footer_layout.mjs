import { chromium } from 'playwright';

const BASE = process.env.FRONTEND || 'http://127.0.0.1:8085';
const target = process.argv[2] || 'about/clients.html';
const width = Number(process.argv[3] || 720);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height: 1280 } });
await page.goto(`${BASE}/${target}`, { waitUntil: 'networkidle' });
const report = await page.evaluate(() => {
  const rect = selector => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const r = element.getBoundingClientRect();
    const s = getComputedStyle(element);
    return { selector, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), display: s.display, gridTemplateColumns: s.gridTemplateColumns, direction: s.direction, justifyContent: s.justifyContent };
  };
  return {
    viewport: window.innerWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    grid: rect('.site-footer .footer-grid, .footer-grid'),
    brand: rect('.footer-brand-col'),
    social: rect('.footer-brand-col .socials, .g-brand .g-social, .socials, .g-social'),
    firstSocial: rect('.footer-brand-col .socials a, .g-brand .g-social a, .socials a, .g-social a'),
    footerMain: rect('.footer-main'),
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
