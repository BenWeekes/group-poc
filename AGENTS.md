# AI Agent Instructions

This repository uses progressive disclosure documentation.

## How to Load

1. Read [docs/ai/L0_repo_card.md](docs/ai/L0_repo_card.md).
2. Load all eight files in `docs/ai/L1/`.
3. Read linked L2 deep dives only when needed.

## Git Conventions

- Use conventional commits: `feat:`, `fix:`, `test:`, `docs:`, or `chore:`.
- Keep descriptions lowercase and present tense.
- Do not commit `.env`, runtime account data, provider keys, or evaluation reports.
- Preserve the existing Nginx root application; change only the narrow Group POC route when required.

## Doc Commands

| Command | Use when |
| --- | --- |
| generate docs | `docs/ai/` does not exist |
| update docs | source, contracts, workflows, or deployment changes |
| test docs | checking navigation and source accuracy |
| fix docs | resolving documentation findings |
