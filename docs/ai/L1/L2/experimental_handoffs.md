# Experimental handoff transports

> **Status:** retained POC research only. These are excluded from the proposed Agora API, the primary benchmark, and the colleague-facing results.

Two transports were implemented and evaluated against the 75-caller-turn transcript-derived trace:

- **Structured Deferred Handoff** (`response_sidecar`): the source model emits JSON containing spoken content and hidden handoff metadata.
- **Inline Control Handoff** (`inline_control`): the source appends a machine-readable control trailer that the runtime removes before speech.

Both correctly scheduled deferred transitions in the POC. Neither outperformed the simpler Template Deferred Handoff in the initial long-run latency measurement. They add provider-specific output contracts, more failure modes, and no demonstrated user benefit. Keep them out of the public contract unless a future repeated, cache-aware evaluation shows a material advantage.

The relevant experiment should compare at least five paired runs using the same trace, stable provider cache keys, cached-token telemetry, median/p95 latency, and pathway accuracy.
