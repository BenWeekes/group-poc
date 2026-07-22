# Group POC — Agora team-of-agents proposal and evaluation

This repository is a proposal and working evaluation for an Agora team-of-agents capability. It explores how one ConvoAI session can transfer between specialist agents, preserve context, scope tools, and measure the result against a single-prompt baseline.

Debt recovery is the working evaluation domain because it produces realistic routing pressure: identity verification, payment options, payment failures, hardship, disputes, communication preferences, and escalation. The architecture is intentionally reusable for other Agora agent-team use cases.

## Documentation

- [Debt-recovery agent team and workflow model](agent_team.md)
- [Proposed Agora session configuration](agent_team_join.md)
- [Developer API: multi-agent `llm` capability](docs_llm.md)
- [Live team versus single-prompt comparison](team_comparison.md)
- [AI-oriented repository docs](docs/ai/L0_repo_card.md)

## POC components

- `custom-llm/` — OpenAI-compatible Custom LLM proxy. It selects a specialist agent, scopes tools, applies deterministic policy routing, and delegates tool execution to the tool service.
- `tools/` — local REST API with a JSON-file account store. It is private to the Docker network; it is never exposed through Nginx.
- `custom-llm/evals/` — deterministic routes, transcript-derived long replays, and an independent LLM caller simulator.
- [Curated evaluation conversations and observations](custom-llm/evals/important_runs.md)

## Deployment shape

The public endpoint is intended to be:

`https://sa-dev.agora.io/group-poc/llm/chat/completions`

Nginx proxies only this prefix to the dedicated POC container. The existing `sa-dev.agora.io/` application is left unchanged.

## Run and evaluate

```bash
docker compose up -d --build
docker compose exec -T custom-llm npm test
docker compose exec -T custom-llm npm run eval
docker compose exec -T custom-llm npm run eval:engine-replay
docker compose exec -T custom-llm npm run eval:simulated-caller
```

`LLM_API_KEY` is optional for deterministic mock/evaluation mode. When Agora sends a bearer token, the Custom LLM follows the existing `server-custom-llm` convention and forwards it to the configured upstream LLM.

## Status

This is a prototype with mock data only. It is for evaluating the agent-team model, not for real debt collection, payment processing, or real customer information. The long replays are deidentified caller-side approximations of machine-translated recordings; they are not verbatim transcripts.
