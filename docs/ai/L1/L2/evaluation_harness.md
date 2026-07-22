# Evaluation Harness

> **When to Read This:** Load this document when running or changing evaluation cases, caller simulation, providers, metrics, or reports.

## Layers

| Layer | Command | Demonstrates | Does not demonstrate |
| --- | --- | --- | --- |
| Unit/router | `npm test`, `npm run eval` | deterministic intents and legacy metrics | provider tool quality |
| Team smoke | `npm run eval:team` | full team configuration, captures, tools, mixed providers | long-call consistency |
| Engine replay | `npm run eval:engine-replay` | engine-shaped public requests with full `llm` and SSE | exact original audio transcription |
| Simulated caller | `npm run eval:simulated-caller` | adaptive counterpart using an independent caller LLM | real-caller or production quality |

## Engine-shaped evaluation

The real-provider evaluators send the full `debt_recovery_team_llm.json` fixture on every caller turn, stable session context, and `stream: true`. The default endpoint is the public Nginx path, not a direct container port. Use `CUSTOM_LLM_URL` only to intentionally test a different deployment.

## Replay data

`long_replay_cases.json` contains deidentified English caller sequences based on the supplied recordings: payment pressure/distress, changed-card failures, side-channel instructions, and a time request followed by cease-contact. They preserve pathway pressure without claiming exact wording or speaker attribution. Use `CASE_NAME` to isolate a case and `REPORT_PATH=/tmp/report.json` to save an ignored report.

## Independent caller model

`simulated_caller_eval.js` makes an upstream LLM play only the caller. Recent transcript is supplied with one current phase: failed card, payment options, inability to pay, distress, then stop-contact. The wording is adaptive, while phase constraints prevent the caller from collapsing every issue into a single utterance.

This reveals tool/prompt/handoff gaps that fixed replay alone can miss. Record selected agent, functions, handoff path, per-pass and per-turn latency, and actual provider usage. Never treat deterministic prompt estimates and actual provider token accounting as one measure.

## See Also

- [Workflows](../05_workflows.md)
- [Gotchas](../07_gotchas.md)
