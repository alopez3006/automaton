import{spawn}from'node:child_process';
import{readFile,writeFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join}from'node:path';
import{loadBusinessPolicy,auditCapacity}from'../../dist/business/policy.js';
const root=dirname(fileURLToPath(import.meta.url)),workspace=dirname(dirname(root)),initial=await loadBusinessPolicy(workspace),deadline=Date.now()+86400000;let failures=0;
const metadata=join(root,'.reports/watch-process.json'),startedAt=new Date().toISOString();
async function state(extra){await writeFile(metadata,JSON.stringify({pid:process.pid,startedAt,mode:initial.enabled?'mission':'pilot',maxHours:initial.enabled?null:24,intervalMinutes:5,...extra},null,2),{mode:0o600});}
await state({state:'running'});
while(initial.enabled||Date.now()<deadline){
 const policy=await loadBusinessPolicy(workspace);
 if(initial.enabled&&!policy.enabled){await state({state:'paused'});break;}
 let ledger;try{ledger=JSON.parse(await readFile(join(root,'.reports/ledger.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!policy.enabled&&!auditCapacity(ledger,policy).allowed){await state({state:'quota_reached'});break;}
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,[join(root,'operator.mjs'),'--once','--accept-orders'],{stdio:'inherit'});child.on('error',()=>resolve(1));child.on('close',resolve);});
 failures=code===0?0:failures+1;if(failures>=3){await state({state:'failed',consecutiveFailures:failures});console.log('Operator failed three times; stopping for review');break;}
 await state({state:'running',consecutiveFailures:failures});
 await new Promise(resolve=>setTimeout(resolve,300000));
}
