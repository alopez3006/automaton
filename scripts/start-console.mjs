import { spawn } from 'node:child_process';
import { mkdir, open, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { businessEnvironment } from '../dist/business/runtime.js';
const workspace=fileURLToPath(new URL('../',import.meta.url)),root=join(workspace,'.automaton-business'),url='http://127.0.0.1:4317';
await mkdir(root,{recursive:true,mode:0o700});
try{
 const old=JSON.parse(await readFile(join(root,'console-process.json'),'utf8'));
 let active=false;try{process.kill(old.pid,0);active=true;}catch{}
 if(active){const response=await fetch(url,{signal:AbortSignal.timeout(2000)});if(response.ok&&(await response.text()).includes('Console du pilote')){console.log(JSON.stringify({alreadyRunning:true,pid:old.pid,url}));process.exit(0);}throw Error('Un ancien processus de console doit être vérifié avant reprise.');}
}catch(e){if(e.code!=='ENOENT')throw e;}
const log=await open(join(root,'console.log'),'a',0o600);
const child=spawn(process.execPath,[join(workspace,'scripts/business-console.mjs')],{cwd:workspace,detached:true,stdio:['ignore',log.fd,log.fd],env:businessEnvironment(process.env)});
await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();await log.close();
for(let attempt=0;attempt<30;attempt++){
 try{const current=JSON.parse(await readFile(join(root,'console-process.json'),'utf8'));if(current.pid===child.pid){const response=await fetch(url,{signal:AbortSignal.timeout(1000)});if(response.ok){console.log(JSON.stringify({started:true,pid:child.pid,url}));process.exit(0);}}}catch{}
 await new Promise(resolve=>setTimeout(resolve,100));
}
throw Error('La console n’a pas démarré. Consulter .automaton-business/console.log.');
