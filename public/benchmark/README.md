# TACO Benchmark

- `TACO-Eval/`
- `TACO-Judge/`
- `TACO-Judge-Java/`

The benchmark files are packaged in the repository under `benchmark/`.

Use the local CLI for large-scale runs:

```bash
taco run --input benchmark/TACO-Judge/chatgpt4o.jsonl --output outputs/result.jsonl --question-field question --answer-field llmanswer --resume
```
