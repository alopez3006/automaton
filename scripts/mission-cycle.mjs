import{spawn}from'node:child_process';
import{mkdir,open,writeFile,rename}from'node:fs/promises';
import{fileURLToPath}from'node:url';import{join}from'node:path';
import{loadBusinessPolicy,optionalBusinessJson}from'../dist/business/policy.js';
import{consoleSnapshot}from'../dist/business/console-server.js';
import{businessEnvironment}from'../dist/business/runtime.js';
const workspace=fileURLToPath(new URL('../',import.meta.url)),stateRoot=join(workspace,'.automaton-business');
await mkdir(stateRoot,{recursive:true,mode:0o700});
const policy=await loadBusinessPolicy(workspace);
if(process.argv.includes('--pause')||process.argv.includes('--resume')){
 policy.enabled=process.argv.includes('--resume');const path=join(workspace,'business/audit-geo/mission.json'),temp=join(stateRoot,'mission-policy.tmp');
 await writeFile(temp,JSON.stringify(policy,null,2)+'\n',{mode:0o600});await rename(temp,path);console.log(JSON.stringify({missionEnabled:policy.enabled}));process.exit(0);
}
if(!policy.enabled){console.log(JSON.stringify({missionEnabled:false}));process.exit(0);}
function alive(pid){if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch{return false;}}
let watch=await optionalBusinessJson(join(workspace,'business/audit-geo/.reports/watch-process.json'));
if(!alive(watch?.pid)&& (watch?.state!=='failed'||process.argv.includes('--restart-watcher'))){
 const root=join(workspace,'business/audit-geo/.reports');await mkdir(root,{recursive:true,mode:0o700});
 const launchLock=await open(join(root,'watch-launch.lock'),'wx',0o600).catch(()=>null);
 if(launchLock){try{
   watch=await optionalBusinessJson(join(root,'watch-process.json'));
   if(!alive(watch?.pid)){
     const log=await open(join(root,'watch.log'),'a',0o600);
     const child=spawn(process.execPath,[join(workspace,'business/audit-geo/watch.mjs')],{cwd:workspace,detached:true,stdio:['ignore',log.fd,log.fd],env:businessEnvironment(process.env)});
     await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();await log.close();
     await writeFile(join(root,'watch-process.json'),JSON.stringify({pid:child.pid,startedAt:new Date().toISOString(),mode:'mission',state:'starting',intervalMinutes:5,maxHours:null}),{mode:0o600});
   }
 }finally{await launchLock.close();const{unlink}=await import('node:fs/promises');await unlink(join(root,'watch-launch.lock'));}}
}
const snapshot=await consoleSnapshot(workspace);
if(process.argv.includes('--watch-only')||snapshot.running||snapshot.staleLock||!snapshot.canStart){console.log(JSON.stringify({missionEnabled:true,controllerRunning:snapshot.running,canStart:snapshot.canStart,reason:snapshot.mission.reason,staleLock:snapshot.staleLock,watcherRunning:snapshot.watcher.running}));process.exit(0);}
await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(workspace,'scripts/start-business.mjs')],{cwd:workspace,env:businessEnvironment(process.env),stdio:'inherit'});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('Cannot start mission controller')));});
