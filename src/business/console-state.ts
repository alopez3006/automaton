import { mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type ConsoleMessage = {
  id: string; createdAt: string; role: "owner" | "automaton";
  kind: "message" | "question" | "answer"; text: string;
  questionId?: string; options?: string[]; acknowledged?: boolean;
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function messageText(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 6000) throw new Error("Message requis, maximum 6 000 caractères.");
  if (/\b(?:rk|sk)_(?:live|test)_|\bwhsec_|Bearer\s+[\w.-]+|-----BEGIN.*PRIVATE KEY/i.test(value)) throw new Error("Ne transmettez pas de clé ou de secret dans le chat.");
  return value.trim();
}
function paths(workspace: string) {
  const root = join(workspace, ".automaton-business/console");
  return { root, messages: join(root, "messages"), acknowledgments: join(root, "acknowledgments") };
}
export async function appendConsoleMessage(workspace: string, input: Omit<ConsoleMessage, "id" | "createdAt" | "acknowledged">) {
  const text = messageText(input.text);
  if (!["owner", "automaton"].includes(input.role) || !["message", "question", "answer"].includes(input.kind)) throw new Error("Message invalide.");
  if ((input.kind === "question" && input.role !== "automaton") || (input.kind === "answer" && input.role !== "owner")) throw new Error("Rôle invalide.");
  if (input.kind === "answer" && (!input.questionId || !uuid.test(input.questionId))) throw new Error("Question invalide.");
  const options = input.options?.map(messageText);
  if (options && (input.kind !== "question" || options.length > 5 || options.some(o => o.length > 200))) throw new Error("Options invalides.");
  const message: ConsoleMessage = { id: randomUUID(), createdAt: new Date().toISOString(), role: input.role, kind: input.kind, text,
    ...(input.questionId ? { questionId: input.questionId } : {}), ...(options ? { options } : {}) };
  const dirs = paths(workspace);
  await mkdir(dirs.messages, { recursive: true, mode: 0o700 });
  let answerClaim: string | undefined;
  if (message.kind === "answer") {
    const claimDir = join(dirs.root, "answers");
    await mkdir(claimDir, { recursive: true, mode: 0o700 });
    answerClaim = join(claimDir, message.questionId!);
    try { await writeFile(answerClaim, message.id, { flag: "wx", mode: 0o600 }); }
    catch (e: any) { if (e.code === "EEXIST") throw new Error("Cette question a déjà une réponse."); throw e; }
  }
  try { await writeFile(join(dirs.messages, message.id + ".json"), JSON.stringify(message), { flag: "wx", mode: 0o600 }); }
  catch (error) { if (answerClaim) await unlink(answerClaim); throw error; }
  return message;
}
export async function listConsoleMessages(workspace: string): Promise<ConsoleMessage[]> {
  const dirs = paths(workspace);
  let names: string[];
  try { names = await readdir(dirs.messages); } catch (e: any) { if (e.code === "ENOENT") return []; throw e; }
  if (names.length > 2000) throw new Error("Journal de conversation plein ; archive nécessaire.");
  const messages = await Promise.all(names.filter(n => n.endsWith(".json") && uuid.test(n.slice(0, -5))).map(async name => {
    const value = JSON.parse(await readFile(join(dirs.messages, name), "utf8")) as ConsoleMessage;
    messageText(value.text);
    if (value.id !== name.slice(0, -5) || !["owner", "automaton"].includes(value.role) || !["message", "question", "answer"].includes(value.kind)) throw new Error("Journal invalide.");
    try { await readFile(join(dirs.acknowledgments, value.id)); value.acknowledged = true; } catch (e: any) { if (e.code !== "ENOENT") throw e; }
    return value;
  }));
  return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export async function pendingConsoleMessages(workspace: string) {
  const messages = await listConsoleMessages(workspace);
  return messages.filter(m => m.role === "owner" && !m.acknowledged).map(m => ({ ...m,
    ...(m.questionId ? { questionText: messages.find(q => q.id === m.questionId && q.kind === "question")?.text } : {}) }));
}
export async function acknowledgeConsoleMessages(workspace: string, ids: string[]) {
  if (!ids.length || ids.length > 100 || ids.some(id => !uuid.test(id))) throw new Error("Identifiants invalides.");
  const existing = await listConsoleMessages(workspace);
  if (ids.some(id => !existing.some(m => m.id === id && m.role === "owner"))) throw new Error("Message propriétaire absent.");
  const dirs = paths(workspace);
  await mkdir(dirs.acknowledgments, { recursive: true, mode: 0o700 });
  await Promise.all(ids.map(id => writeFile(join(dirs.acknowledgments, id), new Date().toISOString(), { mode: 0o600 })));
}
