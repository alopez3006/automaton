import {isIP} from 'node:net';
import {createPublicFetcher} from './evidence.mjs';

function targetUrl(value) {
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(u.hostname)||u.hostname.includes(':'))throw Error('Public HTTPS hostname required');
  return u;
}
// Prerequisite only: a browser adapter must intercept ALL traffic and disable
// service workers, WebSockets, WebRTC, downloads and background networking.
// Never forward browser headers, cookies, authentication or request bodies.
export function createBrowserGateway({maxRequests=40,maxBytes=5000000,maxResourceBytes=256000,maxConcurrent=4,totalTimeoutMs=20000,fetchResource,now=Date.now}={}) {
  for(const n of [maxRequests,maxBytes,maxResourceBytes,maxConcurrent,totalTimeoutMs])if(!Number.isSafeInteger(n)||n<=0)throw Error('Invalid browser gateway bounds');
  const deadline=now()+totalTimeoutMs;
  let requests=0,bytes=0,inFlight=0,reservedBytes=0,closed=false;
  return {
    close(){closed=true;},
    stats(){return {requests,bytes,inFlight,closed};},
    async request({url,method='GET',resourceType='other'}) {
      if(closed||now()>=deadline)throw Error('Browser gateway closed or deadline exceeded');
      const target=targetUrl(url);
      if(method!=='GET'||['websocket','eventsource'].includes(resourceType))throw Error('Browser request channel or method denied');
      if(requests>=maxRequests||inFlight>=maxConcurrent)throw Error('Browser request budget exceeded');
      const allowance=Math.min(maxResourceBytes,maxBytes-bytes-reservedBytes);
      if(allowance<=0)throw Error('Browser byte budget exceeded');
      requests++;inFlight++;reservedBytes+=allowance;
      try {
        const timeout=deadline-now();
        const fetcher=fetchResource??createPublicFetcher({responseEncoding:'buffer',followRedirects:false,maxBytes:allowance,totalTimeoutMs:timeout});
        const r=await fetcher(target.href,{maxBytes:allowance,totalTimeoutMs:timeout});
        if(closed||now()>=deadline)throw Error('Browser gateway closed or deadline exceeded');
        if(r.url!==target.href||!Buffer.isBuffer(r.body)||r.body.length>allowance)throw Error('Invalid browser transport response');
        if(!Number.isInteger(r.status)||r.status<200||r.status>599)throw Error('Invalid browser response status');
        bytes+=r.body.length;
        if(r.headers['content-encoding']&&r.headers['content-encoding']!=='identity')throw Error('Encoded browser response denied');
        const headers={};
        for(const name of ['content-type','content-security-policy','content-security-policy-report-only','x-content-type-options','x-robots-tag','access-control-allow-origin','vary']) {
          if(typeof r.headers[name]==='string')headers[name]=r.headers[name];
        }
        if(r.status>=300&&r.status<400&&r.headers.location)headers.location=targetUrl(new URL(r.headers.location,target).href).href;
        // Redirects are returned, never followed here: the browser's next URL
        // must pass this gateway again, preserving document/base URL semantics.
        return {status:r.status,headers,body:r.body,url:r.url,observedAt:r.observedAt};
      } finally {inFlight--;reservedBytes-=allowance;}
    }
  };
}
