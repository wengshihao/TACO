from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Protocol

from openai import OpenAI


class ChatClient(Protocol):
    def complete(self, messages: list[dict[str, str]], *, temperature: float = 0.0) -> str:
        ...


@dataclass
class OpenAICompatibleClient:
    model: str = "gpt-4o-mini"
    api_key: str | None = None
    base_url: str | None = None
    timeout: float = 120.0
    max_retries: int = 3
    retry_sleep: float = 2.0
    max_tokens: int | None = None

    def __post_init__(self) -> None:
        self.api_key = self.api_key or os.getenv("TACO_API_KEY") or os.getenv("OPENAI_API_KEY")
        self.base_url = self.base_url or os.getenv("TACO_BASE_URL") or os.getenv("OPENAI_BASE_URL")
        self.model = os.getenv("TACO_MODEL", self.model)
        if not self.api_key:
            raise ValueError("Missing API key. Set TACO_API_KEY or pass --api-key.")
        self._client = OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)

    def complete(self, messages: list[dict[str, str]], *, temperature: float = 0.0) -> str:
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                kwargs = {
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                }
                if self.max_tokens:
                    kwargs["max_tokens"] = self.max_tokens
                response = self._client.chat.completions.create(**kwargs)
                return response.choices[0].message.content or ""
            except Exception as exc:  # pragma: no cover - depends on remote provider
                last_error = exc
                if attempt >= self.max_retries:
                    break
                time.sleep(self.retry_sleep * (attempt + 1))
        raise RuntimeError(f"LLM request failed after retries: {last_error}") from last_error
