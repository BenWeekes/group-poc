import fs from 'node:fs/promises';

const endpoint = process.env.CUSTOM_LLM_URL || 'https://sa-dev.agora.io/group-poc/llm/chat/completions';
const callerApiKey = process.env.OPENAI_API_KEY;
const llm = JSON.parse(await fs.readFile(new URL('./debt_recovery_team_llm.json', import.meta.url), 'utf8'));
if (!callerApiKey) throw new Error('OPENAI_API_KEY is required for simulated caller evaluation');

function parseSse(text) {
  for (const block of text.split(/\n\n/).reverse()) {
    const data = block.trim().replace(/^data:\s*/, '');
    if (data && data !== '[DONE]') return JSON.parse(data);
  }
  throw new Error('No JSON SSE event returned');
}
const phases = [
  'Explain that a payment deduction failed after changing the payment card. Ask what happened.',
  'Say the deduction failed again and ask what options are available.',
  'Say you cannot afford the full amount today, but want to resolve it. Ask whether a smaller payment or short extension is possible.',
  'Describe growing distress: the repeated pressure is affecting sleep. Ask for time and support.',
  'State that you need contact to stop. Ask for no further collection calls.'
];

async function callerTurn(history, phase, finalPhase) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { authorization: `Bearer ${callerApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.7, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are simulating a caller for a debt-recovery evaluation. Produce exactly one natural English caller utterance, under 24 words. Follow only the current phase; do not anticipate later phases. Do not agree to pay, invent facts, or mention evaluation mechanics. Return JSON only: {"utterance":"...","done":false}.' }, { role: 'user', content: `Current phase: ${phase}\nThis is the ${finalPhase ? 'final' : 'current'} phase.\nConversation so far:\n${history.slice(-8).join('\n')}` }] })
  });
  if (!response.ok) throw new Error(`Caller model returned ${response.status}`);
  return JSON.parse((await response.json()).choices[0].message.content);
}
async function engineTurn(context, text) {
  const started = performance.now();
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-group-poc-api-key': process.env.GROUP_POC_API_KEY || '' }, body: JSON.stringify({ model: llm.params.model, llm, context, messages: [{ role: 'user', content: text }], stream: true }) });
  const body = parseSse(await response.text());
  return { caller: text, agent: body.group_poc?.agent, reply: body.choices?.[0]?.delta?.content, trace: body.group_poc?.trace, usage: body.group_poc?.usage, wall_latency_ms: Number((performance.now() - started).toFixed(2)) };
}

const context = { appId: 'group-poc', userId: 'simulated-caller', channel: `sim-${Date.now()}`, dialed_phone: '+441632960123' };
const transcript = [];
transcript.push(await engineTurn(context, 'blue harbour'));
for (let index = 0; index < phases.length; index += 1) {
  const history = transcript.flatMap((turn) => [`Caller: ${turn.caller}`, `Agent: ${turn.reply}`]);
  const next = await callerTurn(history, phases[index], index === phases.length - 1);
  const turn = await engineTurn(context, next.utterance);
  transcript.push(turn);
  if (next.done) break;
}
const report = { endpoint, transcript };
if (process.env.REPORT_PATH) await fs.writeFile(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
