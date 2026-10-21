import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const require = createRequire(import.meta.url);
const React = require('react');
const ReactDOM = require('react-dom');
const { renderToStaticMarkup } = require('react-dom/server');
const h = React.createElement;

/**
 * Plugin code runs inside a vm context, so objects it builds have the vm's
 * prototypes. Compare their data, not their realm.
 */
const plain = (value) => JSON.parse(JSON.stringify(value));

const stubIcon = (name) => function StubIcon() { return h('i', { 'data-icon': name }); };

/** Load client.js the way the page's module loader does, against a fake window and document. */
function load() {
  let plugin;
  const head = [];
  const document = {
    head: { appendChild: (tag) => head.push(tag) },
    createElement: () => {
      const tag = { dataset: {}, textContent: '', remove: () => head.splice(head.indexOf(tag), 1) };
      return tag;
    },
    body: {},
  };
  const primitives = {
    Tooltip: ({ children }) => children,
    IconBranchOutlineRegular: stubIcon('branch'),
    IconCheckOutlineRegular: stubIcon('check'),
    IconCopyOutlineRegular: stubIcon('copy'),
    IconEditOutlineRegular: stubIcon('edit'),
    IconRefreshOutlineRegular: stubIcon('refresh'),
    IconClockOutlineRegular: stubIcon('clock'),
    writeClipboard: async () => true,
  };
  const window = {
    __ModuleLoader__: {
      load: (entry) => {
        assert.equal(entry.id, '@local/dsh-rewind');
        plugin = entry.factory((id) => ({
          react: React,
          'react-dom': ReactDOM,
          '@deepseek-ai/dsh-client-ui-primitives': primitives,
        })[id]);
      },
    },
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(readFileSync(new URL('./client.js', import.meta.url), 'utf8'), { window, document, setTimeout, clearTimeout });
  return { plugin, head, document };
}

/** Apply the plugin against the parts of the Client context it uses. */
function mount() {
  const disposers = [];
  const dictionaries = new Map();
  const state = { registration: undefined, turnTail: undefined, stepsAction: undefined };
  const ctx = {
    sessions: {},
    uiWorkspace: {},
    effect: (fn) => { disposers.push(fn()); },
    locale: {
      register: (ns, dicts) => { dictionaries.set(ns, dicts); return () => dictionaries.delete(ns); },
      bind: (ns) => (key, params) => {
        const text = dictionaries.get(ns)?.zh[key] ?? key;
        return params === undefined ? text : text.replace(/\{(\w+)\}/g, (whole, name) => String(params[name] ?? whole));
      },
    },
    slots: {
      inject: (name, register) => {
        if (name === 'conversation.chat.node') {
          state.registration = register();
          return () => { state.registration = undefined; };
        }
        if (name === 'conversation.chat.assistant-actions') {
          state.stepsAction = register();
          return () => { state.stepsAction = undefined; };
        }
        assert.equal(name, 'conversation.chat.turnTail');
        state.turnTail = register();
        return () => { state.turnTail = undefined; };
      },
      register: (options, view) => ({ options, view }),
    },
  };
  const loaded = load();
  loaded.plugin.apply(ctx);
  return { ...loaded, disposers, dictionaries, state };
}

const translate = (m) => (key, params) => {
  const text = m.dictionaries.get('rewind')?.zh[key] ?? key;
  return params === undefined ? text : text.replace(/\{(\w+)\}/g, (whole, name) => String(params[name] ?? whole));
};

function renderUserMessage(m, { seq = 42, content = [{ type: 'text', text: 'hello' }], time = Date.now(), labels, skills, turnStatus } = {}) {
  const calls = [];
  const data = {
    kind: 'user',
    seq,
    time,
    content,
    ...(labels === undefined ? {} : { referenceLabels: labels }),
    ...(skills === undefined ? {} : { skillNames: skills }),
  };
  const location = turnStatus === undefined ? undefined : { kind: 'turn', turn: { turn: 1, status: turnStatus } };
  const node = { anchorSeq: seq, data, ...(location === undefined ? {} : { location }) };
  const markup = renderToStaticMarkup(h(m.state.registration.view, {
    node,
    renderFactorySlot: (name, props) => { calls.push({ name, props }); return h('div', { className: 'stub-content' }, props.content.text); },
    loadImage: () => null,
    sessionId: 's1',
    t: translate(m),
  }));
  return { markup, calls: plain(calls) };
}

/** All session/workspace calls one operation makes, in order. */
function fakeContext({ forkError, promptResult = { ok: true } } = {}) {
  const calls = [];
  return {
    calls,
    sessions: {
      fork: async (options) => {
        calls.push(['fork', options]);
        if (forkError !== undefined) throw forkError;
        return 'child-1';
      },
      using: async (sessionId, options, operation) => {
        calls.push(['using', sessionId, options]);
        // Same shape as the session controller's binding: the scope ctx is built
        // from the root context and carries no `conversation` service.
        return operation({
          binding: {
            sessionId,
            ctx: {},
            session: {
              prompt: async (content, mode) => {
                calls.push(['prompt', content, mode]);
                return promptResult;
              },
            },
          },
        });
      },
    },
    uiWorkspace: { openSession: (sessionId) => { calls.push(['openSession', sessionId]); } },
  };
}

test('registers one keyed user-message renderer that shadows the shipped one', () => {
  const m = mount();
  assert.equal(m.state.registration.options.name, 'conversation.chat.node');
  assert.equal(m.state.registration.options.key, 'user');
  assert.equal(m.state.registration.options.priority, -10);
  assert.equal(m.state.registration.options.locale, 'rewind');
  assert.equal(typeof m.state.registration.view, 'function');
});

test('ships the same keys in both languages and removes its style tag', () => {
  const m = mount();
  const dicts = m.dictionaries.get('rewind');
  assert.deepEqual(Object.keys(dicts.zh).sort(), Object.keys(dicts.en).sort());
  assert.equal(m.head.length, 1);
  assert.equal(m.head[0].dataset.plugin, '@local/dsh-rewind');
  assert.match(m.head[0].textContent, /\[data-conversation-scroll\]:has\(\[data-conversation-composer-overlay\]\):has\(\[data-chat-flow-kind\]\)>\[data-composer-seat\]\{position:sticky!important/);
  m.disposers.forEach((dispose) => dispose());
  assert.equal(m.head.length, 0);
  assert.equal(m.dictionaries.size, 0);
  assert.equal(m.state.registration, undefined);
});

test('renders the shipped bubble body through the factory slot, plus copy/edit/branch', () => {
  const m = mount();
  const { markup, calls } = renderUserMessage(m, { content: [{ type: 'text', text: 'fix the API key' }] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'conversation.chat.user.content');
  assert.equal(calls[0].props.interactive, true);
  assert.deepEqual(calls[0].props.content, { text: 'fix the API key', attachments: [], extraBlocks: [] });
  assert.match(markup, /class="rw-row" data-rewind-seq="42"/);
  assert.match(markup, /class="stub-content">fix the API key/);
  assert.match(markup, /class="rw-actions"/);
  assert.match(markup, /data-icon="copy"/);
  assert.match(markup, /data-icon="edit"/);
  assert.match(markup, /data-icon="branch"/);
});

test('keeps attachments, extra blocks, and reference facts in the prepared content', () => {
  const m = mount();
  const { calls } = renderUserMessage(m, {
    labels: { 'docs/intro.md': 'intro' },
    skills: ['canvas'],
    content: [
      { type: 'text', text: 'look at ' },
      { type: 'image', attachment: { kind: 'image', id: 'a1' } },
      { type: 'file', attachment: { name: 'spec.md', bytes: 128 } },
      { type: 'text', text: 'this' },
      { type: 'tool-call', value: 1 },
    ],
  });
  const { content, facts } = calls[0].props;
  assert.equal(content.text, 'look at this');
  assert.deepEqual(content.attachments, [
    { type: 'image', image: { attachment: { kind: 'image', id: 'a1' } } },
    { type: 'file', file: { name: 'spec.md', bytes: 128 } },
  ]);
  assert.deepEqual(content.extraBlocks, [{ type: 'tool-call', value: 1 }]);
  assert.deepEqual(content.referenceLabels, { 'docs/intro.md': 'intro' });
  assert.deepEqual(facts, { sessionLabels: { 'docs/intro.md': 'intro' }, skillNames: ['canvas'] });
});

test('disables edit and branch when the node carries no seq', () => {
  const m = mount();
  const markup = renderToStaticMarkup(h(m.state.registration.view, {
    node: { data: { kind: 'user', content: [{ type: 'text', text: 'no seq' }] } },
    renderFactorySlot: (name, props) => h('div', null, props.content.text),
    sessionId: 's1',
    t: translate(m),
  }));
  assert.equal((markup.match(/disabled/g) ?? []).length, 2);
  assert.equal(markup.split('这条消息没有位置信息，无法操作').length - 1, 2);
});

test('retry appears only on a closed turn', () => {
  const m = mount();
  const closed = renderUserMessage(m, { turnStatus: 'closed' });
  assert.match(closed.markup, /data-action="retry"/);
  assert.match(closed.markup, /data-icon="refresh"/);
  assert.doesNotMatch(renderUserMessage(m, { turnStatus: 'open' }).markup, /data-action="retry"/);
  assert.doesNotMatch(renderUserMessage(m, { turnStatus: 'unknown' }).markup, /data-action="retry"/);
  assert.doesNotMatch(renderUserMessage(m).markup, /data-action="retry"/);
});

test('turnStatusOf reads the turn a message opened and ignores other nodes', () => {
  const { model } = load().plugin;
  assert.equal(model.turnStatusOf({ location: { kind: 'turn', turn: { turn: 2, status: 'closed' } } }), 'closed');
  assert.equal(model.turnStatusOf({ location: { kind: 'step', turn: { turn: 2, status: 'open' } } }), 'open');
  assert.equal(model.turnStatusOf({ location: { kind: 'session' } }), undefined);
  assert.equal(model.turnStatusOf({}), undefined);
  assert.equal(model.turnStatusOf(undefined), undefined);
});

test('editing forks one event before the message, sends the new text, then opens the child', async () => {
  const { model } = load().plugin;
  const ctx = fakeContext();
  await model.editInChild(ctx, 's1', 42, 'fixed text');
  assert.deepEqual(plain(ctx.calls), [
    ['fork', { sessionId: 's1', atSeq: 41, increaseTitle: true }],
    ['using', 'child-1', { source: 'rewind' }],
    ['prompt', [{ type: 'text', text: 'fixed text' }], 'queue'],
    ['openSession', 'child-1'],
  ]);
});

test('branching forks at the message itself and keeps the original session untouched', async () => {
  const { model } = load().plugin;
  const ctx = fakeContext();
  await model.branchFrom(ctx, 's1', 42);
  assert.deepEqual(plain(ctx.calls), [
    ['fork', { sessionId: 's1', atSeq: 42, increaseTitle: true }],
    ['openSession', 'child-1'],
  ]);
});

test('re-running a step forks, asks the model to continue, then opens the child', async () => {
  const { model } = load().plugin;
  const ctx = fakeContext();
  await model.forkAndContinue(ctx, 's1', 19, '继续');
  assert.deepEqual(plain(ctx.calls), [
    ['fork', { sessionId: 's1', atSeq: 19, increaseTitle: true }],
    ['using', 'child-1', { source: 'rewind' }],
    ['prompt', [{ type: 'text', text: '继续' }], 'queue'],
    ['openSession', 'child-1'],
  ]);
});

test('a refused message rejects and leaves the child closed, so the error shows where the user is', async () => {
  const { model } = load().plugin;
  const ctx = fakeContext({ promptResult: { ok: false, error: { code: 'session/busy', message: 'turn running' } } });
  await assert.rejects(() => model.forkAndContinue(ctx, 's1', 19, '继续'), /session\/busy: turn running/);
  assert.deepEqual(ctx.calls.map((call) => call[0]), ['fork', 'using', 'prompt']);
});

test('the first message forks at seq 0 instead of a negative seq', async () => {
  const { model } = load().plugin;
  assert.equal(model.branchBoundary(1), 0);
  assert.equal(model.branchBoundary(42), 41);
  const ctx = fakeContext();
  await model.editInChild(ctx, 's1', 1, 'first');
  assert.equal(ctx.calls[0][1].atSeq, 0);
});

test('a failed fork rejects and never opens or sends anything', async () => {
  const { model } = load().plugin;
  const ctx = fakeContext({ forkError: new Error('session fork failed: source is not live') });
  await assert.rejects(() => model.editInChild(ctx, 's1', 42, 'text'), /source is not live/);
  assert.deepEqual(ctx.calls.map((call) => call[0]), ['fork']);
});

test('clock text matches the shipped format', () => {
  const { model } = load().plugin;
  const t = (key, params) => (params === undefined ? key : `${key}:${params.y}/${params.m}/${params.d}`);
  const today = new Date();
  today.setHours(9, 5, 0, 0);
  assert.equal(model.clockText(today.getTime(), t), '09:05');
  assert.equal(model.clockText(undefined, t), null);
  assert.equal(model.clockText('not a date', t), null);
  const old = new Date(2001, 0, 2, 3, 4, 0, 0);
  assert.equal(model.clockText(old.getTime(), t), 'clockYmd:2001/1/2 03:04');
});

// ── Mid-turn fork point ────────────────────────────────────────────────────

const pointNodes = () => new Map([
  ['a', { key: 'a', kind: 'user', anchorSeq: 1, data: { content: [] }, location: { kind: 'turn', turn: { turn: 1 } } }],
  ['b', { key: 'b', kind: 'assistant-step', anchorSeq: 3, data: { finalNode: { blocks: [{ kind: 'reasoning', text: 'hmm' }, { kind: 'text', text: 'Done with step one.' }] } }, location: { kind: 'step', turn: { turn: 1 } } }],
  ['c', { key: 'c', kind: 'tool-call', anchorSeq: 4, data: { root: { callId: 'c1', name: 'bash' } }, location: { kind: 'step', turn: { turn: 1 } } }],
  ['d', { key: 'd', kind: 'tool-call', anchorSeq: 9, data: { root: { callId: 'c2', name: 'read', subCalls: [{}, {}] } }, location: { kind: 'step', turn: { turn: 2 } } }],
  ['e', { key: 'e', kind: 'turn-tail', anchorSeq: 12, location: { kind: 'turn', turn: { turn: 1 } } }],
]);

test('registers one additive fork-point entry above the turn action row', () => {
  const m = mount();
  assert.equal(m.state.turnTail.options.name, 'conversation.chat.turnTail');
  assert.equal(m.state.turnTail.options.id, 'rewind-fork-point');
  assert.equal(m.state.turnTail.options.locale, 'rewind');
  assert.equal(typeof m.state.turnTail.view, 'function');
  m.disposers.forEach((dispose) => dispose());
  assert.equal(m.state.turnTail, undefined);
});

test('forkPoints cuts before the step, so the step is generated again', () => {
  const { model } = load().plugin;
  const m = mount();
  const points = model.forkPoints(pointNodes(), { turn: 1 }, translate(m));
  assert.deepEqual(plain(points), [
    { seq: 2, anchor: 3, kind: 'assistant-step', label: 'Done with step one. · 工具 bash', turn: 1, keys: ['b', 'c'] },
  ]);
  assert.deepEqual(plain(model.forkPoints(pointNodes(), { turn: 2 }, translate(m))), [
    { seq: 8, anchor: 9, kind: 'tool-call', label: '工具 read +2', turn: 2, keys: ['d'] },
  ]);
  assert.deepEqual(plain(model.forkPoints(undefined, { turn: 1 }, translate(m))), []);
  assert.deepEqual(plain(model.forkPoints(new Map(), { turn: 1 }, translate(m))), []);
});

test('without a turn, forkPoints lists every turn and groups newest first', () => {
  const { model } = load().plugin;
  const m = mount();
  const all = model.forkPoints(pointNodes(), undefined, translate(m));
  assert.deepEqual(plain(all), [
    { seq: 2, anchor: 3, kind: 'assistant-step', label: 'Done with step one. · 工具 bash', turn: 1, keys: ['b', 'c'] },
    { seq: 8, anchor: 9, kind: 'tool-call', label: '工具 read +2', turn: 2, keys: ['d'] },
  ]);
  const groups = plain(model.groupPointsByTurn(all));
  assert.deepEqual(groups.map((group) => group.turn), [2, 1]);
  assert.deepEqual(groups.map((group) => group.points.map((point) => point.seq)), [[8], [2]]);
  assert.deepEqual(plain(model.groupPointsByTurn([])), []);
});

test('a tool call keeps the boundary of the step that issued it', () => {
  const { model } = load().plugin;
  const t = (key, params) => (params === undefined ? key : `${params.name}`);
  const nodes = new Map([
    ['step', { key: 'step', kind: 'assistant-step', anchorSeq: 20, data: { blocks: [{ kind: 'text', text: 'two calls' }] }, location: { kind: 'step', turn: { turn: 3 } } }],
    ['a', { key: 'a', kind: 'tool-call', anchorSeq: 22, data: { root: { name: 'bash' } }, location: { kind: 'step', turn: { turn: 3 } } }],
    ['b', { key: 'b', kind: 'tool-call', anchorSeq: 28, data: { root: { name: 'grep' } }, location: { kind: 'step', turn: { turn: 3 } } }],
    ['next', { key: 'next', kind: 'assistant-step', anchorSeq: 34, data: { blocks: [{ kind: 'text', text: 'later' }] }, location: { kind: 'step', turn: { turn: 3 } } }],
    ['c', { key: 'c', kind: 'tool-call', anchorSeq: 36, data: { root: { name: 'read' } }, location: { kind: 'step', turn: { turn: 3 } } }],
  ]);
  assert.deepEqual(plain(model.forkPoints(nodes, { turn: 3 }, t)), [
    { seq: 19, anchor: 20, kind: 'assistant-step', label: 'two calls · bash · grep', turn: 3, keys: ['step', 'a', 'b'] },
    { seq: 33, anchor: 34, kind: 'assistant-step', label: 'later · read', turn: 3, keys: ['next', 'c'] },
  ]);
});

test('forkPoints drops a repeated seq and nodes without a turn location', () => {
  const { model } = load().plugin;
  const nodes = new Map([
    ['a', { key: 'a', kind: 'tool-call', anchorSeq: 5, data: { root: { name: 'bash' } }, location: { kind: 'step', turn: { turn: 1 } } }],
    ['b', { key: 'b', kind: 'tool-call', anchorSeq: 5, data: { root: { name: 'grep' } }, location: { kind: 'step', turn: { turn: 1 } } }],
    ['c', { key: 'c', kind: 'tool-call', anchorSeq: 6, data: { root: { name: 'read' } } }],
    ['d', { key: 'd', kind: 'tool-call', data: { root: { name: 'glob' } }, location: { kind: 'step', turn: { turn: 1 } } }],
  ]);
  const points = model.forkPoints(nodes, { turn: 1 }, (key, params) => (params === undefined ? key : `${key}:${params.name}`));
  assert.deepEqual(plain(points), [{ seq: 4, anchor: 5, kind: 'tool-call', label: 'forkPointTool:bash · forkPointTool:grep', turn: 1, keys: ['a', 'b'] }]);
});

test('the tail row counts the points plus the end of the turn, and hides without the fork access', () => {
  const m = mount();
  const view = m.state.turnTail.view;
  const props = {
    turn: { turn: 1 },
    seq: 12,
    sessionId: 's1',
    t: translate(m),
    useChat: (selector) => selector({ nodes: pointNodes() }),
  };
  const markup = renderToStaticMarkup(h(view, { ...props, useAccess: () => true }));
  assert.match(markup, /data-action="fork-point"/);
  assert.match(markup, /data-points="2"/);
  assert.match(markup, /data-session-points="2"/);
  assert.match(markup, /从某一步重新执行/);
  assert.match(markup, /data-icon="branch"/);
  assert.equal(renderToStaticMarkup(h(view, { ...props, useAccess: () => false })), '');
  assert.equal(renderToStaticMarkup(h(view, { ...props, useAccess: () => true, useChat: () => new Map(), seq: undefined })), '');
});

// ── Failed tool calls in the picker ────────────────────────────────────────

const failedNodes = () => new Map([
  ['step', { key: 'step', kind: 'assistant-step', anchorSeq: 20, data: { blocks: [{ kind: 'text', text: 'shot the page' }] }, location: { kind: 'step', turn: { turn: 5 } } }],
  ['a', { key: 'a', kind: 'tool-call', anchorSeq: 22, data: { root: { kind: 'tool-result', name: 'bash', isError: true, error: { name: 'ShellError', code: 'exit-1' } } }, location: { kind: 'step', turn: { turn: 5 } } }],
  ['b', { key: 'b', kind: 'tool-call', anchorSeq: 26, data: { root: { kind: 'tool-result', name: 'read', isError: false } }, location: { kind: 'step', turn: { turn: 5 } } }],
]);

test('a failed tool call is reported on the step that ran it', () => {
  const { model } = load().plugin;
  const m = mount();
  assert.deepEqual(plain(model.forkPoints(failedNodes(), { turn: 5 }, translate(m))), [
    {
      seq: 19,
      anchor: 20,
      kind: 'assistant-step',
      label: 'shot the page · 工具 bash · 工具 read',
      turn: 5,
      keys: ['step', 'a', 'b'],
      failures: [{ name: 'bash', reason: 'exit-1' }],
    },
  ]);
});

test('a failure without an error code reports the first line of its output', () => {
  const { model } = load().plugin;
  const nodes = new Map([
    ['a', { key: 'a', kind: 'tool-call', anchorSeq: 5, data: { root: { kind: 'tool-result', name: 'browser_navigate', isError: true, content: [{ type: 'text', text: 'Error: UnknownVizError\n    at shot (capture.js:12)' }] } }, location: { kind: 'step', turn: { turn: 2 } } }],
  ]);
  assert.deepEqual(plain(model.toolFailure(nodes.get('a'))), { name: 'browser_navigate', reason: 'Error: UnknownVizError' });
  assert.equal(model.toolFailure({ kind: 'tool-call', data: { root: { name: 'bash', phase: 'preparing' } } }), null);
  assert.equal(model.toolFailure({ kind: 'assistant-step', data: {} }), null);
});

test('one failed call of a step is listed once even when the call node repeats', () => {
  const { model } = load().plugin;
  const root = { kind: 'tool-result', name: 'bash', isError: true, error: { code: 'exit-1' } };
  const nodes = new Map([
    ['a', { key: 'a', kind: 'tool-call', anchorSeq: 5, data: { root }, location: { kind: 'step', turn: { turn: 1 } } }],
    ['b', { key: 'b', kind: 'tool-call', anchorSeq: 5, data: { root }, location: { kind: 'step', turn: { turn: 1 } } }],
  ]);
  const [point] = model.forkPoints(nodes, { turn: 1 }, translate(mount()));
  assert.deepEqual(plain(point.failures), [{ name: 'bash', reason: 'exit-1' }]);
});

test('the picker marks the row of the step whose tool call failed', () => {
  const { model } = load().plugin;
  const m = mount();
  const groups = model.groupPointsByTurn(model.forkPoints(failedNodes(), { turn: 5 }, translate(m)));
  const markup = renderToStaticMarkup(h(model.PointDialog, {
    groups,
    scope: 'turn',
    onScope: () => {},
    busy: false,
    onPick: () => {},
    onCancel: () => {},
    t: translate(m),
  }));
  assert.match(markup, /data-failed="true"/);
  assert.ok(markup.includes('✗ bash 失败（exit-1）'), markup);
});

test('a failed fork shows its reason inside the dialog, not behind the overlay', () => {
  const { model } = load().plugin;
  const m = mount();
  const markup = renderToStaticMarkup(h(model.PointDialog, {
    groups: model.groupPointsByTurn(model.forkPoints(failedNodes(), { turn: 5 }, translate(m))),
    scope: 'turn',
    onScope: () => {},
    busy: false,
    error: 'session/fork failed',
    onPick: () => {},
    onCancel: () => {},
    t: translate(m),
  }));
  assert.match(markup, /class="rw-dialog-error"/);
  assert.ok(markup.includes('session/fork failed'), markup);
});

test('each step row maps to the fork point of its step', () => {
  const { model } = load().plugin;
  const m = mount();
  const byKey = model.pointsByNodeKey(model.forkPoints(pointNodes(), undefined, translate(m)));
  assert.equal(byKey.get('b').seq, 2);
  assert.equal(byKey.get('c').seq, 2);
  assert.equal(byKey.get('d').seq, 8);
  assert.equal(byKey.has('a'), false, 'the user message is not a step');
  assert.equal(byKey.has('e'), false, 'the turn tail is not a step');
});

test('keep-and-continue forks at the end of the step, the last step at the end of the turn', () => {
  const { model } = load().plugin;
  const points = [
    { seq: 19, kind: 'assistant-step', keys: ['s1'] },
    { seq: 33, kind: 'assistant-step', keys: ['s2'] },
    { seq: 50, kind: 'turn-tail', keys: undefined },
  ];
  const kept = plain(model.withKeepSeq(points, 50));
  assert.deepEqual(kept.map((point) => [point.seq, point.keepSeq]), [[19, 33], [33, 50], [50, undefined]]);
  const byKey = model.pointsByNodeKey(model.withKeepSeq(points, 50));
  assert.equal(byKey.get('s1').keepSeq, 33, 'step one keeps its tool results up to the event before step two starts');
  assert.equal(byKey.get('s2').keepSeq, 50, 'the last step keeps the whole turn');
  assert.equal(plain(model.withKeepSeq([{ seq: 4, kind: 'tool-call' }], undefined))[0].keepSeq, undefined, 'no end, no keep button');
});

test('a turn with an answer puts the picker icon in the shipped action row, not in a row of its own', () => {
  const m = mount();
  const { model } = m.plugin;
  assert.equal(m.state.stepsAction.options.name, 'conversation.chat.assistant-actions');
  assert.equal(m.state.stepsAction.options.id, 'rewind-steps');
  assert.deepEqual(plain(m.state.stepsAction.options.inject('s1')), { rewindSessionId: 's1' });

  const nodes = pointNodes();
  nodes.set('tail', { key: 'tail', kind: 'turn-tail', data: { turn: 1, closing: { finalNode: { messageId: 'msg-1' } } } });
  assert.equal(model.closingMessageId(nodes, 1), 'msg-1');
  assert.equal(model.closingMessageId(nodes, 2), undefined, 'a turn without a closing answer has no action row');

  const tail = renderToStaticMarkup(h(m.state.turnTail.view, {
    turn: { turn: 1 }, seq: 12, sessionId: 's1', t: translate(m),
    useChat: (selector) => selector({ nodes }), useAccess: () => true,
  }));
  assert.match(tail, /data-rewind-tail="icon"/);
  assert.doesNotMatch(tail, /rw-tail-button/);

  const Icon = m.state.stepsAction.view;
  assert.equal(renderToStaticMarkup(h(Icon, { messageId: 'msg-1', rewindSessionId: 's1', t: translate(m) })), '', 'no icon until a tail publishes its dialog');
  const release = model.publishOpener('s1', 'msg-1', () => {});
  const icon = renderToStaticMarkup(h(Icon, { messageId: 'msg-1', rewindSessionId: 's1', t: translate(m) }));
  assert.match(icon, /class="rw-action" data-action="fork-point"/);
  assert.match(icon, /data-icon="clock"/);
  release();
  assert.equal(renderToStaticMarkup(h(Icon, { messageId: 'msg-1', rewindSessionId: 's1', t: translate(m) })), '');
});
