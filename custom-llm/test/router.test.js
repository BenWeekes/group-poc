import test from 'node:test';
import assert from 'node:assert/strict';
import { routeTurn } from '../src/router.js';

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
