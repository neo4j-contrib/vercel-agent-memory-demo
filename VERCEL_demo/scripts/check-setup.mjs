#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m, fix) => {
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
  if (fix) console.log(`    \x1b[33m→ ${fix}\x1b[0m`);
  failures += 1;
};
const note = (m) => console.log(`  \x1b[2m·\x1b[0m ${m}`);
let failures = 0;

console.log("\n  Checking your setup…\n");

const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) {
  ok(`Node ${process.versions.node}`);
} else {
  bad(`Node ${process.versions.node} is too old`, "Install Node 20 or newer from https://nodejs.org");
}

if (existsSync(".env")) {
  ok(".env exists");
  loadEnv(".env");
} else {
  bad(".env is missing", "Run: cp .env.example .env — then fill in the two keys");
}

const openaiKey = process.env.OPENAI_API_KEY?.trim();
const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
const compatBaseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL?.trim();
const routing = (process.env.MODEL_ROUTING ?? "").trim().toLowerCase();

if (routing && routing !== "openai" && routing !== "gateway" && routing !== "openai-compatible") {
  bad(`MODEL_ROUTING="${routing}" isn't valid`, "Use openai, gateway, openai-compatible, or leave it blank");
} else if (routing === "openai-compatible" || (!routing && compatBaseUrl)) {
  if (compatBaseUrl) {
    ok(`OPENAI_COMPATIBLE_BASE_URL is set — model runs against ${compatBaseUrl}`);
  } else {
    bad("MODEL_ROUTING=openai-compatible but OPENAI_COMPATIBLE_BASE_URL is empty", "Add the base URL in .env");
  }
} else if (routing === "gateway" || (!routing && gatewayKey)) {
  if (gatewayKey) {
    ok("AI_GATEWAY_API_KEY is set — the model runs through Vercel AI Gateway");
  } else {
    bad("MODEL_ROUTING=gateway but AI_GATEWAY_API_KEY is empty", "Add the key, or switch to OPENAI_API_KEY");
  }
} else if (openaiKey) {
  if (openaiKey.startsWith("sk-")) {
    ok("OPENAI_API_KEY is set — the model runs against OpenAI directly");
  } else {
    bad("OPENAI_API_KEY doesn't look right (keys start with sk-)", "Copy it again from https://platform.openai.com/api-keys");
  }
} else {
  bad("No model key found", "Set OPENAI_API_KEY (or AI_GATEWAY_API_KEY) in .env");
}

const mode = (process.env.MEMORY_MODE ?? "off").trim().toLowerCase();
const modes = {
  provider: "createNamsProvider() wrapping the model provider (agent/lib/model.ts)",
  middleware: "createNams().wrap() around one model instance (agent/lib/model.ts)",
  tools: "createNamsMemoryTools() — query_memory / store_memory the model calls itself (agent/tools/memory.ts)",
  hooks: "eve hooks + dynamic instructions — the runtime recalls and stores every turn (agent/hooks/)",
  off: "no memory at all — the 'before' picture",
};

if (!(mode in modes)) {
  bad(`MEMORY_MODE="${mode}" isn't valid`, "Use one of: provider, middleware, tools, hooks, off");
} else {
  ok(`MEMORY_MODE=${mode} — ${modes[mode]}`);
}

const endpoint = process.env.MEMORY_ENDPOINT?.trim();
const memoryKey = process.env.MEMORY_API_KEY?.trim();

if (mode === "off") {
  note("MEMORY_API_KEY not checked — MEMORY_MODE=off doesn't use it");
} else if (!memoryKey) {
  bad("MEMORY_API_KEY is empty", "Sign up free at https://memory.neo4jlabs.com and create a key");
} else if (!memoryKey.startsWith("nams_")) {
  bad("MEMORY_API_KEY doesn't look right (keys start with nams_)", "Copy it again from https://memory.neo4jlabs.com");
} else {
  ok("MEMORY_API_KEY is set");
}

// Endpoints live in .env now, not in the code, so a blank one is a real fault.
if (mode === "off") {
  note("MEMORY_ENDPOINT not checked — MEMORY_MODE=off doesn't call it");
} else if (endpoint) {
  ok(`MEMORY_ENDPOINT=${endpoint}`);
} else {
  bad("MEMORY_ENDPOINT is empty", "Copy the value from .env.example into .env");
}

const user = process.env.WORKSPACE_ID?.trim();
if (mode === "off") {
  note("WORKSPACE_ID not checked — MEMORY_MODE=off stores nothing");
} else if (user) {
  ok(`Memories will be filed under workspace id "${user}"`);
} else {
  bad("WORKSPACE_ID is empty", "Put your own name in .env so you get your own memory");
}

// ── Graph endpoints ────────────────────────────────────────────────────────
const boltUri = process.env.NEO4J_URI?.trim();
if (boltUri) {
  ok(`NEO4J_URI=${boltUri} — search_news and get_investments read this graph`);
} else {
  bad("NEO4J_URI is empty", "Copy the value from .env.example into .env");
}

for (const [key, label] of [
  ["NEO4J_USERNAME", "graph login"],
  ["NEO4J_PASSWORD", "graph password"],
  ["NEO4J_DATABASE", "graph database"],
]) {
  if (!process.env[key]?.trim()) bad(`${key} is empty (${label})`, "Copy it from .env.example into .env");
}

const mcpUrl = process.env.MCP_URL?.trim();
if (mcpUrl) {
  ok(`MCP_URL=${mcpUrl}`);
} else {
  note("MCP_URL is empty — the graph MCP tools are off (that is a valid setup)");
}

const investmentsUrl = process.env.INVESTMENTS_MCP_URL?.trim();
if (investmentsUrl) {
  ok(`INVESTMENTS_MCP_URL=${investmentsUrl} — start it with: npm run mcp`);
} else {
  note("INVESTMENTS_MCP_URL is empty — the get_investments tool is off");
}

if (failures === 0) {
  console.log("\n  \x1b[32mAll good.\x1b[0m Next: \x1b[1mnpm run dev\x1b[0m\n");
} else {
  console.log(`\n  \x1b[31m${failures} thing${failures === 1 ? "" : "s"} to fix.\x1b[0m See the arrows above.\n`);
  process.exit(1);
}

function loadEnv(file) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.replace(/\r$/, "").match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value) process.env[match[1]] ??= value;
  }
}
