import { chromium } from 'playwright';
import fs from 'fs';

const profile = {
  fullName: 'Ragunauth Ramsaroop',
  firstName: 'Ragunauth',
  lastName: 'Ramsaroop',
  email: 'ragunauthramsaroop@icloud.com',
  phone: '+592 608 4735',
  country: 'Guyana',
  location: 'Georgetown, Guyana',
  linkedin: 'https://www.linkedin.com/in/ragunauth-ramsaroop',
  website: 'https://ragunauthramsaroop.com',
  headline: 'Executive leadership, ESG, corporate affairs, government relations, strategic partnerships and country operations',
  summary: 'Liaison Director at AGM Inc., part of Zijin Mining Group, with more than 12 years across multinational mining, financial services and commercial operations. Leadership experience spans government and regulatory relations, ESG, corporate affairs, stakeholder strategy, compliance coordination and cross-functional operations. Internationally mobile and open to senior Director, Head, Chief of Staff, strategic partnerships, external affairs and country-level opportunities.'
};

const outDir = 'outreach/browser-recovery-results';
fs.mkdirSync(outDir, { recursive: true });
const result = { id: 'starnest-talent', startedAt: new Date().toISOString(), steps: [] };

const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function bodyText(page) {
  return (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

async function inventory(page) {
  const list = [];
  const loc = page.locator('input:visible, textarea:visible, select:visible, button:visible');
  const n = Math.min(await loc.count(), 100);
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    list.push({
      tag: await el.evaluate(e => e.tagName).catch(() => ''),
      type: await el.getAttribute('type').catch(() => ''),
      name: await el.getAttribute('name').catch(() => ''),
      id: await el.getAttribute('id').catch(() => ''),
      placeholder: await el.getAttribute('placeholder').catch(() => ''),
      aria: await el.getAttribute('aria-label').catch(() => ''),
      value: await el.inputValue().catch(() => ''),
      text: (await el.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 220)
    });
  }
  return list;
}

async function nearbyText(el) {
  const parts = [];
  const attrs = ['name','id','placeholder','aria-label','autocomplete','type'];
  for (const a of attrs) parts.push(await el.getAttribute(a).catch(() => '') || '');
  const label = el.locator('xpath=ancestor::label[1]');
  if (await label.count()) parts.push(await label.innerText().catch(() => '') || '');
  const prev = el.locator('xpath=preceding::*[self::label or self::p or self::span or self::div or self::h2 or self::h3][normalize-space()][1]');
  if (await prev.count()) parts.push((await prev.innerText().catch(() => '') || '').slice(0, 260));
  return normalize(parts.join(' '));
}

async function clickButtonByText(page, matcher) {
  const buttons = page.locator('button:visible');
  for (let i = 0; i < await buttons.count(); i++) {
    const b = buttons.nth(i);
    const txt = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (matcher.test(txt)) {
      await b.click();
      return txt;
    }
  }
  return '';
}

async function fillFields(page) {
  const audit = {};
  const rules = [
    { key: 'email', re: /email/, value: profile.email },
    { key: 'firstName', re: /first name|firstname/, value: profile.firstName },
    { key: 'lastName', re: /last name|lastname/, value: profile.lastName },
    { key: 'fullName', re: /full name|your name|^name$| name /, value: profile.fullName },
    { key: 'phone', re: /phone|mobile|whatsapp/, value: profile.phone },
    { key: 'location', re: /location|where are you based|city/, value: profile.location },
    { key: 'country', re: /country/, value: profile.country },
    { key: 'linkedin', re: /linkedin/, value: profile.linkedin },
    { key: 'website', re: /website|portfolio|personal site/, value: profile.website },
    { key: 'headline', re: /role|title|position|expertise|what do you do/, value: profile.headline },
    { key: 'summary', re: /experience|background|about you|tell us|bio|summary|why|anything else|motivation/, value: profile.summary }
  ];

  const controls = page.locator('input:visible, textarea:visible');
  for (let i = 0; i < await controls.count(); i++) {
    const el = controls.nth(i);
    const type = normalize(await el.getAttribute('type').catch(() => ''));
    if (['hidden','button','submit','radio','checkbox','file'].includes(type)) continue;
    const meta = await nearbyText(el);
    for (const rule of rules) {
      if (audit[rule.key]) continue;
      if (!rule.re.test(meta)) continue;
      try {
        await el.fill(rule.value);
        audit[rule.key] = { meta: meta.slice(0, 180) };
        break;
      } catch {}
    }
  }
  return audit;
}

async function chooseSelects(page) {
  const choices = [];
  const selects = page.locator('select:visible');
  for (let i = 0; i < await selects.count(); i++) {
    const s = selects.nth(i);
    const meta = await nearbyText(s);
    const opts = await s.locator('option').allTextContents().catch(() => []);
    const preferences = [];
    if (/country|location/.test(meta)) preferences.push('Guyana','Other');
    if (/work|employment|availability/.test(meta)) preferences.push('Full-time','Full time','Open','Other');
    if (/seniority|level/.test(meta)) preferences.push('Director','Executive','Senior','Other');
    if (/function|discipline|area|role/.test(meta)) preferences.push('Operations','Strategy','Business','Other');
    for (const want of preferences) {
      const hit = opts.find(o => normalize(o).includes(normalize(want)));
      if (hit) {
        await s.selectOption({ label: hit }).catch(() => {});
        choices.push({ meta: meta.slice(0, 160), selected: hit });
        break;
      }
    }
  }
  return choices;
}

async function chooseSafeButtonsAndRadios(page) {
  const chosen = [];
  const preferred = /operator|operations|business|strategy|leadership|go to market|full time|full-time|remote|global|international|other/i;

  const radios = page.locator('input[type="radio"]:visible');
  for (let i = 0; i < await radios.count(); i++) {
    const r = radios.nth(i);
    const meta = await nearbyText(r);
    if (preferred.test(meta)) {
      await r.check().catch(() => {});
      chosen.push({ type: 'radio', value: meta.slice(0, 160) });
      break;
    }
  }

  const checkboxes = page.locator('input[type="checkbox"]:visible');
  for (let i = 0; i < await checkboxes.count(); i++) {
    const c = checkboxes.nth(i);
    const meta = await nearbyText(c);
    if (/privacy|data processing|contact me|application/.test(meta) && !/marketing|newsletter|promotional/.test(meta)) {
      await c.check().catch(() => {});
      chosen.push({ type: 'checkbox', value: meta.slice(0, 160) });
    }
  }
  return chosen;
}

async function successText(page) {
  const text = await bodyText(page);
  const hit = text.match(/.{0,120}(thank you|application received|successfully submitted|submission received|we.?ll be in touch).{0,260}/i);
  return hit ? hit[0] : '';
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, locale: 'en-US' });
const page = await context.newPage();

try {
  await page.goto('https://www.starnest.ai/apply', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);

  const trackClick = await clickButtonByText(page, /Talent\s+DISCOVER/i);
  result.trackClick = trackClick;
  if (!trackClick) throw new Error('Talent DISCOVER button not found by direct visible-button scan');

  await page.waitForTimeout(250);
  const continue1 = await clickButtonByText(page, /^Continue$/i);
  result.continue1 = continue1;
  if (!continue1) throw new Error('Continue button not found after selecting Talent DISCOVER');
  await page.waitForTimeout(900);

  for (let step = 2; step <= 6; step++) {
    const textBefore = await bodyText(page);
    const record = {
      step,
      pageStep: textBefore.match(/Step\s+\d+\s+of\s+\d+/i)?.[0] || '',
      fields: await fillFields(page),
      selects: await chooseSelects(page),
      choices: await chooseSafeButtonsAndRadios(page),
      inventory: await inventory(page)
    };
    result.steps.push(record);

    const alreadySuccess = await successText(page);
    if (alreadySuccess) {
      result.status = 'submitted';
      result.confirmation = alreadySuccess;
      break;
    }

    const submitButtons = page.locator('button:visible');
    let submit = null;
    for (let i = 0; i < await submitButtons.count(); i++) {
      const b = submitButtons.nth(i);
      const txt = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (/^(Submit|Submit Application|Finish|Complete)$/i.test(txt) && await b.isEnabled().catch(() => false)) {
        submit = b;
        record.submitText = txt;
        break;
      }
    }

    if (submit) {
      const responsePromise = page.waitForResponse(r => ['POST','PUT','PATCH'].includes(r.request().method()), { timeout: 15000 })
        .then(r => ({ status: r.status(), url: r.url(), ok: r.ok() })).catch(() => null);
      await submit.click();
      result.network = await responsePromise;
      await page.waitForTimeout(1800);
      result.confirmation = await successText(page);
      result.status = result.confirmation ? 'submitted' : result.network?.ok ? 'submitted-network-verified' : 'submitted-unverified';
      break;
    }

    const nextTxt = await clickButtonByText(page, /^(Continue|Next)$/i);
    record.next = nextTxt;
    if (!nextTxt) {
      result.status = 'manual-review';
      result.reason = `Stopped on step ${step}, no enabled submit or next button found after field mapping.`;
      break;
    }
    await page.waitForTimeout(900);
  }

  if (!result.status) {
    result.status = 'manual-review';
    result.reason = 'Expected form stages exhausted without verified submission.';
  }
  result.finalUrl = page.url();
  await page.screenshot({ path: `recovery-starnest-v2-${result.status}.png`, fullPage: true }).catch(() => {});
} catch (e) {
  result.status = 'failed';
  result.error = String(e.message || e).slice(0, 1000);
  result.finalUrl = page.url();
  result.inventory = await inventory(page).catch(() => []);
  await page.screenshot({ path: 'recovery-starnest-v2-failed.png', fullPage: true }).catch(() => {});
} finally {
  await context.close();
  await browser.close();
}

const out = `${outDir}/starnest-v2-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`RESULT_FILE=${out}`);
console.log(`RECOVERY starnest-talent: ${result.status} ${result.finalUrl || ''} ${result.confirmation || result.reason || result.error || ''}`);
