import { ArrowDown, ArrowUpRight, Moon, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CopyButton, Mark, useTheme } from "./ui";

const REPO = "https://github.com/wengshihao/TACO";

const BIBTEX = `@inproceedings{weng2026taco,
  title     = {TACO: Trust Assessment of Large Language Models in Coding Assistance Tasks},
  author    = {Weng, Shihao and Feng, Yang and Li, Jincheng and Yin, Yining and Zhang, Zhenlun and Liu, Lyuxi and Liu, Jia},
  booktitle = {Proceedings of the 2026 IEEE/ACM 48th International Conference on Software Engineering},
  year      = {2026}
}`;

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Nav() {
  const { theme, toggle } = useTheme();
  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="brand" href="#top">
          <Mark />
          <span>TACO</span>
        </a>
        <nav className="nav-links">
          <a href="#playground">Playground</a>
          <a href="#method">Method</a>
          <a href="#study">User study</a>
          <a href="#benchmark">Benchmark</a>
          <a href="#cite">Cite</a>
        </nav>
        <div className="nav-actions">
          <a className="icon-btn" href={REPO} aria-label="GitHub repository">
            <GitHubIcon />
          </a>
          <button type="button" className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden>
      <div className="hv-card back">
        <span className="eyebrow">Verdict</span>
        <span className="hv-word risk">Untrustworthy</span>
        <span className="hv-sub">Code quality falls below the acceptable bar (C = 1).</span>
      </div>
      <div className="hv-card front">
        <div className="hv-row">
          <span className="hv-tag">Q</span>
          <span>Why do I get a TypeError when adding an integer to a string?</span>
        </div>
        <div className="hv-row">
          <span className="hv-tag">A</span>
          <code>
            result = <span className="tok-call">str</span>(num) + text
          </code>
        </div>
        <div className="hv-trace">
          <code>
            <span className="tok-keyword">assert</span> answer_code((<span className="tok-number">10</span>, <span className="tok-string">" apples"</span>)) =={" "}
            <span className="tok-string">"10 apples"</span>
          </code>
          <span className="chip ok">assert pass</span>
        </div>
        <div className="hv-meters">
          <div>
            <span>
              <i>C</i> = 3
            </span>
            <span className="hv-bar">
              <b />
              <b />
              <b />
            </span>
          </div>
          <div>
            <span>
              <i>A</i> = 3
            </span>
            <span className="hv-bar">
              <b />
              <b />
              <b />
            </span>
          </div>
        </div>
        <div className="hv-verdict">
          <span className="hv-word trust">Trustworthy</span>
          <span className="math">S = 3.00 · R = 1</span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-inner">
        <a className="venue" href="#cite">
          <span className="venue-tag">ICSE 2026</span>
          <span>48th IEEE/ACM International Conference on Software Engineering</span>
        </a>
        <h1>Can you trust what the LLM just wrote?</h1>
        <p className="lede">
          <strong>TACO</strong> assesses whether an LLM's answer to a coding question deserves trust, with no reference answer. It turns the
          question and answer into executable harnesses, traces them by virtual execution, and scores <em>code quality</em> and{" "}
          <em>intent alignment</em>.
        </p>
        <p className="authors">
          Shihao Weng · Yang Feng · Jincheng Li · Yining Yin · Zhenlun Zhang · Lyuxi Liu · Jia Liu
        </p>
        <div className="cta">
          <a className="btn primary" href="#playground">
            Try it in the browser <ArrowDown size={15} />
          </a>
          <a className="btn" href={REPO}>
            <GitHubIcon /> Code
          </a>
          <a className="btn" href="#benchmark">
            Benchmark
          </a>
          <a className="btn" href="#cite">
            BibTeX
          </a>
        </div>
        <dl className="hero-stats">
          <div>
            <dt>−55.7%</dt>
            <dd>time to decide whether to adopt an answer</dd>
          </div>
          <div>
            <dt>+24.6%</dt>
            <dd>decision accuracy</dd>
          </div>
          <div>
            <dt>+43.3%</dt>
            <dd>success rate when fixing a wrong answer</dd>
          </div>
        </dl>
        <p className="hero-note">PhD-student participants, with vs. without TACO. See the <a href="#study">user study</a>.</p>
        <HeroVisual />
      </div>
    </section>
  );
}

export function SectionHead({ index, title, children }: { index: string; title: string; children?: ReactNode }) {
  return (
    <div className="section-head">
      <span className="section-index">{index}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Method() {
  return (
    <section className="section" id="method">
      <SectionHead index="02" title="How TACO works">
        TACO never sees a reference answer. It infers trust from what the question and answer <em>imply</em> when executed, and from whether the
        answer addresses what was actually asked.
      </SectionHead>
      <figure className="figure">
        <a href="./overview.webp" target="_blank" rel="noreferrer">
          <img src="./overview.webp" alt="TACO overview: code quality evaluation, response alignment evaluation, and overall output." loading="lazy" />
        </a>
        <figcaption>
          <strong>Figure 1.</strong> Overview of TACO. A question–response pair is evaluated along two independent paths that merge into a
          binary reliability indicator.
        </figcaption>
      </figure>
      <div className="method-grid">
        <article>
          <span className="method-sec">§4.1</span>
          <h3>Code quality</h3>
          <p>
            TACO derives a minimal test and completes the snippets into two harnesses. The <em>question harness</em> reproduces the reported
            behaviour and the <em>answer harness</em> applies the fix. An LLM interpreter traces both line by line. When the question harness fails
            to reproduce the issue, TACO re-completes it using the failure as feedback. A rubric then yields <span className="math">C ∈ {"{0,1,2,3}"}</span>.
          </p>
        </article>
        <article>
          <span className="method-sec">§4.2</span>
          <h3>Response alignment</h3>
          <p>
            Correct code can still miss the point. Running in parallel with the code branch, a separate evaluator checks whether the response
            addresses the user's actual intent, including constraints, scope, and the explanation asked for. It yields <span className="math">A ∈ {"{0,1,2,3}"}</span>.
          </p>
        </article>
        <article>
          <span className="method-sec">§4.3</span>
          <h3>Overall output</h3>
          <p>
            A continuous score for ranking and a conservative indicator for adoption:
          </p>
          <div className="formula">
            <span className="math">S = α·C + (1 − α)·A</span>
            <span className="math">R = 𝟙[min(C, A) ≥ 2]</span>
          </div>
        </article>
      </div>
    </section>
  );
}

type Row = { group: string; without: number; with: number };
type Metric = { key: string; name: string; unit: string; better: "lower" | "higher"; domain: [number, number]; ticks: number[]; rows: Row[] };

const study: Metric[] = [
  {
    key: "DT",
    name: "Decision time",
    unit: "min",
    better: "lower",
    domain: [0, 12],
    ticks: [0, 4, 8, 12],
    rows: [
      { group: "PhD students", without: 11.5, with: 5.1 },
      { group: "Developers", without: 9.7, with: 5.2 },
    ],
  },
  {
    key: "DA",
    name: "Decision accuracy",
    unit: "%",
    better: "higher",
    domain: [50, 100],
    ticks: [50, 75, 100],
    rows: [
      { group: "PhD students", without: 65.0, with: 81.0 },
      { group: "Developers", without: 73.5, with: 84.0 },
    ],
  },
  {
    key: "CT",
    name: "Correction time",
    unit: "min",
    better: "lower",
    domain: [0, 24],
    ticks: [0, 8, 16, 24],
    rows: [
      { group: "PhD students", without: 22.6, with: 15.4 },
      { group: "Developers", without: 18.6, with: 11.4 },
    ],
  },
  {
    key: "CSR",
    name: "Correction success rate",
    unit: "%",
    better: "higher",
    domain: [50, 100],
    ticks: [50, 75, 100],
    rows: [
      { group: "PhD students", without: 67.6, with: 93.9 },
      { group: "Developers", without: 75.4, with: 91.3 },
    ],
  },
];

function pct(metric: Metric, value: number) {
  const [lo, hi] = metric.domain;
  return ((value - lo) / (hi - lo)) * 100;
}

function change(row: Row) {
  const delta = ((row.with - row.without) / row.without) * 100;
  return `${delta > 0 ? "↑" : "↓"}${Math.abs(delta).toFixed(1)}%`;
}

function Dumbbell({ metric }: { metric: Metric }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="db-panel">
      <div className="db-head">
        <h3>
          {metric.name} <span className="muted">({metric.key})</span>
        </h3>
        <span className="muted">{metric.better} is better</span>
      </div>
      {metric.rows.map((row, i) => {
        const a = pct(metric, row.without);
        const b = pct(metric, row.with);
        return (
          <div
            className={hover === i ? "db-row hover" : "db-row"}
            key={row.group}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="db-group">{row.group}</span>
            <div className="db-track">
              {metric.ticks.map((tick) => (
                <span className="db-grid" key={tick} style={{ left: `${pct(metric, tick)}%` }} />
              ))}
              <span className="db-line" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }} />
              <span className="db-dot without" style={{ left: `${a}%` }} />
              <span className="db-dot with" style={{ left: `${b}%` }} />
              {hover === i && (
                <span className="db-tip" style={{ left: `${(a + b) / 2}%` }}>
                  <span>
                    <i className="key without" />
                    w/o TACO <b>{row.without.toFixed(1)}</b> {metric.unit}
                  </span>
                  <span>
                    <i className="key with" />
                    with TACO <b>{row.with.toFixed(1)}</b> {metric.unit}
                  </span>
                </span>
              )}
            </div>
            <span className="db-value">
              <span className="mono">
                {row.without} → {row.with}
              </span>
              <span className="db-delta">{change(row)}</span>
            </span>
          </div>
        );
      })}
      <div className="db-axis">
        <span />
        <div className="db-ticks">
          {metric.ticks.map((tick) => (
            <span key={tick} style={{ left: `${pct(metric, tick)}%` }}>
              {tick}
              {tick === metric.ticks[metric.ticks.length - 1] ? ` ${metric.unit}` : ""}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

export function Study() {
  return (
    <section className="section" id="study">
      <SectionHead index="03" title="Does it help developers?">
        Six independent participants, three PhD students and three professional developers, judged and repaired LLM answers with and without
        TACO, about 100 answers per condition per group.
      </SectionHead>
      <div className="legend" aria-hidden>
        <span>
          <i className="key without" /> w/o TACO
        </span>
        <span>
          <i className="key with" /> with TACO
        </span>
      </div>
      <div className="db-grid-wrap">
        {study.map((metric) => (
          <Dumbbell metric={metric} key={metric.key} />
        ))}
      </div>
      <div className="study-foot">
        <p>
          <span className="big">6.3</span>
          <span className="big">6.1</span>
          <span>
            Perceived usefulness on a 7-point Likert scale, from PhD students and developers respectively.
          </span>
        </p>
        <details>
          <summary>Table view and metric definitions</summary>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>PhD students · w/o</th>
                <th>with TACO</th>
                <th>Developers · w/o</th>
                <th>with TACO</th>
              </tr>
            </thead>
            <tbody>
              {study.map((metric) => (
                <tr key={metric.key}>
                  <td>
                    {metric.name} ({metric.unit})
                  </td>
                  <td>{metric.rows[0].without}</td>
                  <td>
                    {metric.rows[0].with} <span className="muted">{change(metric.rows[0])}</span>
                  </td>
                  <td>{metric.rows[1].without}</td>
                  <td>
                    {metric.rows[1].with} <span className="muted">{change(metric.rows[1])}</span>
                  </td>
                </tr>
              ))}
              <tr>
                <td>Perceived usefulness (1–7)</td>
                <td>–</td>
                <td>6.3</td>
                <td>–</td>
                <td>6.1</td>
              </tr>
            </tbody>
          </table>
          <ul className="defs">
            <li>
              <b>DT</b> is the time needed to decide whether a response is adoptable. <b>DA</b> is the correctness of that decision against the
              benchmark label.
            </li>
            <li>
              <b>CT</b> is the time taken to revise an incorrect response. <b>CSR</b> is the share of successful corrections, as judged by the
              question's original annotator; attempts over 30 minutes were recorded as unsuccessful.
            </li>
          </ul>
        </details>
      </div>
    </section>
  );
}

const datasets = [
  {
    name: "TACO-Eval",
    count: "1,328",
    unit: "Python tasks",
    body: "Real-world Stack Overflow coding-assistance questions with accepted answers, plus responses from seven LLMs: GPT-4o, Claude, DeepSeek, Doubao, Gemini, Grok, and Llama.",
    path: "benchmark/TACO-Eval",
  },
  {
    name: "TACO-Judge",
    count: "1,593",
    unit: "annotated responses",
    body: "About 400 Python questions, each answered by GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, and Llama 3.1 405B. Every response is labelled trustworthy or not.",
    path: "benchmark/TACO-Judge",
  },
  {
    name: "TACO-Judge-Java",
    count: "100",
    unit: "Java responses",
    body: "Annotated Java coding-assistance responses, used to show that TACO carries over to a statically typed language.",
    path: "benchmark/TACO-Judge-Java",
  },
];

export function Benchmark() {
  return (
    <section className="section" id="benchmark">
      <SectionHead index="04" title="Benchmark">
        Everything used in the paper ships with the repository. The playground's examples are drawn from TACO-Judge.
      </SectionHead>
      <div className="bench-grid">
        {datasets.map((dataset) => (
          <a className="bench-card" href={`${REPO}/tree/main/${dataset.path}`} key={dataset.name}>
            <span className="bench-name">
              {dataset.name} <ArrowUpRight size={15} />
            </span>
            <span className="bench-count">
              {dataset.count} <small>{dataset.unit}</small>
            </span>
            <p>{dataset.body}</p>
          </a>
        ))}
      </div>
      <div className="cli">
        <div className="cli-head">
          <span>Batch evaluation with the CLI</span>
          <a href={`${REPO}#benchmark`}>
            docs <ArrowUpRight size={13} />
          </a>
        </div>
        <pre>
          <span className="muted">$ </span>pip install -e .{"\n"}
          <span className="muted">$ </span>export TACO_API_KEY=… TACO_MODEL=gpt-4o-mini{"\n"}
          <span className="muted">$ </span>taco run --input benchmark/TACO-Judge/chatgpt4o.jsonl \{"\n"}
          {"           "}--output outputs/chatgpt4o.jsonl --language python --resume
        </pre>
      </div>
    </section>
  );
}

export function Cite() {
  return (
    <section className="section" id="cite">
      <SectionHead index="05" title="Citation" />
      <figure className="code-block bib">
        <figcaption>
          <span className="code-title">BibTeX</span>
          <span className="code-meta">
            <CopyButton text={BIBTEX} label="Copy" />
          </span>
        </figcaption>
        <pre className="code raw">{BIBTEX}</pre>
      </figure>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Mark size={18} /> TACO · MIT License
      </div>
      <div className="muted">
        Typeset in Exo &amp; JetBrains Mono ·{" "}
        <a href={REPO} className="link">
          GitHub
        </a>
      </div>
    </footer>
  );
}
