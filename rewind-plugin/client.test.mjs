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
  const state = { registration: undefined };
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
        assert.equal(name, 'conversation.chat.node');
        state.registration = register();
        return () => { state.registration = undefined; };
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
function fakeContext({ forkError } = {}) {
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
        return operation({ binding: { ctx: { conversation: { send: async (text) => { calls.push(['send', text]); } } } } });
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

test('editing forks one event before the message, opens the child, and sends the new text', async () => {
  const { model } = load().plugin;
  const ctx = fakeContext();
  await model.editInChild(ctx, 's1', 42, 'fixed text');
  assert.deepEqual(plain(ctx.calls), [
    ['fork', { sessionId: 's1', atSeq: 41, increaseTitle: true }],
    ['openSession', 'child-1'],
    ['using', 'child-1', { source: 'rewind' }],
    ['send', 'fixed text'],
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
