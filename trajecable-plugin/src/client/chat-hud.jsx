/**
 * Live Sector Cam in the chat view: a small toggle in the session header, and the
 * 248 x 264 HUD floating under the header's right edge (docs/scoring-and-live.md).
 * It shows counts only (user turns, LLM replies, tool calls, failures, tokens); no model is asked.
 * The big number is the speed: tokens per second over the last SPEED_WINDOW_MS of this turn.
 * It re-reads the session record whenever the live chat gains a user message, an LLM step,
 * a tool call or a tool result (DSH's useChat store), so the HUD follows the chat at once.
 * Without useChat (preview, tests) it falls back to reading every POLL_MS while a turn runs.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, browserZone } from './api.js';
import { agentLabel, formatDateTimeShort } from './format.js';
import { useI18n, withI18n } from './i18n.jsx';
import { SectorCam } from './SectorCam.jsx';
import { compactTokens, tokenSpeed } from './hud-speed.js';
import { anchorFor } from './hud-anchor.js';

const OPEN_KEY = 'local-trajecable:chat-hud-open';
const POLL_MS = 2000;
const notRunning = () => false;

/** Re-render once a second while `active`, so the speed decays between replies. */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** A string that changes when the chat gains a user message, LLM step, tool call or tool result. */
export function chatSignal(snapshot) {
  let users = 0, steps = 0, tools = 0, results = 0;
  for (const node of snapshot?.nodes?.values?.() ?? []) {
    if (node.kind === 'user') users += 1;
    else if (node.kind === 'assistant-step') steps += 1;
    else if (node.kind === 'tool-call') {
      tools += 1;
      if (node.data?.root?.kind === 'tool-result') results += 1;
    }
  }
  return `${users}:${steps}:${tools}:${results}`;
}

const noChat = () => '';

function readOpen() {
  try { return window.localStorage.getItem(OPEN_KEY) !== '0'; } catch { return true; }
}

function writeOpen(open) {
  try { window.localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* storage blocked: keep the in-memory choice */ }
}

function hudConditions(turn, running, t) {
  const conds = [];
  if (turn?.errors > 0) conds.push({ tone: 'red', text: t('hudCondErrors', { n: turn.errors }), short: `${turn.errors}` });
  if (turn && !running) conds.push({ tone: 'amber', text: t('hudCondWaiting') });
  return conds;
}

function ancestors(el) {
  const out = [];
  for (let node = el; node && node !== document.body && node !== document.documentElement; node = node.parentElement) out.push(node);
  return out;
}

/**
 * Keep the HUD in its corner. The header moves when a side panel opens or the sidebar
 * collapses, without any window resize, so the button's ancestors and their neighbours are
 * observed too. At most one measurement per frame; the state changes only when the place does.
 */
function useAnchor(ref, active) {
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const button = ref.current;
    if (!active || !button) return undefined;
    const chain = ancestors(button);
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = anchorFor(chain.map((el) => el.getBoundingClientRect()));
      setPos((prev) => (prev?.top === next?.top && prev?.left === next?.left ? prev : next));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    for (const el of chain) {
      observer?.observe(el);
      for (const sibling of el.parentElement?.children ?? []) if (sibling !== el) observer?.observe(sibling);
    }
    window.addEventListener('resize', schedule);
    // Capture: a scroll or a finished sidebar transition anywhere can move the header.
    document.addEventListener('scroll', schedule, true);
    document.addEventListener('transitionend', schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
      document.removeEventListener('transitionend', schedule, true);
    };
  }, [ref, active]);
  return pos;
}

function ChatHud({ sessionId, useSessionStatus = notRunning, useChat }) {
  const { lang, t } = useI18n();
  const running = useSessionStatus((s) => (sessionId === undefined ? false : s?.get?.(sessionId)?.running === true));
  const signal = (useChat ?? noChat)(chatSignal);
  const [open, setOpen] = useState(readOpen);
  const [record, setRecord] = useState({ id: null, session: null, missing: false });
  const buttonRef = useRef(null);
  const pos = useAnchor(buttonRef, open);

  // Read on session change, when a turn starts or ends, and on every chat signal change.
  // Only one read is in flight at a time; a signal during it causes one more read after it,
  // so a burst of steps costs at most two reads. Only a session change aborts.
  const reads = useRef({ busy: false, again: false, controller: null });
  useEffect(() => {
    if (sessionId === undefined) return undefined;
    const controller = new AbortController();
    reads.current = { busy: false, again: false, controller };
    return () => controller.abort();
  }, [sessionId]);
  useEffect(() => {
    const state = reads.current;
    const { controller } = state;
    if (sessionId === undefined || !controller) return undefined;
    const read = () => {
      if (state.busy) { state.again = true; return; }
      state.busy = true;
      api.session(`dsh:${sessionId}`, browserZone(), controller.signal)
        .then((data) => setRecord({ id: sessionId, session: data, missing: false }))
        .catch(() => { if (!controller.signal.aborted) setRecord({ id: sessionId, session: null, missing: true }); })
        .finally(() => {
          state.busy = false;
          if (state.again && !controller.signal.aborted) { state.again = false; read(); }
        });
    };
    read();
    // Without useChat (preview, tests) fall back to a timer while the turn runs.
    const timer = running && !useChat ? setInterval(read, POLL_MS) : undefined;
    return () => clearInterval(timer);
  }, [sessionId, running, signal, useChat]);

  const now = useNow(open && running);

  if (sessionId === undefined) return null;
  const current = record.id === sessionId ? record : { session: null, missing: false };
  const detail = current.session;
  const session = detail ?? { key: `dsh:${sessionId}`, agent: 'dsh', id: sessionId };
  // A host older than 0.7.0 returns records without token counts until DSH restarts.
  const counted = Array.isArray(detail?.turns) && typeof detail?.tokens === 'number';
  const turn = detail?.turns?.at(-1);
  const when = detail?.end ? formatDateTimeShort(lang, detail.end) : '';
  const state = running ? t('hudLive') : t('hudIdle');
  const toggle = () => setOpen((v) => { writeOpen(!v); return !v; });
  const label = open ? t('hudHide') : t('hudShow');

  const panel = open && pos ? createPortal(
    <div className="tj-chat-hud" style={{ top: pos.top, left: pos.left }}>
      <SectorCam
        session={session}
        live={running}
        statusLabel={state}
        // The narrow HUD keeps the model, time and tool count in the hover text.
        title={[
          detail?.model || agentLabel('dsh', t),
          when,
          turn ? t('hudTurnLine', { n: turn.n, llm: turn.llm, tools: turn.tools }) : '',
        ].filter(Boolean).join('\n')}
        totalLabel={counted ? t('hudTotal', { n: compactTokens(detail.tokens) }) : ''}
        metricValue={counted ? compactTokens(tokenSpeed(detail, now, running)) : '—'}
        metricUnit={counted ? t('hudSpeedUnit') : ''}
        turnLine={current.missing ? t('notIndexed') : detail && !counted ? t('hudOldHost') : turn
          ? t('hudTurnShort', { n: turn.n, llm: turn.llm })
          : ''}
        conditions={hudConditions(turn, running, t)}
      />
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={open ? 'tj-chat-hud-btn on' : 'tj-chat-hud-btn'}
        aria-pressed={open}
        aria-label={label}
        title={label}
        onClick={toggle}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 21V4" /><path d="M4 4h13l-2.5 4L17 12H4" />
        </svg>
      </button>
      {panel}
    </>
  );
}

export function makeChatHud({ locale }) {
  return withI18n(locale, ChatHud);
}
