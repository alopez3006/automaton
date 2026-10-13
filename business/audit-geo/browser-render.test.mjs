import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPublicPage} from './browser-render.mjs';
test('renderer requires explicit sandbox runtime and bounded deadline',async()=>{
 await assert.rejects(renderPublicPage('https://example.com'),/runtime/);
 await assert.rejects(renderPublicPage('https://example.com',{chromium:{},executablePath:'/tmp/chrome',timeoutMs:21000}),/timeout/);
 await assert.rejects(renderPublicPage('file:///etc/passwd',{chromium:{},executablePath:'/tmp/chrome'}),/HTTPS/);
});
test('browser has an explicit clean environment and temporary-directory cleanup',{skip:process.platform!=='darwin'},async()=>{
 let options;
 const page={async goto(){},async waitForTimeout(){},async content(){return '<title>Fixture</title><h1>Fixture</h1>';},url(){return 'https://example.com/';}};
 const context={async routeWebSocket(){},async route(){},async newPage(){return page;}};
 const chromium={async launch(config){options=config;return{async newContext(){return context;},async close(){}};}};
 await renderPublicPage('https://example.com/',{chromium,executablePath:'/fixture/chrome',timeoutMs:1000});
 assert.deepEqual(Object.keys(options.env).sort(),['LANG','PATH','TMPDIR']);
 const {access}=await import('node:fs/promises');
 await assert.rejects(access(options.env.TMPDIR),{code:'ENOENT'});
});
test('real sandboxed browser renders JS while gateway refuses private and non-GET attempts',{skip:!process.env.AUDIT_BROWSER_TEST_RUNTIME},async()=>{
 const {chromium}=await import(process.env.AUDIT_BROWSER_TEST_RUNTIME);
 const calls=[];
 const html=`<title>Raw</title><h1>Initial</h1><script>
 document.querySelector('h1').textContent='Rendered proof';
 fetch('http://127.0.0.1:4317/');fetch('https://example.com/post',{method:'POST'});
 new WebSocket('wss://example.com/socket');
 navigator.sendBeacon('https://example.com/beacon','data');
 </script>`;
 const r=await renderPublicPage('https://example.com/',{chromium,executablePath:process.env.AUDIT_BROWSER_TEST_CHROME,fetchResource:async url=>{
 calls.push(url);return {url,status:200,headers:{'content-type':'text/html'},body:Buffer.from(html)};
 }});
 assert.match(JSON.stringify(r),/Rendered proof/);assert.deepEqual(calls,['https://example.com/']);assert.ok(r.deniedRequests>=2);
});
test('deadline reaps a late browser launch before deleting its directory',{skip:process.platform!=='darwin'},async()=>{
 let directory,closed=false,contexts=0;
 const chromium={async launch(options){directory=options.env.TMPDIR;await new Promise(r=>setTimeout(r,150));return {async newContext(){contexts++;},async close(){closed=true;}};}};
 await assert.rejects(renderPublicPage('https://example.com/',{chromium,executablePath:'/fixture/chrome',timeoutMs:100}),/deadline/);
 assert.equal(closed,true);assert.equal(contexts,0);
 const {access}=await import('node:fs/promises');
 await assert.rejects(access(directory),{code:'ENOENT'});
});
test('temporary directory is removed even if browser close fails',{skip:process.platform!=='darwin'},async()=>{
 let directory;
 const chromium={async launch(options){directory=options.env.TMPDIR;return {async newContext(){throw Error('context failed');},async close(){throw Error('close failed');}};}};
 await assert.rejects(renderPublicPage('https://example.com/',{chromium,executablePath:'/fixture/chrome',timeoutMs:1000}),/close failed/);
 const {access}=await import('node:fs/promises');
 await assert.rejects(access(directory),{code:'ENOENT'});
});
test('real browser preserves redirect base URL and refuses private redirect',{skip:!process.env.AUDIT_BROWSER_TEST_RUNTIME},async()=>{
 const {chromium}=await import(process.env.AUDIT_BROWSER_TEST_RUNTIME);
 const calls=[];
 const options={chromium,executablePath:process.env.AUDIT_BROWSER_TEST_CHROME,fetchResource:async url=>{
  calls.push(url);
  if(url==='https://example.com/')return {url,status:302,headers:{location:'/nested/page'},body:Buffer.alloc(0)};
  return {url,status:200,headers:{'content-type':'text/html'},body:Buffer.from('<h1>Redirect proof</h1><script src="relative.js"></script>')};
 }};
 const result=await renderPublicPage('https://example.com/',options);
 assert.equal(result.url,'https://example.com/nested/page');
 assert.ok(calls.includes('https://example.com/nested/relative.js'));
 const blocked=[];
 await assert.rejects(renderPublicPage('https://example.com/',{...options,fetchResource:async url=>{
  blocked.push(url);return {url,status:302,headers:{location:'http://127.0.0.1:4317/'},body:Buffer.alloc(0)};
 }}));
 assert.deepEqual(blocked,['https://example.com/']);
});
test('macOS sandbox denies direct loopback socket independent of route interception',{skip:!process.env.AUDIT_BROWSER_TEST_RUNTIME},async()=>{
 const {execFile}=await import('node:child_process');
 const {promisify}=await import('node:util');
 const code="const net=require('node:net');const s=net.connect(4317,'127.0.0.1');s.on('connect',()=>process.exit(1));s.on('error',e=>process.exit(e.code==='EPERM'?0:2));setTimeout(()=>process.exit(3),1000)";
 const r=await promisify(execFile)('/usr/bin/sandbox-exec',['-p','(version 1)(allow default)(deny network*)',process.execPath,'-e',code]);
 assert.equal(r.stderr,'');
});
test('real browser bounds redirect loops and refuses redirected resources',{skip:!process.env.AUDIT_BROWSER_TEST_RUNTIME},async()=>{
 const {chromium}=await import(process.env.AUDIT_BROWSER_TEST_RUNTIME);
 const runtime={chromium,executablePath:process.env.AUDIT_BROWSER_TEST_CHROME};
 let hops=0;
 await assert.rejects(renderPublicPage('https://example.com/',{...runtime,fetchResource:async url=>{
  hops++;return {url,status:302,headers:{location:'/'},body:Buffer.alloc(0)};
 }}),/redirect limit/);
 assert.equal(hops,6);
 const calls=[];
 const result=await renderPublicPage('https://example.com/',{...runtime,fetchResource:async url=>{
  calls.push(url);
  if(url.endsWith('/asset.js'))return {url,status:302,headers:{location:'https://other.example/redirected.js'},body:Buffer.alloc(0)};
  return {url,status:200,headers:{'content-type':'text/html'},body:Buffer.from('<h1>Resource control</h1><script src="/asset.js"></script>')};
 }});
 assert.deepEqual(calls,['https://example.com/','https://example.com/asset.js']);
 assert.equal(result.deniedRequests,1);
});
test('real browser terminates non-settling JavaScript at the deadline',{skip:!process.env.AUDIT_BROWSER_TEST_RUNTIME},async()=>{
 const {chromium}=await import(process.env.AUDIT_BROWSER_TEST_RUNTIME);
 const start=Date.now();
 await assert.rejects(renderPublicPage('https://example.com/',{chromium,executablePath:process.env.AUDIT_BROWSER_TEST_CHROME,timeoutMs:1500,fetchResource:async url=>({url,status:200,headers:{'content-type':'text/html'},body:Buffer.from('<script>while(true){}</script>')})}),/deadline|Timeout/);
 assert.ok(Date.now()-start<5000,'browser cleanup must complete promptly');
});
