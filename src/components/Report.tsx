import { Download } from "lucide-react";
import { useState } from "react";
import type { InterpreterTrace, Score, TacoResult } from "../taco/types";
import { CodeBlock, Prose } from "./Code";
import { CopyButton, formatMs, formatTokens } from "./ui";

const rubric = ["critical", "major issues", "acceptable", "optimal"];

export type HumanLabel = "trustworthy" | "untrustworthy";

function ScoreMeter({ name, symbol, value }: { name: string; symbol: string; value: Score }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{name}</span>
        <span className="meter-value">
          <i>{symbol}</i> = {value}
          <small>/3</small>
        </span>
      </div>
      <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={3} aria-valuenow={value} aria-label={name}>
        {[1, 2, 3].map((level) => (
          <span key={level} className={value >= level ? (value >= 2 ? "on good" : "on weak") : ""} />
        ))}
      </div>
      <div className="meter-foot">{rubric[value]}</div>
    </div>
  );
}

function TraceBadge({ trace }: { trace: InterpreterTrace }) {
  return <span className={trace.assertStatus === "pass" ? "chip ok" : trace.assertStatus === "fail" ? "chip bad" : "chip"}>assert {trace.assertStatus}</span>;
}

function explain(result: TacoResult) {
  const { codeQualityScore: c, alignmentScore: a } = result;
  if (result.reliability) return "Both code quality and intent alignment reach the acceptable bar (≥ 2).";
  const weak = [c < 2 ? `code quality (C = ${c})` : "", a < 2 ? `intent alignment (A = ${a})` : ""].filter(Boolean);
  return `${weak.join(" and ")} ${weak.length > 1 ? "fall" : "falls"} below the acceptable bar of 2.`.replace(/^./, (ch) => ch.toUpperCase());
}

type Tab = "analysis" | "harness" | "trace" | "json";

export function withAlpha(result: TacoResult, alpha: number): TacoResult {
  const overallScore = Number((alpha * result.codeQualityScore + (1 - alpha) * result.alignmentScore).toFixed(4));
  return { ...result, alpha, overallScore };
}

export function Report({
  result,
  alpha,
  onAlpha,
  label,
}: {
  result: TacoResult;
  alpha: number;
  onAlpha: (alpha: number) => void;
  label: HumanLabel | null;
}) {
  const [tab, setTab] = useState<Tab>("analysis");
  const view = withAlpha(result, alpha);
  const trusted = result.reliability === 1;
  const agrees = label ? (label === "trustworthy") === trusted : null;
  const { completion, questionTrace, answerTrace, recompletionAttempts } = result.intermediate;
  const json = () => JSON.stringify(view, null, 2);

  const download = () => {
    const blob = new Blob([json()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taco-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report">
      <section className={trusted ? "verdict trust" : "verdict risk"}>
        <div className="eyebrow">
          Verdict · <span className="math">R = 𝟙[min(C, A) ≥ 2] = {result.reliability}</span>
        </div>
        <div className="verdict-word">{trusted ? "Trustworthy" : "Untrustworthy"}</div>
        <p>{explain(result)}</p>
        {label && (
          <div className={agrees ? "agreement yes" : "agreement no"}>
            Human annotation: <strong>{label}</strong> · TACO {agrees ? "agrees" : "disagrees"}
          </div>
        )}
      </section>

      <section className="scores">
        <ScoreMeter name="Code quality" symbol="C" value={result.codeQualityScore} />
        <ScoreMeter name="Intent alignment" symbol="A" value={result.alignmentScore} />
        <div className="overall">
          <div>
            <span className="overall-label">Overall score</span>
            <div className="overall-value">
              {view.overallScore.toFixed(2)}
              <small>/3</small>
            </div>
          </div>
          <div className="overall-side">
            <span className="math">
              S = {alpha.toFixed(2)}·{result.codeQualityScore} + {(1 - alpha).toFixed(2)}·{result.alignmentScore}
            </span>
            <label className="alpha">
              <span>α</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={alpha}
                aria-label="Weight of code quality (alpha)"
                onChange={(event) => onAlpha(Number(event.target.value))}
              />
            </label>
            <span className="fine">Drag α to re-weight code quality; no re-run needed.</span>
          </div>
        </div>
      </section>

      <div className="run-meta">
        <span>{result.model}</span>
        <span>{result.language === "java" ? "Java" : "Python"}</span>
        <span>{result.usage.calls} calls</span>
        {result.usage.promptTokens + result.usage.completionTokens > 0 && (
          <span>{formatTokens(result.usage.promptTokens + result.usage.completionTokens)} tokens</span>
        )}
        <span>{formatMs(result.elapsedMs)}</span>
        <button type="button" className="ghost-btn" onClick={download}>
          <Download size={14} />
          <span>JSON</span>
        </button>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ["analysis", "Analysis"],
            ["harness", "Harnesses"],
            ["trace", "Execution traces"],
            ["json", "Raw"],
          ] as Array<[Tab, string]>
        ).map(([id, name]) => (
          <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} key={id} onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
      </div>

      <div className="tab-panel">
        {tab === "analysis" && (
          <>
            <article className="analysis">
              <h4>
                Code quality <span className="chip">C = {result.codeQualityScore}</span>
              </h4>
              <Prose text={result.codeQualityAnalysis} />
            </article>
            <article className="analysis">
              <h4>
                Intent alignment <span className="chip">A = {result.alignmentScore}</span>
              </h4>
              <Prose text={result.alignmentAnalysis} />
            </article>
          </>
        )}

        {tab === "harness" && (
          <>
            <dl className="facts">
              {completion.testCaseSummary && (
                <>
                  <dt>Minimal test</dt>
                  <dd>{completion.testCaseSummary}</dd>
                </>
              )}
              {completion.reproductionGoal && (
                <>
                  <dt>Reproduces</dt>
                  <dd>{completion.reproductionGoal}</dd>
                </>
              )}
              {completion.resolutionGoal && (
                <>
                  <dt>Resolves</dt>
                  <dd>{completion.resolutionGoal}</dd>
                </>
              )}
              {recompletionAttempts.length > 0 && (
                <>
                  <dt>Re-completed</dt>
                  <dd>
                    {recompletionAttempts.length} time{recompletionAttempts.length > 1 ? "s" : ""} after the question harness failed
                  </dd>
                </>
              )}
            </dl>
            <CodeBlock title="Question harness" code={completion.questionCode} language={result.language} />
            <CodeBlock title="Answer harness" code={completion.answerCode} language={result.language} />
          </>
        )}

        {tab === "trace" && (
          <>
            {[
              ["Question harness", questionTrace] as const,
              ["Answer harness", answerTrace] as const,
            ].map(([title, trace]) => (
              <div className="trace" key={title}>
                <CodeBlock title={`${title} · annotated trace`} code={trace.annotatedCode} language={result.language} badge={<TraceBadge trace={trace} />} wrap />
                {(trace.traceSummary || trace.failureReason) && (
                  <p className="trace-note">
                    {trace.traceSummary}
                    {trace.failureReason && trace.assertStatus !== "pass" && (
                      <>
                        {trace.traceSummary && " "}
                        <strong>Failure:</strong> {trace.failureReason}
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </>
        )}

        {tab === "json" && (
          <figure className="code-block">
            <figcaption>
              <span className="code-title">result.json</span>
              <span className="code-meta">
                <CopyButton text={json} />
              </span>
            </figcaption>
            <pre className="code raw">{json()}</pre>
          </figure>
        )}
      </div>
    </div>
  );
}
