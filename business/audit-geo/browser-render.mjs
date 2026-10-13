import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createBrowserGateway} from './browser-gateway.mjs';
import {extractHtml} from './evidence.mjs';
import {compareRenderedHtml} from './render-comparison.mjs';

// Explicit dependency injection avoids relying on a desktop application's private installation.
// Opt-in only. macOS network sandbox is mandatory; there is no unsandboxed fallback.
export async function renderPublicPage(url,{chromium,executablePath,fetchResource,timeoutMs=20000}={}) {
  if(process.platform!=='darwin'||!chromium||!isAbsolute(executablePath??''))throw Error('macOS sandbox and explicit Chromium runtime required');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>20000)throw Error('Invalid render timeout');
  const target=new URL(url);
  if(target.protocol!=='https:'||target.username||target.password||target.port)throw Error('Public HTTPS target required');
  const dir=await mkdtemp(join(tmpdir(),'audit-browser-'));
  const wrapper=join(dir,'chromium');
  // The executable is encoded as a shell literal; user URL never enters shell code.
  const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
  await writeFile(wrapper,`#!/bin/sh\nexec /usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' ${quote(executablePath)} "$@"\n`);
  await chmod(wrapper,0o700);
  const gateway=createBrowserGateway({totalTimeoutMs:timeoutMs,fetchResource});
  let browser,launchPromise,timer,expired=false;
  let deniedRequests=0;
  const run=async()=>{
    // Customer JavaScript must not inherit the operator's credential environment.
    launchPromise=chromium.launch({executablePath:wrapper,headless:true,timeout:timeoutMs,env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',TMPDIR:dir,LANG:'en_US.UTF-8'},args:['--disable-background-networking','--disable-quic','--disable-sync','--disable-extensions','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
    browser=await launchPromise;
    if(expired)throw Error('Render deadline exceeded');
    const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
    await context.routeWebSocket('**/*',ws=>ws.close());
    let page,pendingRedirect,navigating=false,rawDocument,rawDocumentUrl;
    await context.route('**/*',async route=>{
      const request=route.request();
      // A later script/meta navigation (even to the same URL) invalidates the
      // original response pairing; do not compare unrelated document loads.
      if(!navigating&&request.isNavigationRequest()&&request.frame()===page.mainFrame())rawDocument=undefined;
      try{
        const r=await gateway.request({url:request.url(),method:request.method(),resourceType:request.resourceType()});
        // Chromium may bypass Playwright routing for the next redirect hop.
        // Main-document hops are therefore explicit new navigations. Resource
        // redirects fail closed rather than bypassing validation/base semantics.
        if(r.status>=300&&r.status<400&&r.headers.location){
          if(navigating&&request.isNavigationRequest()&&request.frame()===page.mainFrame()){
            pendingRedirect=r.headers.location;
            // Complete an inert navigation before starting the next hop. An
            // aborted navigation can race Chromium's internal error page.
            await route.fulfill({status:200,headers:{'content-type':'text/html','content-security-policy':"default-src 'none'"},body:''});
          }else{deniedRequests++;await route.abort('blockedbyclient');}
          return;
        }
        if(navigating&&request.isNavigationRequest()&&request.frame()===page.mainFrame()){
          rawDocument=String(r.headers['content-type']??'').toLowerCase().includes('text/html')?extractHtml(r.body.toString('utf8')):undefined;
          rawDocumentUrl=request.url();
        }
        await route.fulfill({status:r.status,headers:r.headers,body:r.body});
      }
      catch{deniedRequests++;await route.abort('blockedbyclient').catch(()=>{});}
    });
    page=await context.newPage();
    let next=target.href;
    for(let hop=0;;hop++){
      if(hop>5)throw Error('Browser redirect limit exceeded');
      pendingRedirect=undefined;rawDocument=undefined;rawDocumentUrl=undefined;navigating=true;
      try{await page.goto(next,{waitUntil:'domcontentloaded',timeout:timeoutMs});}
      catch(error){if(!pendingRedirect)throw error;}
      finally{navigating=false;}
      if(!pendingRedirect)break;
      next=pendingRedirect;
    }
    await page.waitForTimeout(Math.min(500,timeoutMs/4));
    const html=await page.content();
    if(Buffer.byteLength(html)>256000)throw Error('Rendered DOM exceeds evidence bound');
    const extracted=extractHtml(html);
    extracted.limitations=['Bounded serialized Chromium DOM after JavaScript; visibility and complete content are unmeasured','Parsed JSON is not schema correctness or rich-result eligibility'];
    if(extracted.structuredData.status==='not_observed_in_raw_html')extracted.structuredData.status='not_observed_in_rendered_dom';
    const observedAt=new Date().toISOString();
    const comparison=rawDocument&&rawDocumentUrl===page.url()?compareRenderedHtml(rawDocument,extracted,{url:page.url(),observedAt}):{status:'unavailable',reason:'Matching final navigation HTML response was not observed'};
    return {url:page.url(),observedAt,method:'Chromium DOM; macOS denies direct network; bounded public HTTPS gateway',...extracted,comparison,network:gateway.stats(),deniedRequests,limitations:['Single render, 500ms settling maximum; not a complete crawl','Blocked, redirected or oversized resources can leave content incomplete','No actual search/AI crawler access measured','Parsed JSON is not schema correctness or rich-result eligibility']};
  };
  try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;gateway.close();reject(Error('Render deadline exceeded'));},timeoutMs);})]);}
  finally{
    clearTimeout(timer);gateway.close();
    // A launch can settle after the deadline wins. Reap it before removing its
    // wrapper/profile directory; Playwright's launch timeout remains mandatory.
    try{const launched=browser??await launchPromise?.catch(()=>undefined);if(launched)await launched.close();}
    finally{await rm(dir,{recursive:true,force:true});}
  }
}
