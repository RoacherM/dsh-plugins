import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createStore } from '../src/host/store.js';
import { readSession } from '../src/host/adapters/pi.js';
import { buildSummaryInput, createSummarizer } from '../src/host/summarize.js';
import { parseEvaluation } from '../src/host/scoring.js';

const line = (value) => JSON.stringify(value);

const reply = JSON.stringify({
  summary: '实现了 src/parser.js 的解析器。',
  state: 'ongoing',
  problems: [
    { title: '解析器死循环', status: 'solved', evidence: '测试通过' },
    { title: '错误处理', status: 'open', evidence: '还没写' },
  ],
  decisions: [{ type: 'tech', by: 'agent', title: '复用现有扫描器', reason: '避免重复代码' }],
  days: [{ date: '2026-05-02', did: '写了解析器和测试', closed: ['解析器死循环'], weight: 2, scores: { decision: 82, execution: 76, risk: 70, verification: 88, focus: 64 } }],
  comment: { tone: 'watch', verdict: '方向对', judgement: '先修主循环是对的。', advice: '补错误处理。', risk: '错误输入会崩。' },
});

function fakeContext(replyText) {
  let calls = 0;
  const ctx = {
    get(name) {
      if (name !== 'llm') return undefined;
      return {
        async prepareCall(config, signal) {
          calls++;
          assert.equal(config.provider, 'deepseek-official');
          assert.equal(config.model, 'deepseek-flash');
          assert.equal(config.maxTokens, 2000);
          assert.ok(signal);
          return {
            config,
            async *stream(options) {
              assert.ok(options.messages[0].content[0].text.includes('Build a parser'));
              assert.ok(options.system.includes('JSON'));
              yield { type: 'text-delta', index: 0, text: replyText };
              yield { type: 'finish', reason: { kind: 'stop' } };
            },
          };
        },
      };
    },
    calls: () => calls,
  };
  return ctx;
}

test('parseEvaluation returns problems, days and the comment', () => {
  const parsed = parseEvaluation(reply);
  assert.equal(parsed.summary, '实现了 src/parser.js 的解析器。');
  assert.equal(parsed.problems[0].status, 'solved');
  assert.equal(parsed.days[0].date, '2026-05-02');
  assert.equal(parsed.comment.verdict, '方向对');
  assert.equal(parseEvaluation('plain result'), undefined);
});

test('summarizer reads a Pi transcript, caches by session activity and reuses the cache', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'trajecable-summary-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'session.jsonl');
  await writeFile(file, [
    line({ type: 'session', version: 3, id: 's1', timestamp: '2026-05-02T10:00:00.000Z', cwd: '/work/demo' }),
    line({ type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'Build a parser' }], timestamp: '2026-05-02T10:01:00.000Z' } }),
    line({ type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'I added src/parser.js' }], timestamp: '2026-05-02T10:02:00.000Z' } }),
    line({ type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'Run the tests' }], timestamp: '2026-05-02T10:03:00.000Z' } }),
  ].join('\n') + '\n');

  const session = await readSession(file);
  const store = createStore({ dir: join(root, 'index') });
  await store.load();
  store.setSession(session);
  store.setFile(file, { agent: 'pi', key: session.key, size: 1, mtimeMs: 1, cursor: 1 });
  await store.save();

  const ctx = fakeContext(reply);
  const summarizer = createSummarizer({ ctx, store });
  const input = await buildSummaryInput(session, file, 'Asia/Shanghai');
  assert.ok(input.includes('Build a parser'));
  assert.ok(input.includes('I added src/parser.js'));
  assert.ok(input.includes('[05-02 18:01] USER'), 'the digest carries local timestamps');

  const first = await summarizer.run(session, { tz: 'Asia/Shanghai' });
  assert.equal(first.cached, false);
  assert.equal(first.ai.summary, '实现了 src/parser.js 的解析器。');
  assert.equal(first.ai.score, 69);
  assert.deepEqual(first.ai.completion, { total: 2, solved: 1, partial: 0, open: 1, abandoned: 0, rate: 50 });
  assert.equal(ctx.calls(), 1);
  assert.ok(session.ai.key.includes('Asia/Shanghai'));

  const second = await summarizer.run(session, { tz: 'Asia/Shanghai' });
  assert.equal(second.cached, true);
  assert.equal(ctx.calls(), 1);

  const forced = await summarizer.run(session, { force: true, tz: 'Asia/Shanghai' });
  assert.equal(forced.cached, false);
  assert.equal(ctx.calls(), 2);
});
