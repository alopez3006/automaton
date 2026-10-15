import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdtemp,readFile,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pilotScorecard,validateWork,recordAutomationWork,loadPilotScorecard} from './pilot-scorecard.mjs';
const at='2026-10-16T10:00:00Z',id='11111111-1111-4111-8111-111111111111';
const plan={version:1,startedAt:'2026-10-15T10:00:00Z',reviewAt:'2026-10-29T10:00:00Z',targetQualifiedRequests:10,segment:'small-saas-with-website-agent',priceCents:900,currency:'eur',humanHourlyCostCents:2400,maxHumanSecondsPerSale:900,automaticDeliveryVerified:false,sourcePublicationUnblocked:false};
const payment={amountCents:900,currency:'eur',paymentLink:'plink_fixture',stripeContext:'acct_fixture'};
const job={id,createdAt:'2026-10-15T11:00:00Z',status:'delivered',paymentReceipt:'cs_live_fixture',email:'SECRET@example.invalid',report:'PRIVATE REPORT',website:'https://private.invalid'};
function proof(){return {qualification:{externalCustomer:true,ownerTest:false,consentVerified:true,segment:plan.segment,observedAt:'2026-10-15T12:00:00Z',evidenceRef:'qualification.json'},payment:{source:'native-stripe-retrieval',observedAt:'2026-10-15T13:00:00Z',account:'acct_fixture',session:{id:'cs_live_fixture',livemode:true,status:'complete',payment_status:'paid',currency:'eur',amount_total:900,client_reference_id:id,payment_link:'plink_fixture'}},delivery:{source:'customer-confirmation',observedAt:'2026-10-15T14:00:00Z',paymentReceipt:'cs_live_fixture',reportAccessConfirmed:true,evidenceRef:'customer-confirmation.json'}};}
const cohort={version:1,requestIds:[id]};
const score=(p=proof())=>pilotScorecard({requests:[job]},plan,cohort,{[id]:p},[],payment,at);
test('status is never a sale and output contains no request identity, private content or capability',()=>{
 const p=proof();delete p.payment;delete p.delivery;const s=score(p);
 assert.equal(s.cohort.verifiedLivePayments,0);assert.equal(s.cohort.customerConfirmedReportAccess,0);assert.equal(s.economics.humanSecondsPerSale,null);assert.equal(s.economics.estimatedContributionCents,null);assert.equal(s.visitorConversionRate,null);assert.equal(s.decision,'repair_delivery');
 assert.doesNotMatch(JSON.stringify(s),/PRIVATE|SECRET|private.invalid|11111111|cs_live|qualification.json/);
});
test('external cohort requires explicit new consented external qualification, excluding tests and past records',()=>{
 for(const mutation of [{externalCustomer:false},{ownerTest:true},{consentVerified:false},{segment:'other'},{observedAt:'2026-10-17T00:00:00Z'},{observedAt:'2026-10-14T00:00:00Z'},{evidenceRef:'https://secret.invalid/request/token'}]){const p=proof();Object.assign(p.qualification,mutation);assert.throws(()=>score(p));}
 assert.throws(()=>pilotScorecard({requests:[{...job,createdAt:'2026-10-14T00:00:00Z'}]},plan,cohort,{[id]:proof()},[],payment,at));
 assert.throws(()=>pilotScorecard({requests:[job]},plan,{version:1,requestIds:[id,id]},{[id]:proof()},[],payment,at));
});
test('live session must match amount, currency, request, account, payment link and retained receipt',()=>{
 assert.equal(score().cohort.verifiedLivePayments,1);
 for(const mutation of [{livemode:false},{status:'open'},{payment_status:'unpaid'},{currency:'usd'},{amount_total:899},{client_reference_id:'other'},{payment_link:'plink_other'},{id:'cs_other'}]){const p=proof();Object.assign(p.payment.session,mutation);assert.equal(score(p).cohort.verifiedLivePayments,0);}
 for(const mutation of [{account:'acct_other'},{source:'retained-status-only'},{observedAt:'2026-10-17T00:00:00Z'}]){const p=proof();Object.assign(p.payment,mutation);assert.equal(score(p).cohort.verifiedLivePayments,0);}
});
test('provider delivery never substitutes for customer report access and must follow the paid evidence',()=>{
 assert.equal(score().cohort.customerConfirmedReportAccess,1);
 for(const mutation of [{source:'resend-delivered'},{paymentReceipt:'cs_other'},{reportAccessConfirmed:false},{observedAt:'2026-10-15T12:00:00Z'},{observedAt:'2026-10-17T00:00:00Z'}]){const p=proof();Object.assign(p.delivery,mutation);assert.equal(score(p).cohort.customerConfirmedReportAccess,0);}
});
test('economics includes refused work and overhead; incomplete coverage stays unknown',()=>{
 const refusedId='22222222-2222-4222-8222-222222222222',p=proof(),refusal=proof();refusal.qualification.evidenceRef='refusal.json';delete refusal.payment;delete refusal.delivery;
 const proofs={[id]:p,[refusedId]:refusal};for(const v of Object.values(proofs))Object.assign(v,{humanWorkCoverage:'complete',externalCostCents:0,costEvidenceRef:'cost.json'});
 Object.assign(p.payment,{feeCents:60,feeEvidenceRef:'stripe-fee.json'});
 const work=[{requestId:id,seconds:300},{requestId:refusedId,seconds:300},{requestId:null,seconds:300}].map((r,i)=>({...r,eventId:`33333333-3333-4333-8333-33333333333${i}`,observedAt:at,actor:'human',measurement:'measured_human',evidenceRef:'measured.json'}));
 const c={version:1,requestIds:[id,refusedId],overheadWorkCoverage:'complete',overheadExternalCostCents:0,overheadCostEvidenceRef:'overhead.json'};
 const run=()=>pilotScorecard({requests:[job,{...job,id:refusedId,status:'ineligible'}]},plan,c,proofs,work,payment,at);
 const s=run();assert.equal(s.cohort.noUsefulTaskDecisions,1);assert.equal(s.economics.recordedHumanSeconds,900);assert.equal(s.economics.humanSecondsPerSale,900);assert.equal(s.economics.estimatedContributionCents,240);
 delete p.payment.feeEvidenceRef;assert.equal(run().economics.estimatedContributionCents,null);delete c.overheadWorkCoverage;assert.equal(run().economics.humanSecondsPerSale,null);
});
test('missing retained records remain unresolved, and ten qualified requests are an explicit checkpoint',()=>{
 const ids=Array.from({length:10},(_,i)=>`${String(i).padStart(8,'0')}-1111-4111-8111-111111111111`),proofs=Object.fromEntries(ids.map(id=>{const p=proof();delete p.payment;return[id,p];}));
 const ready={...plan,automaticDeliveryVerified:true,sourcePublicationUnblocked:true};
 assert.equal(pilotScorecard({requests:ids.map(id=>({...job,id,status:'ineligible'}))},ready,{version:1,requestIds:ids},proofs,[],payment,at).decision,'review_segment_and_offer');
 const missing=pilotScorecard({requests:[]},ready,{version:1,requestIds:ids},proofs,[],payment,at);assert.equal(missing.decision,'reconcile_missing_evidence');assert.equal(missing.cohort.missingFromRetainedPage,10);
 const due=pilotScorecard({requests:[]},plan,{version:1,requestIds:[]},{},[],payment,'2026-10-30T00:00:00Z');assert.equal(due.reviewDue,true);assert.equal(due.decision,'repair_delivery');
});
test('work rejects invalid numbers, unsafe references and duplicate events; elapsed automation is separate',()=>{
 const w={eventId:'33333333-3333-4333-8333-333333333333',observedAt:at,actor:'automation',seconds:12,requestId:id,measurement:'measured_elapsed',evidenceRef:'operator-run'};
 for(const seconds of [NaN,Infinity,-1,86401])assert.throws(()=>validateWork({...w,seconds}));
 assert.throws(()=>validateWork({...w,actor:'human'}));assert.throws(()=>validateWork({...w,evidenceRef:'../../secret'}));
 assert.throws(()=>pilotScorecard({requests:[job]},plan,cohort,{[id]:proof()},[w,w],payment,at));
 const s=pilotScorecard({requests:[job]},plan,cohort,{[id]:proof()},[w],payment,at);assert.equal(s.economics.recordedAutomationSeconds,12);assert.equal(s.economics.recordedHumanSeconds,0);assert.equal(s.economics.humanCoverageComplete,false);
});
test('assisted delivery can progress without claiming automatic sending or a completed paid journey',()=>{
 const assisted={...plan,deliveryMode:'assisted-native-resend',nativeTransactionalChannelVerified:true};
 const s=pilotScorecard({requests:[]},assisted,{version:1,requestIds:[]},{},[],payment,at);
 assert.equal(s.decision,'prove_first_assisted_delivery');assert.equal(s.automaticDeliveryReady,false);assert.equal(s.assistedChannelAvailable,true);assert.equal(s.firstPaidCustomerDeliveryVerified,false);
 assert.equal(pilotScorecard({requests:[]},{...assisted,nativeTransactionalChannelVerified:false},{version:1,requestIds:[]},{},[],payment,at).decision,'repair_delivery');
});
test('operator refuses mixed scorecard and inspection/mutation modes before memory or network access',()=>{
 for(const args of [['--inspect-request','https://example.invalid'],['--accept-orders'],['--close-reviewed-no-action',id]]){
  assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(new URL('./operator.mjs',import.meta.url)),'--pilot-scorecard',...args],{stdio:'pipe'}),error=>{assert.equal(error.status,1);assert.match(error.stderr.toString(),/Pilot scorecard cannot combine/);assert.equal(error.stdout.toString(),'');return true;});
 }
});
test('actual elapsed work is retained privately and absent qualification evidence cannot produce a cohort',async()=>{
 const root=await mkdtemp(join(tmpdir(),'audit-pilot-'));
 try{
  const reports=join(root,'.reports');await mkdir(reports);
  await recordAutomationWork(reports,id,performance.now());
  const row=JSON.parse((await readFile(join(reports,'pilot-work.jsonl'),'utf8')).trim());assert.equal(row.actor,'automation');assert.equal(row.requestId,id);assert.ok(row.seconds>=0);assert.equal(row.measurement,'measured_elapsed');
  await writeFile(join(root,'pilot-plan.json'),JSON.stringify(plan));await writeFile(join(root,'payment.json'),JSON.stringify(payment));await writeFile(join(reports,'pilot-cohort.json'),JSON.stringify(cohort));await writeFile(join(reports,id+'.pilot-proof.json'),JSON.stringify(proof()));
  await assert.rejects(()=>loadPilotScorecard(root,{requests:[job]}));
  await writeFile(join(root,'outside.json'),'{}');await symlink(join(root,'outside.json'),join(reports,'qualification.json'));
  await assert.rejects(()=>loadPilotScorecard(root,{requests:[job]}),/Regular private evidence/);
 }finally{await rm(root,{recursive:true,force:true});}
});
