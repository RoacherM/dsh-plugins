import assert from 'node:assert/strict';
import test from 'node:test';
import { dirName, formatConsole, redact, renderReport, slugOf, stamp } from './report.js';

test('stamp is a sortable local folder prefix', () => {
  const at = new Date(2026, 2, 4, 5, 6, 7);
  assert.equal(stamp(at), '20260304-050607');
  assert.equal(dirName(at, 'Composer floats'), '20260304-050607-composer-floats');
});

test('slugOf keeps ascii words and falls back to issue', () => {
  assert.equal(slugOf('Composer  floats  mid---transcript!'), 'composer-floats-mid-transcript');
  assert.equal(slugOf('报告问题'), 'issue');
  assert.equal(slugOf(''), 'issue');
  assert.equal(slugOf('x'.repeat(80)).length <= 40, true);
});

test('redact removes tokens, bearer headers and keys', () => {
  assert.equal(redact('http://x.test/?a=1&token=abc123'), 'http://x.test/?a=1&token=<redacted>');
  assert.equal(redact('Authorization: Bearer abcdefghijklmnop'), 'Authorization: Bearer <redacted>');
  assert.equal(redact('key sk-abcdefghijklmnopqrstuvwx here'), 'key sk-<redacted> here');
  assert.equal(redact('{"token":"abc","keep":1}'), '{"token":"<redacted>","keep":1}');
  assert.equal(redact('plain text'), 'plain text');
});

test('formatConsole prints time, level and stack', () => {
  const line = formatConsole({ at: '2026-03-04T05:06:07.008Z', level: 'error', text: 'boom', stack: 'at x' });
  assert.equal(line, '05:06:07.008 ERROR boom\nat x');
  assert.equal(formatConsole({ level: 'log', text: 'quiet' }), 'LOG quiet');
});

test('renderReport names the facts a maintainer needs', () => {
  const text = renderReport({
    name: '20260304-050607-composer-floats',
    at: new Date(2026, 2, 4, 5, 6, 7),
    note: 'composer floats',
    client: {
      page: { url: 'http://127.0.0.1:1/?token=secret', title: 'DeepSeek Harness' },
      release: { version: '0.2.1-rc.2', commit: '332895e' },
      window: { innerWidth: 1240, innerHeight: 1000, dpr: 2, screenWidth: 1512, screenHeight: 982, screenX: 100, screenY: 40 },
      session: { id: 'session-1', title: 'hi hi hi', cwd: '/tmp/app', running: true },
      view: { tab: 'Chat', phase: 'active' },
      landmarks: [{ name: 'composer-seat', rect: { width: 800, height: 128, left: 200, top: 872 }, styles: { position: 'sticky', overflowY: 'visible', zIndex: '7' } }],
      transcript: [{ kind: 'user', text: 'hello' }],
      console: [{ at: '2026-03-04T05:06:07.008Z', level: 'error', text: 'boom' }],
    },
    host: { platform: 'darwin', release: '25.0.0', arch: 'arm64', node: '22.19.0', profile: '/p/desktop', plugins: ['dsh-issue'], git: { branch: 'main', head: '1a2b3c4', changed: 2 }, screenshot: { file: '/tmp/screenshot.png', bytes: 2048 } },
    files: [{ name: 'report.md', bytes: 1200, about: 'this summary' }],
    warnings: ['screen capture failed: no permission'],
  });

  assert.match(text, /^# Issue 20260304-050607-composer-floats$/m);
  assert.match(text, /\*\*Page\*\*: DSH 0\.2\.1-rc\.2 \(332895e\) · Chat tab · phase active/);
  assert.match(text, /\*\*URL\*\*: http:\/\/127\.0\.0\.1:1\/\?token=<redacted>/);
  assert.match(text, /\*\*Window\*\*: 1240×1000 css, dpr 2/);
  assert.match(text, /\*\*Session\*\*: hi hi hi `session-1` · running · cwd `\/tmp\/app`/);
  assert.match(text, /\*\*Repo\*\*: `main` @ 1a2b3c4 · 2 changed file\(s\)/);
  assert.match(text, /\| `report\.md` \| 1 KiB \| this summary \|/);
  assert.match(text, /\| `composer-seat` \| 800×128 at 200,872 \| sticky \| visible \| 7 \|/);
  assert.match(text, /- \*\*user\*\* · hello/);
  assert.match(text, /05:06:07\.008 ERROR boom/);
  assert.match(text, /- screen capture failed: no permission/);
});

test('renderReport survives a minimal payload', () => {
  const text = renderReport({ name: 'x', at: new Date(0), client: {}, host: {}, files: [], warnings: [] });
  assert.match(text, /# Issue x/);
  assert.match(text, /_No console entries were captured\._/);
});
