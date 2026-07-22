import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOffer, routeTurn } from '../src/router.js';
import { boundedHistory } from '../src/team_runtime.js';

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
