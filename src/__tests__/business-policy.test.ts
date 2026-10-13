import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadBusinessPolicy, legacyPolicy, missionCapacity, auditCapacity, missionDay } from "../business/policy.js";
import { businessBudget, updateExpense } from "../business/budget.js";
const policy = { ...legacyPolicy, enabled: true, externalBudgetCents: 5000 };
async function fixture(work: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "automaton-mission-fixture-"));
  try { await mkdir(join(dir, "business/audit-geo"), { recursive: true }); await writeFile(join(dir, "business/audit-geo/mission.json"), JSON.stringify(policy)); await work(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}
describe("Standing business mission", () => {
  it("rejects a budget beyond the owner's authorized ceiling", async () => fixture(async dir => {
    await writeFile(join(dir, "business/audit-geo/mission.json"), JSON.stringify({ ...policy, externalBudgetCents: 5001 }));
    await expect(loadBusinessPolicy(dir)).rejects.toThrow("Invalid authorized");
  }));
  it("supports the twenty-minute cadence without losing the daily ceiling or prior passes", async () => fixture(async dir => {
    const cadencePolicy = { ...policy, passesPerDay: 72 };
    await writeFile(join(dir, "business/audit-geo/mission.json"), JSON.stringify(cadencePolicy));
    expect(await loadBusinessPolicy(dir)).toMatchObject({ passesPerDay: 72, externalBudgetCents: 5000 });
    const now = Date.parse("2026-10-13T12:00:00Z");
    const passes = Array.from({ length: 72 }, (_, i) => ({ id: String(i), startedAt: "2026-10-13T10:00:00Z", outcome: "completed" as const }));
    expect(missionCapacity(cadencePolicy, passes.slice(0, 6), now)).toMatchObject({ allowed: true, usedToday: 6 });
    expect(missionCapacity(cadencePolicy, passes.slice(0, 71), now).allowed).toBe(true);
    expect(missionCapacity(cadencePolicy, passes, now)).toMatchObject({ allowed: false, usedToday: 72 });
    await writeFile(join(dir, "business/audit-geo/mission.json"), JSON.stringify({ ...cadencePolicy, passesPerDay: 73 }));
    await expect(loadBusinessPolicy(dir)).rejects.toThrow("Invalid authorized");
  }));
  it("uses Zurich days and preserves cumulative audit counts across the daily reset", () => {
    const now = Date.parse("2026-10-13T22:30:00Z"); expect(missionDay(now, policy)).toBe("2026-10-14");
    expect(auditCapacity({ attempts: 31, auditDay: "2026-10-13", dailyAttempts: 10 }, policy, now)).toMatchObject({ attempts: 31, today: 0, allowed: true });
    expect(auditCapacity({ attempts: 41, auditDay: "2026-10-14", dailyAttempts: 10 }, policy, now).allowed).toBe(false);
  });
  it("limits daily passes and backs off consecutive failures", () => {
    const now = Date.parse("2026-10-13T12:00:00Z");
    const passes = Array.from({ length: 6 }, (_, i) => ({ id: String(i), startedAt: "2026-10-13T10:00:00Z", outcome: "completed" as const }));
    expect(missionCapacity(policy, passes, now).allowed).toBe(false);
    expect(missionCapacity(policy, [{ id: "failed", startedAt: "2026-10-13T11:50:00Z", outcome: "failed" }], now).reason).toBe("Mission retry backoff active");
    expect(missionCapacity(policy, passes.slice(0, 3).map(p => ({ ...p, outcome: "failed" as const })), now).reason).toBe("Three mission executor failures require review");
  });
  it("reserves before purchase, settles once, and counts unrelated old receipts without double-counting the current purchase", async () => fixture(async dir => {
    const runId = "00000000-0000-0000-0000-000000000001", oldRunId = "00000000-0000-0000-0000-000000000002";
    const entry = await updateExpense(dir, "reserve", { cents: 4000, purpose: "One-off provider credit" });
    await expect(updateExpense(dir, "reserve", { cents: 2000, purpose: "Second credit" })).rejects.toThrow("remaining total budget");
    await updateExpense(dir, "commit", { id: entry.id, cents: 3900, proof: "provider-receipt-1", runId });
    await updateExpense(dir, "commit", { id: entry.id, cents: 3900, proof: "provider-receipt-1", runId });
    await writeFile(join(dir, ".automaton-business", runId + ".json"), JSON.stringify({ externalSpendCents: 3900 }));
    await writeFile(join(dir, ".automaton-business", oldRunId + ".json"), JSON.stringify({ externalSpendCents: 500 }));
    expect(await businessBudget(dir)).toMatchObject({ usedCents: 4400, reservedCents: 0, availableCents: 600 });
    const unused = await updateExpense(dir, "reserve", { cents: 600, purpose: "Unused credit" });
    expect((await businessBudget(dir)).availableCents).toBe(0);
    await updateExpense(dir, "release", { id: unused.id });
    expect((await businessBudget(dir)).availableCents).toBe(600);
    await expect(updateExpense(dir, "release", { id: entry.id })).rejects.toThrow("already paid");
  }));
  it("does not let concurrent reservations oversubscribe the budget", async () => fixture(async dir => {
    const results = await Promise.allSettled([1, 2].map(i => updateExpense(dir, "reserve", { cents: 3000, purpose: "Credit " + i })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await businessBudget(dir)).reservedCents).toBe(3000);
  }));
});
