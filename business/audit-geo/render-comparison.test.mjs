import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractHtml} from './evidence.mjs';
import {compareRenderedHtml} from './render-comparison.mjs';
test('unchanged metadata has no observed changes even with absent JSON-LD',()=>{
 const raw=extractHtml('<title>Fixture</title><h1>Offer</h1>');
 const rendered=structuredClone(raw);rendered.structuredData.status='not_observed_in_rendered_dom';
 assert.deepEqual(compareRenderedHtml(raw,rendered).changes,[]);
});
test('added, removed and changed fields retain exact bounded before/after values',()=>{
 const raw=extractHtml('<title>Raw</title><h1>Old</h1><link rel="canonical" href="/old">');
 const rendered=extractHtml('<title>Rendered</title><h1>New</h1><meta name="robots" content="noindex"><script type="application/ld+json">{"@type":"Organization"}</script>');
 const result=compareRenderedHtml(raw,rendered,{url:'https://example.com/',observedAt:'2026-10-13T00:00:00Z'});
 assert.deepEqual(result.changes.map(c=>c.field),['title','h1','canonicals','robots','structuredData']);
 assert.deepEqual(result.changes.find(c=>c.field==='canonicals'),{field:'canonicals',before:['/old'],after:[]});
 assert.equal(result.url,'https://example.com/');
 assert.deepEqual(result.changes.at(-1).before,[]);
});
