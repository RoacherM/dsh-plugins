# Live HUD handoff — design brief for Opus 5.5

## 0. Why this document

The user asked for a **live session HUD** in the top-right of the DSH chat. We have iterated through several mockups. The visual direction has not landed. The user explicitly asked:

> 俯视角 bro。我觉得你可以写一个交接文档，给opus帮你设计了

This brief gives you the full context, the hard constraints, the rejected directions, and the exact deliverable. **Design it; do not implement it in the plugin.**

## 1. Product

`trajecable` is a DSH plugin. It reads local coding-agent session logs (DSH, Claude Code, Codex, Pi, Epi, Grok, Antigravity) and shows:

- a **Stage Log** page: one session = one card, with a score, completion gate, problems, decisions, comment, and a route map;
- a planned **Race Log / live HUD**: the current session as a **track**, shown while the session runs.

The live HUD is the subject of this brief. It is not the full page. It is a small, always-visible instrument in the **top-right of the Chat view**, near the existing session header.

## 2. User and taste

The user is technical, design-sensitive, and has rejected several versions. They want something that could be printed / shown, not a generic admin widget.

Their words:

- “可以再小一点，设计得符合美学的比例啊”
- “轨道小了。应该是占据主要的视角。”
- “轨道小了，要有全局一点。不然容易看到全是直道”
- “只是全部轨道的某个part”
- “应该不是闭合的吧”
- “俯视角 bro。”

Interpretation:

- **Track first.** The track is the main subject, not a small inset.
- **Global enough.** Do not show only a straight. Show several corners.
- **But not a closed loop.** It is a live session, so the HUD shows **a part of the global circuit**, open at both ends; the rest of the track is off-screen.
- **North-up.** The route climbs upward. No rotating map, no random isometric diamond.
- **Top-down/overhead camera.** The user explicitly wants 俯视角. The current flat map is not enough. A 45° overhead camera is the most likely reading; no full 3D orbit.
- **Aesthetic proportions.** The panel must feel composed, not a dashboard squeezed into a rectangle.

## 3. Hard requirements

1. **Placement**: top-right of the DSH Chat view, floating over the chat, not a modal, not a new tab.
2. **Size**: compact. Current candidates are 230–260 px wide, 220–270 px tall. You may propose exact dimensions, but it must remain small enough to sit in the corner. It cannot be 340 px wide if that makes the track small again.
3. **Track area**: at least **70–75% of the HUD height**, full-bleed to the panel edges. Data strip only at the bottom.
4. **Camera**: 45° overhead (俯视 45°), **north-up** (route goes up). Track plane recedes upward with a visible road thickness/contact shadow; object glyphs (car, flags) should stay legible. No isometric diamond rotation.
5. **Track content**:
   - a **cropped segment** of the global circuit, entering from the bottom edge and leaving from the top edge;
   - **2–4 corners** visible, so it never reads as “all straight”;
   - completed section solid; remaining section dashed;
   - car at the current progress;
   - yellow flag and red gravel/incident markers on the road;
   - subtle sector/checkpoint marks;
   - north indicator.
6. **Not closed**: no start/finish loop, no closed circuit. It is a part of a longer track.
7. **Theme**: DSH dark theme. Use the surrounding UI’s gray/black surfaces, hairline borders, one red accent, one amber accent, green only for running. No paper background, no cream card, no heavy shadow, no gradients.
8. **Typography**: one sans for UI, one mono for telemetry. Minimum 9.5 px; 8 px labels are too small. The user dislikes tiny type.
9. **Data**:
   - driver: model + preset/executor;
   - speed: tok/s (live);
   - lap/sector: e.g. `S2 · T4→T6`;
   - progress: 43%;
   - conditions: at most 2 short items, e.g. `⚑ 等待审批`, `▲ 测试 ×2`;
   - no full event list, no long captions.
10. **Interaction**: static/live display; hover may reveal more but must not be required. Collapsible is optional, not the main concept.
11. **Must be implementable** as a React/SVG component with real session data. Avoid bitmap art, canvas-only tricks, or data we do not have.

## 4. What failed (do not repeat)

- **340×190 paper HUD with a full circuit**: the track became a worm; the panel looked like a web widget.
- **45° isometric full circuit**: track was tiny and compressed; user said it was ugly and that the track must be the main view.
- **262×162 golden-ratio rail**: too small, no global context; route became a thermometer.
- **230×220 open hook**: track had only one bend and read as a road, not a track.
- **240×260 closed loop**: user rejected it: live should not be closed.
- **240×260 flat open part**: current closest version, but it is flat; user now wants 俯视角.
- **Do not solve it by adding more labels, cards, shadows, or a leaderboard.** The problem is composition and camera, not decoration.

## 5. Current closest artifact

`preview/live-hud-part.png` (240×260):
- full-width open track, enters bottom, exits top;
- track about 73% of the panel;
- car at 43%, dashed remaining, flags;
- driver/speed/conditions at bottom;
- flat (no overhead perspective). This is the baseline you are improving.

Other files:
- `preview/live-hud-north-large.png` — track dominant but hook-like.
- `preview/live-hud-global.png` — closed loop, rejected.
- `preview/live-hud-iso.png` — 45° isometric, rejected.
- `docs/race-design.md` — broader Race Log concept and data model.
- `preview/race-programme.png` — the print-quality race programme; this is the aesthetic bar, but not the HUD layout.

## 6. Design direction to explore

Do not merely tilt the flat map. Make it feel like a **broadcast timing tower looking down at a section of circuit**:

- a dark, quiet panel with one strong horizontal/vertical axis;
- the track is a wide asphalt ribbon with a real edge, kerb, and contact shadow;
- the camera looks down at 45°, so the ribbon has thickness and the road narrows slightly toward the top;
- the car is a small red cockpit/dot with a shadow; flags are physical trackside objects, not UI icons;
- telemetry is a narrow strip at the bottom, aligned to a strict grid;
- north indicator is small and confident, not a compass rose;
- the panel should feel **engineered**, not decorated.

Avoid:
- pure top-down flat map (user has it);
- isometric diamond;
- tiny circuit in a big card;
- cream/paper card;
- status rows that look like a monitoring dashboard;
- labels floating over the track (use leader lines if labels are needed);
- more than 2 conditions.

## 7. Deliverable

Return one Markdown response with:

1. **Concept name and one-paragraph rationale.**
2. **Exact layout spec**: panel size, aspect ratio, paddings, grid, track area, data strip, font sizes, colors (hex), stroke widths, corner radii.
3. **A self-contained HTML+CSS+SVG sketch** for a 240–280 px wide panel. Use inline styles; no external fonts/assets. Show the 45° overhead track, open segment, car, flags, speed, driver, conditions. The sketch must render standalone.
4. **How the 45° perspective is constructed** (SVG transform or explicit path/ribbon geometry) and why it will not distort the car/flag glyphs.
5. **What to do at 200 px wide / 280 px wide** if the panel is resized.
6. **What not to do**, based on the failures above.

Do not edit the repository. Do not write plugin code. Design only.
