import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createBrowserGateway} from './browser-gateway.mjs';
import {extractHtml} from './evidence.mjs';

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
  let browser,timer,expired=false;
  let deniedRequests=0;
  const run=async()=>{
    // Customer JavaScript must not inherit the operator's credential environment.
    browser=await chromium.launch({executablePath:wrapper,headless:true,timeout:timeoutMs,env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',TMPDIR:dir,LANG:'en_US.UTF-8'},args:['--disable-background-networking','--disable-quic','--disable-sync','--disable-extensions','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
    if(expired){await browser.close();throw Error('Render deadline exceeded');}
    const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
    await context.routeWebSocket('**/*',ws=>ws.close());
    await context.route('**/*',async route=>{
      const request=route.request();
      try{const r=await gateway.request({url:request.url(),method:request.method(),resourceType:request.resourceType()});await route.fulfill({status:r.status,headers:r.headers,body:r.body});}
      catch{deniedRequests++;await route.abort('blockedbyclient').catch(()=>{});}
    });
    const page=await context.newPage();
    await page.goto(target.href,{waitUntil:'domcontentloaded',timeout:timeoutMs});
    await page.waitForTimeout(Math.min(500,timeoutMs/4));
    const html=await page.content();
    if(Buffer.byteLength(html)>256000)throw Error('Rendered DOM exceeds evidence bound');
    const extracted=extractHtml(html);
    if(extracted.structuredData.status==='not_observed_in_raw_html')extracted.structuredData.status='not_observed_in_rendered_dom';
    return {url:page.url(),observedAt:new Date().toISOString(),method:'Chromium DOM; macOS denies direct network; bounded public HTTPS gateway',...extracted,network:gateway.stats(),deniedRequests,limitations:['Single render, 500ms settling maximum; not a complete crawl','Blocked or oversized resources can leave content incomplete','No actual search/AI crawler access measured']};
  };
  try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;gateway.close();reject(Error('Render deadline exceeded'));},timeoutMs);})]);}
  finally{clearTimeout(timer);gateway.close();if(browser)await browser.close();await rm(dir,{recursive:true,force:true});}
}
