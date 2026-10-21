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
      forkPoint: '从某一步重新执行',
      forkPointTitle: '选择重新执行哪一步',
      forkPointHint: '新会话保留这一步之前的历史。这一步和之后的内容全部丢弃，模型立刻重新生成这一步；这一步跑过的工具会重新跑。选「本轮结束」保留整轮，同样立刻继续。',
      continuePrompt: '继续',
      stepResume: '从这一步重来',
      stepResumeHint: '在新会话里从这一步之前继续：这一步重新生成，原会话不变',
      stepKeep: '从这里继续',
      stepKeepHint: '在新会话里保留这一步（含工具结果），模型接着往下做，原会话不变',
      forkPointTool: '工具 {name}',
      forkPointAssistant: '助手消息',
      forkPointAnswer: '回答提问',
      forkPointRetry: '失败后重试',
      forkPointError: '失败的步骤',
      forkPointMaxTokens: '被长度截断的步骤',
      forkPointSteering: '插话',
      forkPointTurnEnd: '本轮结束（保留整轮）',
      forkScopeTurn: '本轮',
      forkScopeSession: '整个会话',
      forkFilter: '筛选：文字、工具名或 #序号',
      forkTurnHeader: '第 {turn} 轮',
      forkCapped: '只列出最近 {n} 个点，用筛选缩小范围',
      forkEmpty: '没有匹配的步骤',
      forkToolFailed: '✗ {name} 失败',
      forkToolReason: '（{reason}）',
      kindTool: '工具',
      kindAssistant: '回答',
      kindOther: '节点',
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
      forkPoint: 'Re-run a step of this turn',
      forkPointTitle: 'Choose the step to run again',
      forkPointHint: 'The new session keeps everything before this step. The step and all later work are dropped, and the model generates the step again right away; its tools run again. The end-of-turn row keeps the whole turn and also continues right away.',
      continuePrompt: 'Continue',
      stepResume: 'Redo from this step',
      stepResumeHint: 'Continue in a new session from just before this step. The step is generated again; this session is not changed.',
      stepKeep: 'Continue from here',
      stepKeepHint: 'Continue in a new session that keeps this step and its tool results; the model goes on to the next step. This session is not changed.',
      forkPointTool: 'Tool {name}',
      forkPointAssistant: 'Assistant message',
      forkPointAnswer: 'Answer to a question',
      forkPointRetry: 'Retry after a failure',
      forkPointError: 'Failed step',
      forkPointMaxTokens: 'Step cut off by the length limit',
      forkPointSteering: 'Steering message',
      forkPointTurnEnd: 'End of this turn (keep it all)',
      forkScopeTurn: 'This turn',
      forkScopeSession: 'Whole session',
      forkFilter: 'Filter: text, tool name or #seq',
      forkTurnHeader: 'Turn {turn}',
      forkCapped: 'Only the newest {n} points are listed; narrow the filter',
      forkEmpty: 'No step matches',
      forkToolFailed: '✗ {name} failed',
      forkToolReason: ' ({reason})',
      kindTool: 'Tool',
      kindAssistant: 'Answer',
      kindOther: 'Node',
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

    /** Node kinds that mark a forkable point inside a turn. */
    const FORK_POINT_KINDS = new Set([
      'tool-call',
      'assistant-step',
      'question-reply',
      'model-retry',
      'turn-error',
      'turn-max-tokens',
      'steering',
    ]);

    /** Join the text blocks a node carries, for a one-line label. */
    function nodeText(node) {
      const blocks = node?.data?.finalNode?.blocks ?? node?.data?.blocks;
      if (!Array.isArray(blocks)) return '';
      const texts = [];
      for (const block of blocks) {
        if (block?.kind === 'text' && typeof block.text === 'string') texts.push(block.text.trim());
      }
      return texts.filter((text) => text !== '').join(' ');
    }

    const clip = (text, max = 64) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

    /** One localized label per node kind; unknown kinds still render a row. */
    function describePoint(node, t) {
      const root = node?.data?.root;
      switch (node.kind) {
        case 'tool-call': {
          const name = typeof root?.name === 'string' && root.name !== '' ? root.name : undefined;
          const base = name === undefined ? t('kindTool') : t('forkPointTool', { name });
          const subCalls = Array.isArray(root?.subCalls) ? root.subCalls.length : 0;
          return subCalls > 0 ? `${base} +${subCalls}` : base;
        }
        case 'assistant-step': {
          const text = nodeText(node);
          return text === '' ? t('forkPointAssistant') : clip(text);
        }
        case 'question-reply': return t('forkPointAnswer');
        case 'model-retry': return t('forkPointRetry');
        case 'turn-error': return t('forkPointError');
        case 'turn-max-tokens': return t('forkPointMaxTokens');
        case 'steering': return t('forkPointSteering');
        default: return t('kindOther');
      }
    }

    /**
     * Why one tool call of a step failed, or null when it did not.
     *
     * A settled call carries `isError`; a call that is still running has no
     * `kind` yet and is never reported as a failure. The reason comes from the
     * call's own error, else from the first line of its result text.
     */
    function toolFailure(node) {
      const root = node?.kind === 'tool-call' ? node.data?.root : undefined;
      if (root === undefined || root === null || root.isError !== true) return null;
      const name = typeof root.name === 'string' ? root.name : '';
      const error = root.error;
      const coded = [error?.code, error?.name].find((value) => typeof value === 'string' && value !== '');
      if (coded !== undefined) return { name, reason: coded };
      const text = contentParts(root.content).text.trim();
      const first = text.split('\n')[0].trim();
      return { name, reason: first === '' ? '' : clip(first, 40) };
    }

    /** Keep one entry per failed tool call of a step. */
    function addFailure(point, failure) {
      const known = point.failures ?? [];
      if (known.some((other) => other.name === failure.name && other.reason === failure.reason)) return;
      point.failures = known.concat([failure]);
    }

    /** Turn number a node belongs to, or null when the node carries none. */
    function turnKeyOf(node) {
      const turn = node.location?.turn?.turn;
      return typeof turn === 'number' ? turn : null;
    }

    /**
     * Every forkable point, oldest first, as "re-sample this step".
     *
     * A fork copies an inclusive event prefix, so the boundary must sit one event
     * BEFORE the step that holds the node: the step's assistant message, its tool
     * calls and their results are all dropped, and the model generates that step
     * again. Nodes of one step collapse into one row because they share a
     * boundary. Pass no `turn` to get the points of every turn of the session.
     */
    function forkPoints(nodes, turn, t = (key) => key) {
      if (nodes === undefined || nodes === null || typeof nodes.values !== 'function') return [];
      const wanted = typeof turn?.turn === 'number' ? turn.turn : undefined;
      const inTurn = [];
      for (const node of nodes.values()) {
        if (typeof node?.anchorSeq !== 'number') continue;
        const location = node.location;
        if (location?.kind !== 'turn' && location?.kind !== 'step') continue;
        if (wanted !== undefined && location.turn?.turn !== wanted) continue;
        inTurn.push(node);
      }

      // A step start only bounds the steps of its own turn: two turns interleave
      // their seqs, so a shared list would pull a later turn's call back to an
      // earlier turn's step.
      const startsByTurn = new Map();
      for (const node of inTurn) {
        if (node.kind !== 'assistant-step') continue;
        const key = turnKeyOf(node);
        const starts = startsByTurn.get(key);
        if (starts === undefined) startsByTurn.set(key, [node.anchorSeq]);
        else starts.push(node.anchorSeq);
      }
      for (const starts of startsByTurn.values()) starts.sort((left, right) => left - right);

      const points = new Map();
      for (const node of inTurn) {
        if (!FORK_POINT_KINDS.has(node.kind)) continue;
        const anchor = node.anchorSeq;
        let start = anchor;
        for (const stepStart of startsByTurn.get(turnKeyOf(node)) ?? []) if (stepStart <= anchor) start = stepStart;
        const seq = Math.max(0, start - 1);
        const label = describePoint(node, t);
        const turnNumber = node.location?.turn?.turn;
        const failure = toolFailure(node);
        const existing = points.get(seq);
        if (existing === undefined) {
          const point = { seq, anchor, kind: node.kind, label, turn: turnNumber, keys: [node.key] };
          if (failure !== null) point.failures = [failure];
          points.set(seq, point);
          continue;
        }
        existing.keys.push(node.key);
        if (!existing.label.includes(label) && existing.label.length < 96) existing.label = `${existing.label} · ${label}`;
        if (failure !== null) addFailure(existing, failure);
      }

      return [...points.values()].sort((left, right) => left.seq - right.seq);
    }

    /**
     * Add `keepSeq` to each step point: the last event of that step, so a fork
     * there keeps the step's message, tool calls and results. A step ends one
     * event before the next step's boundary, which is that step's start minus
     * one; the last step ends at the turn's end event `endSeq`.
     */
    function withKeepSeq(points, endSeq) {
      const sorted = points.slice().sort((left, right) => left.seq - right.seq);
      return sorted.map((point, index) => {
        if (point.kind === 'turn-tail') return point;
        const next = sorted[index + 1];
        const keepSeq = next !== undefined ? next.seq : endSeq;
        return typeof keepSeq === 'number' ? { ...point, keepSeq } : point;
      });
    }

    /** Map each chat node key to the fork point of its step. */
    function pointsByNodeKey(points) {
      const byKey = new Map();
      for (const point of points) for (const key of point.keys ?? []) byKey.set(key, point);
      return byKey;
    }

    /** Rows of the picker grouped by turn, newest turn first. */
    function groupPointsByTurn(points) {
      const groups = new Map();
      for (const point of points) {
        const turn = typeof point.turn === 'number' ? point.turn : 0;
        const bucket = groups.get(turn);
        if (bucket === undefined) groups.set(turn, [point]);
        else bucket.push(point);
      }
      return [...groups.entries()]
        .sort((left, right) => right[0] - left[0])
        .map(([turn, list]) => ({ turn, points: list.slice().sort((left, right) => left.seq - right.seq) }));
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

    /**
     * Fork at seq, queue one text message in the child, then open it.
     *
     * The message goes through the child's session object. The scope context of
     * a session reference is built from the controller's root context, which has
     * no `conversation` service, so `binding.ctx.conversation.send` fails there.
     * The child opens only after the message is accepted: if sending fails, the
     * error stays in the session the user is looking at.
     */
    async function forkAndSend(ctx, sessionId, seq, text) {
      const childId = await ctx.sessions.fork({ sessionId, atSeq: seq, increaseTitle: true });
      await ctx.sessions.using(childId, { source: 'rewind' }, async (reference) => {
        const result = await reference.binding.session.prompt([{ type: 'text', text }], 'queue');
        if (result?.ok !== true) {
          const error = result?.error;
          throw new Error(`rewind: message not sent to ${childId}: ${error?.code ?? 'unknown'}: ${error?.message ?? ''}`);
        }
      });
      ctx.uiWorkspace.openSession(childId);
      return childId;
    }

    /**
     * Fork before a step and ask the model to continue there. An inclusive prefix
     * fork leaves the copied turn open, and DSH closes it as "forked", so nothing
     * runs until a new message arrives: the child would just sit there complete.
     * The message is the same short "continue" the user would type.
     */
    async function forkAndContinue(ctx, sessionId, seq, text) {
      return forkAndSend(ctx, sessionId, seq, text);
    }

    /** Fork before this message and send the edited text into the child. */
    async function editInChild(ctx, sessionId, seq, text) {
      return forkAndSend(ctx, sessionId, branchBoundary(seq), text);
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

    // ── Mid-turn fork point ──────────────────────────────────────────────────

    function kindBadge(kind, t) {
      if (kind === 'tool-call') return t('kindTool');
      if (kind === 'assistant-step') return t('kindAssistant');
      return t('kindOther');
    }

    const FORK_ROW_LIMIT = 300;

    function PointDialog({ groups, scope, onScope, busy, error, onPick, onCancel, t }) {
      const [filter, setFilter] = React.useState('');
      const query = filter.trim().toLowerCase();
      const matches = (point) => query === ''
        || point.label.toLowerCase().includes(query)
        || `#${String(point.seq)}`.includes(query);

      const rows = [];
      for (const group of groups) {
        const kept = group.points.filter(matches);
        if (kept.length === 0) continue;
        rows.push(h('div', { key: `turn-${String(group.turn)}`, className: 'rw-point-turn' }, t('forkTurnHeader', { turn: group.turn })));
        for (const point of kept) {
          const failures = point.failures ?? [];
          rows.push(h(
            'button',
            {
              key: `${String(point.seq)}-${String(rows.length)}`,
              type: 'button',
              className: 'rw-point',
              'data-seq': point.seq,
              'data-kind': point.kind,
              'data-failed': failures.length === 0 ? undefined : 'true',
              disabled: busy || undefined,
              onClick: () => onPick(point),
            },
            h('span', { className: 'rw-point-kind' }, point.kind === 'turn-tail' ? '' : kindBadge(point.kind, t)),
            h('span', { className: 'rw-point-label' }, point.label),
            failures.map((failure) => h(
              'span',
              { key: `${failure.name}:${failure.reason}`, className: 'rw-point-fail' },
              t('forkToolFailed', { name: failure.name === '' ? t('kindTool') : failure.name })
                + (failure.reason === '' ? '' : t('forkToolReason', { reason: failure.reason })),
            )),
            h('span', { className: 'rw-point-seq' }, `#${String(point.seq)}`),
          ));
        }
      }

      const capped = rows.length > FORK_ROW_LIMIT;
      const shown = capped ? rows.slice(0, FORK_ROW_LIMIT) : rows;

      return h(
        'div',
        { className: 'rw-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) onCancel(); } },
        h(
          'div',
          { className: 'rw-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': t('forkPointTitle') },
          h('div', { className: 'rw-dialog-title' }, t('forkPointTitle')),
          h(
            'div',
            { className: 'rw-scope-row' },
            h('button', { type: 'button', className: 'rw-scope', 'data-scope': 'turn', 'data-active': String(scope !== 'session'), onClick: () => onScope('turn') }, t('forkScopeTurn')),
            h('button', { type: 'button', className: 'rw-scope', 'data-scope': 'session', 'data-active': String(scope === 'session'), onClick: () => onScope('session') }, t('forkScopeSession')),
          ),
          h('input', {
            className: 'rw-filter',
            type: 'search',
            value: filter,
            placeholder: t('forkFilter'),
            onChange: (event) => setFilter(event.target.value),
          }),
          rows.length === 0
            ? h('div', { className: 'rw-hint' }, t('forkEmpty'))
            : h('div', { className: 'rw-point-list' }, shown),
          capped ? h('div', { className: 'rw-hint' }, t('forkCapped', { n: FORK_ROW_LIMIT })) : null,
          h('div', { className: 'rw-hint' }, t('forkPointHint')),
          error === undefined || error === null ? null : h('div', { className: 'rw-dialog-error' }, error),
          h(
            'div',
            { className: 'rw-dialog-actions' },
            h('button', { type: 'button', className: 'rw-btn', onClick: onCancel, disabled: busy || undefined }, t('cancel')),
          ),
        ),
      );
    }

    const HIDE_DELAY_MS = 250;

    /**
     * Dialog openers of mounted turn tails, keyed by session and closing message.
     * The step picker icon lives in the shipped action row
     * (`conversation.chat.assistant-actions`), which only knows the message id;
     * the turn tail owns the dialog and the fork state, so it publishes its
     * opener here and the icon looks it up.
     */
    const openers = new Map();
    const openerListeners = new Set();
    const openerKey = (sessionId, messageId) => `${String(sessionId)}\u0000${String(messageId)}`;
    function publishOpener(sessionId, messageId, open) {
      const key = openerKey(sessionId, messageId);
      openers.set(key, open);
      for (const listener of openerListeners) listener();
      return () => {
        if (openers.get(key) === open) openers.delete(key);
        for (const listener of openerListeners) listener();
      };
    }
    function subscribeOpeners(listener) {
      openerListeners.add(listener);
      return () => openerListeners.delete(listener);
    }

    /** Message id of the answer that closes this turn, or undefined for a failed turn. */
    function closingMessageId(nodes, turnNumber) {
      if (nodes === undefined || nodes === null || typeof nodes.values !== 'function') return undefined;
      for (const node of nodes.values()) {
        if (node?.kind !== 'turn-tail' || node.data?.turn !== turnNumber) continue;
        const id = node.data?.closing?.finalNode?.messageId;
        return typeof id === 'string' && id !== '' ? id : undefined;
      }
      return undefined;
    }

    /**
     * Hover button on each step row of this turn. The rows belong to other
     * plugins (tool views, assistant steps) and slots cannot wrap them, so this
     * finds them in the DOM by the attributes the chat seat writes:
     * data-chat-node-key and data-chat-turn.
     */
    function StepResume({ turnNumber, byKey, busy, onResume, t }) {
      const anchor = React.useRef(null);
      const keys = React.useRef(byKey);
      keys.current = byKey;
      const [target, setTarget] = React.useState(null);
      const hideTimer = React.useRef(null);

      React.useEffect(() => {
        const root = anchor.current?.closest('[data-conversation-scroll]');
        if (root === null || root === undefined || typeof turnNumber !== 'number') return undefined;
        const cancelHide = () => {
          if (hideTimer.current !== null) clearTimeout(hideTimer.current);
          hideTimer.current = null;
        };
        const scheduleHide = () => {
          cancelHide();
          hideTimer.current = setTimeout(() => setTarget(null), HIDE_DELAY_MS);
        };
        const onOver = (event) => {
          const row = event.target instanceof Element ? event.target.closest('[data-chat-node-key]') : null;
          if (row === null || row.dataset.chatTurn !== String(turnNumber)) return;
          const point = keys.current.get(row.dataset.chatNodeKey);
          if (point === undefined) return;
          cancelHide();
          const key = row.dataset.chatNodeKey;
          setTarget((current) => (current?.key === key ? current : { key, point, rect: row.getBoundingClientRect() }));
        };
        const onOut = (event) => {
          const next = event.relatedTarget;
          if (next instanceof Element && next.closest('.rw-step-resume') !== null) return;
          scheduleHide();
        };
        const onScroll = () => setTarget(null);
        root.addEventListener('mouseover', onOver);
        root.addEventListener('mouseout', onOut);
        root.addEventListener('scroll', onScroll, { passive: true });
        return () => {
          cancelHide();
          root.removeEventListener('mouseover', onOver);
          root.removeEventListener('mouseout', onOut);
          root.removeEventListener('scroll', onScroll);
        };
      }, [turnNumber]);

      const action = (name, seq, label, icon) => h(
        'span',
        { key: name, 'data-seq': seq },
        h(ActionButton, { name, label: busy ? t('busy') : label, disabled: busy, onClick: () => onResume(seq), icon }),
      );
      const point = target?.point;
      const button = point === undefined ? null : ReactDOM.createPortal(h(
        'div',
        {
          className: 'rw-step-resume',
          style: { top: `${String(Math.max(0, target.rect.top))}px`, left: `${String(target.rect.right)}px` },
          onMouseEnter: () => { if (hideTimer.current !== null) clearTimeout(hideTimer.current); },
          onMouseLeave: () => setTarget(null),
        },
        typeof point.keepSeq === 'number'
          ? action('keep', point.keepSeq, t('stepKeepHint'), h(primitives.IconBranchOutlineRegular))
          : null,
        action('redo', point.seq, t('stepResumeHint'), h(primitives.IconRefreshOutlineRegular)),
      ), document.body);

      return h(React.Fragment, null, h('span', { ref: anchor, hidden: true }), button);
    }

    /**
     * Row above the turn action row: pick any step of this turn, or of the whole
     * session, and continue in a new session from the point just before it.
     */
    function createForkPointTail(ctx) {
      return function RewindForkPointTail({ turn, seq, sessionId, t, useChat, useAccess }) {
        const translate = typeof t === 'function' ? t : (key) => key;
        const nodes = typeof useChat === 'function' ? useChat((snapshot) => snapshot.nodes) : undefined;
        const turnRows = React.useMemo(() => {
          const found = forkPoints(nodes, turn, translate);
          if (typeof seq !== 'number') return found;
          const kept = found.filter((point) => point.seq < seq);
          const end = {
            seq,
            anchor: seq,
            kind: 'turn-tail',
            label: translate('forkPointTurnEnd'),
            turn: typeof turn?.turn === 'number' ? turn.turn : undefined,
          };
          return kept.concat([end]);
        }, [nodes, turn, seq, translate]);
        const sessionRows = React.useMemo(() => {
          const found = forkPoints(nodes, undefined, translate);
          return typeof seq === 'number' ? found.filter((point) => point.seq < seq) : found;
        }, [nodes, seq, translate]);

        const [open, setOpen] = React.useState(false);
        const [scope, setScope] = React.useState('turn');
        const [busy, setBusy] = React.useState(false);
        const [error, setError] = React.useState(null);
        const allowed = typeof useAccess !== 'function' || useAccess('session/fork');

        const groups = React.useMemo(
          () => groupPointsByTurn(scope === 'session' ? sessionRows : turnRows),
          [scope, sessionRows, turnRows],
        );

        const runFork = async (forkSeq) => {
          setBusy(true);
          setError(null);
          try {
            await forkAndContinue(ctx, sessionId, forkSeq, translate('continuePrompt'));
            setOpen(false);
          } catch (thrown) {
            setError(thrown instanceof Error ? thrown.message : String(thrown));
          } finally {
            setBusy(false);
          }
        };

        const pick = (point) => runFork(point.seq);
        const byKey = React.useMemo(() => pointsByNodeKey(withKeepSeq(turnRows, seq)), [turnRows, seq]);
        const turnNumber = typeof turn?.turn === 'number' ? turn.turn : undefined;
        const messageId = closingMessageId(nodes, turnNumber);
        const visible = allowed && turnRows.length > 0;

        React.useEffect(() => {
          if (!visible || messageId === undefined) return undefined;
          return publishOpener(sessionId, messageId, () => { setError(null); setOpen(true); });
        }, [visible, sessionId, messageId]);

        if (!visible) return null;

        const dialog = open
          ? ReactDOM.createPortal(h(PointDialog, {
              groups,
              scope,
              onScope: setScope,
              busy,
              error,
              onPick: pick,
              onCancel: () => { if (!busy) setOpen(false); },
              t: translate,
            }), document.body)
          : null;
        const hover = h(StepResume, {
          turnNumber,
          byKey,
          busy,
          onResume: (forkSeq) => { if (!busy) void runFork(forkSeq); },
          t: translate,
        });

        // A turn with an answer has the shipped action row; the picker icon sits
        // there, so this entry adds no visible row of its own.
        if (messageId !== undefined) {
          return h(
            'div',
            { className: 'rw-tail', 'data-rewind-tail': 'icon' },
            hover,
            error === null || open ? null : h('div', { className: 'rw-error' }, error),
            dialog,
          );
        }

        return h(
          'div',
          { className: 'rw-tail', 'data-rewind-tail': 'button' },
          hover,
          h(
            'button',
            {
              type: 'button',
              className: 'rw-tail-button',
              'data-action': 'fork-point',
              'data-points': turnRows.length,
              'data-session-points': sessionRows.length,
              onClick: () => { setError(null); setOpen(true); },
            },
            h(primitives.IconBranchOutlineRegular),
            h('span', null, translate('forkPoint')),
          ),
          error === null || open ? null : h('div', { className: 'rw-error' }, error),
          dialog,
        );
      };
    }

    /** Picker icon in the shipped action row of a turn that ended with an answer. */
    function createStepsAction() {
      return function RewindStepsAction({ messageId, rewindSessionId, t }) {
        const translate = typeof t === 'function' ? t : (key) => key;
        const read = () => openers.get(openerKey(rewindSessionId, messageId));
        const open = React.useSyncExternalStore(subscribeOpeners, read, read);
        if (open === undefined) return null;
        return h(ActionButton, {
          name: 'fork-point',
          label: translate('forkPoint'),
          onClick: open,
          icon: h(primitives.IconClockOutlineRegular ?? primitives.IconBranchOutlineRegular),
        });
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
.rw-tail{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0;max-width:100%}
.rw-tail[data-rewind-tail=icon]{display:contents}
.rw-tail-button{display:inline-flex;align-items:center;gap:6px;height:calc(28px + var(--dsh-content-font-delta,0px));margin-left:-6px;padding:0 8px;border:none;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:var(--dsh-content-font-size-secondary,13px);cursor:pointer}
.rw-tail-button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.rw-tail-button:disabled{opacity:.4;cursor:default}
.rw-tail-button svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}


.rw-step-resume{position:fixed;z-index:900;transform:translate(-100%,-4px);display:inline-flex;align-items:center;gap:2px;padding:2px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));box-shadow:var(--dsw-shadow-lv2)}
.rw-point-list{display:flex;flex-direction:column;gap:2px;max-height:46vh;overflow-y:auto;min-height:0}
.rw-point{display:flex;align-items:center;gap:10px;padding:7px 10px;border:none;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.rw-point:hover{background:var(--dsw-alias-interactive-bg-hover)}
.rw-point:disabled{opacity:.5;cursor:default}
.rw-point-kind{flex:none;min-width:52px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.rw-point-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rw-point-seq{flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;font-variant-numeric:tabular-nums}
.rw-point-fail{flex:none;max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-error);font-size:12px}
.rw-point[data-failed=true] .rw-point-kind{color:var(--dsw-alias-label-error)}
.rw-point-turn{position:sticky;top:0;z-index:1;padding:6px 10px 4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px}
.rw-scope-row{display:flex;gap:6px}
.rw-scope{padding:5px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.rw-scope:hover{background:var(--dsw-alias-interactive-bg-hover)}
.rw-scope[data-active=true]{border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}
.rw-filter{box-sizing:border-box;width:100%;padding:7px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-specific-input-major,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.rw-filter:focus{outline:none;border-color:var(--dsw-alias-border-l3)}
.rw-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:12vh 24px 24px;background:var(--dsw-alias-bg-mask-1)}
.rw-dialog{display:flex;flex-direction:column;gap:12px;width:min(640px,100%);padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3)}
.rw-dialog-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.rw-textarea{box-sizing:border-box;width:100%;min-height:110px;max-height:42vh;resize:vertical;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-specific-input-major,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px}
.rw-textarea:focus{outline:none;border-color:var(--dsw-alias-border-l3)}
.rw-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.rw-dialog-error{padding:8px 10px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-error,transparent);border:1px solid var(--dsw-alias-border-error,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-error);font-size:12px;line-height:18px;white-space:pre-wrap;word-break:break-word}
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
      model: {
        contentParts,
        branchBoundary,
        turnStatusOf,
        clockText,
        branchFrom,
        editInChild,
        forkAt,
        forkAndContinue,
        forkPoints,
        groupPointsByTurn,
        pointsByNodeKey,
        withKeepSeq,
        closingMessageId,
        publishOpener,
        createStepsAction,
        describePoint,
        toolFailure,
        PointDialog,
      },
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
        ctx.effect(
          () => ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
            name: 'conversation.chat.turnTail',
            id: 'rewind-fork-point',
            order: 30,
            locale: NS,
          }, createForkPointTail(ctx))),
          'rewind fork point',
        );
        ctx.effect(
          () => ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
            name: 'conversation.chat.assistant-actions',
            id: 'rewind-steps',
            order: 20,
            locale: NS,
            inject: (sessionId) => ({ rewindSessionId: sessionId }),
          }, createStepsAction())),
          'rewind steps action',
        );
      },
    };
  },
});
