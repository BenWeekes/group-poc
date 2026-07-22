import fs from 'node:fs/promises';

const endpoint = process.env.CUSTOM_LLM_URL || 'https://sa-dev.agora.io/group-poc/llm/chat/completions';
const teamLlm = JSON.parse(await fs.readFile(new URL('./debt_recovery_team_llm.json', import.meta.url), 'utf8'));
const monolithicLlm = JSON.parse(await fs.readFile(new URL('./monolithic_debt_recovery_llm.json', import.meta.url), 'utf8'));
const cases = JSON.parse(await fs.readFile(new URL('./long_replay_cases.json', import.meta.url), 'utf8'));

if (process.env.TEAM_FORCE_ROOT_PROVIDER === 'true') {
  for (const agent of teamLlm.agents) {
    delete agent.url; delete agent.api_key; delete agent.vendor; delete agent.style;
    agent.params = { ...teamLlm.params, temperature: agent.params?.temperature ?? teamLlm.params.temperature };
  }
}

const expectedTool = (text) => {
  if (/\b(stop (all )?(collection )?(calls?|calling|contacting|messages?)|do not contact|don't contact|leave me alone)\b/i.test(text)) return 'register_contact_preference';
  if (/\b(wechat|qq|qr ?code|personal account|social media|banking app|wallet app|screen ?share)\b/i.test(text)) return 'log_safety_incident';
  if (/\b(can't sleep|cannot sleep|affecting my sleep|pressure is too high|humiliated|despair|suicid|kill myself|hurt myself|panic|can't cope)\b/i.test(text)) return 'create_hardship_case';
  if (/\b(failed|did not go through|changed the card|changed my card|restricted|wrong place|wrong destination)\b/i.test(text)) return 'open_payment_investigation';
  return null;
};
function parseSse(text) {
  for (const block of text.split(/\n\n/).reverse()) {
    const data = block.trim().replace(/^data:\s*/, '');
    if (data && data !== '[DONE]') return JSON.parse(data);
  }
  throw new Error('No JSON SSE event returned');
}
async function turn(llm, context, caller) {
  const started = performance.now();
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-group-poc-api-key': process.env.GROUP_POC_API_KEY || '' }, body: JSON.stringify({ model: llm.params.model, llm, context, messages: [{ role: 'user', content: caller }], stream: true }) });
  const body = parseSse(await response.text());
  const tools = body.group_poc?.trace?.flatMap((pass) => pass.tool_calls) || [];
  return { caller, http_status: response.status, error: body.error?.message, agent: body.group_poc?.agent, tools, expected_tool: expectedTool(caller), expected_tool_called: !expectedTool(caller) || tools.includes(expectedTool(caller)), wall_latency_ms: Number((performance.now() - started).toFixed(2)), usage: body.group_poc?.usage || {} };
}
async function runVariant(name, llm) {
  const results = [];
  for (const item of cases) {
    const context = { appId: 'group-poc', userId: `${name}-${item.name}`, channel: `${name}-${Date.now()}-${item.name}`, dialed_phone: '+441632960123' };
    for (const caller of [item.verification_answer, ...item.caller_turns]) results.push({ case: item.name, ...(await turn(llm, context, caller)) });
  }
  const measured = results.filter((item) => item.expected_tool);
  const verificationTurns = results.filter((item) => item.caller === 'blue harbour');
  return { name, results, summary: { turns: results.length, http_success_rate: results.filter((item) => item.http_status < 400).length / results.length, expected_tool_coverage: measured.filter((item) => item.expected_tool_called).length / measured.length, verification_turns_with_extra_tools: verificationTurns.filter((item) => item.tools.some((tool) => !['verify_right_party', 'handoff_to_account_status', 'get_account_summary'].includes(tool))).length, total_tokens: results.reduce((sum, item) => sum + Number(item.usage.total_tokens || 0), 0), total_wall_latency_ms: Number(results.reduce((sum, item) => sum + item.wall_latency_ms, 0).toFixed(2)), average_wall_latency_ms: Number((results.reduce((sum, item) => sum + item.wall_latency_ms, 0) / results.length).toFixed(2)) } };
}

const report = { endpoint, team: await runVariant('team', teamLlm), monolithic: await runVariant('monolithic', monolithicLlm) };
if (process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
