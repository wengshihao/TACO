import { complete } from "./llmClient";
import { parseLlmJson, score } from "./json";
import { alignmentPrompt, codeQualityPrompt, interpreterPrompt, testCompletionPrompt } from "./prompts";
import type {
  CompletionArtifact,
  InterpreterTrace,
  LlmConfig,
  StepEvent,
  TacoLanguage,
  TacoResult,
  Usage,
} from "./types";

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

function fencedBlocks(text: string): string[] {
  return [...text.matchAll(/```[\w+-]*\n([\s\S]*?)```/g)].map((match) => match[1].trim());
}

interface RunContext {
  config: LlmConfig;
  language: TacoLanguage;
  raw: Record<string, string>;
  usage: Usage;
  signal: AbortSignal;
}

async function callJson(ctx: RunContext, stage: string, prompt: string): Promise<Record<string, unknown>> {
  const text = await complete(ctx.config, prompt, { signal: ctx.signal, usage: ctx.usage });
  ctx.raw[stage] = text;
  return parseLlmJson(text);
}

async function completeCode(
  ctx: RunContext,
  question: string,
  answer: string,
  feedback: string,
  stage: string,
): Promise<CompletionArtifact> {
  const payload = await callJson(ctx, stage, testCompletionPrompt(question, answer, feedback, ctx.language));
  const blocks = fencedBlocks(ctx.raw[stage] ?? "");
  return {
    questionCode: asText(payload.questionCode ?? payload.question_code) || blocks[0] || "",
    answerCode: asText(payload.answerCode ?? payload.answer_code) || blocks[1] || "",
    testCaseSummary: asText(payload.testCaseSummary ?? payload.test_case_summary),
    reproductionGoal: asText(payload.reproductionGoal ?? payload.reproduction_goal),
    resolutionGoal: asText(payload.resolutionGoal ?? payload.resolution_goal),
  };
}

async function interpret(ctx: RunContext, code: string, stage: string): Promise<InterpreterTrace> {
  const payload = await callJson(ctx, stage, interpreterPrompt(code, ctx.language));
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
  signal?: AbortSignal;
  onEvent?: (event: StepEvent) => void;
}): Promise<TacoResult> {
  const startedAt = performance.now();
  // A failure in one branch cancels the other, as does an abort from the caller.
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(args.signal?.reason);
  args.signal?.addEventListener("abort", forwardAbort, { once: true });

  const ctx: RunContext = {
    config: args.config,
    language: args.language,
    raw: {},
    usage: { calls: 0, promptTokens: 0, completionTokens: 0 },
    signal: controller.signal,
  };
  const emit = args.onEvent ?? (() => undefined);
  const begin = (step: StepEvent["step"], note?: string) =>
    emit({ step, status: "running", startedAt: performance.now(), endedAt: undefined, note });
  const end = (step: StepEvent["step"], note?: string) => emit({ step, status: "done", endedAt: performance.now(), note });

  // §4.1 Code quality: convert -> virtually execute both harnesses -> re-complete -> evaluate.
  const codeBranch = async () => {
    const recompletionAttempts: Array<Record<string, unknown>> = [];

    begin("convert");
    let completion = await completeCode(ctx, args.question, args.answer, "None.", "test_case_and_completion");
    end("convert");

    const executeBoth = async (suffix: string) => {
      begin("execQuestion");
      begin("execAnswer");
      const [questionTrace, answerTrace] = await Promise.all([
        interpret(ctx, completion.questionCode, `question_interpreter${suffix}`).then((trace) => {
          end("execQuestion", trace.assertStatus);
          return trace;
        }),
        interpret(ctx, completion.answerCode, `answer_interpreter${suffix}`).then((trace) => {
          end("execAnswer", trace.assertStatus);
          return trace;
        }),
      ]);
      return { questionTrace, answerTrace };
    };

    let { questionTrace, answerTrace } = await executeBoth("");

    // Re-complete only when the question harness fails to reproduce the reported behaviour.
    for (let attempt = 1; attempt <= args.maxRecompletion && questionTrace.assertStatus !== "pass"; attempt += 1) {
      const feedback = JSON.stringify({
        attempt,
        questionTraceStatus: questionTrace.assertStatus,
        questionFailureReason: questionTrace.failureReason,
        answerTraceStatus: answerTrace.assertStatus,
        answerFailureReason: answerTrace.failureReason,
      });
      recompletionAttempts.push({ attempt, feedback });
      const note = `attempt ${attempt}/${args.maxRecompletion}`;
      // Keep the first start time so the step reports cumulative re-completion time.
      if (attempt === 1) begin("recomplete", note);
      else emit({ step: "recomplete", status: "running", endedAt: undefined, note });
      completion = await completeCode(ctx, args.question, args.answer, feedback, `test_case_and_completion_retry_${attempt}`);
      ({ questionTrace, answerTrace } = await executeBoth(`_retry_${attempt}`));
      end("recomplete", `${attempt} attempt${attempt > 1 ? "s" : ""}`);
    }
    if (recompletionAttempts.length === 0) {
      emit({ step: "recomplete", status: "skipped", note: questionTrace.assertStatus === "pass" ? "not needed" : "disabled" });
    }

    begin("code");
    const payload = await callJson(
      ctx,
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
    );
    const codeQualityScore = score(payload.codeQualityScore ?? payload.code_quality_score ?? payload.acceptabilityScore);
    end("code", `C = ${codeQualityScore}`);
    return {
      completion,
      questionTrace,
      answerTrace,
      recompletionAttempts,
      codeQualityScore,
      codeQualityAnalysis:
        asText(payload.codeQualityAnalysis ?? payload.code_quality_analysis) ||
        joinAnalysis(payload, ["questionAnalysis", "generatedCodeAnalysis", "acceptabilityEvaluation"]),
    };
  };

  // §4.2 Response alignment is independent of the code branch, so it runs concurrently.
  const alignBranch = async () => {
    begin("align");
    const payload = await callJson(ctx, "alignment", alignmentPrompt(args.question, args.answer));
    const alignmentScore = score(payload.alignmentScore ?? payload.alignment_score);
    end("align", `A = ${alignmentScore}`);
    return {
      alignmentScore,
      alignmentAnalysis:
        asText(payload.alignmentAnalysis ?? payload.alignment_analysis) ||
        joinAnalysis(payload, ["questionAnalysis", "answerAnalysis", "alignmentEvaluation"]),
    };
  };

  try {
    const [code, align] = await Promise.all(
      [codeBranch(), alignBranch()].map((branch) =>
        branch.catch((error) => {
          controller.abort(error);
          throw error;
        }),
      ) as [ReturnType<typeof codeBranch>, ReturnType<typeof alignBranch>],
    );

    // §4.3 Overall evaluation.
    const alpha = Math.max(0, Math.min(1, args.alpha));
    const overallScore = Number((alpha * code.codeQualityScore + (1 - alpha) * align.alignmentScore).toFixed(4));
    const reliability = Math.min(code.codeQualityScore, align.alignmentScore) >= 2 ? 1 : 0;

    return {
      codeQualityAnalysis: code.codeQualityAnalysis,
      codeQualityScore: code.codeQualityScore,
      alignmentAnalysis: align.alignmentAnalysis,
      alignmentScore: align.alignmentScore,
      alpha,
      overallScore,
      reliability,
      model: args.config.model,
      language: args.language,
      elapsedMs: Math.round(performance.now() - startedAt),
      usage: ctx.usage,
      intermediate: {
        completion: code.completion,
        questionTrace: code.questionTrace,
        answerTrace: code.answerTrace,
        recompletionAttempts: code.recompletionAttempts,
        raw: ctx.raw,
      },
    };
  } finally {
    args.signal?.removeEventListener("abort", forwardAbort);
  }
}
