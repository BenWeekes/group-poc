# 08 Security

> Trust boundaries, secret handling, and restrictions for this mock-data prototype.

## Boundaries

| Boundary | Rule |
| --- | --- |
| Engine -> Custom LLM | caller text, context, and configuration only; no resolved secrets |
| Custom LLM -> provider | resolves symbolic provider secrets in process environment |
| Custom LLM -> tools | fixed endpoint mapping and private shared-secret header |
| Nginx -> Custom LLM | proxies only the Group POC prefix |
| Tools -> JSON store | mock data; ignored mutable runtime state |

## Secrets

- Keep credentials in ignored `.env` or service environment variables.
- Keep `.env.example` blank and descriptive.
- Never put raw keys in fixtures, reports, docs, terminal output, or commits.
- Rotate any key exposed in chat, a terminal, an issue, or Git history.

## Data and call restrictions

- This is not authorised for production debt collection, payments, or real customer data.
- Verify caller-provided answers before account disclosure; never read identifiers to the caller.
- Send payment information only through approved official follow-up; never chat apps, QR codes, personal accounts, banking apps, or screen share.
- Stop-contact, acute distress, and side-channel payment signals are runtime interrupts, not prompts alone.

## Validation

- Express request bodies are size limited.
- Tools use timing-safe secret comparison.
- Providers cannot choose arbitrary tool URLs.

## Related Deep Dives

- [Team runtime](L2/team_runtime.md) — interrupt and tool execution sequence.
