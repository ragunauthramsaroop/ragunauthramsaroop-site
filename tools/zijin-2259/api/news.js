/* Third-party headlines, fetched server-side from Google News RSS.
   Not HKEX regulatory filings or official issuer announcements.
   Only links to trusted Google News result URLs, no HTML rendered from RSS. */
const safeText=s=>String(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
 .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
 .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(parseInt(n,10)))
 .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;/g,"'")
 .replace(/&lt;/g,"<").replace(/&gt;/g,">")
 .replace(/<[^>]+>/g,"").trim();
const field=(entry,tag)=>{
 const m=entry.match(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">","i"));
 return m?safeText(m[1]):"";
};
module.exports = async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
 res.setHeader("Content-Type","application/json; charset=utf-8");
 if(req.method==="OPTIONS")return res.status(204).end();
 if(req.method!=="GET")return res.status(405).json({ok:false,message:"GET only"});
 res.setHeader("Cache-Control","public, s-maxage=600, stale-while-revalidate=300");
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7500);
 try{
  const q=encodeURIComponent('"Zijin Gold International" OR "Zijin Gold" 2259');
  const url="https://news.google.com/rss/search?q="+q+"&hl=en-US&gl=US&ceid=US:en";
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; MarketResearch/1.0)","Accept":"application/xml,text/xml,application/rss+xml"},signal:controller.signal});
  if(!response.ok)return res.status(503).json({ok:false,message:"News source unreachable",checkedAt:new Date().toISOString()});
  const xml=await response.text();
  if(!xml.includes("<rss")||xml.length>2000000)return res.status(503).json({ok:false,message:"Unexpected news response"});
  const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  const news=[];
  for(const item of items){
    const title=field(item,"title"),link=field(item,"link"),date=field(item,"pubDate"),source=field(item,"source");
    if(!/zijin/i.test(title)||!/(gold|2259|international)/i.test(title))continue;
    let host;try{host=new URL(link).hostname}catch{continue}
    if(host!=="news.google.com")continue;
    const dt=new Date(date);
    if(!Number.isFinite(dt.getTime()))continue;
    if(!news.some(n=>n.title===title))news.push({title:title.slice(0,240),url:link,source:source.slice(0,100),publishedAt:dt.toISOString()});
    if(news.length>=10)break;
  }
  return res.status(200).json({ok:true,source:"Google News search RSS, third-party headlines",notOfficialFilings:true,checkedAt:new Date().toISOString(),articles:news});
 }catch(e){return res.status(503).json({ok:false,message:"News temporarily unavailable",checkedAt:new Date().toISOString()})}
 finally{clearTimeout(timeout)}
}
