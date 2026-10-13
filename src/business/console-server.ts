import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, open, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import { appendConsoleMessage, listConsoleMessages } from "./console-state.js";
import { businessEnvironment, redactBusinessOutput } from "./runtime.js";

const LIMIT = 16_384;
async function optionalJson(file: string) { try { return JSON.parse(await readFile(file, "utf8")); } catch (e: any) { if (e.code === "ENOENT") return null; throw e; } }
async function tail(file: string, bytes = 40_000) {
  let handle;
  try { handle = await open(file, "r"); const stat = await handle.stat(); const buffer = Buffer.alloc(Math.min(stat.size, bytes)); await handle.read(buffer, 0, buffer.length, Math.max(0, stat.size - bytes)); return redactBusinessOutput(buffer.toString()); }
  catch (e: any) { if (e.code === "ENOENT") return ""; throw e; }
  finally { await handle?.close(); }
}
function alive(pid: unknown) { if (!Number.isSafeInteger(pid) || (pid as number) <= 0) return false; try { process.kill(pid as number, 0); return true; } catch { return false; } }
function runCount(workspace: string) {
  if (!existsSync(join(workspace, ".automaton-business/state.db"))) return 0;
  let db;
  try { db = new Database(join(workspace, ".automaton-business/state.db"), { readonly: true, fileMustExist: true }); return Number((db.prepare("SELECT value FROM kv WHERE key = ?").get("business_runs") as any)?.value ?? 0); }
  catch (e: any) { if (e.code === "SQLITE_CANTOPEN") return 0; throw e; }
  finally { db?.close(); }
}
async function receiptSpend(workspace: string) {
  const root = join(workspace, ".automaton-business");
  let names: string[];
  try { names = await readdir(root); } catch (e: any) { if (e.code === "ENOENT") return 0; throw e; }
  const receipts = await Promise.all(names.filter(n => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/i.test(n)).map(n => optionalJson(join(root, n))));
  return receipts.reduce((sum, r) => sum + (Number.isSafeInteger(r?.externalSpendCents) && r.externalSpendCents >= 0 ? r.externalSpendCents : 0), 0);
}
export async function consoleSnapshot(workspace: string) {
  const [status, lock, watcher, ledger, activity, messages, spent, publication] = await Promise.all([
    optionalJson(join(workspace, ".automaton-business/status.json")), optionalJson(join(workspace, ".automaton-business/run.lock")),
    optionalJson(join(workspace, "business/audit-geo/.reports/watch-process.json")), optionalJson(join(workspace, "business/audit-geo/.reports/ledger.json")),
    tail(join(workspace, "business/audit-geo/ACTIVITY.md")), listConsoleMessages(workspace), receiptSpend(workspace), optionalJson(join(workspace, "business/audit-geo/publication.json")),
  ]);
  const answered = new Set(messages.filter(m => m.kind === "answer").map(m => m.questionId));
  const running = alive(lock?.pid);
  let publicSite = "https://audit-geo-pilote.alopez-nevicom.chatgpt.site";
  if (typeof publication?.publicUrl === "string") { try { const url = new URL(publication.publicUrl); if (url.protocol === "https:" && !url.username && !url.password) publicSite = url.href; } catch { /* Preserve the verified fallback if metadata is malformed. */ } }
  return { updatedAt: new Date().toISOString(), status: status ?? { state: "not_started" }, running, staleLock: Boolean(lock && !running),
    runs: runCount(workspace), maxRuns: 3, watcher: { running: alive(watcher?.pid), startedAt: watcher?.startedAt, maxHours: watcher?.maxHours ?? 24 },
    audit: { attempts: ledger?.attempts ?? 0, maxAttempts: 10, externalSpendCents: Math.max(ledger?.externalSpendCents ?? 0, spent), budgetCents: 2000 },
    activity, messages: messages.slice(-250), questions: messages.filter(m => m.kind === "question" && !answered.has(m.id)),
    queuedMessages: messages.filter(m => m.role === "owner" && !m.acknowledged).length,
    publicSite };
}
async function body(req: IncomingMessage) {
  if (Number(req.headers["content-length"]) > LIMIT) { req.resume(); throw Object.assign(new Error("Message trop volumineux."), { status: 413 }); }
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > LIMIT) throw Object.assign(new Error("Message trop volumineux."), { status: 413 }); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Object.assign(new Error("Requête JSON invalide."), { status: 400 }); }
}
export function createConsoleServer(options: { workspace: string; launch?: () => Promise<unknown> }) {
  const workspace = resolve(options.workspace), token = randomBytes(32).toString("base64url");
  let launching = false;
  const rate = new Map<string, number[]>();
  const launch = async () => {
    if (launching) return { alreadyRunning: true };
    launching = true;
    try {
      const state = await consoleSnapshot(workspace);
      if (state.running) return { alreadyRunning: true };
      if (state.staleLock) throw new Error("Verrou ancien détecté : vérifier le processus avant reprise.");
      if (state.runs >= state.maxRuns) throw new Error("Les trois passes du pilote sont utilisées. Une nouvelle autorisation de durée est nécessaire.");
      if (options.launch) return await options.launch();
      return await new Promise((accept, reject) => {
        const child = spawn(process.execPath, [join(workspace, "scripts/start-business.mjs")], { cwd: workspace, env: businessEnvironment(process.env), stdio: ["ignore", "pipe", "pipe"] });
        let out = ""; const timeout = setTimeout(() => child.kill(), 10_000);
        child.stdout.on("data", chunk => { if (out.length < LIMIT) out += chunk.toString(); }); child.stderr.resume();
        child.once("error", e => { clearTimeout(timeout); reject(e); });
        child.once("close", code => { clearTimeout(timeout); if (code !== 0) return reject(new Error("Démarrage impossible. Consulter le journal du contrôleur.")); try { accept(JSON.parse(out.trim())); } catch { reject(new Error("Réponse de démarrage invalide.")); } });
      });
    } finally { launching = false; }
  };
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const port = (server.address() as any)?.port;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const send = (status: number, value: unknown) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(value)); };
    res.setHeader("cache-control", "no-store"); res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader("referrer-policy", "no-referrer");
    if (!hosts.includes(req.headers.host ?? "")) return send(403, { error: "Hôte refusé." });
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: "Origine refusée." });
    if (req.headers["sec-fetch-site"] === "cross-site") return send(403, { error: "Accès externe refusé." });
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        const html = (await readFile(join(workspace, "business/console/index.html"), "utf8")).replace("__CONSOLE_TOKEN__", token);
        res.setHeader("set-cookie", `automaton_console=${token}; HttpOnly; SameSite=Strict; Path=/`);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(html);
      }
      const assets: Record<string, string> = { "/console.css": "text/css", "/console.js": "text/javascript", "/fraunces.ttf": "font/ttf" };
      if (req.method === "GET" && assets[url.pathname]) {
        res.writeHead(200, { "content-type": assets[url.pathname] }); return res.end(await readFile(join(workspace, "business/console", url.pathname.slice(1))));
      }
      if (!url.pathname.startsWith("/api/")) return send(404, { error: "Page introuvable." });
      const cookie = req.headers.cookie?.split(";").map(c => c.trim()).find(c => c.startsWith("automaton_console="))?.slice("automaton_console=".length);
      if (!cookie || cookie.length !== token.length || !timingSafeEqual(Buffer.from(cookie), Buffer.from(token))) return send(401, { error: "Ouvrir la console pour démarrer une session." });
      if (req.method === "GET" && url.pathname === "/api/state") return send(200, await consoleSnapshot(workspace));
      if (req.method !== "POST") return send(405, { error: "Méthode refusée." });
      if (req.headers["x-console-token"] !== token || req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: "Session refusée." });
      if (!req.headers["content-type"]?.startsWith("application/json")) return send(415, { error: "JSON requis." });
      const key = req.socket.remoteAddress ?? "local", now = Date.now(), times = (rate.get(key) ?? []).filter(t => now - t < 60_000);
      if (times.length >= 20) return send(429, { error: "Trop de messages. Réessayer dans une minute." });
      rate.set(key, [...times, now]);
      const input = await body(req);
      if (!input || typeof input !== "object" || Array.isArray(input)) return send(400, { error: "Objet JSON requis." });
      if (url.pathname === "/api/start") return send(200, await launch());
      if (url.pathname === "/api/messages") {
        const messages = await listConsoleMessages(workspace);
        if (messages.length >= 2000) throw new Error("Journal plein : archive nécessaire.");
        if (input.questionId && !messages.some(m => m.id === input.questionId && m.kind === "question")) throw new Error("Question introuvable.");
        if (input.questionId && messages.some(m => m.kind === "answer" && m.questionId === input.questionId)) throw new Error("Cette question a déjà une réponse.");
        const message = await appendConsoleMessage(workspace, { role: "owner", kind: input.questionId ? "answer" : "message", text: input.text, ...(input.questionId ? { questionId: input.questionId } : {}) });
        let launchResult: unknown = null, launchError: string | null = null;
        if (input.start === true) { try { launchResult = await launch(); } catch (e: any) { launchError = e.message; } }
        return send(201, { message, launchResult, launchError });
      }
      return send(404, { error: "Action introuvable." });
    } catch (e: any) { return send(e.status ?? 400, { error: redactBusinessOutput(e.message ?? "Action impossible.") }); }
  });
  return server;
}
