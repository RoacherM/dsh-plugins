# Live HUD design: "Sector Cam", a 45° overhead view of an open track section

I rendered the sketch below in headless Chrome at 3× and checked the screenshot. It was a scratch copy in `/tmp/hud/`; I did not change any repository files. I did not test it in Safari or WebKit.

## 1. Concept and rationale

**Sector Cam.** The HUD is a broadcast camera that hangs 45° above the circuit, faces north, and follows the car. It shows one open section of the full session track. The road enters at the bottom edge, passes through three corners (T4, T5 and the T6 chicane), and leaves at the top edge.

The road is a solid strip with three parts: a top surface, a 4 px side wall, and a contact shadow. A faint projected ground grid shrinks toward the top, so the eye reads a tilted plane before it reads any data. Completed road has a light top surface. Remaining road is dark asphalt with a dashed centre line, so progress shows without a progress bar.

The car, the flag and the incident marker stand upright on the plane, like physical objects. Only their position is projected, so their shapes are never distorted. All telemetry sits in one 64 px strip at the bottom. The track is the panel; the panel is not a card with a map inset.

## 2. Layout spec

**Panel**

| Item | Value |
|---|---|
| Panel | **248 × 264 px**, about 0.94 : 1, `border-radius: 10px`, `border: 1px solid #2c2c2e` |
| Placement | `position:absolute; top:26px; right:28px` in the Chat view, the same anchor as the current HUD |
| Shadow | `0 6px 18px rgba(0,0,0,.25)`: one light layer only |
| Track area | **248 × 200 px, full-bleed** with no padding = **75.8 %** of the panel height. Background `#141416` |
| Data strip | **248 × 64 px**, background `#1c1c1e`, `border-top: 1px solid #2c2c2e`, padding `0 12px`, rows `34px / 22px` |
| Grid | One left edge at x = 12 for the LIVE chip, the driver and the sector text. One right edge at x = 236 for the speed and the conditions |
| Overlays in the track | LIVE chip at (12, 9). North indicator at about (228, 30). The road never passes through either top corner |

**Typography.** The smallest size is 10 px.

| Use | Font | Size / weight | Colour |
|---|---|---|---|
| Model (`deepseek-v4`) | sans | 12 / 600 | `#f2f2f7` |
| Preset (`· executor`) | sans | 12 / 400 | `#8e8e93` |
| Speed (`42`) | mono | 20 / 600, `letter-spacing:-.02em` | `#f2f2f7` |
| Unit (`tok/s`) | mono | 10 / 400 | `#8e8e93` |
| Sector (`S2 · T4→T6 · 43%`) | mono | 10; `43%` in 600 | `#a1a1a6`; `43%` in `#f2f2f7` |
| Conditions | sans | 10.5 | text `#d1d1d6`; glyph amber or red |
| In-track labels (T#, S#, N, LIVE) | mono | 10 | `#8e8e93` / `#6e6e73` |

- Sans stack: `-apple-system, 'SF Pro Text', 'Helvetica Neue', 'PingFang SC', sans-serif`
- Mono stack: `ui-monospace, 'SF Mono', Menlo, monospace`

**Colours**

| Role | Hex |
|---|---|
| Page / panel ground / strip | `#0f0f10` / `#141416` / `#1c1c1e` |
| Hairlines, border | `#2c2c2e` |
| Ground grid | `#232326` |
| Completed road top / wall | `#dcdce0` / `#6e6e73` |
| Remaining road top / edge / wall | `#2c2c2e` / `#3a3a3c` / `#0a0a0b` |
| Contact shadow | `#000` at 0.55 |
| Kerbs (neutral, so red keeps one meaning) | `#48484a` + `#d1d1d6` |
| Red accent: car, gravel, failures | `#ff453a`; gravel fill at 0.14 opacity, gravel lines at 0.6 |
| Amber accent: yellow flag, approval | `#ffb340` |
| Green: LIVE dot only | `#30d158` |

**Stroke widths and geometry** (ground units are about 1 px at mid-depth)

| Element | Value |
|---|---|
| Road | half-width 12 units: about 27 px wide at the bottom, about 21 px at the top |
| Slab thickness | Z = −6 units, which makes a wall of about 4 px |
| Shadow offset | (+3, −3.5) units |
| Ground grid | 0.75 px, 40-unit cells |
| Remaining-road edge | 0.75 px |
| Remaining centre line | 1.2 px, dash `3 4` |
| Kerbs | 2.4 px, dash `2.5 2.5`, on the inside of each corner, ±20 units around the apex |
| Sector line | 1.25 px |
| Flag pole | 1.2 px, 20 units tall (about 14 px) |
| Flag cloth | 9 × 6 px swallowtail |
| Car | 14 × 8.5 capsule, `rx 4.25`, stroke 1.5 `#141416` |
| Car shadow | ellipse 8 × 4 |
| Car halo | 1.5 px ring that pulses from r 7 to r 13 over 1.6 s; static when `prefers-reduced-motion` is set |
| Incident marker | 11 × 9.5 triangle |

## 3. Standalone HTML + CSS + SVG sketch

Save this as a `.html` file and open it in a browser. A small inline script builds the geometry. It is the same `proj()` and ribbon code that a React `useMemo` would run, and it needs no external assets.

```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Trajecable · Live HUD · Sector Cam</title>
</head>
<body style="margin:0;min-height:100vh;background:#0f0f10;display:flex;justify-content:flex-end;align-items:flex-start;padding:24px 28px;box-sizing:border-box;">

<section aria-label="Live session HUD" style="position:relative;width:248px;height:264px;background:#141416;border:1px solid #2c2c2e;border-radius:10px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.25);font-family:-apple-system,'SF Pro Text','Helvetica Neue','PingFang SC',sans-serif;color:#f2f2f7;">

  <!-- TRACK: 248×200, full-bleed, 75.8% of panel height -->
  <div style="position:relative;height:200px;">
    <svg id="track" viewBox="0 0 248 200" width="248" height="200" aria-hidden="true" style="display:block;"></svg>

    <div style="position:absolute;left:12px;top:9px;display:flex;align-items:center;gap:6px;font:500 10px/1 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.08em;">
      <span style="width:6px;height:6px;border-radius:50%;background:#30d158;"></span>
      <span style="color:#f2f2f7;">LIVE</span>
      <span style="color:#8e8e93;">LAP 03</span>
    </div>
  </div>

  <!-- DATA STRIP: 248×64 -->
  <div style="height:64px;border-top:1px solid #2c2c2e;background:#1c1c1e;padding:0 12px;box-sizing:border-box;display:grid;grid-template-rows:34px 22px;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:3px;">
      <div style="font-size:12px;line-height:1;white-space:nowrap;">
        <span style="font-weight:600;color:#f2f2f7;">deepseek-v4</span>
        <span style="color:#8e8e93;"> · executor</span>
      </div>
      <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;line-height:1;white-space:nowrap;">
        <span style="font-size:20px;font-weight:600;letter-spacing:-.02em;color:#f2f2f7;">42</span><span style="font-size:10px;color:#8e8e93;margin-left:3px;">tok/s</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;font:10px/1 ui-monospace,'SF Mono',Menlo,monospace;white-space:nowrap;">
      <span style="color:#a1a1a6;">S2 · T4→T6 · <b style="color:#f2f2f7;font-weight:600;">43%</b></span>
      <span style="display:flex;gap:9px;font-family:-apple-system,'SF Pro Text','PingFang SC',sans-serif;font-size:10.5px;">
        <span style="color:#d1d1d6;"><b style="color:#ffb340;font-weight:400;">⚑</b> 等待审批</span>
        <span style="color:#d1d1d6;"><b style="color:#ff453a;font-weight:400;">▲</b> 测试 ×2</span>
      </span>
    </div>
  </div>
</section>

<style>
  @keyframes halo { 0%{r:7;opacity:.45} 100%{r:13;opacity:0} }
  #car-halo { animation: halo 1.6s ease-out infinite; }
  @media (prefers-reduced-motion: reduce) { #car-halo { animation: none; opacity:.25; } }
</style>

<script>
// ---------- 1. Camera: pinhole, pitched 45° down, north-up ----------
// Ground units ≈ 1 screen px at mid-depth. Z is height above the ground.
// Camera sits H behind and H above the view centre (vc), so it looks down at exactly 45°.
const C = Math.SQRT1_2;
const CAM = { cx: 124, vc: 130, H: 380, F: 537, sx: 124, sy: 89 };
function proj(X, Y, Z = 0) {
  const dx = X - CAM.cx, dy = Y - (CAM.vc - CAM.H), dz = Z - CAM.H;
  const zc = (dy - dz) * C;            // depth along view axis
  const yc = (dy + dz) * C;            // camera "up"
  return [CAM.sx + CAM.F * dx / zc, CAM.sy - CAM.F * yc / zc];
}

// ---------- 2. Track segment in ground (map) coordinates ----------
// One open slice of the global circuit: enters south, leaves north.
const W = 12;                         // half road width, ground units
const PLAN = [
  ['line', 90],                       // from (56,-40) north
  ['arc', 32, -90, 'T4'],             // right-hander
  ['line', 48],
  ['arc', 28, 90, 'T5'],              // left-hander
  ['line', 50],
  ['arc', 40, 45, 'T6'],              // T6 chicane, left…
  ['line', 24],
  ['arc', 40, -45],                   // …then right
  ['line', 110],                      // exits off the top edge
];
function sample(start, heading, plan, step = 1.5) {
  const pts = []; const corners = [];
  let [x, y] = start, h = heading * Math.PI / 180, s = 0;
  pts.push({ x, y, h, s });
  for (const [kind, a, b, label] of plan) {
    if (kind === 'line') {
      const n = Math.ceil(a / step);
      for (let i = 0; i < n; i++) { x += Math.cos(h) * a / n; y += Math.sin(h) * a / n; s += a / n; pts.push({ x, y, h, s }); }
    } else {
      const R = a, turn = b * Math.PI / 180, len = Math.abs(turn) * R, n = Math.ceil(len / step);
      const s0 = s;
      for (let i = 0; i < n; i++) {
        const dh = turn / n, mid = h + dh / 2, chord = 2 * R * Math.sin(Math.abs(dh) / 2);
        x += Math.cos(mid) * chord; y += Math.sin(mid) * chord; h += dh; s += len / n; pts.push({ x, y, h, s });
      }
      if (label) corners.push({ label, s: (s0 + s) / 2, dir: Math.sign(b) });
    }
  }
  return { pts, corners, total: s };
}
const { pts, corners, total } = sample([56, -40], 90, PLAN);
const at = s => pts.reduce((best, p) => Math.abs(p.s - s) < Math.abs(best.s - s) ? p : best);
const off = (p, d) => [p.x - Math.sin(p.h) * d, p.y + Math.cos(p.h) * d]; // + = left of travel

// ---------- 3. Live state (from session data) ----------
const CAR_S = 186;                    // car position along this slice (session progress 43%)
const SECTORS = [{ s: 66, label: 'S2' }, { s: 262, label: 'S3' }];

// ---------- 4. Builders ----------
const f1 = n => n.toFixed(1);
const ptsStr = arr => arr.map(([a, b]) => f1(a) + ',' + f1(b)).join(' ');
function ribbon(s0, s1, { z = 0, shiftX = 0, shiftY = 0, w = W } = {}) {
  const seg = pts.filter(p => p.s >= s0 && p.s <= s1);
  const L = seg.map(p => { const [x, y] = off(p, w); return proj(x + shiftX, y + shiftY, z); });
  const R = seg.map(p => { const [x, y] = off(p, -w); return proj(x + shiftX, y + shiftY, z); }).reverse();
  return ptsStr(L.concat(R));
}
function line(s0, s1, d = 0, z = 0) {
  return 'M' + pts.filter(p => p.s >= s0 && p.s <= s1).map(p => { const [x, y] = off(p, d); return proj(x, y, z).map(f1).join(','); }).join('L');
}
const svgNS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('track');
function el(tag, attrs, parent = svg) { const n = document.createElementNS(svgNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; }
const END = total;

// ground grid: 40-unit squares, projected (sells the 45° plane)
const grid = el('g', { stroke: '#232326', 'stroke-width': .75, fill: 'none' });
for (let X = -80; X <= 330; X += 40) el('path', { d: 'M' + proj(X, -20).map(f1) + 'L' + proj(X, 320).map(f1) }, grid);
for (let Y = 0; Y <= 320; Y += 40) el('path', { d: 'M' + proj(-120, Y).map(f1) + 'L' + proj(370, Y).map(f1) }, grid);

// gravel trap: outside of T4 (completed part; the test failures)
const t4 = corners.find(c => c.label === 'T4');
const gravel = el('g', {});
{
  const seg = pts.filter(p => p.s >= t4.s - 26 && p.s <= t4.s + 22);
  const outer = seg.map(p => proj(...off(p, W + 17)));
  const inner = seg.map(p => proj(...off(p, W + 3))).reverse();
  el('polygon', { points: ptsStr(outer.concat(inner)), fill: '#ff453a', 'fill-opacity': .14 }, gravel);
}
for (const d of [W + 7, W + 12]) el('path', { d: line(t4.s - 22, t4.s + 18, d), fill: 'none', stroke: '#ff453a', 'stroke-opacity': .6, 'stroke-width': 1, 'stroke-dasharray': '1.5 3' }, gravel);

// contact shadow (ground shifted SE, below slab) → side wall → top surface
el('polygon', { points: ribbon(0, END, { z: -6, shiftX: 3, shiftY: -3.5 }), fill: '#000', 'fill-opacity': .55 });
el('polygon', { points: ribbon(0, CAR_S, { z: -6 }), fill: '#6e6e73' });
el('polygon', { points: ribbon(CAR_S, END, { z: -6 }), fill: '#0a0a0b' });
el('polygon', { points: ribbon(CAR_S, END), fill: '#2c2c2e', stroke: '#3a3a3c', 'stroke-width': .75 });
el('polygon', { points: ribbon(0, CAR_S + .5), fill: '#dcdce0' });

// kerbs on the inside of each corner (neutral, not red: red means incident)
for (const c of corners) {
  const d = c.dir * (W + 1.6);
  el('path', { d: line(c.s - 20, c.s + 20, d), fill: 'none', stroke: '#48484a', 'stroke-width': 2.4 });
  el('path', { d: line(c.s - 20, c.s + 20, d), fill: 'none', stroke: '#d1d1d6', 'stroke-width': 2.4, 'stroke-dasharray': '2.5 2.5' });
}

// remaining: dashed centre line
el('path', { d: line(CAR_S + 8, END), fill: 'none', stroke: '#8e8e93', 'stroke-width': 1.2, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round' });

// sector / checkpoint lines, flat on the road
for (const sec of SECTORS) {
  const p = at(sec.s), a = proj(...off(p, W)), b = proj(...off(p, -W));
  const done = sec.s < CAR_S;
  el('path', { d: `M${a.map(f1)}L${b.map(f1)}`, stroke: done ? '#1c1c1e' : '#f2f2f7', 'stroke-opacity': done ? .9 : .7, 'stroke-width': 1.25 });
  const [lx, ly] = proj(...off(p, done ? W + 7 : -(W + 7)));
  el('text', { x: f1(lx), y: f1(ly + 3.5), 'text-anchor': done ? 'end' : 'start', fill: '#6e6e73', 'font-size': 10, 'font-family': "ui-monospace,'SF Mono',Menlo,monospace" }).textContent = sec.label;
}

// corner numbers, off the road (T4 inside the bend, where the field is empty)
for (const c of corners) {
  const p = at(c.s), [x, y] = proj(...off(p, (c.label === 'T4' ? 1 : -1) * c.dir * (W + 15)));
  el('text', { x: f1(x), y: f1(y + 3.5), 'text-anchor': 'middle', fill: '#8e8e93', 'font-size': 10, 'font-family': "ui-monospace,'SF Mono',Menlo,monospace" }).textContent = c.label;
}

// ---------- 5. Upright glyphs (billboards): positioned by proj(), never transformed by it ----------
function pole(groundXY, height, cloth) {
  const base = proj(...groundXY), top = proj(...groundXY, height);
  el('ellipse', { cx: f1(base[0] + 1), cy: f1(base[1] + .5), rx: 3, ry: 1.4, fill: '#000', 'fill-opacity': .5 });
  el('line', { x1: f1(base[0]), y1: f1(base[1]), x2: f1(top[0]), y2: f1(top[1]), stroke: '#c7c7cc', 'stroke-width': 1.2, 'stroke-linecap': 'round' });
  cloth(top);
}
// yellow flag: trackside at the car (waiting for approval)
const car = at(CAR_S);
pole(off(at(CAR_S + 10), W + 5), 20, ([x, y]) =>
  el('path', { d: `M${f1(x)},${f1(y)} h9 l-2.2,3 l2.2,3 h-9 z`, fill: '#ffb340', stroke: '#141416', 'stroke-width': .8 }));
// red incident marker at the gravel trap
{
  const p = proj(...off(at(t4.s - 2), W + 10), 0);
  el('ellipse', { cx: f1(p[0] + 1), cy: f1(p[1] + .5), rx: 4.5, ry: 1.8, fill: '#000', 'fill-opacity': .5 });
  el('path', { d: `M${f1(p[0])},${f1(p[1] - 10)} l5.5,9.5 h-11 z`, fill: '#ff453a', stroke: '#141416', 'stroke-width': 1, 'stroke-linejoin': 'round' });
}
// car: shadow on the road, body lifted 2.5 units, capsule aligned to screen tangent
{
  const g = proj(car.x, car.y), body = proj(car.x, car.y, 2.5);
  const next = at(CAR_S + 3), ahead = proj(next.x, next.y);
  const ang = Math.atan2(ahead[1] - g[1], ahead[0] - g[0]) * 180 / Math.PI;
  el('ellipse', { cx: f1(g[0] + 1.5), cy: f1(g[1] + 1.5), rx: 8, ry: 4, fill: '#000', 'fill-opacity': .35 });
  el('circle', { id: 'car-halo', cx: f1(body[0]), cy: f1(body[1]), r: 7, fill: 'none', stroke: '#ff453a', 'stroke-width': 1.5 });
  const cg = el('g', { transform: `translate(${f1(body[0])},${f1(body[1])}) rotate(${f1(ang)})` });
  el('rect', { x: -7, y: -4.25, width: 14, height: 8.5, rx: 4.25, fill: '#ff453a', stroke: '#141416', 'stroke-width': 1.5 }, cg);
  el('circle', { cx: 2, cy: 0, r: 1.6, fill: '#141416' }, cg);
}

// north indicator: a flat chevron on the ground plane + upright "N"
{
  const X = 240, Y = 236;
  const tip = proj(X, Y + 9), l = proj(X - 5, Y - 4), m = proj(X, Y - 1), r = proj(X + 5, Y - 4);
  el('path', { d: `M${tip.map(f1)}L${r.map(f1)}L${m.map(f1)}L${l.map(f1)}Z`, fill: '#d1d1d6' });
  el('text', { x: f1(m[0]), y: f1(m[1] + 12), 'text-anchor': 'middle', fill: '#d1d1d6', 'font-size': 10, 'font-weight': 600, 'font-family': "ui-monospace,'SF Mono',Menlo,monospace" }).textContent = 'N';
}
</script>
</body>
</html>
```

## 4. How the 45° perspective is built

**Camera.** The camera is a pinhole that looks down at exactly 45°. It sits `H` units south of the view centre and `H` units above the ground, so its axis meets the ground at 45°. For a ground point `(X, Y, Z)`:

- `zc = (dy − dz)·√½` and `yc = (dy + dz)·√½`
- `dy = Y − (vc − H)` and `dz = Z − H`
- screen `x = sx + F·(X − cx)/zc` and screen `y = sy − F·yc/zc`

The constants are `H = 380`, `F = 537` and `vc = 130`. With them:

- At mid-depth, 1 ground unit ≈ 1 px horizontally and ≈ 0.707 px vertically. That vertical squeeze is the 45° foreshortening.
- The far edge is about 0.69 × the width of the near edge. The road narrows slightly toward the top, as the brief asks, without looking like a fisheye.
- The view shows ground depth from Y ≈ 0 to Y ≈ 281.

**Track plan.** The track section is a list of lines and arcs, for example `line 90, arc R32 −90°`. This makes the corner count and corner type explicit and deterministic per session.

**Road.** The road is a polygon, not a stroke. The code samples the centre line every 1.5 units and offsets each sample left and right by the half-width along its normal, still in ground coordinates. Then it projects both edges. Width therefore shrinks with distance, and east–west stretches look thinner than north–south ones, as real asphalt would. A fixed SVG `stroke-width` cannot do either.

**Road depth.** The same ribbon is projected three times:

1. At `Z = −6`, shifted (+3, −3.5) units and filled black at 0.55 opacity. This is the contact shadow.
2. At `Z = −6` with no shift. This is the side wall. It shows only along edges that face the camera, which is physically correct.
3. At `Z = 0`. This is the top surface.

No filters, blur or gradients are used.

**Flat markings.** Sector lines, kerbs, the gravel trap and the north chevron are drawn in ground coordinates and projected. They lie flat and foreshorten with the road.

**Glyphs are billboards.** For the car, the flag pole, the cloth, the incident triangle and all text, only the anchor point goes through `proj()`. The shape itself is drawn in screen pixels at a fixed size:

- The flag pole runs from `proj(p, 0)` to `proj(p, 20)`, so it stands upright.
- The cloth is a fixed 9 × 6 px swallowtail.
- The car capsule turns only to match the screen direction of the road, and its body sits 2.5 units above its own shadow.

A CSS `rotateX(45deg)` on the whole SVG would squash the car, the flags and the 10 px labels by about 0.7 vertically. It would also blur the text and make pointer hit-testing harder. That is why the camera is computed in code rather than with a CSS transform.

**React implementation.**

- Run `useMemo(() => buildGeometry(plan, camera))` for the static layers.
- On each live update, change only `CAR_S`, which re-cuts the completed and remaining polygons and moves the car and flag.
- The camera follows the car. Choose the visible window so the car sits at about 45 % of the section's visible length. Extend the window until it holds 2–4 corners.
- When the car passes about 60 %, shift `vc` forward. The ground grid scrolls with it, which reads as forward motion.
- Data mapping:
  - car position = `completion.rate` placed on the global track
  - T# = corners, from decisions
  - gravel = the corner where a failure happened
  - yellow flag = waiting for approval, placed at the car
  - S# = checkpoints

## 5. Resizing

| Width | Panel | Track share | What changes |
|---|---|---|---|
| **200 px** | 200 × 228 | 164 / 228 = 72 % | Scale `F` and `sx` by 200/248. Keep the same ground window, so no corners are lost. Road half-width stays 12 units (about 22 px wide). Remove the S# labels; keep only the label of the car's next corner. Strip row 1: model only, with the preset moved to `title` / hover; speed drops to 18 px. Strip row 2: sector + % and **one** condition (red wins over amber), plus `+1` if there are two. Type stays at 10 px or larger. |
| **248 px** | 248 × 264 | 75.8 % | The spec above. |
| **280 px** | 280 × 296 | 228 / 296 = 77 % | Scale `F` by 280/248, but grow the ground window depth to about 310 units. The extra space shows **more track ahead**, up to a 4th corner, not bigger glyphs. Strip height goes to 68 px with the same two rows and the same type sizes. Still at most 2 conditions; no new data fields. |
| < 200 px | — | — | Do not shrink further. Collapse to a 28 px pill: `● LIVE · 43% · 42 tok/s`. |

## 6. What not to do

- **Do not tilt the flat map with CSS `rotateX` or `skew`.** It squashes the car, the flags and the text, and it does not create road thickness. Use projected geometry with upright billboards.
- **No isometric diamond and no rotated map.** North stays up, and the route always leaves through the top edge.
- **No closed loop and no start/finish line.** The section is cropped from a longer track. Both ends run off the panel edges.
- **No section with fewer than 2 corners.** If the global track has a long straight near the car, extend the window instead of showing a thermometer.
- **Do not make the panel wider at the cost of track height.** The 340 × 190 version failed because the track became a thin line. Track height stays at 70 % or more, full-bleed, with no inset map.
- **No header bar.** LIVE / LAP is a 10 px overlay in an empty top corner. All other data lives in the bottom strip.
- **No paper or cream background, no gradients, no blur glows, and no heavy shadow.** The only depth comes from geometry: wall, contact shadow and grid.
- **No new colours.** Red means car or incident, amber means flag, green means LIVE only. Kerbs stay neutral, so red keeps one meaning.
- **No labels on the road surface and no text below 10 px.** T# and S# sit in the open field beside the road. Add a leader line only if a label cannot be placed off the road.
- **Do not fix composition by adding things.** No event list, no leaderboard, no third condition, no extra cards or rows.
