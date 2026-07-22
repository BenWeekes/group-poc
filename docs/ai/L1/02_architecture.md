# 02 Architecture

> System design, service boundaries, and the agent-team turn lifecycle.

## Components

```text
Agora ConvoAI engine -> Nginx /group-poc/llm/ -> Custom LLM (:8110)
Custom LLM -> selected provider and private Tool service (:8111)
Tool service -> file-backed mock account/event store
```

## Team runtime

- `llm.agents` selects team mode; omission keeps the legacy deterministic mode.
- `agents[0]` is entry. Session state is keyed by `appId:userId:channel`.
- Every caller turn supplies the full `llm` object. The runtime preserves active agent, variables, and history.
- It applies root-to-agent inheritance, rebuilds the selected system prompt, and exposes only the agent's tools and handoffs.
- Handoff function calls set a new active agent and write capture arguments into shared variables.

## Interrupts and providers

- Deterministic interrupts run before model selection for cease-contact, acute distress, and prohibited payment side channels.
- Root defaults use an OpenAI-compatible provider; an agent can override URL, secret template, model, or parameters.
- Tools execute through fixed internal mappings. Tool captures update state without model parsing.
- This POC uses mock JSON data and logical human escalation only.

## Related Deep Dives

- [Team runtime](L2/team_runtime.md) — tool loops, handoffs, variables, and history.
