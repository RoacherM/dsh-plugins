# Race Log redesign — implementation spec

Status: approved structure; implementation not started.
Supersedes the Stage Log page (v0.4.0) visual layer. The summary/scoring backend stays.

References:

- Approved global structure: `preview/global-simple.html`, `preview/global-simple.png`
- Approved live HUD: `preview/live-hud-opus.html`, `preview/live-hud-opus.png`
- Design handoffs: `docs/hud-handoff.md`, `docs/global-handoff.md`
- Opus reviews: `docs/reviews/hud-opus-5-5.md`, `docs/reviews/global-opus-5-5.md`
- Existing implementation: `src/client/page.jsx`, `styles.js`, `i18n.jsx`, `api.js`

## 1. Goal

Replace the current Stage Log page with a quieter **Race Log**:

- the global page is a season timing screen: day-grouped session rows + one selected camera;
- the live HUD is a 45° overhead Sector Cam of the selected session;
- one session = one score, completion gate, AI comment, and track;
- fewer columns, no row thumbnails, no inline expanded dashboard;
- all text comes from i18n; page colours come from the DSH theme.

Non-goals:

- no backend schema change for this step;
- no new model calls;
- no full 3D orbit or user-rotatable camera;
- no per-row track thumbnails (removed to keep the page quiet);
- no new scoring rules.

## 2. Page layout

Design canvas: 1280×900, then responsive.

```
Header 56
Season strip 96
Body:
  main column (1fr, padding 0 24)      rail 300 (border-left)
    day header 42                        SECTOR CAM label
    session row 72                       HUD 248×264
    session row 72                       title / meta
    ...                                  score / gate
                                         comment
                                         open action
```

- Header: `轨迹 / RACE CONTROL`; range segmented control; search; filter button. No agent/project selects in the first version; the filter button opens them.
- Season: average score/grade, sessions, scored, cleared, one sparkline. No agent distribution, no extra metric cards.
- Day: `MM/DD DDD` + localized relative label + `N sessions · day score`.
- Session row: 46 time, 20 agent square, title + meta, one-line comment, 58 score/grade. Selected row: `#141416`, 2 px left white rule.
- Rail: label + time; HUD; title; score; gate; comment; `Open session`. No stats grid, no problems/decisions list.
- Row count: 5–12 visible; page scrolls only the main column; rail is sticky.

Responsive:

| Width | Behaviour |
|---|---|
| ≥ 1100 | 300 px rail, full layout |
| 900–1099 | 280 px rail; season sparkline narrows; rows keep 2 lines |
| 720–899 | rail drops below the season strip; HUD right-aligned; rows keep 72 px |
| < 720 | no rail; selecting a row opens the HUD in a sheet/dialog; rows show only time, title, score |

At 600+ sessions, the timeline must virtualize or window-render rows. The rail renders only the selected session.

## 3. Sector Cam

Reuse the approved Opus HUD (`preview/live-hud-opus.html`) as the reference, ported to React/SVG.

- Panel 248×264 in the 300 px rail; if Chinese labels do not fit, allow 276×264 (track 200, strip 64) but never clip text. The chat HUD uses the same component at 248.
- 45° pinhole camera, north-up. Do not use CSS `rotateX`/`skew`; project every ground point with the camera function. Glyphs (car, flags, labels) are billboards: project their anchor only; draw at fixed screen size.
- Open segment: enters bottom edge, exits top edge; 2–4 corners; no start/finish line; no closed loop.
- Completed road light (`#dcdce0`), remaining dark (`#2c2c2e`) with dashed centreline; side wall and contact shadow give thickness.
- Ground grid, sector lines, gravel trap; amber flag; red car/incident.
- Data strip: model, tok/s, sector/progress, at most two conditions. In the narrow rail use short labels (`审批`, `×2`) or icon+count; keep full labels in the chat mount and aria-label.
- Minimum type 10 px; no horizontal overflow at either width.
- `prefers-reduced-motion`: no halo animation.

Geometry source for this step:

- A deterministic plan per session key (hash) with 2–4 corners, using the decision count/kind when available; no random per render.
- `carRate = ai.completion.rate / 100` (fallback: elapsed time share); `T#` labels come from `ai.decisions`; `S#` from `ai.days`; flags from open problems and test failures.
- The same plan feeds the global rail and the chat HUD; do not generate a second track.
- If a session has no decisions, use a neutral 2-corner plan; do not show an empty panel.

## 4. Theme adaptation

The page follows the DSH theme. The HUD is a **monitor inset** and stays dark in both themes by design (like a timing screen). This is deliberate and must be documented in the UI.

Page tokens (map to existing DSH aliases where possible):

| Token | Dark | Light |
|---|---|---|
| `--tj-bg` | `#0f0f10` | `var(--dsw-alias-bg-layer-1)` |
| `--tj-s1` | `#141416` | `var(--dsw-alias-bg-layer-2)` |
| `--tj-s2` | `#1c1c1e` | `var(--dsw-alias-bg-overlay)` |
| `--tj-line` | `#2c2c2e` | `var(--dsw-alias-border-l1)` |
| `--tj-ink` | `#f2f2f7` | `var(--dsw-alias-label-primary)` |
| `--tj-ink2` | `#d1d1d6` | `var(--dsw-alias-label-primary)` |
| `--tj-mute` | `#8e8e93` | `var(--dsw-alias-label-secondary)` |
| `--tj-faint` | `#6e6e73` | `var(--dsw-alias-label-tertiary)` |
| `--tj-red` | `#ff453a` | `#c8443a` |
| `--tj-amber` | `#ffb340` | `#b77708` |
| `--tj-green` | `#30d158` | `#1f8f5f` |

Implementation: define these on `.tj-race`, with defaults for dark; override under the theme selector that DSH already uses. Check the live DOM for the exact attribute/class before coding; do not guess.

HUD tokens are fixed (dark monitor): `#141416` ground, `#232326` grid, `#dcdce0` completed, `#2c2c2e` remaining, `#f2f2f7` text, `#ff453a` red, `#ffb340` amber, `#30d158` live.

Contrast: body text ≥ 4.5:1; metadata ≥ 3:1; focus ring visible in both themes.

## 5. i18n

All strings through `ctx.locale` / the existing `DICT`. No concatenated sentences.

New keys (zh / en):

| Key | zh | en |
|---|---|---|
| `raceControl` | 比赛控制 | Race Control |
| `season` | 赛季 | Season |
| `sessions` | 个会话 | sessions |
| `scored` | 已评分 | scored |
| `cleared` | 已收口 | cleared |
| `sectorCam` | 赛段镜头 | Sector Cam |
| `live` | 实时 | LIVE |
| `openSession` | 打开会话 | Open session |
| `filter` | 筛选 | Filter |
| `search` | 搜索标题、评语、文件 | Search titles, comments, files |
| `noSessions` | 没有符合条件的会话 | No sessions match |
| `noTrack` | 无赛道数据 | No track data |
| `unscored` | 未评分 | Not scored |
| `summarize` | 总结 | Summarize |
| `temporary` | 临时分 | provisional |
| `closed` | 已收口 | closed |
| `ongoing` | 进行中 | ongoing |
| `blocked` | 受阻 | blocked |
| `watch` | 注意 | watch |
| `dayScore` | 当日分 | day score |
| `openRecord` | 打开原始记录 | Open raw record |

Also reuse existing `rangeToday/7d/30d/90d/all`, `agent_*`, `summaryState_*`, `decision*`, `origin*`, `justNow`, `minutesAgo`.

Rules:

- Use `Intl.PluralRules(lang)` for English plurals; do not hand-write “1 sessions”.
- Use `Intl.DateTimeFormat` for dates/times; no hardcoded `MM/DD`.
- Keep zh/en widths in mind: row title and comment ellipsis; test 1280/900 and 720.
- `tok/s`, `T#`, `S#` stay literal.
- All aria-labels localized.
- Add a test that switches locale and asserts page/rail strings, no missing key.

## 6. Data mapping

From `/api/trajecable/timeline`:

| UI | Source |
|---|---|
| title | `session.title` |
| project/model | `session.project`, `session.model` |
| time | `session.start/end` |
| agent square | `session.agent` |
| score/grade | `session.ai.score`, `.grade` |
| completion | `session.ai.completion.{solved,total,rate}` |
| comment | `session.ai.comment.{verdict,judgement,advice,risk}` |
| problems | `session.ai.problems[]` |
| decisions | `session.ai.decisions[]` |
| days | `session.ai.days[]` |
| state | `session.ai.state` (normalize partial → ongoing server-side) |
| live | selected/latest session, or chat session |
| sector | `ai.days`/decisions; fallback `S2 · T4→T6` only as a label, not data |

No new API field is required. If `ai` is null, row is unscored; rail shows `Summarize` and a neutral grid; no fake values.

## 7. Component plan

```
src/client/
  page.jsx          RaceLogPage (header, season, data loading, selection)
  race/
    SeasonStrip.jsx
    SessionRow.jsx
    SectorCam.jsx
    sector-track.js  deterministic plan + camera projection
  styles.js         tokens, layout, HUD CSS
  i18n.jsx          new keys, plural helpers
```

Current `page.jsx` is 749 lines and mixes Stage Log, summaries, detail, and CSS classes. Replace it rather than layering another mode. Keep the data fetch, auto-summary (6), batch (30), and scan logic; remove row thumbnails, expanded detail, summary blocks in rows.

Selection: page state `selectedKey`; default newest session; clicking a row updates; rail scrolls into view on mobile. The chat HUD is a separate mount; it always follows the chat session, not the page selection.

## 8. Performance

- Timeline fetch already returns compact rows; do not send full transcripts.
- Only the selected sector computes the projected ribbon (~1.5k points); memoize by session key + car rate.
- Row list: windowing if >200 rows; otherwise render current day groups.
- No layout thrash: SVG path built once per selection; animate only car halo with reduced-motion guard.
- HUD image/canvas alternative is not needed; inline SVG is cheap.

## 9. Accessibility

- Row is a `<button>` or has `role="row"` with keyboard focus; Enter selects.
- Rail has `aria-live="polite"` for score changes; HUD has a text alternative (`S2, T4 to T6, 43%`).
- Focus ring uses theme brand, 2 px, visible on both themes.
- Do not rely on color alone: state text + pips; red/amber have labels.
- Motion: halo disabled under `prefers-reduced-motion`.

## 10. Migration and tests

- Bump plugin to `0.5.0`.
- Keep backend/index versions; no store rebuild.
- Remove old Stage Log classes/keys only after the new page is tested.
- Test matrix:
  - zh/en, dark/light;
  - selected row changes HUD; unscored row; Antigravity no-track;
  - 600-row fixture performance;
  - no horizontal overflow at 720/900/1280;
  - keyboard selection; focus ring;
  - screenshot matched to `preview/global-simple.png` and `preview/live-hud-opus.png`.
- Existing 23 tests must stay green; UI test updated for new DOM.

## 11. Acceptance

1. Screenshot at 1280×900 matches the approved simplified structure.
2. HUD is visually identical to the approved Sector Cam at 248×264.
3. Page works in both themes; HUD remains a dark monitor inset.
4. zh/en switch has no missing keys or clipped critical text.
5. 600 sessions do not freeze; only selected HUD is projected.
6. No new API calls or model calls.
7. Unscored/Antigravity states are honest.

## 12. Open decisions

- Light vs dark HUD: this spec keeps the HUD dark in both themes. If the user wants a light HUD, add a second token set and test it; do not improvise it during implementation.
- Rows: virtualize only after measuring 600-session scroll; do not add a library pre-emptively.
- Column 20 agent square: if it reads as noise in user testing, remove it; it is not load-bearing.
