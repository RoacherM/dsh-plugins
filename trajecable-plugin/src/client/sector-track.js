// Flat map of the chat HUD track: no camera, no walls, no shadows.
// The plans below drive "north" (+Y). On screen, north points to the top right, so the car
// runs from the bottom left to the top right. VIEW.k scales world units to screen pixels.
export const VIEW = { cx: 124, vc: 112, k: 0.78, sx: 124, sy: 92 };
export const W = 12;

const C45 = Math.SQRT1_2;
const LEAD = 120;

/** World point to screen: a clockwise 45° turn of a north-up map. */
export function toScreen(X, Y) {
  const u = (X - VIEW.cx) * VIEW.k; // across the road, screen down-right
  const v = (Y - VIEW.vc) * VIEW.k; // along the road, screen up-right
  return [VIEW.sx + (u + v) * C45, VIEW.sy + (u - v) * C45];
}

export function sample(start, heading, plan, step = 1.5) {
  const pts = [];
  const corners = [];
  let [x, y] = start;
  let h = (heading * Math.PI) / 180;
  let s = 0;
  pts.push({ x, y, h, s });
  for (const [kind, a, b, label] of plan) {
    if (kind === 'line') {
      const n = Math.ceil(a / step);
      for (let i = 0; i < n; i++) {
        x += (Math.cos(h) * a) / n;
        y += (Math.sin(h) * a) / n;
        s += a / n;
        pts.push({ x, y, h, s });
      }
    } else {
      const R = a;
      const turn = (b * Math.PI) / 180;
      const len = Math.abs(turn) * R;
      const n = Math.ceil(len / step);
      const s0 = s;
      for (let i = 0; i < n; i++) {
        const dh = turn / n;
        const mid = h + dh / 2;
        const chord = 2 * R * Math.sin(Math.abs(dh) / 2);
        x += Math.cos(mid) * chord;
        y += Math.sin(mid) * chord;
        h += dh;
        s += len / n;
        pts.push({ x, y, h, s });
      }
      if (label) corners.push({ label, s: (s0 + s) / 2, dir: Math.sign(b) });
    }
  }
  return { pts, corners, total: s };
}

export function hashKey(key) {
  const str = String(key ?? '');
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export const TEMPLATES = [
  {
    start: [56, -40],
    heading: 90,
    plan: [
      ['line', 90],
      ['arc', 32, -90, 'T4'],
      ['line', 48],
      ['arc', 28, 90, 'T5'],
      ['line', 50],
      ['arc', 40, 45, 'T6'],
      ['line', 24],
      ['arc', 40, -45],
      ['line', 110],
    ],
  },
  {
    start: [188, -40],
    heading: 90,
    plan: [
      ['line', 86],
      ['arc', 30, 90, 'T1'],
      ['line', 52],
      ['arc', 28, -90, 'T2'],
      ['line', 46],
      ['arc', 38, -42, 'T3'],
      ['line', 26],
      ['arc', 38, 42],
      ['line', 112],
    ],
  },
  {
    start: [74, -40],
    heading: 90,
    plan: [
      ['line', 78],
      ['arc', 34, -75, 'T2'],
      ['line', 44],
      ['arc', 30, 75, 'T3'],
      ['line', 54],
      ['arc', 36, -50, 'T4'],
      ['line', 28],
      ['arc', 36, 50],
      ['line', 108],
    ],
  },
  {
    start: [168, -40],
    heading: 90,
    plan: [
      ['line', 82],
      ['arc', 32, 80, 'T3'],
      ['line', 46],
      ['arc', 28, -80, 'T4'],
      ['line', 50],
      ['arc', 36, 48, 'T5'],
      ['line', 24],
      ['arc', 36, -48],
      ['line', 114],
    ],
  },
  {
    start: [64, -40],
    heading: 90,
    plan: [
      ['line', 94],
      ['arc', 30, -85, 'T5'],
      ['line', 50],
      ['arc', 30, 85, 'T6'],
      ['line', 42],
      ['arc', 42, 40, 'T7'],
      ['line', 26],
      ['arc', 42, -40],
      ['line', 110],
    ],
  },
  {
    start: [176, -40],
    heading: 90,
    plan: [
      ['line', 88],
      ['arc', 34, 85, 'T6'],
      ['line', 48],
      ['arc', 30, -85, 'T7'],
      ['line', 48],
      ['arc', 38, -45, 'T8'],
      ['line', 24],
      ['arc', 38, 45],
      ['line', 110],
    ],
  },
];

const f1 = (n) => n.toFixed(1);
const ptsStr = (arr) => arr.map(([a, b]) => `${f1(a)},${f1(b)}`).join(' ');
const off = (p, d) => [p.x - Math.sin(p.h) * d, p.y + Math.cos(p.h) * d];

/**
 * Flat track for the chat HUD, built from counts only (no model call):
 * each user prompt is a corner, LLM replies move the car along the straight after it,
 * a corner whose turn had failed tool calls gets red gravel, and when the agent is idle
 * a yellow flag ahead of the car says it is waiting for the user.
 */
export function buildSectorGeometry(session, { running = false } = {}) {
  if (!session) return { hasTrack: false };
  const tpl = TEMPLATES[hashKey(session.key ?? '') % TEMPLATES.length];
  // A lead-in behind the start and a tail past the end keep the road open at both screen corners.
  const [x0, y0] = tpl.start;
  const sampled = sample([x0, y0 - LEAD], tpl.heading, [['line', LEAD], ...tpl.plan, ['line', 260]]);
  const { pts, total: far } = sampled;
  const turns = Array.isArray(session.turns) ? session.turns : [];
  // The last two turns sit on the first two corners, so the car runs mid-panel and the
  // third corner ahead stands for the next user prompt. Older turns are off the bottom left.
  const visible = turns.slice(-(sampled.corners.length - 1));
  const corners = sampled.corners.map((c, idx) => ({ ...c, turn: visible[idx] }));

  // Points are sampled every ~1.5 units, so an index lookup is exact enough and O(1).
  const at = (s) => pts[Math.max(0, Math.min(pts.length - 1, Math.round((s / far) * (pts.length - 1))))];
  const scr = (p, d = 0) => toScreen(...off(p, d));
  const segment = (s0, s1) => pts.filter((p) => p.s >= s0 && p.s <= s1);
  const ribbon = (s0, s1, w0, w1) => {
    const seg = segment(s0, s1);
    return ptsStr(seg.map((p) => scr(p, w0)).concat(seg.map((p) => scr(p, w1)).reverse()));
  };
  const road = (s0, s1) => ribbon(s0, s1, W, -W);
  const line = (s0, s1, d = 0) => 'M' + segment(s0, s1).map((p) => scr(p, d).map(f1).join(',')).join('L');

  const cornerLabels = corners.filter((c) => c.turn).map((c, idx) => {
    const side = idx === 0 ? 1 : -1;
    const [x, y] = scr(at(c.s), side * c.dir * (W + 14));
    return { label: `T${c.turn.n}`, x: f1(x), y: f1(y + 3.5) };
  });

  const k = visible.length - 1;
  let carS = 0;
  if (k >= 0) {
    const current = visible[k];
    const from = corners[k].s;
    const to = corners[k + 1].s - 14;
    // Saturating: the first replies move the car most, a long turn never leaves the straight.
    const steps = current.llm || current.tools;
    carS = from + (steps / (steps + 10)) * (to - from);
  }

  const kerbs = corners.filter((c) => c.turn).map((c, idx) => ({
    key: `${c.turn.n}-${idx}`,
    d: line(c.s - 20, c.s + 20, c.dir * (W + 1.6)),
  }));

  const gravel = corners.filter((c) => c.turn?.errors > 0).map((c) => {
    const outSign = -c.dir || 1;
    const [mx, my] = scr(at(c.s - 2), outSign * (W + 10));
    return {
      key: c.turn.n,
      points: ribbon(c.s - 26, c.s + 22, outSign * (W + 17), outSign * (W + 3)),
      marker: { d: `M${f1(mx)},${f1(my - 5)} l5,8.5 h-10 z` },
    };
  });

  let yellowFlag = null;
  if (!running && k >= 0) {
    const [bx, by] = scr(at(carS + 14), W + 6);
    yellowFlag = {
      x1: f1(bx), y1: f1(by), x2: f1(bx), y2: f1(by - 14),
      clothD: `M${f1(bx)},${f1(by - 14)} h9 l-2.2,3 l2.2,3 h-9 z`,
    };
  }

  let car = null;
  if (k >= 0) {
    const [bx, by] = scr(at(carS));
    const [ax, ay] = scr(at(carS + 3));
    car = { bodyX: f1(bx), bodyY: f1(by), angle: f1((Math.atan2(ay - by, ax - bx) * 180) / Math.PI) };
  }

  return {
    hasTrack: true,
    topTodoPoints: road(carS, far),
    topDonePoints: car ? road(0, carS + 0.5) : null,
    kerbs,
    centerLineD: line(car ? carS + 8 : 0, far),
    corners: cornerLabels,
    gravel,
    yellowFlag,
    car,
  };
}
