import{spawn}from'node:child_process';
import{readFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{dirname,join}from'node:path';
const root=dirname(fileURLToPath(import.meta.url)),deadline=Date.now()+86400000;let failures=0;
while(Date.now()<deadline){
 try{const ledger=JSON.parse(await readFile(join(root,'.reports/ledger.json'),'utf8'));if(ledger.attempts>=10){console.log('Pilot quota reached; stopping');break;}}catch(e){if(e.code!=='ENOENT')throw e;}
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,[join(root,'operator.mjs'),'--once','--accept-orders'],{stdio:'inherit'});child.on('error',()=>resolve(1));child.on('close',resolve);});
 failures=code===0?0:failures+1;if(failures>=3){console.log('Operator failed three times; stopping for review');break;}
 await new Promise(resolve=>setTimeout(resolve,300000));
}
