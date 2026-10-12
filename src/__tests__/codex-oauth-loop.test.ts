import {expect,it,vi} from 'vitest';
import {runAgentLoop} from '../agent/loop.js';
import {MockInferenceClient,MockConwayClient,createTestDb,createTestIdentity,createTestConfig,noToolResponse} from './mocks.js';
import type {AgentTurn} from '../types.js';
it('OAuth inference bypasses API model routing and does not invent a Conway charge',async()=>{
 const db=createTestDb();vi.stubEnv('SNIPARA_MCP_URL','');
 vi.stubGlobal('fetch',async()=>Response.json({jsonrpc:'2.0',id:1,result:'0x0'}));
 try{
  const inference=new MockInferenceClient([noToolResponse('Done.')]);vi.spyOn(inference,'getDefaultModel').mockReturnValue('codex-oauth');
  const turns:AgentTurn[]=[];
  await runAgentLoop({identity:createTestIdentity(),config:createTestConfig(),db,conway:new MockConwayClient(),inference,onTurnComplete:t=>turns.push(t)});
  expect(turns[0].costCents).toBe(0);
  expect(inference.calls[0].options?.model).toBeUndefined();
  expect(turns[0].thinking).toBe('Done.');
 }finally{db.close();vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
