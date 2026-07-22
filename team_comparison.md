# Team versus single-prompt comparison

This is a live, reproducible POC comparison, not a production performance claim. Both variants replay the same 28 deidentified caller turns through the public Custom LLM endpoint and the same file-backed tools. The team uses scoped specialist prompts and explicit handoffs; the baseline is one agent with the complete prompt and all ten tools.

## First live run — mixed specialist models

The team used GPT-4o-mini by default and Grok 4.3 for hardship. The baseline used GPT-4o-mini. This demonstrates the configured system as a whole, but provider choice is a confounder, so it is not the controlled architecture-only result.

| Metric | Team | Single prompt | Observation |
| --- | ---: | ---: | --- |
| Caller turns | 28 | 28 | Same replay set |
| HTTP success | 100% | 100% | No endpoint failures |
| Total provider tokens | 44,786 | 49,741 | Team used 10.0% fewer tokens |
| Mean wall latency / turn | 2,763 ms | 1,899 ms | Team was 45.5% slower |
| Total wall latency | 77.36 s | 53.16 s | Serial evaluator total |
| Verification turns with an extra inappropriate tool | 0 / 4 | 4 / 4 | Baseline also selected `register_contact_preference` after verification |

## Findings

- **Smaller specialist prompts can reduce provider context:** the observed mixed-model team run consumed fewer total provider tokens, and the deterministic fixture estimates a 75.5% smaller specialist prompt than the legacy monolithic prompt. Actual savings in the live run were only 10.0%, because transfers and history still cost tokens.
- **Narrow tool scope reduced a concrete selection error:** all four single-prompt verification turns selected an unnecessary cease-contact tool; the team verification agent did not expose that tool, so it could not select it.
- **Teams do not automatically reduce latency:** the team paid for extra provider calls when it handed off and, in this run, a different provider for hardship. The design needs fast/silent transitions and selective model choice to win on perceived voice latency.
- **Reliability is not proved yet:** both variants completed every HTTP request. The first critical-action coverage metric was not sufficient to distinguish them, so the next controlled run should score labelled expected action, prohibited tool, repeated question, transfer count, and user-frustration indicators across multiple repetitions.

## Controlled same-provider run

This run forced every team specialist to use GPT-4o-mini. It therefore isolates the team structure, scoped prompts, tools, and handoffs from the mixed-provider configuration. It used the same 28 caller turns and mock tools as the single-prompt baseline.

| Metric | Team | Single prompt | Difference |
| --- | ---: | ---: | --- |
| Caller turns | 28 | 28 | Same replay set |
| HTTP success | 100% | 100% | No endpoint failures |
| Labelled critical-tool coverage | 100% | 87.5% | Team +12.5 percentage points |
| Verification turns with an extra inappropriate tool | 0 / 4 | 4 / 4 | Scoped Intake removed this failure mode |
| Total provider tokens | 41,139 | 51,170 | Team used 19.6% fewer tokens |
| Mean wall latency / turn | 2,504 ms | 1,860 ms | Team was 34.6% slower |
| Total wall latency | 70.12 s | 52.08 s | Serial evaluator total |

### Interpretation

- The controlled data supports the narrow-tool, small-prompt hypothesis: fewer tokens and no observed extra verification tool selection.
- The team also covered every labelled critical action in this replay. The single-prompt agent missed one labelled action and selected an inappropriate cease-contact tool after every verification turn.
- The latency cost is real: routing and handoff tool calls create extra provider passes. A production design should make transfers silent, reserve the team architecture for genuine domain changes, and use low-latency models for entry/routing agents.
- This is one 28-turn run, with mock tools and deidentified English replay data. Repeat it across seeds, models, and independently labelled conversations before making a production reliability claim.

## Reproduce

```bash
docker compose exec -T custom-llm npm run eval:compare
```

For a controlled same-provider run, force every team specialist to inherit the root GPT-4o-mini configuration:

```bash
docker compose exec -T -e TEAM_FORCE_ROOT_PROVIDER=true custom-llm npm run eval:compare
```

Set `REPORT_PATH=/tmp/team-vs-monolithic.json` to retain the raw per-turn report outside Git. The evaluator reports HTTP success, critical-tool coverage, extra verification tools, provider usage, and wall latency.

## Complex multi-tool call — same-model control

This seven-turn call deliberately moves through verification, payment investigation, official follow-up, payment options, promise-to-pay, hardship, and cease-contact. It disables the runtime's global interrupts in **both** variants, uses GPT-4o-mini at temperature zero for every specialist and the single prompt, and shares the same tool service. The single-prompt policy is intentionally much longer and includes every relevant rule.

| Metric | Team | Single prompt | Observation |
| --- | ---: | ---: | --- |
| Ordered required actions | 7 / 7 | 7 / 7 | Both completed the workflow after a team prompt fix |
| Forbidden tool calls | 0 | 0 | Both stopped payment actions after hardship/contact preference |
| Extra cease-contact tool at verification | No | Yes | Full tool scope still caused an unnecessary baseline call |
| Total provider tokens | 18,897 | 20,890 | Team used 9.5% fewer tokens |
| Mean wall latency / turn | 3,056 ms | 2,063 ms | Team was 48.1% slower |

The initial run caught an ordinary-payment bug in the Payment Options specialist: it escalated `50 on 2026-07-25` instead of recording the promise. The specialist prompt was corrected and the exact same case rerun. This is important evidence for the development process, but it means the final tie does **not** prove general team reliability.

Run it with:

```bash
docker compose exec -T custom-llm npm run eval:complex-compare
```
