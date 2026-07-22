# Building a team of LLM agents

## The idea

Most voice agents use one large prompt and one large tool set for an entire call. That works for simple conversations, but it becomes harder to control as the call has more pathways: verification, account questions, payment failures, affordability, disputes, contact preferences, and human escalation.

This proposal lets one Agora ConvoAI session operate as a **team of specialist LLM agents**. A caller starts with an entry agent and is transferred to the right specialist as the conversation changes. Context and structured state travel with the transfer, so the caller does not have to start over.

The Debt Recovery Team is the working evaluation domain. It is deliberately demanding: a call can switch rapidly from payment questions to distress, a failed transaction, a dispute, or a request to stop contact. The team-of-agents mechanism itself is domain-neutral.

## Why use a team?

| Benefit | What changes |
| --- | --- |
| Better prompts | Each agent receives a short prompt for one job rather than one long prompt for every possible job. |
| Better tool selection | An agent sees only the tools it needs, reducing incorrect tool calls. |
| Clearer handoffs | Transfers have explicit reasons, required captured data, and a defined context window. |
| Easier evaluation | We can measure route accuracy, tool selection, transfer count, latency, and prompt-token exposure per pathway. |
| Safer boundaries | Cross-cutting routes such as cease-contact, distress, and suspicious payment instructions can interrupt the ordinary flow. |
| Reusable pattern | The same configuration model can support sales, support, booking, healthcare, or other multi-specialist teams. |

## Debt Recovery Team agent team

| Agent | Job | Tools it can use | Hand off when |
| --- | --- | --- | --- |
| **Outbound Intake** | Open an outbound call, complete right-party verification, and avoid disclosure before verification. | `verify_right_party` | Verification succeeds → Account Status. Wrong party or failed verification → end without disclosure. |
| **Account Status** | Explain approved account facts. | `get_account_summary` | Payment question → Payment Options; failed payment → Payment Troubleshooting; dispute → Dispute & Fraud; hardship → Hardship Support. |
| **Payment Options** | Present approved options and record a promise to pay. | `get_payment_options`, `record_promise_to_pay`, `send_official_follow_up` | Exception, settlement, waiver, or partial-payment negotiation outside policy → Human Specialist. |
| **Payment Troubleshooting** | Investigate failed, pending, duplicate, restricted, or misdirected payments. | `open_payment_investigation`, `send_official_follow_up` | Wrong destination, possible scam, or unauthorised payment → Dispute & Fraud. |
| **Hardship Support** | Handle inability to pay, vulnerability, distress, and requests for time. Payment requests pause here. | `create_hardship_case`, `send_official_follow_up` | Human request, material hardship, or immediate concern → Human Specialist. |
| **Dispute & Fraud** | Record account, balance, identity, transaction, and payment-routing disputes. | `create_dispute_or_fraud_case`, `log_safety_incident`, `send_official_follow_up` | Investigation or human review needed → Human Specialist. |
| **Contact Preference** | Honour a request to stop calls or messages immediately. | `register_contact_preference` | Preference recorded → Human Specialist only if required by policy. |
| **Safety & Compliance** | Stop prohibited side-channel payment routing or conduct-risk behaviour. | `log_safety_incident` | Incident logged → Human Specialist. |
| **Human Specialist** | Terminal escalation to an authorised person. | `transfer_to_human_specialist` | Owns the case through resolution. |

## How a handoff works

1. The active agent identifies a transfer intent.
2. The runtime applies any global interrupt first: cease-contact, distress, or prohibited side-channel request.
3. The handoff captures structured facts such as verification status, customer ID, offered date, or offered amount.
4. The destination receives a bounded recent conversation window plus the shared session variables.
5. The destination uses only its allowed tools and either resolves the issue or transfers again.

The proposed Agora fields for agents, handoffs, tool scoping, variables, and inheritance are documented in [agent_team_join.md](agent_team_join.md). The concise API field reference is at the top of that file.

## Worked evaluation example

This is an illustrative event trace based on the English evaluation case **“changed-card payment failure.”** It is not a transcript of a real customer. The timings show the POC route/tool events, not real speech duration.

| Time | Agent | Type | Message or event |
| --- | --- | --- | --- |
| `00:00.000` | Outbound Intake | User | “blue harbour” |
| `00:00.001` | Outbound Intake | Tool | Calls `verify_right_party`. |
| `00:00.006` | Outbound Intake | Agent | “Right-party verification succeeded.” |
| `00:08.240` | Account Status | User | “The deduction failed three times after I changed my card this morning.” |
| `00:08.245` | Account Status | Handoff | Routes to Payment Troubleshooting with verified customer context. |
| `00:08.250` | Payment Troubleshooting | Tool | Calls `open_payment_investigation` with a neutral summary and issue type `failed`. |
| `00:08.260` | Payment Troubleshooting | Agent | “An investigation has been opened. Do not make another payment until you receive the official follow-up.” |

The same call would take a different path if the caller said, “Send the account number to my WeChat.” The global route sends it to Safety & Compliance before a payment agent can provide instructions. If the caller says, “I cannot sleep; the pressure is too high,” it routes to Hardship Support and pauses payment discussion.

### Longer Custom LLM run

The following is a real four-turn POC run through the Custom LLM and GPT-4o-mini. It used the populated team `llm` object, scoped function schemas, the file-backed mock tools, captured handoff variables, and dynamically rebuilt prompts after each transfer. Account values and generated references are mock data.

| Time | Agent | Type | Message or event |
| --- | --- | --- | --- |
| `00:00.000` | Outbound Intake | User | “blue harbour” |
| `00:00.787` | Outbound Intake | Tool | GPT-4o-mini calls `verify_right_party`. |
| `00:01.563` | Outbound Intake | Handoff | GPT-4o-mini calls `handoff_to_account_status` with verified customer context. |
| `00:02.610` | Account Status | Tool | Calls `get_account_summary`. |
| `00:03.892` | Account Status | Agent | Explains the mock account is payment due, with a 199.00 balance and the next due date. |
| `00:03.892` | Account Status | User | “My deduction failed three times after I changed my card this morning.” |
| `00:04.780` | Account Status | Handoff | Calls `handoff_to_payment_troubleshooting`. |
| `00:05.790` | Payment Troubleshooting | Tool | Calls `open_payment_investigation` with a neutral failed-payment summary. |
| `00:09.239` | Payment Troubleshooting | Agent | Confirms an investigation and tells the caller not to make another payment until official follow-up. |
| `00:09.239` | Payment Troubleshooting | User | “The pressure is too high. I cannot sleep and I need time to deal with this.” |
| `00:10.618` | Hardship Support | Tool | Global distress routing selects Hardship Support; GPT-4o-mini calls `create_hardship_case`. |
| `00:10.618` | Hardship Support | Handoff | Calls `handoff_to_human_specialist`. |
| `00:12.779` | Human Specialist | Agent | Confirms payment discussion is paused and a specialist will review support options. |
| `00:12.779` | Human Specialist | User | “Please stop calling me.” |
| `00:13.565` | Contact Preference | Tool | Global cease-contact routing selects Contact Preference; calls `register_contact_preference`. |
| `00:14.596` | Contact Preference | Agent | Confirms the communication preference was recorded. |

This run took four provider turns for verification/account status, three for the payment failure, two for hardship/human escalation, and two for cease-contact. That makes the pathway and cost of each transfer visible, rather than hiding every concern in one large prompt.

## What the POC currently demonstrates

- Nine agents with scoped tools and explicit transfer criteria.
- File-backed mock account data rather than a CRM or payment database.
- Deterministic routing for the main Debt Recovery Team pathways.
- Twelve English evaluation cases, including four inspired by the supplied call transcripts.
- Evaluation output for pathway accuracy, route latency, and specialist-versus-monolithic prompt-token estimates.

The current evaluation suite passes 12 of 12 routing cases. Its deterministic router averaged roughly 0.18 ms; the specialist prompt estimate was about 21.6 tokens per route compared with an 88-token monolithic baseline. This measures the POC routing layer, not end-to-end LLM quality or live-call latency.

## Next evaluation steps

- Run the same cases through a real upstream LLM and compare route/tool accuracy against the deterministic baseline.
- Add multi-turn tests that verify state survives several transfers.
- Measure end-to-end streaming latency and actual provider token usage.
- Add equivalent teams in other domains to demonstrate the proposed API across different Agora use cases.
