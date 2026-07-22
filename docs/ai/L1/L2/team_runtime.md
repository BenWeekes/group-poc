# Team Runtime

> **When to Read This:** Load this document when changing agent selection, handoffs, variables, provider calls, or tool execution.

## Entry and session

`POST /chat/completions` enters team mode when `body.llm.agents` is non-empty. `server.js` keys sessions by `context.appId`, `context.userId`, `context.channel`, and optional `context.call_id`. A first request starts with the first agent. Later requests replace the current config with the supplied complete `llm` object but retain active agent, variables, and history. Sessions expire after `SESSION_TTL_MS`; callers should always provide a unique call ID.

## Agent resolution

`effectiveAgent` combines root defaults with selected-agent overrides. `params` merges; other agent fields replace root fields. Secret and variable templates are resolved only inside the Custom LLM process. `requires` blocks activation with absent state. The runtime rebuilds prompt, history, and functions for every provider call.

`boundedHistory` removes a leading `tool` message after slicing history. This keeps an OpenAI-compatible provider from receiving a tool result without its preceding assistant tool call.

## Function schemas and handoffs

`scopedFunctions` creates schemas for the selected agent's REST tools, explicit handoffs, and eligible deduplicated `available_from: "*"` destinations. Global schemas are visible only when the current caller text matches their precise criterion. An LLM invokes `handoff_to_<agent>` exactly like a tool. The runtime validates required captures, merges arguments into variables, then changes active agent.

## Turn sequence

```text
caller text -> deterministic interrupt -> user history
-> resolve agent + functions -> provider completion
-> execute tools/captures/handoffs -> repeat (maximum five passes)
-> response with trace and usage
```

Outbound intake is forced to call `verify_right_party` until verified. Other calls use provider-driven function selection. Trace records pass, selected agent, model, latency, and function names.

## Tool execution and interrupts

Providers never select URLs. `executeTeamTool` delegates fixed names to `tool_client.js`, which calls the private tool service. JSON-path captures update variables. The global interrupt list handles explicit cease-contact wording, acute distress, and side-channel payment terms before the provider sees the turn. Add both interrupt coverage and replay cases for a new critical signal.

## See Also

- [Architecture](../02_architecture.md)
- [Interfaces](../06_interfaces.md)
- [Security](../08_security.md)
