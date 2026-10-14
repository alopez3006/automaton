import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDraft,canRequestPayment} from './validate-draft.mjs';
import {approveFixture} from './task-review-fixture.mjs';
const evidence={observations:[{id:'E1',url:'https://example.org/',observedAt:'2026-10-13T00:00:00Z',status:200,title:'Example',descriptions:[''],body:'Observed public offer'}]};
const make=()=>({report:'Improve description — E1',eligible:true,reason:'Useful',taskCount:1,tasks:[{title:'Improve description',references:[{evidenceId:'E1',url:'https://example.org/',observedAt:'2026-10-13T00:00:00Z',field:'descriptions.0',excerpt:''}]}]});
test('section citations require exact retained scalar and existing index, and still need review',()=>{
 const e={observations:[{...evidence.observations[0],sections:[{heading:'Pricing',text:'EUR 9 once'}]}]};
 for(const field of ['sections.0.heading','sections.0.text']){
  const d=make();Object.assign(d.tasks[0].references[0],{field,excerpt:field.endsWith('heading')?'Pricing':'EUR 9'});
  assert.equal(validateDraft(d,e).sourceReferencesValid,true);assert.equal(canRequestPayment(d,e),false);
 }
 for(const patch of [{field:'sections.1.text',excerpt:'EUR 9'},{field:'sections.0.text',excerpt:'Free'},{field:'sections.0.__proto__',excerpt:''},{field:'sectionCoverage.omitted',excerpt:'0'}]){
  const d=make();Object.assign(d.tasks[0].references[0],patch);assert.throws(()=>validateDraft(d,e));
 }
});
test('observed empty description is supported but needs usefulness review',()=>{const d=make();assert.equal(validateDraft(d,evidence).sourceReferencesValid,true);assert.equal(canRequestPayment(d,evidence),false);approveFixture(d,evidence);assert.equal(canRequestPayment(d,evidence),true);});
test('invented identity, dates, fields and excerpts fail closed',()=>{for(const patch of [{evidenceId:'E99'},{url:'https://other.org/'},{observedAt:'yesterday'},{field:'__proto__.title'},{field:'descriptions.1'},{field:'title',excerpt:'Invented'},{field:'title',excerpt:''}]){const d=make();Object.assign(d.tasks[0].references[0],patch);assert.throws(()=>validateDraft(d,evidence));assert.equal(canRequestPayment(d,evidence),false);}});
test('failed fetch cannot support a task',()=>{assert.throws(()=>validateDraft(make(),{observations:[{...evidence.observations[0],error:'Unavailable'}]}));});
test('counts, absent tasks, omitted report citations and duplicate titles fail',()=>{for(const mutate of [d=>d.taskCount=2,d=>delete d.tasks,d=>d.report='Improve description',d=>d.report='E1 only',d=>{d.tasks.push(d.tasks[0]);d.taskCount=2;}]){const d=make();mutate(d);assert.throws(()=>validateDraft(d,evidence));}});
test('a longer or embedded identifier cannot stand in for the cited observation',()=>{for(const citation of ['E10','prefixE1','E1suffix']){const d=make();d.report='Improve description — '+citation;d.review={usefulnessApproved:true,sourceSupportApproved:true};assert.throws(()=>validateDraft(d,evidence));assert.equal(canRequestPayment(d,evidence),false);}const d=make();d.report='Improve description — [E1]';validateDraft(d,evidence);});
test('zero useful tasks can be ineligible, never payment eligible',()=>{const d={report:'No changes supported.',eligible:false,reason:'No task',taskCount:0,tasks:[]};validateDraft(d,evidence);assert.equal(canRequestPayment(d,evidence),false);d.eligible=true;assert.throws(()=>validateDraft(d,evidence));});
test('valid excerpt matches an observed scalar; legacy drafts cannot unlock payment',()=>{const d=make();Object.assign(d.tasks[0].references[0],{field:'body',excerpt:'public offer'});validateDraft(d,evidence);delete d.tasks;d.review={usefulnessApproved:true,sourceSupportApproved:true};assert.equal(canRequestPayment(d,evidence),false);});
test('JSON-LD value citations cover graph, array, numeric and boolean leaves without payment approval',()=>{
 const value={'@graph':[{'@type':['Organization','LocalBusiness'],url:'https://example.org/',offers:{price:9,available:true}}]};
 const e={observations:[{...evidence.observations[0],structuredData:{blocks:[{status:'parsed',value}]}}]};
 for(const [suffix,excerpt] of [['@graph.0.@type.1','LocalBusiness'],['@graph.0.url','https://example.org/'],['@graph.0.offers.price','9'],['@graph.0.offers.available','true']]){
  const d=make();Object.assign(d.tasks[0].references[0],{field:'structuredData.blocks.0.value.'+suffix,excerpt});
  assert.equal(validateDraft(d,e).sourceReferencesValid,true);assert.equal(canRequestPayment(d,e),false);
 }
});
test('JSON-LD citations reject unparsed blocks, invented leaves, containers and unsafe paths',()=>{
 const value=JSON.parse('{"@type":"Product","constructor":"unsafe","nullValue":null,"nested":{"name":"Observed"}}');
 const e={observations:[{...evidence.observations[0],structuredData:{blocks:[{status:'parsed',value},{status:'invalid_json',value}]}}]};
 for(const [path,excerpt] of [['0.value.@type','Organization'],['0.value.missing','x'],['0.value.nested','Observed'],['0.value.nullValue','null'],['0.value.constructor','unsafe'],['0.value.__proto__.name','x'],['1.value.@type','Product'],['2.value.@type','Product'],['0.value.'+'nested.'.repeat(9)+'name','Observed'],['0.value.toString','x']]){
  const d=make();Object.assign(d.tasks[0].references[0],{field:'structuredData.blocks.'+path,excerpt});assert.throws(()=>validateDraft(d,e));
 }
 value.number=Infinity;
 const d=make();Object.assign(d.tasks[0].references[0],{field:'structuredData.blocks.0.value.number',excerpt:'Infinity'});assert.throws(()=>validateDraft(d,e));
});
