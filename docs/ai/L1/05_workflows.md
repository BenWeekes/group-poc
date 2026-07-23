# 05 Workflows

> Repeatable workflows for adding specialists, tools, evaluations, and deployment changes.

## Add a specialist

1. Add its definition to `agent_team_join.md` and the executable fixture.
2. Give it a bounded prompt, required variables, scoped tools, and explicit handoffs.
3. Decide normal versus global availability.
4. Add synthetic and transcript-derived turns proving entry and exit routes.
5. Run deterministic, team, and replay evaluations.
6. Update the product proposal, API document, and relevant `docs/ai` files.

## Add a REST tool

1. Define root `llm.tools` schema, request, captures, and concise result.
2. Add its fixed mapping in `custom-llm/src/tool_client.js`.
3. Implement the private mock route in `tools/service.js`.
4. Give the tool only to agents that need it.
5. Verify secret authentication, capture values, and an evaluation trace.

## Evaluate a conversation

1. Build the stack with local secrets.
2. Use `eval:engine-replay` for repeatable regression checks through the public route.
3. Use `eval:simulated-caller` for adaptive counterpart behaviour with controlled phases.
4. Save reports in `/tmp` or ignored `reports/`.
5. For the principal comparison, run `eval:150-turn-compare`: 75 caller turns across the four source-derived profiles, replayed identically to the single prompt, immediate team, template-deferred team, and structured-deferred team with GPT-4o-mini at temperature zero.
6. Compare pathway, tool calls, transfer count, tool-execution errors, provider latency, actual input-token size per provider pass, history-message count, and tool-schema count.

## Deploy

1. Start the Compose stack on the server.
2. Validate Nginx before reload.
3. Install only `/group-poc/llm/`; leave `location /` untouched.
4. Check both the existing root application and POC `/ping` afterwards.

## Related Deep Dives

- [Evaluation harness](L2/evaluation_harness.md) — evaluation methods and metrics.
