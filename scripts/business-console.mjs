import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createConsoleServer } from '../dist/business/console-server.js';
const workspace = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), port = Number(args[args.indexOf('--port') + 1] ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Port invalide.');
const server = createConsoleServer({ workspace });
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `La console utilise déjà le port ${port}. Ouvrir http://127.0.0.1:${port}` : e.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', async () => {
 await mkdir(join(workspace, '.automaton-business'), { recursive: true, mode: 0o700 });
 await writeFile(join(workspace, '.automaton-business/console-process.json'), JSON.stringify({ pid: process.pid, port, url: `http://127.0.0.1:${port}`, startedAt: new Date().toISOString() }), { mode: 0o600 });
 console.log(`Console Automaton : http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await unlink(join(workspace, '.automaton-business/console-process.json')).catch(() => {}); process.exit(0); }));
