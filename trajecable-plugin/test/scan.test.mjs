import assert from 'node:assert/strict';
import { appendFile, readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createStore } from '../src/host/store.js';
import { scanDshSession, scanSources } from '../src/host/scan.js';

const line = (value) => JSON.stringify(value);

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'trajecable-scan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sources = {
    dsh: join(root, 'sessions'),
    claude: join(root, 'claude', 'projects'),
    codex: join(root, 'codex', 'sessions'),
  };
  const dshDir = join(sources.dsh, 'ws', 's1');
  const claudeDir = join(sources.claude, '-work-demo');
  const codexDir = join(sources.codex, '2026', '05', '03');
  await Promise.all([mkdir(dshDir, { recursive: true }), mkdir(claudeDir, { recursive: true }), mkdir(codexDir, { recursive: true })]);

  await writeFile(join(dshDir, 'session.v4.jsonl'), [
    line({ type: 'session', version: 4, id: 's1', createdAt: '2026-05-01T09:00:00.000Z', cwd: '/work/demo' }),
    line({ type: 'session/title', data: { title: 'DSH task' } }),
    line({ type: 'user/message', time: Date.parse('2026-05-01T09:00:10.000Z'), data: { content: [{ type: 'text', text: 'dsh prompt' }] } }),
  ].join('\n') + '\n');

  const claudeFile = join(claudeDir, 'c1.jsonl');
  await writeFile(claudeFile, [
    line({ type: 'custom-title', customTitle: 'Claude task' }),
    line({ type: 'user', timestamp: '2026-05-02T10:00:00.000Z', cwd: '/work/demo', message: { role: 'user', content: 'claude prompt' } }),
  ].join('\n') + '\n');

  await writeFile(join(codexDir, 'rollout-x1.jsonl'), [
    line({ timestamp: '2026-05-03T09:00:00.000Z', type: 'session_meta', payload: { id: 'x1', cwd: '/work/demo' } }),
    line({ timestamp: '2026-05-03T09:00:10.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'codex prompt' }] } }),
  ].join('\n') + '\n');

  return { root, sources, claudeFile };
}

test('scan is incremental, resumes a torn last line, and persists the index', async (t) => {
  const { root, sources, claudeFile } = await setup(t);
  const store = createStore({ dir: join(root, 'index') });

  const first = await scanSources({ store, sources });
  assert.deepEqual(first, { files: 3, changed: 3, done: 3 });
  assert.equal(Object.keys(store.snapshot().sessions).length, 3);
  assert.ok(store.lastScanAt() > 0);
  const claude = Object.values(store.snapshot().sessions).find((session) => session.agent === 'claude');
  assert.equal(claude.promptCount, 1);

  const second = await scanSources({ store, sources });
  assert.deepEqual(second, { files: 3, changed: 0, done: 3 });

  const partial = line({ type: 'user', timestamp: '2026-05-02T10:01:00.000Z', cwd: '/work/demo', message: { role: 'user', content: 'second prompt' } });
  await appendFile(claudeFile, partial);
  const torn = await scanSources({ store, sources });
  assert.equal(torn.changed, 0, 'an unterminated line is not read');
  assert.equal(store.snapshot().sessions[claude.key].promptCount, 1);

  await appendFile(claudeFile, '\n');
  const resumed = await scanSources({ store, sources });
  assert.equal(resumed.changed, 1);
  assert.equal(store.snapshot().sessions[claude.key].promptCount, 2);
  assert.equal(store.snapshot().sessions[claude.key].prompts[1].text, 'second prompt');

  const reopened = createStore({ dir: store.dir });
  await reopened.load();
  assert.equal(Object.keys(reopened.snapshot().sessions).length, 3);
  assert.equal(reopened.snapshot().sessions[claude.key].promptCount, 2);
});

test('scan discovers Pi and Grok stores and skips unchanged sessions', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'trajecable-scan-extra-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sources = {
    pi: join(root, 'pi'),
    epi: join(root, 'epi'),
    grok: join(root, 'grok'),
    antigravity: [],
  };
  const piDir = join(sources.pi, '--work-demo--');
  const epiDir = join(sources.epi, '--work-demo--');
  const grokDir = join(sources.grok, '%2Fwork%2Fdemo', 'g1');
  await Promise.all([mkdir(piDir, { recursive: true }), mkdir(epiDir, { recursive: true }), mkdir(grokDir, { recursive: true })]);

  for (const [dir, id, text] of [[piDir, 'p1', 'pi prompt'], [epiDir, 'e1', 'epi prompt']]) {
    await writeFile(join(dir, `2026-06-01T09-00-00-000Z_${id}.jsonl`), [
      line({ type: 'session', version: 3, id, timestamp: '2026-06-01T09:00:00.000Z', cwd: '/work/demo' }),
      line({ type: 'message', message: { role: 'user', content: [{ type: 'text', text }] } }),
    ].join('\n') + '\n');
  }

  await writeFile(join(grokDir, 'summary.json'), JSON.stringify({
    info: { id: 'g1', cwd: '/work/demo' }, generated_title: 'Grok task',
    current_model_id: 'grok-4', created_at: '2026-06-02T09:00:00.000Z', updated_at: '2026-06-02T09:01:00.000Z',
  }));
  await writeFile(join(grokDir, 'updates.jsonl'), line({
    timestamp: '2026-06-02T09:00:10.000Z',
    params: { update: { sessionUpdate: 'user_message_chunk', content: { text: 'grok prompt' }, _meta: { promptIndex: 0 } } },
  }) + '\n');

  const store = createStore({ dir: join(root, 'index') });
  const first = await scanSources({ store, sources });
  assert.deepEqual(first, { files: 3, changed: 3, done: 3 });
  const sessions = Object.values(store.snapshot().sessions);
  assert.deepEqual(sessions.map((session) => session.agent).sort(), ['epi', 'grok', 'pi']);
  assert.equal(sessions.find((session) => session.agent === 'grok').title, 'Grok task');

  const second = await scanSources({ store, sources });
  assert.deepEqual(second, { files: 3, changed: 0, done: 3 });
});

test('scanDshSession indexes one new DSH session before any full scan, and picks up new turns', async (t) => {
  const { root, sources } = await setup(t);
  const store = createStore({ dir: join(root, 'index') });
  await store.load();

  assert.equal(await scanDshSession({ store, root: sources.dsh, id: 'missing' }), false);
  assert.equal(await scanDshSession({ store, root: sources.dsh, id: '../ws' }), false);
  assert.equal(await scanDshSession({ store, root: sources.dsh, id: 's1' }), true);
  assert.equal(store.session('dsh:s1').promptCount, 1);
  assert.equal(Object.keys(store.snapshot().sessions).length, 1, 'only the asked session is read');

  await appendFile(join(sources.dsh, 'ws', 's1', 'session.v4.jsonl'), line({ type: 'user/message', time: Date.parse('2026-05-01T09:05:00.000Z'), data: { content: [{ type: 'text', text: 'second' }] } }) + '\n');
  await scanDshSession({ store, root: sources.dsh, id: 's1' });
  assert.equal(store.session('dsh:s1').promptCount, 2);
});

test('store.saveSoon coalesces many updates into one index write', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'trajecable-save-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = createStore({ dir: root });
  await store.load();
  for (let i = 0; i < 20; i++) {
    store.setSession({ key: `k${i}` });
    store.saveSoon(30);
  }
  await assert.rejects(readFile(join(root, 'index.json')), { code: 'ENOENT' }, 'nothing is written at once');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const saved = JSON.parse(await readFile(join(root, 'index.json'), 'utf8'));
  assert.equal(Object.keys(saved.sessions).length, 20, 'the one write holds every update');
});
