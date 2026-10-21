# Global Race Log: "Pit Wall"

I rendered the sketch below in headless Chrome at 1280×900, 2×, and checked the screenshot. The scratch copy is in `/tmp/racelog/`. I did not change any repository files. I did not test Safari, and I did not render the 900 px layout; section 5 describes that layout but I have not checked it.

## 1. Concept and rationale

**Pit Wall.** At a real race, the pit wall has two screens: a **timing screen** with one line per car, and **one camera feed** on the car you are watching. This page uses the same model:

- The timeline is the timing screen. Each run is one 56 px row, grouped by day, newest first.
- The rail is the camera. It shows the full Sector Cam on the selected run, with its score, the engineer comment and the key numbers.

The reading axis runs down the main column. The rail never scrolls.

The idea that ties the page together is that **every row thumbnail is a small Sector Cam**. It uses the same 45° camera, the same north-up road, the same light-done and dark-remaining surfaces, and the same car. Selecting a row is like zooming that thumbnail into the rail. The car turns red in three places at once: the row thumbnail, the season sparkline and the HUD. Red has one meaning on this page: the car, plus incidents.

The page has no hero, no cards and no grid of metrics. The season strip is one 104 px band. Everything else is rows and hairlines.

## 2. Layout spec (1280 × 900)

**Frame**

| Area | Size | Notes |
|---|---|---|
| Page | 1280 × 900, `#0f0f10` | Rows: `48px / 1fr` |
| Header | full width × 48, `border-bottom 1px #2c2c2e`, padding `0 24px` | One bar |
| Body | `grid-template-columns: minmax(0,1fr) 296px` | |
| Main column | padding `0 24px` → **936 px** content at 1280 | Scrolls (virtualized) |
| Rail | **296 px** = 1 px hairline + 24 px + **248 px** + 23 px | Fixed; does not scroll |

**Header (48)**, left to right:

- `轨迹` (sans 15/600) · `/` (`#48484a`) · `RACE CONTROL` (mono 11/500, tracking .14em, `#a1a1a6`), pushed left with `margin-right:auto`.
- Range segmented control `1D 7D 30D ALL`: 28 px tall, hairline, radius 6, mono 11. The active segment uses `#2c2c2e`.
- Date span `10/14 – 10/20`: mono 11, `#8e8e93`.
- `Agent 全部 ▾` and `Project 全部 ▾`: 28 px, hairline, sans 12.
- Search: 220 × 28, placeholder `搜索标题、评语、文件`, and a `/` key hint.
- Gap between controls: 10 px.

**Season strip (104)**: columns `132 / 268 / 1fr`, gap 28, `border-bottom #2c2c2e`.

| Block | Content |
|---|---|
| Average | `SEASON · 7D` (mono 10) · `71` (mono 36/600) + `B` (mono 16/600) · `avg · 28 finals` (mono 10) |
| Counts | `94 sessions`, `28 scored · auto 3/12`, `10 cleared`: values mono 18/600, labels 10 `#8e8e93`. Under them, a 2 px agent bar in four grays (`#d1d1d6 / #8e8e93 / #6e6e73 / #48484a`) and the legend `DS 61 · CC 18 · CX 9 · 其他 6` (mono 10) |
| Sparkline | 72 px tall. Y axis is score 40–100. One `dayScore` dot per day (r 1.8) on a 1 px `#6e6e73` line. One ring per `sessionFinal` (r 3.5, 1.2 px stroke). The selected run is a filled `#ff453a` dot (r 4.5). Average is a dashed `#3a3a3c` line labelled `avg`. Day labels are mono 10; today is `#d1d1d6` |

**Day header (36)**: `10/20 TUE` (mono 11/600), `今天` (11 `#8e8e93`), and on the right `3 sessions · day 75` (mono 10). It has `border-bottom #2c2c2e` and sticks while its day is in view.

**Session row (56)**: `grid-template-columns: 48 22 1fr 100 60 62 10`, `column-gap 12`, padding `0 10 0 12`, divider `1px #1c1c1e`, hover `#141416`. At 1280 the body column is about 540 px.

| Column | Content |
|---|---|
| Time 48 | `14:05` (mono 11 `#d1d1d6`), then duration `1h05` (mono 10 `#6e6e73`). A live run shows a green 5 px dot and `LIVE` instead of the duration |
| Agent 22 | 22 × 22 hairline square, radius 5, two-letter mono 10/600 code: `DS CC CX PI EP GK AG`. Monochrome |
| Body | Line 1: title (13/500) + `project · model` (mono 11 `#6e6e73`). Line 2: one-line comment (12 `#a1a1a6`). Tone glyph: `▲` red = bad, `⚑` amber = watch, none = good |
| Completion 100 | One 6 × 6 pip per problem, 3 px gap, then `3/7` (mono 11). Solved = filled `#f2f2f7`; partial = half-filled; open = `#6e6e73` outline; abandoned = red outline. At most 8 pips; above that, show the count only |
| Score 60 | Right-aligned. `62` (mono 18/600) + grade in a fixed 18 px slot (mono 11 `#a1a1a6`), so all numbers align. Below: `done / ongoing / blocked` (mono 10, neutral) |
| Thumb 62 | **62 × 50** SVG, `viewBox 0 0 248 200`: exactly ¼ of the HUD track area |
| Caret 10 | `›`, which turns 90° when the row is expanded |

**Row variants**

- **Selected**: background `#141416`, `border-left 2px #f2f2f7`, and the thumbnail car is red. These are the only selection cues.
- **Expanded** (inline under the selected row): padding `2 20 16 104` (left edge aligned with the title), columns `1.05fr 1.25fr .9fr`, gap 24, 20 px item lines.
  - `PROBLEMS n/m`: status pip + text.
  - `DECISIONS · T1–Tn`: T# matches the HUD corners. Shapes follow `race-design.md` (circle tech, diamond scope, triangle risk, square detour). Agent decisions are filled, user decisions are hollow. Only risk (amber) and detour (red) have colour. At most 4 lines, then `+n more`.
  - `FILES · COMMANDS`: mono 11.
- **Unscored**: comment line shows scanner facts only (`未评分 · 5 prompts · 22 tools · 2 files`). The completion column holds a `Summarize` button (24 px, hairline `#3a3a3c`). The score column shows `—`. The thumbnail shows only the ground grid: there is a camera but no road yet.
- **Antigravity**: a **40 px** metadata row. The agent square is dashed. One line: title + `3 prompts · 无工具与 token 数据`. The thumbnail column says `no track`. No score and no pips.

**Rail (296)**, padding top 16:

| Item | Spec |
|---|---|
| Label | `SECTOR CAM` / `10/20 · 14:05`, mono 10, 16 px |
| HUD | **248 × 264** Sector Cam, margin-top 8. Unchanged from `preview/live-hud-opus.html`; it keeps its one quiet shadow |
| Identity | Title 14/600 (2 lines max), then `project · agent · model` (mono 11) |
| Score | `74` (mono 32/600) + `B+` (mono 14). On the right: `临时分 · ongoing` and the gate line `2/3 closed · −8 · 封顶 84` (mono 10) |
| Race engineer | Hairline above. `RACE ENGINEER ⚑ watch`, then 判断 / 建议 / 风险 in a `28px 1fr` grid, 12/18 |
| Key stats | 4 × 2 mono grid: label 10 `#8e8e93`, value 13. FRESH, PROC, CPLX, DAYS, PROMPTS, TOOLS, FILES, TESTS |
| Still open | Unsolved problems only |
| Actions | Pinned to the bottom: `打开会话 ↗`, `重新评分`, `J / K` |

**Type**: sans `-apple-system, 'SF Pro Text', 'Helvetica Neue', 'PingFang SC'`; mono `ui-monospace, 'SF Mono', Menlo`. Sizes used: 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20, 32, 36. Nothing is below 10 px.

**Colours**: only the HUD palette.

| Role | Hex |
|---|---|
| Surfaces | `#0f0f10`, `#141416`, `#1c1c1e` |
| Hairlines | `#2c2c2e` |
| Text | `#f2f2f7 / #d1d1d6 / #a1a1a6 / #8e8e93 / #6e6e73` |
| Road | `#dcdce0`, `#2c2c2e`, `#3a3a3c`, `#0a0a0b` |
| Ground grid | `#232326` |
| Red: car and incidents | `#ff453a` |
| Amber: flag, watch, risk | `#ffb340` |
| Green: LIVE only | `#30d158` |

There are no gradients. The only shadow is the HUD's.

**Density**: with nothing expanded, the page shows **12 rows** under the strip. With one expanded row, it shows 9 rows across 3 days, as in the sketch.

## 3. Standalone sketch (1280 × 900)

Save this as an `.html` file and open it. The HUD script is the approved Sector Cam code. Only the sample values changed: `67%` to match 2/3 closed, and `1h12` elapsed in place of `LAP 03`, because lap has no data source. All numbers, titles and comments are **sample** data.

```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Trajecable · Race Control · Pit Wall</title>
<style>
  :root { --sans: -apple-system, 'SF Pro Text', 'Helvetica Neue', 'PingFang SC', sans-serif; --mono: ui-monospace, 'SF Mono', Menlo, monospace; }
  body { margin: 0; background: #0f0f10; }
  .row:hover { background: #141416; }
  @keyframes halo { 0% { r: 7; opacity: .45 } 100% { r: 13; opacity: 0 } }
  #car-halo { animation: halo 1.6s ease-out infinite; }
  @media (prefers-reduced-motion: reduce) { #car-halo { animation: none; opacity: .25; } }
</style>
</head>
<body>
<div style="width:1280px;height:900px;overflow:hidden;display:grid;grid-template-rows:48px minmax(0,1fr);background:#0f0f10;color:#f2f2f7;font-family:var(--sans);">

<!-- ============ HEADER 48 ============ -->
<header style="display:flex;align-items:center;gap:10px;padding:0 24px;border-bottom:1px solid #2c2c2e;">
  <div style="display:flex;align-items:baseline;gap:8px;margin-right:auto;">
    <span style="font-size:15px;font-weight:600;">轨迹</span>
    <span style="font-size:13px;color:#48484a;">/</span>
    <span style="font:500 11px/1 var(--mono);letter-spacing:.14em;color:#a1a1a6;">RACE CONTROL</span>
  </div>
  <div style="display:flex;height:28px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:6px;overflow:hidden;font:11px/26px var(--mono);color:#8e8e93;">
    <span style="padding:0 10px;">1D</span>
    <span style="padding:0 10px;background:#2c2c2e;color:#f2f2f7;">7D</span>
    <span style="padding:0 10px;">30D</span>
    <span style="padding:0 10px;">ALL</span>
  </div>
  <span style="font:11px var(--mono);color:#8e8e93;margin-right:6px;">10/14 – 10/20</span>
  <span style="height:28px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:6px;padding:0 10px;display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d1d6;"><span style="color:#8e8e93;">Agent</span>全部<span style="color:#6e6e73;font-size:10px;">▾</span></span>
  <span style="height:28px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:6px;padding:0 10px;display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d1d6;"><span style="color:#8e8e93;">Project</span>全部<span style="color:#6e6e73;font-size:10px;">▾</span></span>
  <span style="width:220px;height:28px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:6px;padding:0 8px 0 10px;display:flex;align-items:center;gap:8px;font-size:12px;color:#6e6e73;">
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="3.8" fill="none" stroke="#8e8e93" stroke-width="1.3"/><path d="M8 8l3 3" stroke="#8e8e93" stroke-width="1.3" stroke-linecap="round"/></svg>
    <span style="flex:1;">搜索标题、评语、文件</span>
    <span style="font:10px/1 var(--mono);color:#6e6e73;border:1px solid #2c2c2e;border-radius:4px;padding:2px 4px;">/</span>
  </span>
</header>

<div style="display:grid;grid-template-columns:minmax(0,1fr) 296px;min-height:0;">

<!-- ============ MAIN COLUMN ============ -->
<main style="min-width:0;overflow:hidden;padding:0 24px;">

  <!-- SEASON STRIP 104 -->
  <section aria-label="Season" style="height:104px;box-sizing:border-box;display:grid;grid-template-columns:132px 268px minmax(0,1fr);column-gap:28px;align-items:center;border-bottom:1px solid #2c2c2e;">
    <div>
      <div style="font:10px/1 var(--mono);letter-spacing:.1em;color:#8e8e93;">SEASON · 7D</div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:10px;">
        <span style="font:600 36px/1 var(--mono);letter-spacing:-.03em;">71</span>
        <span style="font:600 16px/1 var(--mono);color:#d1d1d6;">B</span>
      </div>
      <div style="font:10px/1 var(--mono);color:#8e8e93;margin-top:10px;">avg · 28 finals</div>
    </div>
    <div>
      <div style="display:grid;grid-template-columns:72px 112px 72px;column-gap:6px;">
        <div><div style="font:600 18px/1 var(--mono);">94</div><div style="font-size:10px;color:#8e8e93;margin-top:6px;">sessions</div></div>
        <div><div style="font:600 18px/1 var(--mono);">28</div><div style="font-size:10px;color:#8e8e93;margin-top:6px;">scored · <span style="font-family:var(--mono);">auto 3/12</span></div></div>
        <div><div style="font:600 18px/1 var(--mono);">10</div><div style="font-size:10px;color:#8e8e93;margin-top:6px;">cleared</div></div>
      </div>
      <div style="display:flex;gap:2px;height:2px;margin-top:14px;">
        <span style="flex:61;background:#d1d1d6;"></span><span style="flex:18;background:#8e8e93;"></span><span style="flex:9;background:#6e6e73;"></span><span style="flex:6;background:#48484a;"></span>
      </div>
      <div style="font:10px/1 var(--mono);color:#8e8e93;margin-top:7px;white-space:nowrap;">DS 61 · CC 18 · CX 9 · 其他 6</div>
    </div>
    <svg id="spark" height="72" style="width:100%;display:block;" aria-label="Score over time"></svg>
  </section>

  <!-- ===== DAY 10/20 ===== -->
  <div style="height:36px;box-sizing:border-box;padding-top:6px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2c2c2e;">
    <span style="font:600 11px/1 var(--mono);letter-spacing:.06em;">10/20 TUE</span>
    <span style="font-size:11px;color:#8e8e93;">今天</span>
    <span style="margin-left:auto;font:10px/1 var(--mono);color:#8e8e93;">3 sessions · day 75</span>
  </div>

  <!-- R1: LIVE, selected, expanded -->
  <div style="background:#141416;border-left:2px solid #f2f2f7;border-bottom:1px solid #2c2c2e;">
    <div style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:56px;padding:0 10px;">
      <div style="font-family:var(--mono);line-height:1;">
        <div style="font-size:11px;color:#f2f2f7;">14:05</div>
        <div style="font-size:10px;margin-top:6px;display:flex;align-items:center;gap:4px;color:#f2f2f7;"><span style="width:5px;height:5px;border-radius:50%;background:#30d158;"></span>LIVE</div>
      </div>
      <div style="width:22px;height:22px;box-sizing:border-box;border:1px solid #48484a;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#f2f2f7;">DS</div>
      <div style="min-width:0;">
        <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;">本地 coding agent 对话记录可视化时间线</span><span style="flex:none;font:11px var(--mono);color:#8e8e93;">trajecable · deepseek-v4</span></div>
        <div style="margin-top:5px;font-size:12px;color:#a1a1a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span style="color:#ffb340;">⚑</span> 数据层已稳，视觉层还在迭代；先定全局页的结构，再调 HUD 细节。</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;"><svg class="pips" data-p="ssp"></svg><span style="font:11px/1 var(--mono);color:#d1d1d6;">2/3</span></div>
      <div style="text-align:right;font-family:var(--mono);line-height:1;">
        <div><span style="font-size:18px;font-weight:600;">74</span><span style="display:inline-block;width:18px;margin-left:3px;text-align:left;font-size:11px;color:#a1a1a6;">B+</span></div>
        <div style="font-size:10px;color:#8e8e93;margin-top:5px;">ongoing</div>
      </div>
      <svg class="thumb" data-tpl="A" data-rate=".67" data-sel="1" width="62" height="50" viewBox="0 0 248 200" aria-hidden="true"></svg>
      <span style="color:#a1a1a6;font-size:12px;transform:rotate(90deg);">›</span>
    </div>
    <!-- expanded detail -->
    <div style="display:grid;grid-template-columns:1.05fr 1.25fr .9fr;column-gap:24px;padding:2px 20px 16px 104px;">
      <div>
        <div style="font:10px/1 var(--mono);letter-spacing:.1em;color:#8e8e93;margin-bottom:6px;">PROBLEMS 2/3</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:#d1d1d6;"><svg width="6" height="6"><rect width="6" height="6" rx="1.5" fill="#f2f2f7"/></svg><span>扫描七种 agent 的本地日志</span></div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:#d1d1d6;"><svg width="6" height="6"><rect width="6" height="6" rx="1.5" fill="#f2f2f7"/></svg><span>时间线按天和项目分组</span></div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:#d1d1d6;"><svg width="6" height="6"><rect x=".5" y=".5" width="5" height="5" rx="1.2" fill="none" stroke="#f2f2f7"/><rect width="3" height="6" fill="#f2f2f7"/></svg><span>全局 Race Log 与 HUD 设计</span><span style="font:10px var(--mono);color:#8e8e93;">partial</span></div>
      </div>
      <div>
        <div style="font:10px/1 var(--mono);letter-spacing:.1em;color:#8e8e93;margin-bottom:6px;">DECISIONS · T1–T6</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:#d1d1d6;"><span style="font:10px var(--mono);color:#8e8e93;width:16px;">T1</span><svg width="9" height="9"><circle cx="4.5" cy="4.5" r="4" fill="#d1d1d6"/></svg><span>增量扫描 + 本地索引</span></div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:#d1d1d6;"><span style="font:10px var(--mono);color:#8e8e93;width:16px;">T2</span><svg width="9" height="9"><path d="M4.5 .8L8.2 4.5 4.5 8.2 .8 4.5z" fill="none" stroke="#d1d1d6" stroke-width="1.2"/></svg><span>评分只按 session<span style="color:#8e8e93;"> · 用户</span></span></div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:#d1d1d6;"><span style="font:10px var(--mono);color:#8e8e93;width:16px;">T3</span><svg width="9" height="9"><path d="M4.5 .6L8.6 8.2H.4z" fill="#ffb340"/></svg><span>无 usage 显示 —，不估算</span></div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:#d1d1d6;"><span style="font:10px var(--mono);color:#8e8e93;width:16px;">T5</span><svg width="9" height="9"><rect x=".5" y=".5" width="8" height="8" fill="#ff453a"/></svg><span>回退闭环赛道，改开放路段</span></div>
        <div style="font:10px/18px var(--mono);color:#6e6e73;padding-left:24px;">+2 more</div>
      </div>
      <div style="font-family:var(--mono);font-size:11px;line-height:20px;color:#d1d1d6;min-width:0;">
        <div style="font:10px/1 var(--mono);letter-spacing:.1em;color:#8e8e93;margin-bottom:6px;">FILES · COMMANDS</div>
        <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">src/client/race.jsx</div>
        <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">docs/global-handoff.md</div>
        <div style="color:#8e8e93;">+10 files</div>
        <div><span style="color:#ff453a;">✕</span> npm test</div>
      </div>
    </div>
  </div>

  <!-- R2 -->
  <div class="row" style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:56px;padding:0 10px 0 12px;border-bottom:1px solid #1c1c1e;">
    <div style="font-family:var(--mono);line-height:1;"><div style="font-size:11px;color:#d1d1d6;">11:20</div><div style="font-size:10px;color:#6e6e73;margin-top:6px;">1h05</div></div>
    <div style="width:22px;height:22px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#d1d1d6;">CC</div>
    <div style="min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;">关掉 OKR 日报与周报任务</span><span style="flex:none;font:11px var(--mono);color:#6e6e73;">okr · claude-opus-4-6</span></div>
      <div style="margin-top:5px;font-size:12px;color:#a1a1a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">先导出备份再删任务，每一步都能回退；三个问题全部收口。</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;"><svg class="pips" data-p="sss"></svg><span style="font:11px/1 var(--mono);color:#d1d1d6;">3/3</span></div>
    <div style="text-align:right;font-family:var(--mono);line-height:1;"><div><span style="font-size:18px;font-weight:600;">90</span><span style="display:inline-block;width:18px;margin-left:3px;text-align:left;font-size:11px;color:#a1a1a6;">A</span></div><div style="font-size:10px;color:#6e6e73;margin-top:5px;">done</div></div>
    <svg class="thumb" data-tpl="C" data-rate="1" width="62" height="50" viewBox="0 0 248 200" aria-hidden="true"></svg>
    <span style="color:#6e6e73;font-size:12px;">›</span>
  </div>

  <!-- R3 -->
  <div class="row" style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:56px;padding:0 10px 0 12px;border-bottom:1px solid #1c1c1e;">
    <div style="font-family:var(--mono);line-height:1;"><div style="font-size:11px;color:#d1d1d6;">09:42</div><div style="font-size:10px;color:#6e6e73;margin-top:6px;">0h48</div></div>
    <div style="width:22px;height:22px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#d1d1d6;">DS</div>
    <div style="min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;">分析各套餐 Opus5.5 价格系数</span><span style="flex:none;font:11px var(--mono);color:#6e6e73;">pricing · deepseek-v4</span></div>
      <div style="margin-top:5px;font-size:12px;color:#a1a1a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span style="color:#ffb340;">⚑</span> 四个套餐有来源；第五个系数仍是推测，需要补官方价格页。</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;"><svg class="pips" data-p="sssso"></svg><span style="font:11px/1 var(--mono);color:#d1d1d6;">4/5</span></div>
    <div style="text-align:right;font-family:var(--mono);line-height:1;"><div><span style="font-size:18px;font-weight:600;">62</span><span style="display:inline-block;width:18px;margin-left:3px;text-align:left;font-size:11px;color:#a1a1a6;">C</span></div><div style="font-size:10px;color:#6e6e73;margin-top:5px;">done</div></div>
    <svg class="thumb" data-tpl="D" data-rate=".8" width="62" height="50" viewBox="0 0 248 200" aria-hidden="true"></svg>
    <span style="color:#6e6e73;font-size:12px;">›</span>
  </div>

  <!-- ===== DAY 10/19 ===== -->
  <div style="height:36px;box-sizing:border-box;padding-top:6px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2c2c2e;">
    <span style="font:600 11px/1 var(--mono);letter-spacing:.06em;">10/19 MON</span>
    <span style="margin-left:auto;font:10px/1 var(--mono);color:#8e8e93;">4 sessions · day 70</span>
  </div>

  <!-- R4 -->
  <div class="row" style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:56px;padding:0 10px 0 12px;border-bottom:1px solid #1c1c1e;">
    <div style="font-family:var(--mono);line-height:1;"><div style="font-size:11px;color:#d1d1d6;">22:10</div><div style="font-size:10px;color:#6e6e73;margin-top:6px;">2h31</div></div>
    <div style="width:22px;height:22px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#d1d1d6;">DS</div>
    <div style="min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;">给时间线加上 agent 总结</span><span style="flex:none;font:11px var(--mono);color:#6e6e73;">trajecable · deepseek-v4</span></div>
      <div style="margin-top:5px;font-size:12px;color:#a1a1a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span style="color:#ff453a;">▲</span> 范围从总结一路扩到评分和 HUD，7 个问题只收口 3 个；下次先拆单再动手。</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;"><svg class="pips" data-p="ssspooo"></svg><span style="font:11px/1 var(--mono);color:#d1d1d6;">3/7</span></div>
    <div style="text-align:right;font-family:var(--mono);line-height:1;"><div><span style="font-size:18px;font-weight:600;">62</span><span style="display:inline-block;width:18px;margin-left:3px;text-align:left;font-size:11px;color:#a1a1a6;">C</span></div><div style="font-size:10px;color:#6e6e73;margin-top:5px;">done</div></div>
    <svg class="thumb" data-tpl="B" data-rate=".43" width="62" height="50" viewBox="0 0 248 200" aria-hidden="true"></svg>
    <span style="color:#6e6e73;font-size:12px;">›</span>
  </div>

  <!-- R5 -->
  <div class="row" style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:56px;padding:0 10px 0 12px;border-bottom:1px solid #1c1c1e;">
    <div style="font-family:var(--mono);line-height:1;"><div style="font-size:11px;color:#d1d1d6;">17:34</div><div style="font-size:10px;color:#6e6e73;margin-top:6px;">0h52</div></div>
    <div style="width:22px;height:22px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#d1d1d6;">DS</div>
    <div style="min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;">修复 ask user 双端确认问题</span><span style="flex:none;font:11px var(--mono);color:#6e6e73;">dsh-pair · deepseek-v4</span></div>
      <div style="margin-top:5px;font-size:12px;color:#a1a1a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">先写复现测试再改双端协议，每一步都先降风险；四个问题全部收口。</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;"><svg class="pips" data-p="ssss"></svg><span style="font:11px/1 var(--mono);color:#d1d1d6;">4/4</span></div>
    <div style="text-align:right;font-family:var(--mono);line-height:1;"><div><span style="font-size:18px;font-weight:600;">78</span><span style="display:inline-block;width:18px;margin-left:3px;text-align:left;font-size:11px;color:#a1a1a6;">B+</span></div><div style="font-size:10px;color:#6e6e73;margin-top:5px;">done</div></div>
    <svg class="thumb" data-tpl="E" data-rate="1" width="62" height="50" viewBox="0 0 248 200" aria-hidden="true"></svg>
    <span style="color:#6e6e73;font-size:12px;">›</span>
  </div>

  <!-- R6: unscored -->
  <div class="row" style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:56px;padding:0 10px 0 12px;border-bottom:1px solid #1c1c1e;">
    <div style="font-family:var(--mono);line-height:1;"><div style="font-size:11px;color:#d1d1d6;">15:02</div><div style="font-size:10px;color:#6e6e73;margin-top:6px;">0h47</div></div>
    <div style="width:22px;height:22px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#d1d1d6;">CC</div>
    <div style="min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;">Qwen3.8 Splash 内存不足</span><span style="flex:none;font:11px var(--mono);color:#6e6e73;">splash · claude-opus-4-6</span></div>
      <div style="margin-top:5px;font:11px var(--mono);color:#8e8e93;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">未评分 · 5 prompts · 22 tools · 2 files · 1 test fail</div>
    </div>
    <div><span style="height:24px;box-sizing:border-box;padding:0 10px;border:1px solid #3a3a3c;border-radius:6px;display:inline-flex;align-items:center;font-size:11px;color:#f2f2f7;">Summarize</span></div>
    <div style="text-align:right;font:18px/1 var(--mono);color:#6e6e73;padding-right:21px;">—</div>
    <svg class="thumb" width="62" height="50" viewBox="0 0 248 200" aria-hidden="true"></svg>
    <span style="color:#6e6e73;font-size:12px;">›</span>
  </div>

  <!-- R7: Antigravity, metadata only, 40 px -->
  <div class="row" style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:40px;padding:0 10px 0 12px;border-bottom:1px solid #1c1c1e;">
    <div style="font:11px/1 var(--mono);color:#d1d1d6;">10:47</div>
    <div style="width:22px;height:22px;box-sizing:border-box;border:1px dashed #3a3a3c;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#a1a1a6;">AG</div>
    <div style="min-width:0;display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;color:#d1d1d6;overflow:hidden;text-overflow:ellipsis;">整理 splash 发布说明</span><span style="flex:none;font:11px var(--mono);color:#6e6e73;">splash · 3 prompts · 无工具与 token 数据</span></div>
    <div></div><div></div>
    <div style="font:10px/1 var(--mono);color:#6e6e73;text-align:right;">no track</div>
    <span></span>
  </div>

  <!-- ===== DAY 10/18 ===== -->
  <div style="height:36px;box-sizing:border-box;padding-top:6px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2c2c2e;">
    <span style="font:600 11px/1 var(--mono);letter-spacing:.06em;">10/18 SUN</span>
    <span style="margin-left:auto;font:10px/1 var(--mono);color:#8e8e93;">5 sessions · day 79</span>
  </div>

  <!-- R8 -->
  <div class="row" style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:56px;padding:0 10px 0 12px;border-bottom:1px solid #1c1c1e;">
    <div style="font-family:var(--mono);line-height:1;"><div style="font-size:11px;color:#d1d1d6;">21:14</div><div style="font-size:10px;color:#6e6e73;margin-top:6px;">0h36</div></div>
    <div style="width:22px;height:22px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#d1d1d6;">CX</div>
    <div style="min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;">增量扫描改用文件 mtime</span><span style="flex:none;font:11px var(--mono);color:#6e6e73;">trajecable · gpt-5.5</span></div>
      <div style="margin-top:5px;font-size:12px;color:#a1a1a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">改动小、测试先行；两个问题都收口，没有绕路。</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;"><svg class="pips" data-p="ss"></svg><span style="font:11px/1 var(--mono);color:#d1d1d6;">2/2</span></div>
    <div style="text-align:right;font-family:var(--mono);line-height:1;"><div><span style="font-size:18px;font-weight:600;">81</span><span style="display:inline-block;width:18px;margin-left:3px;text-align:left;font-size:11px;color:#a1a1a6;">B+</span></div><div style="font-size:10px;color:#6e6e73;margin-top:5px;">done</div></div>
    <svg class="thumb" data-tpl="D" data-flip="1" data-rate="1" width="62" height="50" viewBox="0 0 248 200" aria-hidden="true"></svg>
    <span style="color:#6e6e73;font-size:12px;">›</span>
  </div>

  <!-- R9 (runs off the bottom edge: the list scrolls) -->
  <div class="row" style="display:grid;grid-template-columns:48px 22px minmax(0,1fr) 100px 60px 62px 10px;column-gap:12px;align-items:center;height:56px;padding:0 10px 0 12px;border-bottom:1px solid #1c1c1e;">
    <div style="font-family:var(--mono);line-height:1;"><div style="font-size:11px;color:#d1d1d6;">16:40</div><div style="font-size:10px;color:#6e6e73;margin-top:6px;">1h20</div></div>
    <div style="width:22px;height:22px;box-sizing:border-box;border:1px solid #2c2c2e;border-radius:5px;display:grid;place-items:center;font:600 10px/1 var(--mono);color:#d1d1d6;">PI</div>
    <div style="min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;"><span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;">rewind 插件：从任意消息分支</span><span style="flex:none;font:11px var(--mono);color:#6e6e73;">rewind-plugin · pi-2</span></div>
      <div style="margin-top:5px;font-size:12px;color:#a1a1a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">分支模型想清楚了，但编辑后重试没有测试覆盖。</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;"><svg class="pips" data-p="ssp"></svg><span style="font:11px/1 var(--mono);color:#d1d1d6;">2/3</span></div>
    <div style="text-align:right;font-family:var(--mono);line-height:1;"><div><span style="font-size:18px;font-weight:600;">72</span><span style="display:inline-block;width:18px;margin-left:3px;text-align:left;font-size:11px;color:#a1a1a6;">B</span></div><div style="font-size:10px;color:#6e6e73;margin-top:5px;">done</div></div>
    <svg class="thumb" data-tpl="E" data-flip="1" data-rate=".67" width="62" height="50" viewBox="0 0 248 200" aria-hidden="true"></svg>
    <span style="color:#6e6e73;font-size:12px;">›</span>
  </div>
</main>

<!-- ============ SELECTED RAIL 296 ============ -->
<aside aria-label="Selected session" style="border-left:1px solid #2c2c2e;padding:16px 23px 16px 24px;display:flex;flex-direction:column;min-height:0;overflow:hidden;">
  <div style="height:16px;display:flex;justify-content:space-between;align-items:center;font:10px/1 var(--mono);color:#8e8e93;">
    <span style="letter-spacing:.1em;">SECTOR CAM</span><span>10/20 · 14:05</span>
  </div>

  <!-- Sector Cam HUD, 248×264, unchanged from preview/live-hud-opus.html except the sample values -->
  <section aria-label="Sector Cam" style="position:relative;width:248px;height:264px;margin-top:8px;flex:none;background:#141416;border:1px solid #2c2c2e;border-radius:10px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.25);">
    <div style="position:relative;height:200px;">
      <svg id="track" viewBox="0 0 248 200" width="248" height="200" aria-hidden="true" style="display:block;"></svg>
      <div style="position:absolute;left:12px;top:9px;display:flex;align-items:center;gap:6px;font:500 10px/1 var(--mono);letter-spacing:.08em;">
        <span style="width:6px;height:6px;border-radius:50%;background:#30d158;"></span>
        <span style="color:#f2f2f7;">LIVE</span>
        <span style="color:#8e8e93;">1h12</span>
      </div>
    </div>
    <div style="height:64px;border-top:1px solid #2c2c2e;background:#1c1c1e;padding:0 12px;box-sizing:border-box;display:grid;grid-template-rows:34px 22px;">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:3px;">
        <div style="font-size:12px;line-height:1;white-space:nowrap;"><span style="font-weight:600;color:#f2f2f7;">deepseek-v4</span><span style="color:#8e8e93;"> · executor</span></div>
        <div style="font-family:var(--mono);line-height:1;white-space:nowrap;"><span style="font-size:20px;font-weight:600;letter-spacing:-.02em;color:#f2f2f7;">42</span><span style="font-size:10px;color:#8e8e93;margin-left:3px;">tok/s</span></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;font:10px/1 var(--mono);white-space:nowrap;">
        <span style="color:#a1a1a6;">S2 · T4→T6 · <b style="color:#f2f2f7;font-weight:600;">67%</b></span>
        <span style="display:flex;gap:9px;font-family:var(--sans);font-size:10.5px;">
          <span style="color:#d1d1d6;"><b style="color:#ffb340;font-weight:400;">⚑</b> 等待审批</span>
          <span style="color:#d1d1d6;"><b style="color:#ff453a;font-weight:400;">▲</b> 测试 ×1</span>
        </span>
      </div>
    </div>
  </section>

  <!-- identity + score -->
  <div style="margin-top:16px;font-size:14px;font-weight:600;line-height:20px;">本地 coding agent 对话记录可视化时间线</div>
  <div style="margin-top:4px;font:11px/1 var(--mono);color:#8e8e93;">trajecable · DSH · deepseek-v4</div>
  <div style="margin-top:14px;display:flex;align-items:flex-end;justify-content:space-between;">
    <div style="display:flex;align-items:baseline;gap:6px;"><span style="font:600 32px/1 var(--mono);letter-spacing:-.03em;">74</span><span style="font:600 14px/1 var(--mono);color:#d1d1d6;">B+</span></div>
    <div style="text-align:right;font:10px/1 var(--mono);color:#8e8e93;">
      <div style="font-family:var(--sans);font-size:11px;color:#a1a1a6;">临时分 · ongoing</div>
      <div style="margin-top:6px;">2/3 closed · −8 · 封顶 84</div>
    </div>
  </div>

  <!-- race engineer -->
  <div style="margin-top:16px;padding-top:14px;border-top:1px solid #2c2c2e;">
    <div style="font:10px/1 var(--mono);letter-spacing:.1em;color:#8e8e93;">RACE ENGINEER <span style="color:#ffb340;letter-spacing:0;">⚑</span> <span style="letter-spacing:0;">watch</span></div>
    <div style="display:grid;grid-template-columns:28px 1fr;row-gap:6px;margin-top:10px;font-size:12px;line-height:18px;">
      <span style="font-size:11px;color:#6e6e73;">判断</span><span style="color:#d1d1d6;">数据层已稳，评分规则清楚；视觉层还在迭代。</span>
      <span style="font-size:11px;color:#6e6e73;">建议</span><span style="color:#d1d1d6;">先定全局页结构，再细调 HUD 比例。</span>
      <span style="font-size:11px;color:#6e6e73;">风险</span><span style="color:#d1d1d6;">预览稿已有 60 多个，容易把草图当规格。</span>
    </div>
  </div>

  <!-- key stats -->
  <div style="margin-top:14px;padding-top:14px;border-top:1px solid #2c2c2e;display:grid;grid-template-columns:repeat(4,1fr);row-gap:12px;font-family:var(--mono);">
    <div><div style="font-size:10px;color:#8e8e93;">FRESH</div><div style="font-size:13px;margin-top:5px;">182k</div></div>
    <div><div style="font-size:10px;color:#8e8e93;">PROC</div><div style="font-size:13px;margin-top:5px;">1.4M</div></div>
    <div><div style="font-size:10px;color:#8e8e93;">CPLX</div><div style="font-size:13px;margin-top:5px;">7.2</div></div>
    <div><div style="font-size:10px;color:#8e8e93;">DAYS</div><div style="font-size:13px;margin-top:5px;">1</div></div>
    <div><div style="font-size:10px;color:#8e8e93;">PROMPTS</div><div style="font-size:13px;margin-top:5px;">14</div></div>
    <div><div style="font-size:10px;color:#8e8e93;">TOOLS</div><div style="font-size:13px;margin-top:5px;">96</div></div>
    <div><div style="font-size:10px;color:#8e8e93;">FILES</div><div style="font-size:13px;margin-top:5px;">12</div></div>
    <div><div style="font-size:10px;color:#8e8e93;">TESTS</div><div style="font-size:13px;margin-top:5px;">3<span style="color:#ff453a;font-size:11px;"> 1✕</span></div></div>
  </div>

  <div style="margin-top:14px;padding-top:14px;border-top:1px solid #2c2c2e;">
    <div style="font:10px/1 var(--mono);letter-spacing:.1em;color:#8e8e93;">STILL OPEN · 1</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;line-height:18px;color:#d1d1d6;"><svg width="6" height="6" style="flex:none;"><rect x=".5" y=".5" width="5" height="5" rx="1.2" fill="none" stroke="#f2f2f7"/><rect width="3" height="6" fill="#f2f2f7"/></svg>全局 Race Log 与 HUD 设计<span style="margin-left:auto;font:10px var(--mono);color:#8e8e93;">partial</span></div>
  </div>

  <div style="margin-top:auto;padding-top:12px;border-top:1px solid #2c2c2e;display:flex;gap:16px;font-size:11px;color:#a1a1a6;">
    <span>打开会话 ↗</span><span>重新评分</span><span style="margin-left:auto;font:10px var(--mono);color:#6e6e73;">J / K</span>
  </div>
</aside>
</div>
</div>

<!-- shared thumbnail geometry: one path per template, referenced by every row -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs id="thumb-defs"></defs></svg>

<script>
// ---------- Sector Cam: camera and track (same code as preview/live-hud-opus.html) ----------
const C = Math.SQRT1_2;
const CAM = { cx: 124, vc: 130, H: 380, F: 537, sx: 124, sy: 89 };
function proj(X, Y, Z = 0) {
  const dx = X - CAM.cx, dy = Y - (CAM.vc - CAM.H), dz = Z - CAM.H;
  const zc = (dy - dz) * C, yc = (dy + dz) * C;
  return [CAM.sx + CAM.F * dx / zc, CAM.sy - CAM.F * yc / zc];
}
const W = 12;
const PLAN = [['line', 90], ['arc', 32, -90, 'T4'], ['line', 48], ['arc', 28, 90, 'T5'], ['line', 50], ['arc', 40, 45, 'T6'], ['line', 24], ['arc', 40, -45], ['line', 110]];
function sample(start, heading, plan, step = 1.5) {
  const pts = [], corners = [];
  let [x, y] = start, h = heading * Math.PI / 180, s = 0;
  pts.push({ x, y, h, s });
  for (const [kind, a, b, label] of plan) {
    if (kind === 'line') {
      const n = Math.ceil(a / step);
      for (let i = 0; i < n; i++) { x += Math.cos(h) * a / n; y += Math.sin(h) * a / n; s += a / n; pts.push({ x, y, h, s }); }
    } else {
      const R = a, turn = b * Math.PI / 180, len = Math.abs(turn) * R, n = Math.ceil(len / step), s0 = s;
      for (let i = 0; i < n; i++) {
        const dh = turn / n, mid = h + dh / 2, chord = 2 * R * Math.sin(Math.abs(dh) / 2);
        x += Math.cos(mid) * chord; y += Math.sin(mid) * chord; h += dh; s += len / n; pts.push({ x, y, h, s });
      }
      if (label) corners.push({ label, s: (s0 + s) / 2, dir: Math.sign(b) });
    }
  }
  return { pts, corners, total: s };
}
const f1 = n => n.toFixed(1);
const ptsStr = arr => arr.map(([a, b]) => f1(a) + ',' + f1(b)).join(' ');
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; }
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

(function drawHud() {
  const svg = document.getElementById('track');
  const { pts, corners, total } = sample([56, -40], 90, PLAN);
  const at = s => pts.reduce((b, p) => Math.abs(p.s - s) < Math.abs(b.s - s) ? p : b);
  const off = (p, d) => [p.x - Math.sin(p.h) * d, p.y + Math.cos(p.h) * d];
  const CAR_S = 186, END = total;
  const SECTORS = [{ s: 66, label: 'S2' }, { s: 262, label: 'S3' }];
  function ribbon(s0, s1, { z = 0, shiftX = 0, shiftY = 0 } = {}) {
    const seg = pts.filter(p => p.s >= s0 && p.s <= s1);
    const L = seg.map(p => { const [x, y] = off(p, W); return proj(x + shiftX, y + shiftY, z); });
    const R = seg.map(p => { const [x, y] = off(p, -W); return proj(x + shiftX, y + shiftY, z); }).reverse();
    return ptsStr(L.concat(R));
  }
  const line = (s0, s1, d = 0) => 'M' + pts.filter(p => p.s >= s0 && p.s <= s1).map(p => proj(...off(p, d)).map(f1).join(',')).join('L');
  const grid = el('g', { stroke: '#232326', 'stroke-width': .75, fill: 'none' }, svg);
  for (let X = -80; X <= 330; X += 40) el('path', { d: 'M' + proj(X, -20).map(f1) + 'L' + proj(X, 320).map(f1) }, grid);
  for (let Y = 0; Y <= 320; Y += 40) el('path', { d: 'M' + proj(-120, Y).map(f1) + 'L' + proj(370, Y).map(f1) }, grid);
  const t4 = corners.find(c => c.label === 'T4');
  { const seg = pts.filter(p => p.s >= t4.s - 26 && p.s <= t4.s + 22);
    el('polygon', { points: ptsStr(seg.map(p => proj(...off(p, W + 17))).concat(seg.map(p => proj(...off(p, W + 3))).reverse())), fill: '#ff453a', 'fill-opacity': .14 }, svg); }
  for (const d of [W + 7, W + 12]) el('path', { d: line(t4.s - 22, t4.s + 18, d), fill: 'none', stroke: '#ff453a', 'stroke-opacity': .6, 'stroke-width': 1, 'stroke-dasharray': '1.5 3' }, svg);
  el('polygon', { points: ribbon(0, END, { z: -6, shiftX: 3, shiftY: -3.5 }), fill: '#000', 'fill-opacity': .55 }, svg);
  el('polygon', { points: ribbon(0, CAR_S, { z: -6 }), fill: '#6e6e73' }, svg);
  el('polygon', { points: ribbon(CAR_S, END, { z: -6 }), fill: '#0a0a0b' }, svg);
  el('polygon', { points: ribbon(CAR_S, END), fill: '#2c2c2e', stroke: '#3a3a3c', 'stroke-width': .75 }, svg);
  el('polygon', { points: ribbon(0, CAR_S + .5), fill: '#dcdce0' }, svg);
  for (const c of corners) {
    const d = c.dir * (W + 1.6);
    el('path', { d: line(c.s - 20, c.s + 20, d), fill: 'none', stroke: '#48484a', 'stroke-width': 2.4 }, svg);
    el('path', { d: line(c.s - 20, c.s + 20, d), fill: 'none', stroke: '#d1d1d6', 'stroke-width': 2.4, 'stroke-dasharray': '2.5 2.5' }, svg);
  }
  el('path', { d: line(CAR_S + 8, END), fill: 'none', stroke: '#8e8e93', 'stroke-width': 1.2, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round' }, svg);
  for (const sec of SECTORS) {
    const p = at(sec.s), a = proj(...off(p, W)), b = proj(...off(p, -W)), done = sec.s < CAR_S;
    el('path', { d: `M${a.map(f1)}L${b.map(f1)}`, stroke: done ? '#1c1c1e' : '#f2f2f7', 'stroke-opacity': done ? .9 : .7, 'stroke-width': 1.25 }, svg);
    const [lx, ly] = proj(...off(p, done ? W + 7 : -(W + 7)));
    el('text', { x: f1(lx), y: f1(ly + 3.5), 'text-anchor': done ? 'end' : 'start', fill: '#6e6e73', 'font-size': 10, 'font-family': MONO }, svg).textContent = sec.label;
  }
  for (const c of corners) {
    const [x, y] = proj(...off(at(c.s), (c.label === 'T4' ? 1 : -1) * c.dir * (W + 15)));
    el('text', { x: f1(x), y: f1(y + 3.5), 'text-anchor': 'middle', fill: '#8e8e93', 'font-size': 10, 'font-family': MONO }, svg).textContent = c.label;
  }
  const car = at(CAR_S);
  { const base = proj(...off(at(CAR_S + 10), W + 5)), top = proj(...off(at(CAR_S + 10), W + 5), 20);
    el('ellipse', { cx: f1(base[0] + 1), cy: f1(base[1] + .5), rx: 3, ry: 1.4, fill: '#000', 'fill-opacity': .5 }, svg);
    el('line', { x1: f1(base[0]), y1: f1(base[1]), x2: f1(top[0]), y2: f1(top[1]), stroke: '#c7c7cc', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, svg);
    el('path', { d: `M${f1(top[0])},${f1(top[1])} h9 l-2.2,3 l2.2,3 h-9 z`, fill: '#ffb340', stroke: '#141416', 'stroke-width': .8 }, svg); }
  { const p = proj(...off(at(t4.s - 2), W + 10));
    el('ellipse', { cx: f1(p[0] + 1), cy: f1(p[1] + .5), rx: 4.5, ry: 1.8, fill: '#000', 'fill-opacity': .5 }, svg);
    el('path', { d: `M${f1(p[0])},${f1(p[1] - 10)} l5.5,9.5 h-11 z`, fill: '#ff453a', stroke: '#141416', 'stroke-width': 1, 'stroke-linejoin': 'round' }, svg); }
  { const g = proj(car.x, car.y), body = proj(car.x, car.y, 2.5), nx = at(CAR_S + 3), ahead = proj(nx.x, nx.y);
    const ang = Math.atan2(ahead[1] - g[1], ahead[0] - g[0]) * 180 / Math.PI;
    el('ellipse', { cx: f1(g[0] + 1.5), cy: f1(g[1] + 1.5), rx: 8, ry: 4, fill: '#000', 'fill-opacity': .35 }, svg);
    el('circle', { id: 'car-halo', cx: f1(body[0]), cy: f1(body[1]), r: 7, fill: 'none', stroke: '#ff453a', 'stroke-width': 1.5 }, svg);
    const cg = el('g', { transform: `translate(${f1(body[0])},${f1(body[1])}) rotate(${f1(ang)})` }, svg);
    el('rect', { x: -7, y: -4.25, width: 14, height: 8.5, rx: 4.25, fill: '#ff453a', stroke: '#141416', 'stroke-width': 1.5 }, cg);
    el('circle', { cx: 2, cy: 0, r: 1.6, fill: '#141416' }, cg); }
  { const X = 240, Y = 236, tip = proj(X, Y + 9), l = proj(X - 5, Y - 4), m = proj(X, Y - 1), r = proj(X + 5, Y - 4);
    el('path', { d: `M${tip.map(f1)}L${r.map(f1)}L${m.map(f1)}L${l.map(f1)}Z`, fill: '#d1d1d6' }, svg);
    el('text', { x: f1(m[0]), y: f1(m[1] + 12), 'text-anchor': 'middle', fill: '#d1d1d6', 'font-size': 10, 'font-weight': 600, 'font-family': MONO }, svg).textContent = 'N'; }
})();

// ---------- Row thumbnails: whole run, same 45° camera, one shared path per template ----------
// In production these path strings are generated once at build time; rows only reference them.
const TEMPLATES = {
  A: { start: [56, -40], plan: PLAN },
  B: { start: [196, -40], plan: [['line', 70], ['arc', 30, 90], ['line', 70], ['arc', 30, -90], ['line', 40], ['arc', 34, -60], ['line', 30], ['arc', 34, 60], ['line', 140]] },
  C: { start: [70, -40], plan: [['line', 70], ['arc', 36, -70], ['line', 74], ['arc', 26, 140], ['line', 60], ['arc', 36, -70], ['line', 160]] },
  D: { start: [150, -40], plan: [['line', 60], ['arc', 30, 60], ['line', 50], ['arc', 30, -120], ['line', 50], ['arc', 30, 60], ['line', 40], ['arc', 40, 40], ['line', 30], ['arc', 40, -40], ['line', 140]] },
  E: { start: [60, -40], plan: [['line', 100], ['arc', 40, -90], ['line', 70], ['arc', 28, 90], ['line', 20], ['arc', 28, 90], ['line', 40], ['arc', 30, -90], ['line', 160]] },
};
const defs = document.getElementById('thumb-defs');
for (const [id, t] of Object.entries(TEMPLATES)) {
  // Same camera and crop as the Sector Cam; keep only the part inside the frame.
  const P = sample(t.start, 90, t.plan, 4).pts.map(p => proj(p.x, p.y)).filter(([x, y]) => y > -24 && y < 224);
  el('path', { id: 'tpl-' + id, pathLength: 100, d: 'M' + P.map(([x, y]) => f1(x) + ',' + f1(y)).join('L') }, defs);
}
{ const g = el('g', { id: 'thumb-grid', stroke: '#232326', 'stroke-width': 3, fill: 'none' }, defs);
  for (let X = -80; X <= 330; X += 40) el('path', { d: 'M' + proj(X, -20).map(f1) + 'L' + proj(X, 320).map(f1) }, g);
  for (let Y = 0; Y <= 320; Y += 40) el('path', { d: 'M' + proj(-120, Y).map(f1) + 'L' + proj(370, Y).map(f1) }, g); }

for (const svg of document.querySelectorAll('svg.thumb')) {
  el('use', { href: '#thumb-grid' }, svg);
  const id = svg.dataset.tpl;
  if (!id) continue;                                   // unscored: the camera shows ground, no road
  const rate = +svg.dataset.rate, D = rate * 100;
  const g = el('g', svg.dataset.flip ? { transform: 'translate(248,0) scale(-1,1)' } : {}, svg);
  const use = (a) => el('use', Object.assign({ href: '#tpl-' + id, fill: 'none', 'stroke-linejoin': 'round' }, a), g);
  use({ transform: 'translate(5,8)', stroke: '#000', 'stroke-opacity': .55, 'stroke-width': 24 });
  use({ transform: 'translate(0,5)', stroke: '#0a0a0b', 'stroke-width': 22 });
  use({ transform: 'translate(0,5)', stroke: '#6e6e73', 'stroke-width': 22, 'stroke-dasharray': `${D} 100` });
  use({ stroke: '#3a3a3c', 'stroke-width': 23 });
  use({ stroke: '#2c2c2e', 'stroke-width': 19 });
  use({ stroke: '#dcdce0', 'stroke-width': 23, 'stroke-dasharray': `${D} 100` });
  const path = document.getElementById('tpl-' + id);
  const pt = path.getPointAtLength(path.getTotalLength() * rate);
  el('circle', { cx: f1(pt.x), cy: f1(pt.y), r: 14, fill: svg.dataset.sel ? '#ff453a' : '#f2f2f7', stroke: '#141416', 'stroke-width': 5 }, g);
}

// ---------- Problem pips ----------
for (const svg of document.querySelectorAll('svg.pips')) {
  const p = svg.dataset.p, S = 6, G = 3;
  svg.setAttribute('width', p.length * (S + G) - G); svg.setAttribute('height', S);
  [...p].forEach((c, i) => {
    const x = i * (S + G);
    if (c === 's') el('rect', { x, y: 0, width: S, height: S, rx: 1.5, fill: '#f2f2f7' }, svg);
    if (c === 'p') { el('rect', { x: x + .5, y: .5, width: S - 1, height: S - 1, rx: 1.2, fill: 'none', stroke: '#f2f2f7' }, svg); el('rect', { x, y: 0, width: S / 2, height: S, fill: '#f2f2f7' }, svg); }
    if (c === 'o') el('rect', { x: x + .5, y: .5, width: S - 1, height: S - 1, rx: 1.2, fill: 'none', stroke: '#6e6e73' }, svg);
    if (c === 'a') el('rect', { x: x + .5, y: .5, width: S - 1, height: S - 1, rx: 1.2, fill: 'none', stroke: '#ff453a' }, svg);
  });
}

// ---------- Season sparkline: dayScore line + one ring per session final ----------
(function spark() {
  const svg = document.getElementById('spark'), Wd = svg.getBoundingClientRect().width, Ht = 72;
  svg.setAttribute('viewBox', `0 0 ${Wd} ${Ht}`);
  const days = ['14', '15', '16', '17', '18', '19', '20'];
  const day = [68, 72, null, 66, 79, 70, 75];                       // sample dayScore
  const finals = [[71, 58], [80, 66, 90], [], [62, 70], [81, 77, 72], [62, 78], [90, 62, 74]];
  const LIVE = { d: 6, j: 2 };                                      // selected session = the live one
  const L = 16, R = 40, x = i => L + i * (Wd - L - R) / 6, y = v => 6 + (100 - v) / 60 * 48;
  el('line', { x1: 0, x2: Wd - 26, y1: f1(y(71)), y2: f1(y(71)), stroke: '#3a3a3c', 'stroke-dasharray': '2 3' }, svg);
  el('text', { x: Wd, y: f1(y(71) + 3.5), 'text-anchor': 'end', fill: '#8e8e93', 'font-size': 10, 'font-family': MONO }, svg).textContent = 'avg';
  let d = '';
  day.forEach((v, i) => { if (v == null) return; d += (d && day[i - 1] != null ? 'L' : 'M') + f1(x(i)) + ',' + f1(y(v)); });
  el('path', { d, fill: 'none', stroke: '#6e6e73', 'stroke-width': 1 }, svg);
  const fx = (i, j, n) => x(i) + (j - (n - 1) / 2) * 9;
  finals.forEach((vs, i) => vs.forEach((v, j) => {
    if (i === LIVE.d && j === LIVE.j) return;
    el('circle', { cx: f1(fx(i, j, vs.length)), cy: f1(y(v)), r: 3.5, fill: '#0f0f10', stroke: '#a1a1a6', 'stroke-width': 1.2 }, svg);
  }));
  day.forEach((v, i) => { if (v != null) el('circle', { cx: f1(x(i)), cy: f1(y(v)), r: 1.8, fill: '#d1d1d6' }, svg); });
  const lv = finals[LIVE.d][LIVE.j];
  el('circle', { cx: f1(fx(LIVE.d, LIVE.j, finals[LIVE.d].length)), cy: f1(y(lv)), r: 4.5, fill: '#ff453a', stroke: '#0f0f10', 'stroke-width': 1.5 }, svg);
  days.forEach((t, i) => el('text', { x: f1(x(i)), y: Ht - 2, 'text-anchor': 'middle', fill: i === 6 ? '#d1d1d6' : '#6e6e73', 'font-size': 10, 'font-family': MONO }, svg).textContent = t);
})();
</script>
</body>
</html>
```

## 4. How the global page and the local HUD relate

**One component, two places.** `SectorCam` takes `{ session, mode: 'live' | 'replay', width }`.

| Placement | Shows | Follows | Filters |
|---|---|---|---|
| Chat corner | The chat's own session, always `live` | The chat | Ignores page filters |
| Race Log rail | The selected run, `live` or `replay` | Page selection | Selection respects page filters |

Both placements build the road from the same template, keyed by session key. So a row thumbnail, the rail HUD and the chat HUD always show the same road. Decision order gives the T# numbers in both the HUD corners and the expanded `DECISIONS` list.

**Selection**

- On load, select the newest run by last activity in the current filter. A live run is the newest by definition.
- A click on a row, its thumbnail or a sparkline ring selects that run. `J` / `K` move the selection. `Enter` expands the selected row. A click on the caret both selects and expands.
- The rail is the instrument: HUD, score, comment, key numbers. The inline expansion is the logbook: problems, decisions, files and commands. They never show the same block twice. The only repeat is the open problem, which also appears in `STILL OPEN`.
- Selection shows in three linked places, all as the red car: the row (white 2 px bar + red thumbnail car), the sparkline (filled red dot) and the HUD (red car).
- Selection is stored in the URL (`?session=<key>`). A click on the chat-corner HUD opens Race Log with that run selected and scrolled into view.

**Live state**

- A live row shows a green dot and `LIVE` in the time column. Its score reads `ongoing`, and its thumbnail car moves when `completion` changes.
- If the user selects an older run while a run is live, the rail switches to replay. The `SECTOR CAM` label row is replaced by a 28 px pill `● LIVE · 67% · 42 tok/s`; a click returns to the live run. This is the same pill as the HUD's collapsed form below 200 px.

| HUD field | Live | Replay (finished run) |
|---|---|---|
| Top-left chip | `● LIVE 1h12` (elapsed) | `FINAL 10/19` (no green) |
| Big number | `42 tok/s` | Fresh fuel `182k fresh`, or `—` with no usage |
| Sector line | `S2 · T4→T6 · 67%` | `T5→T7 · 43%`; car at `completion.rate` |
| Conditions (max 2) | Approval ⚑, test failures ▲ | Open problems `⚑ 4 未收口`, failures ▲ |
| Car halo | Pulses | Static |
| Unscored run | — | Ground grid only, `未评分`, and `Summarize` in the rail |
| Antigravity | — | HUD hidden; the rail shows metadata only |

**Filtering**

- Range, agent, project and search change the season strip and the timeline together.
- If the selected run stays visible, it stays selected. Otherwise the selection moves to the newest visible run.
- The live pill stays even when the live run is filtered out.
- The chat-corner HUD never reacts to page filters.

## 5. How it scales

**600+ sessions**

- **Virtualized list.** Every item has a known height: day header 36, row 56, Antigravity row 40, expansion measured once. Offsets come from a prefix-sum array. Render the visible rows plus 8 above and below (about 30 rows in the DOM).
- **Thumbnails cost almost nothing.**
  - K templates (6 is enough; mirroring doubles it) are projected **once at build time** into one hidden `<defs>`. The template is `hash(key) % K`; the mirror is one hash bit.
  - Each row is one small SVG with 7 nodes: grid `<use>`, 5 road `<use>`s and the car circle.
  - Completion is `stroke-dasharray: rate 100` on a `pathLength=100` path, so 600 rows share 6 paths.
  - The car position comes from a 21-point lookup per template (5 % steps), so scrolling never calls `getPointAtLength`.
- **One full geometry.** Only the rail HUD (and the chat HUD) builds the ribbon, wall and shadow. It is memoized by `session key + camera window`. A live update only re-cuts at the car.
- **Load row data first, details on demand.** The index returns row fields only, roughly 300 B per run. Problems, decisions, files and commands load on expand.
- **Season strip.** Aggregates come from the same index. Sparkline buckets are days for 7D and 30D, and weeks for ALL (60 x-positions at most). With more than about 120 finals in range, the per-run rings become one min–max tick per bucket.
- **Scoring.** Auto-scoring updates one row and the strip in place. The list never re-renders as a whole.

**Narrow widths** (I have not rendered these widths)

| Width | Changes |
|---|---|
| ≥ 1200 | As specified |
| 1024–1199 | The rail stays 296. The agent bar and legend move into a hover on `94 sessions`. The `project · model` meta drops the model |
| 900–1023 | Main column ≈ 556. The row drops the pips column; `3/7` moves under the score (`3/7 · done`). Time column 44, thumbnail stays 62 × 50. The header merges Agent and Project into one `Filter (n)` button; search shrinks to 160. The season strip becomes `avg | counts in one line | sparkline` |
| < 900 (outside the brief) | The rail disappears. The expanded row puts the 248 × 264 Sector Cam on its left and the details on its right. The live pill moves into the header |

Type never goes below 10 px. When space runs out, columns are removed, not shrunk.

## 6. What not to do

- **No hero and no card wall.** The season strip is one 104 px band with three counts and one line chart. No metric cards, radar, Paddock or Fuel Map on this page. If those are needed, put them in a second view.
- **One run is one row, not a card.** No per-run panels, nested dark blocks or "RACE 07" headers. The only panel on the page is the HUD.
- **No full 3D track per row.** Thumbnails are shared static paths. Only the selected run gets the ribbon, wall and shadow.
- **No second camera language.** Thumbnails use the same 45°, north-up, open-ended road as the HUD. No flat maps, isometric diamonds or closed loops.
- **Do not enlarge or restyle the HUD in the rail.** It stays 248 × 264, unchanged. Do not add tabs, leaderboards or event lists around it.
- **No new colours.**
  - No per-model colours and no blue or magenta decision colours from `race-design.md`; shapes carry the decision type.
  - Red means only the car and incidents. Amber means only flag, watch and risk. Green means only LIVE.
  - Selection chrome is white, not red.
- **No fake data.**
  - Unscored runs show `—` and `Summarize`: no score, no road, no pips.
  - Antigravity runs show no track and no token values.
  - Do not show `LAP` without a source.
- **No ranking.** Never sort the timeline by score. Do not label the season as a model comparison.
- **No paper, cream, gradients, glows or extra shadows.** No text below 10 px, and no labels on the road surface.
- **Do not fix composition by adding things.** If a screen feels empty, tighten the spacing; do not add a widget.

Two choices differ from the source documents: I replaced the HUD's `LAP 03` with elapsed time, and I dropped the decision colours from `race-design.md` (shapes carry the type). The scratch render is still in `/tmp/racelog/`; it is safe to delete.
