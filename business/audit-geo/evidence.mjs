import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { evaluateRobots } from './robots.mjs';

// Conservative global-unicast allowlist; reject special-use/tunnel ranges.
function ipv6Number(address) {
  const halves=address.split('::');
  const left=halves[0]?halves[0].split(':'):[];
  const right=halves[1]?halves[1].split(':'):[];
  const words=halves.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;
  return words.reduce((n,w)=>(n<<16n)+BigInt('0x'+w),0n);
}
function inV6Range(value,base,bits) { const shift=128n-BigInt(bits);return value>>shift===ipv6Number(base)>>shift; }
export function publicAddress(address) {
  if(isIP(address)===4){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&c===0||b===0&&c===2)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113||a===100&&b>=64&&b<=127);}
  if(isIP(address)===6){
    if(address.includes('.')||address.includes('%'))return false;
    const n=ipv6Number(address);
    return inV6Range(n,'2000::',3)&&!['2001::/23','2001:db8::/32','2002::/16','3fff::/20'].some(range=>{const [base,bits]=range.split('/');return inV6Range(n,base,Number(bits));});
  }
  return false;
}
function bounded(promise,ms) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Evidence total deadline exceeded')),ms);
    Promise.resolve(promise).then(resolve,reject).finally(()=>clearTimeout(timer));
  });
}
// Injection is for deterministic network-policy tests; runtime uses Node DNS/HTTPS.
export function createPublicFetcher({resolveHost=lookup,get=https.get,totalTimeoutMs=10000,maxBytes=120000,responseEncoding='utf8',followRedirects=true}={}) {
  if(!Number.isSafeInteger(totalTimeoutMs)||totalTimeoutMs<=0||!Number.isSafeInteger(maxBytes)||maxBytes<=0)throw Error('Invalid fetch bounds');
  if(!['utf8','buffer'].includes(responseEncoding)||typeof followRedirects!=='boolean')throw Error('Invalid response mode');
  return async function fetchPublic(target) {
    const deadline=Date.now()+totalTimeoutMs;
    const remaining=()=>{const ms=deadline-Date.now();if(ms<=0)throw Error('Evidence total deadline exceeded');return ms;};
    async function visit(target,redirects) {
      const url=new URL(target);if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(url.hostname)||url.hostname.includes(':'))throw Error('Public HTTPS hostname required');
      const ips=await bounded(resolveHost(url.hostname,{all:true,verbatim:true}),remaining());
      if(!ips.length||ips.some(i=>!publicAddress(i.address)||isIP(i.address)!==i.family))throw Error('Private/reserved DNS address rejected');
      const ip=ips.find(i=>i.family===4)??ips[0];
      const timeout=remaining();
      const result=await new Promise((resolve,reject)=>{
        let req,timer,settled=false;
        const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);req?.destroy(error);};
        timer=setTimeout(()=>fail(Error('Evidence total deadline exceeded')),timeout);
        try{req=get(url,{headers:{'User-Agent':'AuditGEO-Pilot/1.0 (public technical audit)','Accept-Encoding':'identity'},lookup:(_host,_opts,cb)=>cb(null,_opts?.all?[{address:ip.address,family:ip.family}]:ip.address,ip.family)},res=>{
          const chunks=[];let size=0;
          res.on('error',fail);res.on('aborted',()=>fail(Error('Evidence response aborted')));
          res.on('data',c=>{size+=c.length;if(size>maxBytes){fail(Error('Evidence exceeds byte limit'));return;}chunks.push(c);});
          res.on('end',()=>{if(settled)return;settled=true;clearTimeout(timer);const bytes=Buffer.concat(chunks);resolve({url:url.href,status:res.statusCode,headers:res.headers,body:responseEncoding==='buffer'?bytes:bytes.toString('utf8'),observedAt:new Date().toISOString()});});
        });req.on('error',fail);}catch(e){fail(e);}
      });
      if(followRedirects&&result.status>=300&&result.status<400&&result.headers.location){if(redirects>=3)throw Error('Too many redirects');return visit(new URL(result.headers.location,url).href,redirects+1);}
      return result;
    }
    return visit(target,0);
  };
}
export const publicFetch=createPublicFetcher();
// Raw HTML evidence only: this is not a rendered-browser or schema-validity audit.
function attributes(tag) {
  const result={};
  for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[m[1].toLowerCase()]=m[2]??m[3]??m[4];
  return result;
}
function textContent(value) { return value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,1000); }
// Sample across the fetched document, rather than only its opening markup.
// These excerpts establish presence, never absence or complete DOM coverage.
export function extractSections(clean) {
  const headings=[...clean.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const count=Math.min(headings.length,12);
  const sections=Array.from({length:count},(_,i)=>{
    const index=count===1?0:Math.round(i*(headings.length-1)/(count-1));
    const h=headings[index];
    const heading=textContent(h[2]);
    const passage=clean.slice(h.index+h[0].length,headings[index+1]?.index??clean.length)
      .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return {heading:heading.slice(0,200),headingTruncated:heading.length>200,
      level:Number(h[1]),headingIndex:index,text:passage.slice(0,700),
      textTruncated:passage.length>700};
  });
  return {sections,sectionCoverage:{headingCount:headings.length,retained:count,
    omitted:headings.length-count,selection:'Up to 12 evenly spaced headings in document order; up to 700 text characters per section',
    limitations:['Raw HTML heading sections only; content before the first heading is not sampled here','Omitted or truncated passages cannot support absence claims; HTML entities are not decoded']}};
}
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
    ...extractSections(clean),
    limitations:['Raw HTML only; JavaScript-rendered content is unmeasured','Parsed JSON is not schema correctness or rich-result eligibility']
  };
}
// URL validation is shared; HTML entity decoding belongs only to discovery.
function canonicalCandidate(value,base) {
  if(typeof value!=='string'||!value.trim())return null;
  try{const u=new URL(value.trim(),base);u.hash='';
    if(u.origin!==new URL(base).origin||u.protocol!=='https:'||u.username||u.password||u.search||/\.(?:xml|pdf|png|jpe?g|gif|webp|zip|css|js)$/i.test(u.pathname))return null;
    return u.href;
  }catch{return null;}
}
export function internalCandidates(body,base,{sitemap=false}={}) {
  const matches=sitemap?[...body.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(m=>m[1]):[...body.matchAll(/<a\b[^>]*>/gi)].map(m=>attributes(m[0]).href);
  const result=[];
  for(const value of matches){
    if(typeof value!=='string')continue;
    const safe=canonicalCandidate(value.replace(/&amp;/g,'&'),base);
    if(safe&&!result.includes(safe))result.push(safe);
    if(result.length>=20)break;
  }
  return result;
}
// Keep API evidence bounded; missing lab/field measurements are never zero scores.
export function summarizePageSpeed(data,source) {
  const lh=data?.lighthouseResult;
  if(!lh || lh.runtimeError || !lh.audits || typeof lh.audits!=='object') throw Error('Lighthouse result unavailable');
  const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  const short=v=>typeof v==='string'?v.slice(0,600):null;
  const score=finite(lh.categories?.performance?.score);
  const metrics=['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift'].map(id=>{
    const a=lh.audits[id];return {id,value:finite(a?.numericValue),unit:short(a?.numericUnit),displayValue:short(a?.displayValue)};
  });
  const diagnostics=Object.entries(lh.audits).filter(([id,a])=>a&&typeof a==='object'&&finite(a.score)!==null&&a.score<1&&!['notApplicable','manual','informative','error'].includes(a.scoreDisplayMode)&&!metrics.some(m=>m.id===id))
    .sort((a,b)=>a[1].score-b[1].score).slice(0,12).map(([id,a])=>({id,title:short(a.title),description:short(a.description),score:a.score,displayValue:short(a.displayValue),savingsMs:finite(a.details?.overallSavingsMs),savingsBytes:finite(a.details?.overallSavingsBytes)}));
  const field=e=>!e?.metrics?{status:'unavailable'}:{status:'available',scope:short(e.id),overallCategory:short(e.overall_category),metrics:Object.entries(e.metrics).slice(0,10).map(([id,m])=>({id,percentile:finite(m?.percentile),category:short(m?.category)}))};
  return {status:'available',observedAt:new Date().toISOString(),source,strategy:'mobile',performanceScore:score!==null&&score>=0&&score<=1?score:null,lighthouseVersion:short(lh.lighthouseVersion),fetchTime:short(lh.fetchTime),requestedUrl:short(lh.requestedUrl),finalUrl:short(lh.finalUrl),metrics,diagnostics,field:{page:field(data.loadingExperience),origin:field(data.originLoadingExperience)},limitations:['Single mobile laboratory run; not real-user Core Web Vitals or ranking proof','Origin field data is not page-specific; absent field data is unknown','Diagnostic suggestions require validation before changes']};
}
export async function collectPageSpeed(url,{fetchApi=fetch}={}) {
  const api=new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url',url);api.searchParams.set('strategy','mobile');
  try {
    const r=await fetchApi(api,{signal:AbortSignal.timeout(25000),redirect:'error'});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    // Lighthouse responses can be large; do not retain screenshot/DOM payloads.
    const reader=r.body.getReader();let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('PageSpeed response exceeds 2 MB');chunks.push(value);}}finally{await reader.cancel();}
    return summarizePageSpeed(JSON.parse(Buffer.concat(chunks).toString('utf8')),api.href);
  }catch(e){return {status:'unavailable',observedAt:new Date().toISOString(),source:api.href,reason:e.message};}
}
// Path diversity is a sampling heuristic, not a relevance or completeness score.
export function selectPageSample(candidates,base,excluded=[]) {
  const groups=new Map(),seen=new Set(excluded);
  for(const candidate of candidates){
    // Reapply discovery policy so this helper cannot widen the crawl boundary.
    const safe=canonicalCandidate(candidate,base);
    if(!safe||seen.has(safe))continue;
    seen.add(safe);
    const group=new URL(safe).pathname.split('/').filter(Boolean)[0]??'';
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push(safe);
  }
  const selected=[];
  while(selected.length<4){
    let added=false;
    for(const pages of groups.values()){
      if(pages.length){selected.push(pages.shift());added=true;}
      if(selected.length===4)break;
    }
    if(!added)break;
  }
  return selected;
}
export async function collectEvidence(website,{pagespeed=false,fetchPage=publicFetch,renderPage}={}) {
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
  const selected=selectPageSample(candidates,url.href,[...resources,homepage?.url].filter(Boolean));
  for(const target of selected)observations.push(await observe(target,'page'));
  observations.forEach((o,i)=>{o.id=`E${i+1}`;o.method='Public HTTPS GET; raw response, no JavaScript execution';o.limitations??=['Single dated response; actual crawler behavior is unmeasured'];});
  // Renderer is opt-in; unavailable rendering never replaces raw evidence.
  if(renderPage){
    const pages=observations.filter(o=>o.kind==='page'&&!o.error&&o.status===200);
    for(const page of pages){
      try{
        const rendered=await renderPage(page.url);
        if(new URL(rendered.url).origin!==url.origin)throw Error('Cross-origin rendered page excluded');
        observations.push({...rendered,id:`E${observations.length+1}`,kind:'rendered_page'});
      }catch(e){observations.push({id:`E${observations.length+1}`,url:page.url,kind:'rendered_page',observedAt:new Date().toISOString(),method:'Chromium render attempted',error:e.message,limitations:['Rendered evidence unavailable; raw HTML retained']});}
    }
  }
  const robots=raw.get(resources[1]);
  const robotsPolicy=evaluateRobots(robots,observations.filter(o=>o.kind==='page'&&!o.error).map(o=>o.url));
  robotsPolicy.evidenceId=observations[1].id;
  let performance={status:'not_requested'};
  if(pagespeed)performance=await collectPageSpeed(url.href);
  return {website,observations,robotsPolicy,performance,scope:{maxAdditionalPages:4,selectedPages:selected,selection:'Round-robin by first path segment among bounded same-origin links and sitemap URLs; discovery order within each group; no query strings',limitations:['Path diversity is a heuristic, not semantic relevance or complete coverage','Bounded sample, not a complete crawl','Sitemap indexes are not recursively followed','Missing raw HTML markup does not prove absence in rendered DOM']},unmeasured:['Google Search Console position','consumer ChatGPT visibility','consumer Claude visibility','LLM API prompt cohort']};
}
