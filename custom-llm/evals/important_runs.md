# Evaluation results

All runs use mock data and deidentified English caller language derived from the source recordings. They measure a proof of concept, not production debt-recovery performance.

## Patterns compared

1. **Single prompt** — one agent, one large prompt, and every tool schema.
2. **Immediate Handoff** — a specialist replies to the current caller turn; a transfer can require a second serial provider pass.
3. **Template Deferred Handoff** — the source agent calls a routine handoff function, the runtime speaks its configured next question, and the specialist begins on the next caller turn.

## Main comparison — 150 dialogue messages

**Latest completed three-way run:** 2026-07-23. The same fixed, source-derived trace was replayed for all patterns: 75 caller turns across four profiles, GPT-4o-mini at temperature zero, the same private mock tools, unique call IDs, and global interrupts disabled for architecture-only comparison.

| Metric | Single prompt | Immediate Handoff | Template Deferred Handoff |
| --- | ---: | ---: | ---: |
| HTTP success | 100% | 98.7% | 100% |
| Expected-action coverage, same turn | **90%** | 70% | 40% |
| Expected action within next three caller turns | n/a | n/a | 70% |
| LLM logic-error turns | **3** | 3 | 6 |
| Tool-execution errors | **0** | 0 | 2 |
| Provider passes | 119 | 126 | **114** |
| Handoffs | 0 | 16 | 21 (8 deferred) |
| Total provider tokens | 159,427 | 131,348 | **104,624** |
| Mean provider input tokens / pass | 1,316 | 995 | **880** |
| Mean visible tool schemas / pass | 10.0 | 2.5 | **2.0** |
| Mean wall latency / caller turn | **1,276 ms** | 1,798 ms | 1,444 ms |
| Mean provider latency / pass | **801 ms** | 1,038 ms | 947 ms |

### Findings

- Both team designs reduced model input versus the single prompt. Template Deferred used 34% fewer total provider tokens and exposed 80% fewer tool schemas per pass.
- Template Deferred removed 12 provider passes versus Immediate Handoff and reduced mean caller-turn latency by 20% (1,798 ms to 1,444 ms) in this run.
- Single prompt had the best measured same-turn action coverage and caller-turn latency. This evaluation does **not** prove Teams are more accurate overall.
- Deferred routing moves a specialist action to the next caller response. Its fairer pathway measure is therefore action coverage within the next three caller turns, not same-turn coverage.

These results were recorded before the later history-sanitisation and global-handoff guard hardening. Those changes do not alter the three benchmark configurations, but the full replay should be repeated with cache-token telemetry before making cost or latency claims beyond this POC.

The machine-readable summary is [history_150_turn_summary.json](history_150_turn_summary.json). Raw provider traces are intentionally not committed.

## Deterministic routing regression

`npm run eval` runs 12 source-derived routing cases without a provider. All 12 passed on 2026-07-23, including right-party verification, failed payment, hardship/distress, cease contact, side-channel instructions, fraud, and wrong-destination payment.

| Metric | Result |
| --- | ---: |
| Pathway accuracy | 100% (12 / 12) |
| Mean deterministic route latency | 0.15 ms |
| Estimated specialist-prompt reduction | 75.5% |

## Runtime contract regression

`npm test` has 14 passing tests. It covers bounded history, provider-history sanitisation, deferred/global handoff rules, deferred activation over two HTTP requests, sidecar graceful fallback, and tool scoping after verification.

## Reproducing the main comparison

```bash
CALLER_TRACE_PATH=reports/eval150_deferred_trace.json \
REPORT_PATH=reports/eval150_report.json \
npm --workspace custom-llm run eval:150-turn-compare
```

The runner uses a fixed trace when `CALLER_TRACE_PATH` is supplied, applies per-request timeouts, and checkpoints each completed variant to `REPORT_PATH`.
