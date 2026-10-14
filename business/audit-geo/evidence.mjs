import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { evaluateRobots } from './robots.mjs';
import {labObservation} from './lab-observation.mjs';

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
    const requestedUrl=new URL(target).href;
    const redirectChain=[];
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
      if(followRedirects&&result.status>=300&&result.status<400&&result.headers.location){
        if(redirects>=3)throw Error('Too many redirects');
        const nextUrl=new URL(result.headers.location,url).href;
        redirectChain.push({url:url.href,status:result.status,nextUrl,observedAt:result.observedAt});
        return visit(nextUrl,redirects+1);
      }
      return {...result,requestedUrl,redirectChain};
    }
    return visit(target,0);
  };
}
export const publicFetch=createPublicFetcher();
// Raw HTML evidence only: this is not a rendered-browser or schema-validity audit.
// Consume complete tags in order so quoted delimiters and tag-like attribute
// values cannot terminate a tag or seed an extra metadata/discovery tag.
function openingTags(markup,name) {
  return [...markup.matchAll(/<\/?([a-z][a-z0-9:-]*)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)]
    .filter(m=>m[0][1]!=='/'&&m[1].toLowerCase()===name).map(m=>m[0]);
}
// Find text elements through complete tag tokens, including quoted attributes.
function textElements(markup, names) {
  const result=[];
  const pending=new Map();
  const tokens=/<\/?([a-z][a-z0-9:-]*)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
  for(const tag of markup.matchAll(tokens)) {
    const name=tag[1].toLowerCase();
    if(!names.includes(name))continue;
    if(tag[0][1]==='/') {
      const open=pending.get(name);if(!open)continue;
      result.push({index:open.index,end:tag.index+tag[0].length,name,content:markup.slice(open.start,tag.index)});
      pending.delete(name);
    } else if(!pending.has(name)) {
      pending.set(name,{index:tag.index,start:tag.index+tag[0].length});
    }
  }
  return result.sort((a,b)=>a.index-b.index);
}
function attributes(tag) {
  const result=Object.create(null);
  // HTML discards later duplicate attributes, including case variants.
  // Consume valueless attributes too so a later value cannot replace them.
  for(const m of tag.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const name=m[1].toLowerCase();
    if(!Object.hasOwn(result,name))result[name]=m[2]??m[3]??m[4]??'';
  }
  return result;
}
// Decode once, after removing markup: encoded angle brackets are text, not tags.
// Deliberately bounded support; unknown named references remain verbatim.
function decodeTextReferences(value) {
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|lt|gt|quot|apos|nbsp);/gi,(raw,key)=>{
    if(!key.startsWith('#'))return named[key]??raw;
    const hex=key[1].toLowerCase()==='x';
    const point=Number.parseInt(key.slice(hex?2:1),hex?16:10);
    if(!Number.isSafeInteger(point)||point<=0||point>0x10ffff||point>=0xd800&&point<=0xdfff)return raw;
    // Keep control and legacy encoding references raw rather than misinterpret them.
    if(point<32||point>=127&&point<=159)return raw;
    return String.fromCodePoint(point);
  });
}
function plainText(value) { return decodeTextReferences(value.replace(/<[^"'<>]*(?:"[^"]*"[^"'<>]*|'[^']*'[^"'<>]*)*>/g,' ')).replace(/\s+/g,' ').trim(); }
function textContent(value) { return plainText(value).slice(0,1000); }
// Walk comments and raw script/style blocks in document order. Comment-like
// strings inside JSON-LD stay intact; commented-out scripts are never evidence.
// This remains bounded regex extraction, not a browser HTML parser.
function activeMarkup(body,onScript=()=>{}) {
  return body.replace(/<!--[\s\S]*?(?:-->|$)|<(script|style)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)(?:<\/\1\s*>|$)/gi,(_block,kind,attrs,content)=>{
    if(kind?.toLowerCase()==='script')onScript(attrs,content);
    return ' ';
  });
}
// Sample across the fetched document, rather than only its opening markup.
// These excerpts establish presence, never absence or complete DOM coverage.
export function extractSections(clean) {
  const headings=textElements(clean,['h1','h2','h3','h4','h5','h6']);
  const count=Math.min(headings.length,12);
  const sections=Array.from({length:count},(_,i)=>{
    const index=count===1?0:Math.round(i*(headings.length-1)/(count-1));
    const h=headings[index];
    const heading=textContent(h.content);
    const passage=plainText(clean.slice(h.end,headings[index+1]?.index??clean.length));
    return {heading:heading.slice(0,200),headingTruncated:heading.length>200,
      level:Number(h.name[1]),headingIndex:index,text:passage.slice(0,700),
      textTruncated:passage.length>700};
  });
  return {sections,sectionCoverage:{headingCount:headings.length,retained:count,
    omitted:headings.length-count,selection:'Up to 12 evenly spaced headings in document order; up to 700 text characters per section',
    limitations:['Raw HTML heading sections only; content before the first heading is not sampled here','Omitted or truncated passages cannot support absence claims','Text decodes semicolon-terminated amp/lt/gt/quot/apos/nbsp and printable Unicode numeric references once; other references remain raw']}};
}
export function extractHtml(body) {
  const structuredData=[];
  let jsonLdCount=0;
  const clean=activeMarkup(body,(attrs,content)=>{
    if(attributes(attrs).type?.toLowerCase()!=='application/ld+json') return;
    jsonLdCount++;
    if(structuredData.length>=10) return;
    if(content.length>12000){structuredData.push({status:'too_large',characters:content.length});return;}
    try{structuredData.push({status:'parsed',value:JSON.parse(content)});}
    catch{structuredData.push({status:'invalid_json',excerpt:content.slice(0,500)});}
  });
  const meta=openingTags(clean,'meta').map(attributes);
  const links=openingTags(clean,'link').map(attributes);
  return {
    title:textContent(textElements(clean,['title'])[0]?.content??''),
    descriptions:meta.filter(m=>m.name?.toLowerCase()==='description').map(m=>decodeTextReferences(m.content??'')),
    robots:meta.filter(m=>['robots','googlebot'].includes(m.name?.toLowerCase())).map(m=>({agent:m.name,content:m.content??''})),
    canonicals:links.filter(m=>m.rel?.toLowerCase().split(/\s+/).includes('canonical')).map(m=>m.href??''),
    h1:textElements(clean,['h1']).slice(0,20).map(m=>textContent(m.content)),
    structuredData:{status:jsonLdCount?'observed':'not_observed_in_raw_html',blockCount:jsonLdCount,blocks:structuredData,truncated:jsonLdCount>10},
    body:clean.slice(0,16000),bodyTruncated:clean.length>16000,
    ...extractSections(clean),
    limitations:['Raw HTML only; JavaScript-rendered content is unmeasured','Bounded regex extraction excludes comments and script/style blocks; not a complete HTML parser','Parsed JSON is not schema correctness or rich-result eligibility']
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
  const markup=sitemap?body.replace(/<!--[\s\S]*?(?:-->|$)/g,' '):activeMarkup(body);
  const matches=sitemap?[...markup.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(m=>m[1]):openingTags(markup,'a').map(tag=>attributes(tag).href);
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
// One discovery request only: use the first safe declared sitemap, otherwise default.
export function selectSitemap(robots,base) {
  const fallback=new URL('/sitemap.xml',base).href;
  if(robots?.status!==200)return {url:fallback,selection:'default'};
  for(const line of robots.body.split(/\r?\n/)) {
    const value=line.replace(/\s+#.*$/,'').match(/^\s*sitemap\s*:\s*(\S+)\s*$/i)?.[1];
    if(!value)continue;
    try{const candidate=new URL(value);
      if(candidate.protocol!=='https:'||candidate.origin!==new URL(base).origin||candidate.username||candidate.password||candidate.port||candidate.search||candidate.hash||isIP(candidate.hostname)||candidate.hostname.includes(':'))continue;
      return {url:candidate.href,selection:'first_safe_robots_declaration'};
    }catch{}
  }
  return {url:fallback,selection:'default'};
}
export async function collectEvidence(website,{pagespeed=false,fetchPage=publicFetch,renderPage,collectPerformance=collectPageSpeed}={}) {
  const url=new URL(website);
  const raw=new Map();
  async function observe(target,kind){
    try{const r=await fetchPage(target);
      if(new URL(r.url).origin!==url.origin)return {url:target,observedAt:r.observedAt,error:'Cross-origin redirect excluded from evidence'};
      raw.set(target,r);
      // Media types are case-insensitive; parameters do not identify the format.
      // Exact matching avoids treating JSON or lookalike types as HTML evidence.
      const mediaType=String(r.headers['content-type']??'').split(';',1)[0].trim().toLowerCase();
      const html=['text/html','application/xhtml+xml'].includes(mediaType);
      return {...r,kind,...(html?extractHtml(r.body):{body:r.body.slice(0,16000),bodyTruncated:r.body.length>16000}),headers:{'content-type':r.headers['content-type'],'x-robots-tag':r.headers['x-robots-tag']??null}};
    }catch(e){return {url:target,kind,observedAt:new Date().toISOString(),error:e.message};}
  }
  const resources=[url.href,new URL('/robots.txt',url).href];
  const observations=await Promise.all(resources.map((target,i)=>observe(target,i?'discovery':'page')));
  const sitemapDiscovery=selectSitemap(raw.get(resources[1]),url.href);
  resources.push(sitemapDiscovery.url);
  observations.push(await observe(sitemapDiscovery.url,'discovery'));
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
  if(pagespeed){
    performance=await collectPerformance(url.href);
    const measured=labObservation(performance,url.href,`E${observations.length+1}`);
    if(measured){observations.push(measured);performance.evidenceId=measured.id;}
  }
  return {website,observations,robotsPolicy,performance,scope:{sitemapDiscovery,maxAdditionalPages:4,selectedPages:selected,selection:'Round-robin by first path segment among bounded same-origin links and sitemap URLs; discovery order within each group; no query strings',limitations:['Path diversity is a heuristic, not semantic relevance or complete coverage','Bounded sample, not a complete crawl','Only one sitemap is fetched; failed declared sitemap has no fallback request; indexes are not recursively followed','Missing raw HTML markup does not prove absence in rendered DOM']},unmeasured:['Google Search Console position','consumer ChatGPT visibility','consumer Claude visibility','LLM API prompt cohort']};
}
