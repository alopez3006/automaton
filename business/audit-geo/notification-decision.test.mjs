import test from 'node:test';
import assert from 'node:assert/strict';
import {emailMessage, publicStatusMessage, flushNotifications} from './site/worker/notifications.mjs';
const link='https://audit.vutler.com/request/'+'b'.repeat(64);
const base={id:'decision_fixture',website:'https://example.org',email:'fixture@example.org',createdAt:new Date().toISOString(),taskCount:1,previewApproved:true,preview:{critical:0,medium:1,low:0,total:1}};
for(const status of ['requested','prepared','needs_review','ineligible','delivered'])test(status+' cannot generate a payment invitation',()=>{
 assert.throws(()=>emailMessage({...base,status},'summary',link));
});
test('reviewed summary includes a usable private link in both email alternatives',()=>{
 const mail=emailMessage({...base,status:'payment_pending'},'summary',link);
 assert.ok(mail.text.includes(link));assert.ok(mail.html.includes('href="'+link+'"'));
 assert.ok(mail.text.includes('€9'));assert.ok(!mail.text.includes('/report.md'));
});
test('prepared and closed states communicate no payment; closure cannot become summary during polling',async()=>{
 assert.match(publicStatusMessage({...base,status:'prepared'}),/no payment is requested/i);
 const closed={...base,status:'ineligible',previewApproved:false};
 const mail=emailMessage(closed,'closed',link);
 assert.match(mail.text,/No payment is requested/);assert.ok(mail.text.includes(link));
 assert.ok(!mail.text.includes('Unlock'));
 const data=new Map([['requests/fixture.json',JSON.stringify(closed)],['notification-links/decision_fixture.json','{}'],['notifications/decision_fixture/closed.json',JSON.stringify({state:'accepted',providerId:'fixture'})]]);
 const env={RESEND_EMAILS_ENABLED:'true',RESEND_API_KEY:'re_fixture',RESEND_FROM:'fixture@example.org',TRACKING_LINK_SECRET:'a'.repeat(64),BUCKET:{async list(){return {objects:[{key:'requests/fixture.json'}]}},async get(k){return data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null},async put(){throw Error('Unexpected mutation')}}};
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;throw Error('Unexpected send')};assert.deepEqual(await flushNotifications(env),{configured:true,accepted:0,pending:0,needsReview:0});assert.equal(calls,0);}finally{globalThis.fetch=original}
});
