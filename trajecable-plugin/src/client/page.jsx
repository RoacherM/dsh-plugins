/**
 * Race Log page (docs/race-log-redesign.md): 56 px header, 96 px season strip,
 * 72 px session rows grouped by day, and a rail with the full circuit of the
 * selected session. The small Sector Cam lives in the chat header (chat-hud.jsx).
 * Only the selected session is drawn; rows draw no SVG.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, browserZone } from './api.js';
import {
  AGENT_BADGE,
  agentLabel,
  dayRelative,
  formatCompactDuration,
  formatDateTimeShort,
  formatDayDate,
  formatTime,
  fromForRange,
  gradeFor,
  projectName,
  sessionStartMs,
  sessionTitle,
  weekday,
} from './format.js';
import { useI18n, withI18n } from './i18n.jsx';
import { FullCircuit } from './FullCircuit.jsx';

const RANGES = ['today', '7d', '30d', 'all'];
const AGENT_IDS = ['dsh', 'claude', 'codex', 'pi', 'epi', 'grok', 'antigravity'];
const AUTO_SUMMARIZE = 6;
const BATCH_SUMMARIZE = 30;
// Rows rendered per step. 72 px rows keep 200 rows cheap; more come on demand.
const ROW_STEP = 200;
const SCAN_POLL_MS = 2000;

const isScored = (session, ai) => session?.agent !== 'antigravity' && typeof ai?.score === 'number';

function flattenSessions(day) {
  const list = Array.isArray(day.sessions) ? day.sessions : (day.projects ?? []).flatMap((p) => p.sessions ?? []);
  return [...list].sort((a, b) => (b.end ?? sessionStartMs(b)) - (a.end ?? sessionStartMs(a)));
}

function gateText(ai, t) {
  const total = ai?.completion?.total ?? 0;
  if (total > 0) return t('closedRatio', { solved: ai.completion.solved ?? 0, total });
  return ai?.state ? t(`state_${ai.state}`) : '';
}

const STOPS_SHOWN = 6;
const NO_PROMPTS = [];

function decisionTone(d) {
  if (d.type === 'detour') return 'red';
  return d.by === 'user' ? 'amber' : 'blue';
}

function SeasonSpark({ points, selectedKey, average, onSelect }) {
  const W = 260;
  const H = 54;
  const y = (score) => 6 + ((100 - Math.max(40, Math.min(100, score))) / 60) * (H - 12);
  const x = (i) => (points.length <= 1 ? W / 2 : 6 + (i / (points.length - 1)) * (W - 12));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  return (
    <svg className="tj-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {average !== null ? <line x1="0" x2={W} y1={y(average)} y2={y(average)} className="tj-spark-avg" /> : null}
      {points.length > 1 ? <path d={line} className="tj-spark-line" /> : null}
      {points.map((p, i) => (
        <circle
          key={p.key}
          cx={x(i)}
          cy={y(p.score)}
          r={p.key === selectedKey ? 4 : 3}
          className={p.key === selectedKey ? 'tj-spark-dot sel' : 'tj-spark-dot'}
          onClick={() => onSelect(p.key)}
        />
      ))}
    </svg>
  );
}

const SessionRow = memo(function SessionRow({ session, ai, selected, busy, lang, t, onSelect, onSummarize }) {
  const start = sessionStartMs(session);
  const scored = isScored(session, ai);
  const antigravity = session.agent === 'antigravity';
  const comment = antigravity
    ? t('antigravityMeta')
    : ai
      ? [ai.comment?.verdict, ai.comment?.judgement || ai.summary].filter(Boolean).join(' · ') || gateText(ai, t)
      : `${t('scoreUnrated')} · ${t('sessionPrompts', { n: session.promptCount ?? 0 })} · ${t('sessionFiles', { n: session.fileCount ?? 0 })}`;
  const tone = ai?.comment?.tone;
  const meta = [projectName(session, t), session.model].filter(Boolean).join(' · ');
  return (
    <div
      role="button"
      tabIndex={0}
      className={selected ? 'tj-row sel' : 'tj-row'}
      aria-pressed={selected}
      onClick={() => onSelect(session.key)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(session.key); } }}
    >
      <div className="tj-row-time"><b>{formatTime(lang, start)}</b>{formatCompactDuration(start, session.end)}</div>
      <div className="tj-row-agent" title={agentLabel(session.agent, t)}>{AGENT_BADGE[session.agent] ?? 'AG'}</div>
      <div className="tj-row-body">
        <div className="tj-row-title">{sessionTitle(session, t)}<span>{meta}</span></div>
        <div className="tj-row-comment">
          {tone === 'watch' ? <i className="amber">⚑</i> : tone === 'bad' ? <i className="red">▲</i> : null}
          {comment}
        </div>
      </div>
      <div className="tj-row-score">
        {scored ? (
          <>{ai.score}<span>{ai.grade || gradeFor(ai.score)}</span></>
        ) : antigravity ? (
          <>—</>
        ) : (
          <button
            type="button"
            className="tj-row-sum"
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); onSummarize(session.key); }}
          >
            {busy ? t('summarizing') : t('summarize')}
          </button>
        )}
      </div>
    </div>
  );
});

function Rail({ session, ai, prompts, busy, lang, t, onSummarize, onOpen }) {
  if (!session) {
    return (
      <aside className="tj-rail">
        <div className="tj-rail-head"><span>{t('circuit')}</span><span>—</span></div>
        <p className="tj-rail-empty">{t('noSelection')}</p>
      </aside>
    );
  }
  const antigravity = session.agent === 'antigravity';
  const scored = isScored(session, ai);
  const start = sessionStartMs(session);
  const when = formatDateTimeShort(lang, start);
  const status = antigravity ? '—' : !scored ? t('hudUnscored') : session.ongoing ? t('hudLive') : t('hudFinal');
  const tone = ai?.comment?.tone ?? 'watch';
  const colon = lang === 'zh' ? '：' : ': ';
  const decisions = Array.isArray(ai?.decisions) ? ai.decisions : [];
  const stops = prompts ?? NO_PROMPTS;
  return (
    <aside className="tj-rail" aria-live="polite">
      {antigravity ? (
        <div className="tj-rail-head"><span>{t('circuit')}</span><span>{when}</span></div>
      ) : (
        <FullCircuit session={session} ai={ai} prompts={stops} label={t('circuit')} status={`${status} · ${when}`} t={t} />
      )}
      <div className="tj-rail-title">{sessionTitle(session, t)}</div>
      <div className="tj-rail-meta">
        {[projectName(session, t), agentLabel(session.agent, t), session.model, session.branch].filter(Boolean).join(' · ')}
      </div>
      <div className="tj-rail-score">
        <b>{scored ? ai.score : '—'}</b>
        <span>{scored ? (ai.grade || gradeFor(ai.score)) : ''}</span>
        <div className="tj-rail-gate">
          {scored && ai.state !== 'done' ? <em>{t('tempScore')} · {t(`state_${ai.state}`)}</em> : null}
          {scored ? gateText(ai, t) : (antigravity ? '' : t('scoreUnrated'))}
        </div>
      </div>
      <div className={`tj-rail-comment ${tone}`}>
        {antigravity ? (
          <p>{t('antigravityMeta')}</p>
        ) : ai ? (
          <>
            <p><b>{ai.comment?.verdict || t(`tone_${tone}`)}</b> {ai.comment?.judgement || ai.summary || ''}</p>
            {ai.comment?.advice ? <p className="sub">{t('advice')}{colon}{ai.comment.advice}</p> : null}
            {ai.comment?.risk ? <p className="sub">{t('risk')}{colon}{ai.comment.risk}</p> : null}
          </>
        ) : (
          <p className="sub">{t('noComment')}</p>
        )}
      </div>
      {stops.length ? (
        <div className="tj-rail-list">
          <div className="tj-kicker">{t('stops')}</div>
          <ol>
            {stops.slice(0, STOPS_SHOWN).map((p, i) => (
              <li key={`${i}-${p.t}`}><span>P{i + 1} · {formatTime(lang, p.t)}</span>{p.text}</li>
            ))}
          </ol>
          {stops.length > STOPS_SHOWN ? <p className="tj-rail-more">{t('stopsMore', { n: stops.length - STOPS_SHOWN })}</p> : null}
        </div>
      ) : null}
      {decisions.length ? (
        <div className="tj-rail-list">
          <div className="tj-kicker">{t('decisionsTitle')}</div>
          <ol>
            {decisions.map((d, i) => (
              <li key={i} className={decisionTone(d)}>
                <span>{d.by === 'user' ? t('byUser') : t('byAgent')}{d.type === 'detour' ? ` · ${t('decisionDetour')}` : ''}</span>
                {d.title}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="tj-rail-actions">
        {!scored ? (
          <button type="button" className="tj-rail-btn" disabled={antigravity || busy} onClick={() => onSummarize(session.key)}>
            {busy ? t('summarizing') : t('summarize')}
          </button>
        ) : null}
        <button
          type="button"
          className="tj-rail-btn"
          disabled={session.agent !== 'dsh' || !session.id}
          onClick={() => onOpen(session.id)}
        >
          <span>{t('openSession')}</span><span aria-hidden="true">↗</span>
        </button>
      </div>
    </aside>
  );
}

function Page({ openSession }) {
  const { lang, t } = useI18n();
  const tz = useMemo(() => browserZone(), []);

  const [range, setRange] = useState('7d');
  const [agent, setAgent] = useState('');
  const [project, setProject] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [timeline, setTimeline] = useState(null);
  const [scan, setScan] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summaries, setSummaries] = useState({});
  const [busy, setBusy] = useState(() => new Set());
  const [batch, setBatch] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [rowLimit, setRowLimit] = useState(ROW_STEP);
  const [stops, setStops] = useState({ key: null, prompts: [] });
  const autoTried = useRef(new Set());
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const to = Date.now();
    api.timeline({ range, from: fromForRange(range, to), to, tz, agent, project, q: query }, controller.signal)
      .then((data) => {
        setTimeline(data);
        setScan(data.scan ?? null);
        setError(null);
        setRowLimit(ROW_STEP);
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [range, agent, project, query, tz, refreshKey]);

  // Poll only while a scan runs; reload the timeline once it ends.
  const scanning = Boolean(scan?.scanning);
  useEffect(() => {
    if (!scanning) return undefined;
    const timer = setInterval(() => {
      api.status().then((status) => {
        setScan(status.scan ?? null);
        if (!status.scan?.scanning) setRefreshKey((k) => k + 1);
      }).catch((err) => setError(err.message));
    }, SCAN_POLL_MS);
    return () => clearInterval(timer);
  }, [scanning]);

  const aiFor = useCallback((session) => summaries[session.key] ?? session.ai ?? null, [summaries]);

  const days = useMemo(
    () => (timeline?.days ?? []).map((day) => ({ date: day.date, sessions: flattenSessions(day) })).filter((d) => d.sessions.length),
    [timeline],
  );
  const sessions = useMemo(() => days.flatMap((d) => d.sessions), [days]);

  useEffect(() => {
    if (!sessions.length) { setSelectedKey(null); return; }
    setSelectedKey((key) => (sessions.some((s) => s.key === key) ? key : sessions[0].key));
  }, [sessions]);

  // Only the selected session's prompts are kept; switching drops the previous ones.
  useEffect(() => {
    if (!selectedKey || selectedKey.startsWith('antigravity:')) { setStops({ key: selectedKey, prompts: NO_PROMPTS }); return undefined; }
    const controller = new AbortController();
    api.session(selectedKey, tz, controller.signal)
      .then((data) => {
        const prompts = (data?.prompts ?? []).map((p) => ({ t: p.t, text: String(p.text ?? '').slice(0, 200) }));
        setStops({ key: selectedKey, prompts });
      })
      .catch(() => { if (!controller.signal.aborted) setStops({ key: selectedKey, prompts: NO_PROMPTS }); });
    return () => controller.abort();
  }, [selectedKey, tz]);

  const summarize = useCallback(async (key, force = false) => {
    setBusy((prev) => new Set(prev).add(key));
    try {
      const result = await api.summary(key, tz, force);
      if (alive.current && result?.ai) setSummaries((prev) => ({ ...prev, [key]: result.ai }));
    } catch (err) {
      if (alive.current) setError(t('summaryError', { error: err.message }));
    } finally {
      if (alive.current) setBusy((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }, [tz, t]);

  const unscored = useMemo(
    () => sessions.filter((s) => s.agent !== 'antigravity' && !aiFor(s)),
    [sessions, aiFor],
  );

  useEffect(() => {
    const room = AUTO_SUMMARIZE - autoTried.current.size;
    if (room <= 0) return;
    const next = unscored.filter((s) => !autoTried.current.has(s.key)).slice(0, room);
    for (const s of next) {
      autoTried.current.add(s.key);
      summarize(s.key);
    }
  }, [unscored, summarize]);

  const summarizeAll = async () => {
    const targets = unscored.slice(0, BATCH_SUMMARIZE);
    setBatch({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i += 1) {
      await summarize(targets[i].key);
      if (!alive.current) return;
      setBatch({ done: i + 1, total: targets.length });
    }
    setBatch(null);
  };

  const startScan = async () => {
    try {
      const result = await api.scan();
      setScan(result.scan ?? null);
      if (!result.scan?.scanning) setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(t('scanFailed', { error: err.message }));
    }
  };

  const season = useMemo(() => {
    const scored = sessions.filter((s) => isScored(s, aiFor(s)));
    const average = scored.length ? Math.round(scored.reduce((sum, s) => sum + aiFor(s).score, 0) / scored.length) : null;
    const cleared = scored.filter((s) => aiFor(s).state === 'done').length;
    const points = scored.slice(0, 14).reverse().map((s) => ({ key: s.key, score: aiFor(s).score }));
    return { total: sessions.length, scored: scored.length, cleared, average, points };
  }, [sessions, aiFor]);

  const selected = sessions.find((s) => s.key === selectedKey) ?? null;
  const selectedAi = selected ? aiFor(selected) : null;
  const onOpen = useCallback((id) => openSession?.(id), [openSession]);

  let budget = rowLimit;
  const visibleDays = [];
  for (const day of days) {
    if (budget <= 0) break;
    visibleDays.push({ ...day, rows: day.sessions.slice(0, budget) });
    budget -= day.sessions.length;
  }
  const hiddenRows = Math.max(0, sessions.length - rowLimit);
  const indexedCount = timeline?.indexed?.sessions ?? 0;

  return (
    <div className="tj-race">
      <header className="tj-head">
        <div className="tj-brand">{t('title')} <span>/</span> <small>{t('raceControl')}</small></div>
        <div className="tj-seg" role="group" aria-label={t('filter')}>
          {RANGES.map((id) => (
            <button key={id} type="button" className={range === id ? 'on' : ''} aria-pressed={range === id} onClick={() => setRange(id)}>
              {t(`range_${id}`)}
            </button>
          ))}
        </div>
        <label className="tj-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input className="tj-search" type="search" placeholder={t('search')} aria-label={t('search')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </label>
        <div className="tj-filter-wrap">
          <button type="button" className={agent || project ? 'tj-filter-btn on' : 'tj-filter-btn'} aria-expanded={filterOpen} onClick={() => setFilterOpen((v) => !v)}>
            {t('filter')}
          </button>
          <div className="tj-filter-pop" hidden={!filterOpen}>
            <select className="tj-select" aria-label={t('allAgents')} value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="">{t('allAgents')}</option>
              {AGENT_IDS.map((id) => <option key={id} value={id}>{agentLabel(id, t)}</option>)}
            </select>
            <select className="tj-select" aria-label={t('allProjects')} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">{t('allProjects')}</option>
              {(timeline?.projects ?? []).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <div className="tj-filter-actions">
              <button type="button" className="tj-btn" disabled={scanning} onClick={startScan}>
                {scanning ? t('scanningShort') : t('scan')}
              </button>
              {unscored.length ? (
                <button type="button" className="tj-btn" disabled={Boolean(batch)} onClick={summarizeAll}>
                  {batch ? t('summarizeBusy', batch) : t('summarizeAll', { n: Math.min(unscored.length, BATCH_SUMMARIZE) })}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <span className="tj-head-status">{t('indexed', { n: indexedCount })}</span>
      </header>

      <div className="tj-workspace">
        <main className="tj-main">
          <section className="tj-season">
            <div className="tj-season-avg">
              <div className="tj-kicker">{t('season')} · {t(`range_${range}`)}</div>
              <div className="tj-season-score"><b>{season.average ?? '—'}</b><span>{season.average !== null ? gradeFor(season.average) : ''}</span></div>
            </div>
            <div className="tj-metric"><b>{season.total}</b><span>{t('sessions')}</span></div>
            <div className="tj-metric"><b>{season.scored}</b><span>{t('scoredShort')}</span></div>
            <div className="tj-metric"><b>{season.cleared}</b><span>{t('clearedShort')}</span></div>
            <SeasonSpark points={season.points} selectedKey={selectedKey} average={season.average} onSelect={setSelectedKey} />
          </section>

          {error ? (
            <div className="tj-error">
              <span>{t('loadFailed', { error })}</span>
              <button type="button" className="tj-btn" onClick={() => setRefreshKey((k) => k + 1)}>{t('retry')}</button>
            </div>
          ) : null}
          {timeline && !sessions.length ? (
            <div className="tj-empty"><h3>{t('emptyTitle')}</h3><p>{t('emptyHint')}</p></div>
          ) : null}

          {visibleDays.map((day) => {
            const scored = day.sessions.filter((s) => isScored(s, aiFor(s)));
            const dayScore = scored.length ? Math.round(scored.reduce((sum, s) => sum + aiFor(s).score, 0) / scored.length) : null;
            const relative = dayRelative(day.date, t);
            return (
              <section className="tj-day-group" key={day.date}>
                <div className="tj-day">
                  {formatDayDate(lang, day.date)} {weekday(lang, day.date)}
                  {relative ? <em>{relative}</em> : null}
                  <span>{t('groupSessions', { n: day.sessions.length })}{dayScore !== null ? ` · ${t('dayAvg', { n: dayScore })}` : ''}</span>
                </div>
                {day.rows.map((s) => (
                  <SessionRow
                    key={s.key}
                    session={s}
                    ai={aiFor(s)}
                    selected={s.key === selectedKey}
                    busy={busy.has(s.key)}
                    lang={lang}
                    t={t}
                    onSelect={setSelectedKey}
                    onSummarize={summarize}
                  />
                ))}
              </section>
            );
          })}
          {hiddenRows > 0 ? (
            <button type="button" className="tj-more" onClick={() => setRowLimit((n) => n + ROW_STEP)}>
              {t('showMore', { n: Math.min(hiddenRows, ROW_STEP) })}
            </button>
          ) : null}
        </main>

        <Rail
          session={selected}
          ai={selectedAi}
          prompts={stops.key === selectedKey ? stops.prompts : null}
          busy={selected ? busy.has(selected.key) : false}
          lang={lang}
          t={t}
          onSummarize={(key) => summarize(key, true)}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

export function makePage({ openSession, locale }) {
  const Localized = withI18n(locale, Page);
  return function TrajectoryPage(props) {
    return <Localized {...props} openSession={openSession} />;
  };
}

export default makePage;
