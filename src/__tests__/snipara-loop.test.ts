import { expect, it, vi } from "vitest";
import { runAgentLoop } from "../agent/loop.js";
import { MockInferenceClient, MockConwayClient, createTestDb,
  createTestIdentity, createTestConfig, toolCallResponse, noToolResponse } from "./mocks.js";
import type { AgentTurn } from "../types.js";

it("the agent loop exposes and executes hosted Snipara memory tools", async () => {
  const db = createTestDb();
  vi.stubEnv("SNIPARA_MCP_URL", "https://api.snipara.com/mcp/automaton");
  vi.stubEnv("RLM_API_KEY", "test-key");
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(options.body as string); calls.push(body.method);
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    const result = body.method === "tools/list" ? { tools: ["snipara_stats", "snipara_context_query",
      "snipara_recall", "snipara_remember_if_novel"].map(name => ({ name, inputSchema: { type: "object" } })) }
      : body.method === "tools/call" ? { content: [{ type: "text", text: '{"memories":[]}' }] } : {};
    return Response.json({ id: body.id, result });
  });
  try {
    const inference = new MockInferenceClient([
      toolCallResponse([{ name: "snipara_recall", arguments: { query: "prior decisions", scope: "project" } }]),
      noToolResponse("Done."),
    ]);
    const turns: AgentTurn[] = [];
    await runAgentLoop({ identity: createTestIdentity(), config: createTestConfig(), db,
      conway: new MockConwayClient(), inference, onTurnComplete: turn => turns.push(turn) });
    const tool = turns.flatMap(t => t.toolCalls).find(t => t.name === "snipara_recall");
    expect(tool?.error).toBeUndefined();
    expect(tool?.result).toContain("memories");
    expect(calls).toContain("tools/call");
    expect(JSON.stringify(inference.calls[0])).toContain("Snipara provides this project's durable memory");
  } finally {
    vi.unstubAllGlobals(); vi.unstubAllEnvs(); db.close();
  }
});
