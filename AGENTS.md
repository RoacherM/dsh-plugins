# DSH Plugin Development Conventions

Guidelines for building and maintaining plugins in this collection. Each plugin is an independent Git repository and a valid DSH bundle.

## Repository layout

```
plugin-name/
  package.json          # required — npm package manifest
  cordis.patch.yml      # required — Cordis patch for this bundle
  index.js              # plugin entry (or src/ + build step)
  README.md             # plugin-level documentation
  .gitignore            # always exclude node_modules/, .DS_Store
  test/                 # test files (optional but encouraged)
  src/                  # source files when a build step is needed
  dist/                 # build output; commit it when it is the installable artifact
```

## package.json requirements

```jsonc
{
  "name": "@local/dsh-<plugin-slug>",   // or a scoped public name
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./package.json": "./package.json",
    "./cordis.patch.yml": "./cordis.patch.yml"
  },
  "files": ["index.js", "cordis.patch.yml", "README.md"],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "engines": { "node": "^22.19.0 || >=24.0.0" }
}
```

The `dsh.bundle.patch` field tells DSH which Cordis patch file to apply when the bundle is installed.

## Plugin entry anatomy

A plugin module exports Cordis metadata plus either an `apply(ctx, config)` function or a default function/class. Declare `inject` for the services the plugin uses, so the loader activates it only when they exist:

```js
import Schema from '@deepseek-ai/schemastery'

export const name = 'my-plugin'
export const inject = ['tools', 'systemPrompt']

export const Config = Schema.object({
  myOption: Schema.string().default('hello'),
})

export function apply(ctx, config) {
  // A prompt section takes one object: name, finite order, text.
  ctx.systemPrompt.section({
    name: 'my-plugin:prompt',
    order: 110,
    text: `My plugin says: ${config.myOption}`,
  })

  // A tool declares its canonical output; the model sees name/description/parameters.
  ctx.tools.register({
    name: 'my_tool',
    description: 'Does something useful.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    output: {
      schema: { type: 'object', properties: { result: { type: 'string' } } },
      render: (_args, value) => [{ type: 'text', text: value.result }],
    },
    async execute() {
      return { result: 'ok' }
    },
  })
}
```

`ctx.tools.register(definition)` takes one argument and requires `output: { schema, render }`. For typed parameters and outputs, prefer `defineTool()` from `@deepseek-ai/dsh-tools`; a raw JSON Schema also works. The registry feeds visible tools into the prompt automatically.

Prompt sections interpolate `{{name}}` variables by default. Set `interpolate: false` when the text is literal (generated docs, code samples); otherwise an unknown `{{...}}` reference aborts prompt assembly.

## Cordis patch format

A bundle's own row is inserted with the package name, not a `plugin:` field:

```yaml
# cordis.patch.yml
- insert:
    - id: my-plugin
      name: '@local/dsh-my-plugin'
      config:
        myOption: hello
```

To change a shipped row, target it by `id` and restate every field it needs, because a patch replaces the row's `config` wholesale rather than deep-merging it:

```yaml
- id: preset-standard
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    # the complete declaration, with your changes
```

Other Loader fields: `disabled` (boolean, null, or a `!!js` expression evaluated at mount), `group: true` with `name: cordis:group` for nested entry lists, `isolate` for service realms, and `inject`/`intercept` for loader wiring. `!!js` scalars are evaluated against the plugin's context; never write `!js`. The built-in `cordis-composition-reference` skill is the authoritative dialect reference.

## Agent presets, persona, and prompt variables

An agent preset is an `@deepseek-ai/dsh-agent-preset` row whose `config.plugins` list mounts `@deepseek-ai/dsh-persona` and the rest of that agent's tools. A profile patch replaces a preset's complete `config` by row id, so restate every field the shipped preset carries.

- The model loop supplies `provider` and `model`; plugins can register their own facts. Do not put any other built-in into a persona template.
- Do not use `{{cwd}}`. As of 0.2.1-rc.2 the loop does not register it; `@deepseek-ai/dsh-working-directory` supplies the working directory as user context. A stale `suffix: Your working directory is {{cwd}}.` fails every turn before any model request:

  ```text
  unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"; registered variables: provider, model
  ```

- `@deepseek-ai/dsh-persona` takes `prefix` (required), `suffix` (default `''`), `complete`, and `includeRuntimeContext`. Omitting or clearing `suffix` shadows the deployment suffix away; only add one when you have text for it.

  ```yaml
  - id: persona
    name: '@deepseek-ai/dsh-persona'
    config:
      prefix: >-
        You are a coding agent powered by the {{model}} model.
  ```

- A plugin that owns a reusable fact can register its own variable with `ctx.systemPrompt.variable(name, provider)`. Names must match `[a-z][a-z0-9_]*`; document every variable the plugin registers, because an unknown reference fails assembly.

Invalid references are a composition error, not a model, provider, or network error. Fix the template and retry; switching models cannot help.

### Copied preset text drifts on upgrade

A profile patch that copies a shipped preset keeps that release's text forever: bundle patches never update it, and an app upgrade only replaces the bundled packages. After upgrading DSH:

1. Re-read the shipped preset from the installed `@deepseek-ai/dsh-web-app` package (`presets/<id>.patch.yml`; on Desktop it sits inside `app.asar`) and compare it with the copied row.
2. Re-apply only the intentional differences; drop fields and variables the new release no longer supports.
3. Validate the patch YAML, then test the changed preset in a **new session**. Existing sessions keep the preset revision they started with; a stale session can keep failing after the fix until it is recreated or the app restarts.

Record the source release beside a copied preset, so the next upgrade starts from a known baseline.

## Naming conventions

- Package name: `@local/dsh-<slug>` for private/local plugins, `dsh-plugin-<slug>` for public ones.
- Repository name: `<slug>-plugin` (e.g., `scheduler-plugin`) or `dsh-<slug>` for standalone tools.
- Plugin `name` export: matches the slug without the `dsh-` prefix (e.g., `scheduler`).

## Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`.
- Bump `MINOR` for new features, `PATCH` for fixes, `MAJOR` for breaking API changes.
- Tag releases: `git tag v0.2.0 && git push origin v0.2.0`.
- DSH upgrades are a separate axis: re-check copied patch/preset text and every API the plugin uses against the installed release. Plugin semver cannot capture harness contract changes.

## Testing

```sh
npm test        # or: node --test
pnpm test
```

Tests run with Node's built-in test runner (`node --test`). Use `--test-force-exit` when tests open async handles that don't close cleanly.

Avoid network calls or real credential access in tests. Use a temporary `HOME` dir when the plugin reads config from `~/.dsh`.

## .gitignore minimum

```
node_modules/
.DS_Store
*.log
```

Add `dist/` only if the dist output is not the installable artifact (i.e., you rebuild it on install). If `dist/` is what DSH loads at runtime, commit it.

## Adding a plugin to this hub

```sh
# From the dsh-plugins root:
git submodule add https://github.com/RoacherM/<repo-name>.git <local-dir-name>
git commit -m "chore: add <plugin-name> submodule"
git push
```

Update the plugin table in [README.md](README.md) to include the new entry.
