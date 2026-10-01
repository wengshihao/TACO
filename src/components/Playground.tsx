import { ChevronDown, CornerDownLeft, Eraser, Play, Settings2, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateTaco } from "../taco/engine";
import type { LlmConfig, StepEvent, TacoLanguage, TacoResult } from "../taco/types";
import { idleSteps, Pipeline, type Steps } from "./Pipeline";
import { Report, type HumanLabel } from "./Report";
import { Segmented, storage } from "./ui";

interface Example {
  id: string;
  language: TacoLanguage;
  title: string;
  question: string;
  answer: string;
  source?: string;
  model?: string | null;
  label?: HumanLabel;
}

const toyExamples: Example[] = [
  {
    id: "toy-python",
    language: "python",
    title: "TypeError adding int to str",
    source: "Toy",
    question: `Why do I get a TypeError when trying to add an integer to a string? How can I fix it?

\`\`\`python
num = 10
text = " apples"
result = num + text
\`\`\``,
    answer: `Converting the integer to a string before concatenation can resolve this issue.

\`\`\`python
result = str(num) + text
\`\`\``,
  },
  {
    id: "toy-java",
    language: "java",
    title: "Incompatible types: String to int",
    source: "Toy",
    question: `Why do I get an incompatible types error when assigning an integer/string concatenation to an int? How can I fix it?

\`\`\`java
int num = 10;
String text = " apples";
int result = num + text;
\`\`\``,
    answer: `Use a String result and concatenate after converting the integer to a string.

\`\`\`java
int num = 10;
String text = " apples";
String result = Integer.toString(num) + text;
\`\`\``,
  },
];

const providers = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  { id: "ollama", name: "Ollama", baseUrl: "http://localhost:11434/v1", model: "qwen2.5-coder:7b" },
];

type StoredConfig = Omit<LlmConfig, "apiKey"> & { maxRecompletion: number; proxyChosen?: boolean };

const defaults: StoredConfig = {
  baseUrl: providers[0].baseUrl,
  apiPath: "/chat/completions",
  model: providers[0].model,
  temperature: 0,
  maxTokens: 4096,
  useLocalProxy: false,
  maxRecompletion: 2,
};

function loadConfig(): StoredConfig {
  try {
    return { ...defaults, ...JSON.parse(storage.get("taco:config") ?? "{}"), temperature: 0 };
  } catch {
    return defaults;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url || "—";
  }
}

function ExamplesMenu({ examples, onPick }: { examples: Example[]; onPick: (example: Example) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const groups: Array<[string, Example[]]> = [
    ["Quick start", examples.filter((example) => example.source === "Toy")],
    ["TACO-Judge · Python", examples.filter((example) => example.source === "TACO-Judge")],
    ["TACO-Judge · Java", examples.filter((example) => example.source === "TACO-Judge-Java")],
  ];

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="tool-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        Examples <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {groups
            .filter(([, items]) => items.length)
            .map(([name, items]) => (
              <div className="menu-group" key={name}>
                <div className="menu-label">{name}</div>
                {items.map((example) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={example.id}
                    onClick={() => {
                      onPick(example);
                      setOpen(false);
                    }}
                  >
                    <span className="menu-title">{example.title}</span>
                    <span className="menu-sub">
                      {example.label && <span className={`dot ${example.label}`} />}
                      {example.label ?? (example.language === "java" ? "Java" : "Python")}
                      {example.model ? ` · ${example.model}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          <p className="menu-foot">Labels are human annotations from the TACO-Judge benchmarks.</p>
        </div>
      )}
    </div>
  );
}

function Editor({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="editor">
      <div className="editor-head">
        <label>
          {label} <span className="muted">· {hint}</span>
        </label>
        <span className="editor-tools">
          <span className="muted">{value.length.toLocaleString()} chars</span>
          <button type="button" className="ghost-btn" aria-label={`Clear ${label}`} onClick={() => onChange("")}>
            <Eraser size={14} />
          </button>
        </span>
      </div>
      <textarea spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    </div>
  );
}

export function Playground() {
  const [config, setConfig] = useState<StoredConfig>(loadConfig);
  const [remember, setRemember] = useState(() => storage.get("taco:key") !== null);
  const [apiKey, setApiKey] = useState(() => storage.get("taco:key") ?? storage.get("taco:key", "session") ?? "");
  const [proxyAvailable, setProxyAvailable] = useState(false);
  const [showSettings, setShowSettings] = useState(() => !apiKey);

  const [language, setLanguage] = useState<TacoLanguage>("python");
  const [question, setQuestion] = useState(toyExamples[0].question);
  const [answer, setAnswer] = useState(toyExamples[0].answer);
  const [label, setLabel] = useState<HumanLabel | null>(null);
  const [examples, setExamples] = useState<Example[]>(toyExamples);

  const [steps, setSteps] = useState<Steps>(idleSteps);
  const [result, setResult] = useState<TacoResult | null>(null);
  const [resultLabel, setResultLabel] = useState<HumanLabel | null>(null);
  const [alpha, setAlpha] = useState(0.5);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    storage.set("taco:config", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    storage.set("taco:key", remember && apiKey ? apiKey : null);
    storage.set("taco:key", !remember && apiKey ? apiKey : null, "session");
  }, [apiKey, remember]);

  useEffect(() => {
    fetch("./samples.json")
      .then((response) => (response.ok ? response.json() : []))
      .then((samples: Example[]) => setExamples([...toyExamples, ...samples.map((sample) => ({ ...sample, model: sample.model ?? null }))]))
      .catch(() => undefined);
    // The local server (npm run local) exposes a CORS-free proxy; detect it once.
    fetch("/api/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.ok) return;
        setProxyAvailable(true);
        // Default to the proxy unless the user has explicitly turned it off before.
        setConfig((current) => (current.proxyChosen ? current : { ...current, useLocalProxy: true }));
      })
      .catch(() => undefined);
  }, []);

  const useProxy = proxyAvailable && config.useLocalProxy;
  const canRun = Boolean(apiKey.trim() && config.baseUrl.trim() && config.model.trim() && question.trim() && answer.trim());
  const provider = providers.find((item) => item.baseUrl === config.baseUrl.trim().replace(/\/$/, ""));

  const pickExample = (example: Example) => {
    setLanguage(example.language);
    setQuestion(example.question);
    setAnswer(example.answer);
    setLabel(example.label ?? null);
  };

  const run = useCallback(async () => {
    if (running) {
      controllerRef.current?.abort(new DOMException("Stopped by user", "AbortError"));
      return;
    }
    if (!canRun) {
      if (!apiKey.trim()) setShowSettings(true);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setShowSettings(false);
    setError("");
    setResult(null);
    setSteps(idleSteps());
    const runLabel = label;
    try {
      const next = await evaluateTaco({
        config: { ...config, apiKey, useLocalProxy: useProxy },
        question,
        answer,
        alpha,
        language,
        maxRecompletion: config.maxRecompletion,
        signal: controller.signal,
        onEvent: ({ step, ...patch }: StepEvent) => setSteps((current) => ({ ...current, [step]: { ...current[step], ...patch } })),
      });
      setResult(next);
      setResultLabel(runLabel);
    } catch (err) {
      const stopped = controller.signal.aborted && (err as Error)?.name === "AbortError";
      setSteps((current) =>
        Object.fromEntries(
          Object.entries(current).map(([id, step]) => [
            id,
            step.status === "running" ? { ...step, status: stopped ? "idle" : "failed", endedAt: performance.now() } : step,
          ]),
        ) as Steps,
      );
      if (!stopped) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      controllerRef.current = null;
    }
  }, [running, canRun, apiKey, config, useProxy, question, answer, alpha, language, label]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const corsLike = /CORS|Failed to fetch|NetworkError|reach the LLM endpoint/i.test(error);
  const isMac = useMemo(() => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), []);

  return (
    <div className="playground">
      <div className="pg-input">
        <div className="toolbar">
          <Segmented
            label="Language"
            value={language}
            onChange={(next) => {
              const current = toyExamples.find((example) => example.language === language);
              // Swap in the other toy example only when the user has not edited this one.
              if (current && question === current.question && answer === current.answer) {
                pickExample(toyExamples.find((example) => example.language === next)!);
              } else {
                setLanguage(next);
              }
            }}
            options={[
              { value: "python", label: "Python" },
              { value: "java", label: "Java" },
            ]}
          />
          <ExamplesMenu examples={examples} onPick={pickExample} />
          <span className="spacer" />
          <button type="button" className={showSettings ? "conn on" : "conn"} onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}>
            <span className={apiKey ? "status-dot ready" : "status-dot"} />
            <span className="conn-model">{config.model || "no model"}</span>
            <span className="conn-host">{useProxy ? "via local proxy" : hostOf(config.baseUrl)}</span>
            <Settings2 size={14} />
          </button>
        </div>

        {showSettings && (
          <div className="settings">
            <div className="field full">
              <span className="field-label">Provider</span>
              <div className="chips">
                {providers.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={provider?.id === item.id ? "chip-btn on" : "chip-btn"}
                    onClick={() => setConfig({ ...config, baseUrl: item.baseUrl, model: item.model })}
                  >
                    {item.name}
                  </button>
                ))}
                <span className={provider ? "chip-btn ghost" : "chip-btn on ghost"}>Custom</span>
              </div>
            </div>
            <label className="field full">
              <span className="field-label">API key</span>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                placeholder="sk-…"
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Base URL</span>
              <input value={config.baseUrl} onChange={(event) => setConfig({ ...config, baseUrl: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Model</span>
              <input value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">API path</span>
              <input value={config.apiPath} onChange={(event) => setConfig({ ...config, apiPath: event.target.value })} />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Max tokens</span>
                <input
                  type="number"
                  min="256"
                  step="256"
                  value={config.maxTokens ?? ""}
                  onChange={(event) => setConfig({ ...config, maxTokens: Number(event.target.value) || undefined })}
                />
              </label>
              <label className="field">
                <span className="field-label">Re-completions</span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={config.maxRecompletion}
                  onChange={(event) => setConfig({ ...config, maxRecompletion: Math.max(0, Math.min(5, Number(event.target.value) || 0)) })}
                />
              </label>
            </div>
            <div className="toggles full">
              <label className="toggle">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>Remember key on this device</span>
              </label>
              <label className={proxyAvailable ? "toggle" : "toggle disabled"} title={proxyAvailable ? "" : "Available when served by npm run local"}>
                <input
                  type="checkbox"
                  disabled={!proxyAvailable}
                  checked={useProxy}
                  onChange={(event) => setConfig({ ...config, useLocalProxy: event.target.checked, proxyChosen: true })}
                />
                <span>Route through local proxy {!proxyAvailable && <span className="muted">(npm run local)</span>}</span>
              </label>
            </div>
            <p className="fine full">
              Requests go straight from this browser to {useProxy ? "your local proxy" : hostOf(config.baseUrl)}. Nothing is sent to us, and the key is kept{" "}
              {remember ? "in this browser's local storage" : "only for this tab session"}.
            </p>
          </div>
        )}

        <Editor
          label="Question"
          hint="what the developer asked"
          value={question}
          onChange={(value) => {
            setQuestion(value);
            setLabel(null);
          }}
        />
        <Editor
          label="LLM answer"
          hint="the response to assess"
          value={answer}
          onChange={(value) => {
            setAnswer(value);
            setLabel(null);
          }}
        />

        <div className="run-row">
          <button type="button" className={running ? "run stop" : "run"} disabled={!running && !canRun && Boolean(apiKey)} onClick={() => void run()}>
            {running ? <Square size={15} /> : <Play size={15} />}
            {running ? "Stop" : apiKey ? "Assess trust" : "Add an API key to run"}
            {!running && apiKey && (
              <kbd>
                {isMac ? "⌘" : "Ctrl"}
                <CornerDownLeft size={12} />
              </kbd>
            )}
          </button>
          <p className="fine">
            {config.maxRecompletion > 0 ? `5–${5 + 3 * config.maxRecompletion}` : "5"} LLM calls with <span className="mono">{config.model || "…"}</span>
          </p>
        </div>
      </div>

      <div className="pg-output">
        {result ? (
          <>
            <Report result={result} alpha={alpha} onAlpha={setAlpha} label={resultLabel} />
            <details className="timeline">
              <summary>Run timeline</summary>
              <Pipeline steps={steps} />
            </details>
          </>
        ) : (
          <>
            <Pipeline steps={steps} />
            {error ? (
              <div className="error-box" role="alert">
                <strong>Run failed</strong>
                <pre>{error}</pre>
                {corsLike && !useProxy && (
                  <p>
                    The provider likely blocks browser requests (CORS). Run TACO locally with <code>npm run local</code> and enable the local proxy, or
                    use the CLI.
                  </p>
                )}
              </div>
            ) : (
              <div className={running ? "placeholder busy" : "placeholder"}>
                <div className="ph-verdict">
                  <span className="eyebrow">Verdict</span>
                  <span className="ph-word">{running ? "Assessing…" : "Trustworthy / Untrustworthy"}</span>
                </div>
                <div className="ph-grid">
                  <div>
                    <span className="math">C</span> code quality
                  </div>
                  <div>
                    <span className="math">A</span> intent alignment
                  </div>
                  <div>
                    <span className="math">S</span> overall score
                  </div>
                </div>
                {!running && <p className="fine">TACO needs no reference answer. It checks the answer against the question alone, by executing it virtually.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
