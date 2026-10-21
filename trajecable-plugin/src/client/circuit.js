// Full circuit of one session, seen from straight above, north up.
// The layout is a closed loop generated from the session key, so a session always
// gets the same track. The driven part is solid, the rest is dashed, and every
// user prompt is a stop on the driven part, placed by its time in the session.
import { hashKey } from './sector-track.js';

export const VIEW = { w: 310, h: 210, pad: 24 };
const MAX_STOPS = 24;

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Vertices sorted by angle around the centre always make a simple (non-crossing) loop.
// Some vertices pull in toward the centre, which gives hairpins and chicanes.
function vertices(key) {
  const rand = rng(hashKey(key) + 7);
  const n = 8 + Math.floor(rand() * 4);
  const cx = VIEW.w / 2;
  const cy = VIEW.h / 2;
  const rx = VIEW.w / 2 - VIEW.pad;
  const ry = VIEW.h / 2 - VIEW.pad;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = ((i + (rand() - 0.5) * 0.5) / n) * Math.PI * 2;
    const r = rand() < 0.22 ? 0.42 + rand() * 0.18 : 0.72 + rand() * 0.28;
    out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry]);
  }
  return out;
}

const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

// Round every vertex with a quadratic curve; the parts between curves stay straight.
function sampleLoop(vs) {
  const n = vs.length;
  const raw = [];
  for (let i = 0; i < n; i += 1) {
    const prev = vs[(i + n - 1) % n];
    const v = vs[i];
    const next = vs[(i + 1) % n];
    const a = lerp(v, prev, 0.36);
    const b = lerp(v, next, 0.36);
    for (let k = 0; k <= 10; k += 1) {
      const u = k / 10;
      const p = lerp(lerp(a, v, u), lerp(v, b, u), u);
      raw.push(p);
    }
  }
  raw.push(raw[0]);
  return raw;
}

function withDistance(raw) {
  const pts = [];
  let s = 0;
  raw.forEach((p, i) => {
    if (i) s += Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]);
    pts.push({ x: p[0], y: p[1], s });
  });
  return { pts, total: s };
}

// Start the lap in the middle of the longest straight, like a real start/finish line.
function rotateToLongestStraight(raw) {
  const loop = raw.slice(0, -1);
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > bestLen) { bestLen = len; best = i; }
  }
  const a = loop[best];
  const b = loop[(best + 1) % loop.length];
  const mid = lerp(a, b, 0.5);
  const order = [mid, ...loop.slice(best + 1), ...loop.slice(0, best + 1), mid];
  return order;
}

const f1 = (n) => n.toFixed(1);

function makeTrack(key) {
  const { pts, total } = withDistance(rotateToLongestStraight(sampleLoop(vertices(key))));
  const at = (s) => {
    const target = Math.max(0, Math.min(total, s));
    let i = 1;
    while (i < pts.length - 1 && pts[i].s < target) i += 1;
    const a = pts[i - 1];
    const b = pts[i];
    const k = b.s === a.s ? 0 : (target - a.s) / (b.s - a.s);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, h: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const path = (s0, s1) => {
    if (s1 <= s0) return '';
    const inner = pts.filter((p) => p.s > s0 && p.s < s1);
    return [at(s0), ...inner, at(s1)].map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)},${f1(p.y)}`).join('');
  };
  return { total, at, path };
}

function lapFraction(ai) {
  if (!ai || typeof ai.score !== 'number') return null;
  if (ai.state === 'done') return 1;
  const c = ai.completion;
  if (c?.total > 0) return Math.max(0.06, Math.min(1, (c.rate ?? (c.solved / c.total) * 100) / 100));
  return 0.5;
}

// Long sessions can have hundreds of prompts; keep the first, the last and an even spread.
function pickStops(prompts) {
  if (prompts.length <= MAX_STOPS) return prompts.map((p, i) => ({ ...p, n: i + 1 }));
  const out = [];
  for (let i = 0; i < MAX_STOPS; i += 1) {
    const idx = Math.round((i / (MAX_STOPS - 1)) * (prompts.length - 1));
    out.push({ ...prompts[idx], n: idx + 1 });
  }
  return out;
}

export function buildCircuit(session, ai, prompts = []) {
  if (!session || session.agent === 'antigravity') return null;
  const track = makeTrack(session.key);
  const lap = lapFraction(ai);
  const driven = lap === null ? 0 : lap * track.total;
  const span = lap === null ? track.total : driven;
  const start = session.start ?? 0;
  const length = Math.max(1, (session.end ?? start) - start);

  const stops = pickStops(prompts.filter((p) => p && typeof p.t === 'number')).map((p) => {
    const k = Math.max(0, Math.min(1, (p.t - start) / length));
    const pt = track.at(Math.min(span, track.total - 1) * k);
    return { n: p.n, t: p.t, text: p.text ?? '', x: f1(pt.x), y: f1(pt.y) };
  });

  const finish = track.at(0);
  const nx = -Math.sin(finish.h);
  const ny = Math.cos(finish.h);
  const sectorTicks = [1 / 3, 2 / 3].map((k, i) => {
    const p = track.at(track.total * k);
    const ox = -Math.sin(p.h);
    const oy = Math.cos(p.h);
    return {
      label: `S${i + 2}`,
      d: `M${f1(p.x + ox * 7)},${f1(p.y + oy * 7)}L${f1(p.x - ox * 7)},${f1(p.y - oy * 7)}`,
      lx: f1(p.x + ox * 16),
      ly: f1(p.y + oy * 16 + 3),
    };
  });

  const car = lap === null ? null : track.at(Math.min(driven, track.total - 0.5));
  return {
    lap,
    loopD: track.path(0, track.total),
    drivenD: lap === null ? '' : track.path(0, driven),
    todoD: lap === null ? track.path(0, track.total) : track.path(driven, track.total),
    finishD: `M${f1(finish.x + nx * 8)},${f1(finish.y + ny * 8)}L${f1(finish.x - nx * 8)},${f1(finish.y - ny * 8)}`,
    sectorTicks,
    stops,
    car: car ? { x: f1(car.x), y: f1(car.y), angle: f1((car.h * 180) / Math.PI) } : null,
  };
}
