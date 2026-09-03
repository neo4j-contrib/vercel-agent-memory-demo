import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { createNams, createNamsProvider } from "@neo4j-labs/nams-ai-provider";
import { gateway } from "ai";
import { memoryMode, namsConfig, namsScope } from "./nams";

export const MODEL_ID = process.env.AGENT_MODEL?.trim() || "openai/gpt-5.4-mini";

export const CONTEXT_WINDOW_TOKENS = Number(
  process.env.AGENT_MODEL_CONTEXT_TOKENS?.trim() || 400_000,
);

function hasGatewayCredential(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL,
  );
}

export const MODEL_ROUTING: "gateway" | "openai" | "openai-compatible" = (() => {
  const explicit = process.env.MODEL_ROUTING?.trim().toLowerCase();
  if (explicit === "gateway" || explicit === "openai" || explicit === "openai-compatible") return explicit;
  if (process.env.OPENAI_COMPATIBLE_BASE_URL?.trim()) return "openai-compatible";
  return process.env.OPENAI_API_KEY && !hasGatewayCredential() ? "openai" : "gateway";
})();

export function baseModel(id: string = MODEL_ID): LanguageModelV4 {
  if (MODEL_ROUTING === "openai") {
    return openai(id.replace(/^openai\//, "")) as LanguageModelV4;
  }
  if (MODEL_ROUTING === "openai-compatible") {
    const provider = createOpenAI({
      baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
      apiKey: process.env.OPENAI_COMPATIBLE_API_KEY || "not-needed",
    });
    return provider(id) as LanguageModelV4;
  }
  return gateway(id) as LanguageModelV4;
}

export function resolveModel(): LanguageModelV4 {
  const mode = memoryMode();
  const model = baseModel();

  if (mode === "provider") {
    return createNamsProvider({
      ...namsConfig(),
      baseProvider: (modelId: string) => baseModel(modelId),
      extractionModel: model,
      scope: namsScope(),
    }).languageModel(MODEL_ID) as LanguageModelV4;
  }

  if (mode === "middleware") {
    return createNams({ ...namsConfig(), extractionModel: model }).wrap(model, namsScope());
  }

  return model;
}
