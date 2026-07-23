# Team comparison

This is the concise comparison of the three supported conversation designs. It uses the latest completed fixed-trace, same-model run. For evaluator controls and additional functional checks, see [Evaluation results](custom-llm/evals/important_runs.md).

## Designs

1. **Single Prompt** — one agent has the complete prompt and every tool schema.
2. **Immediate Handoff** — the source agent selects a specialist and that specialist replies to the current caller turn. A transfer can require two sequential LLM calls.
3. **Template Deferred Handoff** — the source agent selects a routine handoff; ConvoAI speaks the configured next question; the specialist handles the next caller turn.

## 150-message fixed-trace comparison

**Controls:** 75 caller turns across four source-derived profiles; GPT-4o-mini for all variants; temperature zero; same mock tools; unique call IDs; global interrupts disabled in all variants.

| Metric | Single Prompt | Immediate Handoff | Template Deferred Handoff |
| --- | ---: | ---: | ---: |
| HTTP success | 100% | 98.7% | 100% |
| Expected-action coverage, same turn | **90%** | 70% | 40% |
| Expected action within next three caller turns | n/a | n/a | 70% |
| Provider passes | 119 | 126 | **114** |
| Total provider tokens | 159,427 | 131,348 | **104,624** |
| Mean input tokens / provider pass | 1,316 | 995 | **880** |
| Mean visible tool schemas / provider pass | 10.0 | 2.5 | **2.0** |
| Mean wall latency / caller turn | **1,276 ms** | 1,798 ms | 1,444 ms |
| Logic-error turns | **3** | 3 | 6 |
| Tool-execution errors | **0** | 0 | 2 |

## Reading the result

- Both team designs reduced LLM input context and visible tool choice.
- Template Deferred used 34% fewer provider tokens than Single Prompt and 20% lower caller-turn latency than Immediate Handoff in this run.
- Single Prompt had the best measured same-turn coverage and latency. The evidence does not show Teams are automatically more accurate or faster overall.
- Deferred routing moves some work to the next caller turn. Its three-turn pathway score is the relevant comparison, not only same-turn action coverage.

Immediate Handoff had one 500 response: a contact-limit turn exceeded the five-pass tool-loop limit, not a provider timeout. The error counts are architecture-only measurements: global interrupts were disabled for all variants and should not be read as production safety rates.

## Reproduce

```bash
CALLER_TRACE_PATH=reports/eval150_deferred_trace.json \
REPORT_PATH=reports/eval150_report.json \
npm --workspace custom-llm run eval:150-turn-compare
```
