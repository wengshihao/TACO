from __future__ import annotations

import argparse
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import yaml
from tqdm import tqdm

from .engine import TacoEngine
from .io import append_jsonl, read_completed_ids, read_records, resolve_item_id
from .llm import OpenAICompatibleClient


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="taco",
        description="Run TACO trust assessment for coding-assistance responses.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    run = subparsers.add_parser("run", help="Evaluate records from JSON or JSONL.")
    run.add_argument("--input", required=True, help="Input JSON/JSONL file.")
    run.add_argument("--output", required=True, help="Output JSONL file.")
    run.add_argument("--question-field", default="question", help="Question field name.")
    run.add_argument("--answer-field", default="llmanswer", help="LLM answer field name.")
    run.add_argument("--id-field", default=None, help="Optional explicit ID field.")
    run.add_argument("--alpha", type=float, default=0.5, help="Weight for code quality in S.")
    run.add_argument("--language", choices=["python", "java"], default="python", help="Programming language for TACO prompts.")
    run.add_argument("--max-recompletion", type=int, default=2, help="Max re-completion attempts.")
    run.add_argument("--temperature", type=float, default=0.0, help="LLM sampling temperature.")
    run.add_argument("--model", default=os.getenv("TACO_MODEL", "gpt-4o-mini"))
    run.add_argument("--base-url", default=os.getenv("TACO_BASE_URL"))
    run.add_argument("--api-key", default=os.getenv("TACO_API_KEY") or os.getenv("OPENAI_API_KEY"))
    run.add_argument("--config", default=None, help="YAML config with model/base_url/api_key_env.")
    run.add_argument("--limit", type=int, default=None, help="Evaluate at most N records.")
    run.add_argument("--start", type=int, default=0, help="Start offset before limit.")
    run.add_argument("--concurrency", type=int, default=1, help="Number of parallel records.")
    run.add_argument("--resume", action="store_true", help="Skip IDs already present in output.")
    run.add_argument("--no-raw", action="store_true", help="Do not store raw LLM responses.")
    return parser


def load_config(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    with Path(path).open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError("--config must point to a YAML object")
    return data


def make_client(args: argparse.Namespace, config: dict[str, Any]):
    api_key = args.api_key
    api_key_env = config.get("api_key_env")
    if api_key_env:
        api_key = os.getenv(str(api_key_env), api_key)
    return OpenAICompatibleClient(
        model=config.get("model", args.model),
        base_url=config.get("base_url", args.base_url),
        api_key=api_key,
        max_tokens=config.get("max_tokens"),
    )


def record_to_question_answer(
    record: dict[str, Any],
    *,
    question_field: str,
    answer_field: str,
) -> tuple[str, str]:
    if question_field not in record:
        raise KeyError(f"Missing question field '{question_field}'")
    if answer_field not in record:
        raise KeyError(f"Missing answer field '{answer_field}'")
    return str(record[question_field]), str(record[answer_field])


def run_batch(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    records = read_records(args.input)
    selected = records[args.start :]
    if args.limit is not None:
        selected = selected[: args.limit]

    completed = read_completed_ids(args.output) if args.resume else set()
    work_items: list[tuple[int, str | int, dict[str, Any]]] = []
    for index, record in enumerate(selected, start=args.start):
        item_id = record[args.id_field] if args.id_field else resolve_item_id(record, index)
        if args.resume and str(item_id) in completed:
            continue
        work_items.append((index, item_id, record))

    if not work_items:
        print("No records to evaluate.")
        return 0

    def evaluate_one(item: tuple[int, str | int, dict[str, Any]]) -> dict[str, Any]:
        _, item_id, record = item
        try:
            question, answer = record_to_question_answer(
                record,
                question_field=args.question_field,
                answer_field=args.answer_field,
            )
            client = make_client(args, config)
            engine = TacoEngine(
                client=client,
                alpha=args.alpha,
                max_recompletion=args.max_recompletion,
                temperature=args.temperature,
                keep_raw=not args.no_raw,
                language=args.language,
            )
            result = engine.evaluate(question, answer, item_id=item_id)
            return result.model_dump(mode="json")
        except Exception as exc:
            return {
                "id": item_id,
                "error": str(exc),
                "record": record,
            }

    if args.concurrency <= 1:
        for item in tqdm(work_items, desc="TACO"):
            append_jsonl(args.output, [evaluate_one(item)])
        return 0

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [executor.submit(evaluate_one, item) for item in work_items]
        for future in tqdm(as_completed(futures), total=len(futures), desc="TACO"):
            append_jsonl(args.output, [future.result()])
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "run":
        return run_batch(args)
    parser.error("Unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
