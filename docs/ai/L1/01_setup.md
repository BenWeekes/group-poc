# 01 Setup

> Environment setup, commands, environment variables, and evaluation entry points.

## Prerequisites

- Docker Compose runs both Node.js 20 services.
- Nginx access is only needed to deploy the reviewed narrow proxy route.
- Real-provider evaluations need local `OPENAI_API_KEY`. The Debt Recovery Team comparison fixture uses GPT-4o-mini for every specialist and the single-prompt baseline.

## Local configuration

1. Copy `.env.example` to ignored `.env`.
2. Set a non-empty `INTERNAL_TOOL_SECRET`.
3. Add provider keys only for real-provider evaluation.
4. Start services: `docker compose up -d --build`.

The tool service is Docker-network-only. Custom LLM binds on `127.0.0.1:8110`; Nginx is the public boundary.

## Commands

| Command | Purpose |
| --- | --- |
| `docker compose exec -T custom-llm npm test` | Router unit tests |
| `docker compose exec -T custom-llm npm run eval` | Deterministic route cases |
| `docker compose exec -T custom-llm npm run eval:team` | Short real-provider team checks |
| `docker compose exec -T custom-llm npm run eval:engine-replay` | Long public-endpoint replay |
| `docker compose exec -T custom-llm npm run eval:simulated-caller` | Separate LLM caller evaluation |
| `docker compose exec -T custom-llm npm run eval:150-turn-compare` | Primary 150-dialogue-message, same-model comparison |

## Endpoints

| Endpoint | Result |
| --- | --- |
| `http://127.0.0.1:8110/ping` | Custom LLM health JSON |
| `https://sa-dev.agora.io/group-poc/llm/ping` | Nginx-routed health JSON |
| `https://sa-dev.agora.io/group-poc/llm/chat/completions` | OpenAI-compatible Custom LLM |

## Related Deep Dives

- [Evaluation harness](L2/evaluation_harness.md) — real-provider and simulated-caller execution.
