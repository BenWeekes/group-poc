import { AGENTS, MONOLITHIC_PROMPT } from './agents.js';

const patterns = {
  optOut: /\b(stop (calling|contacting|messages?)|do not contact|don't contact|leave me alone)\b/i,
  distress: /\b(can't sleep|cannot sleep|humiliated|despair|suicid|kill myself|hurt myself|panic|can't cope)\b/i,
  sideChannel: /\b(wechat|qq|qr ?code|personal account|social media|banking app|wallet app|screen ?share)\b/i,
  dispute: /\b(not my (account|loan|debt)|scam|fraud|wrong (account|balance|amount)|unauthori[sz]ed)\b/i,
  paymentIssue: /\b(payment failed|failed payment|duplicate|pending|charged twice|card changed|changed (my )?card|frozen|wrong place|wrong person|wrong destination)\b/i,
  hardship: /\b(can't pay|cannot pay|no money|financial pressure|need more time|afford)\b/i,
  payment: /\b(pay|payment|instal+ment|installment|due date|partial)\b/i
};

export function routeTurn(session, text) {
  const started = performance.now();
  let agent = session.agent || 'outbound_intake'; let safetyGate = null;
  if (patterns.optOut.test(text)) { agent = 'contact_preference'; safetyGate = 'cease_contact'; }
  else if (patterns.distress.test(text)) { agent = 'hardship_support'; safetyGate = 'distress'; }
  else if (patterns.sideChannel.test(text)) { agent = 'safety_compliance'; safetyGate = 'side_channel'; }
  else if (!session.rightPartyVerified) agent = 'outbound_intake';
  else if (patterns.dispute.test(text)) agent = 'dispute_fraud';
  else if (patterns.paymentIssue.test(text)) agent = 'payment_troubleshooting';
  else if (patterns.hardship.test(text)) agent = 'hardship_support';
  else if (patterns.payment.test(text)) agent = 'payment_options';
  else agent = 'account_status';
  return { agent, safetyGate, routeLatencyMs: Number((performance.now() - started).toFixed(3)), specialistPromptTokens: estimateTokens(AGENTS[agent].prompt), monolithicPromptTokens: estimateTokens(MONOLITHIC_PROMPT) };
}

export function estimateTokens(value) { return Math.ceil(String(value || '').length / 4); }
export function extractOffer(text) { const amount = text.match(/(?:£|\$)?(\d+(?:\.\d{1,2})?)/); const date = text.match(/\b20\d{2}-\d{2}-\d{2}\b/); return { requested_amount: amount ? Number(amount[1]) : undefined, requested_date: date ? date[0] : undefined }; }
