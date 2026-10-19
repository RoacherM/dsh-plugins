window.__ModuleLoader__.load({
  id: '@local/dsh-rewind',
  factory(require) {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    const h = React.createElement;

    const NS = 'rewind';
    /** Factory slot the shipped renderer uses for the user bubble body. */
    const USER_CONTENT_SLOT = 'conversation.chat.user.content';

    // ── Locale dictionaries ──────────────────────────────────────────────────

    const zh = {
      copy: '复制',
      copied: '已复制',
      edit: '编辑并从这里继续',
      retry: '重试这一轮',
      branch: '从这里分支',
      editTitle: '编辑这条消息',
      editHint: '发送后会创建新的对话分支，原对话保持不变。⌘/Ctrl + Enter 直接发送。',
      cancel: '取消',
      send: '发送',
      busy: '处理中…',
      noPosition: '这条消息没有位置信息，无法操作',
      clockMd: '{m}月{d}日',
      clockYmd: '{y}/{m}/{d}',
    };

    const en = {
      copy: 'Copy',
      copied: 'Copied',
      edit: 'Edit and continue from here',
      retry: 'Retry this turn',
      branch: 'Branch from here',
      editTitle: 'Edit this message',
      editHint: 'Sending starts a new branch; this conversation stays unchanged. Cmd/Ctrl + Enter sends.',
      cancel: 'Cancel',
      send: 'Send',
      busy: 'Working…',
      noPosition: 'This message has no position, so it cannot be operated on',
      clockMd: '{m}/{d}',
      clockYmd: '{y}/{m}/{d}',
    };

    // ── Pure helpers ─────────────────────────────────────────────────────────

    /** Split message content the way the shipped user bubble does. */
    function contentParts(content) {
      const texts = [];
      const attachments = [];
      const rest = [];
      for (const block of content ?? []) {
        if (block?.type === 'text' && typeof block.text === 'string') texts.push(block.text);
        else if (block?.type === 'image' && block.attachment !== undefined) {
          attachments.push({ type: 'image', image: { attachment: block.attachment } });
        } else if (block?.type === 'file' && block.attachment !== undefined) {
          attachments.push({ type: 'file', file: block.attachment });
        } else rest.push(block);
      }
      return { text: texts.join(''), attachments, rest };
    }

    /**
     * Fork one event before the message, so the child ends exactly where the
     * prompt was typed and the edited text can be sent as its next turn.
     */
    const branchBoundary = (seq) => Math.max(0, seq - 1);

    /**
     * Status of the turn this message opened. Retry needs a closed turn, so the
     * child never inherits a half-finished one. Unknown nodes answer undefined.
     */
    function turnStatusOf(node) {
      const location = node?.location;
      if (location === undefined || location === null) return undefined;
      if (location.kind !== 'turn' && location.kind !== 'step') return undefined;
      return location.turn?.status;
    }

    const pad2 = (n) => String(n).padStart(2, '0');

    /** Same clock text the shipped action row prints. */
    function clockText(time, t) {
      if (time === undefined || time === null) return null;
      const d = new Date(time);
      if (Number.isNaN(d.getTime())) return null;
      const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      const now = new Date();
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
        return clock;
      }
      const params = { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
      return `${d.getFullYear() === now.getFullYear() ? t('clockMd', params) : t('clockYmd', params)} ${clock}`;
    }

    // ── Fork operations (no React, so tests can drive them) ──────────────────

    /** Fork at an inclusive seq, open the child, and return its id. */
    async function forkAt(ctx, sessionId, seq) {
      const childId = await ctx.sessions.fork({ sessionId, atSeq: seq, increaseTitle: true });
      ctx.uiWorkspace.openSession(childId);
      return childId;
    }

    /** Fork at the end of this message: the child keeps it and drops what came after. */
    async function branchFrom(ctx, sessionId, seq) {
      return forkAt(ctx, sessionId, seq);
    }

    /** Fork before this message and send the edited text into the child. */
    async function editInChild(ctx, sessionId, seq, text) {
      const childId = await forkAt(ctx, sessionId, branchBoundary(seq));
      await ctx.sessions.using(childId, { source: 'rewind' }, async (reference) => {
        await reference.binding.ctx.conversation.send(text);
      });
      return childId;
    }

    // ── UI ───────────────────────────────────────────────────────────────────

    function ActionButton({ name, label, disabled, onClick, icon }) {
      return h(
        primitives.Tooltip,
        { label, side: 'bottom' },
        h(
          'button',
          {
            type: 'button',
            className: 'rw-action',
            'data-action': name,
            'aria-label': label,
            disabled: disabled || undefined,
            onClick,
          },
          icon,
        ),
      );
    }

    function CopyButton({ text, t }) {
      const [copied, setCopied] = React.useState(false);
      const timer = React.useRef(null);
      React.useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
      const onCopy = React.useCallback(() => {
        if (copied) return;
        primitives.writeClipboard(text).then((ok) => {
          if (!ok) return;
          setCopied(true);
          timer.current = window.setTimeout(() => { timer.current = null; setCopied(false); }, 1000);
        });
      }, [copied, text]);
      const icon = copied ? h(primitives.IconCheckOutlineRegular) : h(primitives.IconCopyOutlineRegular);
      return h(ActionButton, { name: 'copy', label: copied ? t('copied') : t('copy'), onClick: onCopy, icon });
    }

    function EditDialog({ initialText, busy, onCancel, onSubmit, t }) {
      const [text, setText] = React.useState(initialText);
      const ref = React.useRef(null);
      React.useEffect(() => {
        const node = ref.current;
        if (node === null) return;
        node.focus();
        node.setSelectionRange(node.value.length, node.value.length);
      }, []);
      const submit = () => { if (!busy && text.trim() !== '') onSubmit(text); };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          submit();
        }
      };
      return ReactDOM.createPortal(
        h(
          'div',
          { className: 'rw-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) onCancel(); } },
          h(
            'div',
            { className: 'rw-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': t('editTitle'), onKeyDown },
            h('div', { className: 'rw-dialog-title' }, t('editTitle')),
            h('textarea', {
              ref,
              className: 'rw-textarea',
              value: text,
              spellCheck: false,
              onChange: (event) => setText(event.target.value),
            }),
            h('div', { className: 'rw-hint' }, t('editHint')),
            h(
              'div',
              { className: 'rw-dialog-actions' },
              h('button', { type: 'button', className: 'rw-btn', onClick: onCancel, disabled: busy }, t('cancel')),
              h(
                'button',
                { type: 'button', className: 'rw-btn rw-btn-primary', onClick: submit, disabled: busy || text.trim() === '' },
                busy ? t('busy') : t('send'),
              ),
            ),
          ),
        ),
        document.body,
      );
    }

    function createUserMessageView(ctx) {
      return function RewindUserMessage({ node, renderFactorySlot, loadImage, sessionId, t }) {
        const translate = typeof t === 'function' ? t : (key) => key;
        const data = node?.data ?? {};
        const seq = typeof data.seq === 'number' ? data.seq : node?.anchorSeq;

        const parts = React.useMemo(() => contentParts(data.content), [data.content]);
        const prepared = React.useMemo(() => ({
          text: parts.text,
          attachments: parts.attachments,
          extraBlocks: parts.rest,
          ...(data.referenceLabels === undefined ? {} : { referenceLabels: data.referenceLabels }),
        }), [parts, data.referenceLabels]);
        const facts = React.useMemo(() => ({
          ...(data.referenceLabels === undefined ? {} : { sessionLabels: data.referenceLabels }),
          ...(data.skillNames === undefined ? {} : { skillNames: data.skillNames }),
        }), [data.referenceLabels, data.skillNames]);

        const [editing, setEditing] = React.useState(false);
        const [busy, setBusy] = React.useState(false);
        const [error, setError] = React.useState(null);
        const pending = React.useRef(false);
        const positioned = typeof seq === 'number';
        const retryable = positioned && turnStatusOf(node) === 'closed' && prepared.text.trim() !== '';

        const run = React.useCallback(async (operation) => {
          setError(null);
          setBusy(true);
          try {
            await operation();
            return true;
          } catch (thrown) {
            setError(thrown instanceof Error ? thrown.message : String(thrown));
            return false;
          } finally {
            setBusy(false);
          }
        }, []);

        const send = (text) => {
          if (pending.current) return;
          pending.current = true;
          void run(() => editInChild(ctx, sessionId, seq, text)).finally(() => { pending.current = false; });
        };
        const onEdit = () => {
          if (!positioned || busy) return;
          setError(null);
          setEditing(true);
        };
        const onCancel = () => { if (!busy) setEditing(false); };
        const onSubmit = (text) => {
          setEditing(false);
          send(text);
        };
        const onRetry = () => {
          if (!retryable || busy) return;
          setError(null);
          send(prepared.text);
        };
        const onBranch = () => {
          if (!positioned || busy) return;
          setError(null);
          void run(() => branchFrom(ctx, sessionId, seq));
        };

        const body = typeof renderFactorySlot === 'function'
          ? renderFactorySlot(USER_CONTENT_SLOT, { content: prepared, loadImage, facts, interactive: true })
          : h('div', { className: 'rw-bubble' }, prepared.text);

        const clock = clockText(data.time, translate);
        const unavailable = positioned ? undefined : translate('noPosition');

        return h(
          'div',
          { className: 'rw-row', 'data-rewind-seq': positioned ? String(seq) : undefined },
          body,
          h(
            'div',
            { className: 'rw-actions' },
            clock === null ? null : h('span', { className: 'rw-time' }, clock),
            h(CopyButton, { text: prepared.text, t: translate }),
            h(ActionButton, {
              name: 'edit',
              label: unavailable ?? translate('edit'),
              disabled: !positioned || busy,
              onClick: onEdit,
              icon: h(primitives.IconEditOutlineRegular),
            }),
            retryable
              ? h(ActionButton, {
                  name: 'retry',
                  label: translate('retry'),
                  disabled: busy,
                  onClick: onRetry,
                  icon: h(primitives.IconRefreshOutlineRegular),
                })
              : null,
            h(ActionButton, {
              name: 'branch',
              label: unavailable ?? translate('branch'),
              disabled: !positioned || busy,
              onClick: onBranch,
              icon: h(primitives.IconBranchOutlineRegular),
            }),
          ),
          error === null ? null : h('div', { className: 'rw-error' }, error),
          editing && h(EditDialog, { initialText: prepared.text, busy, onCancel, onSubmit, t: translate }),
        );
      };
    }

    // ── Styles ───────────────────────────────────────────────────────────────

    const CSS = `
.rw-row{display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:0;max-width:100%}
.rw-actions{display:flex;align-items:center;gap:8px;height:calc(28px + var(--dsh-content-font-delta,0px));opacity:.6;transition:opacity 80ms}
.rw-row:hover .rw-actions,.rw-row:focus-within .rw-actions{opacity:1}
.rw-time{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);white-space:nowrap;padding-right:12px}
.rw-action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));display:inline-flex;align-items:center;justify-content:center;padding:6px;border:none;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.rw-action svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}
.rw-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.rw-action:disabled{opacity:.4;cursor:default}
.rw-action:disabled:hover{background:0 0;color:var(--dsw-alias-label-tertiary)}
.rw-bubble{background:var(--dsw-specific-bubble);border-radius:var(--dsw-radius-lg);max-width:100%;font-size:var(--dsh-content-font-size,14px);line-height:calc(22px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;padding:10px 16px}
.rw-error{max-width:min(calc(var(--dsh-chat-content-width,748px) * .702),82%);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-error);text-align:right;white-space:pre-wrap;word-break:break-word}
.rw-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:12vh 24px 24px;background:var(--dsw-alias-bg-mask-1)}
.rw-dialog{display:flex;flex-direction:column;gap:12px;width:min(640px,100%);padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3)}
.rw-dialog-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.rw-textarea{box-sizing:border-box;width:100%;min-height:110px;max-height:42vh;resize:vertical;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-specific-input-major,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px}
.rw-textarea:focus{outline:none;border-color:var(--dsw-alias-border-l3)}
.rw-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.rw-dialog-actions{display:flex;justify-content:flex-end;gap:8px}
.rw-btn{padding:6px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.rw-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.rw-btn:disabled{opacity:.5;cursor:default}
.rw-btn-primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.rw-btn-primary:hover{background:var(--dsw-alias-button-primary-hover)}
/* Composer guard. A view can switch the conversation scroller into "overlay mode"
   by putting a child marked with [data-conversation-composer-overlay] (the
   Trajectory view does this). Overlay mode makes the composer seat absolutely
   positioned and clips the active view. If that mode ever overlaps a chat view,
   the composer leaves the scrollport bottom and rides the scroll instead. Keep
   the chat in charge whenever both are present. No effect in normal mode. */
[data-conversation-scroll]:has([data-conversation-composer-overlay]):has([data-chat-flow-kind])>[data-composer-seat]{position:sticky!important;bottom:0!important;left:auto!important;right:auto!important}
[data-conversation-scroll]:has([data-conversation-composer-overlay]):has([data-chat-flow-kind])>[data-slot="conversation.session"]>*{flex:1 0 auto!important;min-height:auto!important;overflow-y:visible!important}
`;

    // ── Plugin ───────────────────────────────────────────────────────────────

    return {
      inject: ['slots', 'locale', 'sessions', 'uiWorkspace'],
      model: { contentParts, branchBoundary, turnStatusOf, clockText, branchFrom, editInChild, forkAt },
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'rewind locale');
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@local/dsh-rewind';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, 'rewind styles');
        ctx.effect(
          () => ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
            name: 'conversation.chat.node',
            key: 'user',
            priority: -10,
            locale: NS,
          }, createUserMessageView(ctx))),
          'rewind user message actions',
        );
      },
    };
  },
});
