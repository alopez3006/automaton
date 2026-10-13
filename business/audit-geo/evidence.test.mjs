import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractHtml,internalCandidates,collectEvidence,publicFetch,publicAddress} from './evidence.mjs';
test('JSON-LD survives cleanup; malformed and oversized blocks remain explicit',()=>{
 const e=extractHtml(`<title>Store</title><meta content='Useful' name='description'><h1>Buy <b>locally</b></h1><script type="application/ld+json">{"@type":"Store"}</script><script type='application/ld+json'>{bad}</script><script type='application/ld+json'>${'x'.repeat(12001)}</script><script>alert(1)</script>`);
 assert.equal(e.structuredData.blockCount,3);assert.equal(e.structuredData.blocks[0].value['@type'],'Store');assert.equal(e.structuredData.blocks[1].status,'invalid_json');assert.equal(e.structuredData.blocks[2].status,'too_large');assert.equal(e.h1[0],'Buy locally');assert.deepEqual(e.descriptions,['Useful']);assert.ok(!e.body.includes('<script'));
});
test('absence and truncation are scoped to raw HTML',()=>{
 const e=extractHtml('<div id="app"></div>'+ 'x'.repeat(17000));assert.equal(e.structuredData.status,'not_observed_in_raw_html');assert.equal(e.bodyTruncated,true);assert.ok(e.limitations.length);
});
test('discovery excludes external, query, private scheme, assets and duplicate fragments',()=>{
 assert.deepEqual(internalCandidates('<a href="/about#one"><a href="/about#two"><a href="https://evil.test/x"><a href="http://127.0.0.1/x"><a href="/x?q=a"><a href="/a.pdf"><a href="/services">','https://example.com/'),['https://example.com/about','https://example.com/services']);
 assert.deepEqual(internalCandidates('<urlset><loc>https://example.com/a</loc><loc>https://evil.test/x</loc></urlset>','https://example.com/',{sitemap:true}),['https://example.com/a']);
});
test('bounded sample records failures, full HTML extraction and no recursive crawl',async()=>{
 const calls=[];const fetchPage=async url=>{calls.push(url);if(url.endsWith('/p1'))throw Error('timeout');return {url,status:200,observedAt:'2026-10-13T12:00:00Z',headers:{'content-type':url.endsWith('.txt')?'text/plain':url.endsWith('.xml')?'application/xml':'text/html'},body:url.endsWith('.xml')?'<loc>https://example.com/from-map</loc>':Array.from({length:8},(_,i)=>`<a href="/p${i}">Page</a>`).join('')+'<script type="application/ld+json">{"@type":"WebPage"}</script>'};};
 const e=await collectEvidence('https://example.com/',{fetchPage});assert.equal(calls.length,7);assert.equal(e.scope.selectedPages.length,4);assert.equal(e.observations[0].structuredData.blocks[0].status,'parsed');assert.ok(e.observations.some(o=>o.error==='timeout'));assert.equal(e.performance.status,'not_requested');
});
test('cross-origin redirected markup cannot seed further pages',async()=>{
 const e=await collectEvidence('https://example.com/',{fetchPage:async url=>({url:'https://elsewhere.test/',status:200,headers:{'content-type':'text/html'},body:'<a href="/secret">',observedAt:'now'})});
 assert.ok(e.observations.every(o=>o.error));assert.equal(e.scope.selectedPages.length,0);
});
test('robots policy uses complete fetched rules and stable observation IDs',async()=>{
 const e=await collectEvidence('https://example.com/',{fetchPage:async url=>({url,status:200,observedAt:'2026-10-13T13:00:00Z',headers:{'content-type':url.endsWith('.txt')?'text/plain':'text/html'},body:url.endsWith('.txt')?'#'+'x'.repeat(17000)+'\nUser-agent: GPTBot\nDisallow: /\nUser-agent: OAI-SearchBot\nAllow: /':'<h1>Home</h1>'})});
 assert.deepEqual(e.observations.map(o=>o.id),['E1','E2','E3']);
 assert.equal(e.robotsPolicy.evidenceId,'E2');assert.equal(e.observations[1].bodyTruncated,true);
 assert.equal(e.robotsPolicy.evaluations.find(o=>o.agent==='GPTBot').status,'disallowed_according_to_robots_txt');
 assert.ok(e.observations.every(o=>o.method&&o.observedAt&&o.limitations.length));
});
test('public fetch rejects private literals and non-HTTPS before network',async()=>{
 for(const u of ['http://example.com','https://127.0.0.1','https://[::1]','https://user:pass@example.com','https://example.com:444'])await assert.rejects(publicFetch(u));
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','fc00::1'])assert.equal(publicAddress(ip),false);
});

test('Lighthouse preserves zero, units, bounded diagnostics and separate field scope',async()=>{
 const {summarizePageSpeed}=await import('./evidence.mjs');
 const audits={'cumulative-layout-shift':{id:'cumulative-layout-shift',numericValue:0,numericUnit:'unitless',score:1},slow:{id:'slow',score:0,title:'Slow',details:{overallSavingsMs:123}},unknown:{score:null},manual:{score:0,scoreDisplayMode:'manual'}};
 const e=summarizePageSpeed({lighthouseResult:{audits,categories:{performance:{score:0}}},originLoadingExperience:{id:'https://example.com',metrics:{LCP:{percentile:2300,category:'FAST'}}}},'api');
 assert.equal(e.performanceScore,0);assert.equal(e.metrics[4].value,0);assert.equal(e.metrics[0].value,null);assert.equal(e.diagnostics.length,1);assert.equal(e.diagnostics[0].savingsMs,123);assert.equal(e.field.page.status,'unavailable');assert.equal(e.field.origin.status,'available');
 assert.throws(()=>summarizePageSpeed({lighthouseResult:{runtimeError:{code:'FAILED'},audits:{}}},'api'));
});
test('PageSpeed quota, malformed and oversized responses never become scores',async()=>{
 const {collectPageSpeed}=await import('./evidence.mjs');
 for(const response of [new Response('',{status:429}),new Response('{bad'),new Response('x'.repeat(2000001)),Response.json({})]){
 const e=await collectPageSpeed('https://example.com/',{fetchApi:async()=>response});assert.equal(e.status,'unavailable');assert.equal(e.performanceScore,undefined);
 }
 const e=await collectPageSpeed('https://example.com/',{fetchApi:async()=>Response.json({lighthouseResult:{audits:{},categories:{performance:{score:0.9}}}})});assert.equal(e.performanceScore,0.9);
});
