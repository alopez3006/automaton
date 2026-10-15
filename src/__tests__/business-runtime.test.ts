import {describe,it,expect} from 'vitest';
import{mkdtemp,mkdir,writeFile,readFile,rm,readdir,stat}from'node:fs/promises';
import{join}from'node:path';import{tmpdir}from'node:os';
import{businessEnvironment,redactBusinessOutput,validateBusinessReceipt,runBusiness,writeBusinessStatusSnapshot}from'../business/runtime.js';
import {createDatabase} from '../state/database.js';
import {appendConsoleMessage} from '../business/console-state.js';
import {legacyPolicy} from '../business/policy.js';
const receipt={status:'waiting_for_user',summary:['Domain quote prepared'],evidence:['Public Site verified'],blockers:['Owner approval'],nextActions:['Review quote'],externalSpendCents:0};
describe('Automaton local business mode',()=>{
 it('keeps OAuth configuration but excludes API credentials from the executor environment',()=>{
  const env=businessEnvironment({HOME:'/owner',PATH:'/bin',CODEX_HOME:'/owner/.codex',RLM_API_KEY:'fixture',STRIPE_SECRET_KEY:'fixture',OPENAI_API_KEY:'fixture'});
  expect(env.HOME).toBe('/owner');expect(env.CODEX_HOME).toBe('/owner/.codex');expect(env).not.toHaveProperty('RLM_API_KEY');expect(env).not.toHaveProperty('STRIPE_SECRET_KEY');expect(env).not.toHaveProperty('OPENAI_API_KEY');
 });
 it.each([-1,2001,NaN,true])('rejects an invalid reported spend %s',externalSpendCents=>{
  expect(()=>validateBusinessReceipt(JSON.stringify({...receipt,externalSpendCents}))).toThrow('Invalid');
 });
 it('redacts credentials in persisted execution summaries',()=>{
  expect(redactBusinessOutput('rk_live_fixture whsec_fixture Bearer fixture')).toBe('[REDACTED] [REDACTED] Bearer [REDACTED]');
 });
 it('records a concrete receipt and releases its lock when the executor finishes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-business-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   const executable=join(dir,'executor.mjs');await writeFile(executable,`#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.writeFileSync(process.argv[process.argv.indexOf('-o')+1],JSON.stringify(${JSON.stringify(receipt)}));\nprocess.stdin.resume();\n`,{mode:0o700});
   await runBusiness({workspace:dir,executable,context:'Fixture project context'});
   const status=JSON.parse(await readFile(join(dir,'.automaton-business/status.json'),'utf8'));expect(status.state).toBe('waiting_for_user');
   await expect(readFile(join(dir,'.automaton-business/run.lock'))).rejects.toThrow();
   const saved=JSON.parse(await readFile(status.receiptPath,'utf8'));expect(saved.evidence).toEqual(receipt.evidence);
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('times out an unresponsive executor and records the failure',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-business-timeout-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   const executable=join(dir,'executor.mjs');await writeFile(executable,'#!/usr/bin/env node\nprocess.stdin.resume();setInterval(()=>{},10000);\n',{mode:0o700});
   await expect(runBusiness({workspace:dir,executable,context:'Fixture',timeoutMs:100})).rejects.toThrow('timed out');
   expect(JSON.parse(await readFile(join(dir,'.automaton-business/status.json'),'utf8')).state).toBe('failed');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('allows one further bounded pass per fresh owner request without replaying an unacknowledged request',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-owner-turn-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   let db=createDatabase(join(dir,'.automaton-business/state.db'));db.setKV('business_runs','3');db.close();
   const executable=join(dir,'executor.mjs');await writeFile(executable,`#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.writeFileSync(process.argv[process.argv.indexOf('-o')+1],JSON.stringify(${JSON.stringify(receipt)}));\nprocess.stdin.resume();\n`,{mode:0o700});
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow('new owner request');
   const message=await appendConsoleMessage(dir,{role:'owner',kind:'message',text:'Enrichir le rapport'});
   await runBusiness({workspace:dir,executable,context:'Fixture'});
   db=createDatabase(join(dir,'.automaton-business/state.db'));expect(db.getKV('business_runs')).toBe('4');expect(JSON.parse(db.getKV('business_owner_requests')!)).toContain(message.id);db.close();
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow('new owner request');
   await appendConsoleMessage(dir,{role:'owner',kind:'message',text:'Une nouvelle précision du propriétaire'});
   await runBusiness({workspace:dir,executable,context:'Fixture'});
   db=createDatabase(join(dir,'.automaton-business/state.db'));expect(db.getKV('business_runs')).toBe('5');db.close();
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('does not let an Automaton message extend the autonomous setup limit',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-non-owner-fixture-'));
  try{
   const db=createDatabase(join(dir,'.automaton-business/state.db'));db.setKV('business_runs','3');db.close();
   await appendConsoleMessage(dir,{role:'automaton',kind:'message',text:'Continuer sans nouvelle demande humaine'});
   await expect(runBusiness({workspace:dir,context:'Fixture'})).rejects.toThrow('new owner request');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('persists a useful connection failure category without the raw executor error',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-executor-error-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   const executable=join(dir,'executor.mjs');await writeFile(executable,'#!/usr/bin/env node\nprocess.stdin.resume();console.log(JSON.stringify({type:"turn.failed",error:{message:"Connection failed with private diagnostic rk_live_fixture"}}));process.exitCode=1;\n',{mode:0o700});
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow('connection failed');
   const status=await readFile(join(dir,'.automaton-business/status.json'),'utf8');expect(JSON.parse(status).error).toBe('Business executor connection failed');expect(status).not.toContain('private diagnostic');expect(status).not.toContain('rk_live_fixture');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it.each([
  ['usage limit reached', 'Business executor usage limit reached'],
  ['authentication failed', 'Business executor authentication failed'],
  ['DNS connection failed', 'Business executor connection failed'],
  ['context window exceeded', 'Business executor context limit reached'],
  ['unrecognized private failure', 'Business executor failed'],
 ])('classifies stderr-only startup failure %s without retaining raw output',async(message,expected)=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-stderr-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   const executable=join(dir,'executor.mjs');await writeFile(executable,`#!/usr/bin/env node\nprocess.stdin.resume();process.stderr.write(${JSON.stringify(message.slice(0,4))});setTimeout(()=>{process.stderr.write(${JSON.stringify(message.slice(4)+' rk_live_fixture private payload')});process.exitCode=1},10);\n`,{mode:0o700});
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow(expected);
   const status=await readFile(join(dir,'.automaton-business/status.json'),'utf8');expect(JSON.parse(status).error).toBe(expected);expect(status).not.toContain('rk_live_fixture');expect(status).not.toContain('private payload');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('preserves a classified stderr startup failure when a later structured event is generic',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-stderr-order-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   const executable=join(dir,'executor.mjs');await writeFile(executable,'#!/usr/bin/env node\nprocess.stdin.resume();process.stderr.write("authentication failed private payload");setTimeout(()=>{console.log(JSON.stringify({type:"turn.failed",error:{message:"executor exited"}}));process.exitCode=1},20);\n',{mode:0o700});
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow('Business executor authentication failed');
   const status=await readFile(join(dir,'.automaton-business/status.json'),'utf8');expect(status).not.toContain('private payload');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('preserves a classified structured error when a generic failure event follows',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-json-error-order-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   const executable=join(dir,'executor.mjs');await writeFile(executable,'#!/usr/bin/env node\nprocess.stdin.resume();console.log(JSON.stringify({type:"error",message:"usage limit reached private payload"}));console.log(JSON.stringify({type:"turn.failed",error:{message:"executor exited"}}));process.exitCode=1;\n',{mode:0o700});
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow('Business executor usage limit reached');
   const status=await readFile(join(dir,'.automaton-business/status.json'),'utf8');expect(status).not.toContain('private payload');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('uses a classified structured error instead of an unrelated stderr category',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-json-error-priority-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   const executable=join(dir,'executor.mjs');await writeFile(executable,'#!/usr/bin/env node\nprocess.stdin.resume();process.stderr.write("authentication failed private payload");setTimeout(()=>{console.log(JSON.stringify({type:"turn.failed",error:{message:"usage limit reached"}}));process.exitCode=1},20);\n',{mode:0o700});
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow('Business executor usage limit reached');
   const status=await readFile(join(dir,'.automaton-business/status.json'),'utf8');expect(status).not.toContain('private payload');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('does not turn diagnostic text on stderr into a failed successful receipt',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-success-stderr-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Fixture task');
   const executable=join(dir,'executor.mjs');await writeFile(executable,`#!/usr/bin/env node\nimport fs from 'node:fs';\nprocess.stderr.write('DNS connection failed private payload');fs.writeFileSync(process.argv[process.argv.indexOf('-o')+1],JSON.stringify(${JSON.stringify(receipt)}));process.stdin.resume();\n`,{mode:0o700});
   await runBusiness({workspace:dir,executable,context:'Fixture'});
   const status=await readFile(join(dir,'.automaton-business/status.json'),'utf8');expect(JSON.parse(status).state).toBe('waiting_for_user');expect(status).not.toContain('private payload');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('continues an authorized standing mission without a new owner message, then enforces its daily limit',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-standing-mission-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});
   await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Historical fixture: require a fresh owner request before all work');
   await writeFile(join(dir,'business/audit-geo/MISSION.md'),'Current fixture mission: independently improve qualified acquisition on owned surfaces');
   await writeFile(join(dir,'business/audit-geo/mission.json'),JSON.stringify({...legacyPolicy,enabled:true,externalBudgetCents:5000,passesPerDay:1}));
   let db=createDatabase(join(dir,'.automaton-business/state.db'));db.setKV('business_runs','6');db.close();
   const executable=join(dir,'executor.mjs');await writeFile(executable,`#!/usr/bin/env node\nimport fs from 'node:fs';\nlet prompt='';process.stdin.on('data',chunk=>{prompt+=chunk});process.stdin.on('end',()=>{fs.writeFileSync(${JSON.stringify(join(dir,'captured-prompt.txt'))},prompt);fs.writeFileSync(process.argv[process.argv.indexOf('-o')+1],JSON.stringify(${JSON.stringify({...receipt,status:'continue',blockers:[]})}));});\n`,{mode:0o700});
   await runBusiness({workspace:dir,executable,context:'Fixture'});
   const prompt=await readFile(join(dir,'captured-prompt.txt'),'utf8');
   expect(prompt).toContain('Current fixture mission: independently improve qualified acquisition on owned surfaces');
   expect(prompt).not.toContain('Historical fixture: require a fresh owner request before all work');
   expect(prompt).toContain('Pending console messages: []');
   expect(prompt).toContain('An empty incoming queue or a blocked provider does not imply no actionable work');
   db=createDatabase(join(dir,'.automaton-business/state.db'));expect(db.getKV('business_runs')).toBe('7');expect(JSON.parse(db.getKV('business_mission_passes')!)).toHaveLength(1);db.close();
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow('Daily mission pass limit');
   await writeFile(join(dir,'business/audit-geo/mission.json'),JSON.stringify({...legacyPolicy,enabled:false,externalBudgetCents:5000}));
   await expect(runBusiness({workspace:dir,executable,context:'Fixture'})).rejects.toThrow('new owner request');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('fails closed when an enabled mission document is missing instead of silently using a historical handoff',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-missing-mission-fixture-'));
  try{
   await mkdir(join(dir,'business/audit-geo'),{recursive:true});
   await writeFile(join(dir,'business/audit-geo/HANDOFF.md'),'Historical fixture task');
   await writeFile(join(dir,'business/audit-geo/mission.json'),JSON.stringify({...legacyPolicy,enabled:true,externalBudgetCents:5000}));
   await expect(runBusiness({workspace:dir,context:'Fixture'})).rejects.toThrow('MISSION.md');
   const db=createDatabase(join(dir,'.automaton-business/state.db'));
   expect(db.getKV('business_runs')).toBeUndefined();
   expect(db.getKV('business_mission_passes')).toBeUndefined();db.close();
   await expect(readFile(join(dir,'.automaton-business/run.lock'))).rejects.toThrow();
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('validates the per-pass remaining budget under the new fifty-euro mission ceiling',()=>{
   expect(validateBusinessReceipt(JSON.stringify({...receipt,externalSpendCents:3000}),5000).externalSpendCents).toBe(3000);
   expect(()=>validateBusinessReceipt(JSON.stringify({...receipt,externalSpendCents:501}),500)).toThrow('Invalid');
 });
});


describe('business status snapshot publication',()=>{
 it('keeps concurrent console readers on complete private snapshots throughout transitions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-status-publication-')),file=join(dir,'status.json');
  let finished=false,reads=0;
  try{
   await writeBusinessStatusSnapshot(file,{sequence:0,payload:'0'.repeat(65536)});
   const readers=Array.from({length:6},async()=>{
    while(!finished){
     const value=JSON.parse(await readFile(file,'utf8'));
     expect(value.payload).toBe(String(value.sequence).repeat(65536));reads++;
    }
   });
   try{for(let sequence=1;sequence<=40;sequence++)await writeBusinessStatusSnapshot(file,{sequence,payload:String(sequence).repeat(65536)});}
   finally{finished=true;await Promise.all(readers);}
   expect(reads).toBeGreaterThan(0);expect(JSON.parse(await readFile(file,'utf8')).sequence).toBe(40);
   expect((await stat(file)).mode&0o777).toBe(0o600);expect(await readdir(dir)).toEqual(['status.json']);
  }finally{finished=true;await rm(dir,{recursive:true,force:true});}
 });
 it('preserves the prior status on serialization failure and removes an unpublished temporary on rename failure',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'automaton-status-failure-')),file=join(dir,'status.json');
  try{
   await writeBusinessStatusSnapshot(file,{state:'running'});
   const cyclic:Record<string,unknown>={};cyclic.self=cyclic;
   await expect(writeBusinessStatusSnapshot(file,cyclic)).rejects.toThrow();
   expect(JSON.parse(await readFile(file,'utf8'))).toEqual({state:'running'});
   const occupied=join(dir,'occupied');await mkdir(occupied);
   await expect(writeBusinessStatusSnapshot(occupied,{state:'completed'})).rejects.toThrow();
   expect((await readdir(dir)).sort()).toEqual(['occupied','status.json']);
  }finally{await rm(dir,{recursive:true,force:true});}
 });
});
