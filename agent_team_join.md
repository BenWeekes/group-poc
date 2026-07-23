# Proposed `llm.agents` API

This proposal extends the existing Agora ConvoAI `llm` object with a team of specialist agents. If `agents` is omitted, the existing single-agent configuration continues unchanged.

ConvoAI owns the session, shared variables, handoffs, tool execution, and direct calls to the configured LLM providers. Applications continue to send the complete `llm` object when the session joins.

## New fields

| Field | Location | Meaning |
| --- | --- | --- |
| `variables` | `llm.variables` | Initial shared session state. Agents read values as `{{vars.name}}`; tools and handoffs can update them. |
| `tools` | `llm.tools` | Shared tool library. Define each tool once. |
| `agents` | `llm.agents` | Ordered agent definitions. The first agent is the entry agent. The existing root `llm.greeting_message` is spoken once when the session joins. |
| `name` | `llm.agents[]` | Unique identifier used by handoffs. |
| `requires` | `llm.agents[]` | Variables required before this agent may become active. |
| `tools` | `llm.agents[]` | Allow-list of tool names from `llm.tools`. An agent sees only these tools. |
| `handoffs` | `llm.agents[]` | Destinations available to the active agent. Each becomes a handoff function. |
| `to` | `handoffs[]` | Destination agent name. |
| `description` | `handoffs[]` | Instruction used in the handoff function schema. |
| `context` | `handoffs[]` | Conversation context made available to the destination. |
| `capture` | `handoffs[]` | JSON Schema values required at handoff and written to `variables`. |
| `activation` | `handoffs[]` | `"immediate"` (default) or `"next_user_turn"`. |
| `transition_message` | `handoffs[]` | Required when `activation` is `"next_user_turn"`; fixed caller-facing text. |
| `available_from` | `llm.agents[]` | `"*"` makes an agent a global destination reachable from any active agent. |

## Inheritance

Each agent inherits root `llm` settings such as `url`, `api_key`, `vendor`, `style`, `params`, and `max_history`.

- `params` merges with root `params`.
- Other agent-level values replace the root value.
- An agent may select a different LLM by overriding `url`, `api_key`, `vendor`, `style`, or `params`.
- All captures write to the same flat `variables` object.
- `handoff.context` defines the proposed destination-context contract. The reference implementation currently bounds shared history with the destination agent's `max_history`; it does not yet apply the per-handoff `context` value.

## Handoff activation

### Immediate Handoff

`"immediate"` is the default. The source agent calls a handoff function; ConvoAI activates the destination and calls its LLM with the current caller turn. The destination generates the caller-facing reply now.

This may require two sequential LLM calls: one for the source agent to select the handoff, then one for the destination response.

```json
{
  "to": "payment_options",
  "activation": "immediate",
  "description": "Caller asks about payment options or offers a payment amount.",
  "context": {
    "mode": "user_and_assistant",
    "max_messages": 12
  },
  "capture": {
    "type": "object",
    "properties": {
      "customer_id": { "type": "string" }
    },
    "required": ["customer_id"]
  }
}
```

Use Immediate Handoff when the destination needs to answer the current utterance, call a tool immediately, or handle an urgent interruption.

### Template Deferred Handoff

Set `activation` to `"next_user_turn"` and provide a fixed `transition_message`. The source agent calls the handoff function. ConvoAI speaks the configured message without calling the destination LLM, records the handoff in shared session state, and activates the destination for the next caller turn.

```json
{
  "to": "payment_options",
  "activation": "next_user_turn",
  "transition_message": "What amount could you realistically pay, and on which date?",
  "description": "Caller wants an approved payment arrangement.",
  "context": {
    "mode": "user_and_assistant",
    "max_messages": 12
  }
}
```

Use Template Deferred Handoff only when that fixed question is an appropriate response to the current caller turn. It avoids a destination LLM call on the handoff turn. Global interruption agents (`"available_from": "*"`), including contact-preference, hardship, safety, and human escalation agents, must use Immediate Handoff.

## Minimal team example

```json
{
  "llm": {
    "url": "https://api.openai.com/v1/chat/completions",
    "api_key": "{{secrets.openai}}",
    "vendor": "openai",
    "style": "openai",
    "params": {
      "model": "gpt-4o-mini",
      "temperature": 0.2
    },
    "max_history": 24,
    "greeting_message": "Hello. How can I help?",
    "failure_message": "Sorry, something went wrong.",
    "variables": {
      "caller_number": "+441632960123"
    },
    "tools": [
      {
        "name": "lookup_account",
        "type": "rest",
        "description": "Retrieve the verified caller's approved account summary.",
        "parameters": {
          "type": "object",
          "properties": {},
          "required": []
        },
        "request": {
          "method": "GET",
          "url": "https://api.example.com/v1/accounts?phone={{vars.caller_number}}",
          "timeout_ms": 3000
        },
        "response": {
          "capture": {
            "account_status": "$.status"
          },
          "return": "$.summary"
        }
      }
    ],
    "agents": [
      {
        "name": "intake",
        "max_history": 10,
        "system_messages": [
          {
            "role": "system",
            "content": "Identify whether the caller needs account information or a payment arrangement. Do not answer account questions yourself."
          }
        ],
        "tools": [],
        "handoffs": [
          {
            "to": "account_status",
            "activation": "immediate",
            "description": "Caller asks about their account."
          },
          {
            "to": "payment_options",
            "activation": "next_user_turn",
            "transition_message": "What amount could you realistically pay, and on which date?",
            "description": "Caller asks for a payment arrangement."
          }
        ]
      },
      {
        "name": "account_status",
        "system_messages": [
          {
            "role": "system",
            "content": "Use lookup_account before answering account-specific questions."
          }
        ],
        "tools": ["lookup_account"],
        "handoffs": []
      },
      {
        "name": "payment_options",
        "system_messages": [
          {
            "role": "system",
            "content": "Collect a proposed amount and date, then present only approved payment options."
          }
        ],
        "tools": [],
        "handoffs": []
      }
    ]
  }
}
```

## Backwards compatibility

`agents` is optional. Without it, Agora ConvoAI processes `llm` exactly as it does today as a single agent.
