import fs from 'node:fs/promises';
import { createEmulator, loadProfile, nextCallerUtterance } from './transcript_user_emulator.js';

const endpoint = process.env.CUSTOM_LLM_URL || 'https://sa-dev.agora.io/group-poc/llm/chat/completions';
const profile = await loadProfile(process.env.TRANSCRIPT_PROFILE || 'employee_a_2');
const teamTemplate = JSON.parse(await fs.readFile(new URL('./debt_recovery_team_llm.json', import.meta.url), 'utf8'));
const monolithicTemplate = JSON.parse(await fs.readFile(new URL('./monolithic_debt_recovery_llm.json', import.meta.url), 'utf8'));

function configuredTeam() {
  const llm = structuredClone(teamTemplate);
  llm.enable_global_interrupts = false;
  for (const agent of llm.agents) {
    delete agent.url; delete agent.api_key; delete agent.vendor; delete agent.style;
    agent.params = { ...llm.params, temperature: 0 };
  }
  return llm;
}
function configuredMonolithic() {
  const llm = structuredClone(monolithicTemplate);
  llm.enable_global_interrupts = false;
  llm.params.temperature = 0;
  return llm;
}
function parseSse(text) {
  for (const block of text.split(/\n\n/).reverse()) {
    const data = block.trim().replace(/^data:\s*/, '');
    if (data && data !== '[DONE]') return JSON.parse(data);
  }
  throw new Error('No JSON SSE event returned');
}
async function runVariant(name, llm) {
  const caller = createEmulator(profile);
  const context = { appId: 'group-poc', userId: `paired-${name}-${profile.name}`, channel: `paired-${name}-${Date.now()}`, dialed_phone: '+441632960123' };
  const history = [];
  for (let index = 0; index < profile.maximum_caller_turns && caller.beat_index < profile.beats.length; index += 1) {
    const utterance = await nextCallerUtterance(caller, history);
    const started = performance.now();
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-group-poc-api-key': process.env.GROUP_POC_API_KEY || '' }, body: JSON.stringify({ model: 'gpt-4o-mini', llm, context, messages: [{ role: 'user', content: utterance }], stream: true }) });
    const body = parseSse(await response.text());
    const reply = body.choices?.[0]?.delta?.content || '';
    history.push({ role: 'user', content: utterance });
    history.push({ role: 'assistant', content: reply });
    const turn = caller.turns.at(-1);
    turn.agent = body.group_poc?.agent;
    turn.tools = body.group_poc?.trace?.flatMap((pass) => pass.tool_calls) || [];
    turn.reply = reply;
    turn.http_status = response.status;
    turn.error = body.error?.message;
    turn.wall_latency_ms = Number((performance.now() - started).toFixed(2));
    turn.usage = body.group_poc?.usage || {};
  }
  return { name, transcript: caller.turns, summary: { caller_turns: caller.turns.length, http_success_rate: caller.turns.filter((turn) => turn.http_status < 400).length / caller.turns.length, total_tokens: caller.turns.reduce((sum, turn) => sum + Number(turn.usage?.total_tokens || 0), 0), average_wall_latency_ms: Number((caller.turns.reduce((sum, turn) => sum + Number(turn.wall_latency_ms || 0), 0) / caller.turns.length).toFixed(2)) } };
}
const report = { endpoint, profile: profile.name, source_line_utterances: profile.source_line_utterances, controls: { agent_provider: 'gpt-4o-mini', caller_provider: 'gpt-4o-mini', temperature: 0, global_interrupts: false, tool_service: 'shared', paired_adaptive_histories: true }, team: await runVariant('team', configuredTeam()), monolithic: await runVariant('monolithic', configuredMonolithic()) };
if (process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
