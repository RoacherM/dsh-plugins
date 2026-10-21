// Bundle the preview and write an HTML shell with approximate DSH theme tokens.
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

await build({
  entryPoints: [new URL('./preview.jsx', import.meta.url).pathname],
  bundle: true,
  loader: { '.json': 'json' },
  outfile: new URL('./preview.js', import.meta.url).pathname,
  format: 'iife',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
})

writeFileSync(new URL('./index.html', import.meta.url), `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><style>
:root, [data-theme=dark] {
  --dsh-surface-canvas:#121210; --dsh-surface-primary:#181816; --dsh-surface-secondary:#20201d; --dsh-surface-tertiary:#282824;
  --dsh-border-subtle:#2a2a26; --dsh-border-strong:#3a3a35;
  --dsh-text-primary:#f2f2ee; --dsh-text-secondary:#9c9c94; --dsh-text-muted:#686862;
  --dsh-accent-danger:#ff453a; --dsh-accent-warning:#ffb340; --dsh-accent-success:#32d74b;
  --dsw-alias-bg-base:#121210; --dsw-alias-bg-layer-1:#181816; --dsw-alias-bg-layer-2:#20201d; --dsw-alias-bg-overlay:#282824;
  --dsw-alias-border-l1:#2a2a26; --dsw-alias-border-l2:#3a3a35; --dsw-alias-label-primary:#f2f2ee; --dsw-alias-label-secondary:#9c9c94; --dsw-alias-label-tertiary:#686862;
}
[data-theme=light] {
  --dsh-surface-canvas:#f6f5f2; --dsh-surface-primary:#ffffff; --dsh-surface-secondary:#f0efe9; --dsh-surface-tertiary:#eae8e1;
  --dsh-border-subtle:#e2e0d8; --dsh-border-strong:#cfccc2;
  --dsh-text-primary:#1c1b18; --dsh-text-secondary:#5f5c54; --dsh-text-muted:#8c887e;
  --dsh-accent-danger:#d93829; --dsh-accent-warning:#c87a0a; --dsh-accent-success:#1f8f4e;
  --dsw-alias-bg-base:#f6f5f2; --dsw-alias-bg-layer-1:#ffffff; --dsw-alias-bg-layer-2:#f0efe9; --dsw-alias-bg-overlay:#eae8e1;
  --dsw-alias-border-l1:#e2e0d8; --dsw-alias-border-l2:#cfccc2; --dsw-alias-label-primary:#1c1b18; --dsw-alias-label-secondary:#5f5c54; --dsw-alias-label-tertiary:#8c887e;
}
html, body { margin:0; height:100%; background:var(--dsh-surface-canvas); font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",system-ui,sans-serif; }
#root { height:100%; }
</style></head><body><div id="root"></div><script src="preview.js"></script></body></html>`)
