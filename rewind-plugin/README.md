# dsh-rewind

Message editing and branching for DSH sessions.

Every user message gets four actions: **copy**, **edit**, **retry**, **branch**. Edit, retry and branch start a new session that continues from that message. The original session is never modified, so a long conversation survives a failed turn or a wrong question.

## Why

A turn can fail in the middle of a long session (for example `This turn failed: API key is invalid`). The shipped chat has no repair action at that point, and the conversation cannot continue. Rewind turns any earlier user message into a new starting point, so you keep the history and retry the failed turn.

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

## Limits

- The new session is a copy up to the chosen message. Tokens already spent are not refunded; the child continues on its own history.
- A branch starts empty after the copied part. Any work that came after the chosen message, including tool side effects, is not replayed.
- Edit and Retry send text only. Images and files attached to the original message are not sent again.
- Retry needs the turn to be closed. If the turn never closed (for example the app was killed), use Edit or Branch.
- Edit needs the session to be loaded in the app, because forking reads it on the Host.

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
- Errors from a fork or send are shown under the message action row, not swallowed.

Files:

| File | Purpose |
| --- | --- |
| `index.js` | Host half. Empty: the plugin has no Host behavior. |
| `client.js` | The renderer, the fork operations, dictionary and styles. |
| `cordis.patch.yml` | Inserts the plugin into the Cordis tree. |
| `client.test.mjs` | Tests for the slot registration, the rendering, and the fork call order. |

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

The renderer shadows `conversation.chat.node` key `user` and calls the `conversation.chat.user.content` factory slot. Both exist in DSH 0.2.1. A DSH release that renames either slot needs this plugin updated; without the shadow the shipped renderer still works, and the actions simply disappear.
