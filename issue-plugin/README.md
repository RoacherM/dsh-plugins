# dsh-issue

One button that saves the state of a broken page: a screenshot, the browser
console, the live DOM, and the facts around them. Works with any project in
DSH, because it records the app surface, not a project's files.

## Why

A bug report is only useful if it keeps the state when the bug is on screen.
That state changes: the console scrolls away, the DOM re-renders, the window is
resized. This plugin writes it to a folder before you close the window.

## Use

1. Open the session where the problem happened.
2. Click the warning-triangle button in the session header.
3. Write one line about what is wrong (optional). Pick what to capture.
4. Press **Save report**. The dialog shows the folder path; copy it if needed.

You get one folder per report under `~/.dsh/issues`:

```
~/.dsh/issues/
  20261019-153401-composer-floats/
    report.md        summary: versions, session, layout, console, warnings
    screenshot.png   whole screen at capture time
    console.txt      browser console (warnings and errors), newest 300 lines
    dom.html.gz      live document, gzipped
    session-log.jsonl.zstd   the session event stream (copied when found)
    report.json      the same facts as data, without the DOM
  index.md           one line per report, newest last
```

Open `report.md` first. It names the app version, the session, the window size,
the layout rectangles that decide where the composer sits, the last transcript
rows, and the console tail.

## What is captured

| Part | From | Notes |
| --- | --- | --- |
| `screenshot.png` | Host, `screencapture -x -t png` | Whole screen, macOS only. Other platforms skip it with a warning. |
| `console.txt` | Page | Ring buffer installed when the page loads, so it starts at load time. |
| `dom.html.gz` | Page | `document.documentElement.outerHTML`. Skipped above 8 MB. |
| `session-log.jsonl[.zstd]` | Host | Copy of `~/.dsh/sessions/<workspace>/<session>/session.v*.jsonl*`, skipped above 32 MB. Holds every message and tool result; it may be truncated at the tail because the session can still be running. |
| `report.md`, `report.json` | Both halves | Versions, git branch and change count, installed `@local` plugins. |
| Layout landmarks | Page | Rectangle, `position`, `overflow-y`, `z-index`, scroll offsets of the conversation shell. |
| Transcript tail | Page | Last 40 chat rows, kind and text. |

Secrets are redacted before writing: `token=`/`api_key=` style query values,
`Bearer …` headers, and `sk-…` keys.

## What is not captured

- **Host stdout.** The desktop host writes its own warnings to the process
  stdout, and no log file exists on disk. The page cannot read that stream.
  The browser console is what the page sees.
- **Long history.** The console ring holds the newest 300 entries only.

## Screen recording permission

`screencapture` runs inside the DeepSeek Harness process. If macOS has not
granted **Screen Recording** to the app, the image is empty or missing and the
report says so in `Warnings`. Grant it in System Settings → Privacy & Security →
Screen Recording, then report again.

## Configuration

The bundle root defaults to `~/.dsh/issues`. To change it, set `dir` in the
plugin config or the `DSH_ISSUE_DIR` environment variable:

```yaml
- insert:
    - id: dsh-issue
      name: '@local/dsh-issue'
      config:
        dir: /Users/me/issues          # default ~/.dsh/issues
        sessionsDir: /Users/me/.dsh/sessions   # where session logs are read
```

## Install

From this folder:

```sh
cd ~/.dsh/profiles/desktop
pnpm add file:/Users/byronwayne/Projects/sides/dsh-plugins/issue-plugin
```

Then enable **dsh-issue** in Settings → Plugins and reload the page. The
installed copy is a real copy, not a symlink: run `remove` + `install` again
after changing the source.

## Test

```sh
npm install
npm test
```

The tests cover the report text, the redaction, the route end to end in a
temporary folder, and the page collectors inside a Node `vm` sandbox.

## Files

| File | Role |
| --- | --- |
| `index.js` | Host half: the `POST /api/issue/report` route, folder writer, screen capture, git facts. |
| `report.js` | Pure helpers: folder names, redaction, console formatting, the `report.md` text. |
| `client.js` | Client half: header button, capture dialog, console ring, DOM and layout collectors. |
