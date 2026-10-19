import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { apply } from './index.js';

/** Minimal Host context: `effect` runs now, `connection.fetch.register` records the route. */
const hostContext = () => {
  const state = { route: undefined, disposers: [] };
  const ctx = {
    effect(fn) {
      const dispose = fn();
      state.disposers.push(dispose);
      return dispose;
    },
    connection: {
      fetch: {
        register(route) {
          assert.equal(state.route, undefined, 'one route');
          state.route = route;
          return () => {};
        },
      },
    },
    logger: () => ({ info() {}, warn() {} }),
  };
  return { ctx, state };
};

const post = (route, payload) => route.fetch(new Request('http://local/api/issue/report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
}));

const payloadOf = (overrides = {}) => ({
  title: 'Composer floats',
  options: { screenshot: false, dom: true },
  console: [{ at: '2026-03-04T05:06:07.008Z', level: 'error', text: 'boom' }],
  dom: '<html><body>tokens token=secret</body></html>',
  page: { url: 'http://127.0.0.1:1/?x=1', title: 'DeepSeek Harness' },
  release: { version: '0.2.1-rc.2', commit: '332895e' },
  window: { innerWidth: 1240, innerHeight: 1000, dpr: 2 },
  session: { id: 'session-1', title: 'hi hi hi', running: false, cwd: '/tmp/nowhere-for-tests' },
  view: { tab: 'Chat', phase: 'active' },
  landmarks: [{ name: 'composer-seat', rect: { width: 800, height: 128, left: 200, top: 872 }, styles: { position: 'sticky' } }],
  transcript: [{ kind: 'user', text: 'hello' }],
  ...overrides,
});

test('the route writes one self-contained issue folder', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-issue-'));
  try {
    const { ctx, state } = hostContext();
    apply(ctx, { dir: root, sessionsDir: join(root, 'sessions') });
    assert.equal(state.route.path, '/api/issue/report');
    assert.deepEqual(state.route.methods, ['POST']);
    assert.equal(state.route.requestBody, 'buffered');

    const response = await post(state.route, payloadOf());
    assert.equal(response.status, 200);
    const result = await response.json();

    assert.match(result.name, /^\d{8}-\d{6}-composer-floats$/);
    assert.equal(result.dir, join(root, result.name));
    assert.deepEqual(result.files, ['report.md', 'report.json', 'console.txt', 'dom.html.gz']);
    assert.deepEqual(result.warnings, []);

    const files = await readdir(result.dir);
    assert.deepEqual(files.sort(), ['console.txt', 'dom.html.gz', 'report.json', 'report.md']);
    assert.equal(existsSync(join(result.dir, 'screenshot.png')), false);

    const report = await readFile(join(result.dir, 'report.md'), 'utf8');
    assert.match(report, /# Issue \d{8}-\d{6}-composer-floats/);
    assert.match(report, /\*\*Page\*\*: DSH 0\.2\.1-rc\.2 \(332895e\) · Chat tab · phase active/);
    assert.match(report, /ERROR boom/);
    assert.match(report, /composer-seat/);
    assert.match(report, /\*\*user\*\* · hello/);

    assert.match(report, /\| `report\.md` \| — \| this summary \|/);
    assert.match(report, /\| `report\.json` \| \d+ KiB \|/);
    assert.match(report, /\| `console\.txt` \| \d+ KiB \| browser console ring/);

    const consoleText = await readFile(join(result.dir, 'console.txt'), 'utf8');
    assert.equal(consoleText, '05:06:07.008 ERROR boom\n');

    const json = JSON.parse(await readFile(join(result.dir, 'report.json'), 'utf8'));
    assert.equal(json.host.platform, process.platform);
    assert.equal(json.host.node, process.versions.node);
    assert.equal(json.client.session.id, 'session-1');

    const index = await readFile(join(root, 'index.md'), 'utf8');
    assert.match(index, /^# Issues/);
    assert.match(index, /· Composer floats · `/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a second report in the same second gets its own folder', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-issue-'));
  try {
    const { ctx, state } = hostContext();
    apply(ctx, { dir: root, sessionsDir: join(root, 'sessions') });
    const first = await (await post(state.route, payloadOf())).json();
    const second = await (await post(state.route, payloadOf())).json();
    assert.notEqual(first.dir, second.dir);
    const index = await readFile(join(root, 'index.md'), 'utf8');
    assert.equal(index.match(/^# Issues/gm).length, 1);
    assert.equal(index.split('\n').filter((line) => line.startsWith('- ')).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('without a page snapshot the report still lands and says what is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-issue-'));
  try {
    const { ctx, state } = hostContext();
    apply(ctx, { dir: root, sessionsDir: join(root, 'sessions') });
    const result = await (await post(state.route, payloadOf({ dom: undefined, options: { screenshot: false, dom: false } }))).json();
    assert.deepEqual(result.warnings, ['page snapshot not included']);
    const files = await readdir(result.dir);
    assert.equal(files.includes('dom.html.gz'), false);
    const report = await readFile(join(result.dir, 'report.md'), 'utf8');
    assert.match(report, /- page snapshot not included/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a broken body answers 500 with the reason', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-issue-'));
  try {
    const { ctx, state } = hostContext();
    apply(ctx, { dir: root, sessionsDir: join(root, 'sessions') });
    const response = await state.route.fetch(new Request('http://local/api/issue/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    }));
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(typeof body.error, 'string');
    assert.equal(body.error.length > 0, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the session log is copied when it exists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-issue-'));
  try {
    const sessions = join(root, 'sessions');
    await mkdir(join(sessions, '--tmp-workspace--', 'session-1'), { recursive: true });
    await writeFile(join(sessions, '--tmp-workspace--', 'session-1', 'session.v4.jsonl.zstd'), 'not really zstd');

    const { ctx, state } = hostContext();
    apply(ctx, { dir: join(root, 'issues'), sessionsDir: sessions });
    const result = await (await post(state.route, payloadOf())).json();

    assert.equal(result.files.includes('session-log.jsonl.zstd'), true);
    const copied = await readFile(join(result.dir, 'session-log.jsonl.zstd'), 'utf8');
    assert.equal(copied, 'not really zstd');
    const report = await readFile(join(result.dir, 'report.md'), 'utf8');
    assert.match(report, /The session log is the raw event stream/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
