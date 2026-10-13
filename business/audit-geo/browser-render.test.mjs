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
test('macOS sandbox denies direct loopback socket independent of route interception',{skip:!process.env.AUDIT_BROWSER_TEST_RUNTIME},async()=>{
 const {execFile}=await import('node:child_process');
 const {promisify}=await import('node:util');
 const code="const net=require('node:net');const s=net.connect(4317,'127.0.0.1');s.on('connect',()=>process.exit(1));s.on('error',e=>process.exit(e.code==='EPERM'?0:2));setTimeout(()=>process.exit(3),1000)";
 const r=await promisify(execFile)('/usr/bin/sandbox-exec',['-p','(version 1)(allow default)(deny network*)',process.execPath,'-e',code]);
 assert.equal(r.stderr,'');
});
