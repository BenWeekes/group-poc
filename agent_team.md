# AI Call-Transfer Agent Team

## Purpose

This team supports account, payment, and service calls through safe handoffs. It should help callers understand their situation and reach an approved resolution. It must not pressure callers, threaten consequences, request transfers to unverified accounts, or make legal or financial promises outside approved policy.

The supplied recordings appear to be outbound debt-collection calls involving payment problems, disputed account details, requests for more time, and financial distress. The transcripts are machine-translated and notably imperfect (for example, “energy supply” appears to be a mistranslation of a repayment term). Use them to identify workflow needs, not as authoritative account evidence; have a native speaker review the originals before treating a specific detail as a requirement.

## Shared call packet

Every transfer passes a structured call packet so the caller does not need to repeat themselves:

- verified identity status and consent status;
- caller's stated reason for contact;
- account and case references (never full sensitive values in speech logs);
- facts already confirmed from approved systems;
- actions already attempted and their results;
- caller sentiment and vulnerability flags;
- transfer reason, receiving agent, and recommended next action;
- immutable audit trail and call recording/transcript references.

## Team roles and tools

### 1. Intake and identity agent

**Purpose:** Open inbound calls or initiate outbound calls, obtain consent where required, verify identity, and route the caller.

**Tools:**

- approved CRM/customer lookup with masked-result display;
- identity-verification service, limited to approved challenge methods;
- consent and communication-preference registry;
- intent classifier and language-detection service;
- call summary and transfer-packet creator.

**Outbound-call controls:**

- use an approved dialler that enforces jurisdiction-specific calling hours, contact-frequency caps, do-not-call restrictions, and required caller identification;
- perform right-party verification before disclosing any account, balance, creditor, repayment, or case information;
- verify by asking the caller to provide a challenge answer; never read identifiers, account details, dates of birth, or ID digits aloud to solicit confirmation;
- if a third party, wrong number, voicemail, or unverified person answers, disclose nothing beyond an approved neutral callback identity and end the interaction;
- speak only masked references (for example, last four digits) after verification.

**Transfers:**

- to Account Status after identity verification;
- to Dispute and Fraud if identity, ownership, or authorization is challenged;
- to a human specialist after repeated failed verification or when policy requires it.

### 2. Account-status agent

**Purpose:** Explain approved account facts: status, balance, due dates, payment history, and notices.

**Tools:**

- read-only account ledger and billing-history lookup;
- approved policy and knowledge-base search;
- notification-history lookup;
- secure case-note writer;
- calculation tool for approved, explainable amounts.

**Transfers:**

- to Payment Options for a payment plan or extension;
- to Payment Troubleshooting when a payment is missing or failed;
- to Dispute and Fraud when account facts are contested;
- to Human Escalation for exceptions or legal/regulatory questions.

### 3. Payment-options agent

**Purpose:** Present only approved payment channels, plans, and due-date options.

**Tools:**

- payment-plan eligibility rules engine;
- approved payment-link generator tied to the verified customer and official domain;
- due-date/instalment simulator using policy limits;
- disclosure-template library;
- appointment and callback scheduler.

**Transfers:**

- to Hardship and Vulnerability when affordability is an issue;
- to Human Escalation when an exception is requested;
- to Safety and Conduct Monitor if a caller is being asked to use an unverified account or channel.

**Never permitted:** Direct callers to personal accounts, social-media payment handles, or unverified bank details.

**Promise-to-pay workflow:** When a caller offers a date and/or amount, capture it as a non-coercive promise to pay; confirm the date, amount, and approved payment method back to the caller; send written confirmation through the official channel; schedule the follow-up; and suppress collection contact until the agreed date, subject to applicable policy and law.

**Settlement and partial-payment workflow:** Offer only pre-approved arrangements. Route any negotiated amount, settlement, fee waiver, or exception to Human Escalation for approval before making a commitment.

### 4. Payment-troubleshooting agent

**Purpose:** Resolve failed, duplicate, pending, or incorrectly applied payments.

**Tools:**

- payment-status and reconciliation lookup;
- approved bank/payment-provider status API;
- secure transaction-reference capture;
- guided troubleshooting decision tree;
- technical incident and support-ticket creator.

**Explicit scenarios:** repeated auto-debit failures; changed payment cards; payment card or receiving-account restrictions/freezes; duplicate deductions; and “I paid, but to the wrong place.” The latter must be treated as a potential scam or misdirection and transferred to Dispute and Fraud.

**Transfers:**

- to Dispute and Fraud for unfamiliar or unauthorized transactions;
- to Account Status once payment status is resolved;
- to a human payments specialist for reconciliation exceptions.

### 5. Hardship and vulnerability agent

**Purpose:** Support callers who report inability to pay, financial hardship, distress, illness, coercion, or other vulnerability.

**Tools:**

- vulnerability and affordability assessment flow;
- approved hardship-program eligibility rules;
- payment-pause, plan, or referral workflow where authorised;
- sensitive-case flagging and restricted case notes;
- callback scheduler and human-support queue.

**Transfers:**

- to a human hardship specialist for any material affordability decision;
- to emergency/safety guidance only if an immediate safety concern is raised;
- to Payment Options after an approved eligibility outcome.

**Never permitted:** Use repeated demands, deadlines, threats, or shame to obtain payment.

**Distress protocol:** Trigger an immediate hardship and human-support handoff for language indicating severe distress, sleep loss, humiliation, despair, self-harm, or an immediate safety concern. Suspend all payment requests for the remainder of that call, follow the approved safety script, and create a restricted case flag.

### 6. Dispute and fraud agent

**Purpose:** Handle claims such as “this is not my account,” wrong balance, unfamiliar payment instruction, suspected scam, or account takeover.

**Tools:**

- dispute-case creator and evidence checklist;
- fraud-risk scoring and scam-indicator detection;
- transaction and identity audit trail lookup;
- account-protection actions, such as temporary communication or payment holds, where policy allows;
- secure escalation to a fraud investigator.

**Transfers:**

- to Human Escalation or a fraud investigator for material disputes;
- to Payment Troubleshooting for verified operational errors;
- to Safety and Conduct Monitor when suspicious payment routing is detected.

### 7. Human escalation and resolution agent

**Purpose:** Handle complex, sensitive, exceptional, legal, regulatory, or low-confidence cases.

**Tools:**

- full approved case workspace and audit history;
- supervisor approval workflow;
- exception-management and complaint-case tools;
- approved legal/compliance knowledge base;
- secure callback and follow-up scheduler.

**Transfers:**

- may return the call to a specialist AI flow only after the human defines safe next steps;
- otherwise owns the case through resolution.

### 8. Safety and conduct monitor

**Purpose:** Continuously protect the caller and enforce conduct policy across every conversation.

**Tools:**

- real-time policy/risk classifier for threats, coercion, harassment, fraud, and sensitive-data requests;
- redaction service for payment-card, identity, and bank-account data;
- approved-language guardrail and response-blocking service;
- human-supervisor alerting;
- immutable compliance audit log.

**Actions:**

- block unsafe proposed language or instructions;
- require a safe script or human transfer;
- flag prohibited transfer requests, such as payment to a personal account;
- preserve the incident for review.

**Required detections:** requests to move the interaction or payment instructions to WeChat, QQ, SMS, QR codes, social-media handles, personal accounts, or any unapproved side channel; requests to open a banking/wallet app, show a balance, screen-share, or perform an on-call device action; threats, repeated payment demands, third-party pressure, and distress language.

### 9. Follow-up and communications agent

**Purpose:** Deliver approved post-call summaries, confirmations, and reminders.

**Tools:**

- template-based email/SMS/secure-message sender;
- official payment-link and document generator;
- communication-preference and opt-out registry;
- delivery-status tracking;
- callback scheduler.

**Transfers:**

- to the originating specialist if the caller replies with a new issue;
- to Dispute and Fraud for suspicious-message reports;
- to Human Escalation for complaints or communications exceptions.

**Official-channel rule:** This is the only agent permitted to deliver payment links, account references, repayment instructions, or written confirmations. It may send them only from an official, authenticated sender to a registered contact method. No agent may provide these details verbally during a call or through chat applications, QR codes, or other side channels.

## Core transfer intents

| Caller signal | Transfer destination |
| --- | --- |
| Outbound call reaches an unverified person, third party, wrong number, or voicemail | Intake ends interaction without disclosure |
| Payment failed, pending, duplicated, or missing | Payment Troubleshooting |
| Cannot pay, requests time, describes financial pressure | Hardship and Vulnerability |
| Offers a payment date or amount | Payment Options: promise-to-pay workflow |
| Negotiates an amount, settlement, or partial payment | Payment Options if pre-approved; otherwise Human Escalation |
| Asks for instalments, due-date change, or official payment method | Payment Options |
| Says the account, loan, transaction, or instruction is wrong | Dispute and Fraud |
| Says “do not contact me,” asks to stop calls/messages, or withdraws communication consent | Immediately log preference, stop the call, and transfer case to Human Escalation |
| Expresses sleep loss, humiliation, despair, self-harm, or acute distress | Suspend payment asks; Hardship and Vulnerability plus Human Escalation |
| Requests an exception, makes a complaint, or asks a legal question | Human Escalation |
| Caller is upset, distressed, repeatedly refuses, or AI confidence is low | Human Escalation |
| Personal account, social-media handle, WeChat/QQ/SMS/QR-code payment instruction, or unverified transfer instruction is mentioned | Safety Monitor, then Dispute and Fraud |

## System-wide safety controls

- Verify identity before disclosing account-specific information.
- For outbound calls, complete right-party verification before identifying the account or purpose of the call; never verify by reading PII to the recipient.
- Use only official, verified payment methods and domains.
- Never deliver payment details through chat apps, QR codes, SMS, personal accounts, or spoken instructions; use only the authenticated official follow-up channel to a registered contact method.
- Never ask a caller to open a banking/wallet app, read a balance, screen-share, reveal device content, or perform an on-call device action.
- Never tell a caller to borrow from family or friends, contact a third party about their debt, or imply enforcement/consequences outside approved policy.
- Honor cease-contact and communication-preference requests immediately; do not argue, persuade, or make a further payment request in that call.
- Apply a policy-configurable cap to payment requests per call. A distress or refusal signal ends further payment solicitation for that interaction.
- Confirm any monetary amount, date, reference number, or account instruction stated by voice through the official written channel before taking action; never rely solely on ASR or spoken capture.
- Require human approval for exceptions, settlements, fees, enforcement actions, or legal statements.
- Give callers a clear route to dispute, complain, pause, or request a human.
- Minimise retention of sensitive data; redact it in transcripts and transfer summaries.
- Log every tool invocation, transfer, decision, and policy block for audit.
- Make transfer explanations clear: who the caller is being transferred to, why, and what context is being passed.
