import { chromium } from 'playwright';

const FRONTEND = process.env.FRONTEND || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', error => pageErrors.push(error.message));

const pass = (name, detail = '') => console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
const fail = (name, detail = '') => { console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); process.exitCode = 1; };

try {
  await page.goto(`${FRONTEND}/registration/registration-schedule.html?program=1`, { waitUntil: 'networkidle' });
  const scheduleValues = await page.locator('input[name="course-date"]').evaluateAll(nodes => nodes.map(n => n.value).filter(Boolean));
  if (scheduleValues.length > 0) pass('schedule hydration', `${scheduleValues.length} schedule ids available`);
  else fail('schedule hydration', 'no schedule radio value was populated');

  await page.goto(`${FRONTEND}/registration/registration-personal.html?program=1&schedule=1`, { waitUntil: 'networkidle' });
  await page.fill('#nationalId', '9876543210');
  await page.fill('#fullName', 'اختبار رحلة كاملة');
  await page.fill('#birthDate', '1990-01-01');
  await page.selectOption('#nationality', 'سعودي');
  await page.selectOption('#maritalStatus', 'أعزب');
  await page.fill('#email', `qa-e2e-${Date.now()}@example.com`);
  await page.fill('#phone', '501234569');
  await page.click('.reg-actions .next');
  await page.waitForURL('**/registration/registration-work.html*');
  pass('registration step 1 to 2');

  await page.selectOption('#education', { label: 'بكالوريوس' });
  await page.selectOption('#university', { label: 'جامعة الملك سعود' });
  await page.selectOption('#specialization', { label: 'إدارة أعمال' });
  await page.selectOption('#entity_type', 'خاص');
  await page.fill('#company_name', 'شركة اختبار E2E');
  await page.selectOption('#jobTitle', 'محلل بيانات');
  await page.selectOption('#department', 'تقنية المعلومات');
  await page.check('input[name="working"][value="نعم"]');
  await page.fill('#currentJob', 'محلل بيانات');
  await page.selectOption('#englishLevel', 'متوسط');
  await page.click('.rgw-actions .next');
  await page.waitForURL('**/registration/registration-review.html*');
  pass('registration step 2 to review');

  await page.click('.rgr-actions .submit');
  await page.waitForTimeout(250);
  if ((await page.url()).includes('registration-review.html') && await page.locator('.toast-error').count()) pass('consent gate', 'submission remains blocked until all consents are checked');
  else fail('consent gate', 'submission bypassed consent validation');

  for (const checkbox of await page.locator('.rgr-consent input[type="checkbox"]').all()) await checkbox.check();
  await page.click('.rgr-actions .submit');
  await page.waitForURL('**/registration/registration-success.html*', { timeout: 10000 });
  const registrationNumber = (await page.locator('#rss-reg-number').textContent()).trim();
  if (/^QEI-\d{4}-\d{6}$/.test(registrationNumber)) pass('registration persisted', registrationNumber);
  else fail('registration persisted', `unexpected registration number: ${registrationNumber}`);

  const summaryButton = page.locator('button').filter({ hasText: /ملخص|تحميل|طباعة/ }).first();
  if (await summaryButton.count()) pass('summary action present');
  else fail('summary action present', 'summary action not found on success page');
} catch (error) {
  fail('E2E registration flow', error.message);
} finally {
  if (consoleErrors.length) fail('browser console', consoleErrors.join(' | '));
  if (pageErrors.length) fail('page errors', pageErrors.join(' | '));
  await browser.close();
}
