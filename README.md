# dsh-plugins

My personal collection of DeepSeek Harness plugins.

## dsh-plugin-tiny-window

A creative hello-world plugin: your agent gets a tiny window in its workspace. The plugin registers a `look_outside` tool that paints the current time-of-day scene (`dawn` / `day` / `dusk` / `night`) as emoji or ASCII art.

It is intentionally small but covers the real plugin anatomy:

- `name` / `inject` — a Cordis plugin module
- Schemastery `Config` — user-configurable values with defaults
- `ctx.systemPrompt.section()` — a model-visible prompt contribution
- `ctx.tools.register()` — a raw JSON-Schema model-facing tool
- `package.json` `dsh.bundle` + `cordis.patch.yml` — an installable dsh bundle

```
       \   |   /
    ---( o )---
       /   |   \
~~~~~ hills ~~~~~
    [ dawn ]
```

### Install

Add this repo as a bundle to the profile you normally run. For the Web UI:

```sh
cd /path/to/dsh-plugins
dsh plugin --profile web add .
dsh web
```

For the one-shot headless profile:

```sh
dsh plugin --profile headless add .
dsh --profile headless "Look out of your tiny window. What time of day is it?"
```

From a DeepSeek Harness source checkout, use `pnpm dsh ...` instead of `dsh ...`.

Then try one of these prompts:

- `Look out of your tiny window. What time of day is it?`
- `Draw what you can see outside, ASCII style.`
- `I need a tiny break — what's the view?`

### Configure

Edit the profile layer, or patch the row:

```yaml
- id: tiny-window
  config:
    timezoneOffset: 8   # UTC offset used for the local hour
    style: emoji        # emoji | ascii
    windowTitle: tiny window
```

| Field | Default | Meaning |
| --- | --- | --- |
| `timezoneOffset` | `8` | UTC offset for the window's local time |
| `style` | `emoji` | Default scene style: `emoji` or `ascii` |
| `windowTitle` | `tiny window` | Name used in prompt and tool output |

### Develop and test

```sh
npm install
npm test
```

No build step is needed: the package ships plain ESM JavaScript. Register the repo topic `dsh-plugin` if you make it public.

### Where the concepts come from

- First plugin: `docs/user/develop/basic/` in the DeepSeek Harness repo
- Tool authoring: `docs/cookbook/adding-a-tool.md`
- Bundles: `docs/user/develop/basic/publish.md`
- Extension-point map: `docs/cookbook/extension-cookbook.md`
