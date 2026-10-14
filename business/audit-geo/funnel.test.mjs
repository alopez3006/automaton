import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeFunnel} from './funnel.mjs';
test('aggregate excludes private content and does not invent sales from delivered status',()=>{
 const s=summarizeFunnel({requests:[{status:'delivered',email:'private@example.invalid',website:'https://private.invalid',report:'SECRET',id:'private-id'},{status:'prepared',taskCount:1,previewApproved:true,preview:{critical:0,medium:0,low:1,total:1}},{status:'future'}],paymentsConfigured:false},'2026-10-14T00:00:00Z');
 assert.equal(s.inventory.total,3);assert.equal(s.inventory.statuses.delivered,1);assert.equal(s.inventory.reviewedSummaries,1);assert.equal(s.inventory.unknownStatus,1);
 assert.equal(s.outcomes.verifiedCustomerSales,null);assert.equal(s.outcomes.conversionRate,null);assert.equal(s.completeLifetimeCohort,false);
 assert.doesNotMatch(JSON.stringify(s),/private|SECRET/);assert.equal(s.configuration.notifications,null);
});
test('list ceiling and empty inventory preserve unknown denominators',()=>{
 assert.equal(summarizeFunnel({requests:Array.from({length:50},()=>({status:'requested'}))}).atListLimit,true);
 assert.equal(summarizeFunnel({requests:[]}).outcomes.conversionRate,null);
 assert.throws(()=>summarizeFunnel({requests:Array(51).fill({})}));assert.throws(()=>summarizeFunnel({requests:[null]}));
});
test('invalid or unapproved teaser counts do not count as reviewed',()=>{
 for(const preview of [{critical:0,medium:0,low:1,total:2},{critical:0,medium:0,low:NaN,total:1},{critical:0,medium:0,low:4,total:4}])assert.equal(summarizeFunnel({requests:[{status:'prepared',previewApproved:true,taskCount:preview.total,preview}]}).inventory.reviewedSummaries,0);
 assert.equal(summarizeFunnel({requests:[{status:'prepared',previewApproved:false,taskCount:1,preview:{critical:0,medium:0,low:1,total:1}}]}).inventory.reviewedSummaries,0);
});
test('bounded entry aggregates redact unknown source and keep legacy records unknown',()=>{
 const result=summarizeFunnel({requests:[{status:'prepared',acquisitionSource:'guide',taskCount:1,previewApproved:true,preview:{critical:0,medium:1,low:0,total:1}},{status:'requested',acquisitionSource:'linkedin'},{status:'ineligible'},{status:'requested',acquisitionSource:'https://private.invalid/secret'}]});
 assert.equal(result.attribution.byEntry.guide.reviewedSummaries,1);assert.equal(result.attribution.byEntry.linkedin.total,1);assert.equal(result.attribution.byEntry.unknown.total,2);assert.equal(result.attribution.byEntry.unknown.statuses.ineligible,1);assert.equal(result.outcomes.conversionRate,null);assert.equal(result.outcomes.qualifiedRequests,null);assert.doesNotMatch(JSON.stringify(result),/private.invalid|secret/);
 assert.equal(Object.values(result.attribution.byEntry).reduce((n,x)=>n+x.total,0),result.inventory.total);
});
