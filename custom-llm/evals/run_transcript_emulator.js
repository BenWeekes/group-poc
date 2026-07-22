import { createEmulator, loadProfile, nextCallerUtterance } from './transcript_user_emulator.js';

const profile = await loadProfile(process.env.TRANSCRIPT_PROFILE || 'employee_b_2');
const state = createEmulator(profile);
const history = [];
for (let turn = 0; turn < profile.maximum_caller_turns && state.beat_index < profile.beats.length; turn += 1) {
  const utterance = await nextCallerUtterance(state, history);
  history.push({ role: 'user', content: utterance });
  history.push({ role: 'assistant', content: '[No agent reply: preview mode]' });
}
console.log(JSON.stringify({ profile: profile.name, source_line_utterances: profile.source_line_utterances, caller_turns: state.turns }, null, 2));
