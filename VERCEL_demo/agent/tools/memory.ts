import { defineDynamic, defineTool } from "eve/tools";
import { createNamsMemoryTools } from "@neo4j-labs/nams-ai-provider";
import { z } from "zod";
import { memoryMode, namsConfig, namsScope } from "../lib/nams";

const querySchema = z.object({
  query: z.string().describe("Keywords or phrase to search in memory"),
  limit: z.number().int().min(1).max(20).default(5),
});

const storeSchema = z.object({
  content: z.string().min(1).max(2000).describe("The information to remember"),
  type: z
    .enum(["fact", "interaction", "pattern", "user_preference"])
    .describe(
      "fact=persistent knowledge | interaction=conversation event | " +
        "pattern=recurring behaviour | user_preference=explicit setting",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .default(0.7)
    .describe("Confidence 0-1: 0.8-1.0 very high · 0.6-0.8 high · 0.3-0.6 medium · 0-0.3 low"),
  tags: z.array(z.string().max(40)).max(10).default([]),
});

let cached: ReturnType<typeof createNamsMemoryTools> | undefined;

function namsMemoryTools() {
  cached ??= createNamsMemoryTools({ ...namsConfig(), ...namsScope() });
  return cached;
}

export default defineDynamic({
  events: {
    "session.started": () => {
      if (memoryMode() !== "tools") return null;

      return {
        query_memory: defineTool({
          description:
            "Search NAMS (Neo4j Agent Memory System) for context relevant to the " +
            "current message. Call this before answering, every turn.",
          inputSchema: querySchema,
          execute: (input) =>
            namsMemoryTools().query_memory.execute!(input, {
              toolCallId: "query_memory",
              messages: [],
              context: {},
            }),
        }),

        store_memory: defineTool({
          description:
            "Persist important information to NAMS (Neo4j graph). Call this BEFORE " +
            "giving your final answer whenever the conversation contains facts, " +
            "preferences, or patterns worth remembering. Store only NEW information " +
            "the user supplied in this conversation. Never store what query_memory " +
            "returned — that is already stored, and re-storing it degrades recall.",
          inputSchema: storeSchema,
          execute: (input) =>
            namsMemoryTools().store_memory.execute!(input, {
              toolCallId: "store_memory",
              messages: [],
              context: {},
            }),
        }),
      };
    },
  },
});
