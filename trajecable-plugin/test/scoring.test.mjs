import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAi, gradeFor, parseEvaluation } from '../src/host/scoring.js';

const session = { start: Date.parse('2026-10-17T09:00:00Z'), end: Date.parse('2026-10-19T18:00:00Z') };

function evaluation(overrides = {}) {
  return {
    summary: 'Built the parser and closed the main bug.',
    state: 'done',
    problems: [
      { title: 'Parser loop', status: 'solved', evidence: 'Tests pass' },
      { title: 'History backfill', status: 'open', evidence: 'Not started' },
    ],
    decisions: [{ type: 'tech', by: 'agent', title: 'Reuse the model', reason: 'No new key' }],
    days: [
      { date: '2026-10-17', did: 'Parser', closed: ['Parser loop'], weight: 2, scores: { decision: 80, execution: 70, risk: 60, verification: 80, focus: 70 } },
      { date: '2026-10-18', did: 'Tests', closed: [], weight: 3, scores: { decision: 90, execution: 80, risk: 70, verification: 90, focus: 80 } },
    ],
    comment: { tone: 'watch', verdict: '方向对', judgement: 'Worth keeping.', advice: 'Finish the backfill.', risk: 'Cost' },
    ...overrides,
  };
}

test('buildAi merges day scores, applies the completion gate and keeps the dimensions', () => {
  const ai = buildAi(evaluation(), session, 'UTC');
  assert.equal(ai.days[0].score, 73);
  assert.equal(ai.days[1].score, 83);
  assert.equal(ai.base, 79);
  assert.equal(ai.score, 71);
  assert.equal(ai.grade, 'B');
  assert.deepEqual(ai.dimensions, { decision: 86, execution: 76, risk: 66, verification: 86, focus: 76 });
  assert.deepEqual(ai.completion, { total: 2, solved: 1, partial: 0, open: 1, abandoned: 0, rate: 50 });
  assert.match(ai.scoreNote, /未收口 −8/);
});

test('a model-declared done state is downgraded while problems remain open', () => {
  const ai = buildAi({
    summary: 'partial',
    state: 'done',
    problems: [{ title: 'a', status: 'solved', evidence: '' }, { title: 'b', status: 'open', evidence: '' }],
    decisions: [],
    days: [{ date: '2026-05-02', scores: { decision: 80, execution: 80, risk: 80, verification: 80, focus: 80 }, weight: 1 }],
    comment: {},
  }, { end: Date.parse('2026-05-02T10:00:00Z') }, 'UTC')
  assert.equal(ai.state, 'ongoing')
  assert.equal(ai.completion.rate, 50)
})

test('all problems solved earns the multi-problem bonus; a zero-closure session is capped at 60', () => {
  const done = buildAi(evaluation({
    problems: [
      { title: 'A', status: 'solved' },
      { title: 'B', status: 'solved' },
    ],
    days: [{ date: '2026-10-19', weight: 1, scores: { decision: 90, execution: 90, risk: 90, verification: 90, focus: 90 } }],
  }), session, 'UTC');
  assert.equal(done.base, 90);
  assert.equal(done.score, 92);
  assert.match(done.scoreNote, /多问题收口 \+2/);

  const zero = buildAi(evaluation({
    problems: [{ title: 'A', status: 'open' }],
    days: [{ date: '2026-10-19', weight: 1, scores: { decision: 90, execution: 90, risk: 90, verification: 90, focus: 90 } }],
  }), session, 'UTC');
  assert.equal(zero.score, 60);
  assert.equal(zero.grade, 'C');
});

test('parseEvaluation accepts nested JSON and repairs a truncated tail', () => {
  const raw = '```json\n' + JSON.stringify(evaluation()) + '\n```';
  const parsed = parseEvaluation(raw);
  assert.equal(parsed.summary, 'Built the parser and closed the main bug.');
  assert.equal(parsed.problems.length, 2);

  const cut = JSON.stringify(evaluation()).slice(0, -12);
  const repaired = parseEvaluation(cut + '');
  assert.ok(repaired);
  assert.equal(repaired.problems.length, 2);
});

test('grade bands follow the Stage Log scale', () => {
  assert.equal(gradeFor(90), 'A');
  assert.equal(gradeFor(85), 'A-');
  assert.equal(gradeFor(78), 'B+');
  assert.equal(gradeFor(74), 'B');
  assert.equal(gradeFor(60), 'C');
  assert.equal(gradeFor(59), 'D');
});
