import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractHtml,internalCandidates,selectPageSample,collectEvidence,publicFetch,publicAddress} from './evidence.mjs';
test('quoted inline attributes do not leak into citable text',()=>{
 for(const attr of ['data-note="x > fabricated"',"data-note='x > fabricated'",'data-note="<b>fabricated</b>"']) {
  const e=extractHtml(`<title>Offer <span ${attr}>Real</span></title><h1>Offer <span ${attr}>Real</span></h1><p>Price <a ${attr}>EUR 9</a> &amp; scope.</p>`);
  assert.equal(e.title,'Offer Real');
  assert.deepEqual(e.h1,['Offer Real']);
  assert.equal(e.sections[0].text,'Price EUR 9 & scope.');
 }
 const e=extractHtml('<h1>Plain &lt;offer&gt; &amp; &#233;</h1><p>5 &gt; 3 <em>visible</em></p>');
 assert.deepEqual(e.h1,['Plain <offer> & é']);
 assert.equal(e.sections[0].text,'5 > 3 visible');
});
test('quoted script delimiters retain JSON-LD and exclude raw-block markup',()=>{
 for(const attr of ['data-note="a > b"',"data-note='a > b'",'data-note="<meta name=robots content=noindex>"']) {
  const html=`<script ${attr} type="application/ld+json">{"@type":"Service","name":"Audit"}</script><style ${attr}>.x::after { content: '<meta name="robots" content="noindex">'; }</style><h1>Real offer</h1>`;
  const e=extractHtml(html);
  assert.equal(e.structuredData.blockCount,1);
  assert.deepEqual(e.structuredData.blocks,[{status:'parsed',value:{'@type':'Service',name:'Audit'}}]);
  assert.deepEqual(e.robots,[]);assert.deepEqual(e.h1,['Real offer']);
 }
 const invalid=extractHtml('<script data-note=">" type="application/ld+json">{bad}</script>');
 assert.equal(invalid.structuredData.blocks[0].status,'invalid_json');
 const control=extractHtml('<!-- <script data-note=">" type="application/ld+json">{}</script> --><script data-note=">" type="text/javascript"><meta name="robots" content="noindex"></script>');
 assert.equal(control.structuredData.blockCount,0);assert.deepEqual(control.robots,[]);
});
test('quoted tag delimiters preserve metadata and discovered links',()=>{
 const html=`<META data-note="a > b" name="robots" content="noindex"><meta data-note='x > y' name=description content="Real description"><link data-note="a > b" rel=canonical href="/real"><a title='x > y' href="/pricing">Pricing</a>`;
 const e=extractHtml(html);
 assert.deepEqual(e.robots,[{agent:'robots',content:'noindex'}]);
 assert.deepEqual(e.descriptions,['Real description']);assert.deepEqual(e.canonicals,['/real']);
 assert.deepEqual(internalCandidates(html,'https://example.com/'),['https://example.com/pricing']);
});
test('tag-like quoted attribute values do not seed metadata or discovery',()=>{
 const html=`<div data-example='<meta name="robots" content="noindex"><link rel="canonical" href="/fake"><a href="/fake">'>Example</div><meta name="robots" content="index"><a href="/real">Real</a>`;
 const e=extractHtml(html);assert.deepEqual(e.robots,[{agent:'robots',content:'index'}]);
 assert.deepEqual(e.canonicals,[]);assert.deepEqual(internalCandidates(html,'https://example.com/'),['https://example.com/real']);
});
test('tag-name lookalikes and closing tags do not supply metadata or links',()=>{
 const html='<meta-extra name="robots" content="noindex"><link:example rel="canonical" href="/fake"><a-example href="/fake"></meta name="robots" content="noindex"></a href="/fake"><meta name="robots" content="index">';
 assert.deepEqual(extractHtml(html).robots,[{agent:'robots',content:'index'}]);
 assert.deepEqual(extractHtml(html).canonicals,[]);assert.deepEqual(internalCandidates(html,'https://example.com/'),[]);
});
test('duplicate attributes preserve the first metadata value including case variants',()=>{
 const e=extractHtml('<meta name="robots" NAME="description" content="noindex" CONTENT="index"><meta name="description" content="Original" content="Replacement"><link rel="canonical" href="/original" HREF="/replacement">');
 assert.deepEqual(e.robots,[{agent:'robots',content:'noindex'}]);
 assert.deepEqual(e.descriptions,['Original']);assert.deepEqual(e.canonicals,['/original']);
});
test('valueless and empty attributes cannot be overwritten and quoted values stay intact',()=>{
 const e=extractHtml('<meta name="description" content content="Replacement"><meta name="description" content="" content="Replacement"><meta name="description" content="name=robots content=noindex"><meta name=robots content=noindex content=index>');
 assert.deepEqual(e.descriptions,['','','name=robots content=noindex']);
 assert.deepEqual(e.robots,[{agent:'robots',content:'noindex'}]);
});
test('duplicate link and JSON-LD attributes cannot substitute later identities',()=>{
 assert.deepEqual(internalCandidates('<a href="/original" href="/replacement">Offer</a><a href href="/hidden">Empty</a>','https://example.com/'),['https://example.com/original']);
 const e=extractHtml('<script type="text/javascript" type="application/ld+json">{"fake":true}</script><script TYPE="application/ld+json" type="text/javascript">{"@graph":[{"@type":"Service"}]}</script>');
 assert.equal(e.structuredData.blockCount,1);
 assert.deepEqual(e.structuredData.blocks[0].value,{'@graph':[{'@type':'Service'}]});
});
test('collector recognizes exact case-insensitive HTML and XHTML media types',async()=>{
 const body='<title>Evidence</title><meta name="description" content="Supported"><link rel="canonical" href="https://example.com/"><h1>Offer</h1><script type="application/ld+json">{"@type":"Service"}</script>';
 for(const contentType of ['text/html','Text/HTML; Charset=UTF-8',' TEXT/HTML ; charset=utf-8','application/xhtml+xml','Application/XHTML+XML; charset=utf-8']){
  const result=await collectEvidence('https://example.com/',{fetchPage:async url=>({url,status:200,headers:{'content-type':url.endsWith('/')?contentType:'text/plain'},body:url.endsWith('/')?body:'',observedAt:'2026-10-14T00:00:00Z'})});
  const page=result.observations[0];
  assert.equal(page.title,'Evidence',contentType);assert.deepEqual(page.descriptions,['Supported']);
  assert.deepEqual(page.canonicals,['https://example.com/']);assert.deepEqual(page.h1,['Offer']);
  assert.equal(page.structuredData.blocks[0].value['@type'],'Service');
  assert.equal(page.headers['content-type'],contentType);
  assert.equal(result.observations.length,3);
 }
});
test('collector does not infer HTML from missing, non-HTML or lookalike media types',async()=>{
 for(const contentType of [undefined,'application/json','text/plain; note=text/html','application/not-text/html','text/html-extra','application/xhtml+xml-invalid']){
  const body='<title>Not established HTML</title><h1>Not established heading</h1>';
  const result=await collectEvidence('https://example.com/',{fetchPage:async url=>({url,status:200,headers:{'content-type':contentType},body,observedAt:'2026-10-14T00:00:00Z'})});
  assert.equal(result.observations[0].title,undefined,String(contentType));
  assert.equal(result.observations[0].structuredData,undefined);
  assert.equal(result.observations[0].body,body);
 }
});
test('text references yield readable evidence without interpreting encoded markup',()=>{
 const e=extractHtml('<title>Caf&#233; &amp; tea</title><meta name="description" content="&#x1F600; &quot;offer&quot;"><h1>Price&nbsp;&lt;strong&gt;9&#8364;&lt;/strong&gt;</h1><p>It&apos;s <b>ready</b> &amp;amp; safe.</p>');
 assert.equal(e.title,'Café & tea');assert.deepEqual(e.descriptions,['😀 "offer"']);
 assert.equal(e.h1[0],'Price <strong>9€</strong>');
 assert.equal(e.sections[0].heading,e.h1[0]);assert.equal(e.sections[0].text,"It's ready &amp; safe.");
 assert.ok(e.body.includes('&#8364;'));
});
test('unknown malformed invalid and control references stay explicit',()=>{
 const text='&copy; &AMP; &amp &#0; &#xD800; &#1114112; &#x80; &#10; &#xZZ;';
 assert.equal(extractHtml(`<h1>${text}</h1>`).h1[0],text);
});
test('text decoding preserves structured data canonical and discovery contracts',()=>{
 const e=extractHtml('<link rel="canonical" href="https://example.com/a?x=1&amp;y=2"><script type="application/ld+json">{"name":"A &amp; B","code":"&#8364;"}</script><h1>A &amp; B</h1>');
 assert.deepEqual(e.structuredData.blocks[0].value,{name:'A &amp; B',code:'&#8364;'});
 assert.equal(e.canonicals[0],'https://example.com/a?x=1&amp;y=2');
 assert.deepEqual(internalCandidates('<a href="/a&amp;amp;b">A</a>','https://example.com/'),['https://example.com/a&amp;b']);
});
test('section limits apply to decoded text and retain truncation evidence',()=>{
 const e=extractHtml(`<h1>Offer</h1><p>${'&#8364;'.repeat(701)}</p>`);
 assert.equal(e.sections[0].text,'€'.repeat(700));assert.equal(e.sections[0].textTruncated,true);
});
test('comments and script/style strings cannot supply metadata, headings, JSON-LD or discovery',()=>{
 const fake='<title>Fake</title><meta name="description" content="Fake"><meta name="robots" content="noindex"><link rel="canonical" href="/fake"><h1>Fake</h1><a href="/fake">';
 const html=`<!-- ${fake}<script type="application/ld+json">{"fake":true}</script> --><SCRIPT>const x = '${fake}';</SCRIPT ><style>${fake}</style><title>Real</title><meta name="description" content="Real"><meta name="robots" content="index"><link rel="canonical" href="/real"><h1>Real</h1><a href="/real">Real</a>`;
 const e=extractHtml(html);
 assert.equal(e.title,'Real');assert.deepEqual(e.descriptions,['Real']);assert.deepEqual(e.robots,[{agent:'robots',content:'index'}]);
 assert.deepEqual(e.canonicals,['/real']);assert.deepEqual(e.h1,['Real']);assert.equal(e.structuredData.blockCount,0);
 assert.equal(e.sections.length,1);assert.ok(!e.body.includes('Fake'));
 assert.deepEqual(internalCandidates(html,'https://example.com/'),['https://example.com/real']);
});
test('JSON-LD comment-like strings survive while commented blocks and sitemap entries are excluded',()=>{
 const value={description:'Keep <!-- literal --> text',example:'<meta name="robots" content="noindex">'};
 const e=extractHtml(`<script type="application/ld+json">${JSON.stringify(value)}</script>`);
 assert.deepEqual(e.structuredData.blocks[0].value,value);assert.deepEqual(e.robots,[]);
 assert.deepEqual(internalCandidates('<!-- <loc>https://example.com/fake</loc> --><loc>https://example.com/real</loc>','https://example.com/',{sitemap:true}),['https://example.com/real']);
});
test('unterminated comment and raw-text blocks cannot seed false evidence after real markup',()=>{
 for(const tail of ['<!--','<script>','<style>']) {
  const html='<h1>Real</h1><a href="/real">Real</a>'+tail+'<h1>Fake</h1><meta name="robots" content="noindex"><a href="/fake">';
  const e=extractHtml(html);assert.deepEqual(e.h1,['Real']);assert.deepEqual(e.robots,[]);
  assert.deepEqual(internalCandidates(html,'https://example.com/'),['https://example.com/real']);
 }
});
test('sample covers distinct path groups before repeating a dominant section',()=>{
 const base='https://example.com/';
 const paths=['/docs/a','/docs/b','/docs/c','/docs/d','/pricing','/services/consulting','/about'];
 assert.deepEqual(selectPageSample(paths.map(p=>base.slice(0,-1)+p),base),['/docs/a','/pricing','/services/consulting','/about'].map(p=>base.slice(0,-1)+p));
});
test('sample fills remaining slots deterministically and excludes unsafe or duplicate URLs',()=>{
 const base='https://example.com/';
 assert.deepEqual(selectPageSample(['/','/x/a','/x/a#copy','/x/b','/y/a','/x/c','https://other.test/z','/secret?q=1','http://example.com/a','/file.pdf'],base,[base]),['/x/a','/y/a','/x/b','/x/c'].map(p=>base.slice(0,-1)+p));
 assert.deepEqual(selectPageSample([],base),[]);
});
test('selection preserves canonical discovery URLs without a second entity decode',()=>{
 const base='https://example.com/';
 const candidates=internalCandidates('<a href="/docs/a&amp;amp;b">Page</a><a href="/offer/%26amp%3B">Offer</a>',base);
 assert.deepEqual(candidates,['https://example.com/docs/a&amp;b','https://example.com/offer/%26amp%3B']);
 assert.deepEqual(selectPageSample(candidates,base),candidates);
});
test('candidate strings cannot inject a different accepted link through markup',()=>{
 const base='https://example.com/';
 assert.deepEqual(selectPageSample(['https://other.test/</loc><loc>/pricing','http://example.com/</loc><loc>/about',null,{}],base),[]);
});
test('sitemap adds a distinct group without increasing fetch budget or following child links',async()=>{
 const calls=[];
 const fetchPage=async url=>{calls.push(url);return {url,status:200,observedAt:'now',headers:{'content-type':url.endsWith('.xml')?'application/xml':'text/html'},body:url.endsWith('.xml')?'<loc>https://example.com/offer</loc>':Array.from({length:8},(_,i)=>`<a href="/docs/${i}">Doc</a>`).join('')};};
 const e=await collectEvidence('https://example.com/',{fetchPage});
 assert.deepEqual(e.scope.selectedPages,['https://example.com/docs/0','https://example.com/offer','https://example.com/docs/1','https://example.com/docs/2']);
 assert.equal(calls.length,7);assert.ok(e.scope.limitations.some(x=>x.includes('heuristic')));
});
test('JSON-LD survives cleanup; malformed and oversized blocks remain explicit',()=>{
 const e=extractHtml(`<title>Store</title><meta content='Useful' name='description'><h1>Buy <b>locally</b></h1><script type="application/ld+json">{"@type":"Store"}</script><script type='application/ld+json'>{bad}</script><script type='application/ld+json'>${'x'.repeat(12001)}</script><script>alert(1)</script>`);
 assert.equal(e.structuredData.blockCount,3);assert.equal(e.structuredData.blocks[0].value['@type'],'Store');assert.equal(e.structuredData.blocks[1].status,'invalid_json');assert.equal(e.structuredData.blocks[2].status,'too_large');assert.equal(e.h1[0],'Buy locally');assert.deepEqual(e.descriptions,['Useful']);assert.ok(!e.body.includes('<script'));
});
test('absence and truncation are scoped to raw HTML',()=>{
 const e=extractHtml('<div id="app"></div>'+ 'x'.repeat(17000));assert.equal(e.structuredData.status,'not_observed_in_raw_html');assert.equal(e.bodyTruncated,true);assert.ok(e.limitations.length);
});
test('late pricing and answer sections survive opening-excerpt truncation',()=>{
 const e=extractHtml('<h1>Service</h1>'+'<p>Introduction</p>'.repeat(1500)+'<h2>Pricing</h2><p>EUR 9 once, no subscription.</p><h3>What is measured?</h3><p>Sampled public HTML.</p>');
 assert.equal(e.bodyTruncated,true);assert.ok(!e.body.includes('EUR 9'));
 assert.equal(e.sections[1].heading,'Pricing');assert.equal(e.sections[1].text,'EUR 9 once, no subscription.');
 assert.equal(e.sections[2].text,'Sampled public HTML.');assert.equal(e.sectionCoverage.omitted,0);
});
test('section coverage is bounded across a long document, with explicit omissions',()=>{
 const e=extractHtml(Array.from({length:40},(_,i)=>`<h2>Section ${i}</h2><p>${'x'.repeat(900)}</p>`).join(''));
 assert.equal(e.sections.length,12);assert.equal(e.sections[0].headingIndex,0);assert.equal(e.sections.at(-1).headingIndex,39);
 assert.equal(e.sectionCoverage.headingCount,40);assert.equal(e.sectionCoverage.omitted,28);
 assert.ok(e.sections.every(s=>s.text.length===700&&s.textTruncated));
 assert.equal(new Set(e.sections.map(s=>s.headingIndex)).size,12);
});
test('scripts/styles cannot create sections; no headings produce no invented passages',()=>{
 const e=extractHtml('<script>"<h2>Fake</h2> secret"</script><style><h2>Fake</h2></style><p>Unsectioned</p>');
 assert.deepEqual(e.sections,[]);assert.equal(e.sectionCoverage.headingCount,0);
 const real=extractHtml('<H4 class="x">'+ 'Long'.repeat(100)+'</H4><p>Verified <b>answer</b>.</p><h5>Empty</h5>');
 assert.equal(real.sections[0].heading.length,200);assert.equal(real.sections[0].headingTruncated,true);
 assert.equal(real.sections[0].level,4);assert.equal(real.sections[0].text,'Verified answer .');
 assert.equal(real.sections[1].text,'');assert.equal(real.sections[1].textTruncated,false);
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
test('same-origin redirect provenance survives HTML extraction under the final evidence URL',async()=>{
 const chain=[{url:'https://example.com/',status:301,nextUrl:'https://example.com/home',observedAt:'2026-10-14T06:00:00Z'}];
 const e=await collectEvidence('https://example.com/',{fetchPage:async requestedUrl=>({
  requestedUrl,url:requestedUrl==='https://example.com/'?'https://example.com/home':requestedUrl,
  redirectChain:requestedUrl==='https://example.com/'?chain:[],status:200,
  headers:{'content-type':'text/html'},body:'<title>Final page</title>',observedAt:'2026-10-14T06:00:01Z'
 })});
 assert.equal(e.observations[0].url,'https://example.com/home');
 assert.equal(e.observations[0].requestedUrl,'https://example.com/');
 assert.deepEqual(e.observations[0].redirectChain,chain);
 assert.equal(e.observations[0].title,'Final page');assert.equal(e.observations[0].id,'E1');
});
test('robots policy uses complete fetched rules and stable observation IDs',async()=>{
 const e=await collectEvidence('https://example.com/',{fetchPage:async url=>({url,status:200,observedAt:'2026-10-13T13:00:00Z',headers:{'content-type':url.endsWith('.txt')?'text/plain':'text/html'},body:url.endsWith('.txt')?'#'+'x'.repeat(17000)+'\nUser-agent: GPTBot\nDisallow: /\nUser-agent: OAI-SearchBot\nAllow: /':'<h1>Home</h1>'})});
 assert.deepEqual(e.observations.map(o=>o.id),['E1','E2','E3']);
 assert.equal(e.robotsPolicy.evidenceId,'E2');assert.equal(e.observations[1].bodyTruncated,true);
 assert.equal(e.robotsPolicy.evaluations.find(o=>o.agent==='GPTBot').status,'disallowed_according_to_robots_txt');
 assert.ok(e.observations.every(o=>o.method&&o.observedAt&&o.limitations.length));
});
test('collector retains successful JSON robots evidence without inferring bot permission',async()=>{
 const e=await collectEvidence('https://example.com/',{fetchPage:async url=>({url,status:200,observedAt:'2026-10-14T10:57:00Z',headers:{'content-type':url.endsWith('/robots.txt')?'application/json':'text/html'},body:url.endsWith('/robots.txt')?'{"error":"unauthorized"}':'<h1>Public offer</h1>'})});
 assert.equal(e.observations[1].status,200);assert.equal(e.observations[1].body,'{"error":"unauthorized"}');
 assert.equal(e.robotsPolicy.status,'unknown');assert.deepEqual(e.robotsPolicy.evaluations,[]);
 assert.equal(e.robotsPolicy.evidenceId,'E2');assert.equal(e.observations[0].title,'');
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
test('optional rendered evidence gets separate IDs and preserves raw evidence on failure',async()=>{
 const fetchPage=async url=>({url,status:200,observedAt:'2026-10-13T00:00:00Z',headers:{'content-type':'text/html'},body:'<title>Raw</title>'});
 const good=await collectEvidence('https://example.com/',{fetchPage,renderPage:async url=>({url,title:'Rendered',observedAt:'2026-10-13T00:00:01Z',method:'Sandboxed fixture'})});
 assert.equal(good.observations[0].title,'Raw');assert.equal(good.observations[3].title,'Rendered');assert.equal(good.observations[3].id,'E4');assert.equal(good.observations[3].kind,'rendered_page');
 const bad=await collectEvidence('https://example.com/',{fetchPage,renderPage:async()=>{throw Error('Isolation unavailable');}});
 assert.equal(bad.observations[0].title,'Raw');assert.equal(bad.observations[3].error,'Isolation unavailable');
 const redirected=await collectEvidence('https://example.com/',{fetchPage,renderPage:async()=>({url:'https://other.example/'})});
 assert.match(redirected.observations[3].error,/Cross-origin/);
});

test('sitemap declaration selects first safe absolute same-origin HTTPS URL',async()=>{
 const {selectSitemap}=await import('./evidence.mjs');
 const base='https://example.com/';
 const unsafe=['/relative.xml','http://example.com/map.xml','https://external.test/map.xml','https://user:pass@example.com/map.xml','https://example.com:444/map.xml','https://example.com/map.xml?q=secret','https://example.com/map.xml#fragment','https://127.0.0.1/map.xml'];
 const body=unsafe.map(u=>'Sitemap: '+u).join('\n')+'\n sItEmAp : https://example.com/maps/public.xml # comment\nSitemap: https://example.com/ignored.xml';
 assert.deepEqual(selectSitemap({status:200,body},base),{url:'https://example.com/maps/public.xml',selection:'first_safe_robots_declaration'});
 for(const status of [404,500])assert.equal(selectSitemap({status,body},base).selection,'default');
 assert.equal(selectSitemap({status:200,body:unsafe.map(u=>'Sitemap: '+u).join('\n')},base).url,base+'sitemap.xml');
});
test('declared sitemap replaces default request and exposes useful page within seven fetches',async()=>{
 const calls=[];
 const fetchPage=async url=>{calls.push(url);return {url,status:200,observedAt:'now',headers:{'content-type':'text/plain'},body:url.endsWith('/robots.txt')?'Sitemap: https://example.com/maps/pages.xml':url.endsWith('/maps/pages.xml')?'<loc>https://example.com/pricing</loc>':Array.from({length:6},(_,i)=>`<a href="/docs/${i}">Doc</a>`).join('')};};
 const e=await collectEvidence('https://example.com/',{fetchPage});
 assert.equal(calls.length,7);assert.ok(!calls.includes('https://example.com/sitemap.xml'));
 assert.equal(e.observations[2].url,'https://example.com/maps/pages.xml');assert.equal(e.observations[2].id,'E3');
 assert.ok(e.scope.selectedPages.includes('https://example.com/pricing'));
 assert.equal(e.scope.sitemapDiscovery.selection,'first_safe_robots_declaration');
});
test('unavailable declared sitemap stays unknown without a fallback or child-map request',async()=>{
 const calls=[];
 const e=await collectEvidence('https://example.com/',{fetchPage:async url=>{
 calls.push(url);if(url.endsWith('/map.xml'))throw Error('timeout');
 return {url,status:200,observedAt:'now',headers:{'content-type':'text/plain'},body:url.endsWith('/robots.txt')?'Sitemap: https://example.com/map.xml':'Home'};
 }});
 assert.equal(calls.length,3);assert.equal(e.observations[2].error,'timeout');assert.deepEqual(e.scope.selectedPages,[]);
 assert.ok(e.scope.limitations.some(x=>x.includes('no fallback')));
});
