# dsh-rewind

Message editing and branching for DSH sessions.

Every user message gets four actions: **copy**, **edit**, **retry**, **branch**. Edit, retry and branch start a new session that continues from that message. The action row of a finished turn also gets a **re-run a step of this turn** icon (a clock), which starts the new session at a tool call or an assistant step inside that turn. The original session is never modified, so a long conversation survives a failed turn or a wrong question.

## Why

A turn can fail in the middle of a long session (for example `This turn failed: API key is invalid`). The shipped chat has no repair action at that point, and the conversation cannot continue. Rewind turns any earlier user message into a new starting point, so you keep the history and retry the failed turn.

A long turn has the same problem at a finer grain: the first three tool calls were fine, the fourth one broke the turn. Forking at the user message repeats the three good ones. The step picker starts the new session after the last good step instead.

How it works, and why the boundary is where it is: [DESIGN.md](DESIGN.md).

## Install

From the DSH plugins directory:

```sh
cd rewind-plugin
npm install          # react and react-dom, used by the tests only
```

Then install it into a profile as a bundle from its folder, and enable it in **Settings → Plugins**.

After you change `client.js`, the profile still runs the old copy: remove and re-install the bundle, then reload the window. A reload is enough when the running app composes its client modules per document; otherwise restart the app.

## Use

Point at any of your own messages in the chat transcript:

| Action | What happens |
| --- | --- |
| Copy | Copies the message text. A check mark confirms it. |
| Edit | Opens a dialog with the message text. Send (or `Cmd`/`Ctrl` + `Enter`) forks the conversation **before** that message, opens the new session, and sends your edited text there. |
| Retry | One click: forks **before** the message and sends the same text again. It appears only when that turn has ended, so a half-finished turn is never copied. This is the repair for a failed turn. |
| Branch | Forks the conversation **at** that message and opens the new session. The message is kept, everything after it is dropped. |

All actions work on any user message, including messages from earlier turns. The new session keeps its own title plus the source title, and its lineage points at the original.

When a turn fails (`This turn failed: API key is invalid`), fix the cause and press **Retry** on the message that started it. The new session repeats that turn from the same point; the failed one stays in the old session.

### Re-run a step inside a turn, or from any earlier point

The action row at the end of a turn (copy, like, dislike, branch) gets one more icon, a clock: **re-run a step of this turn**. A turn that failed has no action row, so it shows the same entry as a small text button instead. It lists the steps that can be generated again, oldest first:

| Row | What the new session does |
| --- | --- |
| Tool · `bash` | drops the step that ran that tool, then generates that step again, so the tool runs again |
| Assistant message | drops that step's message, then generates the step again |
| Answer to a question, failure, retry, steering | drops the step that held the event, then generates it again |
| End of this turn (keep it all) | keeps the whole turn and continues from there |

Two scopes sit at the top of the dialog:

| Scope | What it lists |
| --- | --- |
| This turn | the steps of the turn whose button you pressed; this is the default |
| Whole session | every step of every turn above that point, grouped by turn, newest turn first |

The whole-session scope is how you continue from a point far back, for example the step where a long run went wrong. A filter box matches text, a tool name, or `#<event number>`; over 300 rows the list keeps the first 300, so narrow the filter instead.

Pick a row and the new session opens with the history before that step, and nothing after it. The step is not copied at all: its message, its tool calls and their results are gone, so the model samples that step again from the same input. Each row shows the event number the fork uses, so a fork that lands one event off is easy to see.

Every row then sends a short **Continue** message into the child, so the model starts again at once. Without it the child would sit there complete: a forked turn ends as `forked`, and nothing runs until a new message arrives. A fork that fails leaves the dialog open and prints the reason inside it, above the buttons.

You can also skip the dialog. In an ended turn, hover any step row in the chat (a tool call, a Think row, an assistant message). Two icon buttons appear at the row's top right, in the same style as the action row (hover them for the name):

| Button | Fork point | What the new session does |
| --- | --- | --- |
| 从这里继续 / Continue from here | the last event of that step | keeps the step, its tool calls and their results; the model goes on to the next step |
| 从这一步重来 / Redo from this step | the event before that step | drops the step; the model generates it again, and its tools run again |

Both send **继续** into the new session and open it only after the message is accepted. The redo button does the same thing as picking that step's row in the dialog. Rows of a turn that is still running get no button, because the turn has no end yet; stop the turn first. The rows belong to other plugins, so the button finds them by the `data-chat-node-key` and `data-chat-turn` attributes the chat writes on each row.

Rows are steps, not single calls. Two tool calls in one step share one row, because both re-run together, and the row names them: `工具 bash · 工具 grep`.

A row whose tool call failed says so, with the reason that call reported: `✗ bash 失败（exit-1）`, or the first line of the call's own output when it reported no code. The mark comes from the tool result itself (`isError`), so it flags a failed command or a failed tool, not a turn the model could not finish; such a turn shows as its own `Failed step` row. A call that is still running is never marked.

## Limits

- The new session is a copy up to the chosen message. Tokens already spent are not refunded; the child continues on its own history.
- A branch starts empty after the copied part. Any work that came after the chosen message, including tool side effects, is not replayed.
- Edit and Retry send text only. Images and files attached to the original message are not sent again.
- Retry needs the turn to be closed. If the turn never closed (for example the app was killed), use Edit or Branch.
- Edit needs the session to be loaded in the app, because forking reads it on the Host.
- The step picker reads the Chat snapshot. A step whose nodes are not loaded shows no row; the end-of-turn row is always there. The same limit applies to the whole-session scope: it lists the turns the transcript has loaded, not turns the app never fetched.
- The boundary is derived as `start of the step - 1`, where a step starts at its `assistant-step` node. A step with no such node uses the tool call's own event minus one, which keeps that call's message and lets DSH close it with a synthetic failure. Step starts are matched per turn, because two turns interleave their event numbers.
- A re-run starts with a `Continue` message from you in the child transcript. It is a real user message, so the model also sees that you asked to continue.
- A re-run drops the step, but not its side effects: files that the step's tools wrote stay written, and background jobs they started keep running.
- Earlier steps keep their real tool results and are not generated again.

## How it works

The plugin is Client-only. It replaces the chat transcript's `user` node renderer (a keyed slot) at a lower priority than the shipped one, so DSH picks the plugin's renderer.

```
user message node ──> RewindUserMessage
                       ├─ renderFactorySlot("conversation.chat.user.content", …)   # shipped bubble: text, images, file cards
                       └─ actions row: time · copy · edit · retry · branch
```

- The bubble itself is still drawn by the shipped factory slot, so text, mentions, images and file cards look the same as before.
- Edit calls `ctx.sessions.fork({atSeq: seq - 1})`, opens the child, then `conversation.send(editedText)` on the child's context.
- Retry runs the same path with the original text. It is offered only while `node.location.turn.status === "closed"`.
- Branch calls `ctx.sessions.fork({atSeq: seq})` and opens the child.
- The step picker is a list entry in `conversation.chat.turnTail`. Its props carry the turn and the turn's closing seq; the component reads the chat snapshot (`useChat`) to find that turn's nodes, groups them by step and forks at `step start - 1`. It adds a row; it replaces no shipped renderer.
- Errors from a fork or send are shown under the message action row, not swallowed.

Files:

| File | Purpose |
| --- | --- |
| `index.js` | Host half. Empty: the plugin has no Host behavior. |
| `client.js` | The renderers, the fork operations, dictionary and styles. |
| `cordis.patch.yml` | Inserts the plugin into the Cordis tree. |
| `client.test.mjs` | Tests for the slot registrations, the rendering, the step list, and the fork call order. |

## Test

```sh
npm test
```

The tests load `client.js` through a fake `window.__ModuleLoader__`, apply the plugin to a fake context, render the registered component with `react-dom/server`, and check the calls made to a fake `sessions`/`uiWorkspace`.

Not covered by the tests: the real Host fork, the dialog's focus behavior, the CSS behavior, and the composer guard. These are checked by using the plugin in the app. For the guard, add an empty `<div data-conversation-composer-overlay>` to the conversation scroller in DevTools: the composer must stay at the bottom and the chat must still scroll.

## Composer guard

The chat screen pins its composer with `position: sticky` at the bottom of the scroll area. A view can change that layout by adding a child marked `data-conversation-composer-overlay` (the Trajectory view does). In that "overlay mode" the composer becomes `position: absolute`, and if a chat is on screen at the same time it scrolls away from the bottom.

The plugin adds two CSS rules for that state only: when the scroller holds both an overlay marker and chat rows, the composer goes back to `sticky` at the bottom and the chat view keeps its normal size and scroll. In normal mode the rules do not match, so they change nothing.

## Compatibility

The renderer shadows `conversation.chat.node` key `user` and calls the `conversation.chat.user.content` factory slot. The step picker adds an entry to `conversation.chat.turnTail` (`id: rewind-fork-point`) and reads `useChat`/`useAccess` from the slot runtime. All three slots exist in DSH 0.2.1. A DSH release that renames any of them needs this plugin updated; without the turnTail entry the step picker disappears, and the shipped chat keeps working.
