// Race Log page styles (docs/race-log-redesign.md, preview/global-simple.html).
// The page follows the DSH theme tokens; the Sector Cam is a fixed dark monitor.
export const CSS = `
.tj-race {
  --tj-bg: var(--dsw-alias-bg-base, #0f0f10);
  --tj-s1: var(--dsw-alias-bg-layer-1, #161618);
  --tj-s2: var(--dsw-alias-bg-layer-2, #1c1c1e);
  --tj-line: var(--dsw-alias-border-l1, rgba(255,255,255,0.08));
  --tj-line-2: var(--dsw-alias-border-l2, rgba(255,255,255,0.14));
  --tj-ink: var(--dsw-alias-label-primary, #f5f5f7);
  --tj-ink2: var(--dsw-alias-label-secondary, #c7c7cc);
  --tj-mute: color-mix(in srgb, var(--tj-ink2) 70%, transparent);
  --tj-faint: color-mix(in srgb, var(--tj-ink2) 48%, transparent);
  --tj-amber: var(--dsw-alias-state-warn-primary, #ffd60a);
  --tj-red: var(--dsw-alias-state-error-primary, #ff453a);
  --tj-green: var(--dsw-alias-state-success-primary, #30d158);
  --tj-sans: -apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --tj-mono: "SF Mono", "JetBrains Mono", ui-monospace, Menlo, monospace;
  height: 100%;
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr);
  overflow: hidden;
  background: var(--tj-bg);
  color: var(--tj-ink);
  font: 13px/1.45 var(--tj-sans);
  -webkit-font-smoothing: antialiased;
}
.tj-race *, .tj-race *::before, .tj-race *::after { box-sizing: border-box; }
.tj-race :where(button) { font: inherit; color: inherit; }

/* Header: 56 px */
.tj-head {
  display: flex; align-items: center; gap: 10px; min-width: 0;
  padding: 0 24px; border-bottom: 1px solid var(--tj-line);
}
.tj-brand { font-size: 15px; font-weight: 600; white-space: nowrap; display: flex; align-items: baseline; gap: 6px; }
.tj-brand span { color: var(--tj-faint); font-weight: 400; }
.tj-brand small { font: 500 10px/1 var(--tj-mono); letter-spacing: .14em; color: var(--tj-mute); }
.tj-seg { margin-left: auto; display: flex; height: 28px; border: 1px solid var(--tj-line); border-radius: 6px; overflow: hidden; flex-shrink: 0; }
.tj-seg button { border: 0; border-left: 1px solid var(--tj-line); background: none; padding: 0 11px; font: 10.5px/1 var(--tj-mono); color: var(--tj-mute); cursor: pointer; white-space: nowrap; }
.tj-seg button:first-child { border-left: 0; }
.tj-seg button.on { background: var(--tj-s2); color: var(--tj-ink); font-weight: 500; }
.tj-search-wrap { width: 238px; min-width: 120px; flex-shrink: 1; height: 28px; display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid var(--tj-line); border-radius: 6px; color: var(--tj-faint); }
.tj-search { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--tj-ink); font: 11.5px var(--tj-sans); }
.tj-search::placeholder { color: var(--tj-faint); }
.tj-filter-wrap { position: relative; flex-shrink: 0; }
.tj-filter-btn { height: 28px; padding: 0 10px; border: 1px solid var(--tj-line); border-radius: 6px; background: none; font: 10.5px/1 var(--tj-mono); color: var(--tj-mute); cursor: pointer; white-space: nowrap; }
.tj-filter-btn.on { color: var(--tj-ink); border-color: var(--tj-line-2); }
.tj-filter-pop { position: absolute; top: 34px; right: 0; z-index: 20; width: 240px; padding: 10px; display: flex; flex-direction: column; gap: 8px; background: var(--tj-s1); border: 1px solid var(--tj-line-2); border-radius: 8px; box-shadow: 0 12px 28px rgba(0,0,0,.28); }
.tj-filter-pop[hidden] { display: none; }
.tj-select { height: 28px; width: 100%; border: 1px solid var(--tj-line); border-radius: 6px; background: var(--tj-bg); color: var(--tj-ink); font: 12px var(--tj-sans); padding: 0 6px; }
.tj-filter-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.tj-btn { height: 28px; padding: 0 10px; border: 1px solid var(--tj-line); border-radius: 6px; background: var(--tj-s2); font-size: 11.5px; cursor: pointer; white-space: nowrap; }
.tj-btn:disabled, .tj-rail-btn:disabled, .tj-row-sum:disabled { opacity: .45; cursor: default; }
.tj-head-status { font: 10px/1 var(--tj-mono); color: var(--tj-faint); white-space: nowrap; flex-shrink: 0; }

/* Workspace: list + 300 px rail */
.tj-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 360px; min-height: 0; min-width: 0; }
.tj-main { min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0 24px 24px; }

/* Season strip: 96 px */
.tj-season { height: 96px; display: flex; align-items: center; gap: 32px; border-bottom: 1px solid var(--tj-line); min-width: 0; }
.tj-season-avg { min-width: 112px; }
.tj-kicker { font: 9.5px/1 var(--tj-mono); letter-spacing: .12em; color: var(--tj-faint); white-space: nowrap; text-transform: uppercase; }
.tj-season-score { margin-top: 7px; display: flex; align-items: baseline; gap: 5px; }
.tj-season-score b { font: 600 34px/1 var(--tj-mono); letter-spacing: -.04em; }
.tj-season-score span { font: 12px/1 var(--tj-mono); color: var(--tj-mute); }
.tj-metric { display: flex; flex-direction: column; gap: 7px; white-space: nowrap; }
.tj-metric b { font: 600 17px/1 var(--tj-mono); }
.tj-metric span { font: 10px/1 var(--tj-mono); color: var(--tj-mute); }
.tj-spark { margin-left: auto; width: 260px; min-width: 120px; flex-shrink: 1; height: 54px; }
.tj-spark-avg { stroke: var(--tj-line-2); stroke-dasharray: 2 3; }
.tj-spark-line { fill: none; stroke: var(--tj-mute); stroke-width: 1; }
.tj-spark-dot { fill: var(--tj-bg); stroke: var(--tj-ink2); stroke-width: 1.2; cursor: pointer; }
.tj-spark-dot.sel { fill: var(--tj-red); stroke: var(--tj-bg); stroke-width: 1.5; }

/* Day header + 72 px rows */
.tj-day { height: 42px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--tj-line); font: 10.5px/1 var(--tj-mono); color: var(--tj-ink2); white-space: nowrap; }
.tj-day em { font: normal 10.5px var(--tj-sans); color: var(--tj-faint); }
.tj-day span { margin-left: auto; color: var(--tj-faint); font-size: 10px; }
.tj-row { height: 72px; display: grid; grid-template-columns: 46px 22px minmax(0, 1fr) auto; column-gap: 12px; align-items: center; padding: 0 10px 0 12px; border-bottom: 1px solid var(--tj-line); border-left: 2px solid transparent; cursor: pointer; outline: none; }
.tj-row:hover { background: color-mix(in srgb, var(--tj-s1) 60%, transparent); }
.tj-row:focus-visible { box-shadow: inset 0 0 0 1px var(--tj-line-2); }
.tj-row.sel { background: var(--tj-s1); border-left-color: var(--tj-ink); }
.tj-row-time { font: 10.5px/1.5 var(--tj-mono); color: var(--tj-mute); white-space: nowrap; }
.tj-row-time b { display: block; color: var(--tj-ink2); font-weight: 400; }
.tj-row-agent { width: 20px; height: 20px; border: 1px solid var(--tj-line); border-radius: 4px; display: grid; place-items: center; font: 9px/1 var(--tj-mono); color: var(--tj-mute); }
.tj-row-body { min-width: 0; }
.tj-row-title { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tj-row-title span { margin-left: 7px; font: 400 10px/1 var(--tj-mono); color: var(--tj-faint); }
.tj-row-comment { margin-top: 4px; font-size: 11.5px; color: var(--tj-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tj-row-comment i { font-style: normal; margin-right: 5px; }
.tj-row-comment i.amber, .tj-rail-gate em { color: var(--tj-amber); }
.tj-row-comment i.red { color: var(--tj-red); }
.tj-row-score { min-width: 58px; text-align: right; font: 600 18px/1 var(--tj-mono); white-space: nowrap; }
.tj-row-score span { display: block; margin-top: 4px; font: 400 10px/1 var(--tj-mono); color: var(--tj-mute); }
.tj-row-sum { height: 24px; padding: 0 8px; border: 1px solid var(--tj-line); border-radius: 5px; background: none; font: 400 11px/1 var(--tj-sans); color: var(--tj-ink2); cursor: pointer; white-space: nowrap; }
.tj-more { display: block; margin: 14px auto 0; height: 30px; padding: 0 14px; border: 1px solid var(--tj-line); border-radius: 6px; background: none; color: var(--tj-ink2); cursor: pointer; }
.tj-error { margin-top: 12px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid color-mix(in srgb, var(--tj-red) 40%, transparent); border-radius: 6px; color: var(--tj-red); font-size: 12px; }
.tj-empty { padding: 48px 20px; text-align: center; color: var(--tj-mute); }
.tj-empty h3 { margin: 0 0 6px; font-size: 14px; color: var(--tj-ink); }
.tj-empty p { margin: 0; font-size: 12px; }

/* Rail: 360 px */
.tj-rail { min-height: 0; overflow-y: auto; overflow-x: hidden; border-left: 1px solid var(--tj-line); padding: 16px 25px 20px 25px; display: flex; flex-direction: column; }
.tj-rail-head { display: flex; justify-content: space-between; gap: 8px; font: 9.5px/1 var(--tj-mono); letter-spacing: .1em; color: var(--tj-mute); white-space: nowrap; text-transform: uppercase; }
.tj-rail-empty { margin: 24px 0 0; color: var(--tj-faint); font-size: 12px; }
.tj-circuit { margin: 0 0 16px; border-radius: 10px; overflow: hidden; background: #141416; border: 1px solid rgba(255,255,255,.08); color: #f5f5f7; }
.tj-circuit-head { display: flex; justify-content: space-between; gap: 8px; padding: 9px 11px 0; font: 600 10px/1 var(--tj-mono); letter-spacing: .06em; color: #98989d; white-space: nowrap; text-transform: uppercase; }
.tj-circuit-svg { display: block; width: 100%; height: auto; aspect-ratio: 310 / 210; }
.tj-c-road { fill: none; stroke: #2c2c30; stroke-width: 11; stroke-linejoin: round; stroke-linecap: round; }
.tj-c-todo { fill: none; stroke: #8e8e93; stroke-width: 1.4; stroke-dasharray: 4 4; }
.tj-c-driven { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.tj-c-finish { stroke: #f5f5f7; stroke-width: 3; stroke-dasharray: 2 2; }
.tj-c-tick { stroke: #636366; stroke-width: 1.2; }
.tj-c-ticklabel { fill: #8e8e93; font: 600 8px var(--tj-mono); text-anchor: middle; }
.tj-c-stop { fill: #141416; stroke: #64d2ff; stroke-width: 1.5; }
.tj-c-stop.first { stroke: #f5f5f7; }
.tj-c-stoplabel { fill: #c7c7cc; font: 600 7.5px var(--tj-mono); text-anchor: middle; }
.tj-c-north path { fill: #8e8e93; }
.tj-c-north text { fill: #8e8e93; font: 600 8px var(--tj-mono); text-anchor: middle; }
.tj-circuit-legend { display: flex; align-items: center; gap: 10px; padding: 7px 11px 9px; border-top: 1px solid rgba(255,255,255,.08); background: #1c1c1e; font: 10px/1 var(--tj-mono); color: #98989d; white-space: nowrap; }
.tj-circuit-legend span { display: flex; align-items: center; gap: 4px; }
.tj-circuit-legend i { display: inline-block; width: 12px; height: 0; }
.tj-circuit-legend i.solid { height: 3px; border-radius: 2px; }
.tj-circuit-legend i.dash { border-top: 1.4px dashed #8e8e93; }
.tj-circuit-legend i.dot { width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid #64d2ff; }
.tj-circuit-legend b { margin-left: auto; font-weight: 500; color: #f5f5f7; overflow: hidden; text-overflow: ellipsis; }
.tj-rail-list { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--tj-line); }
.tj-rail-list ol { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 7px; }
.tj-rail-list li { font-size: 12px; line-height: 1.45; color: var(--tj-ink2); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; border-left: 2px solid var(--tj-line-2); padding-left: 8px; }
.tj-rail-list li span { margin-right: 6px; font: 10px/1 var(--tj-mono); color: var(--tj-faint); }
.tj-rail-list li.amber { border-left-color: var(--tj-amber); }
.tj-rail-list li.blue { border-left-color: #64d2ff; }
.tj-rail-list li.red { border-left-color: var(--tj-red); }
.tj-rail-more { margin: 6px 0 0; font: 10px/1 var(--tj-mono); color: var(--tj-faint); }

/* Chat header toggle and floating Sector Cam */
.tj-chat-hud-btn { height: 28px; min-width: 28px; padding: 0 6px; display: inline-flex; align-items: center; gap: 4px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary, #c7c7cc); cursor: pointer; font: 600 11px/1 "SF Mono", ui-monospace, Menlo, monospace; }
.tj-chat-hud-btn:hover, .tj-chat-hud-btn.on { background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.08)); color: var(--dsw-alias-label-primary, #f5f5f7); }
.tj-chat-hud { position: fixed; z-index: 30; pointer-events: auto; border-radius: 10px; font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", sans-serif; --tj-sans: -apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", sans-serif; --tj-mono: "SF Mono", "JetBrains Mono", ui-monospace, Menlo, monospace; }
.tj-chat-hud *, .tj-chat-hud *::before, .tj-chat-hud *::after { box-sizing: border-box; }
.tj-rail-title { font-size: 14px; line-height: 1.35; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.tj-rail-meta { margin-top: 5px; font: 10px/1.4 var(--tj-mono); color: var(--tj-faint); overflow-wrap: anywhere; }
.tj-rail-score { margin-top: 16px; display: flex; align-items: flex-end; gap: 7px; }
.tj-rail-score b { font: 600 30px/1 var(--tj-mono); letter-spacing: -.04em; }
.tj-rail-score > span { padding-bottom: 2px; font: 12px/1 var(--tj-mono); color: var(--tj-mute); }
.tj-rail-gate { margin-left: auto; text-align: right; font: 10px/1.5 var(--tj-mono); color: var(--tj-mute); }
.tj-rail-gate em { display: block; font-style: normal; }
.tj-rail-comment { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--tj-line); font-size: 12px; line-height: 1.65; color: var(--tj-ink2); overflow-wrap: anywhere; }
.tj-rail-comment p { margin: 0; }
.tj-rail-comment p.sub { margin-top: 5px; color: var(--tj-mute); }
.tj-rail-comment b { font-weight: 500; color: var(--tj-ink); }
.tj-rail-comment.watch b { color: var(--tj-amber); }
.tj-rail-comment.bad b { color: var(--tj-red); }
.tj-rail-comment.good b { color: var(--tj-green); }
.tj-rail-actions { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
.tj-rail-btn { height: 30px; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--tj-line); border-radius: 6px; background: none; font: 10.5px/1 var(--tj-mono); color: var(--tj-ink2); cursor: pointer; }

/* Sector Cam: compact flat monitor, 152 wide, for the empty top-left corner of the chat. */
.tj-hud {
  --tj-hud-ink: #f5f5f7; --tj-hud-ink-2: #98989d; --tj-hud-ink-3: #636366; --tj-hud-line: rgba(255,255,255,.08);
  width: 152px; flex-shrink: 0; display: grid; grid-template-rows: 20px 96px auto;
  border-radius: 8px; overflow: hidden; background: #141416; border: 1px solid #2c2c2e;
  color: var(--tj-hud-ink); font-family: var(--tj-sans);
}
.tj-hud-svg { width: 152px; height: 96px; display: block; }
.tj-hud-badge { padding: 0 8px; display: flex; align-items: center; gap: 5px; font: 600 9.5px/1 var(--tj-mono); letter-spacing: .04em; color: var(--tj-hud-ink-2); white-space: nowrap; min-width: 0; }
.tj-hud-status { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.tj-hud-total { margin-left: auto; flex-shrink: 0; color: var(--tj-hud-ink); }
.tj-hud-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--tj-hud-ink-3); flex-shrink: 0; }
.tj-hud-dot.live { background: #30d158; }
.tj-hud-strip { padding: 5px 8px 6px; border-top: 1px solid var(--tj-hud-line); background: #1c1c1e; display: grid; gap: 3px; font-variant-numeric: tabular-nums; }
.tj-hud-speed { font-family: var(--tj-mono); white-space: nowrap; line-height: 1; }
.tj-hud-speed b { font-size: 17px; font-weight: 700; letter-spacing: -.03em; }
.tj-hud-speed span { margin-left: 3px; font-size: 9.5px; color: var(--tj-hud-ink-2); }
.tj-hud-strip-bottom { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; font: 500 9.5px/1.2 var(--tj-mono); color: var(--tj-hud-ink-2); }
.tj-hud-sector { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tj-hud-conds { display: flex; gap: 6px; white-space: nowrap; flex-shrink: 0; }
.tj-hud-conds b { font-weight: 600; margin-right: 1px; }
.tj-hud-conds b.amber { color: #ffd60a; }
.tj-hud-conds b.red { color: #ff453a; }

/* Narrow widths: keep one 56 px header row; stack the rail under 680 px */
@media (max-width: 980px) {
  .tj-head { padding: 0 16px; gap: 8px; }
  .tj-brand small, .tj-head-status { display: none; }
  .tj-search-wrap { width: 160px; }
  .tj-main { padding: 0 16px 20px; }
  .tj-season { gap: 18px; }
  .tj-season-avg { min-width: 84px; }
  .tj-spark { width: 160px; }
}
@media (max-width: 680px) {
  .tj-race { grid-template-rows: 56px minmax(0, 1fr); }
  .tj-workspace { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto; overflow-y: auto; }
  .tj-main { overflow: visible; }
  .tj-rail { border-left: 0; border-top: 1px solid var(--tj-line); align-items: center; overflow: visible; }
  .tj-rail > * { width: 100%; max-width: 360px; }
  .tj-spark { display: none; }
}
`;

export const STYLES = CSS;
