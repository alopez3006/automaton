import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserGateway} from './browser-gateway.mjs';
const response=(url,headers={},body=Buffer.from([0,255,128,1]),status=200)=>({url,headers,body,status});
test('binary response preserved; cookies, auth and network-triggering headers excluded',async()=>{
 let args;
 const g=createBrowserGateway({fetchResource:async(...a)=>{args=a;return response(a[0],{'content-type':'image/png','set-cookie':'private','refresh':'0;url=http://localhost','content-security-policy':"default-src 'self'"});}});
 const r=await g.request({url:'https://example.com/a',headers:{Authorization:'ignored'},body:'ignored'});
 assert.deepEqual(r.body,Buffer.from([0,255,128,1]));assert.equal(args.length,2);assert.equal(args[1].maxBytes,256000);
 assert.deepEqual(Object.keys(r.headers),['content-type','content-security-policy']);
});
test('unsafe schemes, literals, credentials, methods and streaming channels fail before transport',async()=>{
 let calls=0;const g=createBrowserGateway({fetchResource:async u=>{calls++;return response(u);}});
 for(const url of ['http://example.com','https://127.0.0.1','file:///etc/passwd','https://user:password@example.com','https://example.com:444/'])await assert.rejects(g.request({url}));
 for(const method of ['POST','PUT','DELETE','HEAD'])await assert.rejects(g.request({url:'https://example.com',method}));
 for(const resourceType of ['websocket','eventsource'])await assert.rejects(g.request({url:'https://example.com',resourceType}));assert.equal(calls,0);
});
test('redirect returned with canonical location; unsafe destination refused',async()=>{
 const g=createBrowserGateway({fetchResource:async u=>response(u,{location:'/next'},Buffer.alloc(0),302)});
 assert.equal((await g.request({url:'https://example.com/a'})).headers.location,'https://example.com/next');assert.equal(g.stats().requests,1);
 const bad=createBrowserGateway({fetchResource:async u=>response(u,{location:'https://127.0.0.1'},Buffer.alloc(0),302)});
 await assert.rejects(bad.request({url:'https://example.com/a'}),/HTTPS/);
});
test('global byte reservation and concurrency bounds hold with concurrent requests',async()=>{
 let release;const g=createBrowserGateway({maxBytes:4,maxResourceBytes:4,maxConcurrent:1,fetchResource:u=>new Promise(r=>{release=()=>r(response(u));})});
 const pending=g.request({url:'https://example.com/a'});
 await assert.rejects(g.request({url:'https://example.com/b'}),/budget/);release();await pending;
 await assert.rejects(g.request({url:'https://example.com/c'}),/byte budget/);assert.equal(g.stats().bytes,4);assert.equal(g.stats().inFlight,0);
});
test('failed requests consume request count; closing/deadline rejects late results',async()=>{
 const g=createBrowserGateway({maxRequests:1,fetchResource:async()=>{throw Error('DNS denied');}});
 await assert.rejects(g.request({url:'https://example.com'}),/DNS/);await assert.rejects(g.request({url:'https://example.com'}),/budget/);
 let clock=0;const late=createBrowserGateway({now:()=>clock,totalTimeoutMs:20,fetchResource:async u=>{clock=21;return response(u);}});
 await assert.rejects(late.request({url:'https://example.com'}),/deadline/);
 late.close();await assert.rejects(late.request({url:'https://example.com'}),/closed/);
});
test('oversized, encoded and URL-mismatched transport responses refused',async()=>{
 for(const r of [response('https://other.com/'),response('https://example.com/',{'content-encoding':'gzip'}),response('https://example.com/',{},Buffer.alloc(5))]){
  const g=createBrowserGateway({maxResourceBytes:4,fetchResource:async()=>r});await assert.rejects(g.request({url:'https://example.com'}));
 }
});
