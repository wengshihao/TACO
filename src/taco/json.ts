export function parseLlmJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate as string);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error("The LLM response did not contain valid JSON.");
}

export function score(value: unknown): 0 | 1 | 2 | 3 {
  const n = Number.parseInt(String(value ?? 0), 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(3, n)) as 0 | 1 | 2 | 3;
}
