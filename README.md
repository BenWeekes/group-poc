# Group POC — safe multi-agent call routing

This proof of concept evaluates a specialised-agent architecture for outbound account and payment-support calls. It uses a Custom LLM server compatible with Agora ConvoAI, a file-backed mock tool service, and synthetic English evaluation conversations.

## Documentation

- [Agent team and safety model](agent_team.md)
- [Proposed Agora session configuration](agent_team_join.md)
- [Developer API: multi-agent `llm` capability](docs_llm.md)

## POC components

- `custom-llm/` — OpenAI-compatible Custom LLM proxy. It picks a specialist agent, scopes tools, applies deterministic safety gates, and delegates tool execution to the tool service.
- `tools/` — local REST API with a JSON-file account store. It is private to the Docker network; it is never exposed through Nginx.
- `evals/` — synthetic English test cases and the comparative evaluation runner.

## Deployment shape

The public endpoint is intended to be:

`https://sa-dev.agora.io/group-poc/llm/chat/completions`

Nginx proxies only this prefix to the dedicated POC container. The existing `sa-dev.agora.io/` application is left unchanged.

## Run and evaluate

```bash
docker compose up -d --build
docker compose exec -T custom-llm npm test
docker compose exec -T custom-llm npm run eval
```

`LLM_API_KEY` is optional for deterministic mock/evaluation mode. When Agora sends a bearer token, the Custom LLM follows the existing `server-custom-llm` convention and forwards it to the configured upstream LLM.

## Status

This is a prototype with mock data only. It must not be used for real debt collection, payment processing, or real customer information.
