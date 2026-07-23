import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { extractOffer, routeTurn } from '../src/router.js';
import { boundedHistory, createTeamSession, executeTeamTool, providerHistory, runTeamTurn, scopedFunctions } from '../src/team_runtime.js';
import { createApp } from '../src/server.js';

function postJson(port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers } }, (response) => {
      let text = '';
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

test('cease-contact takes precedence over payment intent', () => {
  const result = routeTurn({ rightPartyVerified: true }, 'Stop calling me about payment.');
  assert.equal(result.agent, 'contact_preference');
  assert.equal(result.safetyGate, 'cease_contact');
});
test('side channels are blocked before ordinary payment routing', () => {
  const result = routeTurn({ rightPartyVerified: true }, 'Can you send it by WeChat?');
  assert.equal(result.agent, 'safety_compliance');
});
test('unverified callers stay in intake', () => {
  assert.equal(routeTurn({ rightPartyVerified: false }, 'What is my balance?').agent, 'outbound_intake');
});
test('extractOffer does not treat the year in an ISO date as the payment amount', () => {
  assert.deepEqual(extractOffer('I can pay 100 on 2026-07-25.'), { requested_amount: 100, requested_date: '2026-07-25' });
});
test('boundedHistory preserves a complete assistant tool-call and tool-result pair', () => {
  const history = [
    { role: 'user', content: 'one' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'call-1' }] },
    { role: 'tool', tool_call_id: 'call-1', content: '{}' },
    { role: 'assistant', content: 'done' },
    { role: 'user', content: 'two' }
  ];
  assert.deepEqual(boundedHistory(history, 3).map((item) => item.role), ['assistant', 'tool', 'assistant', 'user']);
});

test('provider history strips runtime-only metadata', () => {
  const history = [{ role: 'assistant', content: 'Next question.', group_poc: { handoff: { to: 'payment_options' } } }];
  assert.deepEqual(providerHistory(history, 8), [{ role: 'assistant', content: 'Next question.' }]);
});

test('deferred handoff schedules the destination and supplies its configured next question', async () => {
  const llm = {
    agents: [
      { name: 'intake', handoffs: [{ to: 'payment_options', activation: 'next_user_turn', transition_message: 'What amount could you pay, and when?' }] },
      { name: 'payment_options', deferred_transition_message: 'Unused fallback.' }
    ]
  };
  const session = createTeamSession({ call_id: 'deferred-test' }, llm);
  const result = await executeTeamTool(session, 'handoff_to_payment_options', {}, {});
  assert.deepEqual(result, {
    transferred: false,
    scheduled: true,
    destination: 'payment_options',
    activation: 'next_user_turn',
    transition_message: 'What amount could you pay, and when?',
    variables: {}
  });
  assert.equal(session.activeAgent, 'payment_options');
  assert.equal(session.pendingHandoff.destination, 'payment_options');
});

test('global cease-contact handoff does not require a human escalation reason', async () => {
  const llm = {
    agents: [
      { name: 'account_status', handoffs: [] },
      { name: 'contact_preference', available_from: '*' }
    ]
  };
  const session = createTeamSession({ call_id: 'contact-test' }, llm);
  const result = await executeTeamTool(session, 'handoff_to_contact_preference', {}, {});
  assert.equal(result.transferred, true);
  assert.equal(session.activeAgent, 'contact_preference');
});

test('a deferred handoff to a global agent is rejected', async () => {
  const llm = {
    agents: [
      { name: 'intake', handoffs: [{ to: 'contact_preference', activation: 'next_user_turn', transition_message: 'How should we contact you?' }] },
      { name: 'contact_preference', available_from: '*' }
    ]
  };
  const session = createTeamSession({ call_id: 'no-deferred-global' }, llm);
  await assert.rejects(executeTeamTool(session, 'handoff_to_contact_preference', {}, {}), /Deferred handoff to global agent/);
});

test('deferred handoff persists over sequential provider turns without leaking metadata', async () => {
  const llm = {
    url: 'https://api.openai.com/v1/chat/completions', api_key: 'test', params: { model: 'gpt-4o-mini' },
    agents: [
      { name: 'intake', system_messages: [], tools: [], handoffs: [{ to: 'payment_options', activation: 'next_user_turn', transition_message: 'What amount could you pay?' }] },
      { name: 'payment_options', system_messages: [], tools: [], handoffs: [] }
    ]
  };
  const session = createTeamSession({ call_id: 'two-http-turns' }, llm);
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, request) => {
    const body = JSON.parse(request.body);
    requests.push(body);
    if (requests.length === 1) return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'handoff-1', type: 'function', function: { name: 'handoff_to_payment_options', arguments: '{}' } }] } }], usage: {} }) };
    assert.equal(body.messages.some((message) => Object.hasOwn(message, 'group_poc')), false);
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'I can record that arrangement.' } }], usage: {} }) };
  };
  try {
    const first = await runTeamTurn(session, 'I need an arrangement.');
    assert.equal(first.content, 'What amount could you pay?');
    assert.equal(first.pendingHandoff.destination, 'payment_options');
    const second = await runTeamTurn(session, 'I can pay 50 on Friday.');
    assert.equal(second.content, 'I can record that arrangement.');
    assert.equal(second.activatedDeferredHandoff.destination, 'payment_options');
    assert.equal(second.activeAgent, 'payment_options');
    assert.equal(requests.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('HTTP session activates a deferred destination on the next caller turn', async () => {
  const priorKey = process.env.GROUP_POC_API_KEY;
  process.env.GROUP_POC_API_KEY = 'http-test-key';
  const llm = {
    url: 'https://api.openai.com/v1/chat/completions', api_key: 'test', params: { model: 'gpt-4o-mini' },
    agents: [
      { name: 'intake', system_messages: [], tools: [], handoffs: [{ to: 'payment_options', activation: 'next_user_turn', transition_message: 'What amount could you pay?' }] },
      { name: 'payment_options', system_messages: [], tools: [], handoffs: [] }
    ]
  };
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async (_url, request) => {
    const upstream = JSON.parse(request.body);
    providerCalls += 1;
    if (providerCalls === 1) return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'handoff-http', type: 'function', function: { name: 'handoff_to_payment_options', arguments: '{}' } }] } }], usage: {} }) };
    assert.equal(upstream.messages.some((message) => Object.hasOwn(message, 'group_poc')), false);
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Arrangement noted.' } }], usage: {} }) };
  };
  try {
    const context = { appId: 'test', userId: 'caller', channel: 'deferred-http', call_id: 'one' };
    const common = { llm, context, stream: false };
    const first = await postJson(port, '/chat/completions', { ...common, messages: [{ role: 'user', content: 'I need an arrangement.' }] }, { 'x-group-poc-api-key': 'http-test-key' });
    assert.equal(first.status, 200);
    assert.equal(first.body.group_poc.pending_deferred_handoff.destination, 'payment_options');
    const second = await postJson(port, '/chat/completions', { ...common, messages: [{ role: 'user', content: 'I can pay 50.' }] }, { 'x-group-poc-api-key': 'http-test-key' });
    assert.equal(second.status, 200);
    assert.equal(second.body.group_poc.agent, 'payment_options');
    assert.equal(second.body.group_poc.activated_deferred_handoff.destination, 'payment_options');
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve) => server.close(resolve));
    if (priorKey === undefined) delete process.env.GROUP_POC_API_KEY; else process.env.GROUP_POC_API_KEY = priorKey;
  }
});

test('response-sidecar defers a handoff without exposing a handoff function', async () => {
  const llm = {
    url: 'https://api.openai.com/v1/chat/completions', api_key: 'test', params: { model: 'gpt-4o-mini' },
    agents: [
      { name: 'intake', handoff_protocol: { mode: 'response_sidecar' }, system_messages: [], tools: [], handoffs: [{ to: 'payment_options', activation: 'next_user_turn' }] },
      { name: 'payment_options', system_messages: [], tools: [], handoffs: [] }
    ]
  };
  const session = createTeamSession({ call_id: 'sidecar-test' }, llm);
  assert.equal(scopedFunctions(session, {}).some((tool) => tool.function.name === 'handoff_to_payment_options'), false);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.response_format.type, 'json_object');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ content: 'What amount could you realistically pay, and on which date?', handoff: { to: 'payment_options', activation: 'next_user_turn', capture: { intent: 'payment_arrangement' } } }) } }], usage: {} }) };
  };
  try {
    const output = await runTeamTurn(session, 'I need a payment arrangement.');
    assert.equal(output.content, 'What amount could you realistically pay, and on which date?');
    assert.equal(session.activeAgent, 'payment_options');
    assert.equal(session.history.at(-1).group_poc.handoff.to, 'payment_options');
  } finally { globalThis.fetch = originalFetch; }
});

test('malformed response-sidecar output fails soft without a 500', async () => {
  const llm = {
    url: 'https://api.openai.com/v1/chat/completions', api_key: 'test', params: { model: 'gpt-4o-mini' },
    agents: [{ name: 'intake', handoff_protocol: { mode: 'response_sidecar' }, system_messages: [], tools: [], handoffs: [] }]
  };
  const session = createTeamSession({ call_id: 'bad-sidecar' }, llm);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not valid JSON' } }], usage: {} }) });
  try {
    const output = await runTeamTurn(session, 'Hello');
    assert.equal(output.content, 'not valid JSON');
    assert.equal(output.trace[0].control_protocol_error, 'Response-sidecar agent returned invalid JSON');
  } finally { globalThis.fetch = originalFetch; }
});

test('verified intake no longer sees the verification function', () => {
  const llm = { agents: [{ name: 'intake', tools: ['verify_right_party'], handoffs: [] }], tools: [{ name: 'verify_right_party', type: 'rest', parameters: { type: 'object' } }] };
  const session = createTeamSession({ call_id: 'verified-tool-scope' }, llm);
  session.variables.right_party_verified = true;
  assert.equal(scopedFunctions(session, {}).some((tool) => tool.function.name === 'verify_right_party'), false);
});
