import React, { memo, useMemo } from 'react';
import { buildSectorGeometry } from './sector-track.js';

const MONO = "ui-monospace,'SF Mono',Menlo,monospace";
// The map is drawn on a 248 x 178 plane. The compact HUD shows a 200 x 126 window of it,
// centred on the car, in a 152 x 96 box.
const PLANE = { w: 248, h: 178 };
const WINDOW = { w: 200, h: 126 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function viewBoxFor(car) {
  const cx = car ? Number(car.bodyX) : PLANE.w / 2;
  const cy = car ? Number(car.bodyY) : PLANE.h / 2;
  const x = clamp(cx - WINDOW.w / 2, 0, PLANE.w - WINDOW.w);
  const y = clamp(cy - WINDOW.h / 2, 0, PLANE.h - WINDOW.h);
  return `${x.toFixed(1)} ${y.toFixed(1)} ${WINDOW.w} ${WINDOW.h}`;
}

// The track only changes when the session record or the run state changes, not on every
// speed tick, so it is a separate memoized part.
const Track = memo(function Track({ session, live }) {
  const g = useMemo(() => buildSectorGeometry(session, { running: live }), [session, live]);
  return (
    <svg className="tj-hud-svg" viewBox={viewBoxFor(g.car)} width="152" height="96" aria-hidden="true">
      {g.hasTrack ? (
        <>
          {g.gravel.map((gr) => (
            <polygon key={gr.key} points={gr.points} fill="var(--hud-red, #ff453a)" fillOpacity="0.18" />
          ))}
          <polygon points={g.topTodoPoints} fill="var(--hud-road-todo, #2c2c2e)" />
          {g.topDonePoints ? <polygon points={g.topDonePoints} fill="var(--hud-road-done, #dcdce0)" /> : null}
          {g.kerbs.map((k) => (
            <path key={k.key} d={k.d} fill="none" stroke="#8e8e93" strokeWidth="2" strokeDasharray="3 3" />
          ))}
          <path d={g.centerLineD} fill="none" stroke="#636366" strokeWidth="1.2" strokeDasharray="3 4" strokeLinecap="round" />
          {g.corners.map((c) => (
            <text key={c.label} x={c.x} y={c.y} textAnchor="middle" fill="#8e8e93" fontSize="12" fontFamily={MONO}>{c.label}</text>
          ))}
          {g.gravel.map((gr) => (
            <path key={gr.key} d={gr.marker.d} fill="var(--hud-red, #ff453a)" />
          ))}
          {g.yellowFlag ? (
            <g>
              <line x1={g.yellowFlag.x1} y1={g.yellowFlag.y1} x2={g.yellowFlag.x2} y2={g.yellowFlag.y2} stroke="#c7c7cc" strokeWidth="1.2" strokeLinecap="round" />
              <path d={g.yellowFlag.clothD} fill="var(--hud-amber, #ffb340)" />
            </g>
          ) : null}
          {g.car ? (
            <g>
              <circle id="car-halo" cx={g.car.bodyX} cy={g.car.bodyY} r="8" fill="none" stroke="var(--hud-red, #ff453a)" strokeOpacity="0.5" strokeWidth="1.5" />
              <g transform={`translate(${g.car.bodyX},${g.car.bodyY}) rotate(${g.car.angle})`}>
                <rect x="-7" y="-4" width="14" height="8" rx="4" fill="var(--hud-red, #ff453a)" />
                <circle cx="2.5" cy="0" r="1.5" fill="#141416" />
              </g>
            </g>
          ) : null}
        </>
      ) : null}
    </svg>
  );
});

export function SectorCam({
  session,
  live = false,
  statusLabel,
  title = '',
  totalLabel = '',
  metricValue,
  metricUnit,
  turnLine = '',
  conditions = [],
}) {
  const visibleConditions = Array.isArray(conditions) ? conditions.slice(0, 2) : [];

  return (
    <section className="tj-hud" aria-label="Sector Cam" title={title}>
      <div className="tj-hud-badge">
        <span className={live ? 'tj-hud-dot live' : 'tj-hud-dot'} />
        <span className="tj-hud-status">{statusLabel}</span>
        {totalLabel ? <span className="tj-hud-total">{totalLabel}</span> : null}
      </div>
      <Track session={session} live={live} />
      <div className="tj-hud-strip">
        <div className="tj-hud-speed">
          <b>{metricValue}</b>
          {metricUnit ? <span>{metricUnit}</span> : null}
        </div>
        <div className="tj-hud-strip-bottom">
          <div className="tj-hud-sector">{turnLine || '—'}</div>
          <div className="tj-hud-conds">
            {visibleConditions.map((c, idx) => (
              <span key={idx} title={c.text}>
                <b className={c.tone}>{c.tone === 'red' ? '▲' : '⚑'}</b>{c.short ?? ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export default SectorCam;
