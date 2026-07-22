const baseUrl = process.env.TOOLS_BASE_URL || 'http://tools:8111';
const secret = process.env.INTERNAL_TOOL_SECRET || '';

const endpoints = {
  verify_right_party: ['POST', '/v1/call-verification/right-party'],
  get_account_summary: ['GET', '/v1/accounts/summary'],
  get_payment_options: ['POST', '/v1/payment-options/quote'],
  record_promise_to_pay: ['POST', '/v1/promises-to-pay'],
  open_payment_investigation: ['POST', '/v1/payment-investigations'],
  create_hardship_case: ['POST', '/v1/hardship-cases'],
  create_dispute_or_fraud_case: ['POST', '/v1/disputes'],
  register_contact_preference: ['POST', '/v1/contact-preferences'],
  send_official_follow_up: ['POST', '/v1/official-communications'],
  log_safety_incident: ['POST', '/v1/compliance-incidents']
};

export async function callTool(name, session, args = {}) {
  const [method, path] = endpoints[name] || []; if (!method) throw new Error(`unknown tool ${name}`);
  const body = { customer_id: session.customerId, dialed_phone: session.dialedPhone, case_id: session.caseId, ...args };
  const url = method === 'GET' ? `${baseUrl}${path}?${new URLSearchParams(body).toString()}` : `${baseUrl}${path}`;
  const response = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-internal-tool-secret': secret }, body: method === 'GET' ? undefined : JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || `tool ${name} failed`); return data;
}

export function suggestedTool(agent, text) {
  if (agent === 'outbound_intake') return 'verify_right_party';
  if (agent === 'account_status') return 'get_account_summary';
  if (agent === 'payment_options') return /\b\d+(?:\.\d{1,2})?\b/.test(text) && /\b20\d{2}-\d{2}-\d{2}\b/.test(text) ? 'record_promise_to_pay' : 'get_payment_options';
  if (agent === 'payment_troubleshooting') return 'open_payment_investigation';
  if (agent === 'hardship_support') return 'create_hardship_case';
  if (agent === 'dispute_fraud') return 'create_dispute_or_fraud_case';
  if (agent === 'contact_preference') return 'register_contact_preference';
  if (agent === 'safety_compliance') return 'log_safety_incident';
  return null;
}
