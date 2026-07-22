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

## Important artefacts

- [Important runs](important_runs.md) — curated conversations, metrics, observations, and open findings.
- `debt_recovery_team_llm.json` — normal team fixture; global safeguards remain enabled.
- `monolithic_debt_recovery_llm.json` — deliberately large one-agent policy and full tool scope.
- `transcript_user_profiles.json` — source-derived caller facts and ordered beats. It is not a raw transcript.

## Shared controls

Comparative runs should use the same provider/model, temperature, tool service, endpoint, and session shape for both variants. If global runtime safeguards are disabled for an architecture-only comparison, disable them for both variants and state that clearly in the report.
