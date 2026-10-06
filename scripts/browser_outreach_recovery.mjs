import { chromium } from 'playwright';
import fs from 'fs';

const profile = {
  fullName: 'Ragunauth Ramsaroop',
  firstName: 'Ragunauth',
  lastName: 'Ramsaroop',
  email: 'ragunauthramsaroop@icloud.com',
  phone: '+592 608 4735',
  employer: 'AGM Inc. / Zijin Mining Group',
  country: 'Guyana',
  linkedin: 'https://www.linkedin.com/in/ragunauth-ramsaroop',
  website: 'https://ragunauthramsaroop.com',
  role: 'Executive Leadership, ESG, Corporate Affairs, Government Relations, Strategic Partnerships, Country Operations',
  message: 'I currently serve as Liaison Director at AGM Inc., part of Zijin Mining Group, with more than 12 years across multinational mining, financial services and commercial operations. My leadership experience spans government and regulatory relations, ESG, corporate affairs, stakeholder strategy, compliance coordination and cross-functional operations. I am internationally mobile and interested in senior Director, Head or Country-level opportunities across the Gulf, Europe, Asia-Pacific and other international markets in ESG and sustainability, external affairs, government relations, strategic partnerships, business development and country operations. I would welcome consideration for suitable current or upcoming mandates. LinkedIn: linkedin.com/in/ragunauth-ramsaroop | Website: ragunauthramsaroop.com'
};

const targets = [
  { id: 'harvanna-global', url: 'https://harvannarecruitmentglobal.com/job-seekers', mode: 'harvanna' },
  { id: 'novastaff-global', url: 'https://www.novastaffsolutions.com/', mode: 'novastaff' },
  { id: 'aurora-careers-nz', url: 'https://www.auroracareers.co.nz/job-placement/', mode: 'aurora' },
  { id: 'starnest-talent', url: 'https://www.starnest.ai/apply', mode: 'starnest' }
];

const only = process.env.TARGETS ? new Set(process.env.TARGETS.split(',').map(s => s.trim()).filter(Boolean)) : null;
const selected = only ? targets.filter(t => only.has(t.id)) : targets;

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function bodyText(page) {
  return (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

async function hasCaptcha(page) {
  const txt = normalize(await bodyText(page));
  if (/captcha|recaptcha|hcaptcha|verify you are human|cloudflare turnstile/.test(txt)) return true;
  return (await page.locator('iframe[src*="captcha" i], iframe[src*="recaptcha" i], [class*="captcha" i], [id*="captcha" i], [class*="turnstile" i]').count()) > 0;
}

async function screenshot(page, id, suffix = '') {
  const name = `recovery-${id}${suffix ? '-' + suffix : ''}.png`;
  await page.screenshot({ path: name, fullPage: true }).catch(() => {});
  return name;
}

async function metadata(el) {
  const attrs = ['name','id','placeholder','aria-label','type','autocomplete'];
  const parts = [];
  for (const a of attrs) parts.push(await el.getAttribute(a).catch(() => '') || '');
  return normalize(parts.join(' '));
}

async function labelText(el) {
  const id = await el.getAttribute('id').catch(() => null);
  if (id) {
    const explicit = el.page().locator(`label[for="${CSS.escape(id)}"]`).first();
    if (await explicit.count()) {
      const t = await explicit.innerText().catch(() => '');
      if (t) return normalize(t);
    }
  }
  const parentLabel = el.locator('xpath=ancestor::label[1]');
  if (await parentLabel.count()) {
    const t = await parentLabel.innerText().catch(() => '');
    if (t) return normalize(t);
  }
  const nearby = el.locator('xpath=preceding::*[self::label or self::span or self::p or self::div][normalize-space()][1]');
  if (await nearby.count()) {
    const t = await nearby.innerText().catch(() => '');
    return normalize(t).slice(0, 180);
  }
  return '';
}

async function fillByMeaning(scope, rules) {
  const controls = scope.locator('input:visible, textarea:visible');
  const count = await controls.count();
  const audit = {};
  for (let i = 0; i < count; i++) {
    const el = controls.nth(i);
    const type = normalize(await el.getAttribute('type').catch(() => ''));
    if (['hidden','submit','button','checkbox','radio','file'].includes(type)) continue;
    const meta = `${await metadata(el)} ${await labelText(el)}`;
    for (const rule of rules) {
      if (audit[rule.key]) continue;
      if (!rule.patterns.some(p => meta.includes(normalize(p)))) continue;
      try {
        await el.fill(rule.value);
        audit[rule.key] = true;
        break;
      } catch {}
    }
  }
  return audit;
}

async function fillSelects(scope, preferences) {
  const selects = scope.locator('select:visible');
  const audit = [];
  for (let i = 0; i < await selects.count(); i++) {
    const s = selects.nth(i);
    const meta = `${await metadata(s)} ${await labelText(s)}`;
    const options = await s.locator('option').allTextContents().catch(() => []);
    let picked = false;
    for (const pref of preferences) {
      if (pref.when && !pref.when.some(x => meta.includes(normalize(x)))) continue;
      for (const want of pref.values) {
        const hit = options.find(o => normalize(o).includes(normalize(want)));
        if (hit) {
          await s.selectOption({ label: hit }).catch(() => {});
          audit.push({ meta, selected: hit });
          picked = true;
          break;
        }
      }
      if (picked) break;
    }
  }
  return audit;
}

async function clickSubmit(scope, names = /submit|send|apply|continue|register|enquire/i) {
  const candidates = [
    scope.getByRole('button', { name: names }),
    scope.locator('button[type="submit"]:visible, input[type="submit"]:visible')
  ];
  for (const loc of candidates) {
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const b = loc.nth(i);
      try {
        if (await b.isVisible() && await b.isEnabled()) {
          await b.click();
          return true;
        }
      } catch {}
    }
  }
  return false;
}

async function findFormNearText(page, textRe) {
  const anchor = page.getByText(textRe).first();
  if (await anchor.count()) {
    const form = anchor.locator('xpath=ancestor::form[1]');
    if (await form.count()) return form;
    const following = anchor.locator('xpath=following::form[1]');
    if (await following.count()) return following;
  }
  const forms = page.locator('form:visible');
  return await forms.count() ? forms.first() : page.locator('body');
}

async function clickAndCaptureResponse(page, clicker) {
  let responseMeta = null;
  const responsePromise = page.waitForResponse(r => {
    const m = r.request().method();
    return ['POST','PUT','PATCH'].includes(m);
  }, { timeout: 12000 }).then(r => ({ status: r.status(), url: r.url(), ok: r.ok() })).catch(() => null);
  const clicked = await clicker();
  if (!clicked) return { clicked: false, response: null };
  responseMeta = await responsePromise;
  await page.waitForTimeout(1800);
  return { clicked: true, response: responseMeta };
}

function confirmationFrom(text) {
  const re = /.{0,100}(thank you|thanks|submitted|received|success|we.?ll (?:be in touch|contact)|application received|enquiry received|registration received|message sent).{0,180}/i;
  const hit = text.match(re);
  return hit ? hit[0] : '';
}

async function runHarvanna(page, result) {
  const form = await findFormNearText(page, /job seekers|enquiry|register/i);
  result.fields = await fillByMeaning(form, [
    { key: 'name', patterns: ['full name','name'], value: profile.fullName },
    { key: 'email', patterns: ['email'], value: profile.email },
    { key: 'phone', patterns: ['phone','mobile','whatsapp'], value: profile.phone },
    { key: 'employer', patterns: ['employer','company','organisation','organization'], value: profile.employer },
    { key: 'profession', patterns: ['profession','role','position','trade'], value: profile.role },
    { key: 'cv', patterns: ['cv','linkedin','portfolio'], value: profile.linkedin },
    { key: 'message', patterns: ['message','enquiry','inquiry','comments','tell us'], value: profile.message }
  ]);
  result.selects = await fillSelects(form, [
    { when: ['country','destination','interest'], values: ['Saudi Arabia','United Arab Emirates','UAE','Qatar','Other'] }
  ]);
  const submission = await clickAndCaptureResponse(page, () => clickSubmit(form, /submit enquiry|submit|send/i));
  result.network = submission.response;
  if (!submission.clicked) return 'manual-review';
  const text = await bodyText(page);
  result.confirmation = confirmationFrom(text);
  return result.confirmation || submission.response?.ok ? 'submitted' : 'submitted-unverified';
}

async function runNovaStaff(page, result) {
  const form = await findFormNearText(page, /register your interest/i);
  result.fields = await fillByMeaning(form, [
    { key: 'name', patterns: ['full name','name'], value: profile.fullName },
    { key: 'email', patterns: ['email'], value: profile.email },
    { key: 'phone', patterns: ['phone'], value: profile.phone },
    { key: 'currentCountry', patterns: ['current country'], value: profile.country },
    { key: 'targetCountry', patterns: ['target country','target region','destination'], value: 'Saudi Arabia, UAE, GCC, Europe, New Zealand' },
    { key: 'roles', patterns: ['role s you are interested','roles interested','role'], value: profile.role },
    { key: 'experience', patterns: ['brief summary','experience','summary'], value: profile.message },
    { key: 'additional', patterns: ['additional information','additional'], value: 'Internationally mobile. Open to employer-sponsored senior leadership opportunities. Email: ragunauthramsaroop@icloud.com.' }
  ]);

  // Guard against generic matching missing a required email field.
  if (!result.fields.email) {
    const email = form.locator('input[type="email"]:visible').first();
    if (await email.count()) {
      await email.fill(profile.email).catch(() => {});
      result.fields.email = true;
    }
  }

  const submission = await clickAndCaptureResponse(page, () => clickSubmit(form, /submit registration|submit/i));
  result.network = submission.response;
  if (!submission.clicked) return 'manual-review';
  const text = await bodyText(page);
  result.confirmation = confirmationFrom(text);
  const required = ['name','email','currentCountry','roles','experience'];
  result.requiredFieldsComplete = required.every(k => result.fields[k]);
  if (result.confirmation) return 'submitted';
  if (submission.response?.ok && result.requiredFieldsComplete) return 'submitted-network-verified';
  return 'submitted-unverified';
}

async function runAurora(page, result) {
  // Use the job-placement enquiry route instead of the CAPTCHA-protected contact page.
  const forms = page.locator('form:visible');
  let form = null;
  for (let i = 0; i < await forms.count(); i++) {
    const f = forms.nth(i);
    const txt = normalize(await f.innerText().catch(() => ''));
    const html = normalize(await f.evaluate(el => el.outerHTML).catch(() => ''));
    if ((txt + ' ' + html).includes('email') && (txt + ' ' + html).includes('phone')) {
      form = f;
      break;
    }
  }
  if (!form) form = await findFormNearText(page, /enquire now|apply now/i);

  result.fields = await fillByMeaning(form, [
    { key: 'firstName', patterns: ['first name'], value: profile.firstName },
    { key: 'lastName', patterns: ['last name'], value: profile.lastName },
    { key: 'name', patterns: ['name'], value: profile.fullName },
    { key: 'email', patterns: ['email'], value: profile.email },
    { key: 'phone', patterns: ['phone','mobile'], value: profile.phone },
    { key: 'country', patterns: ['country'], value: profile.country },
    { key: 'subject', patterns: ['subject'], value: 'Executive Candidate Introduction | New Zealand Leadership Opportunities' },
    { key: 'message', patterns: ['message','comments','enquiry'], value: profile.message + ' I am interested in New Zealand leadership opportunities where employer sponsorship or relocation support is available.' }
  ]);
  result.selects = await fillSelects(form, [
    { when: ['country'], values: ['Guyana','Other'] }
  ]);

  if (await hasCaptcha(page)) {
    result.reason = 'CAPTCHA present on selected job-placement form';
    return 'blocked-captcha';
  }
  const submission = await clickAndCaptureResponse(page, () => clickSubmit(form, /submit|apply now|enquire/i));
  result.network = submission.response;
  if (!submission.clicked) return 'manual-review';
  const text = await bodyText(page);
  result.confirmation = confirmationFrom(text);
  if (result.confirmation) return 'submitted';
  if (submission.response?.ok) return 'submitted-network-verified';
  return 'submitted-unverified';
}

async function clickTalentTrack(page) {
  const text = page.getByText(/Talent\s+Discover/i).first();
  if (!await text.count()) return false;
  const clickable = text.locator('xpath=ancestor-or-self::*[self::button or self::label or @role="button"][1]');
  if (await clickable.count()) {
    try { await clickable.click(); return true; } catch {}
  }
  try { await text.click(); return true; } catch {}
  return false;
}

async function inventoryVisible(page) {
  const out = [];
  const loc = page.locator('input:visible, textarea:visible, select:visible, button:visible, [role="button"]:visible');
  const n = Math.min(await loc.count(), 60);
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    out.push({
      tag: await el.evaluate(e => e.tagName).catch(() => ''),
      type: await el.getAttribute('type').catch(() => ''),
      name: await el.getAttribute('name').catch(() => ''),
      placeholder: await el.getAttribute('placeholder').catch(() => ''),
      aria: await el.getAttribute('aria-label').catch(() => ''),
      text: (await el.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 120)
    });
  }
  return out;
}

async function fillStarnestStep(page) {
  const body = page.locator('body');
  const audit = await fillByMeaning(body, [
    { key: 'fullName', patterns: ['full name','name'], value: profile.fullName },
    { key: 'firstName', patterns: ['first name'], value: profile.firstName },
    { key: 'lastName', patterns: ['last name'], value: profile.lastName },
    { key: 'email', patterns: ['email'], value: profile.email },
    { key: 'phone', patterns: ['phone','mobile'], value: profile.phone },
    { key: 'location', patterns: ['location','country','where are you based'], value: 'Georgetown, Guyana' },
    { key: 'linkedin', patterns: ['linkedin'], value: profile.linkedin },
    { key: 'website', patterns: ['website','portfolio','personal site'], value: profile.website },
    { key: 'role', patterns: ['role','title','position','what do you do','expertise'], value: 'Executive leadership, ESG, corporate affairs, government relations, strategic partnerships and country operations' },
    { key: 'experience', patterns: ['experience','background','about you','tell us','bio','summary','why'], value: profile.message }
  ]);

  await fillSelects(body, [
    { when: ['country','location'], values: ['Guyana','Other'] },
    { when: ['employment','availability','work type'], values: ['Full-time','Full time','Open','Other'] }
  ]);

  // Pick only options whose meaning clearly matches the requested Talent track and executive/operator profile.
  const radios = page.locator('input[type="radio"]:visible');
  if (await radios.count()) {
    let chosen = false;
    for (let i = 0; i < await radios.count(); i++) {
      const r = radios.nth(i);
      const meta = `${await metadata(r)} ${await labelText(r)}`;
      if (/operator|operations|business|strategy|go to market|leadership|other|full time|full-time|remote|global/.test(meta)) {
        await r.check().catch(() => {});
        chosen = true;
        break;
      }
    }
    audit.radioChoice = chosen;
  }
  return audit;
}

async function runStarnest(page, result) {
  result.steps = [];
  const track = await clickTalentTrack(page);
  result.trackSelected = track;
  const firstContinue = page.getByRole('button', { name: /continue/i }).first();
  if (await firstContinue.count() && await firstContinue.isEnabled().catch(() => false)) {
    await firstContinue.click();
    await page.waitForTimeout(900);
  }

  for (let step = 2; step <= 5; step++) {
    const before = await bodyText(page);
    const record = {
      step,
      url: page.url(),
      heading: before.match(/Step\s+\d+\s+of\s+\d+[^.]{0,100}/i)?.[0] || '',
      fields: await fillStarnestStep(page),
      inventory: await inventoryVisible(page)
    };
    result.steps.push(record);

    if (/thank you|application received|submitted|we.?ll be in touch|decision within/i.test(before)) {
      result.confirmation = confirmationFrom(before) || before.slice(0, 350);
      return 'submitted';
    }

    const submit = page.getByRole('button', { name: /submit|apply|finish|complete/i }).first();
    if (await submit.count() && await submit.isVisible().catch(() => false) && await submit.isEnabled().catch(() => false)) {
      const responsePromise = page.waitForResponse(r => ['POST','PUT','PATCH'].includes(r.request().method()), { timeout: 12000 })
        .then(r => ({ status: r.status(), url: r.url(), ok: r.ok() })).catch(() => null);
      await submit.click();
      result.network = await responsePromise;
      await page.waitForTimeout(1800);
      const after = await bodyText(page);
      result.confirmation = confirmationFrom(after);
      if (result.confirmation) return 'submitted';
      if (result.network?.ok) return 'submitted-network-verified';
      return 'submitted-unverified';
    }

    const cont = page.getByRole('button', { name: /continue|next/i }).first();
    if (await cont.count() && await cont.isVisible().catch(() => false) && await cont.isEnabled().catch(() => false)) {
      await cont.click();
      await page.waitForTimeout(900);
      continue;
    }

    result.reason = `Stopped at Starnest step ${step}: no enabled Continue or Submit control`;
    return 'manual-review';
  }

  result.reason = 'Starnest flow exceeded expected step count without a verifiable submission';
  return 'manual-review';
}

async function runTarget(browser, target) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'en-US' });
  const page = await context.newPage();
  const result = { id: target.id, url: target.url, status: 'started', timestamp: new Date().toISOString() };
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);

    if (target.mode !== 'aurora' && await hasCaptcha(page)) {
      result.status = 'blocked-captcha';
      result.reason = 'CAPTCHA detected before form interaction';
      result.finalUrl = page.url();
      await screenshot(page, target.id, 'blocked');
      return result;
    }

    if (target.mode === 'harvanna') result.status = await runHarvanna(page, result);
    if (target.mode === 'novastaff') result.status = await runNovaStaff(page, result);
    if (target.mode === 'aurora') result.status = await runAurora(page, result);
    if (target.mode === 'starnest') result.status = await runStarnest(page, result);

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
for (const target of selected) results.push(await runTarget(browser, target));
await browser.close();

fs.mkdirSync('outreach/browser-recovery-results', { recursive: true });
const out = `outreach/browser-recovery-results/run-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log(`RESULT_FILE=${out}`);
for (const r of results) console.log(`RECOVERY ${r.id}: ${r.status} ${r.finalUrl || ''} ${r.confirmation || r.reason || r.error || ''}`);
