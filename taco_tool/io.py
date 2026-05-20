from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable


def read_records(path: str | Path) -> list[dict[str, Any]]:
    source = Path(path)
    if source.suffix.lower() == ".jsonl":
        records = []
        with source.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        return records

    with source.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return [dict(item) for item in data]
    if isinstance(data, dict):
        if "data" in data and isinstance(data["data"], list):
            return [dict(item) for item in data["data"]]
        return [dict(data)]
    raise ValueError(f"Unsupported input JSON shape in {source}")


def append_jsonl(path: str | Path, records: Iterable[dict[str, Any]]) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def read_completed_ids(path: str | Path, id_field: str = "id") -> set[str]:
    target = Path(path)
    if not target.exists():
        return set()
    completed: set[str] = set()
    with target.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if record.get(id_field) is not None:
                completed.add(str(record[id_field]))
    return completed


def resolve_item_id(record: dict[str, Any], fallback: int) -> str | int:
    for key in ("id", "dataID", "ID_hash", "question_id", "questionId"):
        if key in record and record[key] is not None:
            return record[key]
    return fallback
