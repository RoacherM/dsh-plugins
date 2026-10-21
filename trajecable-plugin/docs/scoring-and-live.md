# Scoring and live display

This document describes how trajecable judges a session and what the chat HUD
shows while a session runs. It matches the code in `src/host/scoring.js`,
`src/host/summarize.js`, `src/host/util.js`, `src/client/sector-track.js` and
`src/client/chat-hud.jsx`.

There are two separate paths:

| Path | Where it shows | Uses an LLM? | When it updates |
| --- | --- | --- | --- |
| **Score** | Formula page: score, grade, problems, comment | Yes, one call per session version | When a review is requested (see "When the model is called") |
| **Live counts** | Chat HUD (top right of the chat) | **No** | At once, on every new user message, LLM step, tool call or tool result in the open chat |

The HUD never uses the score. The page never shows the live counts as a score.

```text
session log on disk (~/.dsh/sessions/<workspace>/<session>/session.v4.jsonl[.zstd])
        │  adapters (code)
        ▼
session record in the index (~/.dsh/plugin-data/trajecable/index.json)
   │                                      │
   │ counts (code)                        │ digest (code) → LLM review → score (code)
   ▼                                      ▼
chat HUD: turns, steps, tools, failures, tokens   Formula page: score, grade, comment
```

## 1. Live counts (no LLM)

### What is counted

The DSH adapter reads the session log and counts these nodes:

| Node | Log event | Field |
| --- | --- | --- |
| User input | `user/message` (injected reminders are skipped) | `promptCount`; starts a new turn |
| LLM reply ("step") | `assistant/message` | `llmCount`; `turn.llm` |
| Tokens of a reply | `assistant/message` → `usage.totalTokens` | `tokens`; `turn.tokens`; `recent[]` |
| Tool call | `tool/call` | `toolCount`; `turn.tools` |
| Failed tool call | `tool/result` with an error | `errors`; `turn.errors` |

A **turn** is everything from one user input to the next. The record keeps one
entry per turn, at most the newest 200:

```json
{ "n": 3, "t": 1792505929552, "llm": 12, "tools": 9, "errors": 1, "tokens": 640000 }
```

`totalTokens` is input + cache read + output, the same figure DSH's Usage
footer adds up. Cache reads are most of it, so a step with 6k new input and
55k cached input counts as about 62k. `recent` keeps the newest 24 replies as
`{ t, tokens }`; the HUD computes the speed from it.

`n` is the turn number in the session (T3). Only the DSH adapter counts LLM
replies, because the chat HUD exists only for DSH sessions. The other adapters
fill `turns` with tools and failures; their `llm` stays 0.

### How the HUD gets fresh counts

1. The HUD asks `GET /api/trajecable/session?key=dsh:<session id>`.
2. For a `dsh:` key the host first reads that one session log, if its size or
   modification time changed (`scanDshSession` in `src/host/scan.js`). A new
   chat therefore appears at once; it does not wait for the next full scan.
   The record changes in memory at once; the index file (about 4 MB) is
   written at most once every 5 s (`store.saveSoon`).
3. The HUD watches DSH's live chat store (`useChat`, the same store the chat view
   draws from). When the open chat gains a user message, an LLM step, a tool
   call or a tool result, the HUD asks again at once. Streaming text inside a
   step does not trigger a read. It also asks once when a turn starts or ends.
   Without that store (preview, tests) it falls back to a read every 2 s while
   a turn runs.

Only one read is in flight at a time. A signal that arrives during a read
causes exactly one more read after it, so a burst of steps costs at most two
reads. Reading the largest local log (8.1 MB zstd, 1,092 LLM replies) takes
about 150 ms; one index save takes about 6 ms; counting the chat signal over
6,000 nodes takes about 0.01 ms per stream update.

### Where the HUD sits

The HUD is a fixed 152 px wide box on `document.body`, in the top-left corner
of the chat: 12 px under the session header (title row and Chat/Trajectory
tabs) and 12 px from its left edge. The message column is centred, so this
corner is usually empty; the old place under the header's right edge covered
the messages.

The place is found from the toggle button upwards (`src/client/hud-anchor.js`).
Only ancestors whose box really encloses the button count; wrappers with no
size are skipped. The header is the outermost such ancestor at most 140 px
high; the chat column is the first one taller than that. The HUD goes 12 px
under the header and 12 px right of the column's left edge. (0.7.2 did not
skip empty wrappers and put the HUD in the window's top-left corner, over the
sidebar.) The header
moves when a side panel opens or the sidebar collapses, and the window does not
resize then. So the HUD watches the button, every ancestor and every
ancestor's neighbours with a `ResizeObserver`, plus window resize, any scroll
and any finished CSS transition. It measures at most once per frame and
re-renders only when the place changes. When the button is not shown (0 × 0),
the HUD hides.

### What the HUD draws

The track is a flat map: no camera tilt, walls, shadows or glow. The map is
turned 45° so the road runs from the bottom left to the top right
(`toScreen` in `src/client/sector-track.js`). Its shape comes from a hash of
the session key, so one session always has the same track.

| Track element | Meaning |
| --- | --- |
| Corner `T<n>` | One user input. The last two turns sit on the first two corners. Older turns are off the bottom left. |
| Third corner, no label | The next user input, not yet given. |
| Car | The current turn. It starts at that turn's corner and moves down the straight as LLM replies arrive: `steps / (steps + 10)` of the straight, so it never reaches the next corner. If the log has no LLM replies, tool calls are used. |
| Solid road / dashed road | Driven / not yet driven. |
| Red gravel and ▲ | A visible turn had at least one failed tool call. |
| Yellow flag ahead of the car | The agent is idle and waits for the user. Not shown while a turn runs. |

| Strip field | Example | Source |
| --- | --- | --- |
| Status | `LIVE` / `IDLE` | DSH session status |
| Total | `共 2.3m tok` | `tokens`: all tokens of the session |
| Speed (big number) | `6.2k tok/s` | tokens of the replies in the last 30 s of this turn ÷ that time; 0 when idle |
| Turn line | `T4 · 11 步` | the current turn |
| Conditions | `▲1`, `⚑` | failed tool calls this turn; idle (full text on hover) |
| Hover text | `deepseek-v4` / `10/20 · 22:27` / `T4 · 11 步 · 10 工具` | model of the first LLM reply, time of last activity, tool count |

The track view is a 200 × 126 window of the 248 × 178 map, centred on the car.

## 2. Score (LLM review)

### Who decides what

| Decision | Made by |
| --- | --- |
| Problems and their status (`solved`, `partial`, `open`, `abandoned`) | LLM |
| Session state (`done`, `ongoing`, `blocked`) | LLM, corrected by code: `done` with unsolved problems becomes `ongoing` |
| Decisions, comment, per-day work and weights | LLM |
| Five dimension scores per day (0–100) | LLM |
| Day score, session score, completion check, grade | Code |

### The model

By default the review goes to the official DeepSeek provider that every DSH
install ships: provider `deepseek-official`, model `deepseek-flash`. It does not
follow the model of the current chat. `summaryProvider` and `summaryModel` in
the plugin config replace it. If the provider has no credential, the
Summarize button shows the provider's error; there is no fallback model.

The model receives a digest, not the transcript: user and assistant text (each
message cut to 1,200 characters), tool names, files, commands, errors and local
timestamps. The digest keeps the first 16,000 and the last 8,000 characters.
It returns this JSON:

```json
{
  "summary": "one or two sentences",
  "state": "done | ongoing | blocked",
  "problems": [{"title": "...", "status": "solved | partial | open | abandoned", "evidence": "..."}],
  "decisions": [{"type": "tech | scope | risk | detour", "by": "agent | user", "title": "...", "reason": "..."}],
  "days": [{"date": "YYYY-MM-DD", "did": "...", "closed": ["..."], "weight": 1,
            "scores": {"decision": 80, "execution": 80, "risk": 80, "verification": 80, "focus": 80}}],
  "comment": {"tone": "good | watch | bad", "verdict": "...", "judgement": "...", "advice": "...", "risk": "..."}
}
```

Missing or invalid fields get defaults: a dimension score defaults to 70, a day
weight is limited to 1–10, at most 8 problems and 8 decisions are kept.

### How the score is computed

1. **Day score** = weighted mean of the day's five dimensions:

   | Dimension | Weight |
   | --- | --- |
   | Decision quality | 25% |
   | Execution | 25% |
   | Verification | 20% |
   | Risk control | 15% |
   | Focus | 15% |

2. **Base score** = mean of the day scores, weighted by each day's `weight`
   (the LLM's estimate of how much work that day held, 1–10).
3. **Completion check** on the base score:

   | Condition | Effect |
   | --- | --- |
   | No problems listed | cap 60 |
   | Problems listed, none solved | cap 60 |
   | Some problems unsolved | −8, cap 84 |
   | All solved, two or more problems | +2 |
   | State `blocked` | cap 50 (on top of the above) |
   | State `ongoing` | marked 临时分 (provisional) |

4. **Grade**:

   | Score | Grade |
   | --- | --- |
   | ≥ 90 | A |
   | ≥ 85 | A- |
   | ≥ 78 | B+ |
   | ≥ 70 | B |
   | ≥ 60 | C |
   | < 60 | D |

Example: days score 84 and 76 with weights 2 and 1 → base 81. Two of three
problems solved → 81 − 8 = 73, under the cap 84 → **73 B**.

A range's average uses each session's final score once, with equal weight. A
session that spans three days counts once, on its last active day.

### When the model is called

- The Formula page reviews the newest 6 unscored sessions of the selected
  range by itself (`AUTO_SUMMARIZE`).
- **Summarize N** reviews the next 30 (`BATCH_SUMMARIZE`); press again to go on.
- **Summarize again** on one session forces a new call.
- A result is cached against the session's last activity, prompt count, tool
  count, summary version and time zone. When any of these changes, the old
  score is hidden until the session is reviewed again.
- The chat HUD never calls the model.
- Antigravity logs hold only conversation summaries, so those sessions are
  never scored.

## 3. Open points

- Speed moves only when a reply is written to the log. During one long
  streaming reply it decays toward 0 and then jumps. The 30 s window and the
  5 s minimum are values I chose; they are not tuned on real sessions.
- Each HUD read re-reads the whole session log. For an 8 MB log this is about
  150 ms per step. An incremental read would need a cursor inside the zstd
  stream; it is not done.
- The car position uses a constant (`steps + 10`) that I chose by eye; it is
  not tuned on real sessions.
- LLM replies are counted only for DSH. Claude Code, Codex and the others could
  count assistant messages the same way if their sessions get a HUD.
