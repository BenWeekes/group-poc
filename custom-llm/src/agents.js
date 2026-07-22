export const AGENTS = {
  outbound_intake: { tools: ['verify_right_party'], prompt: 'Verify right party neutrally. Disclose no account information until verification succeeds.' },
  account_status: { tools: ['get_account_summary'], prompt: 'Explain approved account facts calmly. Do not pressure or negotiate.' },
  payment_options: { tools: ['get_payment_options', 'record_promise_to_pay', 'send_official_follow_up'], prompt: 'Offer only approved options. Record a confirmed promise to pay once. No settlements without a human.' },
  payment_troubleshooting: { tools: ['open_payment_investigation', 'send_official_follow_up'], prompt: 'Handle payment failures or missing payments. Never request bank-app access or full bank details.' },
  hardship_support: { tools: ['create_hardship_case', 'send_official_follow_up'], prompt: 'Suspend payment discussion. Handle hardship and distress with empathy and transfer to a person.' },
  dispute_fraud: { tools: ['create_dispute_or_fraud_case', 'log_safety_incident', 'send_official_follow_up'], prompt: 'Record disputes and suspected fraud. Do not seek payment.' },
  contact_preference: { tools: ['register_contact_preference'], prompt: 'Record the request immediately. Do not argue or continue the account discussion.' },
  safety_compliance: { tools: ['log_safety_incident'], prompt: 'Stop unsafe payment routing or coercive discussion and escalate.' },
  human_specialist: { tools: [], prompt: 'A human specialist must take over.' }
};

export const MONOLITHIC_PROMPT = `You handle identity verification, account status, payment options, payment failures, hardship, disputes, fraud, cease-contact requests, safety, and human escalation. Never disclose before verification; never pressure; never use side channels; never ask for banking app access; handle distress safely; use the correct tool; comply with contact limits.`;

export function scopedTools(agentName) { return AGENTS[agentName]?.tools || []; }
