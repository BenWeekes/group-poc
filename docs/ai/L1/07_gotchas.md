# 07 Gotchas

> Non-obvious runtime, evaluation, transcript, and deployment behaviour.

## Runtime state

- Sessions are in memory; restarting Custom LLM loses agent, variables, and history.
- Reusing the same `appId:userId:channel` continues one session.
- The runtime replaces the session's config every turn but retains its state.
- The runtime store is ignored mutable data, not the committed seed.

## Provider and routing

- Tool messages must follow their assistant tool-call messages. History slicing removes leading orphaned tool results.
- A caller turn is capped at five provider tool-loop passes.
- Global handoffs are visible only when the caller text matches their criteria. Keep descriptions precise; critical patterns also need deterministic interrupts and replay tests.
- Human escalation is logical only; this POC does not make a PSTN/SIP transfer.

## Evaluation and deployment

- Recordings were machine-translated with unreliable speaker labels. Replays are deidentified caller-side approximations, not verbatim transcripts.
- Deterministic route timing and estimated prompt tokens are not actual model-quality or provider-cost measures.
- A separate caller model needs phase constraints or it may collapse a whole scenario into one turn.
- Only `/group-poc/llm/` may be proxied. Editing Nginx `location /` risks the existing application.

## Related Deep Dives

- [Evaluation harness](L2/evaluation_harness.md) — test types and interpretation.
