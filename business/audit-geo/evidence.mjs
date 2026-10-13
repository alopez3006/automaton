import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function publicAddress(address) {
  if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===198&&(b===18||b===19||b===51)||a===203&&b===0||a===100&&b>=64&&b<=127);}
  if(isIP(address)===6){const s=address.toLowerCase();return s.startsWith('2')||s.startsWith('3') ? !s.startsWith('2001:db8')&&!s.startsWith('2001:0:')&&!s.startsWith('2002:') : false;}
  return false;
}
export async function publicFetch(target, redirects=0) {
  const url=new URL(target);if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(url.hostname)||url.hostname.includes(':'))throw Error('Public HTTPS hostname required');
  const ips=await lookup(url.hostname,{all:true,verbatim:true});if(!ips.length||ips.some(i=>!publicAddress(i.address)))throw Error('Private/reserved DNS address rejected');
  const ip=ips.find(i=>i.family===4)??ips[0];
  const result=await new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{'User-Agent':'AuditGEO-Pilot/1.0 (public technical audit)','Accept-Encoding':'identity'},lookup:(_host,_opts,cb)=>cb(null,_opts?.all?[{address:ip.address,family:ip.family}]:ip.address,ip.family)},res=>{
      const chunks=[];let size=0;res.on('data',c=>{size+=c.length;if(size>120000){req.destroy(Error('Evidence exceeds 120 KB'));return;}chunks.push(c);});res.on('end',()=>resolve({url:url.href,status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8'),observedAt:new Date().toISOString()}));res.on('error',reject);
    });req.setTimeout(10000,()=>req.destroy(Error('Evidence request timed out')));req.on('error',reject);
  });
  if(result.status>=300&&result.status<400&&result.headers.location){if(redirects>=3)throw Error('Too many redirects');return publicFetch(new URL(result.headers.location,url).href,redirects+1);}
  return result;
}
// Raw HTML evidence only: this is not a rendered-browser or schema-validity audit.
function attributes(tag) {
  const result={};
  for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[m[1].toLowerCase()]=m[2]??m[3]??m[4];
  return result;
}
function textContent(value) { return value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,1000); }
export function extractHtml(body) {
  const structuredData=[];
  let jsonLdCount=0;
  for(const m of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(attributes(m[1]).type?.toLowerCase()!=='application/ld+json') continue;
    jsonLdCount++;
    if(structuredData.length>=10) continue;
    if(m[2].length>12000){structuredData.push({status:'too_large',characters:m[2].length});continue;}
    try{structuredData.push({status:'parsed',value:JSON.parse(m[2])});}
    catch{structuredData.push({status:'invalid_json',excerpt:m[2].slice(0,500)});}
  }
  const meta=[...body.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0]));
  const links=[...body.matchAll(/<link\b[^>]*>/gi)].map(m=>attributes(m[0]));
  const clean=body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  return {
    title:textContent(clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??''),
    descriptions:meta.filter(m=>m.name?.toLowerCase()==='description').map(m=>m.content??''),
    robots:meta.filter(m=>['robots','googlebot'].includes(m.name?.toLowerCase())).map(m=>({agent:m.name,content:m.content??''})),
    canonicals:links.filter(m=>m.rel?.toLowerCase().split(/\s+/).includes('canonical')).map(m=>m.href??''),
    h1:[...clean.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].slice(0,20).map(m=>textContent(m[1])),
    structuredData:{status:jsonLdCount?'observed':'not_observed_in_raw_html',blockCount:jsonLdCount,blocks:structuredData,truncated:jsonLdCount>10},
    body:clean.slice(0,16000),bodyTruncated:clean.length>16000,
    limitations:['Raw HTML only; JavaScript-rendered content is unmeasured','Parsed JSON is not schema correctness or rich-result eligibility']
  };
}
export function internalCandidates(body,base,{sitemap=false}={}) {
  const matches=sitemap?[...body.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(m=>m[1]):[...body.matchAll(/<a\b[^>]*>/gi)].map(m=>attributes(m[0]).href);
  const result=[];
  for(const value of matches){
    if(!value)continue;
    try{const u=new URL(value.replace(/&amp;/g,'&').trim(),base);u.hash='';
      if(u.origin!==new URL(base).origin||u.protocol!=='https:'||u.username||u.password||u.search||/\.(?:xml|pdf|png|jpe?g|gif|webp|zip|css|js)$/i.test(u.pathname))continue;
      if(!result.includes(u.href))result.push(u.href);
    }catch{}
    if(result.length>=20)break;
  }
  return result;
}
export async function collectEvidence(website,{pagespeed=false,fetchPage=publicFetch}={}) {
  const url=new URL(website);
  const raw=new Map();
  async function observe(target,kind){
    try{const r=await fetchPage(target);
      if(new URL(r.url).origin!==url.origin)return {url:target,observedAt:r.observedAt,error:'Cross-origin redirect excluded from evidence'};
      raw.set(target,r);
      const html=String(r.headers['content-type']??'').includes('text/html');
      return {...r,kind,...(html?extractHtml(r.body):{body:r.body.slice(0,16000),bodyTruncated:r.body.length>16000}),headers:{'content-type':r.headers['content-type'],'x-robots-tag':r.headers['x-robots-tag']??null}};
    }catch(e){return {url:target,kind,observedAt:new Date().toISOString(),error:e.message};}
  }
  const resources=[url.href,new URL('/robots.txt',url).href,new URL('/sitemap.xml',url).href];
  const observations=await Promise.all(resources.map((target,i)=>observe(target,i?'discovery':'page')));
  const homepage=raw.get(url.href),sitemap=raw.get(resources[2]);
  const candidates=[...internalCandidates(homepage?.status===200?homepage.body:'',homepage?.url??url.href),...internalCandidates(sitemap?.status===200?sitemap.body:'',url.href,{sitemap:true})];
  const selected=[...new Set(candidates)].filter(u=>!resources.includes(u)&&u!==homepage?.url).slice(0,4);
  for(const target of selected)observations.push(await observe(target,'page'));
  let performance={status:'not_requested'};
  if(pagespeed){try{const api=new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');api.searchParams.set('url',url.href);api.searchParams.set('strategy','mobile');const r=await fetch(api,{signal:AbortSignal.timeout(25000),redirect:'error'});if(!r.ok)throw Error(`HTTP ${r.status}`);const j=await r.json();performance={status:'available',observedAt:new Date().toISOString(),source:api.href,performanceScore:j.lighthouseResult?.categories?.performance?.score??null};}catch(e){performance={status:'unavailable',observedAt:new Date().toISOString(),reason:e.message};}}
  return {website,observations,performance,scope:{maxAdditionalPages:4,selectedPages:selected,selection:'First unique same-origin HTML links, then sitemap URLs; no query strings',limitations:['Bounded sample, not a complete crawl','Sitemap indexes are not recursively followed','Missing raw HTML markup does not prove absence in rendered DOM']},unmeasured:['Google Search Console position','consumer ChatGPT visibility','consumer Claude visibility','LLM API prompt cohort']};
}
