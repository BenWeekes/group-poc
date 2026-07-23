# Important evaluation runs

> **Recording status (2026-07-23):** the metrics below predate the current template-deferred runtime and global-handoff guard. They remain useful baseline evidence, but are not results for the current three-way configuration. A cached-trace rerun is required before publishing a deferred-team headline.

All conversations below use mock data and deidentified English caller language. The translated recordings do not reliably identify speakers, so transcript-grounded cases are caller-side emulations rather than verbatim transcripts.

## 2026-07-22 — controlled 28-turn replay

**Controls:** 28 fixed caller turns, same GPT-4o-mini for both variants, same private tools, streaming endpoint, global runtime safeguards disabled in both variants.

| Metric | Team | Single prompt |
| --- | ---: | ---: |
| HTTP success | 100% | 100% |
| Labelled critical-tool coverage | 100% | 87.5% |
| Extra verification tools | 0 / 4 | 4 / 4 |
| Provider tokens | 41,139 | 51,170 |
| Mean wall latency | 2,504 ms | 1,860 ms |

**Observation:** scoped tools reduced token use and prevented the observed unnecessary cease-contact call during verification. The team remained slower because a handoff currently consumes an additional provider completion.

## 2026-07-22 — complex multi-tool call

**Controls:** same GPT-4o-mini, temperature zero, shared tools, global safeguards disabled for both. Required sequence: verify → failed-card investigation → official follow-up → payment options → promise-to-pay → hardship → cease-contact.

| Metric | Team | Single prompt |
| --- | ---: | ---: |
| Ordered required actions | 7 / 7 | 7 / 7 |
| Forbidden tool calls | 0 | 0 |
| Provider tokens | 18,897 | 20,890 |
| Mean wall latency | 3,056 ms | 2,063 ms |

**First-run finding and fix:** the team incorrectly escalated an ordinary `50 on 2026-07-25` promise to Human Specialist. The Payment Options prompt now says an ordinary confirmed amount is not a settlement/exception; the same test then passed.

### Curated team conversation after the fix

| Turn | Caller-side source-derived utterance | Selected specialist | Tool outcome |
| --- | --- | --- | --- |
| 1 | `blue harbour` | Account Status | verify right party; retrieve approved summary |
| 2 | Changed card; deduction failed; do not retry | Payment Troubleshooting | open investigation |
| 3 | Send confirmed next step officially | Payment Troubleshooting | official follow-up |
| 4 | Cannot pay full balance; ask approved options | Payment Options | retrieve options |
| 5 | `50` on `2026-07-25`; record and confirm | Payment Options | record promise; official follow-up |
| 6 | Pressure affects sleep; need support, not payment | Hardship Support | create hardship case; no payment tool |
| 7 | Stop collection calls and messages | Contact Preference | record preference |

## 2026-07-22 — transcript-grounded caller emulator

Two profiles are available for longer calls: A-2 has 116 source line utterances and produces up to 18 caller turns; B-2 has 247 source line utterances and produces up to 24. The emulator has immutable source facts, ordered beats, mandatory verification answer, repeat counts, and the last 12 caller/agent messages.

**Open finding:** an early preview embedded the verification answer inside a sentence, which correctly failed the team verifier. The client now emits the challenge answer exactly for the verification beat. This is why caller simulators need their own validation, not just fluent text generation.

## 2026-07-22 — primary 150-dialogue-message same-model run

**Controls:** GPT-4o-mini for every team specialist and the single prompt; temperature zero; same 75-turn caller trace; same tool service; unique call IDs; global interrupts disabled in both variants. The trace was source-derived across four separate calls: A-1 18 caller turns, A-2 18, B-1 18, B-2 21. Each side therefore processed 75 caller turns and 75 agent replies.

| Metric | Team | Single prompt | Team change |
| --- | ---: | ---: | ---: |
| HTTP success | 100% | 100% | — |
| Tool-execution errors | 0 | 0 | — |
| Expected-action coverage | 60% | 90% | -30 points |
| LLM logic-error turns | 4 | 1 | +3 |
| Total provider tokens | 122,727 | 158,099 | **-22.4%** |
| Mean actual provider input tokens / pass | 925 | 1,305 | **-29.1%** |
| Mean input characters / pass | 4,799 | 5,608 | **-14.4%** |
| Mean history messages / pass | 19.4 | 19.2 | Similar |
| Mean visible tool schemas / pass | 2.0 | 10.0 | **-79.9%** |
| Provider passes | 126 | 119 | +7 |
| Handoffs | 15 | 0 | +15 |
| Mean wall latency / caller turn | 2,038 ms | 1,549 ms | **+31.5%** |

**What this proves:** the team architecture materially reduces actual LLM input context and visible tool choice, even after 75 caller turns. The history window was similar; the savings came from smaller specialist prompts and tool scopes.

**What it does not prove:** teams were not more reliable in this run. After a WeChat/QQ report, Safety & Compliance stayed active and could not issue the later official follow-up or register the later contact preference. That accounts for three team action misses. The remaining team miss occurred because the model handed off to Safety & Compliance without calling its incident tool. The single prompt missed one later official-follow-up expectation.

The compact machine-readable record is [history_150_turn_summary.json](history_150_turn_summary.json). Raw per-turn traces are intentionally excluded from Git.

## Next experiments

1. Make a handoff a server/runtime state transition rather than an LLM tool completion; compare perceived voice latency.
2. Run paired A-2 and B-2 adaptive profiles repeatedly, retaining only deidentified traces and outcome scores.
3. Label repeated-question, caller-repetition, contradiction, and unsafe-tool events independently of model outputs.
4. Add a concurrency test for the serialized JSON mock store and replace it with a durable store before any non-POC use.
5. Safety & Compliance now has official-follow-up and Contact Preference/Human Specialist routes after logging an incident. Rerun the exact cached 150-message trace to measure this fix.
