# Review: Trajecable Race Log design 0.1 (target 0.5.0)

I read all of §1–§22 and the appendices, `preview/race.html`, and `preview/race.png`. I also read `src/host/store.js` and `src/host/util.js` to check one migration claim. I made no edits.

## Verdict: GO WITH CHANGES

The direction is right, and the product principles in §6 are strong. Three things are not ready to build on:

- **The token numbers are not defined clearly enough.** They could be double-counted, and they would not mean the same thing across sources.
- **The index migration in §16 would delete every stored score.** Auto-scoring would then run on top of that empty index.
- **The prototype shows numbers with no data source.** If it is used as the visual spec, those invented numbers would ship.

Fix these first, then build.

## Top 3 strengths

1. **§6 sets honest rules for the visuals.** Missing tokens show `—`, the track is labelled as a sketch, history counts each session once, and colour is never the only signal. These rules make the metaphor safe to use.
2. **§12 and §14 keep the model and the code apart.** The model returns structured facts and day-level dimension scores. Code does all the arithmetic, caps, and grades. Comments are kept apart from facts.
3. **§7.2 adds the race view on top of Stage Log instead of replacing it.** The details stay available when a card is expanded, so this is a change in how much is shown, not a rewrite.

## Blocking issues

| # | Sev | Section | Issue |
| --- | --- | --- | --- |
| 1 | **P0** | §16, §19 Phase 0 | Raising `VERSION` to 7 "rebuilds" the index. In the current code (`store.js:19`), a version mismatch discards all of `sessions`, including every `ai` score. Upgrading would turn all ~94 scored sessions back into unscored ones, and auto-score would start re-paying for them. The doc needs an explicit migration that carries `ai` over, or tokens need to be added without a version bump. |
| 2 | **P0** | §11.1, §11.4 | The rules for summing tokens can double-count. (a) Claude Code writes one JSONL line per content block, and each line repeats the same `usage`, so totals must be de-duplicated by `message.id` or `requestId`. (b) DeepSeek and other OpenAI-style providers report `prompt_tokens` with cache hits already included, so "input + cache read" counts them twice. (c) `reasoning` is already inside OpenAI `output`. The §11.4 table needs a column per source saying whether input already includes cached tokens. Without that, the line "cache tokens must not be added twice" cannot be checked. |
| 3 | **P0** | §11.4, §9.3, §10.2 | Even when the arithmetic is correct, **Fuel will mostly be cache reads.** Claude re-reads the whole context on every call, so a long session shows millions of "tokens" while doing little new work. The headline number then measures context length, not effort. Show *fresh* tokens (uncached input + output) as Fuel, and show total processed tokens as a second line. |
| 4 | **P1** | §13.2, §13.3, §17, §21.4 | Consent is unclear. §13.2 says auto-score runs "if AUTO SCORE is on" but never gives the default. §13.3 shows a notice on first use. §21.4 says "needs user confirmation". §17 says it sends prompts, paths, and commands to a provider. Sending data off the machine needs opt-in before the first call, not a notice shown while the call runs. |
| 5 | **P1** | §11.2, §4, §11.3 | §4 and §11.2 say complexity "only affects track length", but complexity is not one of the geometry inputs in §11.3. Both prototype tracks are also the same size. Choose one: complexity sets the drawn length, or it is only a number. |
| 6 | **P1** | §11.2 | The complexity formula is mostly tool calls, files, and days, and those also drive tokens. A session that flails through 200 tool calls gets a "long track", which excuses its high fuel use. The Fuel Map then becomes a diagonal line that hides waste. `problemCount` only exists after scoring, so a session's complexity jumps when it gets scored. |
| 7 | **P1** | §8.4, §9.2, prototype | Several prototype values have no source in the schema: `PIT · 12 min wasted` (decisions have no duration), `14 turns` / `3 stages` (§9.2 caps turns at 4 decisions), `62% distance` against `2/3 closed`, `96% · 4/4 closed`, `TIME ON TRACK 3d` on a 09:12–09:58 session, and `2 sessions` inside a single-session card. This breaks the §6.4 spirit (do not guess). Define how distance and car position are computed, or remove them. |
| 8 | **P1** | §6.6, §8.2, Acceptance 7 | Shapes for the four decision types are never defined. Only filled versus hollow (agent versus user) is. The doc also uses a diamond for user decisions, which would clash with any shape given to a type. The prototype legend shows `◇ 你拍板` ("you decided") but draws a hollow circle. Acceptance 7 cannot be tested as written. |
| 9 | **P1** | §12.4 vs §7 | The day-score dots and final-score rings at the top of the page are required by acceptance 3, but they appear in neither the §7 layout nor the prototype. |
| 10 | **P2** | §13.3 | "Skip sessions with 0 problems and no tools" is circular, because the problem count only exists after scoring. |
| 11 | **P2** | §9.1 | `RACE 07` is numbered by position in the list, so the number changes whenever a filter changes. Users will quote these numbers as if they were IDs. |

## Data and engineering risks

- **Coverage is assumed, not measured.** §21.2 admits that Claude and Pi may have no `usage` data. Phase 0 should start with a one-hour scan of real data that reports how many sessions per source have usage. Do this before any UI work.
- **Some totals will be incomplete.** `source: 'provider' | 'derived'` cannot express "some calls had usage and some did not". Add `callsWithUsage / modelCalls`, and mark a partial total as a lower bound (`≥ 182k`).
- **Incremental scans need more state.** The scanner reads files from byte cursors, so de-duplicating Claude message IDs means storing per-file state such as the last message ID seen. Codex resume and fork may also carry an earlier cumulative total into the new file.
- **One session can use several models.** `car` is a single model, but users switch models mid-session, and subagent files exist. Define how the car is chosen (for example, the model with the most tokens) and how the Paddock counts mixed sessions.
- **Two tabs can score the same session.** The queue lives in the browser, and the server only guards index writes. Two open tabs, or a manual rescore racing the queue, would score the same key twice. Add a server-side lock per session key on `/summary`.
- **Active sessions get rescored over and over.** The cache key includes `end`, so every new event makes the stored summary stale. On each page open, auto-score would rescore the session you are working in. State whether stale ongoing sessions count as unscored.
- **Failures can loop.** A range change clears the queue, so failed sessions are queued again on every switch. Remember failures per key (for example, "failed at summary-key X; don't auto-retry"). Treat auth and 429 errors differently from parse errors.
- **The "consecutive failures" stop rule is unclear at concurrency 2.** The order of completions is not deterministic, so "3 consecutive failures" needs a precise definition. Also state whether a manual rescore that jumps the queue makes 3 calls run at once.
- **Scoring cost is shown in seconds, not tokens.** §13.3 gives 2–7 seconds per call but no token cost. Each ~24k-character digest is several thousand tokens. A tool about fuel should show its own scoring fuel.
- **The scroll-height figure in §18 is too low.** Prototype cards are about 430 px tall, so 94 cards come to roughly 40,000 px, not 12,000. "No virtual list needed" may still hold, but check it.
- **`view=race|stage` on the API is over-design.** It is a client choice, and the server has no reason to know about it.

## UX and accessibility risks

- **The metaphor contradicts itself.** Non-goal §3.2 says "not a leaderboard", but the Paddock (§10.1) puts average scores and tokens per closed problem side by side for each model. User story 3 asks for exactly that comparison. The prototype also labels models `FAST / PRECISION / ENDURE / GRIP`, which are opinions about the models with no data behind them. Either remove the average score from car cards or accept that the Paddock is a comparison.
- **The 5-second goal in §3.1.1 fails.** The page opens with decorative hero copy, and each card is about 430 px tall. The only view that answers "which session cost most, and is it done?" is the Fuel Map, at the very bottom. Show a compact list or the Fuel Map above the race cards.
- **Finishing is the core of the metaphor but the weakest visual.** §6.2 says completion comes before ability. Yet the score (26 px) dominates, and the closed count is an 8 px label inside the SVG.
- **The prototype breaks the doc's own visual spec.** It uses a `#070a0b` background with radial gradients and a grid overlay, against §8.1. Done and solved items are green, against §8.2. Labels are 7–9 px uppercase mono, against §8.3 (minimum 11 px, no all-caps primary labels).
- **Contrast fails in the prototype.** The `--faint #536460` text on `#0c1113` is about 3:1 at 7–8 px, and many real values use that colour.
- **Colours collide.** DeepSeek V4 `#8b7cf6` and scope `#9b7cf0` are nearly the same. GPT `#9bd35a` (`#b7f34a` in the prototype) matches the UI accent `--acid`. Claude orange sits close to risk amber and detour red. Tech blue and scope purple are hard to tell apart with deuteranopia. Keep the model colours and the decision colours in separate ranges, for example models muted and decisions saturated.
- **Light theme is deferred but required.** Acceptance 8 requires a light theme, yet no light palette is given. Yellow `#d8c15a` and lime `#9bd35a` fall below 3:1 on white.
- **Narrow screens break.** Track labels sit inside a 620-wide viewBox, so at about 360 px wide they shrink to 4–5 px. The header controls do not wrap. Below about 600 px, show decisions as a list under the track.
- **Keyboard and screen-reader use are not covered.** §9.2 nodes are clickable SVG circles with no focus or keyboard path. The track's only label is `aria-label="session route"`. Mark the track `aria-hidden`, and make the decision and checkpoint list the accessible content. Add a reduced-motion rule if the glow or car is ever animated.

## The 3 changes I would make first

1. **Rewrite §11.4 and §16 before writing any code.** Add a per-source table: field paths, whether input includes cache, the de-duplication key, and whether totals are cumulative or per call. Split tokens into `fresh` (Fuel) and `processed` (secondary). Add usage coverage. Replace "old index rebuilt" with a migration that keeps `ai`. Then run the coverage scan on real data and put the numbers in the doc.
2. **Make §13 a short spec, not a list of wishes.**
   - Auto-score is off by default.
   - A one-time consent shows the estimated tokens per call.
   - "Unscored" and "stale ongoing" are separate states.
   - The server holds a lock per session key.
   - Failures are remembered per summary key.
   - Manual runs share the concurrency limit of 2.
   - Filter changes (model, project, search) clear the queue the same way range changes do.
3. **Write an encoding table that gives every visual element its data source, and delete what has none.** The table should cover track length, car position or distance, turns, pit, fuel bar width and what it is measured against, the meaning of "cleared", and the shape for each decision type. Remove from the prototype everything without a source (pit minutes, 14 turns, 3 stages, model temperament labels). Rebuild the prototype with the §8 palette and type sizes so it can serve as the spec.

## Questions for the author

1. Is the Paddock meant to compare models? If yes, say so and drop non-goal §3.2's "no leaderboard" line. If no, what should a car card show instead of an average score?
2. Should complexity describe the *task* or the *effort spent*? With the current formula it measures effort, and that hides inefficient sessions.
3. Would you ship 0.5.0 as tokens plus the safe queue inside Stage Log, and leave the race visuals for 0.6.0? The current plan bundles six new surfaces (Hero, Paddock, Track, Fuel Map, top-of-page linkage, light theme) on top of data that has not been measured yet.
