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
export async function collectEvidence(website,{pagespeed=false}={}) {
  const url=new URL(website);
  const resources=[url.href,new URL('/robots.txt',url).href,new URL('/sitemap.xml',url).href];
  const observations=await Promise.all(resources.map(async target=>{try{const r=await publicFetch(target);return {...r,body:r.body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').slice(0,16000),headers:{'content-type':r.headers['content-type'],'x-robots-tag':r.headers['x-robots-tag']??null}};}catch(e){return {url:target,observedAt:new Date().toISOString(),error:e.message};}}));
  let performance={status:'not_requested'};
  if(pagespeed){try{const api=new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');api.searchParams.set('url',url.href);api.searchParams.set('strategy','mobile');const r=await fetch(api,{signal:AbortSignal.timeout(25000),redirect:'error'});if(!r.ok)throw Error(`HTTP ${r.status}`);const j=await r.json();performance={status:'available',observedAt:new Date().toISOString(),source:api.href,performanceScore:j.lighthouseResult?.categories?.performance?.score??null};}catch(e){performance={status:'unavailable',observedAt:new Date().toISOString(),reason:e.message};}}
  return {website,observations,performance,unmeasured:['Google Search Console position','consumer ChatGPT visibility','consumer Claude visibility','LLM API prompt cohort']};
}
