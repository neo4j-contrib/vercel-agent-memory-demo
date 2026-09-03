import {
  defineDynamic,
  defineInstructions,
  type DynamicResolveContext,
} from "eve/instructions";
import { memory } from "../lib/memory-gateway";
import { MAX_MEMORIES, memoryMode, renderMemories } from "../lib/nams";

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      if (memoryMode() !== "hooks") return null;

      const query = latestUserText(ctx) ?? "user preferences, projects and interests";

      try {
        const memories = await memory.recall(query, MAX_MEMORIES);
        if (memories.length === 0) return null;
        return defineInstructions({ content: renderMemories(memories) });
      } catch (error) {
        console.warn("[nams] recall failed, continuing without memory", error);
        return null;
      }
    },
  },
});

function latestUserText(ctx: DynamicResolveContext): string | undefined {
  for (let i = ctx.messages.length - 1; i >= 0; i -= 1) {
    const message = ctx.messages[i];
    if (message?.role !== "user") continue;

    const text =
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join(" ");

    const trimmed = text.trim();
    if (trimmed) return trimmed.slice(0, 500);
  }
  return undefined;
}
