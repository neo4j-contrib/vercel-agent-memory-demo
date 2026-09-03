#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { MemoryClient } from "@neo4j-labs/agent-memory";

loadEnv(".env");

const userId = process.env.WORKSPACE_ID?.trim();

const memory = new MemoryClient({
  endpoint: process.env.MEMORY_ENDPOINT,
  apiKey: process.env.MEMORY_API_KEY,
});

console.log(`\n  Memory for: ${userId}\n`);

try {

  const existing = await memory.shortTerm.listConversations({ userId, limit: 1 });
  const conversation = existing[0] ?? (await memory.shortTerm.createConversation({ userId }));
  console.log(`  1. Conversation ${conversation.id}`);
  console.log(`     ${existing.length > 0 ? "reused an existing one" : "created a new one"}`);

  if (existing.length === 0) {
    await memory.shortTerm.bulkAddMessages(conversation.id, [
      { role: "user", content: "I'm building a robotics club project at my college with my friend Aditya." },
      { role: "assistant", content: "A robotics club project with Aditya — noted. What are you building?" },
    ]);
    console.log("  2. Stored two messages");
  } else {
    console.log("  2. Reused the existing messages");
  }

  const entity = await memory.longTerm.addEntity("Aditya", "person", {
    description: `A friend of ${userId}, working with them on a college robotics project.`,
  });
  console.log(`  3. Stored entity "${entity.name}" (${entity.type})`);

  const found = await memory.longTerm.searchEntities("robotics project", { limit: 5 });
  console.log(`  4. Searched "robotics project" → ${found.length} result(s)`);
  for (const e of found) {
    console.log(`     • ${e.name} (${e.type})${e.description ? ` — ${e.description}` : ""}`);
  }

  const context = await memory.shortTerm.getContext(conversation.id);
  console.log("  5. Three-tier context:");
  console.log(`     reflections    ${context.reflections.length}  (insights drawn over time)`);
  console.log(`     observations   ${context.observations.length}  (compressed summaries)`);
  console.log(`     recentMessages ${context.recentMessages.length}  (the literal last turns)`);

  console.log(`
  Entity extraction runs in the background, so reflections and
  observations fill in over the next minute or two. Run this again
  and watch the numbers change.

  See the graph itself: https://memory.neo4jlabs.com
  Next: npm run dev
`);
} catch (error) {

  const message = String(error?.message ?? error);
  console.error(`\n  \x1b[31mThat didn't work.\x1b[0m ${message}\n`);

  if (/401|403|[Aa]uthentication/.test(message)) {
    console.error("  Your MEMORY_API_KEY is wrong, expired, or has a stray space.");
    console.error("  Get a fresh one at https://memory.neo4jlabs.com and put it in .env.\n");
  } else if (/fetch|ENOTFOUND|ECONNREFUSED|timeout/i.test(message)) {
    console.error("  Couldn't reach the memory service. Check your internet — campus");
    console.error("  networks sometimes block it. A phone hotspot is a good test.\n");
  }

  console.error("  Run \x1b[1mnpm run check\x1b[0m to see exactly what's wrong.\n");
  process.exit(1);
}

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (value) process.env[match[1]] ??= value;
    }
  } catch {
    console.error("\n  Couldn't read .env. Run `cp .env.example .env` first.\n");
    process.exit(1);
  }
}
