import {
  findExistingConversation,
  resolveConversation,
  retrieveMemories,
  storeMemory,
} from "@neo4j-labs/nams-ai-provider";
import {
  MAX_MEMORIES,
  namsClient,
  namsConfig,
  namsScope,
  type MemoryHit,
  type ReasoningStepInput,
  type StoreMemoryInput,
} from "./nams";

let conversation: string | undefined;

async function conversationId(): Promise<string> {
  conversation ??= await resolveConversation(namsClient(), namsConfig(), namsScope());
  return conversation;
}

function isMissingConversation(error: unknown): boolean {
  const failure = error as { statusCode?: number; message?: string } | undefined;
  if (!failure) return false;
  return /conversation not found/i.test(failure.message ?? "") || failure.statusCode === 404;
}

async function freshConversation(): Promise<string> {
  const created = await namsClient().shortTerm.createConversation({
    userId: namsScope().userId,
  });
  conversation = created.id;
  return resolveConversation(namsClient(), namsConfig(), {
    ...namsScope(),
    conversationId: created.id,
  });
}

async function withConversation<T>(run: (id: string) => Promise<T>): Promise<T> {
  try {
    return await run(await conversationId());
  } catch (error) {
    if (!isMissingConversation(error)) throw error;
    console.warn("[nams] conversation is gone - starting a new one and retrying");
    return run(await freshConversation());
  }
}

export const memory = {
  async recall(query: string, limit = MAX_MEMORIES): Promise<MemoryHit[]> {
    return withConversation((id) => retrieveMemories(namsClient(), namsScope(), id, query, limit));
  },

  async remember(input: StoreMemoryInput): Promise<void> {
    await withConversation((id) => storeMemory(namsClient(), id, input));
  },

  async rememberReasoning(steps: readonly ReasoningStepInput[]): Promise<void> {
    if (steps.length === 0) return;

    const client = namsClient();
    const existing =
      conversation ?? (await findExistingConversation(client, namsConfig(), namsScope()));
    if (!existing) return;

    try {
      for (const step of steps) {
        const recorded = await client.reasoning.recordStep({
          conversationId: existing,
          reasoning: step.reasoning,
          actionTaken: step.actionTaken,
          result: step.result,
        });

        for (const call of step.toolCalls ?? []) {
          await client.reasoning.recordToolCall(recorded.id, call.toolName, call.arguments, {
            result: call.result,
            status: call.failed ? "failure" : "success",
          });
        }
      }
    } catch (error) {
      if (isMissingConversation(error)) conversation = undefined;
      throw error;
    }
  },
};
