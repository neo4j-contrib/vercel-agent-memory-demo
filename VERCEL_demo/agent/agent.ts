import { defineAgent } from "eve";
import { CONTEXT_WINDOW_TOKENS, resolveModel } from "./lib/model";

export default defineAgent({
  model: resolveModel(),
  modelContextWindowTokens: CONTEXT_WINDOW_TOKENS,
});
