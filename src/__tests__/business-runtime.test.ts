import {describe,it,expect} from 'vitest';
import{mkdtemp,mkdir,writeFile,readFile,rm}from'node:fs/promises';
import{join}from'node:path';import{tmpdir}from'node:os';
import{businessEnvironment,redactBusinessOutput,validateBusinessReceipt,runBusiness}from'../business/runtime.js';
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
});
