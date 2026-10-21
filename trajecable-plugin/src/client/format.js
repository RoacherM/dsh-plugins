// Small locale-aware formatters for the timeline page.

const localeOf = (lang) => (lang === 'zh' ? 'zh-CN' : 'en-US');
const pad = (n) => String(n).padStart(2, '0');

export function formatNumber(lang, value) {
  return new Intl.NumberFormat(localeOf(lang)).format(value ?? 0);
}

export function formatTime(lang, ms) {
  if (!ms) return '';
  return new Intl.DateTimeFormat(localeOf(lang), { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
}

export function dayTitle(lang, date, t, now = Date.now()) {
  if (date === dayKey(now)) return t('today');
  if (date === dayKey(now - 86_400_000)) return t('yesterday');
  return new Intl.DateTimeFormat(localeOf(lang), { month: 'short', day: 'numeric' }).format(dayDate(date));
}

export function weekday(lang, date) {
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: 'short' }).format(dayDate(date)).toUpperCase();
}

export function formatDayDate(lang, date) {
  return new Intl.DateTimeFormat(localeOf(lang), { month: '2-digit', day: '2-digit' }).format(dayDate(date));
}

export function dayRelative(date, t, now = Date.now()) {
  if (date === dayKey(now)) return t('today');
  if (date === dayKey(now - 86_400_000)) return t('yesterday');
  return '';
}

export function formatDateTimeShort(lang, ms) {
  if (!ms) return '';
  const datePart = new Intl.DateTimeFormat(localeOf(lang), { month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const timePart = formatTime(lang, ms);
  return `${datePart} · ${timePart}`;
}

export function formatCompactDuration(start, end) {
  const ms = Math.max(0, (end || start || 0) - (start || 0));
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${pad(rest)}`;
}

export function dayKey(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayDate(date) {
  const [year, month, day] = String(date).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function fromForRange(range, now = Date.now()) {
  if (range === 'all') return 0;
  const days = { today: 0, '1d': 0, '7d': 6, '30d': 29, '90d': 89 }[range] ?? 6;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start.getTime();
}

export function duration(lang, start, end, t) {
  const ms = Math.max(0, (end || 0) - (start || 0));
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return t('lessThanMinute');
  if (minutes < 60) return t('minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? t('hoursMinutes', { h: hours, m: rest }) : t('hours', { h: hours });
}

export function relativeTime(lang, ms, t, now = Date.now()) {
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return t('justNow');
  if (diff < 3_600_000) return t('minutesAgo', { n: Math.max(1, Math.round(diff / 60_000)) });
  if (diff < 86_400_000) return t('hoursAgo', { n: Math.round(diff / 3_600_000) });
  if (diff < 7 * 86_400_000) return t('daysAgo', { n: Math.round(diff / 86_400_000) });
  return new Intl.DateTimeFormat(localeOf(lang), { month: 'short', day: 'numeric' }).format(new Date(ms));
}

export function shortPath(cwd, max = 48) {
  if (!cwd) return '';
  const value = String(cwd).replace(/^\/Users\/[^/]+/, '~').replace(/^\/private\//, '/');
  return value.length > max ? `…${value.slice(-max)}` : value;
}

export function fileLabel(path) {
  const parts = String(path).split('/').filter(Boolean);
  return parts.slice(-2).join('/') || String(path);
}

/** True when one string is just a truncation of the other, so the page does not repeat it. */
export function sameOpening(a, b) {
  const left = String(a ?? '').slice(0, 24).trim();
  const right = String(b ?? '').slice(0, 24).trim();
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

export const AGENT_BADGE = {
  dsh: 'DS',
  claude: 'CC',
  codex: 'CX',
  pi: 'PI',
  epi: 'EP',
  grok: 'GK',
  antigravity: 'AG',
};

export const AGENT_DOT = {
  dsh: '#ff453a',
  claude: '#ff9f0a',
  codex: '#30d158',
  pi: '#64d2ff',
  epi: '#bf5af2',
  grok: '#ffd60a',
  antigravity: '#98989d',
};

export function gradeFor(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return '—';
  if (score >= 90) return 'A';
  if (score >= 82) return 'A-';
  if (score >= 76) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export function agentLabel(agent, t) {
  return t(`agent_${agent || 'dsh'}`);
}

export function sessionStartMs(s) {
  return s?.start ?? s?.startedAt ?? s?.end ?? 0;
}

export function sessionTitle(s, t) {
  return s?.title || s?.firstPrompt || projectName(s, t);
}

export function projectName(s, t) {
  if (s?.project) return s.project;
  if (s?.cwd) {
    const parts = String(s.cwd).split('/').filter(Boolean);
    return parts[parts.length - 1] || t('noProject');
  }
  return t('noProject');
}

export function shortId(s) {
  const raw = String(s?.id || s?.key || '').replace(/^[^:]+:/, '');
  return raw ? `#${raw.slice(0, 6)}` : '—';
}

export function fmtTime(ms, activeLocale = 'zh-CN', tz) {
  if (!ms) return '—';
  try {
    return new Intl.DateTimeFormat(activeLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...(tz ? { timeZone: tz } : {}),
    }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
  }
}

export function fmtShortDate(ms, activeLocale = 'zh-CN', tz) {
  if (!ms) return '—';
  try {
    return new Intl.DateTimeFormat(activeLocale, {
      month: '2-digit',
      day: '2-digit',
      ...(tz ? { timeZone: tz } : {}),
    }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(ms));
  }
}

export function dayHeading(dateStr, activeLocale = 'zh-CN', tz, t) {
  if (!dateStr) return '';
  const d = dayDate(dateStr);
  const md = new Intl.DateTimeFormat(activeLocale, { month: '2-digit', day: '2-digit' }).format(d);
  const wk = new Intl.DateTimeFormat(activeLocale, { weekday: 'short' }).format(d).toUpperCase();
  const rel = dayRelative(dateStr, t);
  return `${md} ${wk}${rel ? ` · ${rel}` : ''}`;
}

export function fmtDuration(start, end, t) {
  return duration('zh', start, end, t);
}

export function closedSummary(s, ai, t) {
  if (s?.agent === 'antigravity') return '—';
  const total = ai?.completion?.total ?? (Array.isArray(ai?.problems) ? ai.problems.length : 0);
  const solved = ai?.completion?.solved ?? (Array.isArray(ai?.problems) ? ai.problems.filter((p) => p.status === 'solved').length : 0);
  if (total > 0) return t('closedRatio', { solved, total });
  if (ai && typeof ai.score === 'number') return t(`state_${ai.state || 'done'}`);
  return t('scoreUnrated');
}

export function commentLead(s, ai, t) {
  if (s?.agent === 'antigravity') {
    return { text: t('antigravityMeta'), tone: '' };
  }
  if (!ai) {
    const p = s?.promptCount ?? s?.prompts ?? 0;
    const f = s?.fileCount ?? s?.files ?? 0;
    const ts = s?.tests ?? 0;
    return {
      text: `${t('scoreUnrated')} · ${t('sessionPrompts', { n: p })} · ${t('sessionFiles', { n: f })} · ${t('sessionTests', { n: ts })}`,
      tone: '',
    };
  }
  const tone = ai?.comment?.tone === 'bad' ? 'bad' : (ai?.comment?.tone === 'watch' ? 'warn' : '');
  const verdict = ai?.comment?.verdict || '';
  const judgement = ai?.comment?.judgement || ai?.summary || '';
  const text = [verdict, judgement].filter(Boolean).join(' · ') || closedSummary(s, ai, t);
  return { text, tone };
}

export function hudConditions(s, ai, t) {
  if (!s || s.agent === 'antigravity' || !ai) return [];
  const conds = [];
  const openCount = ai?.completion?.openCount
    ?? ((ai?.completion?.total ?? 0) - (ai?.completion?.solved ?? 0));
  if (openCount > 0) {
    conds.push({ kind: 'flag', label: t('hudCondOpen', { n: openCount }) });
  } else if (ai?.state === 'ongoing') {
    conds.push({ kind: 'flag', label: t('hudCondWatch') });
  }
  const errs = (s.errors ?? 0) + (s.testFails ?? 0);
  if (errs > 0) {
    conds.push({ kind: 'warn', label: t('hudCondErrors', { n: errs }) });
  } else {
    const detours = Array.isArray(ai?.decisions) ? ai.decisions.filter((d) => d.type === 'detour').length : 0;
    if (detours > 0) conds.push({ kind: 'warn', label: t('hudCondDetours', { n: detours }) });
  }
  return conds;
}
