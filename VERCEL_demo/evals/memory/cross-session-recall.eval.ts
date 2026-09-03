import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

/**
 * The check that separates memory from conversation history: a fact stated in
 * one session has to survive into a different session. `t.newSession()` starts
 * a fresh transcript, so anything recalled afterwards came out of NAMS.
 *
 * The fact is deliberately an odd, rare word. NAMS retrieval is lexical, and a
 * workshop workspace fills up with near-identical turns ("what is my final year
 * project?") that a generic phrase competes with.
 */
const CODENAME = "Halyard";

export default defineEval({
  description: "A fact stored in one session is recalled in a fresh session.",
  tags: ["memory"],
  async test(t) {
    const mode = process.env.MEMORY_MODE?.trim().toLowerCase() || "off";
    if (mode === "off") {
      t.skip("MEMORY_MODE=off stores nothing — set provider, middleware, tools or hooks.");
    }

    await t.send(`Remember this about me: my project codename is ${CODENAME}.`);
    t.succeeded();

    const fresh = t.newSession();
    const turn = await fresh.send("What is my project codename?");
    turn.expectOk();

    t.check(turn.message, includes(new RegExp(CODENAME, "i")));
  },
});
