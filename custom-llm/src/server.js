import express from 'express';
import crypto from 'node:crypto';
import { AGENTS } from './agents.js';
import { routeTurn, extractOffer } from './router.js';
import { callTool, suggestedTool } from './tool_client.js';
import { createTeamSession, runTeamTurn } from './team_runtime.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
const sessions = new Map();
const teamSessions = new Map();
const port = Number(process.env.PORT || 8110);

function sessionFor(context = {}) {
  const id = `${context.appId || 'poc'}:${context.userId || 'caller'}:${context.channel || 'default'}`;
  if (!sessions.has(id)) sessions.set(id, { id, agent: 'outbound_intake', rightPartyVerified: false, customerId: '', dialedPhone: context.dialed_phone || '+441632960123', caseId: context.case_id || `case-${id}` });
  return sessions.get(id);
}
function latestUser(messages = []) { return [...messages].reverse().find((m) => m.role === 'user')?.content?.toString() || ''; }
function toolArgs(name, text) {
  const offer = extractOffer(text);
  if (name === 'verify_right_party') return { challenge_answer: text.trim().toLowerCase() };
  if (name === 'record_promise_to_pay') return { payment_date: offer.requested_date, amount: offer.requested_amount };
  if (name === 'open_payment_investigation') return { issue_type: /wrong place/i.test(text) ? 'wrong_destination' : 'failed', summary: text.slice(0, 300) };
  if (name === 'create_hardship_case') return { reason: text.slice(0, 300), severity: /suicid|kill myself|hurt myself/i.test(text) ? 'immediate_safety' : 'urgent' };
  if (name === 'create_dispute_or_fraud_case') return { category: /scam|fraud|unauthori/i.test(text) ? 'scam' : 'account', summary: text.slice(0, 300) };
  if (name === 'register_contact_preference') return { preference: 'stop_all_nonrequired_contact' };
  if (name === 'log_safety_incident') return { incident_type: /wechat|qq|qr|social/i.test(text) ? 'side_channel' : 'other', summary: text.slice(0, 300) };
  return offer;
}
function fallback(agent, result) {
  const reply = result?.safe_next_step || result?.next_steps || result?.spoken_options || result?.approved_spoken_summary || result?.confirmation || result?.result;
  if (reply) return reply;
  if (agent === 'outbound_intake') return 'Please provide the answer to the verification question.';
  if (agent === 'human_specialist') return 'One moment, I will connect you with a specialist.';
  return 'A specialist will review the next step.';
}
async function askUpstream(req, agent, text, toolResult) {
  const bearer = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '') || process.env.LLM_API_KEY || '';
  if (!bearer) return null;
  const response = await fetch(`${(process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: req.body.model || process.env.LLM_MODEL || 'gpt-4o-mini', temperature: 0.1, messages: [{ role: 'system', content: `${AGENTS[agent].prompt} Keep the answer under 35 words.` }, { role: 'system', content: `Approved tool result: ${JSON.stringify(toolResult || {})}` }, { role: 'user', content: text }] })
  });
  if (!response.ok) throw new Error(`upstream status ${response.status}`);
  return (await response.json()).choices?.[0]?.message?.content || null;
}
function completion(res, req, content, agent, metrics) {
  const body = { id: `chatcmpl-${crypto.randomUUID()}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: req.body.model || process.env.LLM_MODEL || 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], group_poc: { agent, ...metrics } };
  if (!req.body.stream) return res.json(body);
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache');
  res.write(`data: ${JSON.stringify({ ...body, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: 'stop' }] })}\n\n`); res.end('data: [DONE]\n\n');
}

app.get('/ping', (_req, res) => res.json({ message: 'pong' }));
app.post('/chat/completions', async (req, res) => {
  try {
    if (req.body.llm?.agents?.length) {
      const context = req.body.context || {};
      const teamKey = `${context.appId || 'poc'}:${context.userId || 'caller'}:${context.channel || 'default'}`;
      let teamSession = teamSessions.get(teamKey);
      if (!teamSession) {
        teamSession = createTeamSession(context, req.body.llm);
        teamSessions.set(teamKey, teamSession);
      } else {
        teamSession.llm = req.body.llm;
      }
      const output = await runTeamTurn(teamSession, latestUser(req.body.messages));
      return completion(res, req, output.content, output.activeAgent, {
        runtime: 'team',
        usage: output.usage,
        trace: output.trace,
        variables: output.variables
      });
    }
    const session = sessionFor(req.body.context); const text = latestUser(req.body.messages);
    const route = routeTurn(session, text); session.agent = route.agent;
    const toolName = suggestedTool(route.agent, text); let toolResult = null;
    const toolStart = performance.now();
    if (toolName) {
      toolResult = await callTool(toolName, session, toolArgs(toolName, text));
      if (toolName === 'verify_right_party' && toolResult.verified) { session.rightPartyVerified = true; session.customerId = toolResult.customer.id; }
    }
    const toolLatencyMs = toolName ? Number((performance.now() - toolStart).toFixed(3)) : 0;
    let content;
    try { content = await askUpstream(req, route.agent, text, toolResult); } catch (error) { console.warn(`upstream unavailable: ${error.message}`); }
    completion(res, req, content || fallback(route.agent, toolResult), route.agent, { safety_gate: route.safetyGate, route_latency_ms: route.routeLatencyMs, tool: toolName, tool_latency_ms: toolLatencyMs, specialist_prompt_tokens_estimate: route.specialistPromptTokens, monolithic_prompt_tokens_estimate: route.monolithicPromptTokens });
  } catch (error) { res.status(500).json({ error: { message: error.message, type: 'group_poc_error' } }); }
});
app.listen(port, () => console.log(`custom LLM listening on ${port}`));
