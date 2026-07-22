import fs from 'node:fs/promises';

const endpoint = process.env.CUSTOM_LLM_URL || 'https://sa-dev.agora.io/group-poc/llm/chat/completions';
const llm = JSON.parse(await fs.readFile(new URL('./debt_recovery_team_llm.json', import.meta.url), 'utf8'));
const cases = JSON.parse(await fs.readFile(new URL('./long_replay_cases.json', import.meta.url), 'utf8'));

function parseSse(text) {
  const events = text.split(/\n\n/).map((block) => block.trim()).filter(Boolean);
  for (const event of events.reverse()) {
    const data = event.replace(/^data:\s*/, '');
    if (data && data !== '[DONE]') return JSON.parse(data);
  }
  throw new Error('No JSON SSE event returned');
}
async function engineTurn(context, text) {
  const started = performance.now();
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: llm.params.model, llm, context, messages: [{ role: 'user', content: text }], stream: true }) });
  const body = parseSse(await response.text());
  return { http_status: response.status, error: body.error?.message, wall_latency_ms: Number((performance.now() - started).toFixed(2)), caller: text, agent: body.group_poc?.agent, reply: body.choices?.[0]?.delta?.content, trace: body.group_poc?.trace, usage: body.group_poc?.usage };
}

const results = [];
for (const testCase of cases.filter((item) => !process.env.CASE_NAME || item.name === process.env.CASE_NAME)) {
  const context = { appId: 'group-poc', userId: `replay-${testCase.name}`, channel: `replay-${Date.now()}-${testCase.name}`, dialed_phone: '+441632960123' };
  const turns = [testCase.verification_answer, ...testCase.caller_turns];
  const trace = [];
  for (const text of turns) {
    const result = await engineTurn(context, text);
    trace.push(result);
    if (result.http_status >= 400) break;
  }
  results.push({ name: testCase.name, source: testCase.source, turns: trace });
}
const report = { endpoint, results };
if (process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
