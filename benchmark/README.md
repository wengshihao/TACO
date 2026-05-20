# TACO Benchmark

This directory contains the benchmark data used with TACO.

## TACO-Eval

Path: `benchmark/TACO-Eval`

`data.json` contains 1,328 real-world Python coding-assistance tasks. Main fields:

- `question_id`: StackOverflow question ID.
- `title`: question title.
- `question_md`: user question in Markdown.
- `answer_md`: accepted answer in Markdown.

The `resp-*.json` files contain model responses collected for benchmark evaluation.

## TACO-Judge

Path: `benchmark/TACO-Judge`

JSONL files contain human-annotated Python coding-assistance responses. Common fields:

- `ID_hash`: anonymized item ID.
- `ishall`: whether the model response is hallucinated or untrustworthy.
- `question`: user question.
- `answer`: accepted StackOverflow answer, when available.
- `llmanswer`: model-generated answer to be evaluated.

## TACO-Judge-Java

Path: `benchmark/TACO-Judge-Java`

Java coding-assistance tasks and annotated model responses. Common fields:

- `question_id`
- `question`
- `llmanswer`
- `ishall`

## Recommended CLI Usage

```bash
taco run \
  --input benchmark/TACO-Judge/chatgpt4o.jsonl \
  --output outputs/chatgpt4o.taco.jsonl \
  --question-field question \
  --answer-field llmanswer \
  --resume
```
