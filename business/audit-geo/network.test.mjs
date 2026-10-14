import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createPublicFetcher,publicAddress} from './evidence.mjs';
const publicDns=async()=>[{address:'93.184.215.14',family:4}];
function transport(responses,calls=[]) {
 return (url,options,callback)=>{
  const req=new EventEmitter();req.destroy=error=>{queueMicrotask(()=>req.emit('error',error));};
  calls.push({url:url.href,options});
  queueMicrotask(()=>{
   const item=responses.shift();if(!item)return;
   const res=new EventEmitter();res.statusCode=item.status??200;res.headers=item.headers??{};callback(res);
   if(item.stall)return;
   for(const chunk of item.chunks??[Buffer.from(item.body??'ok')])res.emit('data',chunk);
   if(item.aborted)res.emit('aborted');else res.emit('end');
  });return req;
 };
}
test('special-use IPv4/IPv6 ranges are denied, ordinary global addresses allowed',()=>{
 for(const ip of ['0.1.2.3','100.64.0.1','198.18.0.1','192.0.0.1','198.51.100.7','203.0.113.8','224.0.0.1','2001:20::1','2001:2::1','2001:db8::1','2002:7f00:1::','3fff::1','::ffff:8.8.8.8'])assert.equal(publicAddress(ip),false,ip);
 for(const ip of ['8.8.8.8','198.51.101.1','203.0.114.1','2001:4860:4860::8888','2606:4700:4700::1111'])assert.equal(publicAddress(ip),true,ip);
});
test('mixed DNS answers and inconsistent families are refused before connection',async()=>{
 for(const answers of [[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}],[{address:'8.8.8.8',family:6}],[]]){
  const calls=[];const fetch=createPublicFetcher({resolveHost:async()=>answers,get:transport([],calls)});
  await assert.rejects(fetch('https://example.com'),/DNS/);assert.equal(calls.length,0);
 }
});
test('validated DNS address is pinned for the HTTPS socket and revalidated on redirects',async()=>{
 const calls=[],hosts=[];
 const fetch=createPublicFetcher({resolveHost:async host=>{hosts.push(host);return host==='private.test'?[{address:'10.0.0.1',family:4}]:publicDns();},get:transport([{status:302,headers:{location:'https://private.test/'}}],calls)});
 await assert.rejects(fetch('https://example.com'),/DNS/);assert.deepEqual(hosts,['example.com','private.test']);assert.equal(calls.length,1);
 let pin;calls[0].options.lookup('example.com',{all:true},(error,answers)=>{assert.equal(error,null);pin=answers;});assert.deepEqual(pin,await publicDns());
});
test('unsafe redirect schemes and literals are refused; redirect loops are bounded',async()=>{
 for(const location of ['http://example.com','https://127.0.0.1','https://user:pass@example.com'])await assert.rejects(createPublicFetcher({resolveHost:publicDns,get:transport([{status:302,headers:{location}}])})('https://example.com'),/HTTPS/);
 const calls=[];await assert.rejects(createPublicFetcher({resolveHost:publicDns,get:transport(Array(4).fill({status:302,headers:{location:'/loop'}}),calls)})('https://example.com'),/redirects/);assert.equal(calls.length,4);
});
test('DNS hangs and trickling/stalled responses have an absolute deadline',async()=>{
 await assert.rejects(createPublicFetcher({resolveHost:()=>new Promise(()=>{}),totalTimeoutMs:25})('https://example.com'),/deadline/);
 await assert.rejects(createPublicFetcher({resolveHost:publicDns,get:transport([{stall:true}]),totalTimeoutMs:25})('https://example.com'),/deadline/);
});
test('one total deadline covers the entire redirect chain',async()=>{
 let lookups=0;const calls=[];
 const resolveHost=async()=>{lookups++;await new Promise(r=>setTimeout(r,20));return publicDns();};
 await assert.rejects(createPublicFetcher({resolveHost,get:transport(Array(4).fill({status:302,headers:{location:'/again'}}),calls),totalTimeoutMs:35})('https://example.com'),/deadline/);
 assert.ok(lookups<=2);assert.ok(calls.length<=1);
});
test('oversized or aborted bodies never become complete evidence',async()=>{
 await assert.rejects(createPublicFetcher({resolveHost:publicDns,get:transport([{chunks:[Buffer.from('123'),Buffer.from('456')]}]),maxBytes:5})('https://example.com'),/byte limit/);
 await assert.rejects(createPublicFetcher({resolveHost:publicDns,get:transport([{body:'partial',aborted:true}])})('https://example.com'),/aborted/);
 const evidence=await createPublicFetcher({resolveHost:publicDns,get:transport([{body:'hello'}]),maxBytes:5})('https://example.com');assert.equal(evidence.body,'hello');assert.equal(evidence.status,200);assert.ok(evidence.observedAt);
});
test('binary single-hop mode retains non-text bytes and returns redirects without following',async()=>{
 const calls=[],body=Buffer.from([0,255,128,1]);
 const fetch=createPublicFetcher({resolveHost:publicDns,get:transport([{status:302,headers:{location:'/next'},chunks:[body]}],calls),responseEncoding:'buffer',followRedirects:false});
 const r=await fetch('https://example.com/');assert.deepEqual(r.body,body);assert.equal(r.status,302);assert.equal(calls.length,1);
 assert.throws(()=>createPublicFetcher({responseEncoding:'unknown'}),/mode/);
});
test('successful redirect evidence retains requested URL and ordered dated hops without extra requests',async()=>{
 const calls=[];
 const fetch=createPublicFetcher({resolveHost:publicDns,get:transport([
  {status:301,headers:{location:'/new'}},
  {status:307,headers:{location:'https://www.example.com/final'}},
  {body:'final page'}
 ],calls)});
 const r=await fetch('https://example.com/old');
 assert.equal(r.requestedUrl,'https://example.com/old');
 assert.equal(r.url,'https://www.example.com/final');
 assert.equal(r.body,'final page');assert.equal(calls.length,3);
 assert.deepEqual(r.redirectChain.map(({url,status,nextUrl})=>({url,status,nextUrl})),[
  {url:'https://example.com/old',status:301,nextUrl:'https://example.com/new'},
  {url:'https://example.com/new',status:307,nextUrl:'https://www.example.com/final'}
 ]);
 for(const hop of r.redirectChain)assert.ok(Number.isFinite(Date.parse(hop.observedAt)));
 const direct=await createPublicFetcher({resolveHost:publicDns,get:transport([{body:'direct'}])})('https://example.com/');
 assert.deepEqual(direct.redirectChain,[]);assert.equal(direct.requestedUrl,direct.url);
});
