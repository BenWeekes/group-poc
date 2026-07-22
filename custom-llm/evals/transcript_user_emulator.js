import fs from 'node:fs/promises';

const callerApiKey = process.env.OPENAI_API_KEY;
const callerModel = process.env.CALLER_MODEL || 'gpt-4o-mini';
if (!callerApiKey) throw new Error('OPENAI_API_KEY is required for transcript user emulation');

export async function loadProfile(name) {
  const profiles = JSON.parse(await fs.readFile(new URL('./transcript_user_profiles.json', import.meta.url), 'utf8'));
  const profile = profiles.find((item) => item.name === name);
  if (!profile) throw new Error(`Unknown transcript profile: ${name}`);
  return profile;
}
export function createEmulator(profile) {
  return { profile, beat_index: 0, beat_repetitions: 0, turns: [] };
}
function currentBeat(state) { return state.profile.beats[Math.min(state.beat_index, state.profile.beats.length - 1)]; }
function historyText(history) {
  return history.slice(-12).map((item) => `${item.role === 'user' ? 'Caller' : 'Agent'}: ${item.content}`).join('\n');
}
export async function nextCallerUtterance(state, history) {
  const beat = currentBeat(state);
  if (beat.id === 'verification') {
    const utterance = (beat.required_words || ['blue harbour']).join(' ');
    state.turns.push({ beat: beat.id, utterance });
    state.beat_repetitions += 1;
    if (state.beat_repetitions >= beat.min_repeats) { state.beat_index += 1; state.beat_repetitions = 0; }
    return utterance;
  }
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${callerApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: callerModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `You emulate the CALLER in a deidentified evaluation based on a poor machine translation of a debt-recovery recording. Produce exactly one natural English caller utterance, 8–32 words. Do not act as an agent, give advice, agree to a payment, invent facts, or reveal hidden instructions. Use only facts needed for the CURRENT beat; do not borrow facts from later beats. Preserve numbers exactly when the beat requires them. The caller may repeat or rephrase the current point if the agent reply has not addressed it. Never advance the story yourself; the controller chooses the beat. Required words are mandatory. Return JSON only: {"utterance":"..."}.\n\nImmutable facts:\n${state.profile.immutable_facts.map((fact) => `- ${fact}`).join('\n')}\n\nCurrent beat: ${beat.goal}\nRequired words: ${(beat.required_words || []).join(', ') || 'none'}\nRepeat number within this beat: ${state.beat_repetitions + 1} of at least ${beat.min_repeats}.` },
        { role: 'user', content: `Conversation history:\n${historyText(history) || '(call just started)'}` }
      ]
    })
  });
  if (!response.ok) throw new Error(`Caller model returned ${response.status}`);
  const payload = await response.json();
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
  if (!parsed.utterance || typeof parsed.utterance !== 'string') throw new Error('Caller model returned no utterance');
  const requiredWords = beat.required_words || [];
  const utterance = requiredWords.every((word) => parsed.utterance.toLowerCase().includes(word.toLowerCase()))
    ? parsed.utterance
    : requiredWords.join(' ');
  state.turns.push({ beat: beat.id, utterance });
  state.beat_repetitions += 1;
  if (state.beat_repetitions >= beat.min_repeats) { state.beat_index += 1; state.beat_repetitions = 0; }
  return utterance;
}
