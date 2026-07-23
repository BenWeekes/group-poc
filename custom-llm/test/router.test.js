import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOffer, routeTurn } from '../src/router.js';
import { boundedHistory, createTeamSession, executeTeamTool, runTeamTurn, scopedFunctions } from '../src/team_runtime.js';

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
