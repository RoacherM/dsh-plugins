import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');

const plain = (value) => JSON.parse(JSON.stringify(value));

const element = (options = {}) => ({
  className: options.className ?? '',
  textContent: options.text ?? '',
  attributes: options.attributes ?? {},
  rect: options.rect ?? { left: 0, top: 0, width: 0, height: 0 },
  scrollTop: options.scrollTop ?? 0,
  scrollHeight: options.scrollHeight ?? 0,
  clientHeight: options.clientHeight ?? 0,
  __style: options.style ?? {},
  getAttribute(name) {
    return this.attributes[name] ?? null;
  },
  getBoundingClientRect() {
    return this.rect;
  },
});

/** Run the bundle against a fake page and return the plugin object plus what apply touched. */
const load = () => {
  const state = { entry: undefined, dom: '<html><body>hi</body></html>', listeners: {}, console: [], styles: [] };

  const fakeConsole = {};
  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    fakeConsole[level] = (...args) => state.console.push({ level, args });
  }
  state.fakeConsole = fakeConsole;

  const window = {
    __ModuleLoader__: { load: (entry) => { state.entry = entry; } },
    __DSH_BOOT__: { release: { version: '0.2.1-rc.2', commit: '332895e' } },
    addEventListener: (name, fn) => { state.listeners[name] = fn; },
    removeEventListener: (name) => { delete state.listeners[name]; },
  };

  const document = {
    baseURI: 'http://127.0.0.1:58667/',
    title: 'DeepSeek Harness',
    body: {},
    documentElement: {
      get outerHTML() {
        return state.dom;
      },
    },
    head: {
      appendChild: (node) => state.styles.push(node),
    },
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    querySelector: (selector) => state.elements?.[selector] ?? null,
    querySelectorAll: (selector) => state.lists?.[selector] ?? [],
  };

  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    createContext: (value) => ({ value, Provider: () => null }),
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useContext: () => undefined,
    Fragment: 'Fragment',
  };

  const primitives = {
    IconWarningTriangleOutlineRegular: () => null,
    writeClipboard: async () => true,
  };

  const requireStub = (name) => {
    if (name === 'react') return react;
    if (name === 'react-dom') return { createPortal: (node) => node };
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    throw new Error(`unexpected require(${name})`);
  };

  const context = vm.createContext({
    window,
    document,
    console: fakeConsole,
    location: { href: 'http://127.0.0.1:58667/' },
    navigator: { language: 'zh-CN' },
    screen: { width: 1512, height: 982 },
    innerWidth: 1240,
    innerHeight: 1000,
    devicePixelRatio: 2,
    screenX: 100,
    screenY: 40,
    setTimeout,
    clearTimeout,
    URL,
    getComputedStyle: (node) => node.__style ?? {},
  });

  vm.runInNewContext(source, context);

  const plugin = state.entry.factory(requireStub);
  return { plugin, state };
};

const mount = () => {
  const captured = { disposers: [] };
  const ctx = {
    effect(fn, label) {
      const dispose = fn();
      captured.disposers.push({ label, dispose });
      return dispose;
    },
    locale: {
      register(namespace, dicts) {
        captured.namespace = namespace;
        captured.dicts = dicts;
        return () => { captured.localeDisposed = true; };
      },
      bind: () => (key, params) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
    },
    slots: {
      inject(name, register) {
        captured.injectedVia = name;
        register();
        return () => { captured.injectDisposed = true; };
      },
      register(options, component) {
        captured.registration = { options, component };
        return () => { captured.registerDisposed = true; };
      },
    },
    sessions: {
      list: {
        getSnapshot: () => ({
          byId: { 'session-1': { title: 'hi hi hi', displayTitle: 'hi hi hi', cwd: '/tmp/app', running: true, blank: false } },
        }),
      },
    },
  };
  return { ctx, captured };
};

const t = (key) => key;

test('the bundle declares one client plugin with the services it uses', () => {
  const { plugin, state } = load();
  assert.equal(state.entry.id, '@local/dsh-issue');
  assert.deepEqual(plain(plugin.inject), ['slots', 'locale', 'sessions']);
  assert.equal(typeof plugin.apply, 'function');
});

test('apply registers locale, a style tag, the console ring, and the header button', () => {
  const { plugin, state } = load();
  const { ctx, captured } = mount();
  plugin.apply(ctx);

  assert.equal(captured.namespace, 'issue');
  assert.deepEqual(Object.keys(captured.dicts.zh).sort(), Object.keys(captured.dicts.en).sort());

  assert.equal(state.styles.length, 1);
  assert.equal(state.styles[0].dataset.plugin, '@local/dsh-issue');
  assert.match(state.styles[0].textContent, /\.issue-dialog/);

  assert.equal(captured.injectedVia, 'conversation.session.header.utilities');
  assert.equal(captured.registration.options.name, 'conversation.session.header.utilities');
  assert.equal(captured.registration.options.id, 'issue');
  assert.equal(captured.registration.options.order, -15);
  assert.equal(captured.registration.options.locale, 'issue');
  assert.equal(captured.registration.options.label(), 'button');
  assert.equal(typeof captured.registration.component, 'function');
});

test('disposing removes the style tag and restores console', () => {
  const { plugin, state } = load();
  const { ctx, captured } = mount();
  plugin.apply(ctx);

  const [locale, ring, styles] = captured.disposers;
  assert.match(locale.label, /locale/);
  assert.match(ring.label, /console ring/);
  assert.match(styles.label, /styles/);
  state.styles[0].removed = false;
  state.styles[0].remove = () => { state.styles[0].removed = true; };
  styles.dispose();
  assert.equal(state.styles[0].removed, true);
  ring.dispose();
});

test('the console ring records levels, errors and unhandled rejections', () => {
  const { plugin, state } = load();
  const { ctx } = mount();
  plugin.apply(ctx);

  state.fakeConsole.warn('careful', { a: 1 });
  state.fakeConsole.error(new Error('boom'));
  state.listeners.unhandledrejection({ reason: 'nope' });

  const ring = plugin.model.consoleRing;
  assert.deepEqual(plain(ring.map((entry) => entry.level)), ['warn', 'error', 'error']);
  assert.equal(ring[0].text, 'careful {"a":1}');
  assert.equal(ring[1].text, 'Error: boom');
  assert.match(ring[1].stack, /boom/);
  assert.equal(ring[2].text, 'unhandled rejection nope');
});

test('the ring keeps the newest entries only', () => {
  const { plugin, state } = load();
  const { ctx } = mount();
  plugin.apply(ctx);
  for (let index = 0; index < 320; index++) state.fakeConsole.log('line', index);
  const ring = plugin.model.consoleRing;
  assert.equal(ring.length, 300);
  assert.equal(ring[ring.length - 1].text, 'line 319');
  assert.equal(ring[0].text, 'line 20');
});

test('activeTab returns the selected tab text', () => {
  const { plugin, state } = load();
  state.lists = {
    '[data-conversation-tabs] button, [data-conversation-tabs] [role="tab"]': [
      element({ text: 'Chat', attributes: { 'aria-selected': 'false' } }),
      element({ text: 'Trajectory', attributes: { 'aria-selected': 'true' } }),
    ],
  };
  assert.equal(plugin.model.activeTab(), 'Trajectory');
});

test('collectLandmarks reports geometry and the properties that decide placement', () => {
  const { plugin, state } = load();
  state.elements = {
    '[data-composer-seat]': element({
      rect: { left: 200, top: 872, width: 800, height: 128 },
      style: { position: 'sticky', display: 'flex', overflowY: 'visible', zIndex: '7' },
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 1000,
    }),
  };
  const found = plugin.model.collectLandmarks();
  assert.equal(found.length, 1);
  assert.deepEqual(plain(found[0].rect), { left: 200, top: 872, width: 800, height: 128 });
  assert.equal(found[0].styles.position, 'sticky');
  assert.deepEqual(plain(found[0].scroll), { top: 0, height: 1000, client: 1000 });
  assert.equal(found[0].name, 'composer-seat');
});

test('collectTranscript keeps the tail with its row kind', () => {
  const { plugin, state } = load();
  state.lists = {
    '[data-chat-flow-kind]': [
      element({ attributes: { 'data-chat-flow-kind': 'user' }, text: ' hello   world ' }),
      element({ attributes: { 'data-chat-flow-kind': 'tool-call' }, text: 'Read files' }),
    ],
  };
  assert.deepEqual(plain(plugin.model.collectTranscript()), [
    { kind: 'user', text: 'hello world' },
    { kind: 'tool-call', text: 'Read files' },
  ]);
});

test('collectPayload carries page, release, window, session, view and the capture options', () => {
  const { plugin } = load();
  const { ctx } = mount();
  const payload = plugin.model.collectPayload(ctx, 'session-1', { title: 'composer floats', screenshot: true, snapshot: true, t });

  assert.equal(payload.title, 'composer floats');
  assert.deepEqual(plain(payload.options), { screenshot: true, dom: true });
  assert.equal(payload.dom, '<html><body>hi</body></html>');
  assert.deepEqual(plain(payload.page), { url: 'http://127.0.0.1:58667/', title: 'DeepSeek Harness' });
  assert.deepEqual(plain(payload.release), { version: '0.2.1-rc.2', commit: '332895e' });
  assert.equal(payload.window.innerWidth, 1240);
  assert.equal(payload.window.dpr, 2);
  assert.equal(payload.window.language, 'zh-CN');
  assert.deepEqual(plain(payload.session), { id: 'session-1', title: 'hi hi hi', cwd: '/tmp/app', running: true, blank: false });
  });

test('collectPayload uses the locale fallback title and skips the snapshot on request', () => {
  const { plugin } = load();
  const { ctx } = mount();
  const payload = plugin.model.collectPayload(ctx, undefined, { title: '', screenshot: false, snapshot: false, t });
  assert.equal(payload.title, 'emptyTitle');
  assert.deepEqual(plain(payload.options), { screenshot: false, dom: false });
  assert.equal(payload.dom, undefined);
  assert.deepEqual(plain(payload.session), {});
});

test('the page snapshot is dropped when the document is too large', () => {
  const { plugin, state } = load();
  state.dom = 'x'.repeat(9 * 1024 * 1024);
  assert.equal(plugin.model.snapshotDocument(), undefined);
  state.dom = '<html></html>';
  assert.equal(plugin.model.snapshotDocument(), '<html></html>');
});

test('sessionFacts falls back to the id when the list has no row', () => {
  const { plugin } = load();
  const { ctx } = mount();
  assert.deepEqual(plain(plugin.model.sessionFacts(ctx, 'missing')), { id: 'missing' });
  assert.deepEqual(plain(plugin.model.sessionFacts(ctx, undefined)), {});
});

test('describe reads strings, errors and odd values safely', () => {
  const { plugin } = load();
  assert.equal(plugin.model.describe('a'), 'a');
  assert.equal(plugin.model.describe(new Error('boom')), 'Error: boom');
  assert.equal(plugin.model.describe({ a: 1 }), '{"a":1}');
  const circular = {};
  circular.self = circular;
  assert.equal(typeof plugin.model.describe(circular), 'string');
});
