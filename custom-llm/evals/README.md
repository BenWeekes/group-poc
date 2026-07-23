# Evaluation runs

This directory contains executable fixtures, evaluators, and a small curated history of important deidentified runs. Raw provider responses and ad-hoc reports belong in `/tmp` or ignored `reports/`; do not commit credentials or raw recordings.

## Run types

| Command | Fixture / client | Purpose |
| --- | --- | --- |
| `npm run eval` | `cases.json` | Deterministic route regression suite |
| `npm run eval:team` | `debt_recovery_team_llm.json` | Short team tool/handoff smoke test |
| `npm run eval:engine-replay` | `long_replay_cases.json` | Fixed caller-side replay through the public endpoint |
| `npm run eval:compare` | team + monolithic fixtures | Same replay, token/tool/latency comparison |
| `npm run eval:complex-compare` | `complex_multi_tool_case.json` | Seven-step same-model multi-tool comparison |
| `npm run eval:transcript-user` | `transcript_user_profiles.json` | Preview a history-aware source-derived caller trace |
| `npm run eval:transcript-user-call` | profile + one `llm` config | Run a history-aware caller against one configuration |
| `npm run eval:transcript-user-compare` | profile + both configs | Paired adaptive caller runs under same-model controls |
| `npm run eval:150-turn-compare` | all four profiles + four configs | Primary 75-caller-turn / 150-dialogue-message comparison: single prompt, immediate team, template-deferred team, and structured-deferred team, with per-pass context telemetry |

## Important artefacts

- [Important runs](important_runs.md) — curated conversations, metrics, observations, and open findings.
- `debt_recovery_team_llm.json` — normal team fixture; global safeguards remain enabled.
- `monolithic_debt_recovery_llm.json` — deliberately large one-agent policy and full tool scope.
- `transcript_user_profiles.json` — source-derived caller facts and ordered beats. It is not a raw transcript.

## Shared controls

Comparative runs should use the same provider/model, temperature, tool service, endpoint, and session shape for both variants. If global runtime safeguards are disabled for an architecture-only comparison, disable them for both variants and state that clearly in the report.

The deferred team uses `activation: "next_user_turn"` for routine transitions with a pre-authored next question. Its tool call and transition message are retained in shared history, but it does not make a second provider pass until the caller answers. Escalations and cases needing an immediate specialist action remain immediate handoffs.

The Structured Deferred variant uses `handoff_protocol: { "mode": "response_sidecar" }` for the Intake-to-Account transition. It returns caller-visible content plus hidden validated handoff metadata, rather than exposing a handoff function. Use `EVAL_VARIANTS=structured` to run that variant alone against a cached trace; comma-separate `team,deferred,structured,monolithic` to select multiple variants.

For a repeatable 150-turn rerun across container rebuilds, set `TRACE_OUTPUT_PATH=/app/reports/eval150_trace.json` on the first run, then set `CALLER_TRACE_PATH=/app/reports/eval150_trace.json` on later runs. `reports/` is ignored; commit only the curated summary and observations.
