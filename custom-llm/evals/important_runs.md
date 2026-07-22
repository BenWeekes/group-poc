# Important evaluation runs

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

## Next experiments

1. Make a handoff a server/runtime state transition rather than an LLM tool completion; compare perceived voice latency.
2. Run paired A-2 and B-2 adaptive profiles repeatedly, retaining only deidentified traces and outcome scores.
3. Label repeated-question, caller-repetition, contradiction, and unsafe-tool events independently of model outputs.
4. Add a concurrency test for the serialized JSON mock store and replace it with a durable store before any non-POC use.
