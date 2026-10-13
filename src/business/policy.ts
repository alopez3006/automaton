import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export type BusinessPolicy = { version: 1; enabled: boolean; objective: string; externalBudgetCents: number; passesPerDay: number; auditAttemptsPerDay: number; timeZone: string };
export const legacyPolicy: BusinessPolicy = { version: 1, enabled: false, objective: "Run the authorized audit pilot", externalBudgetCents: 2000, passesPerDay: 6, auditAttemptsPerDay: 10, timeZone: "Europe/Zurich" };
export async function optionalBusinessJson(path: string): Promise<any> { try { return JSON.parse(await readFile(path, "utf8")); } catch (e: any) { if (e.code === "ENOENT") return null; throw e; } }
export async function loadBusinessPolicy(workspace: string): Promise<BusinessPolicy> {
  const value = await optionalBusinessJson(join(workspace, "business/audit-geo/mission.json"));
  if (value === null) return { ...legacyPolicy };
  if (value.version !== 1 || typeof value.enabled !== "boolean" || typeof value.objective !== "string" || !value.objective.trim() || value.objective.length > 1000 ||
      !Number.isSafeInteger(value.externalBudgetCents) || value.externalBudgetCents < 0 || value.externalBudgetCents > 5000 ||
      !Number.isSafeInteger(value.passesPerDay) || value.passesPerDay < 1 || value.passesPerDay > 72 ||
      !Number.isSafeInteger(value.auditAttemptsPerDay) || value.auditAttemptsPerDay < 1 || value.auditAttemptsPerDay > 10 || value.timeZone !== "Europe/Zurich") throw new Error("Invalid authorized business mission policy");
  return value;
}
export function missionDay(time: number | string, policy: BusinessPolicy): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: policy.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
}
export type MissionPass = { id: string; startedAt: string; outcome: "started" | "completed" | "failed" };
export function missionPasses(raw?: string): MissionPass[] {
  const values = JSON.parse(raw ?? "[]");
  if (!Array.isArray(values) || values.length > 5000 || values.some(v => typeof v.id !== "string" || !Number.isFinite(Date.parse(v.startedAt)) || !["started", "completed", "failed"].includes(v.outcome))) throw new Error("Invalid mission pass history");
  return values;
}
export function missionCapacity(policy: BusinessPolicy, history: MissionPass[], now = Date.now()) {
  const usedToday = history.filter(v => missionDay(v.startedAt, policy) === missionDay(now, policy)).length;
  let failures = 0;
  for (const v of [...history].reverse()) { if (v.outcome !== "failed") break; failures++; }
  const retryAt = failures ? Date.parse(history.at(-1)!.startedAt) + Math.min(120, 30 * 2 ** (failures - 1)) * 60_000 : 0;
  const reason = usedToday >= policy.passesPerDay ? "Daily mission pass limit reached" : failures >= 3 ? "Three mission executor failures require review" : retryAt > now ? "Mission retry backoff active" : null;
  return { allowed: !reason, usedToday, failures, reason, retryAt: retryAt > now ? new Date(retryAt).toISOString() : null };
}
export function auditCapacity(ledger: any, policy: BusinessPolicy, now = Date.now()) {
  const attempts = ledger?.attempts ?? 0;
  if (!Number.isSafeInteger(attempts) || attempts < 0) throw new Error("Invalid audit attempt count");
  const day = missionDay(now, policy);
  const today = ledger?.auditDay === day ? ledger.dailyAttempts : ledger?.auditDay ? 0 : attempts;
  if (!Number.isSafeInteger(today) || today < 0) throw new Error("Invalid daily audit count");
  return { day, today, attempts, allowed: policy.enabled ? today < policy.auditAttemptsPerDay : attempts < 10 };
}
export async function reportedExpenses(workspace: string): Promise<Record<string, number>> {
  let names: string[];
  try { names = await readdir(join(workspace, ".automaton-business")); } catch (e: any) { if (e.code === "ENOENT") return {}; throw e; }
  const values: Record<string, number> = {};
  for (const name of names.filter(n => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/i.test(n))) {
    const receipt = await optionalBusinessJson(join(workspace, ".automaton-business", name));
    if (!Number.isSafeInteger(receipt?.externalSpendCents) || receipt.externalSpendCents < 0) throw new Error("Invalid prior expense receipt");
    values[name.slice(0, -5)] = receipt.externalSpendCents;
  }
  return values;
}
