# Evaluation Harness

> **When to Read This:** Load this document when running or changing evaluation cases, caller simulation, providers, metrics, or reports.

## Layers

| Layer | Command | Demonstrates | Does not demonstrate |
| --- | --- | --- | --- |
| Unit/router | `npm test`, `npm run eval` | deterministic intents and legacy metrics | provider tool quality |
| Team smoke | `npm run eval:team` | full team configuration, captures, tools, and handoffs | long-call consistency |
| Engine replay | `npm run eval:engine-replay` | engine-shaped public requests with full `llm` and SSE | exact original audio transcription |
| Simulated caller | `npm run eval:simulated-caller` | adaptive counterpart using an independent caller LLM | real-caller or production quality |

## Engine-shaped evaluation

The real-provider evaluators send the full `debt_recovery_team_llm.json` fixture on every caller turn, stable session context, and `stream: true`. The default endpoint is the public Nginx path, not a direct container port. Use `CUSTOM_LLM_URL` only to intentionally test a different deployment.

## Replay data

`long_replay_cases.json` contains deidentified English caller sequences based on the supplied recordings: payment pressure/distress, changed-card failures, side-channel instructions, and a time request followed by cease-contact. They preserve pathway pressure without claiming exact wording or speaker attribution. Use `CASE_NAME` to isolate a case and `REPORT_PATH=/tmp/report.json` to save an ignored report.

## Independent caller model

`simulated_caller_eval.js` makes an upstream LLM play only the caller. Recent transcript is supplied with one current phase: failed card, payment options, inability to pay, distress, then stop-contact. The wording is adaptive, while phase constraints prevent the caller from collapsing every issue into a single utterance.

This reveals tool/prompt/handoff gaps that fixed replay alone can miss. Record selected agent, functions, handoff path, per-pass and per-turn latency, and actual provider usage. Never treat deterministic prompt estimates and actual provider token accounting as one measure.

## Team versus single-prompt baseline

`eval:compare` runs the same 28 replay turns through the team fixture and a one-agent fixture with the full prompt and all ten tools. The baseline is deliberately a single team-runtime agent so both variants use the same endpoint, tool service, SSE mode, session handling, and provider API. `TEAM_FORCE_ROOT_PROVIDER=true` removes agent-level provider overrides for an architecture-only run.

`team_comparison.md` records the latest completed three-way GPT-4o-mini run: Single Prompt, Immediate Handoff, and Template Deferred Handoff. It reports lower team context/tool exposure, but does not establish that teams are more accurate or faster overall. Treat it as reproducible POC evidence, not a production conclusion.

`eval:complex-compare` is a stricter seven-turn test with the same provider/model, temperature zero, shared tools, and global interrupts disabled in both variants. It is designed to cross multiple tool and policy boundaries. It found and then regression-tested a Payment Options prompt defect, so its final tie is evidence about token/tool scope rather than a claim of general superiority.

## Primary 150-message comparison

`eval:150-turn-compare` is the primary benchmark. It generates one source-derived, history-aware caller trace containing 75 caller turns spread across four independent recording profiles: A-1 18 turns, A-2 18, B-1 18, B-2 21. That trace is replayed unchanged through the immediate team, template-deferred team, and a deliberately large single-prompt baseline, producing 150 dialogue messages per variant.

Raw `prompt_tokens` measure context exposure, not billed input after provider caching. Before making a cost or latency claim, record `prompt_tokens_details.cached_tokens`, set a stable cache key where the provider supports it, and repeat each paired variant several times. A stable monolithic prompt may have a cache advantage over changing specialist prompts/tool schemas.

Controls are GPT-4o-mini and temperature zero for every specialist and the baseline, shared private tools, stable streaming request shape, unique call IDs per source call, and global interrupts disabled in all three variants. Each provider pass records actual provider input tokens, input character count, bounded-history message count, scoped tool-schema count, completion tokens, latency, handoffs, and tool-execution errors. This makes the comparison about prompt/context and routing architecture rather than provider/model choice.

## Transcript-grounded caller emulator

`transcript_user_emulator.js` is a stateful caller client, not a fixed utterance list. Its JSON profiles contain deidentified immutable facts, ordered behavioural beats, repeat counts, transcript source line counts, and a turn limit. On each turn it gives a caller-model the current agent/caller history plus the current source-derived beat, then advances only under controller rules. It cannot invent account facts or turn into an agent.

`eval:transcript-user` previews a generated caller trace. `eval:transcript-user-call` runs it against a supplied full `llm` configuration and feeds the resulting agent reply into the next caller-model turn. Set `TRANSCRIPT_PROFILE=employee_a_2` or `employee_b_2`, `LLM_CONFIG=monolithic_debt_recovery_llm.json` for the baseline, and `REPORT_PATH` for an ignored report.

## See Also

- [Workflows](../05_workflows.md)
- [Gotchas](../07_gotchas.md)
