import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSessionDetail, buildTimeline, isMeaningful } from '../src/host/timeline.js';
import { newSession, summaryCacheKey } from '../src/host/util.js';

const at = (iso) => Date.parse(iso);

function session(agent, key, { project, start, end, prompt, files = 1, tests = 0, testFails = 0, commits = 0, errors = 0, delegates = 0 }) {
  const value = newSession(agent, key, key);
  value.title = prompt;
  value.project = project;
  value.cwd = `/work/${project}`;
  value.start = start;
  value.end = end ?? start + 60_000;
  value.promptCount = 1;
  value.prompts = [{ t: start, text: prompt }];
  value.toolCount = 2;
  value.fileCount = files;
  value.testRuns = tests;
  value.testFails = testFails;
  value.commits = commits;
  value.errors = errors;
  value.delegates = delegates;
  value.commands = files ? [{ t: start, tool: 'bash', text: 'npm test' }] : [];
  return value;
}

test('buildTimeline groups local days and projects, drops empty shells, and filters', () => {
  const s1 = session('dsh', 'dsh:a', { project: 'alpha', start: at('2026-05-01T10:00:00Z'), prompt: 'alpha prompt', tests: 1, commits: 2 });
  const s2 = session('claude', 'claude:b', { project: 'beta', start: at('2026-05-02T01:00:00Z'), prompt: 'beta prompt', errors: 1 });
  const s3 = session('codex', 'codex:c', { project: 'alpha', start: at('2026-05-02T12:00:00Z'), prompt: 'codex prompt', delegates: 1 });
  const empty = newSession('dsh', 'dsh:empty', 'empty');
  empty.project = 'alpha';
  empty.start = at('2026-05-01T11:00:00Z');
  empty.end = empty.start;
  assert.equal(isMeaningful(empty), false);

  const args = {
    sessions: [s1, s2, s3, empty],
    from: at('2026-05-01T00:00:00Z'),
    to: at('2026-05-03T00:00:00Z'),
    tz: 'Asia/Shanghai',
    indexed: { sessions: 4, files: 3 },
    scan: { scanning: false, endedAt: 1 },
  };
  const timeline = buildTimeline(args);

  assert.equal(timeline.tz, 'Asia/Shanghai');
  assert.deepEqual(timeline.totals, {
    sessions: 3, projects: 2, days: 2,
    prompts: 3, files: 3, tests: 1, testFails: 0, commits: 2, errors: 1, delegates: 1,
  });
  assert.deepEqual(timeline.agents, { dsh: 1, claude: 1, codex: 1 });
  assert.deepEqual(timeline.days.map((day) => day.date), ['2026-05-02', '2026-05-01']);
  assert.equal(timeline.days[0].sessions, 2);
  assert.deepEqual(timeline.days[0].projects.map((group) => group.name), ['alpha', 'beta']);
  assert.equal(timeline.days[0].projects[0].sessions[0].key, 'codex:c');
  assert.equal(timeline.projects.find((project) => project.name === 'alpha').count, 2);

  assert.equal(buildTimeline({ ...args, agent: 'dsh' }).totals.sessions, 1);
  assert.equal(buildTimeline({ ...args, project: 'alpha' }).totals.sessions, 2);
  assert.equal(buildTimeline({ ...args, q: 'beta' }).days[0].projects[0].sessions[0].key, 'claude:b');
  assert.equal(buildTimeline({ ...args, from: at('2026-05-02T00:00:00Z') }).totals.sessions, 2);
  assert.equal(buildTimeline({ ...args, to: at('2026-05-01T23:59:59Z') }).totals.sessions, 1);

  s1.ai = { version: 2, key: summaryCacheKey(s1, 'UTC'), tz: 'UTC', summary: 'Implemented alpha end to end.', score: 88, grade: 'A-' };
  const fresh = buildTimeline(args);
  assert.equal(fresh.days[1].projects[0].sessions[0].ai.summary, 'Implemented alpha end to end.');

  s1.ai = { version: 2, key: 'stale', tz: 'UTC', summary: '{"summary":"stale JSON"}', score: 1 };
  const stale = buildTimeline(args);
  assert.equal(stale.days[1].projects[0].sessions[0].ai, undefined);
});

test('buildSessionDetail adds the local day', () => {
  const value = session('dsh', 'dsh:a', { project: 'alpha', start: at('2026-05-01T18:30:00Z'), prompt: 'late' });
  const detail = buildSessionDetail(value, 'Asia/Shanghai');
  assert.equal(detail.day, '2026-05-02');
  assert.equal(buildSessionDetail(undefined, 'Asia/Shanghai'), undefined);
});
