/* Curated official HKEX issuer disclosure registry, reviewed 23 Nov 2026.
 * No crawling, no private grants, no derived market data.
 * Filing date is a publication date, not the underlying reporting period.
 */
(function(root){"use strict";
const REGISTRY_DATE="2026-11-23";
const OFFICIAL_REGISTER="https://www1.hkexnews.hk/search/titlesearch.xhtml?category=0&lang=EN&market=SEHK&stockId=1000274494";
const DATA=[
  {
    "date": "2026-11-13",
    "category": "Share capital",
    "title": "Next Day Disclosure Return",
    "scope": "Issued share capital",
    "detail": "3,617,000 new scheme shares issued to the trustee on 13 November 2026. Closing issued shares: 2,679,956,300. This is an issuer share-capital movement, not a trade.",
    "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/1113/2026111300646.pdf"
  },
  {
    "date": "2026-11-12",
    "category": "Share scheme",
    "title": "Grant of Award Shares",
    "scope": "Company-wide grant",
    "detail": "3,617,000 award shares granted to 255 selected participants, subject to acceptance. Public aggregate disclosure, not evidence of an individual's allocation or vesting.",
    "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/1112/2026111201384.pdf"
  },
  {
    "date": "2026-10-19",
    "category": "Results",
    "title": "Nine-Month 2026 Unaudited Operational and Financial Results",
    "scope": "Nine months ended 30 September 2026",
    "detail": "Approximately 41 tonnes of mined gold production over nine months. Unaudited issuer figures are not a full-year forecast.",
    "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/1019/2026101900153.pdf"
  },
  {
    "date": "2026-10-15",
    "category": "Share scheme",
    "title": "2026 Employee Share Incentive Scheme Circular",
    "scope": "Proposed scheme terms",
    "detail": "Official circular outlining the proposed share incentive scheme and general meeting. Distinguish scheme rules from individual grant terms.",
    "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/1015/2026101500327.pdf"
  },
  {
    "date": "2026-08-16",
    "category": "Results",
    "title": "Interim Results for Six Months Ended 30 June 2026",
    "scope": "Six-month interim period",
    "detail": "Official interim-results announcement including the interim dividend disclosure. Different reporting period from nine-month production.",
    "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0816/2026081600097.pdf"
  },
  {
    "date": "2026-07-29",
    "category": "Corporate action",
    "title": "Termination of Allied Gold Acquisition and Proposed Minority Subscription",
    "scope": "Proposed transaction",
    "detail": "Issuer announcement of termination of the 100% Allied Gold acquisition and a proposed 9.2% minority subscription. A proposal is not a completed acquisition.",
    "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0729/2026072901305.pdf"
  },
  {
    "date": "2026-06-08",
    "category": "Governance",
    "title": "Sustainable Development and Risk Management Committee Reorganisation",
    "scope": "Board governance",
    "detail": "The issuer announced the reorganisation of its risk committee and revised governance structure.",
    "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0608/2026060800462.pdf"
  },
  {
    "date": "2026-04-29",
    "category": "Results",
    "title": "Annual Report 2025",
    "scope": "Audited FY2025 report",
    "detail": "Official annual report covering the year ended 31 December 2025. Historical audited financial information, not an intraday market observation.",
    "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042902638.pdf"
  }
];
const records=Object.freeze(DATA.map(item=>Object.freeze(item)));
const fmt=new Intl.NumberFormat("en-GB",{maximumFractionDigits:4});
const CAPITAL=Object.freeze({date:"2026-11-13",opening:2676339300,issued:3617000,closing:2679956300,awardParticipants:255,otherEmployees:252,directors:3,issuePriceHKD:87.48,
source:"https://www1.hkexnews.hk/listedco/listconews/sehk/2026/1113/2026111300646.pdf",
grantSource:"https://www1.hkexnews.hk/listedco/listconews/sehk/2026/1112/2026111201384.pdf"});
const categories=Object.freeze(["All","Results","Share capital","Share scheme","Corporate action","Governance"]);
function validFiling(item){
 if(!item||typeof item!=="object")return false;
 if(!/^2026-\d\d-\d\d$/.test(item.date)||Number.isNaN(Date.parse(item.date+"T00:00:00Z")))return false;
 if(!categories.slice(1).includes(item.category))return false;
 if(!item.title||!item.detail||!item.scope)return false;
 try{const url=new URL(item.url);return url.protocol==="https:"&&url.hostname==="www1.hkexnews.hk"&&/^\/listedco\/listconews\/sehk\/2026\/\d{4}\/\d{13}\.pdf$/.test(url.pathname)&&url.search===""&&url.hash==="";}
 catch{return false;}
}
function filterFilings(query="",category="All"){
 const needle=String(query).trim().toLocaleLowerCase("en");
 if(!categories.includes(category))return [];
 return records.filter(f=>validFiling(f)&&(category==="All"||f.category===category)&&
 (!needle||[f.date,f.category,f.title,f.scope,f.detail].some(v=>v.toLocaleLowerCase("en").includes(needle))));
}
function shareCapital(){
 const x=CAPITAL;
 if(x.opening+x.issued!==x.closing)throw Error("Equity bridge failed");
 return Object.freeze({...x,issuedPctOfOpening:x.issued/x.opening*100,closingFormatted:fmt.format(x.closing)});
}
function plainBrief(items=records){
 const x=shareCapital();
 return [
 "ZIJIN GOLD INTERNATIONAL | OFFICIAL ISSUER DISCLOSURE BRIEF",
 "Curated source review: "+REGISTRY_DATE+". Not a live filing notification service.",
 "Issuer: Zijin Gold International Company Limited | HKEX:02259",
 "Authoritative issuer filing register: "+OFFICIAL_REGISTER,
 "",
 "SHARE-CAPITAL MOVEMENT | 13 NOV 2026",
 "Opening shares (31 Oct): "+x.opening.toLocaleString("en-GB"),
 "New shares issued to trustee (13 Nov): "+x.issued.toLocaleString("en-GB"),
 "Closing shares (13 Nov): "+x.closing.toLocaleString("en-GB"),
 "Change / opening shares: "+x.issuedPctOfOpening.toFixed(4)+"%",
 "Company-wide awards announced (12 Nov): "+x.issued.toLocaleString("en-GB")+" shares / "+x.awardParticipants+" participants; subject to acceptance.",
 "These are issuer aggregates. They do not establish an individual's grant, vesting, tax treatment or cash entitlement.",
 "Filing: "+x.source,
 "Grant announcement: "+x.grantSource,
 "",
 "OFFICIAL FILINGS (CURATED)"
 ].concat(items.map(f=>f.date+" | "+f.category+" | "+f.title+"\n"+
   "Scope: "+f.scope+"\nDisclosure: "+f.detail+"\nPrimary source: "+f.url+"\n"))
  .concat(["","Source list is curated, not automatically updated. Open the HKEX register to check new filings."]).join("\n");
}
const API=Object.freeze({REGISTRY_DATE,OFFICIAL_REGISTER,records,categories,validFiling,filterFilings,shareCapital,plainBrief});
if(typeof module==="object"&&module.exports)module.exports=API;
if(root)root.ZGIIssuerRegistry=API;
})(typeof window!=="undefined"?window:null);
