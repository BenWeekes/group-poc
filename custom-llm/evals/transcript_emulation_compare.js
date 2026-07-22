import fs from 'node:fs/promises';

const endpoint = process.env.CUSTOM_LLM_URL || 'https://sa-dev.agora.io/group-poc/llm/chat/completions';
const teamLlm = JSON.parse(await fs.readFile(new URL('./debt_recovery_team_llm.json', import.meta.url), 'utf8'));
const monolithicLlm = JSON.parse(await fs.readFile(new URL('./monolithic_debt_recovery_llm.json', import.meta.url), 'utf8'));
const cases = JSON.parse(await fs.readFile(new URL('./transcript_length_emulations.json', import.meta.url), 'utf8'));

teamLlm.enable_global_interrupts = false;
monolithicLlm.enable_global_interrupts = false;
for (const agent of teamLlm.agents) {
  delete agent.url; delete agent.api_key; delete agent.vendor; delete agent.style;
  agent.params = { ...teamLlm.params, temperature: 0 };
}
monolithicLlm.params.temperature = 0;
function parseSse(text) {
  for (const block of text.split(/\n\n/).reverse()) {
    const data = block.trim().replace(/^data:\s*/, '');
    if (data && data !== '[DONE]') return JSON.parse(data);
  }
  throw new Error('No JSON SSE event returned');
}
async function runVariant(name, llm) {
  const results = [];
  for (const item of cases) {
    const context = { appId: 'group-poc', userId: `${name}-${item.name}`, channel: `${name}-${item.name}-${Date.now()}`, dialed_phone: '+441632960123' };
    for (const step of item.turns) {
      const started = performance.now();
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-group-poc-api-key': process.env.GROUP_POC_API_KEY || '' }, body: JSON.stringify({ model: 'gpt-4o-mini', llm, context, messages: [{ role: 'user', content: step.caller }], stream: true }) });
      const body = parseSse(await response.text());
      const tools = body.group_poc?.trace?.flatMap((pass) => pass.tool_calls) || [];
      const required = step.required || [];
      const forbidden = step.forbidden || [];
      results.push({ case: item.name, caller: step.caller, agent: body.group_poc?.agent, tools, required, required_passed: required.every((tool) => tools.includes(tool)), forbidden, forbidden_called: forbidden.filter((tool) => tools.includes(tool)), http_status: response.status, wall_latency_ms: Number((performance.now() - started).toFixed(2)), usage: body.group_poc?.usage || {} });
    }
  }
  const labelled = results.filter((item) => item.required.length);
  return { name, results, summary: { turns: results.length, labelled_action_coverage: labelled.filter((item) => item.required_passed).length / labelled.length, forbidden_tool_calls: results.reduce((sum, item) => sum + item.forbidden_called.length, 0), http_success_rate: results.filter((item) => item.http_status < 400).length / results.length, total_tokens: results.reduce((sum, item) => sum + Number(item.usage.total_tokens || 0), 0), average_wall_latency_ms: Number((results.reduce((sum, item) => sum + item.wall_latency_ms, 0) / results.length).toFixed(2)) } };
}
const report = { endpoint, controls: { provider: 'gpt-4o-mini', temperature: 0, global_interrupts: false, tool_service: 'shared', stream: true }, cases: cases.map((item) => ({ name: item.name, source_lines: item.source_lines, emulated_caller_turns: item.turns.length })), team: await runVariant('team', teamLlm), monolithic: await runVariant('monolithic', monolithicLlm) };
if (process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
