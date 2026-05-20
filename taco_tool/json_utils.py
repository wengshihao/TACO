from __future__ import annotations

import json
import re
from typing import Any

import json_repair


_FENCED_JSON = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)
_FENCED_CODE = re.compile(r"```(?:[A-Za-z0-9_+.-]+)?\s*(.*?)```", re.DOTALL)


def parse_llm_json(text: str) -> dict[str, Any]:
    """Parse JSON from a model response, accepting repaired JSON and fenced blocks."""
    candidates = []
    for match in _FENCED_JSON.finditer(text or ""):
        candidates.append(match.group(1))
    candidates.append(text or "")

    for candidate in candidates:
        try:
            parsed = json_repair.loads(candidate)
            if isinstance(parsed, dict):
                return dict(parsed)
        except Exception:
            continue

    start = (text or "").find("{")
    end = (text or "").rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json_repair.loads((text or "")[start : end + 1])
            if isinstance(parsed, dict):
                return dict(parsed)
        except Exception:
            pass
    return {}


def json_dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def extract_fenced_code(text: str) -> list[str]:
    return [match.group(1).strip() for match in _FENCED_CODE.finditer(text or "")]
