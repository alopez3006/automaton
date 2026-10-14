import{test}from'node:test';import assert from'node:assert/strict';
import{selectAuditRequests,unavailableEvidenceMessage}from'./operator-requests.mjs';
const id='12345678-1234-1234-1234-123456789abc';
const legacy='We could not access useful public evidence for this website. No payment is requested.';
test('diagnosed unavailable retry selects only its request despite other incoming work',()=>{
 const target={id,status:'ineligible',message:legacy};
 const jobs=[{id:'other',status:'requested'},target,{id:'review',status:'needs_review'}];
 assert.deepEqual(selectAuditRequests(jobs,{retryUnavailable:id}),[target]);
 assert.equal(target.status,'ineligible');
 assert.deepEqual(selectAuditRequests([{id,status:'needs_review',message:unavailableEvidenceMessage}],{retryUnavailable:id}),[{id,status:'needs_review',message:unavailableEvidenceMessage}]);
});
test('diagnostic retry refuses commercial, paid, unrelated and ambiguous jobs',()=>{
 for(const status of ['requested','prepared','payment_pending','delivered'])assert.throws(()=>selectAuditRequests([{id,status,message:legacy}],{retryUnavailable:id}));
 assert.throws(()=>selectAuditRequests([{id,status:'ineligible',message:'No useful paid change was supported by the evidence.'}],{retryUnavailable:id}));
 assert.throws(()=>selectAuditRequests([],{retryUnavailable:id}));
 assert.throws(()=>selectAuditRequests([{id,status:'ineligible',message:legacy},{id,status:'ineligible',message:legacy}],{retryUnavailable:id}));
 assert.throws(()=>selectAuditRequests([],{retryUnavailable:'bad'}));
 assert.throws(()=>selectAuditRequests([],{retryUnavailable:id,retryReview:true}));
});
test('routine watcher preserves terminal jobs and the two-request processing bound',()=>{
 const jobs=['ineligible','payment_pending','delivered','requested','needs_review','requested','requested'].map((status,i)=>({id:String(i),status}));
 assert.deepEqual(selectAuditRequests(jobs).map(j=>j.id),['3','5']);
 assert.deepEqual(selectAuditRequests(jobs,{retryReview:true}).map(j=>j.id),['3','4']);
});
