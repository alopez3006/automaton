import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSniparaTools, SniparaClient } from "../agent/snipara.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const url = "https://api.snipara.com/mcp/automaton";
const names = ["snipara_stats", "snipara_context_query", "snipara_recall", "snipara_remember_if_novel"];

describe("hosted Snipara adapter", () => {
  it("rejects URLs that could disclose credentials elsewhere", () => {
    for (const target of ["http://api.snipara.com/mcp/a", "https://evil.test/mcp/a",
      "https://api.snipara.com.evil.test/mcp/a", `${url}?redirect=evil`,
      "https://user:password@api.snipara.com/mcp/a"]) {
      expect(() => new SniparaClient(target, "secret")).toThrow();
    }
  });
  it("requires a key and refuses tools outside the approved scope", async () => {
    expect(() => new SniparaClient(url, " ")).toThrow();
    await expect(new SniparaClient(url, "secret").call("snipara_delete", {})).rejects.toThrow();
    await expect(new SniparaClient(url, "secret").call("snipara_recall", { scope: "user" })).rejects.toThrow("project scope");
  });
  it("does not activate without an explicit endpoint", async () => {
    vi.stubEnv("SNIPARA_MCP_URL", "");
    expect(await loadSniparaTools()).toEqual([]);
  });
  it("initializes, paginates and exposes only the approved tools with server schemas", async () => {
    vi.stubEnv("SNIPARA_MCP_URL", url); vi.stubEnv("RLM_API_KEY", "secret");
    const requests: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      expect(options.redirect).toBe("error");
      if (body.method === "notifications/initialized") {
        expect(body.id).toBeUndefined(); return new Response(null, { status: 202 });
      }
      const result = body.method === "initialize" ? {} : body.params.cursor
        ? { tools: names.slice(2).map(name => ({ name, inputSchema: { type: "object" } })) }
        : { tools: [...names.slice(0, 2), "snipara_delete"].map(name => ({ name, inputSchema: { type: "object" } })), nextCursor: "next" };
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    }));
    const tools = await loadSniparaTools();
    expect(requests.map(r => r.method)).toEqual(["initialize", "notifications/initialized", "tools/list", "tools/list"]);
    expect(tools.map(t => t.name)).toEqual(names);
    expect(tools[0].parameters).toEqual({ type: "object" });
    expect(tools[3].riskLevel).toBe("caution");
  });
  it("parses SSE replies and forwards session IDs", async () => {
    const mock = vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      expect(body.params.arguments.scope).toBe(body.params.name === "snipara_recall" ? "project" : undefined);
      if (body.id === 2) expect(options.headers["Mcp-Session-Id"]).toBe("session");
      return new Response(`event: message\ndata: ${JSON.stringify({ id: body.id, result: { content: [] } })}\n\n`,
        { headers: { "Content-Type": "text/event-stream", "Mcp-Session-Id": "session" } });
    });
    vi.stubGlobal("fetch", mock);
    const client = new SniparaClient(url, "secret");
    await client.call("snipara_stats", {}); await client.call("snipara_recall", {});
  });
  it("fails on HTTP, protocol and tool errors without exposing response secrets", async () => {
    const client = new SniparaClient(url, "secret");
    vi.stubGlobal("fetch", async () => new Response("secret", { status: 401 }));
    await expect(client.call("snipara_stats", {})).rejects.toThrow("Snipara HTTP 401");
    vi.stubGlobal("fetch", async () => Response.json({ id: 2, error: { code: -1, message: "secret" } }));
    await expect(client.call("snipara_stats", {})).rejects.toThrow("Snipara MCP error -1");
    vi.stubGlobal("fetch", async () => Response.json({ id: 3, result: { isError: true, content: [{ text: "secret" }] } }));
    await expect(client.call("snipara_stats", {})).rejects.toThrow("Snipara tool snipara_stats failed");
  });
});
