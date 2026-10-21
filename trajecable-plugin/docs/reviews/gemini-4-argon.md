## Verdict: GO WITH CHANGES

The Race Log direction solves Stage Log's biggest weakness: it turns a wall of text summaries into a fast visual scan of effort, token burn, detours, and problem closure (§1, §3.1). However, several contradictions between `docs/race-design.md` and `preview/race.html`, a flawed complexity/token specification, and an underspecified state for unscored sessions must be resolved before implementation starts.

---

## Top 3 Strengths

1. **Honest completion-first scoring (§6.2, §12.1, §12.2):** Gating the session score by problem closure (capped at 60 for 0 solved, $-8$ and capped at 84 for partial closure, capped at 50 for blocked) prevents high-token, high-activity sessions from masquerading as successful work.
2. **Actionable semantic mapping inside each card (§4, §9.2, §9.4):** Mapping `decisions` to track turns, `detour` decisions to pit branches, `problems` to footer checkpoints, and `ai.comment` to a 3-line `RACE ENGINEER` callout gives every visual element a concrete data backing rather than decorative chrome.
3. **Pragmatic local-first architecture (§14, §15, §16, Appendix B):** Reusing the 0.4.0 summary schema, single-file atomic index (`VERSION=7`), and expandable Stage Log details avoids a backend rewrite while keeping raw transcripts off the wire and out of the index.

---

## Blocking Issues

### [P0] Top timeline (`dayScore` + `sessionFinal`) is required for acceptance but missing from IA and prototype (§7, §12.4, §20.3)
- **Evidence:** §12.4 (`顶部联动`) and Acceptance Criterion §20.3 require a top timeline where small dots represent `dayScore`, large rings represent `sessionFinal` on the last active day, and clicking jumps to the date or session card. Neither the §7 ASCII layout nor `preview/race.html` includes this component. Instead, Hero renders a static decorative copy of `RACE 07`'s track (`preview/race.html:201-215`).
- **Impact:** An engineer cannot implement §12.4 or pass §20.3 without knowing whether the timeline replaces the decorative Hero track or sits as a separate strip.

### [P0] Unscored sessions (`!session.ai`) will render as giant empty boxes (§9.2, §9.3, §9.5, §13.2)
- **Evidence:** Turns (`decisions`), pit branches (`detour`), checkpoints (`problems`), 5D bars (`dimensions`), completion percentage, and `RACE ENGINEER` comments all come from the LLM summary output (§14.2), not from the file scanner. On a range with 94 sessions where only 12 auto-score initially (§13.2), 80%+ of cards are unscored on first load. Under §9.2 and §9.3, an unscored card still occupies a full 286px-tall two-column layout (`preview/race.html:101-103`) showing a flat line ("没有记录到关键决策") and hidden telemetry rows.
- **Impact:** The page will look broken and sparse for most sessions, and "unscored" is visually conflated with "scored, 0 key decisions recorded" (§9.2).

### [P0] Complexity formula mutates after AI scoring and saturates too early (§11.2, §16)
- **Evidence:** The formula in §11.2 includes `+ 0.35 * min(6, problemCount)`. Because `problems[]` only exists after LLM scoring (§12.1, §14.2), scoring a session increases its complexity by up to $+2.1$ points. Meanwhile, the activity terms saturate early: a busy 1-day session with 20 prompts, 60 tool calls, 12 files, and 1 problem scores only $1 + 0.55\log_{10}(21) + 0.95\log_{10}(61) + 0.75\log_{10}(13) + 0.45(1) + 0.35(1) = 4.9$. Reaching $8.0+$ requires spanning 4 days ($+1.8$) and having 6 problems ($+2.1$), which allocates 43% of the 1 to 10 scale to day span and problem count rather than session complexity.
- **Impact:** Sessions jump horizontally on the Fuel Map (§10.2) after scoring, and single-day deep sessions compress into the 3 to 5 band.

### [P1] Token fallback rule for DSH risks double-counting cached tokens (§11.4)
- **Evidence:** §11.4 states "缓存 token 不能重复加", then specifies for DSH: `优先 totalTokens/total_tokens；否则 input + output + cache write + cache read`. In OpenAI-compatible and DeepSeek usage payloads, `prompt_tokens` / `input_tokens` already includes cached read tokens (`prompt_tokens_details.cached_tokens`). Adding `cache read` when `total_tokens` is missing double-counts cached input. Additionally, `TokenUsage.reasoning` (§11.1) has no extraction or inclusion rule in §11.4.
- **Impact:** Inflated and inconsistent token totals across providers.

### [P1] Metaphor contradiction: Paddock looks like the model leaderboard that §2 and §3.2 forbid (§2, §3.2, §10.1)
- **Evidence:** Hero states "不是积分榜。是一条条赛道。" (§7, `preview/race.html:192`), and §3.2 explicitly forbids model leaderboards because task difficulty varies across sessions. Immediately below Hero, Paddock (`preview/race.html:218-238`) lines up 4 models side-by-side with `AVG` scores, `TOKENS`, `/CLOSED`, and synthetic marketing tags (`FAST`, `PRECISION`, `ENDURE`, `GRIP`). Worse, §10.1 does not require `tokens / closed` to restrict its denominator to sessions that have non-null token data.
- **Impact:** Users will read Paddock as a model benchmark, and partial token coverage will skew `tokens / closed`.

### [P1] Accessibility contract (§6.6, §8.2, §20.7) is violated by the prototype's shapes, font sizes, and contrast (`preview/race.html`)
- **Evidence:**
  1. §8.2 and §20.7 require distinct shapes and text labels in addition to color for `tech`, `scope`, `risk`, and `detour`. In `preview/race.html:260-262` and `328-330`, `tech`, `scope`, and `risk` are all identical `<circle r="5">` nodes; the legend (`line 280`) uses identical 5px dots for all four types.
  2. §8.2 and §20.8 require body contrast $\ge 4.5:1$ and small labels $\ge 3:1$, and §8.3 sets the minimum auxiliary font size at `11px` with no all-caps English primary labels. `preview/race.html` uses `7px` to `9px` fonts across 20+ selectors (lines 49, 57, 60, 66, 83, 86, 95, 116, 122, 125, 148, 157, 164), relies heavily on all-caps English headers, and sets `--faint: #536460` on `#070a0b` (~3.1:1 contrast at 7px to 8px).

### [P2] Fuel Map Y-axis, track length, and card counters conflict between spec and prototype (§8.4, §9.2, §10.2, §11.2)
- **Evidence:**
  1. §10.2 specifies a logarithmic token Y-axis (`y = total tokens（对数轴）`), but `preview/race.html:387` renders a linear axis starting at `0` (`0`, `100k`, `200k`, `300k`).
  2. §11.2 says complexity controls track length ("它只影响赛道长度和散点 x 轴"), and §8.4 says completed sessions place the car at the finish line. In `preview/race.html`, `TRACK 7.2` and `TRACK 5.4` have the same closed-loop perimeter (`pathLength="100"`), and `RACE 06` (`DONE`, `4/4 closed`) sits at `96%` near Start because the loop is closed.
  3. `preview/race.html:279,290,308` shows `14 turns · 3 stages`, `3d / 2 sessions`, and `3 decisions` on a single session card, conflicting with §4 (`turn` = a decision point, `session` = 1 card).

---

## Data and Engineering Risks

1. **Cached context dominance in `tokens.total` (§11.1, §11.4):** A 30-step tool loop rereads cached context on every turn (`cachedRead` often exceeds 85% of `total`), whereas a chat session has near-zero cache reads. Displaying only `tokens.total` in Fuel and Fuel Map without surfacing the `cachedRead` vs. fresh (`input + output`) split makes multi-step tool sessions look deceptively wasteful.
2. **Concurrent summary writes vs. index locking (§13.2, §15.3, §16):** Client concurrency of 2 plus priority manual rescoring (§13.2) can trigger 3 overlapping `POST /api/trajecable/summary` calls. If the server reads `index.json` before the 2 to 7 second LLM call and writes it back via temp+rename afterward, concurrent completions will clobber each other unless the server acquires an in-memory mutex around the final read-merge-write step.
3. **Auto-score queue behavior on filter/range switches and first-run consent (§13.2, §13.3, §17):**
   - §13.3 says switching ranges clears the queue, while §13.2 says when `AUTO SCORE` is enabled, it queues the current range's newest 12 unscored sessions. If switching from `7 天` to `全部` clears the old queue and immediately enqueues 12 from `全部`, rapid filter changes still fire unwanted calls; if it pauses, the UI state (`AUTO SCORE: ON` vs. `PAUSED`) is ambiguous.
   - §17 and §21.4 note that auto-scoring sends up to 24k chars of local prompts/paths/commands to the active provider and requires user confirmation, but §13.3 describes a passive one-time notice while auto-scoring runs on open. First-run auto-scoring should require an explicit opt-in click before dispatching requests.
4. **Procedural Bezier tracks with SVG labels will overlap (§8.4, §11.3):** Generating 2 to 3 random control points from a session hash plus quadratic detour loops and placing up to 6 text labels (`START`, 4 `decisions`, `PIT`, completion `%`) in a fixed SVG will cause self-intersecting loops and colliding labels on real data.

---

## UX and Accessibility Risks

1. **Closed circuit loop obscures start, finish, and track length (§8.4, `preview/race.html:254,323`):** On a closed loop, `0%` and `100%` are the same point, so a `96%` completed session (`RACE 06`) looks like it barely left `START` if read counter-clockwise. Point-to-point stage paths (left-to-right open curves whose horizontal span or arc length scales with `complexity`) are much easier to read in 5 seconds (§3.1).
2. **Color-blindness collision between `tech`, `scope`, and model colors (§8.2):** `tech` (`#4c8dff`), `scope` (`#9b7cf0`), and `DeepSeek V4` (`#8b7cf6`) sit next to each other in blue-violet space. On a track stroked with `--car: #8b7cf6`, `scope` and `tech` nodes lose contrast.
3. **Light theme failure modes (§8.1, §8.2, §21.6):** The prototype's neon accents (`--acid: #c7f24a`, `--cyan: #4cd7f0`, `#b7f34a`, `#d8c15a`) and CSS `drop-shadow` glows will become unreadable (under $2:1$ contrast) on a light surface. Light mode needs a separate semantic palette with dark ink strokes and zero glow filters, plus a reconcile between §8.1's neutral gray spec (`#111316` / `#191c20`) and the prototype's teal/lime palette (`#070a0b` / `#c7f24a`).
4. **Responsive SVG text scaling (`preview/race.html:103,166,379`):** Both the track (`viewBox="0 0 620 250"`) and Fuel Map (`viewBox="0 0 1100 240"`) bake `7px` to `8px` text inside SVG coordinate space. On a `<900px` viewport, the SVG scales down by 40% to 60%, shrinking labels to an unreadable `3px` to `5px`.

---

## Exactly 3 Concrete Changes to Make First

1. **Replace the decorative Hero track with the §12.4 Top Timeline and design a compact Unscored Card state (§7, §9.5, §12.4):**
   - Put the interactive `dayScore` dots + `sessionFinal` rings chart inside the Hero right panel so §12.4 and §20.3 have a home without adding a fifth page section.
   - Give unscored sessions (`!session.ai`) a compact single-row or slim-card layout showing raw scanner facts (`tokens`, `complexity`, `prompts`, `toolCalls`, `files`, `duration`, and `[Summarize]` / queue position) instead of rendering an empty `620×250` track panel.
2. **Fix the Complexity and Token formulas so pre-score and post-score values never drift (§11.2, §11.4):**
   - Remove `problemCount` from `complexity` in §11.2 (reweight `prompts`, `toolCalls`, `files`, and `activeDays` so a 1-day heavy session can reach 8 to 9 without waiting for AI scoring), and flag degraded complexity when `toolCalls`/`files` are unavailable (Antigravity).
   - In §11.4, define provider-exact token formulas (never add `cachedRead` to `input` when the provider's `input_tokens` already includes cached tokens), show `cached X%` under Fuel (`9.3`), and compute Paddock's `tokens / closed` strictly over the subset of sessions where `tokens !== null && ai != null`.
3. **Switch from random closed loops to 4–6 open point-to-point stage templates with distinct node shapes (§8.2, §8.4, §11.3):**
   - Use deterministic open left-to-right SVG stage templates (scaled in length/curviness by `complexity`) with distinct Start (left) and Finish flag (right) so `0%` to `100%` progress is unambiguous and labels have guaranteed non-overlapping anchor slots.
   - Enforce distinct SVG shapes for every decision type (`tech` = circle, `scope` = diamond, `risk` = triangle, `detour` = downward pit loop + square/cross; `agent` = filled, `user` = hollow ring) and raise minimum UI text to `11px` (`--faint` contrast $\ge 4.5:1$).

---

## Questions for the Author

1. **Unscored session density (§9.2, §9.5, §13.2):** When a user opens the `30 天` or `全部` view where hundreds of sessions are unscored, should unscored sessions render as compact metadata rows until scored, or must they still render a full-height track card using scanner-derived checkpoints (e.g., prompt/tool milestones)?
2. **Hero track vs. §12.4 Timeline (§7.1, §12.4, §20.3):** Should the §12.4 `dayScore` + `sessionFinal` timeline replace the decorative track illustration in the Hero section, or did you intend to drop §12.4 in favor of the Fuel Map at the bottom?
3. **Multi-model sessions and Fuel bar scale (§8.2, §9.3, §11.1):** When a single session invokes multiple models (e.g., a fast model for sub-tasks and Opus for main turns), how should `SessionRace.car` and Paddock attribution work, and what defines `100%` on a card's Fuel progress bar (`preview/race.html:286`)?
