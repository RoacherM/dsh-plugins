import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { apply, inject, name } from '../dist/host.js';

const line = (value) => JSON.stringify(value);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('host bundle serves scan, timeline, detail and summary routes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'trajecable-host-'));
  const claudeRoot = join(root, '.claude', 'projects');
  const claudeDir = join(claudeRoot, '-work-demo');
  await mkdir(claudeDir, { recursive: true });
  await writeFile(join(claudeDir, 'c1.jsonl'), [
    line({ type: 'custom-title', customTitle: 'Host task' }),
    line({ type: 'user', timestamp: '2026-05-02T10:00:00.000Z', cwd: '/work/demo', message: { role: 'user', content: 'host prompt' } }),
  ].join('\n') + '\n');

  const routes = new Map();
  const cleanups = [];
  const llmCalls = [];
  const ctx = {
    connection: { fetch: { register(definition) { routes.set(definition.path, definition); return () => {}; } } },
    effect(fn) { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
    get(service) {
      if (service === 'llm') return {
        async prepareCall(config) {
          llmCalls.push(config);
          return {
            config,
            async *stream() {
              yield { type: 'text-delta', text: JSON.stringify({ summary: 'Finished the host task.', state: 'done', problems: [{ title: 'Host task', status: 'solved' }], days: [{ date: '2026-05-02', did: 'Host work', weight: 1, scores: { decision: 90, execution: 90, risk: 90, verification: 90, focus: 90 } }], comment: { tone: 'good', verdict: '稳', judgement: 'Done.', advice: '', risk: '' } }) };
              yield { type: 'finish', reason: { kind: 'stop' } };
            },
          };
        },
      };
      return undefined;
    },
    logger: { warn() {} },
  };

  assert.equal(name, 'dsh-trajecable');
  assert.deepEqual(inject, ['connection']);
  apply(ctx, {
    dataDir: join(root, 'index'),
    dshDir: join(root, 'dsh'),
    claudeDir: claudeRoot,
    codexDir: join(root, 'codex'),
    piDir: join(root, 'pi'),
    epiDir: join(root, 'epi'),
    grokDir: join(root, 'grok'),
    antigravityDirs: [],
  });
  t.after(async () => {
    for (const cleanup of cleanups.reverse()) cleanup();
    await sleep(100);
    await rm(root, { recursive: true, force: true });
  });

  const call = async (path, method = 'GET', body) => {
    const url = new URL(`http://local${path}`);
    const definition = routes.get(url.pathname);
    assert.ok(definition, `route ${url.pathname}`);
    const init = { method };
    if (body) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const response = await definition.fetch(new Request(url, init));
    return { status: response.status, body: await response.json() };
  };

  const deadline = Date.now() + 5000;
  let status;
  do {
    status = (await call('/api/trajecable/status')).body;
    if (!status.scan.scanning && status.scan.lastScanAt) break;
    await sleep(20);
  } while (Date.now() < deadline);
  assert.equal(status.indexed.sessions, 1);
  assert.equal(status.indexed.files, 1);

  const timeline = await call('/api/trajecable/timeline?range=all&tz=UTC');
  assert.equal(timeline.status, 200);
  assert.equal(timeline.body.totals.sessions, 1);
  assert.equal(timeline.body.days[0].projects[0].sessions[0].title, 'Host task');

  const detail = await call('/api/trajecable/session?key=claude:-work-demo/c1&tz=UTC');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.prompts[0].text, 'host prompt');
  assert.equal(detail.body.day, '2026-05-02');

  const missing = await call('/api/trajecable/session');
  assert.equal(missing.status, 400);
  const unknown = await call('/api/trajecable/session?key=nope');
  assert.equal(unknown.status, 404);

  const summary = await call('/api/trajecable/summary', 'POST', { key: 'claude:-work-demo/c1' });
  assert.equal(summary.status, 200);
  assert.equal(summary.body.ai.summary, 'Finished the host task.');
  assert.equal(summary.body.ai.score, 90);
  assert.equal(summary.body.ai.grade, 'A');
  assert.deepEqual(summary.body.ai.completion, { total: 1, solved: 1, partial: 0, open: 0, abandoned: 0, rate: 100 });
  assert.equal(summary.body.cached, false);
  assert.equal(llmCalls.length, 1);
  const cached = await call('/api/trajecable/summary', 'POST', { key: 'claude:-work-demo/c1' });
  assert.equal(cached.body.cached, true);
  assert.equal(llmCalls.length, 1);

  const scan = await call('/api/trajecable/scan', 'POST');
  assert.equal(scan.body.started, true);
});
