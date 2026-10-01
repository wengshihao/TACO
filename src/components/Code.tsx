import { Fragment, type ReactNode } from "react";
import type { TacoLanguage } from "../taco/types";
import { CopyButton } from "./ui";

const KEYWORDS: Record<TacoLanguage, string> = {
  python:
    "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield",
  java:
    "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new null package private protected public return short static super switch synchronized this throw throws transient true false try var void volatile while record",
};

const PATTERNS: Record<TacoLanguage, RegExp> = {
  python: /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|[rbfu]{0,2}"(?:\\.|[^"\\\n])*"|[rbfu]{0,2}'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|(@[\w.]+)|([A-Za-z_]\w*)/gi,
  java: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*(?:\.\d+)?[lLfFdD]?\b)|(@\w+)|([A-Za-z_$][\w$]*)/g,
};

type Token = { text: string; kind: string };

function tokenize(code: string, language: TacoLanguage): Token[] {
  const keywords = new Set(KEYWORDS[language].split(" "));
  const pattern = new RegExp(PATTERNS[language].source, PATTERNS[language].flags);
  const tokens: Token[] = [];
  let cursor = 0;
  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: code.slice(cursor, index), kind: "" });
    const [text, comment, string, number, decorator, word] = match;
    let kind = "";
    if (comment) kind = "tok-comment";
    else if (string) kind = "tok-string";
    else if (number) kind = "tok-number";
    else if (decorator) kind = "tok-decorator";
    else if (word && keywords.has(word)) kind = "tok-keyword";
    else if (word && code[index + word.length] === "(") kind = "tok-call";
    tokens.push({ text, kind });
    cursor = index + text.length;
  }
  if (cursor < code.length) tokens.push({ text: code.slice(cursor), kind: "" });
  return tokens;
}

/** Splits highlighted tokens into lines so multi-line strings and comments keep their colour. */
function highlightLines(code: string, language: TacoLanguage): ReactNode[][] {
  const lines: ReactNode[][] = [[]];
  tokenize(code, language).forEach((token, t) => {
    token.text.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push(token.kind ? <span className={token.kind} key={`${t}-${i}`}>{part}</span> : part);
    });
  });
  return lines;
}

export function CodeBlock({
  code,
  language,
  title,
  badge,
  wrap = false,
}: {
  code: string;
  language: TacoLanguage;
  title: string;
  badge?: ReactNode;
  wrap?: boolean;
}) {
  const text = code.trim() || "// (empty)";
  return (
    <figure className="code-block">
      <figcaption>
        <span className="code-title">{title}</span>
        <span className="code-meta">
          {badge}
          <CopyButton text={text} />
        </span>
      </figcaption>
      <div className={wrap ? "code-lines wrap" : "code-lines"}>
        {highlightLines(text, language).map((line, i) => (
          <div className="ln" key={i}>
            <span className="ln-no" aria-hidden>
              {i + 1}
            </span>
            <code className="ln-code">{line.length ? line : " "}</code>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Renders the small subset of Markdown LLM analyses tend to use: paragraphs, lists, `code`, **bold**. */
export function Prose({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  const inline = (line: string) =>
    line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
      return <Fragment key={i}>{part}</Fragment>;
    });
  if (!text.trim()) return <p className="muted">No analysis returned.</p>;
  return (
    <div className="prose">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line))) {
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(line.replace(/^#+\s*/, ""))}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
