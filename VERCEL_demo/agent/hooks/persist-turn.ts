import { defineState } from "eve/context";
import { defineHook } from "eve/hooks";
import { memory } from "../lib/memory-gateway";
import { memoryMode } from "../lib/nams";

interface PendingTurn {
  readonly user: string | null;
  readonly assistant: string | null;
}

const EMPTY: PendingTurn = { user: null, assistant: null };

const pendingTurn = defineState<PendingTurn>("nams.pending-turn", () => EMPTY);

export default defineHook({
  events: {
    "message.received"(event) {
      if (memoryMode() !== "hooks") return;
      const user = event.data.message?.trim();
      if (user) pendingTurn.update((s) => ({ ...s, user }));
    },

    "message.completed"(event) {
      if (memoryMode() !== "hooks") return;
      const assistant = event.data.message?.trim();
      if (assistant) pendingTurn.update((s) => ({ ...s, assistant }));
    },

    async "turn.completed"() {
      if (memoryMode() !== "hooks") return;

      const { user, assistant } = pendingTurn.get();
      pendingTurn.update(() => EMPTY);
      if (!user) return;

      const content = assistant
        ? `User said: ${truncate(user)}\nAgent answered: ${truncate(assistant)}`
        : `User said: ${truncate(user)}`;

      try {
        await memory.remember({ content, type: "interaction" });
      } catch (error) {
        console.warn("[nams] failed to persist turn", error);
      }

      if (!assistant || !isPromotable(user)) return;

      try {
        await memory.remember({ content, type: "fact" });
      } catch (error) {
        console.warn("[nams] failed to promote turn to the entity graph", error);
      }
    },
  },
});

function truncate(text: string, max = 1200): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function isPromotable(user: string): boolean {
  return !user.startsWith("/");
}
