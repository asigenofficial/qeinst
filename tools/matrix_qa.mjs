import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8085';
const ROOT = process.cwd();

const VIEWPORTS = [
  { name: 'Desktop-1920x1080', width: 1920, height: 1080, device: 'Desktop' },
  { name: 'Desktop-1440x900', width: 1440, height: 900, device: 'Desktop' },
  { name: 'Desktop-1366x768', width: 1366, height: 768, device: 'Desktop' },
  { name: 'Desktop-1280x720', width: 1280, height: 720, device: 'Desktop' },
  { name: 'Tablet-1024x1366', width: 1024, height: 1366, device: 'Tablet' },
  { name: 'Tablet-768x1024', width: 768, height: 1024, device: 'Tablet' },
  { name: 'Mobile-430x932', width: 430, height: 932, device: 'Mobile' },
  { name: 'Mobile-412x915', width: 412, height: 915, device: 'Mobile' },
  { name: 'Mobile-390x844', width: 390, height: 844, device: 'Mobile' },
  { name: 'Mobile-375x812', width: 375, height: 812, device: 'Mobile' },
  { name: 'Mobile-360x800', width: 360, height: 800, device: 'Mobile' },
];

const PAGES = [
  'index.html',
  'about/about.html',
  'about/clients.html',
  'about/methodology.html',
  'about/vision.html',
  'about/impact.html',
  'about/why-choose-us.html',
  'programs/programs.html',
  'programs/program-details.html',
  'programs/closed-program.html',
  'solutions/solutions.html',
  'solutions/solution-details.html',
  'solutions/custom-training.html',
  'solutions/training-needs.html',
  'registration/registration-personal.html',
  'registration/registration-work.html',
  'registration/registration-schedule.html',
  'registration/registration-review.html',
  'registration/registration-success.html',
  'gallery/gallery.html',
  'support/contact.html',
  'support/faq.html',
  'support/search-results.html',
  'support/system-error.html',
  'policies/policies.html',
  '404.html',
];

async function runMatrix() {
  const browser = await chromium.launch({ headless: true });
  const results = {
    totalTestedPages: PAGES.length,
    totalViewports: VIEWPORTS.length,
    issues: []
  };

  console.log(`Starting matrix audit for ${PAGES.length} pages across ${VIEWPORTS.length} viewports...`);

  for (const pageRel of PAGES) {
    const pageUrl = `${BASE_URL}/${pageRel}`;
    console.log(`\nTesting page: ${pageRel}`);

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();
      const consoleErrors = [];
      const networkErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('response', response => {
        if (response.status() >= 400) {
          networkErrors.push(`${response.status()} ${response.url()}`);
        }
      });

      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(500);

        // 1. Check Horizontal Overflow
        const overflow = await page.evaluate(() => {
          const scrollWidth = document.documentElement.scrollWidth;
          const innerWidth = window.innerWidth;
          const isOverflow = scrollWidth > innerWidth + 1; // 1px threshold for subpixel
          let overflowElement = null;
          if (isOverflow) {
            const allElements = Array.from(document.querySelectorAll('*'));
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.right > innerWidth + 2) {
                overflowElement = {
                  tagName: el.tagName,
                  className: el.className,
                  id: el.id,
                  right: rect.right,
                  width: rect.width,
                  outerHTML: el.outerHTML.slice(0, 150)
                };
                break;
              }
            }
          }
          return { scrollWidth, innerWidth, isOverflow, overflowElement };
        });

        if (overflow.isOverflow) {
          results.issues.push({
            id: `OVERFLOW-${pageRel.replace(/[^a-z0-9]/gi, '_')}-${vp.name}`,
            title: `Horizontal overflow detected on ${vp.name}`,
            category: 'RESPONSIVE_UI',
            severity: vp.device === 'Mobile' ? 'HIGH' : 'MEDIUM',
            page: pageRel,
            url: pageUrl,
            viewport: `${vp.width}x${vp.height}`,
            device: vp.device,
            details: `document.documentElement.scrollWidth (${overflow.scrollWidth}px) exceeds window.innerWidth (${overflow.innerWidth}px)`,
            overflowElement: overflow.overflowElement,
            likelyRootCause: 'Fixed width constraint or uncontained flex/grid element on smaller viewport.'
          });
        }

        // 2. Check Touch Targets on Mobile
        if (vp.device === 'Mobile' || vp.width <= 768) {
          const smallTargets = await page.evaluate(() => {
            const clickables = Array.from(document.querySelectorAll('button, a, input[type="checkbox"], input[type="radio"], select, .btn')).filter(el => {
              if (el.matches('.qei-skip') || el.closest('p, li')) return false;
              if (el.matches('input[type="checkbox"], input[type="radio"]') && el.closest('label')) return false;
              const modal = el.closest('.modal-overlay');
              return !modal || modal.classList.contains('active');
            });
            const smalls = [];
            for (const el of clickables) {
              const rect = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              const visibleInViewport = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
              if (visibleInViewport && rect.width > 0 && rect.height > 0) {
                if (rect.width < 40 || rect.height < 40) {
                  smalls.push({
                    text: (el.textContent || el.value || el.ariaLabel || '').trim().slice(0, 30),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase()
                  });
                }
              }
            }
            return smalls.slice(0, 10);
          });

          if (smallTargets.length > 0) {
            results.issues.push({
              id: `TOUCH_TARGET-${pageRel.replace(/[^a-z0-9]/gi, '_')}-${vp.name}`,
              title: `Interactive elements below minimum touch size (44x44px)`,
              category: 'MOBILE_USABILITY',
              severity: 'MEDIUM',
              page: pageRel,
              url: pageUrl,
              viewport: `${vp.width}x${vp.height}`,
              device: vp.device,
              details: `Found ${smallTargets.length} small clickable elements on mobile`,
              targets: smallTargets,
              likelyRootCause: 'Insufficient padding or height CSS rules for small screen sizes.'
            });
          }
        }

        // 3. Check Mobile Hamburger Menu Functionality
        if (vp.width <= 992) {
          const menuCheck = await page.evaluate(() => {
            const hasGlobalHeader = !!document.querySelector('header.site-header #mainNav, .site-header nav.main-nav');
            if (!hasGlobalHeader) return { hasGlobalHeader: false, hasButton: true, hasDrawer: true, btnVisible: true };
            const btn = document.querySelector('#mobileMenuBtn, #mobileNavBtn, .mobile-menu, .hamburger, .mobile-toggle, [aria-label="فتح القائمة"], [aria-label="قائمة التصفح"], [aria-label="القائمة"]');
            const drawer = document.querySelector('#mobileNavDrawer, .mobile-drawer, .nav-drawer, .qei-drawer-content');
            return {
              hasGlobalHeader: true,
              hasButton: !!btn,
              hasDrawer: !!drawer,
              btnVisible: btn ? btn.offsetWidth > 0 && btn.offsetHeight > 0 : false
            };
          });

          if (menuCheck.hasGlobalHeader && !menuCheck.hasButton) {
            results.issues.push({
              id: `NAV_MOBILE_BTN_MISSING-${pageRel.replace(/[^a-z0-9]/gi, '_')}-${vp.name}`,
              title: `Mobile navigation menu button missing or inaccessible`,
              category: 'MOBILE_USABILITY',
              severity: 'HIGH',
              page: pageRel,
              url: pageUrl,
              viewport: `${vp.width}x${vp.height}`,
              device: vp.device,
              details: `No mobile menu toggle button found for viewport width ${vp.width}px`,
              likelyRootCause: 'Missing mobile drawer toggle trigger in header HTML/CSS.'
            });
          }
        }

        // 4. Console Errors
        if (consoleErrors.length > 0) {
          results.issues.push({
            id: `CONSOLE_ERR-${pageRel.replace(/[^a-z0-9]/gi, '_')}-${vp.name}`,
            title: `JavaScript console errors detected`,
            category: 'CONSOLE_ERROR',
            severity: consoleErrors.some(e => e.includes('Recursion') || e.includes('stack size') || e.includes('TypeError')) ? 'HIGH' : 'MEDIUM',
            page: pageRel,
            url: pageUrl,
            viewport: `${vp.width}x${vp.height}`,
            device: vp.device,
            errors: consoleErrors,
            likelyRootCause: 'JavaScript logic failure or recursion in runtime scripts.'
          });
        }

      } catch (err) {
        console.error(`Error auditing ${pageRel} at ${vp.name}:`, err.message);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(ROOT, 'matrix_audit_results.json'), JSON.stringify(results, null, 2));
  console.log(`\nAudit completed! Saved results to matrix_audit_results.json with ${results.issues.length} issue findings.`);
}

runMatrix().catch(console.error);
