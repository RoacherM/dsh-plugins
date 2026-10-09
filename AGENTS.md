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

A plugin module must export a default function (or class) that Cordis can compose:

```js
import { Schema } from '@deepseek-ai/schemastery'

export const name = 'my-plugin'

export const Config = Schema.object({
  myOption: Schema.string().default('hello'),
})

export default function (ctx, config) {
  // Register a system-prompt section
  ctx.systemPrompt.section('my-plugin', () => `My plugin says: ${config.myOption}`)

  // Register a tool
  ctx.tools.register({
    name: 'my_tool',
    description: 'Does something useful.',
    parameters: { type: 'object', properties: {} },
  }, async (args) => {
    return { result: 'ok' }
  })
}
```

## Cordis patch format

```yaml
# cordis.patch.yml
- id: my-plugin
  plugin: .          # resolves to this package
  config:
    myOption: hello
```

## Naming conventions

- Package name: `@local/dsh-<slug>` for private/local plugins, `dsh-plugin-<slug>` for public ones.
- Repository name: `<slug>-plugin` (e.g., `scheduler-plugin`) or `dsh-<slug>` for standalone tools.
- Plugin `name` export: matches the slug without the `dsh-` prefix (e.g., `scheduler`).

## Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`.
- Bump `MINOR` for new features, `PATCH` for fixes, `MAJOR` for breaking API changes.
- Tag releases: `git tag v0.2.0 && git push origin v0.2.0`.

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
