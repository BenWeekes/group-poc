# 03 Code Map

> Directory map and responsibilities for the executable proposal.

## Top-level layout

| Path | Responsibility |
| --- | --- |
| `agent_team.md` | Product proposal and worked examples |
| `agent_team_join.md` | Full proposed Agora `llm` JSON |
| `docs_llm.md` | Developer-facing capability specification |
| `custom-llm/` | OpenAI-compatible team runtime and evaluators |
| `tools/` | Private file-backed REST mock service |
| `deploy/sa-dev.conf` | Additive Nginx configuration |

## Custom LLM files

| File | Responsibility |
| --- | --- |
| `src/server.js` | Endpoint, session maps, legacy/team mode, SSE response |
| `src/team_runtime.js` | Inheritance, tools, handoffs, interrupts, provider tool loop |
| `src/tool_client.js` | Fixed name-to-private-REST mapping |
| `src/router.js` | Legacy deterministic routing and metrics estimates |
| `evals/debt_recovery_team_llm.json` | Full team fixture sent on every evaluation turn |

## Evaluators and tools

- `evals/run.js`: deterministic route assertions.
- `evals/team_eval.js`: compact real-provider tool and handoff checks.
- `evals/engine_replay_eval.js`: engine-shaped public endpoint replay.
- `evals/simulated_caller_eval.js`: independent phase-constrained caller LLM.
- `evals/eval_150_turn_compare.js`: 75 caller turns / 150 dialogue-message same-trace benchmark with per-pass input telemetry.
- `tools/service.js`: authenticated mock endpoints and append-only event log.
- `tools/data/accounts.json`: committed seed; `accounts.runtime.json`: ignored mutable state.

## Related Deep Dives

- [Team runtime](L2/team_runtime.md) — source-level runtime map.
- [Evaluation harness](L2/evaluation_harness.md) — evaluator roles and limits.
