# Team Runtime

> **When to Read This:** Load this document when changing agent selection, handoffs, variables, provider calls, or tool execution.

## Entry and session

`POST /chat/completions` enters team mode when `body.llm.agents` is non-empty. `server.js` keys sessions by `context.appId`, `context.userId`, `context.channel`, and optional `context.call_id`. A first request starts with the first agent. Later requests replace the current config with the supplied complete `llm` object but retain active agent, variables, and history. Sessions expire after `SESSION_TTL_MS`; callers should always provide a unique call ID.

## Agent resolution

`effectiveAgent` combines root defaults with selected-agent overrides. `params` merges; other agent fields replace root fields. Secret and variable templates are resolved only inside the Custom LLM process. `requires` blocks activation with absent state. The runtime rebuilds prompt, history, and functions for every provider call. The proposed `handoff.context` field is not yet applied here; the destination's `max_history` currently bounds shared history.

`boundedHistory` removes a leading `tool` message after slicing history. This keeps an OpenAI-compatible provider from receiving a tool result without its preceding assistant tool call. Before each provider request, the runtime also strips POC-only history annotations and sends only standard message fields.

## Function schemas and handoffs

`scopedFunctions` creates schemas for the selected agent's REST tools, explicit handoffs, and eligible deduplicated `available_from: "*"` destinations. Global schemas are visible only when the current caller text matches their precise criterion. An LLM invokes `handoff_to_<agent>` exactly like a tool. The runtime validates required captures, merges arguments into variables, then changes active agent.

Handoffs default to `activation: "immediate"`: after the handoff tool call, the destination receives a provider pass and answers the current caller utterance. A routine handoff may instead use `activation: "next_user_turn"` plus a fixed `transition_message`. The runtime persists the source tool call, tool result, and transition message in shared history, speaks that message without another provider call, and makes the destination active for the next caller utterance. The session's `pendingHandoff` marker is cleared when that next turn arrives. Global interruption agents (`available_from: "*"`) must always be immediate so they can act on the triggering utterance.

Non-standard structured and inline control transports are deliberately excluded from the proposed API and primary results. Their POC notes are in [experimental_handoffs.md](experimental_handoffs.md).

## Turn sequence

```text
caller text -> deterministic interrupt -> user history
-> resolve agent + functions -> provider completion
-> execute tools/captures/handoffs -> repeat (maximum five passes)

For a deferred handoff, the loop returns immediately after the handoff tool result and configured transition message; the destination starts on the next user turn.
-> response with trace and usage
```

Outbound intake is forced to call `verify_right_party` until verified. Other calls use provider-driven function selection. Trace records pass, selected agent, model, latency, and function names.

## Tool execution and interrupts

Providers never select URLs. `executeTeamTool` delegates fixed names to `tool_client.js`, which calls the private tool service. JSON-path captures update variables. The global interrupt list handles explicit cease-contact wording, acute distress, and side-channel payment terms before the provider sees the turn. Add both interrupt coverage and replay cases for a new critical signal.

## See Also

- [Architecture](../02_architecture.md)
- [Interfaces](../06_interfaces.md)
- [Security](../08_security.md)
