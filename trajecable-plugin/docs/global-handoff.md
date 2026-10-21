# Global Race Log handoff — design brief for Opus 5.5

## 0. Context

The live HUD is now designed: **Sector Cam**, a 248×264 panel with a 45° overhead camera, a cropped open section of the global circuit, north-up, track 76% of the panel, data strip at the bottom. It is in `preview/live-hud-opus.html` and `docs/reviews/hud-opus-5-5.md`.

The user likes it: “优雅。那全局的设计呢？”

This brief is for the **global page** that contains the live HUD. It is the Trajectory / Race Log page inside DSH, not the HUD itself.

## 1. Product

`trajecable` is a DSH plugin. It scans local coding-agent session logs (DSH, Claude Code, Codex, Pi, Epi, Grok, Antigravity) and shows a **session timeline**. Each session has:

- agent, model, title, project, start/end;
- a score and grade, completion (problems solved / total), state;
- a short AI summary and an AI comment (judgement, advice, risk);
- problems, decisions, days, files, tests, commands;
- a track representation.

The current Stage Log page (light, paper-like) is implemented and live at v0.4.0. The new design should keep its information architecture but adopt the **Sector Cam** visual language.

## 2. User intent

- They want the HUD to feel like a **race broadcast / timing tower**, not a dashboard.
- They want the global page to feel like the same product, not a separate admin screen.
- They care about composition, proportions, and restraint; they rejected several card-heavy/dashboard versions.
- They want one session = one **run**, with a score, completion and a comment.
- They want the global view to make the season legible, and the HUD to show the selected/live session.

## 3. Hard requirements

1. **Page**: full DSH content area, designed at **1280×900** (and responsive down to 900 wide). Dark theme, same surfaces as the HUD.
2. **Header**: product title `轨迹 / RACE CONTROL` or similar; date range; agent/project filters; search. Keep it one compact bar, not a hero.
3. **Season strip**: one global overview of the selected range:
   - average score + grade;
   - sessions, scored, cleared;
   - a score-over-time sparkline or small trajectory;
   - optional model/agent distribution.
   It must not become a wall of metric cards.
4. **Timeline**: sessions grouped by day, newest first. Each session is a **row**, not a big card:
   - time, agent mark, title;
   - one-line AI comment or summary;
   - completion pips / problems closed;
   - score + grade;
   - a small **45° track thumbnail** (open sector, same language as Sector Cam) on the right;
   - expand for problems, decisions, detail.
5. **Selected session**: a right rail (or an inline expanded area) with the full **Sector Cam HUD** (248×264), plus the comment and key stats. On page load, select the latest session.
6. **Scale**: there can be 600+ sessions. Do not render 600 full 3D tracks. Thumbnails must be cheap (a simplified static SVG or a single projected segment); only the selected/live HUD uses full geometry.
7. **Visual language**: dark surfaces (`#0f0f10`, `#141416`, `#1c1c1e`), hairlines `#2c2c2e`, white text, red `#ff453a`, amber `#ffb340`, green only for LIVE. Sans for UI, mono for time/score/telemetry, 10 px minimum. No paper, no cream, no heavy cards, no gradients, no shadows except one quiet panel layer.
8. **Layout**: one clear reading axis; the timeline is the main column, the selected HUD is a narrow rail. Avoid nested cards and dashboard grid noise.
9. **Empty/partial states**: unscored session rows show `Summarize`; no fake scores. Antigravity sessions have no track geometry; show a simple metadata row.
10. **Implementable** as React + SVG; no external assets, no canvas-only.

## 4. Information architecture

```
Header: 轨迹 / RACE CONTROL     range   agent   project   search
Season strip: average score · sessions · scored · cleared · sparkline
Main column (max ~760)                 Selected rail (~300)
  10/19 MON
  ─ session row 1  [track thumb]       [Sector Cam 248×264]
  ─ session row 2  [track thumb]       score / grade / state
  ─ session row 3  [track thumb]       comment / problems
  10/18 SUN
  ...
```

The rail may be sticky. The timeline rows should be compact enough to scan 8–12 sessions on one screen.

## 5. Sample data

Use realistic sample sessions from the existing `preview/data.json` or the Stage Log sample:

- `给时间线加上 agent 总结`, DSH, deepseek-v4, 62 C, 3/7 closed, comment about scope creep.
- `修复 ask user 双端确认问题`, DSH, 78 B+, 4/4 closed, comment about de-risking.
- `关掉 OKR 日报与周报任务`, Claude Code, 90 A, 3/3 closed, comment about backup discipline.
- `本地 coding agent 对话记录可视化时间线`, DSH, 74 B+, 2/3, ongoing.
- `分析各套餐 Opus5.5 价格系数`, DSH, 62 C, 4/5.

Do not invent new visual values that have no data source. If you need a value, mark it as sample.

## 6. Deliverable

Return one Markdown response:

1. **Concept name and rationale.**
2. **Layout spec** with exact sizes, grid, spacing, type sizes, colors.
3. **A standalone HTML+CSS+SVG sketch** at 1280×900 using inline styles and sample rows. It must include:
   - header;
   - season strip;
   - at least 4 session rows across 2 days;
   - a selected session rail with a 248×264 Sector Cam (you can reuse/adapt the HUD from `preview/live-hud-opus.html`);
   - one expanded detail sample.
4. **How the global page and the local HUD relate** (selection, live state, filtering).
5. **How it scales** to 600 sessions and narrow widths.
6. **What not to do**, based on the rejected versions.

Do not edit the repository. Do not write plugin code. Design only.
