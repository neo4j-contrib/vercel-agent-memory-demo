#!/usr/bin/env node
 
// Runs Neo4j's own MCP server (the `neo4j-mcp-server` PyPI package) locally, so
// agent/connections/neo4j-graph.ts has something to connect to at MCP_URL.
//
// Install it once:
//   pip install neo4j-mcp-server
//   # behind a TLS-inspecting proxy, add:
//   #   --trusted-host pypi.org --trusted-host files.pythonhosted.org
//
// In HTTP mode the server refuses to take NEO4J_USERNAME / NEO4J_PASSWORD from
// the environment — it reads the database credentials from each request's Basic
// Auth header instead. That is what MCP_NEO4J_USERNAME / MCP_NEO4J_PASSWORD in
// .env are for: the client sends them, the server passes them to the database.
 
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
 
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
 
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  console.warn("  No .env found — falling back to the ambient environment.\n");
}
 
const env = (name) => process.env[name]?.trim() ?? "";
 
const mcpUrl = env("MCP_URL") || "http://localhost:8000/mcp";
let url;
try {
  url = new URL(mcpUrl);
} catch {
  fail(`MCP_URL is not a URL: ${mcpUrl}`);
}
 
// The server hard-codes its route: anything else answers "only handles /mcp".
if (url.pathname !== "/mcp") {
  fail(`MCP_URL must end in /mcp — the server serves no other path (got ${url.pathname}).`);
}
 
const uri = env("NEO4J_URI");
if (!uri) fail("NEO4J_URI is not set in .env.");
 
const bin = findBinary();
 
const child = spawn(
  bin,
  [],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      // Credentials must NOT be here in HTTP mode — they arrive per request.
      NEO4J_USERNAME: undefined,
      NEO4J_PASSWORD: undefined,
      NEO4J_URI: uri,
      NEO4J_DATABASE: env("NEO4J_DATABASE") || "neo4j",
      NEO4J_TRANSPORT_MODE: "http",
      NEO4J_MCP_HTTP_HOST: url.hostname,
      NEO4J_MCP_HTTP_PORT: url.port || "80",
      NEO4J_READ_ONLY: env("NEO4J_MCP_READ_ONLY") || "true",
      NEO4J_TELEMETRY: env("NEO4J_TELEMETRY") || "false",
    },
  },
);
 
console.log(`  Neo4j MCP → ${uri} (database: ${env("NEO4J_DATABASE") || "neo4j"})`);
console.log(`  Serving   → ${url.origin}${url.pathname}`);
if (!env("MCP_NEO4J_USERNAME") || !env("MCP_NEO4J_PASSWORD")) {
  console.warn(
    "  \x1b[33m⚠ MCP_NEO4J_USERNAME / MCP_NEO4J_PASSWORD are empty — the agent will get 401s.\x1b[0m",
  );
}
console.log("");
 
// spawn reports a missing binary asynchronously; without this the process dies
// on an unhandled 'error' event instead of saying what to install.
child.on("error", (error) => {
  if (error.code === "ENOENT") {
    fail(
      `neo4j-mcp-server was not found (tried: ${bin}).\n` +
        "  Install it into a venv this script can see:\n" +
        "    python -m venv .venv\n" +
        "    .venv/Scripts/python -m pip install neo4j-mcp-server\n" +
        "  (behind a TLS-inspecting proxy, add --trusted-host pypi.org --trusted-host files.pythonhosted.org)\n" +
        "  Or point NEO4J_MCP_BIN at the executable.",
    );
  }
  fail(`Could not start neo4j-mcp-server: ${error.message}`);
});
 
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
 
function findBinary() {
  const explicit = env("NEO4J_MCP_BIN");
  if (explicit) return existsSync(explicit) ? explicit : null;
 
  // A venv next to the repo is the common case here; PATH is the fallback.
  const candidates = [root, resolve(root, "..")].flatMap((base) => [
    join(base, ".venv", "Scripts", "neo4j-mcp-server.exe"),
    join(base, ".venv", "bin", "neo4j-mcp-server"),
  ]);
  return candidates.find(existsSync) ?? "neo4j-mcp-server";
}
 
function fail(message) {
  console.error(`\n  \x1b[31m${message}\x1b[0m\n`);
  process.exit(1);
}