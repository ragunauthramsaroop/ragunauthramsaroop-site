import { chromium } from 'playwright';
import fs from 'fs';

const P = {
  name: 'Ragunauth Ramsaroop',
  email: 'ragunauthramsaroop@icloud.com',
  location: 'Georgetown, Guyana',
  linkedin: 'https://www.linkedin.com/in/ragunauth-ramsaroop',
  role: 'Liaison Director, ESG, Corporate Affairs, Government Relations and Strategic Partnerships',
  summary: 'Senior executive with more than 12 years across multinational mining, financial services and commercial operations. Current Liaison Director at AGM Inc., part of Zijin Mining Group. Experience spans ESG, government and regulatory relations, corporate affairs, stakeholder strategy, compliance coordination, strategic partnerships and cross-functional operations. Internationally mobile and open to senior leadership, strategy, operations, external affairs, partnerships and country-level opportunities.'
};

const result = { id: 'starnest-talent', startedAt: new Date().toISOString(), steps: [] };
const outDir = 'outreach/browser-recovery-results';
fs.mkdirSync(outDir, { recursive: true });

async function text(page) {
  return (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

async function inventory(page) {
  const out = [];
  const els = page.locator('input:visible, textarea:visible, select:visible, button:visible');
  const n = Math.min(await els.count(), 120);
  for (let i = 0; i < n; i++) {
    const e = els.nth(i);
    out.push({
      tag: await e.evaluate(x => x.tagName).catch(() => ''),
      type: await e.getAttribute('type').catch(() => ''),
      placeholder: await e.getAttribute('placeholder').catch(() => ''),
      value: await e.inputValue().catch(() => ''),
      text: (await e.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 240),
      disabled: await e.isDisabled().catch(() => false)
    });
  }
  return out;
}

async function clickButton(page, re, requireEnabled = true) {
  const bs = page.locator('button:visible');
  for (let i = 0; i < await bs.count(); i++) {
    const b = bs.nth(i);
    const t = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!re.test(t)) continue;
    if (requireEnabled && !await b.isEnabled().catch(() => false)) continue;
    await b.click();
    return t;
  }
  return '';
}

async function fillStep2(page) {
  await page.locator('input[placeholder="Ada Lovelace"]:visible').fill(P.name);
  await page.locator('input[type="email"]:visible').fill(P.email);
  await page.locator('input[placeholder="City, Country"]:visible').fill(P.location);
}

async function fillStep3(page) {
  const role = page.locator('input[placeholder*="Senior ML Engineer"]:visible').first();
  if (await role.count()) await role.fill(P.role);

  const sel = page.locator('select:visible').first();
  if (await sel.count()) {
    const options = await sel.locator('option').allTextContents();
    const exact = options.find(o => /Ops\s*\/\s*Finance\s*\/\s*Legal/i.test(o));
    if (exact) await sel.selectOption({ label: exact });
    else {
      const ops = options.find(o => /ops|operations|business|go-to-market/i.test(o));
      if (ops) await sel.selectOption({ label: ops });
    }
  }

  const link = page.locator('input[placeholder="https://"]:visible').first();
  if (await link.count()) await link.fill(P.linkedin);
}

async function fillFinalStep(page) {
  const actions = [];

  const textareas = page.locator('textarea:visible');
  for (let i = 0; i < await textareas.count(); i++) {
    const t = textareas.nth(i);
    if (!(await t.inputValue().catch(() => ''))) {
      await t.fill(P.summary);
      actions.push(`textarea-${i}`);
    }
  }

  const inputs = page.locator('input:visible');
  for (let i = 0; i < await inputs.count(); i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute('type').catch(() => '') || '').toLowerCase();
    if (['hidden','radio','checkbox','submit','button','file'].includes(type)) continue;
    if (await el.inputValue().catch(() => '')) continue;
    const ph = ((await el.getAttribute('placeholder').catch(() => '')) || '').toLowerCase();
    if (ph.includes('linkedin') || ph.includes('portfolio') || ph === 'https://') {
      await el.fill(P.linkedin); actions.push(`input-${i}-linkedin`); continue;
    }
    if (ph.includes('role') || ph.includes('title')) {
      await el.fill(P.role); actions.push(`input-${i}-role`); continue;
    }
    if (ph.includes('location') || ph.includes('city')) {
      await el.fill(P.location); actions.push(`input-${i}-location`); continue;
    }
    if (type === 'email') {
      await el.fill(P.email); actions.push(`input-${i}-email`); continue;
    }
  }

  const selects = page.locator('select:visible');
  for (let i = 0; i < await selects.count(); i++) {
    const s = selects.nth(i);
    if (await s.inputValue().catch(() => '')) continue;
    const opts = await s.locator('option').allTextContents().catch(() => []);
    const prefs = [
      /30\s*days/i,
      /full[- ]?time/i,
      /director/i,
      /executive/i,
      /operations|ops/i,
      /strategy/i,
      /international|global/i,
      /other/i
    ];
    let picked = '';
    for (const re of prefs) {
      picked = opts.find(o => re.test(o) && !/pick|select|choose/i.test(o)) || '';
      if (picked) break;
    }
    if (picked) {
      await s.selectOption({ label: picked }).catch(() => {});
      actions.push(`select-${i}:${picked}`);
    }
  }

  const buttons = page.locator('button:visible');
  for (let i = 0; i < await buttons.count(); i++) {
    const b = buttons.nth(i);
    const bt = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (/back|continue|next|submit|finish|complete/i.test(bt)) continue;
    if (/operations|strategy|business|leadership|partnership|sustainability|climate|policy|external affairs|government/i.test(bt)) {
      await b.click().catch(() => {});
      actions.push(`button:${bt.slice(0,80)}`);
    }
  }

  const checks = page.locator('input[type="checkbox"]:visible');
  for (let i = 0; i < await checks.count(); i++) {
    const c = checks.nth(i);
    const parent = c.locator('xpath=ancestor::label[1]');
    const ct = ((await parent.innerText().catch(() => '')) || '').toLowerCase();
    if (/privacy|data processing|application/.test(ct) && !/marketing|newsletter|promotional/.test(ct)) {
      await c.check().catch(() => {});
      actions.push(`checkbox:${ct.slice(0,100)}`);
    }
  }

  return actions;
}

function successFrom(body) {
  const m = body.match(/.{0,140}(thank you|application received|successfully submitted|submission received|we.?ll be in touch).{0,280}/i);
  return m ? m[0] : '';
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, locale: 'en-US' });
const page = await context.newPage();

try {
  await page.goto('https://www.starnest.ai/apply', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(900);

  result.track = await clickButton(page, /Talent\s+DISCOVER/i);
  if (!result.track) throw new Error('Talent DISCOVER track not found');
  result.firstContinue = await clickButton(page, /^Continue$/i);
  if (!result.firstContinue) throw new Error('Continue unavailable after track selection');
  await page.waitForTimeout(650);

  await fillStep2(page);
  result.steps.push({ pageStep: 'STEP 2 OF 4', inventory: await inventory(page) });
  result.step2Continue = await clickButton(page, /^Continue$/i);
  if (!result.step2Continue) throw new Error('Step 2 Continue unavailable');
  await page.waitForTimeout(650);

  await fillStep3(page);
  result.steps.push({ pageStep: 'STEP 3 OF 4', inventory: await inventory(page) });
  result.step3Continue = await clickButton(page, /^Continue$/i);
  if (!result.step3Continue) throw new Error('Step 3 Continue unavailable after choosing Ops / Finance / Legal');
  await page.waitForTimeout(700);

  const finalBody = await text(page);
  result.finalStepHeading = finalBody.match(/Step\s+\d+\s+of\s+\d+/i)?.[0] || '';
  result.finalActions = await fillFinalStep(page);
  result.steps.push({ pageStep: result.finalStepHeading || 'FINAL', inventory: await inventory(page), actions: result.finalActions });

  const preSuccess = successFrom(await text(page));
  if (preSuccess) {
    result.status = 'submitted';
    result.confirmation = preSuccess;
  } else {
    const submitPattern = /^(Submit|Submit Application|Join|Join Network|Finish|Complete|Send)$/i;
    const buttons = page.locator('button:visible');
    let submitButton = null;
    for (let i = 0; i < await buttons.count(); i++) {
      const b = buttons.nth(i);
      const bt = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (submitPattern.test(bt) && await b.isEnabled().catch(() => false)) {
        submitButton = b;
        result.submitText = bt;
        break;
      }
    }

    if (!submitButton) {
      result.status = 'manual-review';
      result.reason = 'Final form reached, but no enabled submission control was found.';
    } else {
      const responsePromise = page.waitForResponse(r => ['POST','PUT','PATCH'].includes(r.request().method()), { timeout: 15000 })
        .then(r => ({ status: r.status(), url: r.url(), ok: r.ok() })).catch(() => null);
      await submitButton.click();
      result.network = await responsePromise;
      await page.waitForTimeout(1800);
      result.confirmation = successFrom(await text(page));
      result.status = result.confirmation ? 'submitted' : result.network?.ok ? 'submitted-network-verified' : 'submitted-unverified';
    }
  }

  result.finalUrl = page.url();
  await page.screenshot({ path: `recovery-starnest-v3-${result.status}.png`, fullPage: true }).catch(() => {});
} catch (e) {
  result.status = 'failed';
  result.error = String(e.message || e).slice(0, 1000);
  result.finalUrl = page.url();
  result.failureInventory = await inventory(page).catch(() => []);
  await page.screenshot({ path: 'recovery-starnest-v3-failed.png', fullPage: true }).catch(() => {});
} finally {
  await context.close();
  await browser.close();
}

const out = `${outDir}/starnest-v3-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`RESULT_FILE=${out}`);
console.log(`RECOVERY starnest-talent: ${result.status} ${result.finalUrl || ''} ${result.confirmation || result.reason || result.error || ''}`);
