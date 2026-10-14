import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {diagnoseReadiness,summarizeReadiness} from './review-readiness.mjs';
import {approveFixture} from './task-review-fixture.mjs';
const evidence={observations:[{id:'E1',url:'https://example.org/',observedAt:'2026-10-14',title:'Observed'}]};
function draft(){return approveFixture({report:'# Audit\n## Scope\nSample.\n## Evidence\nE1 Observed.\n## Tasks\nClarify copy. No-action if accurate.\n## Measurement\nVerify next week.',eligible:true,reason:'Useful',taskCount:1,tasks:[{title:'Clarify copy',references:[{evidenceId:'E1',url:'https://example.org/',observedAt:'2026-10-14',field:'title',excerpt:'Observed'}]}]},evidence);}
test('complete reviewed snapshot is local readiness only; incomplete approved reports fail',()=>{
 assert.equal(diagnoseReadiness(draft(),evidence).locallyReady,true);
 const d=draft();d.report='Clarify copy E1.';approveFixture(d,evidence);
 assert.deepEqual(diagnoseReadiness(d,evidence),{referencesValid:true,reportComplete:false,currentReviewApproved:true,locallyReady:false});
});
test('stale review and fabricated excerpts fail distinct diagnostics',()=>{
 const d=draft();d.report+=' Changed.';
 assert.equal(diagnoseReadiness(d,evidence).currentReviewApproved,false);
 d.tasks[0].references[0].excerpt='Invented';
 assert.equal(diagnoseReadiness(d,evidence).referencesValid,false);
 assert.equal(diagnoseReadiness(null,null).locallyReady,false);
});
test('a current review of a complete zero-task report never implies payment readiness',()=>{
 const d=approveFixture({report:'# Audit\n## Scope\nSample.\n## Evidence\nE1 Observed.\n## Tasks\nNo supported changes. No-action: retain current content.\n## Measurement\nCheck new evidence next week.',eligible:false,reason:'No useful task',taskCount:0,tasks:[]},evidence);
 assert.deepEqual(diagnoseReadiness(d,evidence),{referencesValid:true,reportComplete:true,currentReviewApproved:true,locallyReady:false});
 d.review.usefulnessApproved=false;
 assert.equal(diagnoseReadiness(d,evidence).currentReviewApproved,false);
});
test('inventory emits only aggregates, leaves files unchanged and rejects symlink/missing pairs',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'review-readiness-'));
 try{
  const id='00000000-0000-0000-0000-000000000001';
  const source=JSON.stringify({...draft(),privateMarker:'CUSTOMER_SECRET'});
  await writeFile(join(dir,id+'.draft.json'),source);
  await writeFile(join(dir,id+'.evidence.json'),JSON.stringify(evidence));
  await writeFile(join(dir,id.replace(/1$/,'2')+'.draft.json'),'{}');
  await symlink(join(dir,id+'.draft.json'),join(dir,id.replace(/1$/,'3')+'.draft.json'));
  await writeFile(join(dir,'credentials.env'),'DO_NOT_READ');
  const result=await summarizeReadiness(dir);
  assert.equal(result.totals.snapshots,3);assert.equal(result.totals.unreadable,2);
  assert.equal(result.totals.notCurrentlyApproved,1);
  assert.ok(!JSON.stringify(result).includes('CUSTOMER_SECRET'));
  assert.ok(!JSON.stringify(result).includes(id));
  assert.equal(await readFile(join(dir,id+'.draft.json'),'utf8'),source);
 }finally{await rm(dir,{recursive:true,force:true});}
});
