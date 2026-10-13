import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import { createConsoleServer } from '../business/console-server.js';
import { appendConsoleMessage, pendingConsoleMessages, acknowledgeConsoleMessages, listConsoleMessages, resolveConsoleQuestion } from '../business/console-state.js';

async function fixture(work: (dir: string) => Promise<void>) {
 const dir = await mkdtemp(join(tmpdir(), 'automaton-console-test-'));
 try { await work(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
async function web(dir: string, run: (url: string, headers: Record<string,string>) => Promise<void>, launch?: () => Promise<unknown>) {
 await mkdir(join(dir, 'business/console'), { recursive: true });
 await writeFile(join(dir, 'business/console/index.html'), '<meta name="console-token" content="__CONSOLE_TOKEN__">');
 const server = createConsoleServer({ workspace: dir, launch });
 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const url = `http://127.0.0.1:${(server.address() as any).port}`;
 try {
  const response = await fetch(url), html = await response.text(), token = html.match(/content="([^"]+)"/)![1];
  const headers = { cookie: response.headers.get('set-cookie')!.split(';')[0], origin: url, 'x-console-token': token, 'content-type': 'application/json' };
  await run(url, headers);
 } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
describe('Automaton owner console', () => {
 it('preserves concurrent messages and explicitly acknowledges owner messages', async () => fixture(async dir => {
  const values = await Promise.all(Array.from({ length: 12 }, (_, i) => appendConsoleMessage(dir, { role: 'owner', kind: 'message', text: `Consigne ${i}` })));
  expect(await pendingConsoleMessages(dir)).toHaveLength(12);
  await acknowledgeConsoleMessages(dir, values.slice(0, 3).map(m => m.id));
  expect(await pendingConsoleMessages(dir)).toHaveLength(9);
  expect(await listConsoleMessages(dir)).toHaveLength(12);
  await expect(acknowledgeConsoleMessages(dir, ['../../elsewhere'])).rejects.toThrow('Identifiants');
 }));
 it('rejects credential text and invalid role/question combinations', async () => fixture(async dir => {
  await expect(appendConsoleMessage(dir, { role: 'owner', kind: 'message', text: 'sk_live_fixture' })).rejects.toThrow('secret');
  await expect(appendConsoleMessage(dir, { role: 'owner', kind: 'question', text: 'Question' })).rejects.toThrow('Rôle');
  await expect(appendConsoleMessage(dir, { role: 'owner', kind: 'answer', text: 'Oui', questionId: '../wrong' })).rejects.toThrow('Question');
 }));
 it('requires a console session and rejects hostile origins, hosts and missing CSRF tokens', async () => fixture(async dir => web(dir, async (url, headers) => {
  expect((await fetch(url + '/api/state')).status).toBe(401);
  expect((await fetch(url + '/api/state', { headers })).status).toBe(200);
  const hostileHost = await new Promise<number | undefined>((resolve, reject) => { const req = request(url + '/api/state', { headers: { ...headers, host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); }); req.once('error', reject); req.end(); });
  expect(hostileHost).toBe(403);
  expect((await fetch(url + '/api/messages', { method: 'POST', headers: { ...headers, origin: 'https://attacker.example' }, body: '{}' })).status).toBe(403);
  expect((await fetch(url + '/api/messages', { method: 'POST', headers: { ...headers, 'x-console-token': 'wrong' }, body: '{}' })).status).toBe(403);
  expect((await fetch(url + '/api/messages', { method: 'POST', headers, body: '{invalid' })).status).toBe(400);
  expect(await listConsoleMessages(dir)).toHaveLength(0);
 })));
 it('delivers questions and owner answers to the real inbox, without inventing a reply', async () => fixture(async dir => web(dir, async (url, headers) => {
  const q = await appendConsoleMessage(dir, { role: 'automaton', kind: 'question', text: 'Quel domaine ?', options: ['audit.vutler.com'] });
  const before = await (await fetch(url + '/api/state', { headers })).json(); expect(before.questions[0].id).toBe(q.id);
  const response = await fetch(url + '/api/messages', { method: 'POST', headers, body: JSON.stringify({ text: 'audit.vutler.com', questionId: q.id }) });
  expect(response.status).toBe(201); const pending = (await pendingConsoleMessages(dir))[0]; expect(pending.questionId).toBe(q.id); expect(pending.questionText).toBe('Quel domaine ?');
  const after = await (await fetch(url + '/api/state', { headers })).json(); expect(after.questions).toHaveLength(0); expect(after.messages).toHaveLength(2);
  const duplicate = await fetch(url + '/api/messages', { method: 'POST', headers, body: JSON.stringify({ text: 'Autre', questionId: q.id }) }); expect(duplicate.status).toBe(400);
 })));
 it('serializes concurrent launches and keeps a sent message if launch fails', async () => fixture(async dir => {
  let launches = 0;
  await web(dir, async (url, headers) => {
   const launchRequests = await Promise.all([1, 2].map(() => fetch(url + '/api/start', { method: 'POST', headers, body: '{}' })));
   expect(launchRequests.map(r => r.status)).toEqual([200,200]); expect(launches).toBe(1);
  }, async () => { launches++; await new Promise(r => setTimeout(r, 30)); return { started: true }; });
  await web(dir, async (url, headers) => {
   const response = await fetch(url + '/api/messages', { method: 'POST', headers, body: JSON.stringify({ text: 'Continuer', start: true }) });
   expect(response.status).toBe(201); const value = await response.json(); expect(value.launchError).toBe('Fixture indisponible'); expect(await pendingConsoleMessages(dir)).toHaveLength(1);
  }, async () => { throw Error('Fixture indisponible'); });
 }));
 it('accepts only one answer when two owner requests race', async () => fixture(async dir => web(dir, async (url, headers) => {
  const question = await appendConsoleMessage(dir, { role: 'automaton', kind: 'question', text: 'Choix ?' });
  const replies = await Promise.all(['A','B'].map(text => fetch(url + '/api/messages', { method: 'POST', headers, body: JSON.stringify({ questionId: question.id, text }) })));
  expect(replies.map(r => r.status).sort()).toEqual([201,400]);
  expect((await listConsoleMessages(dir)).filter(m => m.kind === 'answer')).toHaveLength(1);
 })));
 it('rejects oversized bodies and invalid JSON shapes before saving a message', async () => fixture(async dir => web(dir, async (url, headers) => {
  expect((await fetch(url + '/api/messages', { method: 'POST', headers, body: JSON.stringify({ text: 'A'.repeat(20_000) }) })).status).toBe(413);
  expect((await fetch(url + '/api/messages', { method: 'POST', headers, body: 'null' })).status).toBe(400);
  expect(await listConsoleMessages(dir)).toHaveLength(0);
 })));
 it('does not serve arbitrary workspace files or expose private audit request data', async () => fixture(async dir => web(dir, async (url, headers) => {
  await mkdir(join(dir, 'business/audit-geo/.reports'), { recursive: true });
  await writeFile(join(dir, 'business/audit-geo/.reports/ledger.json'), JSON.stringify({ attempts: 2, externalSpendCents: 0, customerEmail: 'private@example.test', reports: ['private'] }));
  const response = await fetch(url + '/api/state', { headers }), text = await response.text(); expect(text).not.toContain('private@example.test'); expect(text).not.toContain('reports');
  expect((await fetch(url + '/.operator.env', { headers })).status).toBe(404); expect((await fetch(url + '/src/business/runtime.ts', { headers })).status).toBe(404);
 })));
 it('uses the verified publication URL and refuses executable link schemes', async () => fixture(async dir => web(dir, async (url, headers) => {
  await mkdir(join(dir, 'business/audit-geo'), { recursive: true });
  const publication = join(dir, 'business/audit-geo/publication.json');
  await writeFile(publication, JSON.stringify({ publicUrl: 'https://audit.example.test' }));
  expect((await (await fetch(url + '/api/state', { headers })).json()).publicSite).toBe('https://audit.example.test/');
  await writeFile(publication, JSON.stringify({ publicUrl: 'javascript:alert(1)' }));
  expect((await (await fetch(url + '/api/state', { headers })).json()).publicSite).toMatch(/^https:/);
  await writeFile(publication, JSON.stringify({ publicUrl: 'malformed URL' }));
  expect((await (await fetch(url + '/api/state', { headers })).json()).publicSite).toMatch(/^https:/);
 })));
 it('resolves a question from a genuine owner chat reply without fabricating another message', async () => fixture(async dir => web(dir, async (url, headers) => {
  const q = await appendConsoleMessage(dir, { role: 'automaton', kind: 'question', text: 'Currency?' });
  const agent = await appendConsoleMessage(dir, { role: 'automaton', kind: 'message', text: 'Assume EUR' });
  await expect(resolveConsoleQuestion(dir,q.id,agent.id)).rejects.toThrow('réponse réelle');
  const owner = await appendConsoleMessage(dir, { role: 'owner', kind: 'message', text: 'Keep EUR for now' });
  await resolveConsoleQuestion(dir,q.id,owner.id);await resolveConsoleQuestion(dir,q.id,owner.id);
  const messages=await listConsoleMessages(dir);expect(messages).toHaveLength(3);expect(messages.find(m=>m.id===owner.id)?.kind).toBe('message');expect(messages.find(m=>m.id===q.id)?.answerMessageId).toBe(owner.id);
  expect((await (await fetch(url+'/api/state',{headers})).json()).questions).toHaveLength(0);
  expect((await fetch(url+'/api/messages',{method:'POST',headers,body:JSON.stringify({text:'Another answer',questionId:q.id})})).status).toBe(400);
 })));
});
