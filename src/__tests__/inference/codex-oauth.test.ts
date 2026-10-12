import { describe, it, expect, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCodexResponse, createCodexOAuthClient } from "../../inference/codex-oauth.js";

describe("Codex OAuth boundary", () => {
  const tools = [{ type: "function" as const, function: { name: "recall", description: "memory", parameters: {} } }];
  it("preserves content and tool call IDs for the runtime", () => {
    const r = parseCodexResponse(JSON.stringify({ content: "", tool_calls: [{ name: "recall", arguments: '{"query":"scope"}' }] }), tools);
    expect(r.toolCalls?.[0].id).toBe(r.message.tool_calls?.[0].id);
    expect(r.finishReason).toBe("tool_calls");
  });
  it.each(["secret_reader", "exec"])("rejects unavailable %s instead of executing", name => {
    expect(() => parseCodexResponse(JSON.stringify({ content: "", tool_calls: [{ name, arguments: "{}" }] }), tools)).toThrow("unavailable");
  });
  it.each(["null", "[]", "broken"])("rejects malformed tool arguments %s", argumentsValue => {
    expect(() => parseCodexResponse(JSON.stringify({ content: "", tool_calls: [{ name: "recall", arguments: argumentsValue }] }), tools)).toThrow();
  });
  it("fails closed when the executable cannot start", async () => {
    await expect(createCodexOAuthClient({ executable: "/nonexistent/codex" }).chat([{ role: "user", content: "test" }])).rejects.toThrow("Cannot start");
  });
  it("does not forward the operator's API credentials to Codex", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-env-fixture-"));
    const executable = join(dir, "fake-codex.mjs");
    vi.stubEnv("OPENAI_API_KEY", "fixture-only");
    vi.stubEnv("RLM_API_KEY", "fixture-only");
    try {
      await writeFile(executable, `#!/usr/bin/env node
import fs from 'node:fs';
const output=process.argv[process.argv.indexOf('-o')+1];
fs.writeFileSync(output,JSON.stringify({content:process.env.OPENAI_API_KEY||process.env.RLM_API_KEY?'leaked':'clean',tool_calls:[]}));
process.stdin.resume();
`, { mode: 0o700 });
      const result = await createCodexOAuthClient({ executable }).chat([{ role: "user", content: "test" }]);
      expect(result.message.content).toBe("clean");
    } finally { vi.unstubAllEnvs(); await rm(dir, { recursive: true, force: true }); }
  });
});
