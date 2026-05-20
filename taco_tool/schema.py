from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


Score = Literal[0, 1, 2, 3]


class CompletionArtifact(BaseModel):
    question_code: str = Field(default="")
    answer_code: str = Field(default="")
    test_case_summary: str = Field(default="")
    reproduction_goal: str = Field(default="")
    resolution_goal: str = Field(default="")
    assert_status: Literal["pass", "fail", "unknown"] = "unknown"
    failure_reason: str = Field(default="")

    @field_validator("assert_status", mode="before")
    @classmethod
    def normalize_assert_status(cls, value: Any) -> str:
        return normalize_status(value)


class InterpreterTrace(BaseModel):
    annotated_code: str = Field(default="")
    assert_status: Literal["pass", "fail", "unknown"] = "unknown"
    failure_reason: str = Field(default="")
    trace_summary: str = Field(default="")

    @field_validator("assert_status", mode="before")
    @classmethod
    def normalize_assert_status(cls, value: Any) -> str:
        return normalize_status(value)


class CodeQuality(BaseModel):
    code_quality_analysis: str = Field(default="")
    code_quality_score: Score = 0

    @field_validator("code_quality_score", mode="before")
    @classmethod
    def normalize_score(cls, value: Any) -> int:
        return normalize_score(value)


class Alignment(BaseModel):
    alignment_analysis: str = Field(default="")
    alignment_score: Score = 0

    @field_validator("alignment_score", mode="before")
    @classmethod
    def normalize_score(cls, value: Any) -> int:
        return normalize_score(value)


class TacoIntermediate(BaseModel):
    completion: CompletionArtifact
    question_trace: InterpreterTrace
    answer_trace: InterpreterTrace
    recompletion_attempts: list[dict[str, Any]] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class TacoResult(BaseModel):
    id: str | int | None = None
    question: str
    llm_answer: str
    code_quality_analysis: str
    code_quality_score: Score
    alignment_analysis: str
    alignment_score: Score
    alpha: float
    overall_score: float
    reliability: Literal[0, 1]
    intermediate: TacoIntermediate


def normalize_score(value: Any) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        return 0
    return min(3, max(0, score))


def normalize_status(value: Any) -> str:
    text = str(value or "unknown").strip().lower()
    if text in {"pass", "passed", "success", "succeed", "succeeds"}:
        return "pass"
    if text in {"fail", "failed", "failure", "error"}:
        return "fail"
    return "unknown"


def reliability_from_scores(code_score: int, alignment_score: int) -> int:
    return 1 if min(code_score, alignment_score) >= 2 else 0


def overall_score(code_score: int, alignment_score: int, alpha: float) -> float:
    bounded_alpha = min(1.0, max(0.0, alpha))
    return round((bounded_alpha * code_score) + ((1.0 - bounded_alpha) * alignment_score), 4)
