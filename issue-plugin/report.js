/**
 * Pure helpers for an issue bundle: the folder name, redaction, and the report text.
 * No I/O and no DSH imports, so the tests can call them directly.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Local `YYYYMMDD-HHMMSS` stamp used as the folder prefix. */
export function stamp(at) {
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`
    + `-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
}

/** ASCII-only folder slug. A title with no latin letters becomes `issue`. */
export function slugOf(title) {
  const slug = String(title ?? '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug === '' ? 'issue' : slug;
}

export function dirName(at, title) {
  return `${stamp(at)}-${slugOf(title)}`;
}

/**
 * Remove secrets that can reach a capture: tokens in URLs, bearer headers and
 * sk- keys. The bundle stays on this machine; this only keeps the shares clean.
 */
export function redact(text) {
  return String(text ?? '')
    .replace(/([?&](?:token|access_token|api_key|apikey|key|secret)=)[^&\s"'`]+/gi, '$1<redacted>')
    .replace(/("(?:token|access_token|api[_-]?key|secret|password|authorization)"\s*:\s*")[^"]*(")/gi, '$1<redacted>$2')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, '$1 <redacted>')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, 'sk-<redacted>');
}

/** One console entry as one line, with an indented stack when there is one. */
export function formatConsole(entry) {
  const time = typeof entry.at === 'string' ? entry.at.slice(11, 23) : '';
  const head = [time, String(entry.level ?? 'log').toUpperCase(), entry.text ?? ''].filter(Boolean).join(' ');
  const stack = typeof entry.stack === 'string' && entry.stack !== '' ? '\n' + entry.stack : '';
  return redact(head + stack);
}

const bytesText = (bytes) => {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : `${Math.max(1, Math.round(bytes / 1024))} KiB`;
};

const rectText = (rect) => (rect === undefined ? '' : `${rect.width}×${rect.height} at ${rect.left},${rect.top}`);

const code = (value) => '`' + String(value).replace(/`/g, "'") + '`';

/**
 * The maintainer-facing summary. It must stand alone: a reader with only this
 * file needs no other file to understand what was captured and where.
 */
export function renderReport({ name, at, note, client = {}, host = {}, files = [], warnings = [] }) {
  const lines = [];
  const release = client.release ?? {};
  const page = client.page ?? {};
  const win = client.window ?? {};
  const session = client.session ?? {};
  const view = client.view ?? {};

  lines.push(`# Issue ${name}`, '');
  lines.push(`- **When**: ${at.toISOString()} (local ${at.toLocaleString()})`);
  if (note) lines.push(`- **Reported**: ${redact(note).replace(/\n/g, ' ')}`);
  lines.push(`- **Page**: DSH ${release.version ?? 'unknown'}${release.commit ? ` (${release.commit})` : ''}`
    + `${view.tab ? ` · ${view.tab} tab` : ''}${view.phase ? ` · phase ${view.phase}` : ''}`);
  lines.push(`- **URL**: ${redact(page.url ?? '')}`);
  lines.push(`- **Window**: ${win.innerWidth ?? '?'}×${win.innerHeight ?? '?'} css, dpr ${win.dpr ?? '?'}, `
    + `screen ${win.screenWidth ?? '?'}×${win.screenHeight ?? '?'}, window at ${win.screenX ?? '?'},${win.screenY ?? '?'}`);
  if (session.id) {
    lines.push(`- **Session**: ${session.title ? `${session.title} ` : ''}${code(session.id)}`
      + `${session.running ? ' · running' : ''}${session.cwd ? ` · cwd ${code(session.cwd)}` : ''}`);
  }
  lines.push(`- **Host**: ${host.platform ?? '?'} ${host.release ?? ''} ${host.arch ?? ''} · node ${host.node ?? '?'}`
    + `${host.profile ? ` · profile ${code(host.profile)}` : ''}`);
  if (host.git && host.git.branch) {
    lines.push(`- **Repo**: ${code(host.git.branch)}${host.git.head ? ` @ ${host.git.head}` : ''}`
      + `${host.git.changed > 0 ? ` · ${host.git.changed} changed file(s)` : ' · clean'}`);
  }
  lines.push('');

  lines.push('## Files', '');
  lines.push('| File | Size | Contents |');
  lines.push('| --- | --- | --- |');
  for (const file of files) lines.push(`| ${code(file.name)} | ${bytesText(file.bytes)} | ${file.about} |`);
  const shot = host.screenshot;
  if (shot === undefined) lines.push(`| ${code('screenshot.png')} | — | not captured |`);
  lines.push('');

  const landmarks = client.landmarks ?? [];
  if (landmarks.length > 0) {
    lines.push('## Layout landmarks', '');
    lines.push('| Landmark | Rect | position | overflow | z-index |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const item of landmarks) {
      const s = item.styles ?? {};
      lines.push(`| ${code(item.name)} | ${rectText(item.rect)} | ${s.position ?? ''} | ${s.overflowY ?? ''} | ${s.zIndex ?? ''} |`);
    }
    lines.push('');
  }

  const transcript = client.transcript ?? [];
  if (transcript.length > 0) {
    lines.push(`## Transcript tail (${transcript.length})`, '');
    for (const item of transcript) lines.push(`- **${item.kind}** · ${redact(item.text)}`);
    lines.push('');
  }

  const consoleLog = client.console ?? [];
  lines.push(`## Console (${consoleLog.length})`, '');
  lines.push(consoleLog.length === 0 ? '_No console entries were captured._' : '```\n' + consoleLog.map(formatConsole).join('\n') + '\n```', '');

  if (host.plugins && host.plugins.length > 0) {
    lines.push('## Installed local plugins', '');
    lines.push(host.plugins.map(code).join(', '), '');
  }

  if (warnings.length > 0) {
    lines.push('## Warnings during capture', '');
    for (const warning of warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  lines.push('## Notes', '');
  lines.push('- The page snapshot (`dom.html.gz`) is the live document at capture time.');
  lines.push('- The console ring starts when the page was loaded; it is not the full history.');
  if (files.some((file) => file.name.startsWith('session-log.'))) {
    lines.push('- The session log is the raw event stream, copied while the session may still be running. '
      + 'If it ends in `.zstd`, decompress it with `zstd -d`.');
  }
  lines.push('');
  return lines.join('\n');
}
