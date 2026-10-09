# dsh-plugins

My personal collection of [DeepSeek Harness](https://github.com/deepseek-ai/dsh) plugins. Each plugin lives in its own repository and is included here as a Git submodule.

## Plugins

| Directory | Package | Description |
|---|---|---|
| [agent-watchdog-plugin](agent-watchdog-plugin/) | `@local/dsh-agent-watchdog` | Watches the running agent turn for retry loops, repeated failures, file churn, and hangs |
| [autoproject-plugin](autoproject-plugin/) | `@local/dsh-autoproject` | Unattended, independently reviewed improvement ratchet on a local git repo |
| [browser-use-plugin](browser-use-plugin/) | `@local/dsh-browser-use` | `browser_*` agent tools that drive the built-in right-sidebar browser |
| [canvas-plugin](canvas-plugin/) | `@local/dsh-canvas` | Infinite canvas in the right sidebar with Seedream/Seedance image and video generation |
| [connectors-plugin](connectors-plugin/) | `@local/dsh-connectors` | MCP servers (remote OAuth or local stdio) and a built-in email connector |
| [dsh-pair](dsh-pair/) | `dsh-pair-workspace` | Pair programming workspace |
| [dsh-plugin-tiny-window](dsh-plugin-tiny-window/) | `dsh-plugin-tiny-window` | Hello-world starter plugin: gives the agent a tiny window with a `look_outside` tool |
| [magpie-tool-images-plugin](magpie-tool-images-plugin/) | `@local/dsh-magpie-tool-images` | Lets models behind the Magpie proxy see images returned by tools |
| [official-use-bundle](official-use-bundle/) | `@local/dsh-official-use` | Official DSH browser use (Playwright MCP) + computer use (Cua Driver MCP) providers |
| [pomodoro-plugin](pomodoro-plugin/) | `@local/dsh-pomodoro` | Pomodoro timer integrated into DSH |
| [remote-machine-plugin](remote-machine-plugin/) | `@local/dsh-remote-machine` | Multi-computer remote execution with `computer_id` tools for screenshots and managed commands |
| [scheduler-plugin](scheduler-plugin/) | `@local/dsh-scheduler` | Scheduled agent tasks: each run starts a fresh session in a target workspace |
| [skills-center-plugin](skills-center-plugin/) | `@local/dsh-skills` | Skills Hub: discover, inspect, and manage installed built-in and third-party skills |
| [usage-plugin](usage-plugin/) | `@local/dsh-usage` | Usage dashboard: tokens, calls, cache hits, latency, errors, and cost per model and tool |
| [web-fetch-plugin](web-fetch-plugin/) | `@local/dsh-web-fetch` | Web fetch tools for agents |
| [whale-pet-plugin](whale-pet-plugin/) | `@local/dsh-whale-pet` | Pixel whale pet in the session header that reacts to the agent's work |

## Clone with submodules

```sh
git clone --recurse-submodules https://github.com/RoacherM/dsh-plugins.git
```

To update all submodules to their latest commits:

```sh
git submodule update --remote --merge
```

## Development

See [AGENTS.md](AGENTS.md) for the plugin development conventions used across all repos in this collection.

Each plugin follows the standard DSH bundle layout:

```
plugin-name/
  package.json        # npm package with dsh.bundle field
  cordis.patch.yml    # Cordis patch declaring the plugin entry
  index.js            # Plugin entry point (or src/ with a build step)
  README.md           # Plugin-specific docs
```

Install a plugin into a DSH profile:

```sh
cd /path/to/plugin-name
dsh plugin --profile <profile> add .
```
