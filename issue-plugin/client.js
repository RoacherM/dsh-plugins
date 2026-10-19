/**
 * Client half of dsh-issue: a header button that captures the page state a
 * maintainer needs and posts it to the Host route `/api/issue/report`.
 *
 * The Host half adds the versions, git state, and the screen capture.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-issue',
  factory(require) {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives');

    const NS = 'issue';
    const PKG = '@local/dsh-issue';
    const SLOT = 'conversation.session.header.utilities';
    const ROUTE = 'api/issue/report';
    const CONSOLE_LIMIT = 300;
    const DOM_LIMIT = 8 * 1024 * 1024;

    const zh = {
      button: '报告问题',
      buttonHint: '截图并保存现场，写进 ~/.dsh/issues',
      titleLabel: '问题描述',
      titlePlaceholder: '一句话说明你看到的问题，会用作文件夹名',
      screenshot: '截屏幕',
      screenshotHint: '记录整个桌面，包括别的窗口',
      snapshot: '保存页面快照',
      snapshotHint: '当前页面的 DOM，便于复现布局问题',
      save: '保存现场',
      saving: '保存中…',
      cancel: '取消',
      saved: '已保存',
      copyPath: '复制路径',
      copied: '已复制',
      failed: '保存失败',
      emptyTitle: '未填写描述',
      files: '文件',
    };

    const en = {
      button: 'Report issue',
      buttonHint: 'Capture the screen and page state into ~/.dsh/issues',
      titleLabel: 'What went wrong?',
      titlePlaceholder: 'One line, also used as the folder name',
      screenshot: 'Screenshot',
      screenshotHint: 'Captures the whole desktop, including other windows',
      snapshot: 'Page snapshot',
      snapshotHint: 'The current DOM, useful for layout problems',
      save: 'Save report',
      saving: 'Saving…',
      cancel: 'Cancel',
      saved: 'Saved',
      copyPath: 'Copy path',
      copied: 'Copied',
      failed: 'Could not save',
      emptyTitle: 'no description',
      files: 'Files',
    };

    const h = React.createElement;

    /** Console ring: patched once at apply, capped, and readable while the page lives. */
    const consoleRing = [];

    const isError = (value) => Object.prototype.toString.call(value) === '[object Error]';

    const describe = (value) => {
      if (typeof value === 'string') return value;
      if (isError(value)) return `${value.name}: ${value.message}`;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const pushConsole = (level, args, stack) => {
      const text = Array.from(args ?? [], describe).join(' ').slice(0, 4000);
      consoleRing.push({
        at: new Date().toISOString(),
        level,
        text,
        stack: typeof stack === 'string' ? stack.slice(0, 4000) : undefined,
      });
      if (consoleRing.length > CONSOLE_LIMIT) consoleRing.splice(0, consoleRing.length - CONSOLE_LIMIT);
    };

    const installConsoleRing = () => {
      const levels = ['log', 'info', 'warn', 'error', 'debug'];
      const originals = {};
      for (const level of levels) {
        originals[level] = console[level];
        console[level] = (...args) => {
          const stack = level === 'error' && isError(args[0]) ? args[0].stack : undefined;
          pushConsole(level, args, stack);
          originals[level].apply(console, args);
        };
      }
      const onError = (event) => pushConsole('error', [event.message], event.error?.stack);
      const onRejection = (event) => pushConsole('error', ['unhandled rejection', describe(event.reason)]);
      window.addEventListener('error', onError);
      window.addEventListener('unhandledrejection', onRejection);
      return () => {
        for (const level of levels) console[level] = originals[level];
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
      };
    };

    const LANDMARKS = [
      ['conversation-scroll', '[data-conversation-scroll]'],
      ['conversation-content', '[data-conversation-content]'],
      ['view-area', '[class*="_viewArea"]'],
      ['composer-seat', '[data-composer-seat]'],
      ['chat-flow', '[data-chat-flow-kind]'],
      ['tabs', '[data-conversation-tabs]'],
    ];

    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const collectLandmarks = () => {
      const found = [];
      for (const [name, selector] of LANDMARKS) {
        const element = document.querySelector(selector);
        if (element === null) continue;
        const style = getComputedStyle(element);
        found.push({
          name,
          rect: rectOf(element),
          styles: { position: style.position, display: style.display, overflowY: style.overflowY, zIndex: style.zIndex },
          scroll: { top: Math.round(element.scrollTop), height: element.scrollHeight, client: element.clientHeight },
        });
      }
      return found;
    };

    const collectTranscript = () => Array.from(document.querySelectorAll('[data-chat-flow-kind]'))
      .slice(-40)
      .map((row) => ({
        kind: row.getAttribute('data-chat-flow-kind') ?? '?',
        text: (row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
      }));

    const activeTab = () => {
      const tabs = document.querySelectorAll('[data-conversation-tabs] button, [data-conversation-tabs] [role="tab"]');
      for (const tab of tabs) {
        const selected = tab.getAttribute('aria-selected') === 'true'
          || tab.getAttribute('data-state') === 'active'
          || /tabActive/.test(String(tab.className));
        if (selected) return (tab.textContent ?? '').trim();
      }
      return undefined;
    };

    const sessionFacts = (ctx, sessionId) => {
      if (!sessionId) return {};
      const byId = ctx.sessions?.list?.getSnapshot?.()?.byId ?? {};
      const row = byId[sessionId];
      if (row === undefined) return { id: sessionId };
      return { id: sessionId, title: row.title ?? row.displayTitle, cwd: row.cwd, running: row.running, blank: row.blank };
    };

    /** `window.__DSH_BOOT__` is injected by the shell; the tests run without it. */
    const bootRelease = () => {
      const release = window.__DSH_BOOT__?.release;
      return release === undefined ? undefined : { version: release.version, commit: release.commit };
    };

    const snapshotDocument = () => {
      const html = document.documentElement.outerHTML;
      return html.length > DOM_LIMIT ? undefined : html;
    };

    const postReport = async (payload) => {
      const response = await fetch(new URL(ROUTE, document.baseURI), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      return data;
    };

    const collectPayload = (ctx, sessionId, { title, screenshot, snapshot, t }) => {
      const dom = snapshot ? snapshotDocument() : undefined;
      return {
        title: title === '' ? t('emptyTitle') : title,
        options: { screenshot, dom: dom !== undefined },
        console: consoleRing.slice(-CONSOLE_LIMIT),
        dom,
        page: { url: location.href, title: document.title },
        release: bootRelease(),
        window: {
          innerWidth,
          innerHeight,
          dpr: devicePixelRatio,
          screenX,
          screenY,
          screenWidth: screen.width,
          screenHeight: screen.height,
          language: navigator.language,
        },
        session: sessionFacts(ctx, sessionId),
        view: {
          tab: activeTab(),
          phase: document.querySelector('[data-conversation-content]')?.getAttribute('data-content-phase'),
        },
        landmarks: collectLandmarks(),
        transcript: collectTranscript(),
      };
    };

    const IssueContext = React.createContext(undefined);

    function IssueButton({ sessionId, t }) {
      const [open, setOpen] = React.useState(false);
      return h(
        React.Fragment,
        null,
        h(
          'button',
          {
            type: 'button',
            className: 'issue-button',
            title: t('buttonHint'),
            'aria-label': t('button'),
            onClick: () => setOpen(true),
          },
          h(primitives.IconWarningTriangleOutlineRegular, { size: 16 }),
        ),
        open ? h(IssueDialog, { sessionId, t, onClose: () => setOpen(false) }) : null,
      );
    }

    function IssueDialog({ sessionId, t, onClose }) {
      const ctx = React.useContext(IssueContext);
      const [title, setTitle] = React.useState('');
      const [screenshot, setScreenshot] = React.useState(true);
      const [snapshot, setSnapshot] = React.useState(true);
      const [busy, setBusy] = React.useState(false);
      const [result, setResult] = React.useState(undefined);
      const [error, setError] = React.useState(undefined);
      const [copied, setCopied] = React.useState(false);
      const textarea = React.useRef(null);
      const saveRef = React.useRef(() => {});

      const save = async () => {
        if (busy) return;
        setBusy(true);
        setError(undefined);
        try {
          const payload = collectPayload(ctx, sessionId, { title: title.trim(), screenshot, snapshot, t });
          setResult(await postReport(payload));
        } catch (failure) {
          setError(failure?.message ?? String(failure));
        } finally {
          setBusy(false);
        }
      };
      saveRef.current = save;

      React.useEffect(() => {
        textarea.current?.focus();
        const onKey = (event) => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void saveRef.current();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

      const copy = () => {
        if (!result?.dir) return;
        primitives.writeClipboard(result.dir).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      };

      const done = result === undefined ? null : h(
        'div',
        { className: 'issue-done' },
        h('div', { className: 'issue-done-line' }, `${t('saved')}: `, h('code', null, result.dir)),
        result.warnings?.length > 0
          ? h('ul', { className: 'issue-warnings' }, result.warnings.map((warning, index) => h('li', { key: index }, warning)))
          : null,
        h('div', { className: 'issue-files' }, `${t('files')}: ${(result.files ?? []).join(', ')}`),
        h('button', { type: 'button', className: 'issue-btn', onClick: copy }, copied ? t('copied') : t('copyPath')),
      );

      return ReactDOM.createPortal(
        h(
          'div',
          {
            className: 'issue-overlay',
            onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
          },
          h(
            'div',
            { className: 'issue-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('button') },
            h('div', { className: 'issue-title' }, t('button')),
            done,
            h('textarea', {
              ref: textarea,
              className: 'issue-textarea',
              'aria-label': t('titleLabel'),
              value: title,
              placeholder: t('titlePlaceholder'),
              rows: 3,
              onChange: (event) => setTitle(event.target.value),
            }),
            h(
              'label',
              { className: 'issue-check' },
              h('input', { type: 'checkbox', checked: screenshot, onChange: (event) => setScreenshot(event.target.checked) }),
              h('span', null, t('screenshot')),
              h('span', { className: 'issue-hint' }, t('screenshotHint')),
            ),
            h(
              'label',
              { className: 'issue-check' },
              h('input', { type: 'checkbox', checked: snapshot, onChange: (event) => setSnapshot(event.target.checked) }),
              h('span', null, t('snapshot')),
              h('span', { className: 'issue-hint' }, t('snapshotHint')),
            ),
            error === undefined ? null : h('div', { className: 'issue-error' }, `${t('failed')}: ${error}`),
            h(
              'div',
              { className: 'issue-actions' },
              h('button', { type: 'button', className: 'issue-btn', onClick: onClose }, t('cancel')),
              h(
                'button',
                { type: 'button', className: 'issue-btn issue-btn-primary', onClick: save, disabled: busy },
                busy ? t('saving') : t('save'),
              ),
            ),
          ),
        ),
        document.body,
      );
    }

    const css = `
.issue-button {
  width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: var(--dsw-radius-sm); background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-tertiary);
}
.issue-button:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.issue-overlay {
  position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, .4)) 100%, transparent);
}
.issue-dialog {
  width: min(520px, calc(100vw - 48px)); max-height: 80vh; overflow: auto; display: flex; flex-direction: column; gap: 10px;
  padding: 18px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-shadow-lv3); color: var(--dsw-alias-label-primary); font-size: 14px;
}
.issue-title { font-weight: 600; }
.issue-textarea {
  resize: vertical; min-height: 64px; padding: 8px 10px; border-radius: var(--dsw-radius-sm);
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-specific-input-major, transparent);
  color: inherit; font: inherit;
}
.issue-textarea:focus { outline: 2px solid var(--dsw-alias-button-primary-fill); outline-offset: -1px; }
.issue-check { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary); }
.issue-hint { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.issue-error { color: var(--dsw-alias-label-error); }
.issue-done { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-bg-layer-3); }
.issue-done-line code { font-size: 12px; word-break: break-all; }
.issue-warnings { margin: 0; padding-left: 18px; color: var(--dsw-alias-label-secondary); }
.issue-files { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.issue-actions { display: flex; justify-content: flex-end; gap: 8px; }
.issue-btn {
  height: 30px; padding: 0 14px; border-radius: var(--dsw-radius-sm); cursor: pointer; font: inherit;
  border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary);
}
.issue-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.issue-btn-primary { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-label-primary-foreground); }
.issue-btn:disabled { opacity: .6; cursor: default; }
`;

    return {
      inject: ['slots', 'locale', 'sessions'],
      model: {
        describe,
        pushConsole,
        consoleRing,
        collectLandmarks,
        collectTranscript,
        activeTab,
        sessionFacts,
        bootRelease,
        snapshotDocument,
        collectPayload,
      },
      apply(ctx) {
        const bound = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-issue: locale');
        ctx.effect(installConsoleRing, 'dsh-issue: console ring');
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = PKG;
          tag.textContent = css;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, 'dsh-issue: styles');
        ctx.effect(() => ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: 'issue',
          order: -15,
          locale: NS,
          label: () => bound('button'),
        }, (props) => h(IssueContext.Provider, { value: ctx }, h(IssueButton, props)))), 'dsh-issue: header button');
      },
    };
  },
});
