export type Score = 0 | 1 | 2 | 3;
export type TacoLanguage = "python" | "java";

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  apiPath: string;
  model: string;
  temperature: number;
  useLocalProxy: boolean;
  maxTokens?: number;
}

export interface CompletionArtifact {
  questionCode: string;
  answerCode: string;
  testCaseSummary: string;
  reproductionGoal: string;
  resolutionGoal: string;
}

export interface InterpreterTrace {
  annotatedCode: string;
  assertStatus: "pass" | "fail" | "unknown";
  failureReason: string;
  traceSummary: string;
}

export interface TacoResult {
  codeQualityAnalysis: string;
  codeQualityScore: Score;
  alignmentAnalysis: string;
  alignmentScore: Score;
  alpha: number;
  overallScore: number;
  reliability: 0 | 1;
  intermediate: {
    completion: CompletionArtifact;
    questionTrace: InterpreterTrace;
    answerTrace: InterpreterTrace;
    recompletionAttempts: Array<Record<string, unknown>>;
    raw: Record<string, string>;
  };
}
