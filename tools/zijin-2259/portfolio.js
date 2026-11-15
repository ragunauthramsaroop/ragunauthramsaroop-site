/* Audited 2025 producing-asset breakdown from Zijin Gold International annual report.
 * All production figures are static labelled FY2025 actuals, not real-time or inferred 2029 outputs.
 * Company-level guidance is separately labelled 2026/2028 targets.
*/
(()=>{
"use strict";
const data=[
 {name:"Buriticá",country:"Colombia",v25:8.8,v24:10.0},
 {name:"Rosebel",country:"Suriname",v25:8.3,v24:7.5},
 {name:"Norton Gold Fields",country:"Australia",v25:7.9,v24:8.3},
 {name:"Taldybulak Levoberezhny",country:"Kyrgyzstan",v25:3.5,v24:3.7},
 {name:"Aurora",country:"Guyana",v25:4.5,v24:4.1},
 {name:"Jilau and Taror",country:"Tajikistan",v25:6.1,v24:5.4},
 {name:"Akyem",country:"Ghana",v25:5.1,v24:null},
 {name:"Raygorodok",country:"Kazakhstan",v25:1.2,v24:null},
 {name:"Porgera",country:"Papua New Guinea",v25:1.5,v24:null}
];
const total25=data.reduce((s,x)=>s+x.v25,0),legacy25=data.filter(x=>x.v24!==null).reduce((s,x)=>s+x.v25,0),legacy24=data.filter(x=>x.v24!==null).reduce((s,x)=>s+x.v24,0);
const byId=id=>document.getElementById(id),mk=(tag,cls,text)=>{
 const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x
};
const label=x=>x.toFixed(1)+" t";
function draw(){
 const bars=byId("mine-bars");if(!bars)return;
 const filter=byId("mine-filter")?.value||"all",sort=byId("mine-sort")?.value||"production";
 let series=data.filter(x=>filter==="legacy"?x.v24!==null:filter==="new"?x.v24===null:true).slice();
 if(sort==="production")series.sort((a,b)=>b.v25-a.v25);
 if(sort==="name")series.sort((a,b)=>a.name.localeCompare(b.name));
 if(sort==="country")series.sort((a,b)=>a.country.localeCompare(b.country));
 bars.replaceChildren();
 for(const mine of series){
  const button=mk("button","mine-row");button.type="button";
  button.setAttribute("aria-label",mine.name+" "+mine.country+" FY2025 mined gold "+label(mine.v25));
  const head=mk("div","mine-row-head");
  const title=mk("span","",mine.name+" · "+mine.country);
  const volume=mk("strong","",label(mine.v25)+"  /  "+(mine.v25/total25*100).toFixed(1)+"%");
  head.append(title,volume);
  const track=mk("div","mine-row-track"),fill=mk("i","mine-row-fill");
  fill.style.width=(mine.v25/8.8*100)+"%";track.append(fill);
  const foot=mk("small","",mine.v24===null?"2024 comparable unavailable (2025 acquisition/entry)":"FY2024: "+label(mine.v24)+"  ·  "+(mine.v25-mine.v24>=0?"+":"")+(mine.v25-mine.v24).toFixed(1)+" t change");
  button.append(head,track,foot);
  button.addEventListener("click",()=>select(mine));
  bars.append(button);
 }
}
function select(mine){
 const root=byId("mine-selection");if(!root)return;
 root.replaceChildren();
 const heading=mk("strong","",mine.name+" · "+mine.country),text=mk("p","",mine.v24===null?"FY2025 production "+label(mine.v25)+"; no comparable FY2024 group production shown for the acquired/newly reported asset.": "FY2025 "+label(mine.v25)+" versus FY2024 "+label(mine.v24)+", a "+(mine.v25>=mine.v24?"gain":"decline")+" of "+Math.abs((mine.v25/mine.v24-1)*100).toFixed(1)+"%."); 
 const note=mk("small","","Output contribution: "+(mine.v25/total25*100).toFixed(1)+"% of FY2025 consolidated production. These are historical audited operating figures, not stock forecasts.");
 root.append(heading,text,note);
}
function donut(){
 const host=byId("mine-donut");if(!host)return;
 const top=data.slice().sort((a,b)=>b.v25-a.v25).slice(0,3);
 const share=top.reduce((s,x)=>s+x.v25,0)/total25;
 const W=490,H=276,cx=245,cy=122,r=77,ring=23,circ=2*Math.PI*r;
 const arc=(value,start,color)=>{
  const length=value*circ;
  return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+ring+'" stroke-dasharray="'+length+' '+(circ-length)+'" stroke-dashoffset="'+(-start*circ)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
 };
 let svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Top three FY2025 producing operations account for '+(share*100).toFixed(1)+' percent of gold production.">';
 svg+=arc(1,0,"#2e3d4a")+arc(share,0,"#d8b173");
 svg+='<text x="'+cx+'" y="'+(cy+3)+'" text-anchor="middle" font-size="43" font-weight="800" fill="#f1d49e" font-family="Manrope,sans-serif">'+(share*100).toFixed(1)+'%</text>';
 svg+='<text x="'+cx+'" y="'+(cy+25)+'" text-anchor="middle" font-size="12" font-weight="700" fill="#aab8c5">TOP THREE</text>';
 svg+='<text x="'+cx+'" y="'+(H-12)+'" font-size="13" fill="#92a6b7" text-anchor="middle">Buriticá · Rosebel · Norton</text></svg>';
 host.innerHTML=svg;
 const facts=byId("mine-insights");if(!facts)return;facts.replaceChildren();
 const notes=[
  ["AUDITED FY2025 TOTAL",label(total25)+" in production across nine mine groups"],
  ["PRE-EXISTING OPERATIONS",label(legacy25)+" in 2025 against "+label(legacy24)+" FY2024 comparators"],
  ["NEW 2025 CONTRIBUTIONS",label(total25-legacy25)+" from Akyem, Raygorodok and Porgera"],
  ["OUTPUT CONCENTRATION",top.map(x=>x.name).join(", ")+": "+label(top.reduce((s,x)=>s+x.v25,0))]
 ];
 for(const [title,desc] of notes){
  const line=mk("div","mine-fact");line.append(mk("span","",title),mk("strong","",desc));facts.append(line);
 }
}
byId("mine-sort")?.addEventListener("change",draw);
byId("mine-filter")?.addEventListener("change",draw);
draw();donut();select(data.find(x=>x.name==="Aurora"));
})();