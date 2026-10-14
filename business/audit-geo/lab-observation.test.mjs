import test from 'node:test';
import assert from 'node:assert/strict';
import {collectEvidence,summarizePageSpeed} from './evidence.mjs';
import {labObservation} from './lab-observation.mjs';
import {validateDraft,canRequestPayment} from './validate-draft.mjs';
const target='https://example.org/';
const measured=()=>summarizePageSpeed({lighthouseResult:{requestedUrl:target,finalUrl:target+'landing',fetchTime:'2026-10-14T00:00:00Z',lighthouseVersion:'12.8.2',categories:{performance:{score:.7}},audits:{'largest-contentful-paint':{numericValue:3200,numericUnit:'millisecond'},'render-blocking-resources':{score:0,title:'Eliminate render-blocking resources',description:'Resources delay rendering.',details:{overallSavingsMs:120}}}}},'PageSpeed Insights');
const draft=(o,field,excerpt)=>({report:'# Audit\n## Scope\nSingle mobile lab run.\n## Evidence\nE4 observed lab diagnostic.\n## Tasks\nCheck blocking resources E4. No-action if not reproduced.\n## Measurement\nRepeat under comparable conditions.',eligible:true,reason:'Conditional supported diagnostic',taskCount:1,tasks:[{title:'Check blocking resources',references:[{evidenceId:o.id,url:o.url,observedAt:o.observedAt,field,excerpt}]}]});
test('measured URL and lab date supply distinct provenance; exact numeric/text leaves are citeable',()=>{
 const p=measured(),o=labObservation(p,target,'E4');assert.equal(o.url,target+'landing');assert.equal(o.observedAt,p.observedAt);
 for(const [field,excerpt] of [['lab.diagnostics.0.title','render-blocking'],['lab.diagnostics.0.savingsMs','120'],['lab.metrics.1.value','3200'],['lab.strategy','mobile'],['lab.performanceScore','0.7']]){
  const d=draft(o,field,excerpt);assert.equal(validateDraft(d,{observations:[o]}).sourceReferencesValid,true);assert.equal(canRequestPayment(d,{observations:[o]}),false);
 }
});
test('unavailable, unrelated and unsafe measurement identities never enter the register',()=>{
 for(const patch of [{status:'unavailable'},{strategy:'desktop'},{requestedUrl:target+'other'},{finalUrl:'https://other.org/'},{finalUrl:'http://example.org/'},{finalUrl:'https://user:pass@example.org/'},{observedAt:'invalid'},{finalUrl:null}])assert.equal(labObservation({...measured(),...patch},target,'E4'),null);
});
test('missing/null/nonfinite, invented and field-data leaves cannot be lab citations',()=>{
 const o=labObservation(measured(),target,'E4');
 for(const [field,excerpt] of [['lab.metrics.0.value','0'],['lab.diagnostics.9.title','anything'],['lab.diagnostics.0.title','Invented'],['lab.diagnostics.0','Resources'],['lab.field.origin.overallCategory','FAST'],['lab.__proto__.title','x'],['status','available'],['body','anything']])assert.throws(()=>validateDraft(draft(o,field,excerpt),{observations:[o]}));
 o.lab.metrics[0].value=Infinity;assert.throws(()=>validateDraft(draft(o,'lab.metrics.0.value','Infinity'),{observations:[o]}));
 const html={...o,kind:'page'};assert.throws(()=>validateDraft(draft(html,'lab.strategy','mobile'),{observations:[html]}));
 const d=draft(o,'lab.strategy','mobile');d.tasks[0].references[0].observedAt='2026-10-13';assert.throws(()=>validateDraft(d,{observations:[o]}));
});
test('optional collection appends one stable lab identity without more HTML requests; failure adds none',async()=>{
 for(const available of [true,false]){
  let calls=0,labCalls=0;
  const e=await collectEvidence(target,{pagespeed:true,fetchPage:async url=>{calls++;return {url,status:200,headers:{'content-type':'text/plain'},body:'',observedAt:'2026-10-13T00:00:00Z'};},collectPerformance:async url=>{labCalls++;assert.equal(url,target);return available?measured():{status:'unavailable',error:'HTTP 429'};}});
  assert.equal(calls,3);assert.equal(labCalls,1);assert.equal(e.observations.length,available?4:3);assert.equal(e.performance.evidenceId,available?'E4':undefined);
  assert.equal(e.observations[0].observedAt,'2026-10-13T00:00:00Z');assert.equal(e.robotsPolicy.evidenceId,'E2');
 }
});
