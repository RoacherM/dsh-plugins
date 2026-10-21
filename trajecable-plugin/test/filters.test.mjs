import assert from 'node:assert/strict';
import test from 'node:test';
import { addPrompt, finalizeSession, isInjectedPrompt, newSession } from '../src/host/util.js';

test('isInjectedPrompt drops runtime notices and keeps human requests', () => {
  const noise = [
    'The approval policy changed from "ask" to "never" (changed by the user).',
    'The user declined the tool call.',
    'background job bash-1d4cc5b4ab9b4b71 (bash: npm test) finished [status: completed, exit code: 0].',
    'Background subagent adcb2264 finished and will do no further work unless you send it more.',
    '[Request interrupted by user]',
    '[Request interrupted by user for tool use]',
    'This session is being continued from a previous conversation that ran out of context.',
    'Agent cac100bf-aaec-496f-9df1-bee7b5cd9461 sent a message: Progress update',
    'Agent session-b64092bf-87e9-467d-b061-1fb45cee9556 sent a message: Please wrap now.',
    '[43] assistant: OpenMA has a reusable session base.',
    '[36] tool exec call: text(await tools.exec_command({cmd:"ls"}))',
    '[model changed: assistant turns above this point use a different model]',
    '[autoproject] Run remote-machine-p1 stopped. Tell the user what happened.',
    'Repeated tool call detected: - tool: update_goal',
    'You are repeating the exact same tool call with identical arguments.',
    'You ran the identical `read_image` call three times.',
    'This is an automatically generated checkpoint context.',
    'Time sampled while preparing turn 5, step 2: 2026-01-01T00:00:00Z',
    'The user switched this session to plan mode.',
    'Current runtime context. This snapshot supersedes earlier runtime-context snapshots.',
    '# AGENTS.md instructions',
  ];
  for (const text of noise) assert.equal(isInjectedPrompt(text), true, text);

  const requests = [
    '想做一个 trajecable 的插件，每天扫描本地 coding agent 的对话记录。',
    'The parser should keep the last complete line.',
    'background jobs should run once a day',
    'Please review the approval policy change.',
    'Agent Smith sent a message to the team.',
  ];
  for (const text of requests) assert.equal(isInjectedPrompt(text), false, text);
});

test('addPrompt ignores notices for count, title and start', () => {
  const session = newSession('dsh', 'dsh:a', 'a');
  session.start = 1000;
  session.end = 1000;
  addPrompt(session, 2000, 'The approval policy changed from "ask" to "never" (changed by the user).');
  addPrompt(session, 3000, '[Request interrupted by user]');
  assert.equal(session.promptCount, 0);
  assert.equal(session.prompts.length, 0);
  assert.equal(session.title, '');
  assert.equal(session.start, 1000);

  addPrompt(session, 4000, 'Fix the parser');
  assert.equal(session.promptCount, 1);
  assert.equal(session.prompts[0].text, 'Fix the parser');
  finalizeSession(session);
  assert.equal(session.title, 'Fix the parser');
});
