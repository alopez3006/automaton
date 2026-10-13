import { mkdir, open, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { loadBusinessPolicy, optionalBusinessJson, reportedExpenses } from "./policy.js";

type Expense = { id: string; reservedCents: number; actualCents?: number; purpose: string; state: "reserved" | "committed" | "released"; proof?: string; runId?: string };
async function expenses(workspace: string): Promise<Expense[]> {
  const values = await optionalBusinessJson(join(workspace, ".automaton-business/expenses.json")) ?? [];
  if (!Array.isArray(values) || values.some(e => !Number.isSafeInteger(e.reservedCents) || e.reservedCents < 1 || !["reserved", "committed", "released"].includes(e.state) || e.state === "committed" && (!Number.isSafeInteger(e.actualCents) || e.actualCents < 0 || e.actualCents > e.reservedCents))) throw new Error("Invalid expense ledger");
  return values;
}
export async function businessBudget(workspace: string) {
  const [policy, entries, receipts, ledger] = await Promise.all([loadBusinessPolicy(workspace), expenses(workspace), reportedExpenses(workspace), optionalBusinessJson(join(workspace, "business/audit-geo/.reports/ledger.json"))]);
  const operatorSpend = ledger?.externalSpendCents ?? 0;
  if (!Number.isSafeInteger(operatorSpend) || operatorSpend < 0) throw new Error("Invalid operator spend");
  const committed = entries.filter(e => e.state === "committed");
  const reportedOnly = Object.entries(receipts).reduce((n, [runId, cents]) => n + Math.max(0, cents - committed.filter(e => e.runId === runId).reduce((sum, e) => sum + e.actualCents!, 0)), 0);
  const usedCents = Math.max(operatorSpend, reportedOnly + committed.reduce((n, e) => n + e.actualCents!, 0));
  const reservedCents = entries.reduce((n, e) => n + (e.state === "reserved" ? e.reservedCents : 0), 0);
  return { budgetCents: policy.externalBudgetCents, usedCents, reservedCents, availableCents: Math.max(0, policy.externalBudgetCents - usedCents - reservedCents), exceeded: usedCents + reservedCents > policy.externalBudgetCents };
}
export async function updateExpense(workspace: string, action: "reserve" | "commit" | "release", input: { cents?: number; purpose?: string; id?: string; proof?: string; runId?: string }) {
  const root = join(workspace, ".automaton-business"); await mkdir(root, { recursive: true, mode: 0o700 });
  const lockPath = join(root, "expense.lock"), lock = await open(lockPath, "wx", 0o600).catch(() => { throw new Error("Expense ledger is busy; retry after the current operation"); });
  try {
    const entries = await expenses(workspace); let entry: Expense;
    if (action === "reserve") {
      if (!Number.isSafeInteger(input.cents) || input.cents! < 1 || typeof input.purpose !== "string" || !input.purpose.trim() || input.purpose.length > 500) throw new Error("Expense amount and purpose required");
      const budget = await businessBudget(workspace);
      if (budget.exceeded || input.cents! > budget.availableCents) throw new Error("Expense exceeds remaining total budget");
      entry = { id: randomUUID(), reservedCents: input.cents!, purpose: input.purpose, state: "reserved" }; entries.push(entry);
    } else {
      entry = entries.find(e => e.id === input.id)!;
      if (!entry) throw new Error("Expense reservation not found");
      if (action === "release") { if (entry.state === "committed") throw new Error("Cannot release an already paid expense"); entry.state = "released"; }
      else {
        if (!Number.isSafeInteger(input.cents) || input.cents! < 0 || input.cents! > entry.reservedCents || typeof input.proof !== "string" || !input.proof.trim() || input.proof.length > 500) throw new Error("Actual cost must fit its reservation and include a receipt reference");
        if (entry.state === "committed") { if (entry.actualCents !== input.cents || entry.proof !== input.proof) throw new Error("Paid expense is immutable"); return { id: entry.id, state: entry.state }; }
        if (entry.state !== "reserved") throw new Error("Expense reservation is not open");
        if (input.runId && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.runId)) throw new Error("Invalid expense run association");
        entry.actualCents = input.cents; entry.proof = input.proof; entry.state = "committed"; entry.runId = input.runId;
      }
    }
    if (/\b(?:rk|sk)_(?:live|test)_|\bwhsec_|Bearer\s|-----BEGIN.*PRIVATE KEY/i.test(JSON.stringify(entry))) throw new Error("Do not store credentials in the expense ledger");
    const temp = join(root, randomUUID() + ".expense.tmp"); await writeFile(temp, JSON.stringify(entries, null, 2), { mode: 0o600 }); await rename(temp, join(root, "expenses.json"));
    return { id: entry.id, state: entry.state };
  } finally { await lock.close(); await unlink(lockPath); }
}
