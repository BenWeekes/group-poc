import { callTool } from './tool_client.js';

const MAX_TOOL_PASSES = 5;
const ALLOWED_PROVIDER_URLS = new Set([
  'https://api.openai.com/v1/chat/completions',
  'https://api.x.ai/v1/chat/completions'
]);
const GLOBAL_INTERRUPTS = [
  { agent: 'contact_preference', pattern: /\b(stop (all )?(collection )?(calls?|calling|contacting|messages?)|do not contact|don't contact|leave me alone)\b/i },
  { agent: 'hardship_support', pattern: /\b(can't sleep|cannot sleep|affecting my sleep|humiliated|despair|suicid|kill myself|hurt myself|panic|can't cope)\b/i },
  { agent: 'safety_compliance', pattern: /\b(wechat|qq|qr ?code|personal account|social media|banking app|wallet app|screen ?share)\b/i }
];

function deepMergeParams(root = {}, override = {}) { return { ...root, ...override }; }
export function render(value, variables = {}, secrets = {}) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(vars|secrets)\.([A-Za-z0-9_]+)\}\}/g, (_match, scope, key) => String((scope === 'vars' ? variables : secrets)[key] ?? ''));
}
function jsonPath(value, path) {
  return path.replace(/^\$\.?/, '').split('.').filter(Boolean).reduce((current, key) => current?.[key], value);
}
function toolMap(llm) { return new Map((llm.tools || []).map((tool) => [tool.name, tool])); }
function findAgent(llm, name) { return (llm.agents || []).find((agent) => agent.name === name); }
function globalHandoffDescription(agent) {
  const descriptions = {
    contact_preference: 'Transfer only when the caller explicitly asks to stop, limit, or change contact.',
    hardship_support: 'Transfer when the caller cannot pay, asks for time because of hardship, or expresses distress.',
    safety_compliance: 'Transfer only for side-channel payment instructions, banking-app/device-action requests, or prohibited payment conduct.',
    human_specialist: 'Transfer when human review is explicitly requested or required by policy.'
  };
  return descriptions[agent.name] || `Transfer to global agent ${agent.name} when its specialist criteria are met.`;
}
function globalHandoffAllowed(agent, userText = '') {
  const criteria = {
    contact_preference: /\b(stop (all )?(collection )?(calls?|calling|contacting|messages?)|do not contact|don't contact|leave me alone)\b/i,
    hardship_support: /\b(cannot pay|can't pay|can't afford|cannot afford|need time|hardship|can't sleep|cannot sleep|affecting my sleep|humiliated|despair|suicid|kill myself|hurt myself|panic|can't cope)\b/i,
    safety_compliance: /\b(wechat|qq|qr ?code|personal account|social media|banking app|wallet app|screen ?share)\b/i,
    human_specialist: /\b(human|person|manager|supervisor|specialist)\b/i
  };
  return criteria[agent.name]?.test(userText) ?? true;
}
function globalHandoffParameters(agent) {
  if (agent.name === 'human_specialist') {
    return {
      type: 'object',
      properties: { escalation_reason: { type: 'string' } },
      required: ['escalation_reason']
    };
  }
  return { type: 'object', properties: {} };
}

export function createTeamSession(context, llm) {
  const callId = context?.call_id || context?.callId || context?.call_uuid || '';
  const key = `${context?.appId || 'poc'}:${context?.userId || 'caller'}:${context?.channel || 'default'}:${callId}`;
  return {
    key,
    llm,
    activeAgent: llm.agents?.[0]?.name,
    variables: { ...(llm.variables || {}), dialed_phone: context?.dialed_phone || llm.variables?.caller_number || '' },
    history: [],
    pendingHandoff: null,
    lastSeen: Date.now()
  };
}

export function effectiveAgent(session, secrets) {
  const root = session.llm;
  const agent = findAgent(root, session.activeAgent);
  if (!agent) throw new Error(`Unknown active agent: ${session.activeAgent}`);
  for (const name of agent.requires || []) if (session.variables[name] === undefined || session.variables[name] === '') throw new Error(`Agent ${agent.name} requires variable ${name}`);
  return {
    ...root,
    ...agent,
    params: deepMergeParams(root.params, agent.params),
    url: render(agent.url || root.url, session.variables, secrets),
    api_key: render(agent.api_key || root.api_key, session.variables, secrets),
    system_messages: agent.system_messages || root.system_messages || []
  };
}

export function scopedFunctions(session, secrets) {
  const agent = effectiveAgent(session, secrets);
  const library = toolMap(session.llm);
  const result = [];
  const names = new Set();
  for (const name of agent.tools || []) {
    const tool = library.get(name);
    if (!tool || tool.type === 'system') continue;
    result.push({ type: 'function', function: { name, description: tool.description || name, parameters: tool.parameters || { type: 'object', properties: {} } } });
    names.add(name);
  }
  if (agent.handoff_protocol?.mode !== 'response_sidecar') {
    for (const handoff of agent.handoffs || []) {
      const name = `handoff_to_${handoff.to}`;
      result.push({ type: 'function', function: { name, description: handoff.description, parameters: handoff.capture || { type: 'object', properties: {} } } });
      names.add(name);
    }
  }
  for (const candidate of session.llm.agents || []) {
    const name = `handoff_to_${candidate.name}`;
    if (candidate.available_from === '*' && candidate.name !== agent.name && !names.has(name) && globalHandoffAllowed(candidate, session.currentUserText)) {
      result.push({ type: 'function', function: { name, description: globalHandoffDescription(candidate), parameters: globalHandoffParameters(candidate) } });
      names.add(name);
    }
  }
  return result;
}

function applyCaptures(session, capture, result) {
  for (const [name, path] of Object.entries(capture || {})) session.variables[name] = jsonPath(result, path);
}

function toToolSession(session) {
  return {
    customerId: session.variables.customer_id,
    dialedPhone: session.variables.dialed_phone,
    caseId: session.variables.case_id
  };
}

function defaultArgs(name, args) {
  if (name === 'create_hardship_case' && !args.severity) return { severity: 'urgent', ...args };
  if (name === 'create_dispute_or_fraud_case' && !args.category) return { category: 'account', ...args };
  if (name === 'open_payment_investigation' && !args.issue_type) return { issue_type: 'other', ...args };
  return args;
}

export async function executeTeamTool(session, name, args, secrets, options = {}) {
  if (name.startsWith('handoff_to_')) {
    const destination = name.slice('handoff_to_'.length);
    const source = effectiveAgent(session, secrets);
    const handoff = (source.handoffs || []).find((item) => item.to === destination);
    const destinationAgent = findAgent(session.llm, destination);
    const required = handoff?.capture?.required || (destination === 'human_specialist' && destinationAgent?.available_from === '*' ? ['escalation_reason'] : []);
    for (const field of required) if (args[field] === undefined || args[field] === '') throw new Error(`Handoff to ${destination} requires ${field}`);
    Object.assign(session.variables, args);
    const activation = handoff?.activation || 'immediate';
    if (!['immediate', 'next_user_turn'].includes(activation)) throw new Error(`Unsupported handoff activation: ${activation}`);
    const transitionMessage = activation === 'next_user_turn'
      ? (options.transitionMessage || render(handoff?.transition_message || destinationAgent?.deferred_transition_message || '', session.variables, secrets))
      : null;
    if (activation === 'next_user_turn' && !transitionMessage) throw new Error(`Deferred handoff to ${destination} requires transition_message`);
    session.activeAgent = destination;
    session.pendingHandoff = activation === 'next_user_turn'
      ? { source: source.name, destination, activation, transition_message: transitionMessage, variables: args, at: Date.now() }
      : null;
    return { transferred: activation === 'immediate', scheduled: activation === 'next_user_turn', destination, activation, transition_message: transitionMessage, variables: args };
  }
  const tool = toolMap(session.llm).get(name);
  if (!tool) throw new Error(`Tool ${name} is not configured`);
  const result = await callTool(name, toToolSession(session), defaultArgs(name, args));
  applyCaptures(session, tool.response?.capture, result);
  if (name === 'verify_right_party' && result.verified) {
    session.variables.right_party_verified = true;
    session.variables.customer_id = result.customer.id;
    session.variables.customer_display_name = result.customer.display_name;
  }
  return result;
}

function providerSecrets() { return { openai: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '', xai: process.env.XAI_API_KEY || '' }; }
function systemMessages(session, secrets) {
  const agent = effectiveAgent(session, secrets);
  const messages = agent.system_messages.map((message) => ({ ...message, content: render(message.content, session.variables, secrets) }));
  if (agent.handoff_protocol?.mode === 'response_sidecar') {
    const destinations = (agent.handoffs || []).map((handoff) => handoff.to).join(', ');
    messages.push({
      role: 'system',
      content: `Return JSON only: {"content":"spoken reply","handoff":null} or {"content":"spoken reply","handoff":{"to":"destination","activation":"next_user_turn","capture":{}}}. The caller hears only content. You may choose only these destinations: ${destinations || 'none'}. A sidecar handoff is for the next caller turn only; use null when no handoff is needed.`
    });
  }
  return messages;
}
export function boundedHistory(history, maxHistory) {
  let start = Math.max(0, history.length - Math.max(1, maxHistory || 32));
  while (start > 0 && history[start]?.role === 'tool') start -= 1;
  return history.slice(start);
}
async function providerCompletion(agent, messages, tools, toolChoice = 'auto') {
  if (!ALLOWED_PROVIDER_URLS.has(agent.url)) throw new Error(`Provider URL is not allowlisted: ${agent.url}`);
  const body = { ...agent.params, messages, tools, tool_choice: toolChoice, stream: false };
  if (agent.handoff_protocol?.mode === 'response_sidecar') body.response_format = { type: 'json_object' };
  const response = await fetch(agent.url, { method: 'POST', headers: { authorization: `Bearer ${agent.api_key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || JSON.stringify(payload).slice(0, 500);
    throw new Error(`Provider returned ${response.status}: ${detail}`);
  }
  return payload;
}

function sidecarResponse(choice, agent) {
  if (agent.handoff_protocol?.mode !== 'response_sidecar') return null;
  let parsed;
  try { parsed = JSON.parse(choice.content || ''); }
  catch { throw new Error('Response-sidecar agent returned invalid JSON'); }
  if (!parsed || typeof parsed.content !== 'string' || !Object.hasOwn(parsed, 'handoff')) throw new Error('Response-sidecar response requires content and handoff');
  if (parsed.handoff !== null && (typeof parsed.handoff !== 'object' || Array.isArray(parsed.handoff))) throw new Error('Response-sidecar handoff must be an object or null');
  return parsed;
}

export async function runTeamTurn(session, userText) {
  const secrets = providerSecrets();
  if (!session.llm?.agents?.length) throw new Error('A populated llm.agents array is required for team runtime mode');
  // A deferred handoff has already changed activeAgent. Clear its pending marker
  // only when the destination receives the next caller utterance.
  const activatedDeferredHandoff = session.pendingHandoff || null;
  session.pendingHandoff = null;
  const interrupt = session.llm.enable_global_interrupts === false ? null : GLOBAL_INTERRUPTS.find((item) => item.pattern.test(userText));
  if (interrupt && findAgent(session.llm, interrupt.agent)) session.activeAgent = interrupt.agent;
  session.currentUserText = userText;
  session.history.push({ role: 'user', content: userText });
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const trace = [];
  for (let pass = 0; pass < MAX_TOOL_PASSES; pass += 1) {
    const agent = effectiveAgent(session, secrets);
    const tools = scopedFunctions(session, secrets);
    const messages = [...systemMessages(session, secrets), ...boundedHistory(session.history, agent.max_history)];
    const toolChoice = !session.variables.right_party_verified && tools.some((tool) => tool.function.name === 'verify_right_party')
      ? { type: 'function', function: { name: 'verify_right_party' } }
      : 'auto';
    const started = performance.now();
    const response = await providerCompletion(agent, messages, tools, toolChoice);
    const latencyMs = Number((performance.now() - started).toFixed(2));
    const choice = response.choices?.[0]?.message || {};
    const turnUsage = response.usage || {};
    for (const key of Object.keys(usage)) usage[key] += Number(turnUsage[key] || 0);
    const traceEntry = {
      pass: pass + 1,
      agent: agent.name,
      model: agent.params.model,
      latency_ms: latencyMs,
      prompt_tokens: Number(turnUsage.prompt_tokens || 0),
      completion_tokens: Number(turnUsage.completion_tokens || 0),
      input_message_count: messages.length,
      history_message_count: messages.length - systemMessages(session, secrets).length,
      input_character_count: messages.reduce((sum, message) => sum + JSON.stringify(message).length, 0),
      tool_count: tools.length,
      tool_calls: choice.tool_calls?.map((call) => call.function.name) || [],
      tool_errors: []
    };
    trace.push(traceEntry);
    if (!choice.tool_calls?.length) {
      const sidecar = sidecarResponse(choice, agent);
      if (sidecar?.handoff) {
        const { to, activation, capture = {} } = sidecar.handoff;
        if (activation !== 'next_user_turn') throw new Error('Response-sidecar handoff activation must be next_user_turn');
        const handoff = (agent.handoffs || []).find((item) => item.to === to);
        if (!handoff || handoff.activation !== 'next_user_turn') throw new Error(`Response-sidecar destination is not configured for deferred handoff: ${to}`);
        const result = await executeTeamTool(session, `handoff_to_${to}`, capture, secrets, { transitionMessage: sidecar.content });
        if (!result.scheduled) throw new Error(`Response-sidecar handoff was not scheduled: ${to}`);
        traceEntry.response_sidecar_handoff = { destination: to, activation, capture_keys: Object.keys(capture) };
        session.history.push({ role: 'assistant', content: sidecar.content, group_poc: { handoff: { from: agent.name, to, activation, capture } } });
        return { content: sidecar.content, activeAgent: session.activeAgent, usage, trace, variables: session.variables, pendingHandoff: session.pendingHandoff };
      }
      const content = sidecar?.content || choice.content || agent.failure_message || 'Sorry, something went wrong.';
      session.history.push({ role: 'assistant', content });
      return { content, activeAgent: session.activeAgent, usage, trace, variables: session.variables, activatedDeferredHandoff };
    }
    session.history.push(choice);
    let deferredHandoff = null;
    for (const call of choice.tool_calls) {
      let result;
      try { result = await executeTeamTool(session, call.function.name, JSON.parse(call.function.arguments || '{}'), secrets); }
      catch (error) { result = { error: error.message }; traceEntry.tool_errors.push({ name: call.function.name, message: error.message }); }
      session.history.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      if (result?.scheduled) deferredHandoff = result;
    }
    if (deferredHandoff) {
      traceEntry.deferred_handoff = { destination: deferredHandoff.destination, activation: deferredHandoff.activation };
      const content = deferredHandoff.transition_message;
      // This assistant message is deliberately persisted with the tool call and result.
      // The next caller turn sees the destination as active while retaining the full shared history.
      session.history.push({ role: 'assistant', content, group_poc: { handoff: { from: agent.name, to: deferredHandoff.destination, activation: 'next_user_turn' } } });
      return { content, activeAgent: session.activeAgent, usage, trace, variables: session.variables, pendingHandoff: session.pendingHandoff };
    }
  }
  throw new Error(`Tool loop exceeded ${MAX_TOOL_PASSES} passes`);
}
