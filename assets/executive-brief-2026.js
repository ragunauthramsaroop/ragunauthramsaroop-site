/* Executive Brief: shareable, source-scoped, printable. No third-party code. */
(() => {
 "use strict";
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const views={
  board:{edition:"01 / BOARD & CEO",title:["Institutional judgement.","Accountable execution."],intro:"A director-level professional record spanning government relations, corporate compliance, social responsibility and operational leadership in natural resources.",priorities:[["Institutional engagement","Government and regulatory relationships across complex operating priorities."],["Governance oversight","Corporate compliance and legal department management oversight."],["Responsible growth","Social responsibility, stakeholder relationships and coordinated delivery."]],context:"Regulated financial services experience preceded the move to AGM Inc. in 2020. Responsibilities expanded through progressive assignments, with a director-level appointment beginning in 2025.",ids:["professional-role","ungis-mcg-2026","professional-tenure"],note:"This brief summarises a first-party career record and specifically scoped sources. Memberships and programme listings have distinct evidentiary boundaries. Company operating results are not personal performance claims."},
  recruiter:{edition:"02 / EXECUTIVE SEARCH",title:["A defined remit.","A documented progression."],intro:"Career progression from financial services into multinational mining, spanning compliance, public affairs, ESG and operational coordination.",priorities:[["Career progression","Financial services experience began in 2016. AGM Inc. employment began in 2020."],["Director appointment","Progression into the Liaison Director role began in 2025."],["Management remit","Government affairs, legal department oversight and cross-functional leadership."]],context:"The source record distinguishes first-party career statements from externally listed professional participation. Review the CV and supporting sources to establish the precise scope of each claim.",ids:["professional-role","professional-tenure","management-development"],note:"Career dates and management scope are first-party statements unless a linked source establishes otherwise. This document is not a reference check or independent endorsement."},
  speaker:{edition:"03 / CONFERENCES & MEDIA",title:["Public dialogue.","Practical responsibility."],intro:"Conversations linking responsible mining, the energy transition, institutional governance and leadership responsibilities.",priorities:[["Speaking topics","Responsible mining, social performance, government relations and energy transition."],["External programme","Caribbean Renewable Energy Forum listed an Aurora Gold Mine case study for October 2026."],["Speaking materials","The website provides event briefings, a professional biography and contact routes."]],context:"Public speaking programmes are distinct from independent assessments of personal or corporate performance. Organiser listings establish a scheduled engagement, not necessarily independent confirmation of attendance.",ids:["cref-programme","professional-role","ungis-mcg-2026"],note:"An organiser programme is evidence of a scheduled engagement. Verify event participation directly with the organiser when independent confirmation is required."}
 };
 let current="board",registry=null;
 const options=$$("[data-brief]"),status=$("#action-status");
 function safeUrl(raw){try{const u=new URL(raw,location.origin);return u.protocol==="https:"||(u.protocol==="http:"&&u.origin===location.origin)?u:null;}catch{return null;}}
 function renderSources(){
  if(!registry||!Array.isArray(registry.claims))return;
  const byId=new Map(registry.claims.map(c=>[c.id,c])),out=document.createDocumentFragment();
  let count=0;
  views[current].ids.forEach((id,i)=>{
    const claim=byId.get(id);if(!claim||!Array.isArray(claim.evidence))return;
    const ev=claim.evidence.find(x=>safeUrl(x.url));if(!ev)return;
    const url=safeUrl(ev.url),box=document.createElement("div"),label=document.createElement("span"),link=document.createElement("a");
    label.textContent=String(i+1).padStart(2,"0")+" / "+claim.classification.replaceAll("_"," ").toUpperCase();
    link.href=url.href;link.textContent=ev.label+" ↗";
    if(url.origin!==location.origin){link.target="_blank";link.rel="noopener noreferrer";}
    box.append(label,link);out.appendChild(box);count++;
  });
  if(count===3)$("#source-list").replaceChildren(out);
 }
 function choose(name,setUrl=false){
  const v=views[name];if(!v)return;current=name;
  for(const a of options){const active=a.dataset.brief===name;a.classList.toggle("is-selected",active);active?a.setAttribute("aria-current","true"):a.removeAttribute("aria-current");}
  $("#brief-edition").textContent=v.edition;
  const emphasized=document.createElement("em");emphasized.textContent=v.title[1];
  $("#brief-title").replaceChildren(document.createTextNode(v.title[0]),document.createElement("br"),emphasized);
  $("#brief-intro").textContent=v.intro;$("#brief-context").textContent=v.context;$("#brief-limit").textContent=v.note;
  const out=document.createDocumentFragment();
  v.priorities.forEach(([headline,summary],i)=>{
   const box=document.createElement("div"),num=document.createElement("span"),strong=document.createElement("strong"),p=document.createElement("p");
   num.textContent=String(i+1).padStart(2,"0");strong.textContent=headline;p.textContent=summary;box.append(num,strong,p);out.appendChild(box);
  });$("#priorities").replaceChildren(out);
  renderSources();
  if(setUrl&&history.replaceState){const u=new URL(location.href);u.searchParams.set("lens",name);history.replaceState(null,"",u.pathname+u.search+u.hash);}
  status.textContent="";
 }
 if(options.length===3){
  options.forEach(a=>a.addEventListener("click",e=>{e.preventDefault();choose(a.dataset.brief,true);}));
  const requested=new URLSearchParams(location.search).get("lens");choose(Object.prototype.hasOwnProperty.call(views,requested)?requested:"board");
 }
 fetch("/api/v1/executive-record.json",{credentials:"same-origin",cache:"force-cache"})
  .then(r=>{if(!r.ok)throw Error("Record unavailable");return r.json();})
  .then(data=>{if(!Array.isArray(data.claims)||data.claims.length!==6)throw Error("Record changed");registry=data;renderSources();status.textContent="References matched to the public executive record dated "+data.issuedAt+".";})
  .catch(()=>{status.textContent="The current source register is unavailable. The default source links remain in the brief.";});
 $("#print-brief")?.addEventListener("click",()=>window.print());
 $("#copy-brief")?.addEventListener("click",async()=>{
  const u=new URL(location.href);u.searchParams.set("lens",current);
  try{if(!navigator.clipboard?.writeText)throw Error("No clipboard");await navigator.clipboard.writeText(u.href);status.textContent="Shareable briefing link copied.";}
  catch{status.textContent="Use your browser Share function to copy this briefing link.";}
 });
})();
