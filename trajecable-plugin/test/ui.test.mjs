import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const START = Date.parse('2026-05-01T10:00:00.000Z');
const END = START + 30 * 60_000;

const AI = {
  version: 2,
  tz: 'Asia/Shanghai',
  key: 'test',
  summary: '修好了解析器，并补了主路径测试。',
  score: 82,
  grade: 'A-',
  base: 84,
  dimensions: { decision: 82, execution: 76, risk: 71, verification: 88, focus: 64 },
  days: [{ date: '2026-05-01', score: 76, weight: 1, scores: { decision: 82, execution: 76, risk: 71, verification: 88, focus: 64 } }],
  problems: [
    { title: '修复 parser 主路径', status: 'solved', evidence: '测试通过' },
    { title: '补边界输入测试', status: 'partial', evidence: '还差一条' },
  ],
  decisions: [
    { type: 'tech', by: 'agent', title: '复用现有 parser', reason: '不新增依赖' },
    { type: 'scope', by: 'user', title: '先修主路径', reason: '边界测试后补' },
  ],
  completion: { total: 2, solved: 1, partial: 1, open: 0, abandoned: 0, rate: 50 },
  comment: { tone: 'watch', verdict: '方向对', judgement: '解析器修复完成，但测试还没补齐。', advice: '补一条边界输入测试。', risk: '空输入仍然会抛错。' },
  state: 'ongoing',
  scoreNote: '未收口 −8 · 封顶 84',
};

const TIMELINE = {
  tz: 'Asia/Shanghai',
  from: START - 86_400_000,
  to: END + 86_400_000,
  totals: { sessions: 3, projects: 1, days: 1, prompts: 2, files: 2, tests: 1, testFails: 0, commits: 1, errors: 0, delegates: 0 },
  agents: { dsh: 1, claude: 1, antigravity: 1 },
  days: [{
    date: '2026-05-01',
    first: START - 120_000,
    last: END,
    sessions: 3,
    agents: { dsh: 1, claude: 1, antigravity: 1 },
    facts: { prompts: 2, files: 2, tests: 1, testFails: 0, commits: 1, errors: 0, delegates: 0 },
    projects: [{
      name: 'demo',
      cwd: '/work/demo',
      last: END,
      facts: { prompts: 2, files: 2, tests: 1, testFails: 0, commits: 1, errors: 0, delegates: 0 },
      sessions: [
        {
          key: 'dsh:a', agent: 'dsh', id: 'a', title: 'Fix parser', project: 'demo', cwd: '/work/demo',
          branch: 'main', model: 'deepseek-chat', origin: 'user', start: START, end: END,
          promptCount: 1, fileCount: 2, toolCount: 4, tests: 1, commits: 1, errors: 0, delegates: 0,
          firstPrompt: 'Fix the parser, then run the tests',
        },
        {
          key: 'claude:b', agent: 'claude', id: 'b', title: 'Draft notes', project: 'demo', cwd: '/work/demo',
          branch: 'main', model: 'claude-sonnet-4-6', origin: 'user', start: START - 60_000, end: START - 30_000,
          promptCount: 0, fileCount: 0, toolCount: 0, tests: 0, commits: 0, errors: 0, delegates: 0,
          firstPrompt: 'Draft release notes',
        },
        {
          key: 'antigravity:c', agent: 'antigravity', id: 'c', title: 'Workspace sync', project: 'demo', cwd: '/work/demo',
          branch: '', model: '', origin: 'user', start: START - 120_000, end: START - 90_000,
          promptCount: 1, fileCount: 0, toolCount: 0, tests: 0, commits: 0, errors: 0, delegates: 0,
          firstPrompt: '',
        },
      ],
    }],
  }],
  projects: [{ name: 'demo', count: 3, last: END, agents: ['dsh', 'claude', 'antigravity'] }],
  indexed: { sessions: 1, files: 1 },
  scan: { scanning: false, startedAt: START, endedAt: END, error: null, progress: { done: 1, total: 1 }, lastScanAt: END },
};

let buttonRect = { left: 1100, top: 10, right: 1128, bottom: 38 };
// The session header: title row and tabs, from the sidebar edge to the window edge.
let headerRect = { left: 300, top: 0, right: 1200, bottom: 80 };
const observers = new Set();
class FakeResizeObserver {
  constructor(callback) { this.callback = callback; this.targets = new Set(); }
  observe(el) { this.targets.add(el); observers.add(this); }
  disconnect() { this.targets.clear(); observers.delete(this); }
}
const fireResize = () => { for (const o of observers) o.callback([]); };

async function loadClient(fetchImpl) {
  buttonRect = { left: 1100, top: 10, right: 1128, bottom: 38 };
  headerRect = { left: 300, top: 0, right: 1200, bottom: 80 };
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:19387/', pretendToBeVisual: true });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (fn) => dom.window.requestAnimationFrame(fn),
    cancelAnimationFrame: (id) => dom.window.cancelAnimationFrame(id),
    ResizeObserver: FakeResizeObserver,
  });
  // jsdom has no layout: the HUD button sits at the header's right edge unless a test moves it.
  dom.window.HTMLElement.prototype.getBoundingClientRect = function rect() {
    const r = this.classList.contains('tj-chat-hud-btn') ? buttonRect : this.id === 'root' ? headerRect : { left: 0, top: 0, right: 0, bottom: 0 };
    return { ...r, width: r.right - r.left, height: r.bottom - r.top };
  };
  Object.defineProperty(dom.window.document.documentElement, 'clientWidth', { configurable: true, get: () => 1200 });
  globalThis.fetch = fetchImpl;
  window.fetch = fetchImpl;

  let loaded;
  window.__ModuleLoader__ = { load: ({ factory }) => { loaded = factory((name) => require(name)); } };
  new Function(await readFile(new URL('../client.js', import.meta.url), 'utf8'))();

  const registrations = [];
  const calls = [];
  const listeners = new Set();
  let snapshot = { active: 'zh-CN' };
  const locale = {
    register: () => () => {},
    bind: () => (key) => ({ panel: 'Formula' })[key] ?? key,
    getSnapshot: () => snapshot,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    set(active) { snapshot = { active }; for (const fn of listeners) fn(); },
  };
  const ctx = {
    effect: (fn) => { fn(); },
    get: (name) => ({
      layout: { selectPanel: (id) => calls.push(['selectPanel', id]) },
      uiWorkspace: { openSession: (id) => calls.push(['openSession', id]) },
    })[name],
    locale,
    slots: {
      inject: (name, cb) => cb(),
      register: (meta, Component) => { registrations.push({ meta, Component }); return () => {}; },
    },
  };
  loaded.apply(ctx);
  return { dom, registrations, calls, locale, inject: loaded.inject };
}

const settle = async (act) => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 8)); }); };

const DETAIL = {
  key: 'dsh:a', agent: 'dsh', id: 'a', title: 'Fix parser', model: 'deepseek-chat', start: START, end: END,
  prompts: [
    { t: START, text: 'Fix the parser, then run the tests' },
    { t: START + 20 * 60_000, text: '先修主路径' },
  ],
};

const LIVE_DETAIL = {
  ...DETAIL,
  ai: AI, // present in the index, but the HUD must not use it
  llmCount: 27,
  tokens: 2_340_000,
  turns: [
    { n: 1, t: START, llm: 6, tools: 5, errors: 0, tokens: 400_000 },
    { n: 2, t: START + 10 * 60_000, llm: 9, tools: 8, errors: 0, tokens: 800_000 },
    { n: 3, t: Date.now() - 60_000, llm: 12, tools: 9, errors: 1, tokens: 1_140_000 },
  ],
  // Two replies in the last 30 s: 180k tokens / 30 s = 6k tok/s.
  recent: [
    { t: Date.now() - 50_000, tokens: 999_000 },
    { t: Date.now() - 20_000, tokens: 90_000 },
    { t: Date.now() - 5_000, tokens: 90_000 },
  ],
};

test('Race Log renders season, rows, full circuit rail, filters and summary', async (t) => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    requests.push([init.method ?? 'GET', target.pathname, Object.fromEntries(target.searchParams), init.body ? JSON.parse(init.body) : null]);
    const ok = (value) => new Response(JSON.stringify(value), { status: 200 });
    if (target.pathname.endsWith('/timeline')) return ok(TIMELINE);
    if (target.pathname.endsWith('/status')) return ok({ scan: TIMELINE.scan, indexed: TIMELINE.indexed });
    if (target.pathname.endsWith('/summary')) {
      // Only dsh:a has a transcript the summarizer can read; claude:b stays unscored.
      const { key } = JSON.parse(init.body);
      if (key !== 'dsh:a') return new Response(JSON.stringify({ error: 'no transcript' }), { status: 500 });
      return ok({ key, ai: AI, cached: false });
    }
    if (target.pathname.endsWith('/scan')) return ok({ started: true, scan: { ...TIMELINE.scan, scanning: true } });
    if (target.pathname.endsWith('/session') && target.searchParams.get('key') === 'dsh:a') return ok(DETAIL);
    if (target.pathname.endsWith('/session')) return ok({ prompts: [] });
    return new Response('{}', { status: 404 });
  };

  const { registrations, calls, locale, inject, dom } = await loadClient(fetchImpl);
  t.after(() => { dom.window.close(); });
  assert.deepEqual(inject, ['slots', 'locale']);

  const panel = registrations.find((entry) => entry.meta.name === 'sidebar.panellist');
  assert.equal(panel.meta.id, 'local-trajecable');
  assert.equal(panel.meta.label(), 'Formula');
  const page = registrations.find((entry) => entry.meta.name === 'main');
  assert.equal(page.meta.key, 'local-trajecable');
  // The page shows the full circuit; the small Sector Cam goes into the chat session header.
  assert.deepEqual(registrations.map((entry) => entry.meta.name).sort(), ['conversation.session.header.utilities', 'main', 'sidebar.panellist']);

  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(page.Component)));
  await settle(act);

  const text = () => document.body.textContent;
  const timelineRequest = requests.find((request) => request[1].endsWith('/timeline'));
  assert.equal(timelineRequest[2].range, '7d');
  assert.ok(timelineRequest[2].tz, 'the browser time zone is sent');
  assert.ok(Number(timelineRequest[2].to) > 0);

  // The unscored session is summarized automatically; the structured ai fills the row and right rail.
  const summaryRequest = requests.find((request) => request[0] === 'POST' && request[1].endsWith('/summary'));
  assert.ok(summaryRequest, 'a summary request was posted');
  assert.equal(summaryRequest[3].key, 'dsh:a');
  assert.ok(summaryRequest[3].tz, 'the summary request carries the time zone');
  for (const expected of [
    '赛控台', 'Formula', '赛季', '赛道全图', 'Fix parser', 'demo', '82',
    '1/2 收口', '方向对', '解析器修复完成，但测试还没补齐。', '补一条边界输入测试。',
    '空输入仍然会抛错。',
  ]) {
    assert.ok(text().includes(expected), `page shows ${expected}`);
  }

  // Layout and full circuit checks: closed loop, driven part solid, rest dashed, prompts as stops.
  assert.ok(document.querySelector('.tj-season'), 'season bar renders');
  assert.equal(document.querySelectorAll('.tj-day-group').length, 1);
  assert.equal(document.querySelectorAll('.tj-row').length, 3);
  assert.equal(document.querySelector('.tj-hud'), null, 'the page has no Sector Cam');
  const circuit = () => document.querySelector('.tj-circuit');
  assert.ok(circuit().querySelector('.tj-c-road').getAttribute('d').length > 100, 'full loop is drawn');
  assert.ok(circuit().querySelector('.tj-c-driven'), 'scored session has a driven part');
  assert.ok(circuit().querySelector('.tj-c-todo'), 'unfinished session has a dashed part');
  assert.equal(circuit().querySelectorAll('.tj-c-stop').length, 2, 'each prompt is a stop');
  assert.ok(circuit().textContent.includes('圈进度 50%'));
  assert.ok(text().includes('进站 · 你的提示') && text().includes('先修主路径'));
  assert.ok(text().includes('决策') && text().includes('复用现有 parser'));

  // Open session button triggers DSH session navigation for DSH sessions.
  const openButton = [...document.querySelectorAll('.tj-rail-actions button')].find((button) => button.textContent.startsWith('打开会话'));
  assert.ok(openButton && !openButton.disabled, 'openSession button enabled for DSH session');
  await act(async () => openButton.click());
  assert.deepEqual(calls.slice(-2), [['selectPanel', null], ['openSession', 'a']]);

  // An unscored session: whole loop dashed, no car, no driven part.
  const rows = [...document.querySelectorAll('.tj-row')];
  await act(async () => rows[1].click());
  await settle(act);
  assert.equal(circuit().querySelector('.tj-c-driven'), null, 'unscored session has no driven part');
  assert.ok(circuit().querySelector('.tj-c-todo'));
  assert.ok(circuit().textContent.includes('未评分'));

  // Antigravity has no geometry: no circuit, summarize disabled.
  await act(async () => rows[2].click());
  await settle(act);
  assert.equal(circuit(), null, 'antigravity session has no circuit');
  assert.ok(text().includes('Antigravity 仅记录会话元数据'));
  const sumButton = [...document.querySelectorAll('.tj-rail-actions button')].find((button) => button.textContent === '总结');
  assert.equal(sumButton.disabled, true, 'antigravity summarize button is disabled');

  // Switch back to scored row
  await act(async () => rows[0].click());
  await settle(act);

  // Range and agent filters re-query the server.
  const rangeButton = [...document.querySelectorAll('.tj-seg button')].find((button) => button.textContent === '30D');
  await act(async () => rangeButton.click());
  await settle(act);
  assert.equal(requests.filter((request) => request[1].endsWith('/timeline')).at(-1)[2].range, '30d');

  const agentSelect = document.querySelectorAll('.tj-select')[0];
  await act(async () => {
    agentSelect.value = 'claude';
    agentSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await settle(act);
  assert.equal(requests.filter((request) => request[1].endsWith('/timeline')).at(-1)[2].agent, 'claude');

  // Search is debounced.
  const input = document.querySelector('.tj-search');
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    setValue.call(input, 'parser');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
  await settle(act);
  assert.equal(requests.filter((request) => request[1].endsWith('/timeline')).at(-1)[2].q, 'parser');

  // The scan button posts, and the page follows DSH's language.
  const scanButton = [...document.querySelectorAll('.tj-btn')].find((button) => button.textContent.includes('扫描'));
  await act(async () => scanButton.click());
  await settle(act);
  assert.ok(requests.some((request) => request[0] === 'POST' && request[1].endsWith('/scan')));

  await act(async () => locale.set('en-US'));
  assert.ok(text().includes('RACE CONTROL'));
  assert.ok(text().includes('Formula'));
  assert.ok(text().includes('SEASON'));
  assert.ok(text().includes('CIRCUIT'));
  assert.ok(text().includes('1 session indexed'));
  assert.ok(!text().includes('1 sessions'));

  await act(async () => root.unmount());
});

test('Chat header shows a live Sector Cam for the open session', async (t) => {
  const requests = [];
  const fetchImpl = async (url) => {
    const target = new URL(url);
    requests.push(target.searchParams.get('key'));
    if (target.pathname.endsWith('/session')) return new Response(JSON.stringify(LIVE_DETAIL), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const { registrations, dom } = await loadClient(fetchImpl);
  t.after(() => { dom.window.close(); });
  const hud = registrations.find((entry) => entry.meta.name === 'conversation.session.header.utilities');
  assert.equal(hud.meta.id, 'trajecable-sector-cam');

  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  let status = new Map([['a', { running: true }]]);
  const listeners = new Set();
  const useSessionStatus = (select) => React.useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => select(status));
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(hud.Component, { sessionId: 'a', useSessionStatus })));
  await settle(act);

  // A running turn reads at once and shows counts only: no AI score, no waiting flag.
  assert.deepEqual(requests, ['dsh:a']);
  const cam = () => document.querySelector('.tj-chat-hud .tj-hud');
  assert.ok(cam(), 'Sector Cam floats under the header');
  assert.ok(cam().querySelector('#car-halo'), 'the car sits on the current turn');
  // Speed is tokens per second over the last 30 s; the badge shows the session total.
  assert.equal(cam().querySelector('.tj-hud-speed').textContent, '6ktok/s');
  assert.equal(cam().querySelector('.tj-hud-total').textContent, '共 2.3m tok');
  assert.match(cam().getAttribute('title'), /^deepseek-chat\n/, 'model in the hover text, no agent label');
  assert.match(cam().getAttribute('title'), /T3 · 12 步 · 9 工具/);
  assert.equal(cam().querySelector('.tj-hud-sector').textContent, 'T3 · 12 步');
  const condTitles = () => [...cam().querySelectorAll('.tj-hud-conds span')].map((e) => e.title);
  assert.deepEqual(condTitles(), ['失败 ×1']);
  assert.ok(cam().textContent.includes('T2') && cam().textContent.includes('T3'), 'corners are user turns');

  // The turn ends: read again, and the yellow flag says the agent waits for the user.
  await act(async () => { status = new Map([['a', { running: false }]]); for (const fn of listeners) fn(); });
  await settle(act);
  assert.deepEqual(requests, ['dsh:a', 'dsh:a']);
  assert.match(cam().textContent, /IDLE/);
  assert.deepEqual(condTitles(), ['失败 ×1', '等你输入']);
  assert.equal(cam().querySelector('.tj-hud-speed b').textContent, '0', 'an idle car stands still');

  // The toggle hides it and remembers the choice.
  await act(async () => document.querySelector('.tj-chat-hud-btn').click());
  assert.equal(cam(), null);
  assert.equal(localStorage.getItem('local-trajecable:chat-hud-open'), '0');

  await act(async () => root.unmount());
  assert.equal(document.querySelector('.tj-chat-hud'), null, 'unmount removes the floating HUD');
});

test('Chat HUD re-reads at once when the live chat gains a step or tool result', async (t) => {
  const requests = [];
  const fetchImpl = async (url) => {
    const target = new URL(url);
    requests.push(target.searchParams.get('key'));
    if (target.pathname.endsWith('/session')) return new Response(JSON.stringify(LIVE_DETAIL), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const { registrations, dom } = await loadClient(fetchImpl);
  t.after(() => { dom.window.close(); });
  const hud = registrations.find((entry) => entry.meta.name === 'conversation.session.header.utilities');

  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const useSessionStatus = (select) => select(new Map([['a', { running: true }]]));
  let chat = { nodes: new Map([['u1', { kind: 'user' }], ['s1', { kind: 'assistant-step', data: { turn: 1, step: 1 } }]]) };
  const listeners = new Set();
  const publish = (next) => { chat = next; for (const fn of listeners) fn(); };
  const useChat = (select) => React.useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => select(chat));
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(hud.Component, { sessionId: 'a', useSessionStatus, useChat })));
  await settle(act);
  assert.equal(requests.length, 1);

  // Streaming text replaces a node without adding one: no read.
  await act(async () => publish({ nodes: new Map([...chat.nodes, ['s1', { kind: 'assistant-step', data: { turn: 1, step: 1, blocks: ['more'] } }]]) }));
  await settle(act);
  assert.equal(requests.length, 1);

  // A tool call, then its result: one read each.
  await act(async () => publish({ nodes: new Map([...chat.nodes, ['c1', { kind: 'tool-call', data: { root: { phase: 'start' } } }]]) }));
  await settle(act);
  assert.equal(requests.length, 2);
  await act(async () => publish({ nodes: new Map([...chat.nodes, ['c1', { kind: 'tool-call', data: { root: { kind: 'tool-result', isError: false } } }]]) }));
  await settle(act);
  assert.equal(requests.length, 3);

  await act(async () => root.unmount());
});

test('Flat Sector Cam track runs from the bottom left to the top right', async () => {
  const { buildSectorGeometry } = await import('../src/client/sector-track.js');
  for (const key of ['dsh:a', 'dsh:b', 'dsh:c', 'dsh:d', 'dsh:e', 'dsh:f']) {
    const g = buildSectorGeometry({ key, turns: [{ n: 1, llm: 3, tools: 2, errors: 0 }] }, { running: true });
    const pts = g.topTodoPoints.split(' ').map((p) => p.split(',').map(Number));
    // The road ribbon is its left edge forward, then its right edge back: the middle is the far end.
    const end = pts[Math.floor(pts.length / 2) - 1];
    const start = pts[0];
    assert.ok(end[0] > start[0] && end[1] < start[1], `${key}: road heads up and right`);
    assert.ok(Number(g.car.bodyX) > 0 && Number(g.car.bodyX) < 248 && Number(g.car.bodyY) > 0 && Number(g.car.bodyY) < 178, `${key}: car is in view`);
    assert.equal(g.shadowPoints, undefined, 'flat: no shadow or walls');
  }
});

test('tokenSpeed counts the last 30 s of this turn and is 0 when idle', async () => {
  const mod = await import('../src/client/hud-speed.js');
  const now = 1_000_000;
  const detail = { turns: [{ t: now - 120_000 }], recent: [{ t: now - 40_000, tokens: 1e6 }, { t: now - 10_000, tokens: 30_000 }, { t: now - 1_000, tokens: 30_000 }] };
  assert.equal(mod.tokenSpeed(detail, now, true), 2000);
  assert.equal(mod.tokenSpeed(detail, now, false), 0);
  // At the start of a turn the window is the turn so far, at least 5 s.
  assert.equal(mod.tokenSpeed({ turns: [{ t: now - 2_000 }], recent: [{ t: now - 1_000, tokens: 10_000 }] }, now, true), 2000);
  assert.equal(mod.compactTokens(6_240), '6.2k');
  assert.equal(mod.compactTokens(2_340_000), '2.3m');
});

test('Chat HUD sits in the chat top-left corner and follows the header without a window resize', async (t) => {
  const fetchImpl = async () => new Response(JSON.stringify(LIVE_DETAIL), { status: 200 });
  const { registrations, dom } = await loadClient(fetchImpl);
  t.after(() => { dom.window.close(); });
  const hud = registrations.find((entry) => entry.meta.name === 'conversation.session.header.utilities');
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(hud.Component, { sessionId: 'a' })));
  await settle(act);
  const panel = () => document.querySelector('.tj-chat-hud');
  // Under the header, at its left edge: the empty corner beside the message column.
  assert.equal(panel().style.top, '92px');
  assert.equal(panel().style.left, '312px');
  assert.ok(observers.size > 0, 'the button and its ancestors are observed');

  // The left sidebar collapses: the header starts further left. No window resize event.
  headerRect = { left: 60, top: 0, right: 1200, bottom: 80 };
  await act(async () => { fireResize(); });
  await settle(act);
  assert.equal(panel().style.left, '72px', 'the HUD moved with the header');

  // The header is hidden (another page): the HUD hides instead of jumping to the top left.
  buttonRect = { left: 0, top: 0, right: 0, bottom: 0 };
  await act(async () => { fireResize(); });
  await settle(act);
  assert.equal(panel(), null);

  await act(async () => root.unmount());
  assert.equal(observers.size, 0, 'observers are released on unmount');
});

test('anchorFor picks the chat column, not a zero-size wrapper at the window corner', async () => {
  const { anchorFor } = await import('../src/client/hud-anchor.js');
  const r = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
  const button = r(1170, 10, 1198, 38);
  const chain = [
    button,
    r(1100, 10, 1240, 38),   // utilities row
    r(236, 0, 1270, 64),     // session header: title row + tabs
    r(0, 0, 0, 0),           // display: contents / empty shell at the window corner (the bug)
    r(0, 0, 1270, 30),       // a short bar that does not reach the button
    r(236, 0, 1270, 780),    // the chat column
    r(0, 0, 1270, 780),      // the whole window
  ];
  assert.deepEqual(anchorFor(chain), { top: 76, left: 248 });
  // A full-width short bar that encloses the button: the column's left edge still wins.
  assert.deepEqual(anchorFor([button, r(0, 0, 1270, 64), r(236, 0, 1270, 780)]), { top: 76, left: 248 });
  assert.equal(anchorFor([r(0, 0, 0, 0)]), null, 'hidden button');
  assert.equal(anchorFor([button, r(0, 0, 0, 0)]), null, 'no header encloses the button');
});
