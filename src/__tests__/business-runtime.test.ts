import {describe,it,expect} from 'vitest';
import{mkdtemp,mkdir,writeFile,readFile,rm}from'node:fs/promises';
import{join}from'node:path';import{tmpdir}from'node:os';
import{businessEnvironment,redactBusinessOutput,validateBusinessReceipt,runBusiness}from'../business/runtime.js';
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
