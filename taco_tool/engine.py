from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .json_utils import extract_fenced_code, json_dumps, parse_llm_json
from .llm import ChatClient
from .prompts import (
    SYSTEM,
    get_prompts,
)
from .schema import (
    Alignment,
    CodeQuality,
    CompletionArtifact,
    InterpreterTrace,
    TacoIntermediate,
    TacoResult,
    overall_score,
    reliability_from_scores,
)


def render_prompt(template: str, **values: str) -> str:
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace("{" + key + "}", value)
    return rendered


@dataclass
class TacoEngine:
    client: ChatClient
    alpha: float = 0.5
    max_recompletion: int = 2
    temperature: float = 0.0
    keep_raw: bool = True
    language: str = "python"
    _raw: dict[str, Any] = field(default_factory=dict, init=False)

    def evaluate(self, question: str, answer: str, *, item_id: str | int | None = None) -> TacoResult:
        self._raw = {}
        attempts: list[dict[str, Any]] = []
        feedback = "None."

        completion = self._complete_code(question, answer, feedback=feedback)
        question_trace = self._interpret(completion.question_code, stage="question_interpreter")
        answer_trace = self._interpret(completion.answer_code, stage="answer_interpreter")

        for attempt in range(self.max_recompletion):
            if question_trace.assert_status == "pass":
                break
            feedback = json_dumps(
                {
                    "attempt": attempt + 1,
                    "questionTraceStatus": question_trace.assert_status,
                    "questionFailureReason": question_trace.failure_reason,
                    "answerTraceStatus": answer_trace.assert_status,
                    "answerFailureReason": answer_trace.failure_reason,
                }
            )
            attempts.append({"attempt": attempt + 1, "feedback": feedback})
            completion = self._complete_code(question, answer, feedback=feedback)
            question_trace = self._interpret(completion.question_code, stage=f"question_interpreter_retry_{attempt + 1}")
            answer_trace = self._interpret(completion.answer_code, stage=f"answer_interpreter_retry_{attempt + 1}")

        code_quality = self._evaluate_code_quality(question, answer, completion, question_trace, answer_trace)
        alignment = self._evaluate_alignment(question, answer)

        code_score = code_quality.code_quality_score
        alignment_score = alignment.alignment_score

        return TacoResult(
            id=item_id,
            question=question,
            llm_answer=answer,
            code_quality_analysis=code_quality.code_quality_analysis,
            code_quality_score=code_score,
            alignment_analysis=alignment.alignment_analysis,
            alignment_score=alignment_score,
            alpha=self.alpha,
            overall_score=overall_score(code_score, alignment_score, self.alpha),
            reliability=reliability_from_scores(code_score, alignment_score),
            intermediate=TacoIntermediate(
                completion=completion,
                question_trace=question_trace,
                answer_trace=answer_trace,
                recompletion_attempts=attempts,
                raw=self._raw if self.keep_raw else {},
            ),
        )

    def _messages(self, content: str) -> list[dict[str, str]]:
        return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": content}]

    def _complete(self, stage: str, prompt: str) -> dict[str, Any]:
        text = self.client.complete(self._messages(prompt), temperature=self.temperature)
        if self.keep_raw:
            self._raw[stage] = text
        return parse_llm_json(text)

    def _complete_code(self, question: str, answer: str, *, feedback: str) -> CompletionArtifact:
        payload = self._complete(
            "test_case_and_completion",
            render_prompt(self._prompt("test_completion"), question=question, answer=answer, feedback=feedback),
        )
        return CompletionArtifact(
            question_code=payload.get("questionCode")
            or payload.get("question_code")
            or self._fallback_code_block("test_case_and_completion", 0),
            answer_code=payload.get("answerCode")
            or payload.get("answer_code")
            or self._fallback_code_block("test_case_and_completion", 1),
            test_case_summary=payload.get("testCaseSummary") or payload.get("test_case_summary") or "",
            reproduction_goal=payload.get("reproductionGoal") or payload.get("reproduction_goal") or "",
            resolution_goal=payload.get("resolutionGoal") or payload.get("resolution_goal") or "",
        )

    def _fallback_code_block(self, stage: str, index: int) -> str:
        blocks = extract_fenced_code(str(self._raw.get(stage, "")))
        if len(blocks) > index:
            return blocks[index]
        return ""

    def _interpret(self, code: str, *, stage: str) -> InterpreterTrace:
        payload = self._complete(stage, render_prompt(self._prompt("interpreter"), code=code))
        return InterpreterTrace(
            annotated_code=payload.get("annotatedCode") or payload.get("annotated_code") or "",
            assert_status=payload.get("assertStatus") or payload.get("assert_status") or "unknown",
            failure_reason=payload.get("failureReason") or payload.get("failure_reason") or "",
            trace_summary=payload.get("traceSummary") or payload.get("trace_summary") or "",
        )

    def _evaluate_code_quality(
        self,
        question: str,
        answer: str,
        completion: CompletionArtifact,
        question_trace: InterpreterTrace,
        answer_trace: InterpreterTrace,
    ) -> CodeQuality:
        payload = self._complete(
            "code_quality",
            render_prompt(
                self._prompt("code_quality"),
                question=question,
                answer=answer,
                question_code=completion.question_code,
                question_trace=question_trace.model_dump_json(indent=2),
                answer_code=completion.answer_code,
                answer_trace=answer_trace.model_dump_json(indent=2),
            ),
        )
        return CodeQuality(
            code_quality_analysis=payload.get("codeQualityAnalysis")
            or payload.get("code_quality_analysis")
            or self._join_analysis(payload, ["questionAnalysis", "generatedCodeAnalysis", "acceptabilityEvaluation"])
            or "",
            code_quality_score=payload.get("codeQualityScore")
            or payload.get("code_quality_score")
            or payload.get("acceptabilityScore")
            or 0,
        )

    def _evaluate_alignment(self, question: str, answer: str) -> Alignment:
        payload = self._complete(
            "alignment",
            render_prompt(self._prompt("alignment"), question=question, answer=answer),
        )
        return Alignment(
            alignment_analysis=payload.get("alignmentAnalysis")
            or payload.get("alignment_analysis")
            or self._join_analysis(payload, ["questionAnalysis", "answerAnalysis", "alignmentEvaluation"])
            or "",
            alignment_score=payload.get("alignmentScore") or payload.get("alignment_score") or 0,
        )

    @staticmethod
    def _join_analysis(payload: dict[str, Any], keys: list[str]) -> str:
        parts = [str(payload[key]).strip() for key in keys if payload.get(key)]
        return "\n\n".join(parts)

    def _prompt(self, name: str) -> str:
        return get_prompts(self.language)[name]
