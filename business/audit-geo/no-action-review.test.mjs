import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewDigest} from './task-review.mjs';
import {validateNoActionReview,selectNoActionRequest} from './no-action-review.mjs';
const id='12345678-1234-1234-1234-123456789abc';
const evidence={observations:[{id:'E1',url:'https://example.com/',observedAt:'2026-10-14T00:00:00Z',title:'Broad title'}]};
const draft={report:'E1 Broad title clarification',eligible:true,taskCount:1,reason:'proposal',tasks:[{title:'clarification',references:[{evidenceId:'E1',url:evidence.observations[0].url,observedAt:evidence.observations[0].observedAt,field:'title',excerpt:'Broad title'}]}]};
const review=()=>({version:1,decision:'no_action',reviewer:'Independent reviewer',reviewedAt:'2026-10-14T01:00:00Z',reason:'No useful supported task',inputDigest:reviewDigest(draft,evidence),findings:[{title:'clarification',decision:'remove',reason:'No correction established',counterevidence:'Broader positioning matches the title'}]});
test('reviewed refusal is bound to original evidence and every removed task',()=>{
 assert.equal(validateNoActionReview(draft,evidence,review()),true);
 assert.throws(()=>validateNoActionReview({...draft,reason:'changed'},evidence,review()));
 assert.throws(()=>validateNoActionReview(draft,{observations:[]},review()));
 for(const change of [{findings:[]},{findings:[{...review().findings[0],decision:'keep'}]},{findings:[{...review().findings[0],counterevidence:''}]},{reviewedAt:'invalid'},{reason:''},{inputDigest:'wrong'}])assert.throws(()=>validateNoActionReview(draft,evidence,{...review(),...change}));
});
test('closure excludes paid, invited, terminal and ambiguous requests',()=>{
 const job={id,status:'prepared'};assert.equal(selectNoActionRequest([job],id),job);
 for(const status of ['requested','needs_review','payment_pending','delivered','ineligible'])assert.throws(()=>selectNoActionRequest([{id,status}],id));
 for(const extra of [{previewApproved:true},{paymentVerified:true},{paymentReceipt:'cs_test'}])assert.throws(()=>selectNoActionRequest([{...job,...extra}],id));
 assert.throws(()=>selectNoActionRequest([job,job],id));assert.throws(()=>selectNoActionRequest([],id));assert.throws(()=>selectNoActionRequest([job],'bad'));
});
