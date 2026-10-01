// Builds public/samples.json: a small, deterministic gallery of human-annotated
// TACO-Judge items that the web playground can load with one click.
import { readFileSync, writeFileSync } from "node:fs";

const readJsonl = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

const clean = (text) => String(text).replace(/\r\n/g, "\n").replace(/```Plain Text\n/g, "```\n").trim();
const decode = (text) =>
  String(text)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const size = (row) => row.question.length + row.llmanswer.length;
const titleOf = (row) => decode(clean(row.question)).split("\n")[0].replace(/^#\s*/, "");

function pick(rows, untrustworthy, count, maxSize = 2600) {
  return rows
    .filter((row) => Boolean(row.ishall) === untrustworthy && size(row) >= 700 && size(row) <= maxSize)
    .sort((a, b) => size(a) - size(b))
    .slice(0, count);
}

const pythonSources = [
  ["benchmark/TACO-Judge/chatgpt4o.jsonl", "GPT-4o"],
  ["benchmark/TACO-Judge/annotated-claude-3.5-sonnet.jsonl", "Claude 3.5 Sonnet"],
  ["benchmark/TACO-Judge/gemini-1.5-pro.jsonl", "Gemini 1.5 Pro"],
  ["benchmark/TACO-Judge/llama3.1-405b.jsonl", "Llama 3.1 405B"],
];

const samples = [];
const seenTitles = new Set();

for (const [path, model] of pythonSources) {
  const rows = readJsonl(path).filter((row) => !seenTitles.has(titleOf(row)));
  for (const row of [...pick(rows, true, 1), ...pick(rows, false, 1)]) {
    seenTitles.add(titleOf(row));
    const question = clean(row.question);
    samples.push({
      id: `py-${row.ID_hash.slice(0, 8)}`,
      language: "python",
      source: "TACO-Judge",
      model,
      title: titleOf(row),
      question: question.replace(/^#\s*/, ""),
      answer: clean(row.llmanswer),
      label: row.ishall ? "untrustworthy" : "trustworthy",
    });
  }
}

const javaTitles = new Map(
  JSON.parse(readFileSync("benchmark/TACO-Judge-Java/data_java_annotated.json", "utf8")).map((row) => [
    String(row.question_id),
    row.title,
  ]),
);
const javaRows = readJsonl("benchmark/TACO-Judge-Java/data_java_annotated.jsonl");
for (const row of [...pick(javaRows, true, 2, 4200), ...pick(javaRows, false, 2)]) {
  const rawTitle = javaTitles.get(String(row.question_id)) ?? clean(row.question).split("\n")[0];
  const title = decode(rawTitle);
  let question = decode(clean(row.question));
  if (question.startsWith(title)) question = `${title}\n\n${question.slice(title.length).trim()}`;
  samples.push({
    id: `java-${row.question_id}`,
    language: "java",
    source: "TACO-Judge-Java",
    model: null,
    title,
    question,
    answer: clean(row.llmanswer),
    label: row.ishall ? "untrustworthy" : "trustworthy",
  });
}

writeFileSync("public/samples.json", `${JSON.stringify(samples, null, 1)}\n`);
console.log(`Wrote ${samples.length} samples to public/samples.json`);
