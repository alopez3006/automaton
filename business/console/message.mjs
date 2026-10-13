import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendConsoleMessage, pendingConsoleMessages, acknowledgeConsoleMessages, listConsoleMessages } from '../../dist/business/console-state.js';
const workspace = fileURLToPath(new URL('../../', import.meta.url));
const [operation, ...args] = process.argv.slice(2);
if (operation === 'inbox') console.log(JSON.stringify(await pendingConsoleMessages(workspace)));
else if (operation === 'history') console.log(JSON.stringify((await listConsoleMessages(workspace)).slice(-40)));
else if (operation === 'ack') { await acknowledgeConsoleMessages(workspace, args); console.log('Messages lus.'); }
else if (operation === 'say' || operation === 'ask') {
 const options = args[1] ? JSON.parse(args[1]) : undefined;
 console.log(JSON.stringify(await appendConsoleMessage(workspace, { role: 'automaton', kind: operation === 'ask' ? 'question' : 'message', text: args[0], ...(options ? { options } : {}) })));
} else throw Error('Utiliser inbox, history, ack <id...>, say <message>, ou ask <question> [options JSON].');
