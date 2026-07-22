import fs from 'node:fs/promises';

const endpoint = process.env.CUSTOM_LLM_URL || 'http://127.0.0.1:8110/chat/completions';
const llm = JSON.parse(await fs.readFile(new URL('./debt_recovery_team_llm.json', import.meta.url), 'utf8'));
const context = { appId: 'group-poc', userId: 'alex-morgan', channel: `team-eval-${Date.now()}`, dialed_phone: '+441632960123' };
const turns = [
  'blue harbour',
  'My deduction failed three times after I changed my card this morning.',
  'The pressure is too high. I cannot sleep and I need time to deal with this.',
  'Please stop calling me.'
];

const output = [];
for (const text of turns) {
  const started = performance.now();
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-group-poc-api-key': process.env.GROUP_POC_API_KEY || '' }, body: JSON.stringify({ model: 'gpt-4o-mini', llm, context, messages: [{ role: 'user', content: text }] }) });
  const body = await response.json();
  output.push({ user: text, http_status: response.status, error: body.error?.message, wall_latency_ms: Number((performance.now() - started).toFixed(2)), agent: body.group_poc?.agent, reply: body.choices?.[0]?.message?.content, usage: body.group_poc?.usage, trace: body.group_poc?.trace });
  if (!response.ok) break;
}
console.log(JSON.stringify({ context, output }, null, 2));
