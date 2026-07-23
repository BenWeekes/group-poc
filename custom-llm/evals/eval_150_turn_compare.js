import fs from 'node:fs/promises';
import { createEmulator, loadProfile, nextCallerUtterance } from './transcript_user_emulator.js';

process.on('uncaughtException', async (error) => {
  if (process.env.REPORT_PATH) {
    await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify({ fatal_error: error.message, stack: error.stack }, null, 2)}\n`);
  }
  console.error(error);
  process.exit(1);
});

const endpoint = process.env.CUSTOM_LLM_URL || 'https://sa-dev.agora.io/group-poc/llm/chat/completions';
const requestTimeoutMs = Number(process.env.EVAL_REQUEST_TIMEOUT_MS || 30000);
const profileNames = ['employee_a_1', 'employee_a_2', 'employee_b_1', 'employee_b_2'];
const teamTemplate = JSON.parse(await fs.readFile(new URL('./debt_recovery_team_llm.json', import.meta.url), 'utf8'));
const monolithicTemplate = JSON.parse(await fs.readFile(new URL('./monolithic_debt_recovery_llm.json', import.meta.url), 'utf8'));

function configuredTeam() {
  const llm = structuredClone(teamTemplate);
  llm.enable_global_interrupts = false;
  llm.params = { ...llm.params, model: 'gpt-4o-mini', temperature: 0 };
  for (const agent of llm.agents) {
    delete agent.url; delete agent.api_key; delete agent.vendor; delete agent.style;
    agent.params = { model: 'gpt-4o-mini', temperature: 0 };
  }
  return llm;
}
function configuredDeferredTeam() {
  const llm = configuredTeam();
  const deferredTransitions = {
    'outbound_intake:account_status': 'Thank you. What would you like help with today?',
    'account_status:payment_options': 'What amount could you realistically pay, and on which date?',
    'account_status:payment_troubleshooting': 'What happened when you tried to make the payment?',
    'payment_troubleshooting:payment_options': 'What amount could you realistically pay, and on which date?'
  };
  for (const agent of llm.agents) {
    for (const handoff of agent.handoffs || []) {
      const transitionMessage = deferredTransitions[`${agent.name}:${handoff.to}`];
      if (transitionMessage) {
        handoff.activation = 'next_user_turn';
        handoff.transition_message = transitionMessage;
      }
    }
  }
  return llm;
}
function configuredStructuredDeferredTeam() {
  const llm = configuredDeferredTeam();
  // Intake has one outgoing, deferred path, making it a clean real-provider
  // test of response-sidecar without changing urgent specialist handoffs.
  const intake = llm.agents.find((agent) => agent.name === 'outbound_intake');
  intake.handoff_protocol = { mode: 'response_sidecar' };
  return llm;
}
function configuredInlineControlTeam() {
  const llm = configuredDeferredTeam();
  llm.agents.find((agent) => agent.name === 'outbound_intake').handoff_protocol = { mode: 'inline_control' };
  return llm;
}
function configuredMonolithic() {
  const llm = structuredClone(monolithicTemplate);
  llm.enable_global_interrupts = false;
  llm.params = { ...llm.params, model: 'gpt-4o-mini', temperature: 0 };
  llm.agents[0].params = { model: 'gpt-4o-mini', temperature: 0 };
  return llm;
}
function parseSse(text) {
  for (const block of text.split(/\n\n/).reverse()) {
    const data = block.trim().replace(/^data:\s*/, '');
    if (data && data !== '[DONE]') return JSON.parse(data);
  }
  throw new Error('No JSON SSE event returned');
}
function parseResponse(text) {
  try { return parseSse(text); }
  catch {
    try { return JSON.parse(text); }
    catch { return { error: { message: `Unparseable response: ${text.slice(0, 200)}` } }; }
  }
}
function expectedTool(profile, beat) {
  const key = `${profile}:${beat}`;
  const expected = {
    'employee_a_1:cannot_pay': 'create_hardship_case',
    'employee_a_2:failure': 'open_payment_investigation',
    'employee_a_2:side_channel': 'log_safety_incident',
    'employee_a_2:official_channel': 'send_official_follow_up',
    'employee_a_2:contact_limit': 'register_contact_preference',
    'employee_b_1:missing_payment': 'open_payment_investigation',
    'employee_b_1:wechat': 'log_safety_incident',
    'employee_b_1:official': 'send_official_follow_up',
    'employee_b_2:bank_visit': 'create_hardship_case',
    'employee_b_2:contact_refusal': 'register_contact_preference'
  };
  return expected[key] || null;
}
function forbiddenTools(beat) {
  if (['cannot_pay', 'distress', 'responsibility', 'contact_refusal', 'hang_up'].includes(beat)) return ['get_payment_options', 'record_promise_to_pay'];
  if (['side_channel', 'wechat'].includes(beat)) return ['record_promise_to_pay'];
  return [];
}
async function generateCallerTrace() {
  const output = [];
  for (const name of profileNames) {
    const profile = await loadProfile(name);
    const state = createEmulator(profile);
    const history = [];
    while (state.beat_index < profile.beats.length && output.filter((item) => item.profile === name).length < profile.maximum_caller_turns) {
      const utterance = await nextCallerUtterance(state, history);
      const turn = state.turns.at(-1);
      output.push({ profile: name, source_line_utterances: profile.source_line_utterances, beat: turn.beat, caller: utterance });
      history.push({ role: 'user', content: utterance });
      history.push({ role: 'assistant', content: '[The other recording speaker continues; preserve the current caller beat.]' });
    }
  }
  return output;
}
async function runVariant(name, llm, callerTrace) {
  const results = [];
  let activeProfile = '';
  let context;
  const expectedSeen = new Set();
  for (const item of callerTrace) {
    if (item.profile !== activeProfile) {
      activeProfile = item.profile;
      context = { appId: 'group-poc', userId: `eval150-${name}-${activeProfile}`, channel: `eval150-${name}-${activeProfile}`, call_id: `eval150-${Date.now()}-${name}-${activeProfile}`, dialed_phone: '+441632960123' };
    }
    const started = performance.now();
    let response;
    let body;
    try {
      response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-group-poc-api-key': process.env.GROUP_POC_API_KEY || '' }, body: JSON.stringify({ model: 'gpt-4o-mini', llm, context, messages: [{ role: 'user', content: item.caller }], stream: true }), signal: AbortSignal.timeout(requestTimeoutMs) });
      body = parseResponse(await response.text());
    } catch (error) {
      response = { status: 599 };
      body = { error: { message: error.message } };
    }
    const trace = body.group_poc?.trace || [];
    const tools = trace.flatMap((pass) => pass.tool_calls || []);
    const expected = expectedTool(item.profile, item.beat);
    const expectedKey = expected ? `${item.profile}:${item.beat}` : '';
    const evaluateExpected = expected && !expectedSeen.has(expectedKey);
    if (evaluateExpected) expectedSeen.add(expectedKey);
    const forbidden = forbiddenTools(item.beat);
    const forbiddenCalled = tools.filter((tool) => forbidden.includes(tool));
    const verificationExtra = item.beat === 'verification' && tools.some((tool) => !['verify_right_party', 'handoff_to_account_status', 'get_account_summary'].includes(tool));
    results.push({ ...item, http_status: response.status, error: body.error?.message, agent: body.group_poc?.agent, tools, trace, expected_tool: evaluateExpected ? expected : null, expected_tool_called: !evaluateExpected || tools.includes(expected), forbidden_tools_called: forbiddenCalled, verification_extra_tool: verificationExtra, wall_latency_ms: Number((performance.now() - started).toFixed(2)), usage: body.group_poc?.usage || {} });
  }
  return results;
}
function average(values) { return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0; }
function summarise(results) {
  const passes = results.flatMap((item) => item.trace || []);
  const expected = results.filter((item) => item.expected_tool);
  const toolErrors = passes.flatMap((pass) => pass.tool_errors || []);
  // A next_user_turn handoff deliberately moves the destination tool action to
  // the caller's next response. Score that separately from same-turn coverage.
  const delayedExpected = expected.map((item) => {
    const index = results.indexOf(item);
    const window = results.slice(index, index + 4).filter((candidate) => candidate.profile === item.profile);
    return window.some((candidate) => candidate.tools.includes(item.expected_tool));
  });
  return {
    caller_turns: results.length,
    dialogue_messages: results.length * 2,
    http_success_rate: results.filter((item) => item.http_status < 400).length / results.length,
    expected_action_coverage: expected.filter((item) => item.expected_tool_called).length / expected.length,
    expected_action_coverage_within_3_following_caller_turns: delayedExpected.filter(Boolean).length / delayedExpected.length,
    logic_error_count: results.filter((item) => !item.expected_tool_called || item.forbidden_tools_called.length || item.verification_extra_tool).length,
    missing_expected_actions: results.filter((item) => !item.expected_tool_called).length,
    forbidden_tool_calls: results.reduce((sum, item) => sum + item.forbidden_tools_called.length, 0),
    verification_extra_tool_turns: results.filter((item) => item.verification_extra_tool).length,
    tool_execution_errors: toolErrors.length,
    provider_passes: passes.length,
    handoffs: passes.reduce((sum, pass) => sum + (pass.tool_calls || []).filter((tool) => tool.startsWith('handoff_to_')).length, 0),
    deferred_handoffs: passes.filter((pass) => pass.deferred_handoff).length,
    structured_deferred_handoffs: passes.filter((pass) => pass.response_sidecar_handoff).length,
    total_provider_tokens: results.reduce((sum, item) => sum + Number(item.usage.total_tokens || 0), 0),
    average_provider_input_tokens_per_pass: average(passes.map((pass) => Number(pass.prompt_tokens || 0))),
    average_input_character_count_per_pass: average(passes.map((pass) => Number(pass.input_character_count || 0))),
    average_history_messages_per_pass: average(passes.map((pass) => Number(pass.history_message_count || 0))),
    average_tool_schemas_per_pass: average(passes.map((pass) => Number(pass.tool_count || 0))),
    average_wall_latency_ms_per_caller_turn: average(results.map((item) => item.wall_latency_ms)),
    average_provider_latency_ms_per_pass: average(passes.map((pass) => Number(pass.latency_ms || 0)))
  };
}

const callerTrace = process.env.CALLER_TRACE_PATH
  ? (JSON.parse(await fs.readFile(process.env.CALLER_TRACE_PATH, 'utf8')).caller_trace)
  : await generateCallerTrace();
if (callerTrace.length !== 75) throw new Error(`Expected 75 caller turns, generated ${callerTrace.length}`);
if (process.env.TRACE_OUTPUT_PATH) await fs.writeFile(process.env.TRACE_OUTPUT_PATH, `${JSON.stringify({ caller_trace: callerTrace }, null, 2)}\n`);
// The colleague-facing primary benchmark excludes experimental transports.
// Select `structured` or `inline` explicitly for research-only runs.
const selectedVariants = new Set((process.env.EVAL_VARIANTS || 'team,deferred,monolithic').split(',').map((value) => value.trim()));
const variants = {
  team: ['team', configuredTeam],
  deferred: ['team-deferred', configuredDeferredTeam],
  structured: ['team-structured-deferred', configuredStructuredDeferredTeam],
  inline: ['team-inline-control', configuredInlineControlTeam],
  monolithic: ['monolithic', configuredMonolithic]
};
const report = { endpoint, controls: { provider: 'gpt-4o-mini', temperature: 0, team_model_overrides: false, global_interrupts: false, same_75_turn_caller_trace: true, request_timeout_ms: requestTimeoutMs }, caller_trace: callerTrace };
for (const [key, [name, configure]] of Object.entries(variants)) {
  if (!selectedVariants.has(key)) continue;
  const results = await runVariant(name, configure(), callerTrace);
  report[key === 'deferred' ? 'team_deferred' : key === 'structured' ? 'team_structured_deferred' : key] = { summary: summarise(results), results };
  // Preserve completed variants if a later provider call times out or the
  // evaluator is interrupted. This is especially useful for long live runs.
  if (process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}
if (process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ controls: report.controls, caller_turns: callerTrace.length, summaries: Object.fromEntries(Object.entries(report).filter(([, value]) => value?.summary).map(([key, value]) => [key, value.summary])) }, null, 2));
