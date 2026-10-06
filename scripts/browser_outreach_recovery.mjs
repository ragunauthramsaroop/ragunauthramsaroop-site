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
  summary: 'Liaison Director at AGM Inc., part of Zijin Mining Group, with more than 12 years across multinational mining, financial services and commercial operations. Leadership experience spans government and regulatory relations, ESG, corporate affairs, stakeholder strategy, compliance coordination and cross-functional operations. Internationally mobile and interested in senior Director, Head, Chief of Staff, strategic partnerships, external affairs and country-level opportunities.'
};

const targets = [
  { id: 'aurora-careers-nz', url: 'https://www.auroracareers.co.nz/job-placement/' },
  { id: 'starnest-talent', url: 'https://www.starnest.ai/apply' }
];

const only = process.env.TARGETS ? new Set(process.env.TARGETS.split(',').map(s => s.trim()).filter(Boolean)) : null;
const selected = only ? targets.filter(t => only.has(t.id)) : targets;

const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const bodyText = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

async function hasCaptcha(page) {
  const txt = normalize(await bodyText(page));
  if (/captcha|recaptcha|hcaptcha|verify you are human|cloudflare turnstile/.test(txt)) return true;
  return (await page.locator('iframe[src*="captcha" i], iframe[src*="recaptcha" i], [class*="captcha" i], [id*="captcha" i], [class*="turnstile" i]').count()) > 0;
}

async function screenshot(page, id, suffix) {
  await page.screenshot({ path: `recovery-${id}-${suffix}.png`, fullPage: true }).catch(() => {});
}

async function controlMeta(el) {
  const attrs = ['name','id','placeholder','aria-label','type','autocomplete'];
  const parts = [];
  for (const a of attrs) parts.push(await el.getAttribute(a).catch(() => '') || '');
  const parent = el.locator('xpath=ancestor::label[1]');
  if (await parent.count()) parts.push(await parent.innerText().catch(() => '') || '');
  const prev = el.locator('xpath=preceding::*[self::label or self::p or self::span or self::div][normalize-space()][1]');
  if (await prev.count()) parts.push((await prev.innerText().catch(() => '') || '').slice(0, 180));
  return normalize(parts.join(' '));
}

async function fillVisible(page) {
  const rules = [
    { key: 'email', terms: ['email'], value: profile.email },
    { key: 'firstName', terms: ['first name','firstname'], value: profile.firstName },
    { key: 'lastName', terms: ['last name','lastname'], value: profile.lastName },
    { key: 'fullName', terms: ['full name','your name','name'], value: profile.fullName },
    { key: 'phone', terms: ['phone','mobile','whatsapp'], value: profile.phone },
    { key: 'location', terms: ['location','where are you based','city'], value: profile.location },
    { key: 'country', terms: ['country'], value: profile.country },
    { key: 'linkedin', terms: ['linkedin'], value: profile.linkedin },
    { key: 'website', terms: ['website','portfolio','personal site'], value: profile.website },
    { key: 'headline', terms: ['role','title','position','expertise','what do you do'], value: profile.headline },
    { key: 'summary', terms: ['experience','background','about you','tell us','bio','summary','why','anything else'], value: profile.summary }
  ];
  const audit = {};
  const controls = page.locator('input:visible, textarea:visible');
  for (let i = 0; i < await controls.count(); i++) {
    const el = controls.nth(i);
    const type = normalize(await el.getAttribute('type').catch(() => ''));
    if (['hidden','button','submit','radio','checkbox','file'].includes(type)) continue;
    const meta = await controlMeta(el);
    for (const rule of rules) {
      if (audit[rule.key]) continue;
      if (!rule.terms.some(t => meta.includes(normalize(t)))) continue;
      try {
        await el.fill(rule.value);
        audit[rule.key] = true;
        break;
      } catch {}
    }
  }
  return audit;
}

async function chooseClearOption(page) {
  const buttons = page.locator('button:visible');
  const preferred = /operator|operations|business|strategy|leadership|go.to.market|full.time|remote|global|other/i;
  for (let i = 0; i < await buttons.count(); i++) {
    const b = buttons.nth(i);
    const txt = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!txt || /back|continue|next|submit|apply/i.test(txt)) continue;
    if (preferred.test(txt)) {
      try { await b.click(); return txt.slice(0, 160); } catch {}
    }
  }
  const radios = page.locator('input[type="radio"]:visible');
  for (let i = 0; i < await radios.count(); i++) {
    const r = radios.nth(i);
    const meta = await controlMeta(r);
    if (preferred.test(meta)) {
      try { await r.check(); return meta.slice(0, 160); } catch {}
    }
  }
  return '';
}

async function inventory(page) {
  const list = [];
  const loc = page.locator('input:visible, textarea:visible, select:visible, button:visible');
  const n = Math.min(await loc.count(), 80);
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    list.push({
      tag: await el.evaluate(e => e.tagName).catch(() => ''),
      type: await el.getAttribute('type').catch(() => ''),
      name: await el.getAttribute('name').catch(() => ''),
      placeholder: await el.getAttribute('placeholder').catch(() => ''),
      aria: await el.getAttribute('aria-label').catch(() => ''),
      text: (await el.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 180)
    });
  }
  return list;
}

async function confirmation(page) {
  const text = await bodyText(page);
  const hit = text.match(/.{0,100}(thank you|application received|submitted|success|we.?ll be in touch|decision within).{0,220}/i);
  return hit ? hit[0] : '';
}

async function runAurora(page, result) {
  result.route = 'job-placement enquiry';
  result.fieldsDetected = await inventory(page);
  if (await hasCaptcha(page)) {
    result.status = 'blocked-captcha';
    result.reason = 'Aurora Careers presents a CAPTCHA on the job-placement browser form. The recovery route will not bypass a human-verification challenge.';
    await screenshot(page, result.id, 'captcha');
    return;
  }
  result.status = 'manual-review';
  result.reason = 'No CAPTCHA detected, but this run is configured not to duplicate earlier form attempts without a verified submit path.';
}

async function runStarnest(page, result) {
  result.steps = [];

  const talentButton = page.locator('button:visible').filter({ hasText: /Talent\s+DISCOVER/i }).first();
  if (!await talentButton.count()) {
    result.status = 'manual-review';
    result.reason = 'Talent track button not found';
    result.steps.push({ stage: 'track', inventory: await inventory(page) });
    return;
  }
  await talentButton.click();
  result.trackSelected = true;

  const firstContinue = page.getByRole('button', { name: /^continue$/i }).first();
  if (!await firstContinue.count() || !await firstContinue.isEnabled().catch(() => false)) {
    result.status = 'manual-review';
    result.reason = 'Talent track selected but Continue did not enable';
    result.steps.push({ stage: 'track-selected', inventory: await inventory(page) });
    return;
  }
  await firstContinue.click();
  await page.waitForTimeout(800);

  for (let n = 2; n <= 4; n++) {
    const before = await bodyText(page);
    const stepRecord = {
      step: n,
      pageStep: before.match(/Step\s+\d+\s+of\s+\d+/i)?.[0] || '',
      fields: await fillVisible(page),
      clearChoice: await chooseClearOption(page),
      inventory: await inventory(page)
    };
    result.steps.push(stepRecord);

    const successNow = await confirmation(page);
    if (successNow && !/decisions within 7 days/i.test(successNow)) {
      result.status = 'submitted';
      result.confirmation = successNow;
      return;
    }

    const submit = page.getByRole('button', { name: /^(submit|submit application|finish|complete)$/i }).first();
    if (await submit.count() && await submit.isVisible().catch(() => false) && await submit.isEnabled().catch(() => false)) {
      const responsePromise = page.waitForResponse(r => ['POST','PUT','PATCH'].includes(r.request().method()), { timeout: 12000 })
        .then(r => ({ status: r.status(), url: r.url(), ok: r.ok() })).catch(() => null);
      await submit.click();
      result.network = await responsePromise;
      await page.waitForTimeout(1800);
      result.confirmation = await confirmation(page);
      if (result.confirmation) result.status = 'submitted';
      else if (result.network?.ok) result.status = 'submitted-network-verified';
      else result.status = 'submitted-unverified';
      return;
    }

    const next = page.getByRole('button', { name: /^(continue|next)$/i }).first();
    if (await next.count() && await next.isVisible().catch(() => false) && await next.isEnabled().catch(() => false)) {
      await next.click();
      await page.waitForTimeout(800);
      continue;
    }

    result.status = 'manual-review';
    result.reason = `Stopped at Starnest step ${n}: no enabled Continue or Submit control after safe field mapping.`;
    return;
  }

  result.status = 'manual-review';
  result.reason = 'Starnest flow reached the expected final stage without a verified submit control.';
}

async function runTarget(browser, target) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'en-US' });
  const page = await context.newPage();
  const result = { id: target.id, url: target.url, timestamp: new Date().toISOString(), status: 'started' };
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1400);
    if (target.id === 'aurora-careers-nz') await runAurora(page, result);
    if (target.id === 'starnest-talent') await runStarnest(page, result);
    result.finalUrl = page.url();
    await screenshot(page, target.id, result.status);
  } catch (e) {
    result.status = 'failed';
    result.error = String(e.message || e).slice(0, 900);
    result.finalUrl = page.url();
    await screenshot(page, target.id, 'failed');
  } finally {
    await context.close();
  }
  return result;
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const t of selected) results.push(await runTarget(browser, t));
await browser.close();

fs.mkdirSync('outreach/browser-recovery-results', { recursive: true });
const out = `outreach/browser-recovery-results/run-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), completedEarlier: ['harvanna-global','novastaff-global'], results }, null, 2));
console.log(`RESULT_FILE=${out}`);
for (const r of results) console.log(`RECOVERY ${r.id}: ${r.status} ${r.finalUrl || ''} ${r.confirmation || r.reason || r.error || ''}`);
