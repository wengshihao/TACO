import { useEffect, useState } from "react";
import type { StepId, StepState } from "../taco/types";
import { formatMs } from "./ui";

export type Steps = Record<StepId, StepState>;

export const idleSteps = (): Steps => ({
  convert: { status: "idle" },
  execQuestion: { status: "idle" },
  execAnswer: { status: "idle" },
  recomplete: { status: "idle" },
  code: { status: "idle" },
  align: { status: "idle" },
});

const lanes: Array<{ id: string; section: string; title: string; steps: Array<{ id: StepId; title: string; hint: string }> }> = [
  {
    id: "code",
    section: "§4.1",
    title: "Code quality",
    steps: [
      { id: "convert", title: "Test generation & completion", hint: "Q&A → minimal test + two harnesses" },
      { id: "execQuestion", title: "Virtual execution · question", hint: "does the harness reproduce the issue?" },
      { id: "execAnswer", title: "Virtual execution · answer", hint: "does the fix pass its assertion?" },
      { id: "recomplete", title: "Re-completion", hint: "only if the question harness fails" },
      { id: "code", title: "Code-quality evaluator", hint: "rubric score C ∈ {0,…,3}" },
    ],
  },
  {
    id: "align",
    section: "§4.2",
    title: "Response alignment",
    steps: [{ id: "align", title: "Alignment evaluator", hint: "rubric score A ∈ {0,…,3}" }],
  },
];

function useNow(active: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Glyph({ status }: { status: StepState["status"] }) {
  return (
    <span className={`glyph ${status}`} aria-hidden>
      {status === "done" && (
        <svg viewBox="0 0 16 16">
          <path d="M4.5 8.4l2.2 2.2 4.8-5" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {status === "failed" && (
        <svg viewBox="0 0 16 16">
          <path d="M5.5 5.5l5 5m0-5l-5 5" fill="none" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

function noteClass(note?: string) {
  if (note === "pass") return "chip ok";
  if (note === "fail") return "chip bad";
  return "chip";
}

export function Pipeline({ steps }: { steps: Steps }) {
  const running = Object.values(steps).some((step) => step.status === "running");
  const now = useNow(running);
  return (
    <div className="pipeline" aria-live="polite">
      {lanes.map((lane) => (
        <section className="lane" key={lane.id}>
          <header>
            <span className="lane-sec">{lane.section}</span>
            <span>{lane.title}</span>
            {lane.id === "align" && <span className="lane-par">runs in parallel</span>}
          </header>
          <ol>
            {lane.steps.map((def) => {
              const step = steps[def.id];
              const elapsed =
                step.startedAt !== undefined ? (step.endedAt ?? (step.status === "running" ? now : step.startedAt)) - step.startedAt : null;
              return (
                <li className={`step ${step.status}`} key={def.id}>
                  <Glyph status={step.status} />
                  <div className="step-text">
                    <span className="step-title">{def.title}</span>
                    <span className="step-hint">{def.hint}</span>
                  </div>
                  <div className="step-side">
                    {step.note && <span className={noteClass(step.note)}>{step.note === "pass" || step.note === "fail" ? `assert ${step.note}` : step.note}</span>}
                    {elapsed !== null && step.status !== "skipped" && <span className="step-time">{formatMs(elapsed)}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
