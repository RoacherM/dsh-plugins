import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { zstdCompressSync } from 'node:zlib';
import * as dsh from '../src/host/adapters/dsh.js';
import * as claude from '../src/host/adapters/claude.js';
import * as codex from '../src/host/adapters/codex.js';
import * as pi from '../src/host/adapters/pi.js';
import * as epi from '../src/host/adapters/epi.js';
import * as grok from '../src/host/adapters/grok.js';
import { readSessions } from '../src/host/adapters/antigravity.js';

const line = (value) => JSON.stringify(value);

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'trajecable-adapter-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const dshEvents = [
  { type: 'session', version: 4, id: 's1', createdAt: '2026-05-01T09:00:00.000Z', cwd: '/work/demo', origin: 'user' },
  { type: 'session/title', data: { title: 'Fix parser' } },
  { type: 'user/message', time: Date.parse('2026-05-01T09:00:10.000Z'), data: { content: [{ type: 'text', text: 'fix parser bug' }] } },
  { type: 'assistant/message', time: Date.parse('2026-05-01T09:00:20.000Z'), data: { message: { source: { provider: 'deepseek', model: 'deepseek-chat' } }, usage: { inputTokens: 900, outputTokens: 100, totalTokens: 6000, cacheReadTokens: 5000 } } },
  { type: 'tool/call', time: Date.parse('2026-05-01T09:01:00.000Z'), data: { name: 'edit', arguments: JSON.stringify({ file_path: '/work/demo/src/parser.js' }), callId: 'c1' } },
  { type: 'tool/result', time: Date.parse('2026-05-01T09:01:05.000Z'), data: { message: { toolCallId: 'c1', isError: false } } },
  { type: 'tool/call', time: Date.parse('2026-05-01T09:02:00.000Z'), data: { name: 'bash', arguments: JSON.stringify({ command: 'npm test' }), callId: 'c2' } },
  { type: 'tool/result', time: Date.parse('2026-05-01T09:02:30.000Z'), data: { message: { toolCallId: 'c2', isError: true } } },
  { type: 'user/message', time: Date.parse('2026-05-01T09:03:00.000Z'), data: { content: [{ type: 'text', text: 'and add a test' }] } },
];

test('DSH adapter folds plain JSONL and reads the header fields', async (t) => {
  const root = await workspace(t);
  const file = join(root, 'session.v4.jsonl');
  await writeFile(file, dshEvents.map(line).join('\n') + '\n');

  const session = await dsh.readSession(file);
  assert.equal(session.title, 'Fix parser');
  assert.equal(session.cwd, '/work/demo');
  assert.equal(session.project, 'demo');
  assert.equal(session.origin, 'user');
  assert.equal(session.model, 'deepseek-chat');
  // Live HUD counts: one turn per user prompt, LLM replies and tool results per turn.
  assert.equal(session.llmCount, 1);
  // Tokens are the reply's totalTokens (input + cache + output), as in DSH's Usage footer.
  assert.equal(session.tokens, 6000);
  assert.deepEqual(session.recent, [{ t: Date.parse('2026-05-01T09:00:20.000Z'), tokens: 6000 }]);
  assert.deepEqual(session.turns.map((turn) => turn.tokens), [6000, 0]);
  assert.deepEqual(session.turns.map(({ n, llm, tools, errors }) => ({ n, llm, tools, errors })), [
    { n: 1, llm: 1, tools: 2, errors: 1 },
    { n: 2, llm: 0, tools: 0, errors: 0 },
  ]);
  assert.equal(session.promptCount, 2);
  assert.equal(session.prompts[0].text, 'fix parser bug');
  assert.equal(session.fileCount, 1);
  assert.deepEqual(session.files, ['/work/demo/src/parser.js']);
  assert.equal(session.testRuns, 1);
  assert.equal(session.testFails, 1);
  assert.equal(session.errors, 1);
  assert.equal(session.commands[0].ok, false);
});

test('DSH adapter decodes a file of concatenated zstd frames', async (t) => {
  const root = await workspace(t);
  const file = join(root, 'session.v4.jsonl.zstd');
  const frames = dshEvents.map((event) => zstdCompressSync(Buffer.from(line(event) + '\n')));
  await writeFile(file, Buffer.concat(frames));

  const session = await dsh.readSession(file);
  assert.match(session.key, /^dsh:/);
  assert.equal(session.title, 'Fix parser');
  assert.equal(session.promptCount, 2);
  assert.equal(session.toolCount, 2);
});

test('Claude adapter keeps the custom title, branch, tool files and failures', async (t) => {
  const root = await workspace(t);
  await mkdir(join(root, '.claude', 'projects', '-work-demo'), { recursive: true });
  const file = join(root, '.claude', 'projects', '-work-demo', 'c1.jsonl');
  const records = [
    { type: 'custom-title', customTitle: 'Timeline work' },
    { type: 'user', timestamp: '2026-05-02T10:00:00.000Z', cwd: '/work/demo', gitBranch: 'main', sessionId: 'c1', message: { role: 'user', content: 'add a timeline' } },
    { type: 'assistant', timestamp: '2026-05-02T10:00:10.000Z', message: { model: 'claude-sonnet-4', content: [
      { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/work/demo/src/timeline.js' } },
      { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'pnpm test' } },
    ] } },
    { type: 'user', timestamp: '2026-05-02T10:00:30.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't2', is_error: true }] } },
  ];
  await writeFile(file, records.map(line).join('\n') + '\n');

  const session = claude.create(file);
  for (const record of records) claude.feed(session, record);
  claude.finalize(session);

  assert.equal(session.title, 'Timeline work');
  assert.equal(session.cwd, '/work/demo');
  assert.equal(session.project, 'demo');
  assert.equal(session.branch, 'main');
  assert.equal(session.model, 'claude-sonnet-4');
  assert.equal(session.promptCount, 1);
  assert.equal(session.fileCount, 1);
  assert.deepEqual(session.files, ['/work/demo/src/timeline.js']);
  assert.equal(session.testRuns, 1);
  assert.equal(session.testFails, 1);
  assert.equal(session.errors, 1);
});

test('Codex adapter folds messages, function calls and patch files', async (t) => {
  const root = await workspace(t);
  const file = join(root, 'rollout-2026-05-03T09-00-00-x1.jsonl');
  const records = [
    { timestamp: '2026-05-03T09:00:00.000Z', type: 'session_meta', payload: { id: 'x1', cwd: '/work/demo', timestamp: '2026-05-03T09:00:00.000Z', thread_source: 'user' } },
    { timestamp: '2026-05-03T09:00:01.000Z', type: 'turn_context', payload: { cwd: '/work/demo', model: 'gpt-5-codex' } },
    { timestamp: '2026-05-03T09:00:10.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'fix tests' }] } },
    { timestamp: '2026-05-03T09:01:00.000Z', type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ command: 'npm test' }), call_id: 'f1' } },
    { timestamp: '2026-05-03T09:01:30.000Z', type: 'response_item', payload: { type: 'function_call_output', call_id: 'f1', output: '{"exit_code":2,"output":"failed"}' } },
    { timestamp: '2026-05-03T09:02:00.000Z', type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', input: '*** Begin Patch\n*** Update File: src/app.js\n*** End Patch', call_id: 'f2' } },
    { timestamp: '2026-05-03T09:02:10.000Z', type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'f2', output: 'Success' } },
  ];
  await writeFile(file, records.map(line).join('\n') + '\n');

  const session = codex.create(file);
  for (const record of records) codex.feed(session, record);
  codex.finalize(session);

  assert.equal(session.id, 'x1');
  assert.equal(session.cwd, '/work/demo');
  assert.equal(session.project, 'demo');
  assert.equal(session.model, 'gpt-5-codex');
  assert.equal(session.origin, 'user');
  assert.equal(session.promptCount, 1);
  assert.equal(session.fileCount, 1);
  assert.deepEqual(session.files, ['src/app.js']);
  assert.equal(session.testRuns, 1);
  assert.equal(session.testFails, 1);
  assert.equal(session.errors, 1);
  assert.equal(session.title, 'fix tests');
});

const piRecords = [
  { type: 'session', version: 3, id: 'p1', timestamp: '2026-05-01T09:00:00.000Z', cwd: '/work/demo' },
  { type: 'model_change', provider: 'demo', modelId: 'pi-model', timestamp: '2026-05-01T09:00:01.000Z' },
  { type: 'message', timestamp: '2026-05-01T09:00:10.000Z', message: { role: 'user', content: [{ type: 'text', text: 'fix parser' }] } },
  { type: 'message', timestamp: '2026-05-01T09:01:00.000Z', message: { role: 'assistant', model: 'pi-model', content: [
    { type: 'toolCall', id: 't1', name: 'edit', arguments: { file_path: '/work/demo/src/parser.js' } },
    { type: 'toolCall', id: 't2', name: 'bash', arguments: { command: 'npm test' } },
  ] } },
  { type: 'message', timestamp: '2026-05-01T09:02:00.000Z', message: { role: 'toolResult', toolCallId: 't2', isError: true, content: [] } },
];

test('Pi adapter reads nested message rows and tool calls', async (t) => {
  const root = await workspace(t);
  const file = join(root, '2026-05-01T09-00-00-000Z_p1.jsonl');
  await writeFile(file, piRecords.map(line).join('\n') + '\n');

  const session = await pi.readSession(file);
  assert.equal(session.agent, 'pi');
  assert.equal(session.key, 'pi:p1');
  assert.equal(session.title, 'fix parser');
  assert.equal(session.cwd, '/work/demo');
  assert.equal(session.project, 'demo');
  assert.equal(session.model, 'pi-model');
  assert.equal(session.promptCount, 1);
  assert.equal(session.toolCount, 2);
  assert.equal(session.fileCount, 1);
  assert.equal(session.testRuns, 1);
  assert.equal(session.testFails, 1);
  assert.equal(session.errors, 1);
});

test('Epi reuses the Pi format but keeps its own agent name', async (t) => {
  const root = await workspace(t);
  const file = join(root, '2026-05-01T09-00-00-000Z_p2.jsonl');
  await writeFile(file, piRecords.map(line).join('\n') + '\n');

  const session = await epi.readSession(file);
  assert.equal(session.agent, 'epi');
  assert.equal(session.title, 'fix parser');
});

test('Grok adapter reads summary and tool updates', async (t) => {
  const root = await workspace(t);
  const dir = join(root, 'demo', 'g1');
  await mkdir(dir, { recursive: true });
  const summary = {
    info: { id: 'g1', cwd: '/work/demo' },
    generated_title: 'Timeline review',
    head_branch: 'main',
    current_model_id: 'grok-4',
    created_at: '2026-05-05T08:00:00.000Z',
    updated_at: '2026-05-05T08:30:00.000Z',
  };
  await writeFile(join(dir, 'summary.json'), JSON.stringify(summary));
  const updates = [
    { timestamp: '2026-05-05T08:01:00.000Z', params: { update: { sessionUpdate: 'user_message_chunk', content: { text: 'fix parser' }, _meta: { promptIndex: 0 } } } },
    { timestamp: '2026-05-05T08:02:00.000Z', params: { update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'write', rawInput: { file_path: '/work/demo/src/parser.js' }, _meta: { 'x.ai/tool': { name: 'write', kind: 'write' } } } } },
    { timestamp: '2026-05-05T08:02:30.000Z', params: { update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' } } },
    { timestamp: '2026-05-05T08:03:00.000Z', params: { update: { sessionUpdate: 'tool_call', toolCallId: 't2', title: 'run_terminal_command', rawInput: { command: 'npm test' }, _meta: { 'x.ai/tool': { name: 'run_terminal_command', kind: 'execute' } } } } },
    { timestamp: '2026-05-05T08:03:30.000Z', params: { update: { sessionUpdate: 'tool_call_update', toolCallId: 't2', status: 'failed', rawOutput: { exit_code: 1 } } } },
  ];
  await writeFile(join(dir, 'updates.jsonl'), updates.map(line).join('\n') + '\n');

  const session = await grok.readSession(dir);
  assert.equal(session.agent, 'grok');
  assert.equal(session.key, 'grok:g1');
  assert.equal(session.title, 'Timeline review');
  assert.equal(session.cwd, '/work/demo');
  assert.equal(session.project, 'demo');
  assert.equal(session.branch, 'main');
  assert.equal(session.model, 'grok-4');
  assert.equal(session.promptCount, 1);
  assert.equal(session.toolCount, 2);
  assert.equal(session.fileCount, 1);
  assert.equal(session.testRuns, 1);
  assert.equal(session.testFails, 1);
  assert.equal(session.errors, 1);
});

test('Antigravity adapter reads SQLite summaries and drops placeholder rows', async (t) => {
  let DatabaseSync;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch { t.skip('node:sqlite unavailable'); return; }
  const root = await workspace(t);
  const file = join(root, 'conversation_summaries.db');
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE conversation_summaries (
    conversation_id text PRIMARY KEY, title text, preview text, step_count integer,
    last_modified_time datetime, workspace_uris text, last_user_input_time datetime
  )`);
  const insert = db.prepare('INSERT INTO conversation_summaries VALUES (?,?,?,?,?,?,?)');
  insert.run('a1', 'Video research', 'find good clips', 12,
    '2026-05-06 10:30:00.000000+00:00', '["file:///work/demo"]', '2026-05-06 10:00:00.000000+00:00');
  insert.run('a2', 'Empty', '', 0,
    '0001-01-01 00:00:00+00:00', '[]', '0001-01-01 00:00:00+00:00');
  db.close();

  const sessions = await readSessions(file, 'cli');
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].agent, 'antigravity');
  assert.equal(sessions[0].key, 'antigravity:cli:a1');
  assert.equal(sessions[0].title, 'Video research');
  assert.equal(sessions[0].project, 'demo');
  assert.equal(sessions[0].promptCount, 1);
  assert.equal(new Date(sessions[0].start).toISOString(), '2026-05-06T10:00:00.000Z');
});
