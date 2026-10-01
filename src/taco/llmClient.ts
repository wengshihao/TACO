import { SYSTEM } from "./prompts";
import type { LlmConfig, Usage } from "./types";

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

interface CompleteOptions {
  signal?: AbortSignal;
  usage?: Usage;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function messageText(content: unknown): string | null {
  if (typeof content === "string") return content;
  // Some OpenAI-compatible providers return content as an array of typed parts.
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
      .join("");
  }
  return null;
}

async function post(config: LlmConfig, body: Record<string, unknown>, signal?: AbortSignal) {
  const base = config.baseUrl.trim().replace(/\/$/, "");
  const path = config.apiPath.startsWith("/") ? config.apiPath : `/${config.apiPath}`;
  if (config.useLocalProxy) {
    return fetch("/api/llm-proxy", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: base, apiPath: path, apiKey: config.apiKey, requestBody: body }),
    });
  }
  return fetch(`${base}${path}`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey.trim()}` },
    body: JSON.stringify(body),
  });
}

export async function complete(config: LlmConfig, prompt: string, options: CompleteOptions = {}): Promise<string> {
  const { signal, usage } = options;
  const body: Record<string, unknown> = {
    model: config.model.trim(),
    temperature: config.temperature,
    max_tokens: config.maxTokens || undefined,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
  };

  let adapted = false;
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await post(config, body, signal);
    } catch (error) {
      if (signal?.aborted || attempt >= MAX_RETRIES) {
        if (signal?.aborted) throw error;
        throw new Error(
          `Could not reach the LLM endpoint (${error instanceof Error ? error.message : String(error)}). ` +
            "This is usually CORS: the provider does not accept browser requests.",
        );
      }
      await sleep(1200 * (attempt + 1), signal);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      // Reasoning models reject `max_tokens` / `temperature`; adapt the request once and retry.
      if (response.status === 400 && !adapted && /max_tokens|temperature/i.test(text)) {
        adapted = true;
        if (/max_tokens/i.test(text) && body.max_tokens) {
          body.max_completion_tokens = body.max_tokens;
          delete body.max_tokens;
        }
        if (/temperature/i.test(text)) delete body.temperature;
        continue;
      }
      if (RETRYABLE.has(response.status) && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * 2 ** attempt, signal);
        continue;
      }
      if (config.useLocalProxy && response.status === 502) {
        let reason = text;
        try {
          reason = JSON.parse(text).error ?? text;
        } catch {
          // Upstream returned a non-JSON 502; show it as-is.
        }
        throw new Error(`The local proxy could not reach ${config.baseUrl.trim()}: ${String(reason).slice(0, 300)}`);
      }
      throw new Error(`LLM request failed (${response.status}). ${text.slice(0, 900)}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (config.useLocalProxy && !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(
        `Local proxy is not available at /api/llm-proxy. Start the app with npm run local and open http://127.0.0.1:4173/TACO/. Response began with: ${text.slice(0, 120)}`,
      );
    }

    const data = await response.json();
    if (usage) {
      usage.calls += 1;
      usage.promptTokens += Number(data?.usage?.prompt_tokens) || 0;
      usage.completionTokens += Number(data?.usage?.completion_tokens) || 0;
    }
    const content = messageText(data?.choices?.[0]?.message?.content);
    if (content === null) {
      throw new Error("LLM response did not match the OpenAI-compatible chat completions format.");
    }
    return content;
  }
}
