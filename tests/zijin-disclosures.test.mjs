import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import Registry from "../tools/zijin-2259/issuer-registry.js";

const BASE="tools/zijin-2259/";
const html=readFileSync(BASE+"index.html","utf8");
const app=readFileSync(BASE+"issuer-ui.js","utf8");
const css=readFileSync(BASE+"issuer-dossier.css","utf8");

test("every editorial filing has a verifiable official 02259 HKEX PDF target and stable order",()=>{
 assert.equal(Registry.records.length,8);
 assert.equal(Registry.REGISTRY_DATE,"2026-11-23");
 assert.match(Registry.OFFICIAL_REGISTER,/stockId=1000274494/);
 const urls=new Set(),dates=[];
 for(const record of Registry.records){
  assert.equal(Registry.validFiling(record),true,record.title);
  assert.ok(!urls.has(record.url),"Repeated official filing: "+record.url);
  urls.add(record.url);dates.push(record.date);
  assert.ok(record.date<=Registry.REGISTRY_DATE,"No future issuances");
  assert.ok(record.scope.length>5&&record.detail.length>25);
 }
 assert.deepEqual(dates,[...dates].sort((a,b)=>b.localeCompare(a)));
 assert.equal(Registry.validFiling({...Registry.records[0],url:"https://evil.example/2026/1113/2026111300646.pdf"}),false);
 assert.equal(Registry.validFiling({...Registry.records[0],url:"https://www1.hkexnews.hk.evil.example/listedco/listconews/sehk/2026/1113/2026111300646.pdf"}),false);
 assert.equal(Registry.validFiling({...Registry.records[0],date:"2027-01-01"}),false);
});

test("issuer 13 Nov 2026 share-capital return reconciles and avoids personal award allocation",()=>{
 const x=Registry.shareCapital();
 assert.equal(x.opening,2676339300);
 assert.equal(x.issued,3617000);
 assert.equal(x.closing,2679956300);
 assert.equal(x.opening+x.issued,x.closing);
 assert.equal(x.issuedPctOfOpening.toFixed(4),"0.1351");
 assert.equal(x.awardParticipants,255);
 assert.equal(x.directors+x.otherEmployees,255);
 assert.equal(x.directors,3);
 assert.equal(x.otherEmployees,252);
 assert.match(x.source,/2026111300646[.]pdf$/);
 assert.match(x.grantSource,/2026111201384[.]pdf$/);
});

test("filter category and search only curated source records, no arbitrary provider inputs",()=>{
 assert.equal(Registry.filterFilings().length,8);
 assert.equal(Registry.filterFilings("award","Share scheme").length,1);
 assert.equal(Registry.filterFilings("2026-10","All").length,2);
 assert.equal(Registry.filterFilings("results","Results").length,3);
 assert.equal(Registry.filterFilings("Six Months","Results").length,1);
 assert.equal(Registry.filterFilings("Allied","Corporate action").length,1);
 assert.deepEqual(Registry.filterFilings("anything","Unsupported category"),[]);
 assert.equal(Registry.filterFilings("confidential").length,0);
});

test("local cited briefing is source-only, period-specific and does not contain private user inputs",()=>{
 const brief=Registry.plainBrief(Registry.filterFilings("Allied"));
 assert.match(brief,/CURATED|Curated/);
 assert.match(brief,/2026-11-23/);
 assert.match(brief,/3,617,000/);
 assert.match(brief,/0\.1351%/);
 assert.match(brief,/255 participants/);
 assert.match(brief,/Allied Gold/);
 assert.match(brief,/https:\/\/www1\.hkexnews\.hk/);
 assert.doesNotMatch(brief,/financial advice|private personal award count|password|api key/i);
 assert.match(brief,/not automatically updated/i);
});

test("searchable disclosure desk is accessible, local-only, responsive and keeps official links separate from market data",()=>{
 for(const id of ["issuer-disclosures","issuer-filings-list","issuer-filing-search","issuer-filing-count","issuer-export","issuer-shares-opening","issuer-shares-issued","issuer-shares-closing","issuer-shares-percent","issuer-record-link"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/issuer-registry[.]js/);
 assert.match(html,/issuer-ui[.]js/);
 assert.match(html,/issuer-dossier[.]css/);
 assert.ok(html.indexOf("issuer-registry.js")<html.indexOf("issuer-ui.js"));
 assert.match(html,/aria-live="polite"/);
 assert.match(app,/createElement\(/);
 assert.match(app,/textContent/);
 assert.match(app,/issuer-filing-source/);
 assert.match(app,/noopener noreferrer/);
 assert.match(app,/replaceChildren/);
 assert.doesNotMatch(app,/innerHTML|localStorage|sessionStorage|XMLHttpRequest|fetch\s*\(|sendBeacon/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/prefers-reduced-motion/);
});
