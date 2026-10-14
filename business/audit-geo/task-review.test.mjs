import test from 'node:test';import assert from 'node:assert/strict';
import {canRequestPayment} from './validate-draft.mjs';
import {validateTaskReview,reviewDigest} from './task-review.mjs';
import {approveFixture} from './task-review-fixture.mjs';
const evidence={observations:[{id:'E1',url:'https://example.org/',observedAt:'2026-10-14T00:00:00Z',title:'Public product',body:'Sample'}]};
const make=()=>approveFixture({report:'# Audit\n\n## Scope\nSampled public page.\n\n## Evidence\nE1: observed source.\n\n## Tasks\nClarify wording E1. No-action condition: keep accurate wording.\n\n## Measurement\nVerify the intended description after execution.',eligible:true,reason:'Useful conditional clarification',taskCount:1,tasks:[{title:'Clarify wording',references:[{evidenceId:'E1',url:evidence.observations[0].url,observedAt:evidence.observations[0].observedAt,field:'title',excerpt:'Public product'}]}]},evidence);
test('complete conditional record passes; legacy global approval fails closed',()=>{const d=make();assert.equal(canRequestPayment(d,evidence),true);d.review={sourceSupportApproved:true,usefulnessApproved:true};assert.equal(canRequestPayment(d,evidence),false);});
for(const [name,patch] of [
 ['unrelated quote',{semanticSupport:'unsupported'}],['absence outside truncated excerpt',{semanticSupport:'unknown'}],['over-limit collector mistaken for defect',{decision:'remove'}],['training/search role conflation',{semanticSupport:'unsupported'}],['parsed schema with unverified product claim',{semanticSupport:'unknown'}],['accurate wording requires no change',{decision:'remove'}],['unseen invented citation outcome',{semanticSupport:'unsupported'}],['unseen stale pricing claim',{decision:'revise'}]
])test(name+' cannot invite payment',()=>{const d=make();Object.assign(d.review.findings[0],patch);assert.equal(canRequestPayment(d,evidence),false);});
test('critical noindex requires reproduction and intended indexing',()=>{const d=make(),r=d.review.findings[0];r.severity='critical';r.semanticSupport='supported';assert.equal(canRequestPayment(d,evidence),false);r.reproduction={status:'reproduced',reason:'Synthetic control: same page noindex reproduced.'};r.intendedIndexing=true;assert.equal(canRequestPayment(d,evidence),true);});
test('zero tasks remains ineligible despite complete review',()=>{const d=approveFixture({report:'No useful tasks.',eligible:false,reason:'No useful task',tasks:[],taskCount:0},evidence);assert.equal(canRequestPayment(d,evidence),false);});
test('any edit to report, task or frozen evidence invalidates prior review',()=>{for(const mutate of [d=>d.report+=' Changed.',d=>d.tasks[0].target='/other']){const d=make();mutate(d);assert.equal(canRequestPayment(d,evidence),false);}const e=structuredClone(evidence);e.observations[0].body='Changed sample';assert.equal(canRequestPayment(make(),e),false);});
test('every task must have matching evidence and all review dimensions',()=>{for(const field of ['supportReason','counterevidence','coverage','value','change','acceptance','noAction','reproduction']){const d=make();delete d.review.findings[0][field];assert.equal(canRequestPayment(d,evidence),false);}for(const ids of [[],['E99'],['E1','E1']]){const d=make();d.review.findings[0].evidenceIds=ids;assert.equal(canRequestPayment(d,evidence),false);}const d=make();d.tasks.push({...d.tasks[0],title:'Second task'});d.report+=' Second task E1';d.taskCount=2;d.review.inputDigest=reviewDigest(d,evidence);assert.equal(validateTaskReview(d,evidence).approved,false);});

test('fresh independent approval cannot authorize an incomplete deliverable',()=>{
 const original=make();
 for(const section of ['Scope','Evidence','Tasks','Measurement']){
  const d=structuredClone(original);
  d.report=d.report.replace('## '+section,'## Other');
  approveFixture(d,evidence);
  assert.equal(validateTaskReview(d,evidence).approved,true);
  assert.equal(canRequestPayment(d,evidence),false,section);
 }
 for(const report of ['Clarify wording E1.',original.report.replace('No-action condition','Skip condition'),original.report.slice(0,-1)]){
  const d=approveFixture({...structuredClone(original),report},evidence);
  assert.equal(validateTaskReview(d,evidence).approved,true);
  assert.equal(canRequestPayment(d,evidence),false);
 }
});
test('fresh task approval cannot authorize an empty or example-only report section',()=>{
 const original=make();
 for(const title of ['Scope','Evidence','Tasks','Measurement']){
  for(const body of ['', '<!-- Placeholder. -->', '```markdown\nExample only.\n```']){
   const report=original.report.replace(new RegExp(`(## ${title}\\n)[\\s\\S]*?(?=\\n## |$)`),`$1${body}\n`)+'\n## End\nFinished.';
   const d=approveFixture({...structuredClone(original),report},evidence);
   assert.equal(validateTaskReview(d,evidence).approved,true);
   assert.equal(canRequestPayment(d,evidence),false,`${title}: ${body}`);
  }
 }
});
test('fresh task approval cannot invite payment with a hidden no-action instruction or ending',()=>{
 const original=make();
 for(const hidden of ['<!-- No-action: keep accurate wording. -->','```text\nNo-action: keep accurate wording.\n```','### No-action: keep accurate wording.']){
  const report=original.report.replace(' No-action condition: keep accurate wording.','')+'\n'+hidden+'\nFinished.';
  const d=approveFixture({...structuredClone(original),report},evidence);
  assert.equal(validateTaskReview(d,evidence).approved,true);
  assert.equal(canRequestPayment(d,evidence),false);
 }
 const d=approveFixture({...structuredClone(original),report:original.report.slice(0,-1)+'\n<!-- Finished. -->'},evidence);
 assert.equal(validateTaskReview(d,evidence).approved,true);
 assert.equal(canRequestPayment(d,evidence),false);
});
