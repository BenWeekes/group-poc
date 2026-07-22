# 04 Conventions

> Implementation and documentation conventions for comparable, bounded evaluations.

## Configuration and prompts

- Agent and tool names use lowercase snake case; handoff functions are `handoff_to_<agent>`.
- The root `llm` supplies defaults. Use overrides only when a model/provider difference is intentional.
- Define tools once at root, then give each specialist the smallest tool allow-list.
- Use flat snake-case variables and captures for state; do not ask a destination model to rediscover facts in prose.
- Prompts state the role's bounded job, preferred next action, and prohibited actions. Keep voice replies short.

## Code and evaluation

- Add a tool in both `tool_client.js` and `tools/service.js`.
- State-changing mock tools append events to ignored runtime JSON.
- Return OpenAI-style errors under `error.message` and POC trace data under `group_poc`.
- Evaluators keep reports outside Git and distinguish actual provider usage from deterministic prompt estimates.

## Documentation

- Proposal: `agent_team.md`; complete JSON: `agent_team_join.md`; API contract: `docs_llm.md`.
- Update `docs/ai` after source, interface, workflow, security, deployment, or evaluation changes.
- Use lowercase present-tense conventional commits. Never commit provider keys.

## Related Deep Dives

- [Team runtime](L2/team_runtime.md) — function schemas and variable lifecycle.
