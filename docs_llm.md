# Developer API: team-of-agents `llm` capability

## Status and scope

This document specifies a proposed extension to the Agora ConvoAI `llm` configuration. It is a POC contract, not a released Agora API. Existing single-agent payloads remain valid: omitting `llm.agents` retains current behaviour.

The objective is to let a session enter through one agent, transfer between specialised agents without making the caller repeat context, restrict each agent to the smallest tool set it needs, and measure the outcome against a single-agent prompt. Debt recovery is the working evaluation domain; the API itself is domain-neutral.

## Root configuration

`llm` retains its normal provider configuration. Root properties are inherited by agents unless overridden.

| Field | Meaning |
| --- | --- |
| `url`, `api_key`, `vendor`, `style` | Upstream LLM configuration. |
| `params` | Deep-merged into each agent's `params`. |
| `max_history` | Default message history for an agent. |
| `greeting_message` | Spoken once by the entry agent at session start. |
| `variables` | Flat session-variable store, readable as `{{vars.name}}`. |
| `tools` | Tool library, defined once and named by agents. |
| `agents` | Ordered agent definitions. `agents[0]` is the entry agent. |

All properties other than `params` shallow-replace at agent level. An agent sees only the tools listed in `agent.tools`.

## Agent definition

```json
{
  "name": "payment_options",
  "params": { "temperature": 0.1 },
  "max_history": 20,
  "requires": ["right_party_verified", "customer_id"],
  "transition_message": null,
  "system_messages": [{ "role": "system", "content": "..." }],
  "tools": ["get_payment_options", "record_promise_to_pay"],
  "handoffs": []
}
```

`requires` blocks activation when a required variable is absent. `available_from: "*"` marks a global agent that any current agent may transfer to, such as cease-contact, safety, or human escalation.

## Handoffs

A handoff is exposed to the current LLM as a synthesized function. The caller experiences a `transition_message` only when one is configured. `context` controls how much recent conversation is passed; `capture` defines required values that are written into session variables atomically with the transfer.

```json
{
  "to": "payment_options",
  "description": "The caller offers a date or amount, or asks for an approved payment option.",
  "context": { "mode": "user_and_assistant", "max_messages": 12 },
  "capture": {
    "type": "object",
    "properties": {
      "offered_amount": { "type": "number" },
      "offered_date": { "type": "string" }
    }
  }
}
```

The runtime must validate the capture schema before switching agents. It must reject a transfer when a required capture is missing or malformed.

### Handoff activation

`activation` selects when the destination agent starts generating. It defaults to `"immediate"` for compatibility.

| Value | Sequence | Use it when |
| --- | --- | --- |
| `"immediate"` | Current agent calls the handoff; destination generates the reply to the current caller utterance. | The caller needs specialist knowledge, a specialist tool, or escalation now. |
| `"next_user_turn"` | Current agent calls the handoff; ConvoAI speaks the configured `transition_message`, records the handoff in shared history, and activates the destination for the next caller utterance. | The destination has a known first question and no specialist action is needed until the caller answers. |

Deferred handoffs require a fixed, destination-appropriate `transition_message`. It is runtime-authored configuration, not model-generated content, so it does not require another provider pass. The handoff tool call, its capture, and the spoken transition message remain in the shared conversation history.

```json
{
  "to": "payment_options",
  "activation": "next_user_turn",
  "transition_message": "What amount could you realistically pay, and on which date?",
  "description": "Caller asks for an approved payment option or more time."
}
```

`available_from: "*"` makes a destination globally reachable, but it must not mean “always transfer here.” The runtime may expose a global handoff only when the current caller turn matches its stated criterion; critical global intents should also be intercepted deterministically before a model chooses a function.

## Tool definition

Tools use an OpenAI-compatible parameter schema plus REST request and response mappings. `response.capture` writes deterministic values to the session store; `response.return` is the concise result placed into the LLM context.

```json
{
  "name": "get_payment_options",
  "type": "rest",
  "description": "Return approved options for a verified caller.",
  "parameters": { "type": "object", "properties": {} },
  "request": {
    "method": "POST",
    "url": "https://tool-service/v1/payment-options/quote",
    "body": { "customer_id": "{{vars.customer_id}}" },
    "timeout_ms": 4000
  },
  "response": {
    "capture": { "requires_human_approval": "$.requires_human_approval" },
    "return": "$.spoken_options",
    "on_empty": "No automatic option is available."
  }
}
```

Only the tool service receives state-changing requests. The LLM never receives secrets, full payment information, or unrestricted network access.

## Safety requirements

The agent prompts are not the sole safety control. The Custom LLM runtime must deterministically intercept and route:

- cease-contact and communication-preference requests;
- severe distress or immediate-safety signals;
- payment instructions over WeChat, QQ, SMS, QR codes, social media, or personal accounts;
- requests for banking-app access, balances, screen sharing, or on-call device actions;
- third-party disclosure and failed right-party verification.

The platform must enforce outbound calling windows, contact-frequency limits, and dialling permissions before the LLM is invoked. Monetary amounts, dates, account references, and payment instructions heard in speech must be confirmed through an official written channel before state changes take effect.

## Custom LLM compatibility

For this POC, Agora calls an OpenAI-compatible endpoint at `/chat/completions` with `x-group-poc-api-key`. To enable the team runtime, the request additionally supplies the fully populated `llm` object proposed in `agent_team_join.md`. The Custom LLM stores the active agent, pending deferred handoff, variables, and full shared conversation history by session context. It resolves root/agent inheritance on every turn, renders `{{vars.*}}` and `{{secrets.*}}` templates, and rebuilds the selected agent's system prompt and allowed function schema after every handoff. A unique `context.call_id` is required in a production integration; the POC expires inactive sessions after 30 minutes by default.

`{{secrets.openai}}` and `{{secrets.xai}}` resolve only inside the Custom LLM process from its environment. They never enter model context, tool results, logs, or the response payload. Team provider URLs are allowlisted to the OpenAI and xAI chat-completions endpoints, preventing a caller-supplied configuration from sending resolved credentials elsewhere. Agent-level provider overrides can therefore use OpenAI or xAI while remaining inside one Agora session.

The original request `Authorization: Bearer …` convention remains available as a fallback for a single-agent request, matching the existing `server-custom-llm` behaviour. The internal REST tool service is authenticated separately and is not internet-accessible.

```json
{
  "llm": { "...": "full populated team configuration" },
  "context": { "appId": "app", "userId": "caller", "channel": "call-123" },
  "messages": [{ "role": "user", "content": "Caller speech transcript" }],
  "stream": true
}
```

## Evaluation instrumentation

Each turn records the selected agent, safety gate, tool calls, route latency, tool latency, and prompt-token estimate. The evaluator compares this specialist design with a single monolithic-prompt baseline. The comparison is diagnostic—not a claim of production model quality—and reports:

- pathway accuracy and safety-gate coverage;
- agent transitions and tool selection;
- route/tool latency measured in the POC;
- estimated prompt-token exposure per turn;
- monolithic versus specialist prompt-size comparison.

## Evaluation modes

The POC uses two complementary real-provider evaluation styles in addition to deterministic routing cases:

- **Engine-shaped replay:** every caller turn sends the full `llm` object, stable session `context`, one user message, and `stream: true` to the public Custom LLM endpoint. The longer English sequences are deidentified caller-side approximations of the machine-translated recordings.
- **Independent caller simulation:** a separate LLM generates the next caller utterance from recent conversation and a constrained scenario phase. This tests adaptive behaviour without allowing the simulator to compress an entire scenario into one utterance.

Both record selected agent, handoffs, tool calls, per-pass and wall-clock latency, and actual upstream token usage. They are intended to uncover routing and prompt gaps as well as demonstrate multi-model agent overrides.
