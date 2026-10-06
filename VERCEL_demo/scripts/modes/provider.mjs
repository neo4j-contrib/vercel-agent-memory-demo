#!/usr/bin/env node

import "../nams-threshold-fix.mjs";
import { readFileSync } from "node:fs";
import { generateText, gateway } from "ai";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createNamsProvider } from "@neo4j-labs/nams-ai-provider";

function loadEnv(file = ".env") {
  try {
    for (const raw of readFileSync(file, "utf8").split("\n")) {
      const m = raw.replace(/\r$/, "").match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (value) process.env[m[1]] ??= value;
    }
  } catch {
    console.error("\n  No .env found. Run:  cp .env.example .env\n");
    process.exit(1);
  }
}

const MODEL_ID = process.env.AGENT_MODEL?.trim() || "openai/gpt-5.4-mini";

function baseModel(id = MODEL_ID) {
  const route = (process.env.MODEL_ROUTING || "").trim().toLowerCase();
  const compatUrl = process.env.OPENAI_COMPATIBLE_BASE_URL?.trim();
  const compatKey = process.env.OPENAI_COMPATIBLE_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const bare = id.replace(/^openai\//, "");

  if ((route === "openai-compatible" || compatUrl) && compatUrl && compatKey) {
    return createOpenAI({ baseURL: compatUrl, apiKey: compatKey })(id);
  }
  if (route === "gateway" && gatewayKey) return gateway(id);
  if (openaiKey) return openai(bare);
  if (gatewayKey) return gateway(id);
  throw new Error("No usable model key. Set OPENAI_API_KEY in .env");
}

function namsCreds() {
  const apiKey = process.env.MEMORY_API_KEY?.trim();
  if (!apiKey) {
    console.error("\n  MEMORY_API_KEY is not set. Get one free at https://memory.neo4jlabs.com\n");
    process.exit(1);
  }
  const endpoint = process.env.MEMORY_ENDPOINT?.trim();
  if (!endpoint) {
    console.error("\n  MEMORY_ENDPOINT is not set. Copy it from .env.example into .env\n");
    process.exit(1);
  }
  return { apiKey, endpoint };
}

const scope = () => ({ userId: process.env.WORKSPACE_ID?.trim() || "workshop-student" });

const FACT = process.argv[2] || "Hi! I'm Ananya, I'm doing my final year project on drone navigation with my friend Rohit.";
const QUESTION = process.argv[3] || "What am I working on, and who with?";
const SYSTEM = "You are a friendly assistant whose memory survives between conversations. Answer in two or three sentences. If you don't know something, say so - never invent a memory.";

function memoryToolCalls(steps = []) {
  const names = [];
  for (const s of steps ?? []) for (const c of s.toolCalls ?? [])
    if (String(c.toolName ?? "").toLowerCase().includes("memory")) names.push(c.toolName);
  return names;
}

loadEnv();
console.log(`\n  MEMORY_MODE = provider   ·   memory for: ${scope().userId}`);
console.log("  createNamsProvider() wraps the provider. Memory is automatic and invisible.\n");

const provider = createNamsProvider({
  ...namsCreds(),
  baseProvider: (id) => baseModel(id),
  scope: scope(),
});
const model = provider.languageModel(MODEL_ID);

console.log(`  1. Conversation A - user says:\n     "${FACT}"`);
const a = await generateText({ model, system: SYSTEM, messages: [{ role: "user", content: FACT }] });
console.log(`     agent: ${a.text}\n`);

console.log(`  2. Conversation B (brand new) - user asks:\n     "${QUESTION}"`);
const b = await generateText({ model, system: SYSTEM, messages: [{ role: "user", content: QUESTION }] });
console.log(`     agent: ${b.text}\n`);

console.log(`  3. memory tool calls in Conversation B: ${memoryToolCalls(b.steps).length}  (zero - the wrapper did the work, not the model)`);
console.log(`
  WHAT TO NOTICE
  Conversation B knows - even though the model was never handed a memory
  tool. The provider retrieved context before the model ran and saved the
  turn after. Deeper recall (people, projects, insights) keeps filling in
  for a minute or two; run this again to watch it grow.
  See the nodes: https://memory.neo4jlabs.com
`);
