import { SYSTEM } from "./prompts";
import type { LlmConfig } from "./types";

export async function complete(config: LlmConfig, prompt: string): Promise<string> {
  const base = config.baseUrl.replace(/\/$/, "");
  const path = config.apiPath.startsWith("/") ? config.apiPath : `/${config.apiPath}`;
  const requestBody = {
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.maxTokens || undefined,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
  };

  const response = config.useLocalProxy
    ? await fetch("/api/llm-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseUrl: base,
          apiPath: path,
          apiKey: config.apiKey,
          requestBody,
        }),
      })
    : await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed (${response.status}). ${body.slice(0, 900)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (config.useLocalProxy && !contentType.includes("application/json")) {
    const body = await response.text();
    throw new Error(
      `Local proxy is not available at /api/llm-proxy. Start the app with npm run local and open http://127.0.0.1:4173/TACO/. Response began with: ${body.slice(0, 120)}`,
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("LLM response did not match OpenAI-compatible chat completions format.");
  }
  return content;
}
