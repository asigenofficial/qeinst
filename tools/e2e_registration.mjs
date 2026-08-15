import { chromium } from 'playwright';

const FRONTEND = process.env.FRONTEND || 'http://127.0.0.1:8080';
const API = process.env.API || 'http://127.0.0.1:8000/api/v1';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', error => pageErrors.push(error.message));

const pass = (name, detail = '') => console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
const fail = (name, detail = '') => { console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); process.exitCode = 1; };
const open = async path => {
  await page.goto(`${FRONTEND}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(180);
};

try {
  await open('/registration/registration-personal.html');
  const missingProgramText = (await page.locator('.selected-program-desc').first().textContent() || '').trim();
  const missingProgramDisabled = await page.locator('.reg-actions .next:disabled').count();
  if (/اختر برنامجًا تدريبيًا/.test(missingProgramText) && missingProgramDisabled) pass('missing program is blocked');
  else fail('missing program is blocked', `message=${missingProgramText}; disabled=${missingProgramDisabled}`);

  const invalidResponse = await fetch(`${API}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      program_id: 999999,
      national_id: '9876543210',
      full_name: 'اختبار برنامج غير صالح',
      email: `invalid-program-${Date.now()}@example.com`,
      phone: '501234569',
    }),
  });
  if (invalidResponse.status === 422) pass('invalid or unavailable program is rejected');
  else fail('invalid or unavailable program is rejected', `status=${invalidResponse.status}`);

  await open('/registration/registration-personal.html?program_id=1');
  const selectedProgram = (await page.locator('.selected-program-title').first().textContent() || '').trim();
  const selectedDescription = (await page.locator('.selected-program-desc').first().textContent() || '').trim();
  const programPickerCount = await page.locator('#qeiProgramQuickSelect, input[name="course-date"], .rgs-date-card').count();
  if (selectedProgram && !/لم يتم اختيار|تعذر تحديد/.test(selectedProgram) && programPickerCount === 0 && !/\d{4}-\d{2}-\d{2}/.test(selectedDescription)) {
    pass('program binding and no schedule/date picker', selectedProgram);
  } else {
    fail('program binding and no schedule/date picker', `title=${selectedProgram}; picker=${programPickerCount}; desc=${selectedDescription}`);
  }

  await page.fill('#nationalId', '9876543210');
  await page.fill('#fullName', 'اختبار رحلة كاملة');
  await page.fill('#birthDate', '1990-01-01');
  await page.selectOption('#nationality', 'سعودي');
  await page.selectOption('#maritalStatus', 'أعزب');
  await page.fill('#email', `qa-e2e-${Date.now()}@example.com`);
  await page.fill('#phone', '501234569');
  await page.click('.reg-actions .next');
  await page.waitForURL('**/registration/registration-work.html?program_id=1');
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
  await page.waitForURL('**/registration/registration-review.html?program_id=1');
  pass('registration step 2 to review without schedule step');

  const reviewDescription = (await page.locator('.selected-program-desc').first().textContent() || '').trim();
  if (!/\d{4}-\d{2}-\d{2}/.test(reviewDescription)) pass('registration review has no program date');
  else fail('registration review has no program date', reviewDescription);

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

  const savedData = await page.evaluate(() => JSON.parse(localStorage.getItem('qei.registration') || '{}'));
  if (!savedData.schedule_id && !savedData.scheduleId && !savedData.selectedDate) pass('schedule data is not persisted with registration');
  else fail('schedule data is not persisted with registration', JSON.stringify(savedData));

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
