// Speed and token figures of the chat HUD. Plain functions, no React.
const SPEED_WINDOW_MS = 30_000;

/**
 * Tokens per second: the tokens of LLM replies written in the last 30 s of this turn, divided
 * by that time. At the start of a turn the window is the time since the turn began (at least 5 s),
 * so the first reply does not read as a spike. An idle session has speed 0.
 */
export function tokenSpeed(detail, now, running) {
  if (!running || !Array.isArray(detail?.recent)) return 0;
  const turnStart = detail.turns?.at(-1)?.t ?? 0;
  const from = Math.max(now - SPEED_WINDOW_MS, turnStart);
  const tokens = detail.recent.reduce((sum, r) => (r.t >= from && r.t <= now ? sum + r.tokens : sum), 0);
  return tokens / (Math.max(now - from, 5000) / 1000);
}

const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const compactTokens = (n) => COMPACT.format(Math.round(n)).toLowerCase();
