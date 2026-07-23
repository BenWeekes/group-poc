# 06 Interfaces

> Boundary contracts for the proposed Agora configuration, Custom LLM endpoint, and internal REST tools.

## Engine request

```json
{
  "llm": { "agents": ["full team configuration"] },
  "context": { "appId": "app", "userId": "caller", "channel": "call-1" },
  "messages": [{ "role": "user", "content": "caller speech" }],
  "stream": true
}
```

- The engine supplies the complete `llm` object on every turn.
- `context.appId:userId:channel` identifies the in-memory session.
- Responses are OpenAI-compatible; team telemetry is under `group_poc`.
- Streaming emits a single Server-Sent Event chunk then `[DONE]` in this POC.

## Proposed surface

| Field | Meaning |
| --- | --- |
| `llm.variables` | shared state, read as `{{vars.name}}` |
| `llm.tools` | shared REST/system tool library |
| `llm.agents` | ordered specialists; first is entry |
| `agent.tools` | strict allow-list |
| `agent.handoffs` | synthesized transfer functions |
| `agent.requires` | variables required to activate |
| `agent.available_from` | `"*"` permits global destination |
| `handoff.capture` | transfer values written to variables |
| `handoff.activation` | `immediate` (default) or `next_user_turn` |
| `handoff.transition_message` | required fixed question/message for a deferred handoff |
| `agent.handoff_protocol` | optional `response_sidecar` structured-output protocol for deferred handoffs |

See `docs_llm.md` and `agent_team_join.md` for the full proposal.

## Internal tools

- Custom LLM calls `http://tools:8111` with `x-internal-tool-secret`.
- The service provides verification, account, payment, investigation, hardship, dispute, contact-preference, official follow-up, and compliance routes.
- It is not exposed by Nginx. Tool response captures enter shared session state.

## Related Deep Dives

- [Team runtime](L2/team_runtime.md) — inheritance and function execution.
