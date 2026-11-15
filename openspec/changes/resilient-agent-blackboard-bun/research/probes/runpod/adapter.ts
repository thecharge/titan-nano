// How a titan model-API backend would reach a private RunPod serverless vLLM endpoint.
// Source O18: vLLM workers are OpenAI-compatible at https://api.runpod.ai/v2/<endpoint id>/openai/v1.
// Only type-checked; no live endpoint was called, because RUNPOD_API_KEY was not set.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type LanguageModel } from "ai";

export function runpodModel(endpointId: string, model: string): LanguageModel {
  const apiKey = process.env.RUNPOD_API_KEY; // read from the environment only, never stored
  if (!apiKey) throw new Error("RUNPOD_API_KEY is not set");
  const provider = createOpenAICompatible({ name: "runpod", apiKey, baseURL: `https://api.runpod.ai/v2/${endpointId}/openai/v1` });
  return provider(model);
}

// A run-wide deadline reaches the model call as an abort signal, so no call outlives the run.
export async function turn(endpointId: string, model: string, prompt: string, deadline: number) {
  return generateText({ model: runpodModel(endpointId, model), prompt, abortSignal: AbortSignal.timeout(Math.max(0, deadline - Date.now())) });
}
