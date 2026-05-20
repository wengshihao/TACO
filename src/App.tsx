import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Circle,
  KeyRound,
  LoaderCircle,
  Play,
  RotateCw,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { evaluateTaco } from "./taco/engine";
import type { LlmConfig, TacoLanguage, TacoResult } from "./taco/types";

const sampleQuestion = `Why do I get a TypeError when trying to add an integer to a string? How can I fix it?

\`\`\`python
num = 10
text = " apples"
result = num + text
\`\`\``;

const sampleAnswer = `Converting the integer to a string before concatenation can resolve this issue.

\`\`\`python
result = str(num) + text
\`\`\``;

const javaSampleQuestion = `Why do I get an incompatible types error when assigning an integer/string concatenation to an int? How can I fix it?

\`\`\`java
int num = 10;
String text = " apples";
int result = num + text;
\`\`\``;

const javaSampleAnswer = `Use a String result and concatenate after converting the integer to a string.

\`\`\`java
int num = 10;
String text = " apples";
String result = Integer.toString(num) + text;
\`\`\``;

function scoreLabel(score: number): string {
  return ["0 - critical", "1 - major issues", "2 - acceptable", "3 - optimal"][score] ?? "unknown";
}

const progressSteps = [
  {
    id: "convertor",
    title: "Convertor",
  },
  {
    id: "executor_question",
    title: "Question Trace",
  },
  {
    id: "executor_answer",
    title: "Answer Trace",
  },
  {
    id: "recompletion",
    title: "Re-completion",
  },
  {
    id: "codechecker",
    title: "Code Checker",
  },
  {
    id: "textchecker",
    title: "Text Checker",
  },
  {
    id: "done",
    title: "Output",
  },
] as const;

function stageBase(stage: string) {
  return stage.startsWith("recompletion_") ? "recompletion" : stage;
}

function stageLabel(stage: string) {
  if (stage.startsWith("recompletion_")) {
    return `Re-completion attempt ${stage.replace("recompletion_", "")}`;
  }
  return progressSteps.find((step) => step.id === stageBase(stage))?.title ?? "Idle";
}

function ProgressPanel({ stage, running, error }: { stage: string; running: boolean; error: string }) {
  const activeBase = stageBase(stage);
  const activeIndex = progressSteps.findIndex((step) => step.id === activeBase);
  const visibleIndex = activeIndex < 0 ? -1 : activeIndex;
  const progress =
    stage === "done"
      ? 100
      : visibleIndex < 0
        ? 0
        : Math.round((visibleIndex / (progressSteps.length - 1)) * 100);

  return (
    <section className={error ? "progress-panel failed" : "progress-panel"}>
      <div className="progress-head">
        <div>
          <span>TACO Pipeline</span>
          <strong>{error ? "Failed" : running ? stageLabel(stage) : stage === "done" ? "Done" : "Ready"}</strong>
        </div>
        <div className="progress-percent">{error ? "!" : `${progress}%`}</div>
      </div>
      <div className="progress-track" aria-label="TACO progress">
        <div style={{ width: `${progress}%` }} />
      </div>
      {error && <pre className="error">{error}</pre>}
    </section>
  );
}

function PipelineSteps({ stage, running, error }: { stage: string; running: boolean; error: string }) {
  const activeBase = stageBase(stage);
  const activeIndex = progressSteps.findIndex((step) => step.id === activeBase);
  const visibleIndex = activeIndex < 0 ? -1 : activeIndex;

  return (
    <section className="pipeline-panel">
      <ol className="pipeline">
        {progressSteps.map((step, index) => {
          const isActive = step.id === activeBase && running && !error;
          const isDone = stage === "done" || (visibleIndex > index && !error);
          const isSkipped = step.id === "recompletion" && visibleIndex > index && !stage.startsWith("recompletion_");
          const itemClass = [
            "pipeline-step",
            isActive ? "active" : "",
            isDone ? "done" : "",
            isSkipped ? "skipped" : "",
            error && step.id === activeBase ? "failed" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li className={itemClass} key={step.id}>
              <span className="step-icon">
                {error && step.id === activeBase ? (
                  <AlertCircle size={16} />
                ) : isActive ? (
                  <LoaderCircle size={16} />
                ) : isDone ? (
                  <CheckCircle2 size={16} />
                ) : step.id === "recompletion" ? (
                  <RotateCw size={16} />
                ) : (
                  <Circle size={16} />
                )}
              </span>
              <span>
                <strong>{step.title}</strong>
                {isSkipped && <small>skipped</small>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ResultPanel({ result }: { result: TacoResult | null }) {
  if (!result) {
    return (
      <section className="result-empty">
        <Activity size={28} />
        <p>Run TACO to inspect code quality, intent alignment, virtual execution traces, and the final trust indicator.</p>
      </section>
    );
  }

  return (
    <section className="results">
      <div className={result.reliability ? "verdict trust" : "verdict risk"}>
        {result.reliability ? <CheckCircle2 /> : <ShieldAlert />}
        <div>
          <span>{result.reliability ? "Trustworthy" : "Untrustworthy"}</span>
          <strong>Overall score {result.overallScore.toFixed(2)}</strong>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span>Code Quality</span>
          <strong>{result.codeQualityScore}</strong>
          <small>{scoreLabel(result.codeQualityScore)}</small>
        </div>
        <div className="metric">
          <span>Intent Alignment</span>
          <strong>{result.alignmentScore}</strong>
          <small>{scoreLabel(result.alignmentScore)}</small>
        </div>
        <div className="metric">
          <span>Alpha</span>
          <strong>{result.alpha.toFixed(2)}</strong>
          <small>S = alpha C + (1-alpha) A</small>
        </div>
      </div>

      <article className="analysis">
        <h2>Code Quality Analysis</h2>
        <p>{result.codeQualityAnalysis}</p>
      </article>
      <article className="analysis">
        <h2>Alignment Analysis</h2>
        <p>{result.alignmentAnalysis}</p>
      </article>
      <details>
        <summary>Completed Harnesses</summary>
        <pre>{result.intermediate.completion.questionCode}</pre>
        <pre>{result.intermediate.completion.answerCode}</pre>
      </details>
      <details>
        <summary>Virtual Execution Traces</summary>
        <pre>{result.intermediate.questionTrace.annotatedCode}</pre>
        <pre>{result.intermediate.answerTrace.annotatedCode}</pre>
      </details>
      <details>
        <summary>Raw JSON</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </section>
  );
}

export function App() {
  const isLocalHost =
    typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const [config, setConfig] = useState<LlmConfig>({
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    apiPath: "/chat/completions",
    model: "gpt-4o-mini",
    temperature: 0,
    maxTokens: 4096,
    useLocalProxy: false,
  });
  const [question, setQuestion] = useState(sampleQuestion);
  const [answer, setAnswer] = useState(sampleAnswer);
  const [language, setLanguage] = useState<TacoLanguage>("python");
  const [alpha, setAlpha] = useState(0.5);
  const [maxRecompletion, setMaxRecompletion] = useState(2);
  const [result, setResult] = useState<TacoResult | null>(null);
  const [stage, setStage] = useState("idle");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const canRun = useMemo(() => config.apiKey.trim() && config.baseUrl.trim() && config.model.trim(), [config]);

  async function run() {
    setError("");
    setRunning(true);
    setResult(null);
    setStage("convertor");
    try {
      const next = await evaluateTaco({
        config,
        question,
        answer,
        alpha,
        language,
        maxRecompletion,
        onStage: setStage,
      });
      setResult(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        `${message}\n\nIf this is a CORS error, run the local web server with npm run local and enable Local proxy.`,
      );
      setStage((currentStage) => (currentStage === "idle" ? "convertor" : currentStage));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>TACO</h1>
          <p>Trust Assessment of LLMs in Coding Assistance Tasks</p>
        </div>
        <nav>
          <a href="./benchmark/">Benchmark</a>
          <a href="https://github.com/wengshihao/TACO">GitHub</a>
        </nav>
      </header>

      <section className="workspace">
        <aside className="settings">
          <h2><KeyRound size={18} /> LLM</h2>
          <label>
            API Key
            <input
              type="password"
              value={config.apiKey}
              onChange={(event) => setConfig({ ...config, apiKey: event.target.value })}
              placeholder="sk-..."
            />
          </label>
          <label>
            Base URL
            <input value={config.baseUrl} onChange={(event) => setConfig({ ...config, baseUrl: event.target.value })} />
          </label>
          <label>
            API Path
            <input value={config.apiPath} onChange={(event) => setConfig({ ...config, apiPath: event.target.value })} />
          </label>
          <label>
            Model
            <input value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} />
          </label>
          <label>
            Max Tokens
            <input
              min="256"
              step="256"
              type="number"
              value={config.maxTokens ?? 4096}
              onChange={(event) => setConfig({ ...config, maxTokens: Number(event.target.value) || undefined })}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={config.useLocalProxy}
              onChange={(event) => setConfig({ ...config, useLocalProxy: event.target.checked })}
            />
            Use local proxy
          </label>

          <h2><SlidersHorizontal size={18} /> TACO</h2>
          <label>
            Language
            <select
              value={language}
              onChange={(event) => {
                const nextLanguage = event.target.value as TacoLanguage;
                setLanguage(nextLanguage);
                if (nextLanguage === "java") {
                  setQuestion(javaSampleQuestion);
                  setAnswer(javaSampleAnswer);
                } else {
                  setQuestion(sampleQuestion);
                  setAnswer(sampleAnswer);
                }
              }}
            >
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
          </label>
          <label>
            Alpha: {alpha.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={alpha}
              onChange={(event) => setAlpha(Number(event.target.value))}
            />
          </label>
          <label>
            Max Re-completion
            <input
              type="number"
              min="0"
              max="5"
              value={maxRecompletion}
              onChange={(event) => setMaxRecompletion(Number(event.target.value))}
            />
          </label>
          <button disabled={!canRun || running} onClick={run}>
            <Play size={17} />
            {running ? "Running" : "Run TACO"}
          </button>
          <p className="hint">
            Local proxy is available only when you run the web app locally. It avoids browser CORS issues by forwarding requests through your machine.
          </p>
        </aside>

        <section className="inputs">
          <ProgressPanel error={error} running={running} stage={stage} />
          <div className="editor">
            <label>User Question</label>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
          </div>
          <div className="editor">
            <label>LLM-Generated Answer</label>
            <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} />
          </div>
          <PipelineSteps error={error} running={running} stage={stage} />
        </section>

        <ResultPanel result={result} />
      </section>
    </main>
  );
}
