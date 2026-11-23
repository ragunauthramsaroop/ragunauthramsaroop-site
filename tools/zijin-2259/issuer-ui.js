/* First-party searchable HKEX issuer evidence desk. Deliberately static/curated. */
(()=>{"use strict";
const Registry=window.ZGIIssuerRegistry;
const $=id=>document.getElementById(id);
const container=$("issuer-disclosures");
if(!Registry||!container)return;
const list=$("issuer-filings-list"),input=$("issuer-filing-search"),count=$("issuer-filing-count"),status=$("issuer-copy-status");
const integer=new Intl.NumberFormat("en-GB",{maximumFractionDigits:0});
const shortDate=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});
let category="All";
function element(tag,className,text){
 const n=document.createElement(tag);
 if(className)n.className=className;
 if(text!==undefined)n.textContent=text;
 return n;
}
function link(href,label,aria){
 const a=element("a","issuer-filing-source",label);
 a.href=href;a.target="_blank";a.rel="noopener noreferrer";
 a.setAttribute("aria-label",aria);
 return a;
}
function card(f){
 const article=element("article","issuer-filing-card");
 const meta=element("div","issuer-filing-meta");
 meta.append(element("span","issuer-filing-kind",f.category),element("time","issuer-filing-date",shortDate.format(new Date(f.date+"T12:00:00Z"))));
 meta.lastChild.dateTime=f.date;
 article.append(meta,element("h4","issuer-filing-title",f.title));
 article.append(element("p","issuer-filing-scope",f.scope));
 article.append(element("p","issuer-filing-description",f.detail));
 const foot=element("div","issuer-filing-foot");
 foot.append(element("span","issuer-filing-source-type","HKEX issuer document"),link(f.url,"OPEN PRIMARY FILING ↗","Open official HKEX filing: "+f.title));
 article.append(foot);
 return article;
}
function render(){
 const items=Registry.filterFilings(input.value,category);
 list.replaceChildren(...items.map(card));
 if(!items.length)list.append(element("p","issuer-empty","No curated filing matches. Open the official HKEX issuer register to search the complete record."));
 count.textContent=items.length+" OF "+Registry.records.length+" REVIEWED FILINGS";
 $("issuer-disclosure-state").textContent=category==="All"?"ALL CATEGORIES":"FILTER: "+category.toUpperCase();
 for(const b of container.querySelectorAll("[data-issuer-filter]")){
  const active=b.dataset.issuerFilter===category;
  b.classList.toggle("is-active",active);
  b.setAttribute("aria-pressed",String(active));
 }
}
function saveBrief(){
 const data=Registry.filterFilings(input.value,category);
 const text=Registry.plainBrief(data);
 const blob=new Blob([text+"\n"],{type:"text/plain;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="zijin-2259-official-filing-brief-2026-11-23.txt";
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 status.textContent="Source-only brief exported locally. This register is curated, not a live disclosure feed.";
}
const capital=Registry.shareCapital();
$("issuer-shares-opening").textContent=integer.format(capital.opening);
$("issuer-shares-issued").textContent="+"+integer.format(capital.issued);
$("issuer-shares-closing").textContent=integer.format(capital.closing);
$("issuer-shares-percent").textContent="+"+capital.issuedPctOfOpening.toFixed(4)+"%";
$("issuer-grant-participants").textContent=integer.format(capital.awardParticipants)+" SELECTED PARTICIPANTS";
$("issuer-verified-at").textContent="Curated "+Registry.REGISTRY_DATE+" · Official filings to 13 Nov";
$("issuer-record-link").href=Registry.OFFICIAL_REGISTER;
input.addEventListener("input",render);
input.addEventListener("keydown",e=>{if(e.key==="Escape"){input.value="";render();}});
for(const b of container.querySelectorAll("[data-issuer-filter]")){
 b.addEventListener("click",()=>{category=b.dataset.issuerFilter;render();});
}
$("issuer-export")?.addEventListener("click",saveBrief);
render();
})();
