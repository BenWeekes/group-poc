import fs from 'node:fs/promises';
import { createEmulator, loadProfile, nextCallerUtterance } from './transcript_user_emulator.js';

const endpoint = process.env.CUSTOM_LLM_URL || 'https://sa-dev.agora.io/group-poc/llm/chat/completions';
const profile = await loadProfile(process.env.TRANSCRIPT_PROFILE || 'employee_b_2');
const configFile = process.env.LLM_CONFIG || 'debt_recovery_team_llm.json';
const llm = JSON.parse(await fs.readFile(new URL(`./${configFile}`, import.meta.url), 'utf8'));
const state = createEmulator(profile);
const context = { appId: 'group-poc', userId: `transcript-user-${profile.name}`, channel: `transcript-user-${Date.now()}`, dialed_phone: '+441632960123' };
const history = [];

function parseSse(text) {
  for (const block of text.split(/\n\n/).reverse()) {
    const data = block.trim().replace(/^data:\s*/, '');
    if (data && data !== '[DONE]') return JSON.parse(data);
  }
  throw new Error('No JSON SSE event returned');
}
for (let turn = 0; turn < profile.maximum_caller_turns && state.beat_index < profile.beats.length; turn += 1) {
  const caller = await nextCallerUtterance(state, history);
  const started = performance.now();
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-group-poc-api-key': process.env.GROUP_POC_API_KEY || '' }, body: JSON.stringify({ model: llm.params.model, llm, context, messages: [{ role: 'user', content: caller }], stream: true }) });
  const body = parseSse(await response.text());
  const reply = body.choices?.[0]?.delta?.content || '';
  history.push({ role: 'user', content: caller });
  history.push({ role: 'assistant', content: reply });
  const last = state.turns.at(-1);
  last.agent = body.group_poc?.agent;
  last.tools = body.group_poc?.trace?.flatMap((pass) => pass.tool_calls) || [];
  last.usage = body.group_poc?.usage || {};
  last.wall_latency_ms = Number((performance.now() - started).toFixed(2));
  last.reply = reply;
  last.http_status = response.status;
  last.error = body.error?.message;
}
const report = { endpoint, profile: profile.name, source_line_utterances: profile.source_line_utterances, config: configFile, context, transcript: state.turns, totals: { caller_turns: state.turns.length, total_tokens: state.turns.reduce((sum, turn) => sum + Number(turn.usage?.total_tokens || 0), 0), total_wall_latency_ms: Number(state.turns.reduce((sum, turn) => sum + Number(turn.wall_latency_ms || 0), 0).toFixed(2)) } };
if (process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
