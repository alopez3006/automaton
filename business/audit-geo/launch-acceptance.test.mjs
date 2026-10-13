import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './site/worker/index.js';

test('request → reviewed teaser → signed payment → gated report and deduplicated email (local only)', async () => {
  const origin='https://audit.vutler.com', data=new Map(), mails=[];
  const bucket={async put(k,v){data.set(k,v);},async get(k){return data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null;},async delete(k){data.delete(k);},async list({prefix=''}){return {objects:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}};
  const env={BUCKET:bucket,AUDIT_GEO_OPERATOR_TOKEN:'synthetic_operator_only_1234567890123456',PAYMENTS_ENABLED:'true',STRIPE_WEBHOOK_SECRET:'whsec_synthetic_only',STRIPE_ACCOUNT_ID:'acct_fixture',STRIPE_PAYMENT_LINK_ID:'plink_fixture',STRIPE_PAYMENT_LINK_URL:'https://buy.stripe.com/fixture',RESEND_EMAILS_ENABLED:'true',RESEND_API_KEY:'re_synthetic_only',RESEND_FROM:'Audit <audit@mail.example.com>',TRACKING_LINK_SECRET:'a'.repeat(64),PUBLIC_SITE_ORIGIN:origin};
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');
    mails.push({idempotency:options.headers['Idempotency-Key'],body:JSON.parse(options.body)});
    return Response.json({id:'synthetic_email_'+mails.length});
  };
  const call=(path,options={})=>worker.fetch(new Request(origin+path,options),env);
  const owner={Authorization:'Bearer '+env.AUDIT_GEO_OPERATOR_TOKEN,'Content-Type':'application/json'};
  try {
    const intake=await call('/api/requests',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({website:'https://example.com/',email:'synthetic@example.com',consent:true})});
    assert.equal(intake.status,201);
    const request=await intake.json();
    assert.equal(mails.length,1);
    const queue=await(await call('/api/operator/requests',{headers:owner})).json();
    assert.equal(queue.requests.length,1);
    const key=queue.requests[0].key,report='# Synthetic full report\nPRIVATE_FIX_ONLY\nAgent prompt: verify and fix the observed title.';
    const patch=d=>call('/api/operator/requests',{method:'PATCH',headers:owner,body:JSON.stringify({key,message:'Synthetic review',...d})});
    assert.equal((await patch({status:'payment_pending',taskCount:0,report,previewApproved:true,preview:{critical:0,medium:0,low:0,total:0}})).status,400);
    assert.equal((await patch({status:'payment_pending',taskCount:1,report})).status,503);
    assert.equal((await patch({status:'payment_pending',taskCount:1,report,previewApproved:true,preview:{critical:0,medium:0,low:1,total:1}})).status,200);
    const unpaid=await(await call(request.tracking)).text();
    assert.ok(unpaid.includes('0 critical · 0 medium · 1 minor'));
    assert.ok(unpaid.includes('client_reference_id='+request.id));
    assert.ok(!unpaid.includes('PRIVATE_FIX_ONLY'));
    assert.equal((await call(request.tracking+'/report.md')).status,404);
    assert.equal((await call(request.tracking,{method:'DELETE',headers:{Origin:origin}})).status,409);
    assert.equal(mails.length,2);
    assert.ok(!JSON.stringify(mails).includes('PRIVATE_FIX_ONLY'));
    const event={id:'evt_synthetic',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_synthetic',livemode:true,status:'complete',payment_status:'paid',amount_total:900,currency:'eur',client_reference_id:request.id,payment_link:'plink_fixture'}}};
    async function webhook(e,forged=false){
      const raw=JSON.stringify(e),t=Math.floor(Date.now()/1000);
      const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const sig=Buffer.from(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(t+'.'+raw))).toString('hex');
      return call('/api/stripe/webhook',{method:'POST',headers:{'Stripe-Signature':`t=${t},v1=${forged?'0'.repeat(64):sig}`},body:raw});
    }
    assert.equal((await webhook(event,true)).status,400);
    assert.equal((await webhook({...event,data:{object:{...event.data.object,amount_total:899}}})).status,200);
    assert.equal((await call(request.tracking+'/report.md')).status,404);
    assert.equal(mails.length,2);
    assert.equal((await webhook(event)).status,200);
    const download=await call(request.tracking+'/report.md');
    assert.equal(download.status,200);assert.equal(await download.text(),report);
    assert.equal(mails.length,3);
    assert.ok(mails[2].body.text.includes(request.tracking+'/report.md'));
    assert.ok(!JSON.stringify(mails).includes('PRIVATE_FIX_ONLY'));
    assert.equal((await webhook(event)).status,200);
    assert.equal((await call('/api/operator/notifications',{method:'POST',headers:owner})).status,200);
    assert.equal(mails.length,3);
    assert.equal(new Set(mails.map(m=>m.idempotency)).size,3);
    assert.equal((await patch({status:'prepared'})).status,409);
    assert.equal(JSON.parse(data.get(key)).status,'delivered');
  } finally {globalThis.fetch=originalFetch;}
});
