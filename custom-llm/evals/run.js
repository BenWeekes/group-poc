import fs from 'node:fs/promises';
import { routeTurn } from '../src/router.js';

const cases = JSON.parse(await fs.readFile(new URL('./cases.json', import.meta.url), 'utf8'));
const results = cases.map((item) => {
  const outcome = routeTurn({ agent: 'outbound_intake', rightPartyVerified: Boolean(item.verified) }, item.text);
  return { name: item.name, passed: outcome.agent === item.expected_agent && outcome.safetyGate === item.expected_safety_gate, expected_agent: item.expected_agent, actual_agent: outcome.agent, safety_gate: outcome.safetyGate, route_latency_ms: outcome.routeLatencyMs, specialist_prompt_tokens_estimate: outcome.specialistPromptTokens, monolithic_prompt_tokens_estimate: outcome.monolithicPromptTokens };
});
const passed = results.filter((r) => r.passed).length;
const average = (field) => Number((results.reduce((sum, item) => sum + item[field], 0) / results.length).toFixed(2));
console.log(JSON.stringify({ summary: { total: results.length, passed, pathway_accuracy: passed / results.length, average_route_latency_ms: average('route_latency_ms'), average_specialist_prompt_tokens_estimate: average('specialist_prompt_tokens_estimate'), monolithic_prompt_tokens_estimate: results[0].monolithic_prompt_tokens_estimate, estimated_prompt_token_reduction: Number((1 - average('specialist_prompt_tokens_estimate') / results[0].monolithic_prompt_tokens_estimate).toFixed(3)) }, results }, null, 2));
process.exitCode = passed === results.length ? 0 : 1;
