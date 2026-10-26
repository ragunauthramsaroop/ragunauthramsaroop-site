import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import process from "node:process";

const manifest=JSON.parse(await fs.readFile("ssrn-bridge/manifest.json","utf8"));
const mode=process.env.SSRN_BRIDGE_MODE||"audit";
if(!["audit","submit"].includes(mode)) throw Error("Invalid SSRN_BRIDGE_MODE");
const out="ssrn-bridge/run";
await fs.mkdir(out,{recursive:true});
const results=[];
const normal=x=>String(x||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
const sleep=n=>new Promise(r=>setTimeout(r,n));
let browser,page;

async function record(paper,status,details={}){
  const row={slug:paper.slug,title:paper.title,status,checked_at:new Date().toISOString(),...details};
  results.push(row);console.log("SSRN_BRIDGE "+JSON.stringify(row));
}
async function save(){
  await fs.writeFile(path.join(out,"results.json"),JSON.stringify({mode,generated_at:new Date().toISOString(),results},null,2));
}
async function publicCheck(item){
  const url="https://papers.ssrn.com/sol3/papers.cfm?abstract_id="+item.ssrn_abstract_id;
  try{
    const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(12000),headers:{"User-Agent":"Mozilla/5.0"}});
    if(!response.ok){await record(item,"known_id_public_check_unavailable",{ssrn_url:url,http:response.status});return;}
    const html=await response.text();
    const visible=normal(html.replace(/<[^>]*>/g," "));
    const tokens=normal(item.title).split(" ").filter(t=>t.length>3).slice(0,7);
    const overlap=tokens.filter(t=>visible.includes(t)).length;
    if(overlap>=Math.min(3,tokens.length)&&visible.includes("ragunauth")&&visible.includes("ramsaroop")){
      await record(item,"ssrn_public_posted",{ssrn_url:url,doi:"10.2139/ssrn."+item.ssrn_abstract_id});
    }else await record(item,"known_id_public_check_inconclusive",{ssrn_url:url});
  }catch(e){await record(item,"known_id_public_check_unavailable",{ssrn_url:url,error:String(e.message||e).slice(0,160)});}
}
async function firstVisible(loc){
  for(let i=0;i<await loc.count();i++){const e=loc.nth(i);if(await e.isVisible().catch(()=>false))return e;}
  return null;
}
async function cookies(){
  for(const sel of ["#onetrust-reject-all-handler","#onetrust-accept-btn-handler",".onetrust-close-btn-handler"]){
    const el=await firstVisible(page.locator(sel)).catch(()=>null);
    if(el){await el.click({force:true}).catch(()=>{});break;}
  }
}
async function myPapers(){
  const response=await page.goto("https://hq.ssrn.com/submissions/MyPapers.cfm",{waitUntil:"domcontentloaded",timeout:60000});
  await cookies();
  for(let i=0;i<6;i++){if((await page.locator("body").innerText().catch(()=>"")).trim().length>50)break;await sleep(800);}
  const text=await page.locator("body").innerText().catch(()=>"");
  console.log("SSRN_DASHBOARD_STATE "+JSON.stringify({http:response?.status(),url:page.url().split("?")[0],title:await page.title(),textLength:text.length,htmlLength:(await page.content()).length}));
  if(text.trim().length<50)throw Error("SSRN My Papers dashboard empty, page or access blocked");
  if(await firstVisible(page.locator('input[type="password"]')))throw Error("SSRN login required");
  return text;
}
async function login(){
  await page.goto("https://hq.ssrn.com/submissions/MyPapers.cfm",{waitUntil:"domcontentloaded",timeout:60000});
  await cookies();
  await sleep(1800);
  const password=await firstVisible(page.locator('input[type="password"]'));
  if(!password)return;
  const email=await firstVisible(page.locator('input[type="email"],input[placeholder*="Email" i],input[name*="email" i]'));
  if(!email)throw Error("SSRN login email input missing");
  await email.fill(process.env.SSRN_EMAIL);
  await password.fill(process.env.SSRN_PASSWORD);
  const button=await firstVisible(page.locator("#signinBtn"))||await firstVisible(page.getByRole("button",{name:/sign in/i}));
  if(!button)throw Error("SSRN sign-in control missing");
  await button.click();await sleep(3000);
  if(await firstVisible(page.locator('input[type="password"]')))throw Error("SSRN login not confirmed");
}
async function next(){
  const button=await firstVisible(page.getByRole("button",{name:/Next Step|Save and Next Step/i}));
  if(!button)throw Error("Next Step unavailable at "+page.url());
  await button.click({force:true});await sleep(1500);
}
async function createDraft(){
  await myPapers();
  for(const loc of [
    page.getByRole("link",{name:/new submission|submit (a |your )?paper|submit new/i}),
    page.getByRole("button",{name:/new submission|submit (a |your )?paper|submit new/i})
  ]){
    const el=await firstVisible(loc).catch(()=>null);
    if(el){await el.click({force:true});await sleep(1600);return;}
  }
  const links=await page.locator("a,button,[role=button]").evaluateAll(items=>items.map(el=>({text:(el.textContent||"").replace(/\\s+/g," ").trim().slice(0,90),url:(el.getAttribute("href")||"").split("?")[0].slice(0,200)})).filter(x=>/paper|submit|new|upload|add|start/i.test(x.text)).slice(0,45));
  console.log("SSRN_NAV_LINKS "+JSON.stringify(links));
  console.log("SSRN_MYPAPERS_URL "+page.url().split("?")[0]);
  await page.goto("https://hq.ssrn.com/submission.cfm",{waitUntil:"domcontentloaded",timeout:60000});
  if(!normal(await page.locator("body").innerText()).includes("submission")){console.log("SSRN_FALLBACK_URL "+page.url().split("?")[0]);console.log("SSRN_FALLBACK_PAGE "+(await page.locator("body").innerText()).slice(0,1400));throw Error("New-submission route changed");}
}
async function stepOne(item,file){
  const input=page.locator('input[type="file"]').first();
  await input.waitFor({state:"attached",timeout:20000});
  const author=page.locator("#isAuthor");
  if(await author.count())await author.check({force:true});
  const type=page.locator("#trigger-input-content-type");
  if(await type.count()){
    await type.click({force:true});await type.fill("Preprint");await sleep(450);
    const option=await firstVisible(page.getByText(/Preprint/i));
    if(option)await option.click({force:true});
    else {await type.press("ArrowDown");await type.press("Enter");}
  }
  await input.setInputFiles(file);await sleep(1200);await next();
}
async function stepTwo(item){
  const title=page.locator("#title"),abstract=page.locator("#abstract");
  if(!await title.count()||!await abstract.count())throw Error("Title and abstract inputs unavailable");
  await title.fill(item.title);await abstract.fill(item.abstract+"\n\nAI assistance disclosure: "+item.ai_disclosure);
  const date=page.getByLabel("Date paper was written");
  if(await date.count())await date.fill(item.date.split("-").reverse().join("/"));
  const keywords=page.locator("#add-keyword");
  if(await keywords.count())for(const term of item.keywords){
    await keywords.fill(term);await keywords.press("Enter");
  }
  await next();
}
async function stepThree(){
  const search=page.locator("#author-search");
  if(!await search.count())throw Error("Author selector unavailable");
  await search.fill(process.env.SSRN_EMAIL);await search.press("Enter");await sleep(1400);
  const match=await firstVisible(page.getByText("Ragunauth Ramsaroop",{exact:true}));
  if(!match)throw Error("Author account selection requires review");
  await match.click({force:true});await next();
}
async function stepFour(item){
  let choice=await firstVisible(page.getByText(item.classification,{exact:true}));
  if(!choice){
    const filter=await firstVisible(page.locator('input[placeholder*="search" i],input[type="search"]'));
    if(filter){await filter.fill(item.classification);await sleep(650);}
    choice=await firstVisible(page.getByText(item.classification,{exact:true}));
  }
  if(!choice)throw Error("Subject classification unavailable: "+item.classification);
  await choice.click({force:true});await next();
}
async function stepFive(item){
  for(const [selector,value] of [
    ["#declaration-of-interest",item.conflict_of_interest],
    ["#funder-statement",item.funder_statement],
    ["#ethics-approval",item.ethics_approval]
  ]){
    const field=page.locator(selector);
    if(!await field.count())throw Error("Missing integrity control "+selector);
    await field.fill(value);
  }
  for(const pattern of [/I have reviewed each file that I am uploading and I have the right to upload this file/i,/I have read and agree to the SSRN Terms and Conditions/i]){
    const label=await firstVisible(page.getByText(pattern)).catch(()=>null);
    if(!label)throw Error("Required SSRN rights attestation changed");
    const parent=label.locator("xpath=..");
    const input=parent.locator('input[type="checkbox"]');
    if(await input.count())await input.first().check({force:true});
    else await label.click({force:true});
  }
  await next();
}
async function stepSix(){
  const option=page.locator("#license-option-6");
  if(await option.count())await option.check({force:true});
  else{
    const label=await firstVisible(page.getByText(/No reuse\/adaptation without permission/i));
    if(!label)throw Error("All Rights Reserved license choice unavailable");
    await label.click({force:true});
  }
  await next();
}
async function stepSeven(item){
  const body=normal(await page.locator("body").innerText());
  if(!body.includes(normal(item.title).slice(0,25)))throw Error("Final review title mismatch");
  const btn=await firstVisible(page.getByRole("button",{name:/^Submit$|^Submit Paper$|^Submit Submission$/i}));
  if(!btn)throw Error("Final submit control unavailable");
  await btn.click({force:true});await sleep(2100);
}
async function submit(item,filepath){
  const before=await myPapers();
  if(normal(before).includes(normal(item.title))){
    await record(item,"already_in_ssrn_dashboard_no_duplicate");return;
  }
  await createDraft();
  let submissionId=(page.url().match(/submission-id=([\w-]+)/i)||[])[1]||null;
  let final=false;
  for(let i=0;i<12;i++){
    const text=normal(await page.locator("body").innerText());
    if(text.includes("step 1 upload submission"))await stepOne(item,filepath);
    else if(text.includes("step 2 confirm key submission details"))await stepTwo(item);
    else if(text.includes("step 3 author information"))await stepThree();
    else if(text.includes("step 4 classify your submission"))await stepFour(item);
    else if(text.includes("step 5 research integrity"))await stepFive(item);
    else if(text.includes("step 6 choose a license"))await stepSix();
    else if(text.includes("step 7 review and submit")){await stepSeven(item);final=true;break;}
    else throw Error("SSRN unexpected step: "+text.slice(0,240));
    submissionId=(page.url().match(/submission-id=([\w-]+)/i)||[])[1]||submissionId;
  }
  if(!final)throw Error("Final SSRN submission stage not completed");
  const after=await myPapers();
  if(!normal(after).includes(normal(item.title))&&!submissionId)throw Error("Dashboard verification absent");
  await record(item,"submitted_pending_ssrn_screening",{submission_id:submissionId});
}
async function run(){
  const known=manifest.papers.filter(p=>p.ssrn_abstract_id);
  await Promise.all(known.map(publicCheck));
  const pending=manifest.papers.filter(p=>!p.ssrn_abstract_id);
  for(const item of pending){
    if(!item.pdf){await record(item,"missing_source_pdf");continue;}
    let source;
    try{
      source=await fs.readFile(item.pdf);
      if(source.subarray(0,5).toString()!=="%PDF-")throw Error("Not a PDF");
      const hash=crypto.createHash("sha256").update(source).digest("hex");
      if(hash!==item.sha256)throw Error("Source SHA256 does not match");
      if(!item.abstract||!item.date||!item.ai_disclosure||!item.classification)throw Error("Incomplete metadata");
      if(mode==="audit"){await record(item,"ready_for_ssrn_submission",{sha256:hash});continue;}
      const output=path.join(out,item.slug+"-prepared.pdf");
      execFileSync("python",["scripts/ssrn_prepare.py",item.pdf,output,JSON.stringify(item)],{stdio:"pipe"});
      await submit(item,path.resolve(output));
    }catch(e){
      await record(item,mode==="audit"?"preflight_blocked":"submission_failed_needs_review",{error:String(e.message||e).slice(0,380)});
    }
    await save();
  }
}
try{
  if(mode==="submit"){
    if(!process.env.SSRN_EMAIL||!process.env.SSRN_PASSWORD)throw Error("SSRN_EMAIL and SSRN_PASSWORD secrets required");
    const {chromium}=await import("playwright");
    browser=await chromium.launch({headless:true});
    const ctx=await browser.newContext({viewport:{width:1440,height:1100}});
    page=await ctx.newPage();page.setDefaultTimeout(30000);
    await login();
  }
  await run();
}catch(e){console.error("SSRN_BRIDGE_FATAL "+String(e.message||e));process.exitCode=1;}
finally{
  if(browser)await browser.close().catch(()=>{});
  await save();
  const lines=["# SSRN Publication Bridge","", "Mode: "+mode,"", "| Paper | Status |","|---|---|",
    ...results.map(r=>"| "+r.title.replace(/\|/g,"/")+" | "+r.status+" |")];
  const report=lines.join("\n")+"\n";
  await fs.writeFile(path.join(out,"SUMMARY.md"),report);
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,report);
  if(mode==="submit"&&results.some(r=>/failed|blocked/.test(r.status)))process.exitCode=1;
}
