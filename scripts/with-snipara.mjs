import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Only read the explicitly configured local secret source. Never log its contents.
export function sniparaEnvironment(base = process.env) {
  let key = base.RLM_API_KEY || base.SNIPARA_API_KEY;
  if (!key) {
    const source = base.SNIPARA_SECRET_FILE || `${os.homedir()}/.codex/snipara.env`;
    const content = fs.readFileSync(source, "utf8");
    for (const name of ["RLM_API_KEY", "SNIPARA_API_KEY"]) {
      const match = content.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, "m"));
      if (match) { key = match[1].trim().replace(/^(['"])(.*)\1$/, "$2"); break; }
    }
  }
  if (!key) throw new Error("No Snipara API key in environment or local secret source");
  return { ...base, RLM_API_KEY: key, SNIPARA_MCP_URL: "https://api.snipara.com/mcp/automaton" };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const child = spawn(process.execPath, [fileURLToPath(new URL("../dist/index.js", import.meta.url)),
      ...(process.argv.length > 2 ? process.argv.slice(2) : ["--help"])],
      { env: sniparaEnvironment(), stdio: "inherit" });
    child.on("error", () => { console.error("Automaton could not start"); process.exitCode = 1; });
    child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  } catch {
    console.error("Snipara credentials unavailable; configure RLM_API_KEY or ~/.codex/snipara.env");
    process.exitCode = 1;
  }
}
