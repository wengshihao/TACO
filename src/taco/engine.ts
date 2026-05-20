import { complete } from "./llmClient";
import { parseLlmJson, score } from "./json";
import { alignmentPrompt, codeQualityPrompt, interpreterPrompt, testCompletionPrompt } from "./prompts";
import type { CompletionArtifact, InterpreterTrace, LlmConfig, TacoLanguage, TacoResult } from "./types";

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function status(value: unknown): "pass" | "fail" | "unknown" {
  const text = String(value ?? "unknown").toLowerCase();
  if (["pass", "passed", "success", "succeed", "succeeds"].includes(text)) return "pass";
  if (["fail", "failed", "failure", "error"].includes(text)) return "fail";
  return "unknown";
}

function joinAnalysis(payload: Record<string, unknown>, keys: string[]): string {
  return keys
    .map((key) => payload[key])
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n\n");
}

async function callJson(
  config: LlmConfig,
  stage: string,
  prompt: string,
  raw: Record<string, string>,
): Promise<Record<string, unknown>> {
  const text = await complete(config, prompt);
  raw[stage] = text;
  return parseLlmJson(text);
}

async function completeCode(
  config: LlmConfig,
  question: string,
  answer: string,
  feedback: string,
  raw: Record<string, string>,
  language: TacoLanguage,
): Promise<CompletionArtifact> {
  const payload = await callJson(config, "test_case_and_completion", testCompletionPrompt(question, answer, feedback, language), raw);
  return {
    questionCode: asText(payload.questionCode ?? payload.question_code),
    answerCode: asText(payload.answerCode ?? payload.answer_code),
    testCaseSummary: asText(payload.testCaseSummary ?? payload.test_case_summary),
    reproductionGoal: asText(payload.reproductionGoal ?? payload.reproduction_goal),
    resolutionGoal: asText(payload.resolutionGoal ?? payload.resolution_goal),
  };
}

async function interpret(
  config: LlmConfig,
  code: string,
  rawKey: string,
  raw: Record<string, string>,
  language: TacoLanguage,
): Promise<InterpreterTrace> {
  const payload = await callJson(config, rawKey, interpreterPrompt(code, language), raw);
  return {
    annotatedCode: asText(payload.annotatedCode ?? payload.annotated_code),
    assertStatus: status(payload.assertStatus ?? payload.assert_status),
    failureReason: asText(payload.failureReason ?? payload.failure_reason),
    traceSummary: asText(payload.traceSummary ?? payload.trace_summary),
  };
}

export async function evaluateTaco(args: {
  config: LlmConfig;
  question: string;
  answer: string;
  alpha: number;
  language: TacoLanguage;
  maxRecompletion: number;
  onStage?: (stage: string) => void;
}): Promise<TacoResult> {
  const raw: Record<string, string> = {};
  const recompletionAttempts: Array<Record<string, unknown>> = [];
  let feedback = "None.";

  args.onStage?.("convertor");
  let completion = await completeCode(args.config, args.question, args.answer, feedback, raw, args.language);

  args.onStage?.("executor_question");
  let questionTrace = await interpret(args.config, completion.questionCode, "question_interpreter", raw, args.language);
  args.onStage?.("executor_answer");
  let answerTrace = await interpret(args.config, completion.answerCode, "answer_interpreter", raw, args.language);

  for (let attempt = 0; attempt < args.maxRecompletion && questionTrace.assertStatus !== "pass"; attempt += 1) {
    feedback = JSON.stringify({
      attempt: attempt + 1,
      questionTraceStatus: questionTrace.assertStatus,
      questionFailureReason: questionTrace.failureReason,
      answerTraceStatus: answerTrace.assertStatus,
      answerFailureReason: answerTrace.failureReason,
    });
    recompletionAttempts.push({ attempt: attempt + 1, feedback });
    args.onStage?.(`recompletion_${attempt + 1}`);
    completion = await completeCode(args.config, args.question, args.answer, feedback, raw, args.language);
    questionTrace = await interpret(args.config, completion.questionCode, "question_interpreter", raw, args.language);
    answerTrace = await interpret(args.config, completion.answerCode, "answer_interpreter", raw, args.language);
  }

  args.onStage?.("codechecker");
  const codePayload = await callJson(
    args.config,
    "code_quality",
    codeQualityPrompt({
      question: args.question,
      answer: args.answer,
      questionCode: completion.questionCode,
      questionTrace: JSON.stringify(questionTrace, null, 2),
      answerCode: completion.answerCode,
      answerTrace: JSON.stringify(answerTrace, null, 2),
      language: args.language,
    }),
    raw,
  );

  args.onStage?.("textchecker");
  const alignmentPayload = await callJson(args.config, "alignment", alignmentPrompt(args.question, args.answer), raw);

  const resolvedCodeQualityScore = score(
    codePayload.codeQualityScore ?? codePayload.code_quality_score ?? codePayload.acceptabilityScore,
  );
  const alignmentScore = score(alignmentPayload.alignmentScore ?? alignmentPayload.alignment_score);
  const alpha = Math.max(0, Math.min(1, args.alpha));
  const overallScore = Number((alpha * resolvedCodeQualityScore + (1 - alpha) * alignmentScore).toFixed(4));
  const reliability = Math.min(resolvedCodeQualityScore, alignmentScore) >= 2 ? 1 : 0;

  args.onStage?.("done");
  return {
    codeQualityAnalysis:
      asText(codePayload.codeQualityAnalysis ?? codePayload.code_quality_analysis) ||
      joinAnalysis(codePayload, ["questionAnalysis", "generatedCodeAnalysis", "acceptabilityEvaluation"]),
    codeQualityScore: resolvedCodeQualityScore,
    alignmentAnalysis:
      asText(alignmentPayload.alignmentAnalysis ?? alignmentPayload.alignment_analysis) ||
      joinAnalysis(alignmentPayload, ["questionAnalysis", "answerAnalysis", "alignmentEvaluation"]),
    alignmentScore,
    alpha,
    overallScore,
    reliability,
    intermediate: {
      completion,
      questionTrace,
      answerTrace,
      recompletionAttempts,
      raw,
    },
  };
}
