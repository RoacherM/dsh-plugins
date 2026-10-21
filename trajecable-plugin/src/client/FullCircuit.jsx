import React, { useMemo } from 'react';
import { buildCircuit, VIEW } from './circuit.js';

const TONE = { good: '#30d158', watch: '#ffd60a', bad: '#ff453a' };

// The whole lap of one session on the Trajectory page. Dark monitor in both themes.
export function FullCircuit({ session, ai, prompts, label, status, t }) {
  const c = useMemo(() => buildCircuit(session, ai, prompts), [session, ai, prompts]);
  if (!c) return null;
  const color = TONE[ai?.comment?.tone] ?? '#f5f5f7';
  const labelEvery = c.stops.length > 12 ? 0 : 1;
  return (
    <section className="tj-circuit" aria-label={label}>
      <div className="tj-circuit-head"><span>{label}</span><span>{status}</span></div>
      <svg className="tj-circuit-svg" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true">
        <path d={c.loopD} className="tj-c-road" />
        {c.todoD ? <path d={c.todoD} className="tj-c-todo" /> : null}
        {c.drivenD ? <path d={c.drivenD} className="tj-c-driven" style={{ stroke: color }} /> : null}
        <path d={c.finishD} className="tj-c-finish" />
        {c.sectorTicks.map((s) => (
          <g key={s.label}>
            <path d={s.d} className="tj-c-tick" />
            <text x={s.lx} y={s.ly} className="tj-c-ticklabel">{s.label}</text>
          </g>
        ))}
        {c.stops.map((s, i) => (
          <g key={`${s.n}-${s.t}`}>
            <circle cx={s.x} cy={s.y} r={i === 0 ? 4 : 3.2} className={i === 0 ? 'tj-c-stop first' : 'tj-c-stop'}>
              <title>{`P${s.n} · ${s.text.slice(0, 120)}`}</title>
            </circle>
            {labelEvery || i === 0 || i === c.stops.length - 1 ? (
              <text x={s.x} y={Number(s.y) - 7} className="tj-c-stoplabel">{s.n}</text>
            ) : null}
          </g>
        ))}
        {c.car ? (
          <g transform={`translate(${c.car.x} ${c.car.y}) rotate(${c.car.angle})`}>
            <circle r="9" fill={color} opacity="0.16" />
            <path d="M-5,-3.2 L5,0 L-5,3.2 Z" fill={color} stroke="#141416" strokeWidth="0.8" />
          </g>
        ) : null}
        <g transform={`translate(${VIEW.w - 16} 20)`} className="tj-c-north">
          <path d="M0,-8 L4.5,3 L0,0.5 L-4.5,3 Z" />
          <text y="14">N</text>
        </g>
      </svg>
      <div className="tj-circuit-legend">
        <span><i className="solid" style={{ background: color }} />{t('legendDone')}</span>
        <span><i className="dash" />{t('legendTodo')}</span>
        <span><i className="dot" />{t('legendStop')}</span>
        <b>{c.lap === null ? t('lapUnknown') : t('lap', { n: Math.round(c.lap * 100) })}</b>
      </div>
    </section>
  );
}

export default FullCircuit;
