import { chromium } from 'playwright';
import fs from 'fs';

const profile = {
  fullName: 'Ragunauth Ramsaroop',
  email: 'ragunauthramsaroop@icloud.com',
  phone: '+592 608 4735',
  employer: 'AGM Inc. / Zijin Mining Group',
  linkedin: 'https://www.linkedin.com/in/ragunauth-ramsaroop',
  website: 'https://ragunauthramsaroop.com',
  role: 'Executive Leadership - ESG, Corporate Affairs, Government Relations, Strategic Partnerships, Country Operations',
  message: 'I currently serve as Liaison Director at AGM Inc., part of Zijin Mining Group, with more than 12 years across multinational mining, financial services and commercial operations. My leadership experience spans government and regulatory relations, ESG, corporate affairs, stakeholder strategy, compliance coordination and cross-functional operations. I am internationally mobile and interested in senior Director, Head or Country-level opportunities across the Gulf, Europe, Asia-Pacific and other international markets in ESG and sustainability, external affairs, government relations, strategic partnerships, business development and country operations. I would welcome consideration for suitable current or upcoming mandates. LinkedIn: linkedin.com/in/ragunauth-ramsaroop | Website: ragunauthramsaroop.com'
};

const targets = [
  {
    id: 'harvanna-global',
    url: 'https://harvannarecruitmentglobal.com/job-seekers',
    mode: 'candidate',
    fields: {
      name: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      employer: profile.employer,
      profession: profile.role,
      cv: profile.linkedin,
      message: profile.message
    },
    countryPreference: ['Saudi Arabia', 'United Arab Emirates', 'UAE', 'Qatar', 'Gulf', 'Other']
  },
  {
    id: 'novastaff-global',
    url: 'https://www.novastaffsolutions.com/',
    mode: 'candidate',
    fields: {
      name: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      currentCountry: 'Guyana',
      targetCountry: 'Saudi Arabia / UAE / GCC / Europe / New Zealand',
      roles: profile.role,
      experience: profile.message,
      additional: 'Internationally mobile. Open to employer-sponsored senior leadership opportunities. Email: ragunauthramsaroop@icloud.com.'
    }
  },
  {
    id: 'aurora-careers-nz',
    url: 'https://www.auroracareers.co.nz/contact-us',
    mode: 'contact',
    fields: {
      name: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      subject: 'Executive Candidate Introduction | New Zealand Leadership Opportunities',
      message: profile.message + ' I am particularly interested in New Zealand roles where employer sponsorship or relocation support is available.'
    }
  },
  {
    id: 'starnest-talent',
    url: 'https://www.starnest.ai/apply',
    mode: 'starnest',
    fields: {
      name: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      linkedin: profile.linkedin,
      website: profile.website,
      roles: 'Chief of Staff, Strategic Partnerships, Operations, External Affairs, Country Leadership',
      experience: profile.message
    }
  }
];

const only = process.env.TARGETS ? new Set(process.env.TARGETS.split(',').map(s => s.trim())) : null;
const selected = only ? targets.filter(t => only.has(t.id)) : targets;

function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

async function hasCaptcha(page) {
  const txt = normalize(await page.locator('body').innerText().catch(() => ''));
  if (/captcha|recaptcha|hcaptcha|verify you are human|cloudflare turnstile/.test(txt)) return true;
  return (await page.locator('iframe[src*="captcha"], iframe[src*="recaptcha"], [class*="captcha" i], [id*="captcha" i]').count()) > 0;
}

async function fillBest(page, keys, value) {
  if (!value) return false;
  const candidates = [];
  for (const key of keys) {
    candidates.push(page.getByLabel(new RegExp(key, 'i')));
    candidates.push(page.getByPlaceholder(new RegExp(key, 'i')));
    candidates.push(page.locator(`input[name*="${key}" i], textarea[name*="${key}" i], input[id*="${key}" i], textarea[id*="${key}" i]`));
  }
  for (const loc of candidates) {
    try {
      const n = await loc.count();
      if (n > 0 && await loc.first().isVisible()) {
        await loc.first().fill(value);
        return true;
      }
    } catch {}
  }
  return false;
}

async function selectBest(page, keys, preferred) {
  const selects = page.locator('select');
  const count = await selects.count();
  for (let i=0;i<count;i++) {
    const s = selects.nth(i);
    const meta = normalize((await s.getAttribute('name')) + ' ' + (await s.getAttribute('id')) + ' ' + (await s.getAttribute('aria-label')));
    if (!keys.some(k => meta.includes(normalize(k)))) continue;
    const options = await s.locator('option').allTextContents();
    for (const want of preferred) {
      const hit = options.find(o => normalize(o).includes(normalize(want)));
      if (hit) { await s.selectOption({ label: hit }); return true; }
    }
  }
  return false;
}

async function fillGeneric(page, fields) {
  const audit = {};
  audit.name = await fillBest(page, ['full name','name'], fields.name);
  audit.email = await fillBest(page, ['email'], fields.email);
  audit.phone = await fillBest(page, ['phone','whatsapp','mobile'], fields.phone);
  audit.employer = await fillBest(page, ['current employer','company','organisation','organization','employer'], fields.employer);
  audit.currentCountry = await fillBest(page, ['current country','country'], fields.currentCountry);
  audit.targetCountry = await fillBest(page, ['target country','country region','destination'], fields.targetCountry);
  audit.profession = await fillBest(page, ['profession','trade','role','position'], fields.profession || fields.roles);
  audit.roles = audit.profession || await fillBest(page, ['roles interested','role s','interested in'], fields.roles);
  audit.cv = await fillBest(page, ['link to your cv','cv link','linkedin','portfolio'], fields.cv || fields.linkedin);
  audit.website = await fillBest(page, ['website'], fields.website);
  audit.subject = await fillBest(page, ['subject'], fields.subject);
  audit.experience = await fillBest(page, ['brief summary','experience','summary'], fields.experience);
  audit.additional = await fillBest(page, ['additional information','additional'], fields.additional);
  audit.message = await fillBest(page, ['how can we help','message','enquiry','inquiry','tell us','comments'], fields.message || fields.experience);

  if (!audit.message && (fields.message || fields.experience)) {
    const tas = page.locator('textarea:visible');
    if (await tas.count()) {
      try { await tas.last().fill(fields.message || fields.experience); audit.message = true; } catch {}
    }
  }
  return audit;
}

async function submitVisible(page) {
  const buttons = [
    page.getByRole('button', { name: /submit enquiry|submit registration|submit|send your message|send message|apply|continue/i }),
    page.locator('button[type="submit"], input[type="submit"]')
  ];
  for (const loc of buttons) {
    try {
      const n = await loc.count();
      for (let i=0;i<n;i++) {
        if (await loc.nth(i).isVisible() && await loc.nth(i).isEnabled()) {
          await Promise.allSettled([
            page.waitForLoadState('networkidle', { timeout: 15000 }),
            loc.nth(i).click()
          ]);
          return true;
        }
      }
    } catch {}
  }
  return false;
}

async function runTarget(browser, target) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const result = { id: target.id, url: target.url, status: 'started', timestamp: new Date().toISOString() };
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1800);

    if (await hasCaptcha(page)) {
      result.status = 'blocked-captcha';
      result.finalUrl = page.url();
      return result;
    }

    if (target.mode === 'starnest') {
      const talent = page.getByText(/Talent\s+Discover/i).first();
      if (await talent.count() && await talent.isVisible()) await talent.click();
      const cont = page.getByRole('button', { name: /continue/i }).first();
      if (await cont.count() && await cont.isVisible()) await cont.click();
      await page.waitForTimeout(800);
    }

    result.fields = await fillGeneric(page, target.fields);
    if (target.countryPreference) result.countrySelected = await selectBest(page, ['country','interest','destination'], target.countryPreference);

    if (await hasCaptcha(page)) {
      result.status = 'blocked-captcha';
      result.finalUrl = page.url();
      return result;
    }

    const submitted = await submitVisible(page);
    if (!submitted) {
      result.status = 'manual-review';
      result.reason = 'No enabled submit control found after field mapping';
      result.finalUrl = page.url();
      return result;
    }
    await page.waitForTimeout(2200);

    if (await hasCaptcha(page)) {
      result.status = 'blocked-captcha';
      result.reason = 'CAPTCHA appeared after submission attempt';
      result.finalUrl = page.url();
      return result;
    }

    const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g,' ').trim();
    const successMatch = body.match(/.{0,90}(thank you|thanks|submitted|received|success|we.?ll (?:be in touch|contact)|application received|enquiry received|registration received).{0,160}/i);
    result.confirmation = successMatch ? successMatch[0] : '';
    result.finalUrl = page.url();
    result.status = successMatch ? 'submitted' : 'submitted-unverified';
    await page.screenshot({ path: `recovery-${target.id}.png`, fullPage: true }).catch(() => {});
  } catch (e) {
    result.status = 'failed';
    result.error = String(e.message || e).slice(0, 500);
    result.finalUrl = page.url();
  } finally {
    await context.close();
  }
  return result;
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const target of selected) {
  results.push(await runTarget(browser, target));
}
await browser.close();

fs.mkdirSync('outreach/browser-recovery-results', { recursive: true });
const out = `outreach/browser-recovery-results/run-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log(`RESULT_FILE=${out}`);
for (const r of results) console.log(`RECOVERY ${r.id}: ${r.status} ${r.finalUrl || ''} ${r.confirmation || r.reason || r.error || ''}`);
