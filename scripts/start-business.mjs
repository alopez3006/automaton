import{spawn}from'node:child_process';
import{mkdir,open,readFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';import{dirname,join}from'node:path';
import{businessEnvironment}from'../dist/business/runtime.js';
const root=dirname(dirname(fileURLToPath(import.meta.url))),state=join(root,'.automaton-business');
await mkdir(state,{recursive:true,mode:0o700});
try{
 const lock=JSON.parse(await readFile(join(state,'run.lock'),'utf8'));
 try{process.kill(lock.pid,0);console.log(JSON.stringify({alreadyRunning:true,pid:lock.pid}));process.exit(0);}catch{throw Error('Stale business lock requires review before restarting');}
}catch(e){if(e.code!=='ENOENT')throw e;}
const log=await open(join(state,'supervisor.log'),'a',0o600);
const child=spawn(process.execPath,[join(root,'dist/index.js'),'--business'],{cwd:root,detached:true,stdio:['ignore',log.fd,log.fd],env:businessEnvironment(process.env)});
await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();await log.close();
console.log(JSON.stringify({started:true,pid:child.pid,statusCommand:'node dist/index.js --business-status',logPath:join(state,'supervisor.log')}));
